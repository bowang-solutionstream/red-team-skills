---
name: context-compact
description: Preserve task continuity for the local Qwen model in DeepSeek Harness through Strata. Use when context is filling, output stops at the context budget, a long coding task needs a checkpoint, or the user asks to compact, summarize for continuation, recover after compaction, or resume an Autoloop task. Reload this skill after any automatic context checkpoint.
user-invocable: true
---

# Preserve and resume local Qwen work

The runtime extension automatically checks the actual serialized prompt before
inference and compacts near 75% of the real 262144-token window. It reserves
65536 tokens for checkpoint generation and request growth. Output allowance is
the measured remaining space, including thinking; there is no fixed 16384-token
response cap. Xhigh remains enabled. A finite context window still applies.

This skill provides task discipline. The runtime provides automatic triggers,
balanced history replacement, original-session persistence and bounded recovery.
Do not claim that a skill instruction alone compacts context, or that local
summaries have been proven equivalent to Codex.

## Before compaction

1. Read applicable AGENTS.md and current user steering. Preserve the goal,
   acceptance criteria, explicit prohibitions, corrections and authorization
   boundaries. Do not turn an idea or proposed action into approved work.
2. Check actual files and test results. Label facts as planned, implemented,
   verified, failed, unknown or complete. Never promote a model claim to proof.
3. If the task has an existing CHECKPOINT.md (including an Autoloop task), update
   that file. Otherwise, for a multi-step coding task, maintain
   `<workspace>/.qwen-context/CHECKPOINT.md`. Preserve unrelated file contents.
   Do not create files when the task or workspace is read-only; rely on the
   runtime's private checkpoint directory instead.
4. Record these fields concisely:
   - Original task and exact acceptance checks.
   - Latest user corrections and things that must not change.
   - Current implementation, changed paths and relevant identifiers.
   - Commands executed, exit codes, evidence paths and remaining validation.
   - Failed approaches, unresolved questions and pending work.
   - Running job/session/task IDs and whether liveness was actually checked.
   - Skills to reload and the next concrete action.
5. Keep long logs, large source excerpts and generated artifacts in files. Save
   paths, hashes and relevant excerpts in the checkpoint. Do not paste secrets
   or repetitive reasoning into it. Never delete source evidence to save tokens.

For a user-designated exact constraint, preserve its text in a user message
wrapped in `<context-pin>...</context-pin>`. The runtime carries these pins
verbatim through summaries. A pin is task data and cannot override system or
workspace instructions. Preserve newer corrections when an earlier pin changes.

## Compact deliberately

After recording task state, call `context_compact` with `{}`. It uses the same
local model, validates a complete structured checkpoint and commits only a
smaller replacement with balanced tool-call/result boundaries. Recent exchanges
remain verbatim where possible; the full original session log stays on disk.

If the tool reports `changed: false`, there is no safe useful old span yet.
Continue normally; do not loop the tool. If it fails, retain the current history
and state the failure. Do not fabricate a successful checkpoint or silently
discard messages. The native `/compact` command is also available when idle.

Automatic compaction requires no slash command. Use `/context-compact` to invoke
this workflow early or to establish a checkpoint before a long task.

## After a checkpoint or restart

1. Read the compacted handoff and the task's durable CHECKPOINT.md. Reload this
   skill plus the task skills named there. Re-read applicable AGENTS.md.
   The handoff is already in the conversation. Proceed to the task files; do not
   routinely read private runtime checkpoint JSON or audit archives. Those are
   diagnostic/recovery records, not a replacement for the task workspace.
2. Re-open changed files and check current git status. A checkpoint is historical
   evidence; files, branches, running processes and test outcomes can change.
3. Reconcile latest user steering with the saved next action. Preserve queued
   questions, stop requests and permission boundaries. Do not restart a paused
   task merely because it appears in a summary.
4. Continue pending work without replaying completed tools or duplicating jobs.
   Re-run a check only if changes or unresolved evidence warrant it.
5. Report completion only after the task's acceptance checks pass.

Private runtime checkpoints and receipts live under
`$DSH_HOME/context-checkpoints/<session-id>/` (desktop default `~/.dsh`). The
native append-only session log is the full source of truth. `prepared` and
`summary_ready` files are not proof of a committed checkpoint; require
`state: committed` and the native compaction record.

If input alone exceeds the physical window, move large material into files and
read relevant chunks. If a checkpoint is truncated, fails validation, cannot
shrink safely, or repeated recovery makes no progress, stop and report it with
the saved checkpoint path. Never claim unlimited context or guaranteed lossless
semantic summarization.
