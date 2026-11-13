---
name: autoloop
description: Initialize and run a reusable local coding loop for any task using Agent Autoloop, the official DeepSeek Harness runtime, and Qwen on Strata. Use when the user asks to autoloop a task, initialize an autonomous coding run, or continue work with saved checkpoints.
user-invocable: true
---

# Local Qwen Autoloop

Use the user's selected project and task. Read its applicable AGENTS.md and existing
changes first. Keep the user's acceptance criteria and verification command intact.

The initializer is `/Users/bow/.local/bin/qwen-autoloop`. It uses the official
DeepSeek installation through ACP, with Xhigh thinking, a 262144-token context,
and an adaptive output allowance from the measured remaining context. Strata
must be available on 127.0.0.1:18080. There is no fixed 16384-token response cap.

## Initialize a task

1. Resolve the selected project's absolute path and the task from the user's request.
2. Select the verification command the user supplied, or the project's existing
   relevant test command. If there is no objective check, omit `--check`; the run
   then stops for review after one turn instead of asserting completion.
3. Run the initializer with shell arguments properly quoted. For long task text,
   write a task specification in the project and use `--task-file`.

```sh
/Users/bow/.local/bin/qwen-autoloop init --workspace /absolute/project \
  --task 'Implement the requested change and preserve existing behavior.' \
  --check 'python3 -m unittest -v' --max-rounds 4
```

It returns a task directory under `<project>/.qwen-autoloop/`. Initialization
creates task files and rules; it does not start inference.

If the user requested execution, start that task:

```sh
/Users/bow/.local/bin/qwen-autoloop start /absolute/project/.qwen-autoloop/TASK_ID
```

For setup-only requests, report the directory and start command and leave it ready.
After starting a requested run, use `status` to report its real state. For a
foreground run inside Harness, use `run` instead of `start` and let the shell
tool finish or report its background job. When a question is pending, present
its numbered choices; after the user answers, use `answer` to resume the saved
session. Keep the task directory in the reply so it can be managed later.

## Monitor, resume, and stop

```sh
qwen-autoloop status TASK_DIRECTORY
qwen-autoloop resume TASK_DIRECTORY
qwen-autoloop answer TASK_DIRECTORY --choice 2
qwen-autoloop stop TASK_DIRECTORY
```

`start`/`resume` detach a bounded task process. `run` runs it in the foreground.
The supervisor runs the supplied check after each agent turn, supplies failed
checks to the same saved ACP session, and stops on a passing check, a question,
the round limit, or a requested stop. Answer choices are numbered from 1.
Do not start another task loop from inside an existing worker turn.

Each worker's Harness home is `<task-directory>/harness`, so its profile and
session writes stay inside the selected project. `status` reads saved task state
and does not inspect OS processes; an active state is not a separate process
liveness attestation. `stop` writes a cooperative stop request in the task
directory. Wait for `stopped` before resuming.

## Context continuity

The worker updates `CHECKPOINT.md` with the current goal, changed files, commands
and results, unresolved issues, and next step before ending each turn. These
files survive session compaction and process restarts. Keep large tool output in
files and reference the relevant section instead of repeatedly dumping it.

Load `context-compact` for long tasks and after any checkpoint. The local runtime
compacts automatically near 75% context pressure, retains a balanced recent
tail, and saves structured checkpoints while preserving original session logs.
It reserves 65536 tokens for checkpointing and request growth. `context_compact`
requests an early checkpoint during a task; `/compact` works when idle.
Compaction does not increase the model's physical context capacity.

Report actual `status.json`, check exit codes, and any pending question. A model's
claim of success alone is not a passing check. Do not commit, push, deploy, or
send messages unless the task explicitly authorizes those actions.
