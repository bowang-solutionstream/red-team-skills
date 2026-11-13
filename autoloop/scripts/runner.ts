// Reuse the validated hub/worker/ACP boundary; checks and round budgets belong to this task supervisor.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createHash, randomUUID } from 'node:crypto';
import { closeSync, existsSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const folder = resolve(process.argv[2]);
const config = JSON.parse(readFileSync(join(folder, 'task.json'), 'utf8'));
const checkout = '/Users/bow/Documents/BOWDev/agent-autoloop';
const protectedFiles = ['task.json', 'TASK.md', 'hub/rules.json'];
const digest = (name: string) => createHash('sha256').update(readFileSync(join(folder, name))).digest('hex');
const protectedHashes = protectedFiles.map(digest);
assert.equal(config.task_directory, folder);
assert.ok(Number.isInteger(config.max_rounds) && config.max_rounds > 0 && config.max_rounds <= 50);
process.env.AGENT_AUTOLOOP_HOME = join(folder, 'hub');
process.env.AGENT_AUTOLOOP_RULES = join(folder, 'hub/rules.json');
let interrupted = false;
let verifier: ReturnType<typeof spawn> | undefined;
const killVerifier = () => {
  if (verifier?.pid && verifier.exitCode === null && verifier.signalCode === null) {
    const child = verifier;
    try { process.kill(-child.pid!, 'SIGTERM'); } catch {}
    const escalate = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        try { process.kill(-child.pid!, 'SIGKILL'); } catch {}
      }
    }, 5000);
    escalate.unref();
  }
};
for (const name of ['SIGINT', 'SIGTERM'] as const) process.on(name, () => { interrupted = true; killVerifier(); });
const stopTimer = setInterval(() => {
  if (existsSync(join(folder, 'stop.request'))) { interrupted = true; killVerifier(); }
}, 250);
const delay = (ms: number) => new Promise((done) => setTimeout(done, ms));
let session: string | null = null;
let rounds = 0;
function jsonFile(name: string, value: unknown) {
  const file = join(folder, name);
  writeFileSync(file + '.tmp', JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  renameSync(file + '.tmp', file);
}
function status(state: string, extra: object = {}) {
  jsonFile('status.json', { state, task_directory: folder, session, rounds_this_run: rounds,
    model: config.model, reasoning_effort: 'xhigh', context_tokens: 262144,
    output_cap: null, output_policy: 'measured_remaining_context',
    compaction_reserve_tokens: 65536, updated_at: new Date().toISOString(), ...extra });
}
jsonFile('runner.json', { pid: process.pid, started_at: new Date().toISOString(), argv: process.argv });
status('starting');
const moduleAt = (name: string) => import(pathToFileURL(join(checkout, name)).href);
let server: any;
let hub: any;
let worker: any;
let request: any;
let ownerKey = '';
let finalState = 'failed';
let finalDetail: object = {};
try {
  const response = await fetch('http://127.0.0.1:18080/v1/models');
  assert.ok(response.ok, 'Start the local Strata backend first.');
  const models: any = await response.json();
  assert.ok(models.data.some((m: any) => m.id === config.model && m.meta?.n_ctx === 262144),
    'The Strata model or context allocation does not match this setup.');
  hub = await moduleAt('host/runtime.ts');
  const { serve } = await moduleAt('host/http.ts');
  const { hubClient } = await moduleAt('protocol/client.ts');
  const { createWorker } = await moduleAt('worker/worker.ts');
  server = serve(0, '127.0.0.1');
  await once(server, 'listening');
  const url = 'http://127.0.0.1:' + server.address().port;
  ownerKey = hub.addKey('owner', 'local-task');
  const workerKey = hub.addKey('worker', 'local-mac');
  const sourceKey = hub.addKey('source', 'local');
  worker = createWorker({ hub: hubClient(url, workerKey), name: 'local-mac', capacity: 1,
    wait: 0, log: (line: string) => console.log('WORKER ' + line) });
  request = async (key: string, path: string, body?: object) => {
    const reply = await fetch(url + path, { method: body === undefined ? 'GET' : 'POST',
      headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const value: any = await reply.json();
    assert.ok(reply.ok, `Autoloop API ${path} failed (${reply.status}).`);
    return value;
  };
  let current = await request(ownerKey, '/v1/state');
  const initialDone = new Set(current.runs.filter((r: any) => r.state === 'done').map((r: any) => r.id));
  const openAsks = current.cards.filter((c: any) => c.kind === 'ask' && c.state === 'open');
  const answerAt = process.argv.indexOf('--answer');
  let ready = true;
  if (answerAt >= 0) {
    assert.equal(openAsks.length, 1, 'Answer requires exactly one pending question.');
    const choice = Number(process.argv[answerAt + 1]);
    assert.ok(Number.isInteger(choice) && choice >= 1 && choice <= openAsks[0].options.length,
      'Choose a numbered option shown by status.');
    await request(ownerKey, '/v1/cards/' + openAsks[0].id + '/answer', { choice: choice - 1 });
  } else if (openAsks.length) {
    finalState = 'needs_user'; finalDetail = { questions: openAsks }; ready = false;
  } else {
    await request(sourceKey, '/v1/events', { id: randomUUID(), type: 'task.run',
      subject: config.id, summary: 'Run the initialized local task.' });
  }
  const started = Date.now();
  let lastLog = 0;
  const handled = new Set(initialDone);
  while (ready && !interrupted) {
    assert.ok(Date.now() - started < config.round_timeout_minutes * 60000 * (config.max_rounds + 1),
      'This invocation reached its bounded time limit.');
    await worker.tick();
    current = await request(ownerKey, '/v1/state');
    const questions = current.cards.filter((c: any) => c.kind === 'ask' && c.state === 'open');
    const finished = current.runs.filter((r: any) => r.state === 'done' && !handled.has(r.id))
      .sort((a: any, b: any) => a.id - b.id);
    for (const run of finished) {
      handled.add(run.id); rounds += 1; session = run.session ?? session;
      assert.ok(protectedFiles.every((name, i) => digest(name) === protectedHashes[i]),
        'A protected task specification or rule changed; inspect it before resuming.');
      if (questions.length) { finalState = 'needs_user'; finalDetail = { questions }; ready = false; break; }
      if (!config.check) { finalState = 'needs_review'; ready = false; break; }
      status('verifying', { run_id: run.id });
      const logPath = join(folder, `check-${Date.now()}.log`);
      const fd = openSync(logPath, 'w', 0o600);
      let timedOut = false;
      let code: number | null;
      try {
        verifier = spawn('/bin/zsh', ['-c', config.check], { cwd: config.workspace,
          detached: true, stdio: ['ignore', fd, fd] });
        const deadline = setTimeout(() => { timedOut = true; killVerifier(); },
          config.verification_timeout_seconds * 1000);
        const forceStop = setTimeout(() => {
          if (verifier?.pid && verifier.exitCode === null && verifier.signalCode === null) {
            try { process.kill(-verifier.pid, 'SIGKILL'); } catch {}
          }
        }, config.verification_timeout_seconds * 1000 + 5000);
        try { [code] = await once(verifier, 'exit') as [number | null]; }
        finally { clearTimeout(deadline); clearTimeout(forceStop); verifier = undefined; }
      } finally { closeSync(fd); }
      const result = { command: config.check, exit_code: code, timed_out: timedOut,
        output_file: logPath, round: rounds, session };
      jsonFile('last-check.json', result);
      writeFileSync(join(folder, 'VALIDATION.txt'), JSON.stringify(result, null, 2) + '\n\n' +
        readFileSync(logPath, 'utf8').slice(-12000), { mode: 0o600 });
      if (interrupted) break;
      if (code === 0 && !timedOut) { finalState = 'complete'; finalDetail = { verification: result }; ready = false; break; }
      if (rounds >= config.max_rounds) { finalState = 'round_limit'; finalDetail = { verification: result }; ready = false; break; }
      await request(sourceKey, '/v1/events', { id: randomUUID(), type: 'task.run',
        subject: config.id, summary: 'Verification failed; read VALIDATION.txt and continue.' });
    }
    if (!ready || interrupted) break;
    if (questions.length && worker.entries().length === 0) {
      finalState = 'needs_user'; finalDetail = { questions }; break;
    }
    status('running', { runs: current.runs.map((r: any) => ({ id: r.id, state: r.state, attempts: r.attempts })) });
    if (Date.now() - lastLog > 15000) {
      console.log('PROGRESS ' + JSON.stringify({ rounds, session })); lastLog = Date.now();
    }
    await delay(400);
  }
  if (interrupted) finalState = 'stopped';
} catch (error) {
  finalState = 'failed'; finalDetail = { error: error instanceof Error ? error.message : String(error) };
  process.exitCode = 1;
} finally {
  clearInterval(stopTimer);
  killVerifier();
  if (worker && request) {
    const current = await request(ownerKey, '/v1/state');
    for (const run of current.runs.filter((r: any) => ['queued', 'claimed', 'unknown'].includes(r.state))) {
      await request(ownerKey, '/v1/runs/' + run.id + '/cancel', {});
    }
    for (let attempt = 0; attempt < 120 && worker.entries().length; attempt += 1) {
      await worker.tick(); await delay(300);
    }
    if (worker.entries().length) {
      finalState = 'failed'; finalDetail = { error: 'The worker did not stop cleanly; inspect supervisor.log.' };
      process.exitCode = 1;
    }
  }
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(done));
  }
  if (hub) hub.db.close();
  status(finalState, finalDetail);
  console.log('TASK_RESULT ' + JSON.stringify({ state: finalState, rounds, session }));
}
