#!/usr/bin/env python3
"""Initialize and control bounded task loops using the validated Autoloop bridge."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import uuid

INTEGRATION = Path('/Users/bow/Documents/BOWDev/strata-local/integrations/deepseek-strata')
LAUNCHER = INTEGRATION / 'official-desktop/dsh-official.py'
RUNNER = Path(__file__).resolve().with_name('runner.ts')
NODE = '/opt/homebrew/bin/node'


def write_json(path, value):
    temporary = path.with_name(path.name + '.tmp')
    temporary.write_text(json.dumps(value, indent=2) + '\n')
    temporary.chmod(0o600)
    temporary.replace(path)


def task_folder(value):
    folder = Path(value).expanduser().resolve()
    if not (folder / 'task.json').is_file():
        raise ValueError('Use the initialized task directory containing task.json.')
    return folder


ACTIVE_STATES = {'starting', 'running', 'verifying'}


def launch(folder, choice=None, foreground=False):
    state = json.loads((folder / 'status.json').read_text())['state']
    if state in ACTIVE_STATES:
        raise ValueError('This task has active saved state. Stop it and wait for stopped state before resuming.')
    (folder / 'stop.request').unlink(missing_ok=True)
    args = [NODE, str(RUNNER), str(folder)]
    if choice is not None:
        if choice < 1:
            raise ValueError('Answer choices start at 1.')
        args.extend(['--answer', str(choice)])
    if foreground:
        os.execv(NODE, args)
    with (folder / 'supervisor.log').open('ab') as log:
        process = subprocess.Popen(args, stdin=subprocess.DEVNULL, stdout=log,
                                   stderr=subprocess.STDOUT, start_new_session=True)
    print(json.dumps({'state': 'starting', 'pid': process.pid, 'task_directory': str(folder),
                      'status_command': f'qwen-autoloop status {str(folder)!r}'}))


def initialize(args):
    workspace = Path(args.workspace).expanduser().resolve()
    if not workspace.is_dir():
        raise ValueError('The workspace must already exist; it was not created or changed.')
    task = Path(args.task_file).expanduser().read_text() if args.task_file else args.task
    if not task or not task.strip():
        raise ValueError('Supply a nonempty --task or --task-file.')
    if not 1 <= args.max_rounds <= 50:
        raise ValueError('--max-rounds must be between 1 and 50.')
    ident = args.id or datetime.now(timezone.utc).strftime('task-%Y%m%d-%H%M%S-') + uuid.uuid4().hex[:6]
    if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}', ident):
        raise ValueError('--id must be a simple task name without path separators.')
    folder = workspace / '.qwen-autoloop' / ident
    folder.mkdir(parents=True, mode=0o700, exist_ok=False)
    hub = folder / 'hub'
    hub.mkdir(mode=0o700)
    config = {'version': 1, 'id': ident, 'workspace': str(workspace),
              'task_directory': str(folder), 'check': args.check,
              'max_rounds': args.max_rounds, 'round_timeout_minutes': 15,
              'verification_timeout_seconds': 300,
              'runtime': 'official-deepseek-desktop', 'model': 'qwen3.8-flash-next-uncensored-iq3_xxs'}
    write_json(folder / 'task.json', config)
    (folder / 'TASK.md').write_text('# Task\n\n' + task.strip() + '\n\n## Verification\n\n' +
                                   (args.check or 'No automatic verifier; stop for review after one turn.') + '\n')
    (folder / 'CHECKPOINT.md').write_text('# Task checkpoint\n\n## Goal\n' + task.strip() +
        '\n\n## Status\nInitialized.\n\n## Files and decisions\n(none)\n\n## Commands and results\n(none)\n\n## Remaining issues\nWork has not started.\n\n## Next step\nRead the project guidance and begin the task.\n')
    prompt = (f'This is one already initialized coding task. Load the autoloop-worker skill. '
              f'Read TASK.md, CHECKPOINT.md, and VALIDATION.txt if present under {folder}. '
              f'Read the context JSON named by AGENT_AUTOLOOP_CONTEXT, including its answers. '
              f'Work only on this task in {workspace}; keep task.json, TASK.md, hub/rules.json, '
              f'and supervisor state intact. Update CHECKPOINT.md before finishing. '
              f'Do not initialize another loop or schedule another worker.')
    rules = {'timezone': 'America/Denver',
             'askFirst': ['Deleting data', 'External messages', 'Paid actions'],
             'sources': {'local': {'name': 'Local task supervisor'}},
             'agents': {'qwen': {'name': 'Local Qwen through official DeepSeek Harness',
                        'worker': 'local-mac', 'use': 'acp',
                        'command': [str(LAUNCHER), '--home', str(folder / 'harness'), 'acp'],
                        'access': 'edit', 'timeout': 15}},
             'channels': {},
             'rules': [{'name': 'local-task', 'when': {'source': 'local', 'types': ['task.run']},
                        'to': 'qwen', 'cwd': str(workspace), 'resume': True, 'prompt': prompt}]}
    write_json(hub / 'rules.json', rules)
    write_json(folder / 'status.json', {'state': 'initialized', 'task_directory': str(folder),
                                      'rounds_this_run': 0, 'session': None})
    print(json.dumps({'state': 'initialized', 'task_directory': str(folder),
                      'start_command': f'qwen-autoloop start {str(folder)!r}',
                      'status_command': f'qwen-autoloop status {str(folder)!r}'}))
    if args.start:
        launch(folder)


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    init = sub.add_parser('init', help='Prepare any task; inference starts only with --start or start/run.')
    init.add_argument('--workspace', default=os.getcwd())
    text = init.add_mutually_exclusive_group(required=True)
    text.add_argument('--task')
    text.add_argument('--task-file')
    init.add_argument('--check', help='Trusted project verification command, executed from the workspace.')
    init.add_argument('--max-rounds', type=int, default=4)
    init.add_argument('--id')
    init.add_argument('--start', action='store_true')
    for command in ['start', 'run', 'resume', 'status', 'stop', 'answer']:
        item = sub.add_parser(command)
        item.add_argument('task_directory')
        if command == 'answer':
            item.add_argument('--choice', type=int, required=True)
    args = parser.parse_args()
    try:
        if args.command == 'init':
            initialize(args)
            return
        folder = task_folder(args.task_directory)
        if args.command == 'status':
            record = json.loads((folder / 'status.json').read_text())
            record['supervisor_running'] = None if record['state'] in ACTIVE_STATES else False
            record['status_source'] = 'saved_task_state; process visibility is not required'
            print(json.dumps(record, indent=2))
        elif args.command == 'stop':
            state = json.loads((folder / 'status.json').read_text())['state']
            if state in ACTIVE_STATES:
                (folder / 'stop.request').write_text('stop\n')
            print(json.dumps({'state': 'stop_requested' if state in ACTIVE_STATES else 'not_running'}))
        else:
            launch(folder, getattr(args, 'choice', None), foreground=args.command == 'run')
    except (ValueError, OSError, KeyError) as exc:
        parser.exit(1, f'qwen-autoloop: {exc}\n')


if __name__ == '__main__':
    main()
