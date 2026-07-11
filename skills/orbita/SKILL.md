---
name: orbita
description: Use Orbita for workflow-runner host-adapter jobs when the user says /orbita, orbita, workflow-runner, run/continue/resume a workflow-runner run, follow runner stdout, handle workflow-runner host actions, worker handoff, approval gate, list workflow-runner workflows, create/design a workflow-runner workflow, or drive a run through the runner CLI.
---

# Orbita

Orbita is the portable host adapter for `workflow-runner`. The runner owns workflow state and navigation. This skill owns workflow selection, run bootstrap/resume, runner-directed host actions, user gates, and the final user-facing result.

## Hard contract

- Latest `next` or `continue --only-instructions` stdout is the only active directive and supersedes older stdout.
- Use only public run/runner commands. Never inspect or mutate private run files, task-repository source, workflow source, runner `lib/**`, schemas, CLI help, hidden prompts, or transcripts to reconstruct protocol.
- Invoke public runner commands with `--only-instructions` when supported. Execute only the current stdout and its embedded commands.
- If a directive lacks an executable instruction, report a runner contract bug. Never reconstruct commands or output JSON from source or memory.
- `write-output` accepts or rejects one current request output; it is not navigation. After every current request is accepted, run the exact embedded `continue` command. Never substitute `next` for a required `continue`.
- Orbita is not the task implementer. While a worker owns a request, do not independently inspect the task repo, implement, review, or test that task.
- Runner state is the only durable workflow state. Do not create host session registries, copied batons, transcript stores, attempt records, or output handoff files.
- Only runner status `done` is terminal. Pending requests, accepted output, recoverable blockers, approvals, and `needs_host_actions` are not final completion.
- Before any Orbita command, set `ORBITA_SKILL_ROOT` to the directory containing this `SKILL.md`: export it in a separate shell statement, then call bundled entrypoints by absolute path:
  - `$ORBITA_SKILL_ROOT/lib/entrypoints/cli/workflow-catalog.mjs`
  - `$ORBITA_SKILL_ROOT/lib/entrypoints/cli/workflow-runs.mjs`
  - `$ORBITA_SKILL_ROOT/lib/entrypoints/cli/workflow-runner.mjs`

The default runs root is `~/.orbita/workflow-runs/v1`, or `$ORBITA_HOME/workflow-runs/v1`. Set `WORKFLOW_RUNS_ROOT` only when the operator needs a non-default root.

## Operating flow

1. If an active runner stdout exists, follow it. Do not reopen catalog/bootstrap work.
2. Otherwise list, resolve, create, claim, or resume through the workflow and run bootstrap below.
3. For `needs_host_actions`, execute every current request:
   - `run_worker`: follow the worker contract below.
   - `resolve_worker_blocker`: follow the blocker contract below.
   - `wait_for_approval`: follow the approval contract below.
   - unknown action: report a runner contract bug; do not invent behavior.
   - known request that cannot be completed: submit its validated blocked output when the current directive provides a writer; do not invent terminal state.
4. Wait until every current request has accepted output, then run the exact embedded `continue --only-instructions` command with actual worker bindings and a concise safe orchestrator debug value.
5. Follow the new stdout. Stop only on `done` or when the current directive requires user input.

## Workflow and run bootstrap

Use this section only when there is no active runner stdout. Export `ORBITA_SKILL_ROOT` in a separate shell statement before the first command. Do not use a same-command assignment such as `ORBITA_SKILL_ROOT=... bun "$ORBITA_SKILL_ROOT/..."`; the shell expands the argument before that assignment applies.

### Workflow selection

If the user only asks to list workflows, run:

```bash
bun "$ORBITA_SKILL_ROOT/lib/entrypoints/cli/workflow-catalog.mjs" list --human
```

Show the list and stop unless the user also asked to execute a workflow.

Before creating a run, resolve the workflow even when the user named it:

```bash
bun "$ORBITA_SKILL_ROOT/lib/entrypoints/cli/workflow-catalog.mjs" resolve '<workflow name>' --json
```

Use workflow `name` and top-level `description` for routing. Only an absolute catalog `path` is executable.

- One resolver match: select it.
- Multiple matches: ask the user to choose by name and description.
- No match: rank catalog candidates from the user task and workflow descriptions.
- No named workflow: ask one question with at most three `name - short reason` candidates.
- No fitting candidate: offer to list workflows or create/design one; do not guess.
- Resolve fuzzy user replies again.

Never accept a user-typed or repo-relative workflow path as executable. Do not walk workflow directories or inspect step prompts to choose.

### Find or create a run

Prepare a compact title, summary, owner, harness, session id, and dense user prompt. List public run identities:

```bash
bun "$ORBITA_SKILL_ROOT/lib/entrypoints/cli/workflow-runs.mjs" list
```

Select only from public fields: `runId`, title, summary, workflow identity/path, status, timestamps, task key/fingerprint, and occupancy.

- Exactly one fitting unoccupied run: reuse it.
- Several fitting runs: ask by human-readable title/summary.
- Occupied run: ask whether to wait, choose another run, or explicitly resolve the lease.
- No fitting run: create one with the absolute catalog path:

```bash
bun "$ORBITA_SKILL_ROOT/lib/entrypoints/cli/workflow-runs.mjs" create --workflow <absolute-catalog-workflow-path> --title '<title>' --summary '<summary>'
```

If a relative-path error appears, resolve through the catalog again. Do not repair cwd or guess a path.

### Claim, start, or resume

Claim the selected run:

```bash
lease_token=$(bun "$ORBITA_SKILL_ROOT/lib/entrypoints/cli/workflow-runs.mjs" claim --run-id <run-id> --owner <owner> --harness <harness> --session-id <session-id> --print-lease-token)
```

Preserve the exact `runId` and `lease_token`. Never invent, shorten, echo to the user, or retype the token from memory. If it is missing, claim again or report missing authority.

For a new run, request the first directive:

```bash
bun "$ORBITA_SKILL_ROOT/lib/entrypoints/cli/workflow-runner.mjs" next --run-id <run-id> --user-prompt '<clear dense user task prompt>' --lease-token "$lease_token" --only-instructions
```

For an existing stable run when no active stdout survived into the current context, rerender its current public request:

```bash
bun "$ORBITA_SKILL_ROOT/lib/entrypoints/cli/workflow-runner.mjs" next --run-id <run-id> --lease-token "$lease_token" --only-instructions
```

This resume read is allowed only when no newer active stdout exists and no accepted output is waiting for the embedded `continue`. Never use it to bypass `continue`. Return to the operating flow and follow emitted stdout exactly.

## Worker requests

### Dispatch

For every current `run_worker` request:

1. If a fresh-worker request includes `agentRuntime`, apply its model and thinking level through the harness worker-creation API. Do not change a restored worker or copy this preference into its prompt.
2. Use `loadFollowupInstructionsCommand` only when the harness can continue or restore the opaque `preferredAgentId`. Otherwise use `loadInstructionsCommand` for a fresh worker.
3. If the selected command contains literal `<lease-token>`, replace only that placeholder with the exact lease token. Do not rewrite, shorten, normalize, quote-normalize, explain, or enrich the command.
4. Dispatch or restore the worker with the strict bootstrap below. Substitute only the selected command.
5. When several current worker requests are independent, dispatch all of them before waiting when the harness supports parallel creation.

After the actual worker id is known, preserve it for the exact embedded `continue --bind-agent '<step-id>=<agent-id>'` command. Use the id returned by worker creation; do not query an agent registry after spawn or wait unless creation omitted the id. Do not run a separate binding command when stdout already combines binding and continue.

Treat `preferredAgentId` and `baton.workerBindings[stepId]` only as advisory reuse hints. Do not create attempt ids, agent objects, lifecycle registries, copied output state, or transcripts.

### Strict worker bootstrap

Send the worker exactly this prompt and nothing else:

```text
Load the step instructions by running:

<selected request instruction command>

Then follow the loaded instructions exactly.

Do not add any behavior, role, output format, or constraints beyond the loaded instructions.

If the instructions cannot be loaded, stop with an error and do not continue.
```

Do not add user context, role hints, output rules, watchdog prose, or metadata to that prompt.

### Ownership

- The worker owns the task request until it writes accepted output or reports a concrete blocker.
- The orchestrator must not inspect the task repo, implement, review, test, or duplicate the worker's work while the request is outstanding.
- Workers use the validating `write-output` command from loaded instructions. They never call `continue`.
- `write-output` acceptance is the source of truth. Do not ask the worker to create or return a separate output JSON path.
- If a worker needs user input before validated output, route the focused question to the user and forward the answer into that same worker session. Do not replace the worker or answer from orchestrator inference.

### Waiting and watchdog

Use the longest supported event wait rather than short status polling.

Treat bootstrap/instruction-load silence separately from active implementation progress. Concrete progress must name current work, inspected or changed surfaces, verification state, and the next bounded checkpoint. If the worker shows that evidence, continue that same worker and ask for the next bounded checkpoint. Do not persist progress in baton, scrape transcripts, read private runner state, or add durable worker status storage.

- Accepted output, actionable failure, or concrete blocker ends the wait immediately.
- Generic heartbeat or reassurance is not a reason to send a follow-up.
- Do not wake the control model solely to ask whether the worker is still working.

Treat instruction-load/bootstrap silence separately from active task progress:

1. Allow at most 10 minutes for instruction load or concrete progress.
2. If no concrete progress appears, interrupt that same worker with one focused status request.
3. Wait at most 2 more minutes.
4. Concrete active progress: keep the same worker and wait for its next bounded checkpoint.
5. Vague status, missed checkpoint, or no evidence: instruct the worker to run validating `write-output` immediately or report the exact blocker.
6. Still no accepted output, evidence, or blocker: close the worker and retry the same current request once with a fresh worker.
7. Apply the same 10-minute plus 2-minute window to the retry.
8. If the retry also fails, submit a validated blocked output for that same current request when the runner provides a writer, then keep the run recoverable.

Do not use heartbeat as a watchdog substitute.

Wait until every current worker request has accepted output or a validated blocked result. Then run the exact latest embedded `continue` command once, replacing every worker-id placeholder with the selected actual id and the orchestrator-debug placeholder with a concise safe summary of host actions, evidence, and remaining risk.

## User-facing ownership and blocker recovery

The current agent owns every approval and user-answerable question. Do not answer, summarize away, or silently resolve a user-owned gate.

For `resolve_worker_blocker`, read the current bounded `recoverableBlocker` and resolve it through the smallest safe action. If `recoverableBlocker.needed` is user-answerable, especially from a researcher or architect, route it verbatim as a direct question. Do not answer from inference unless the blocker explicitly identifies a non-user capability or environment problem.

Write the resolution with the current `writeResolutionCommand`:

```json
{
  "resolution": {
    "summary": "What was resolved.",
    "decision": "The concrete answer or action that resolved it.",
    "evidence": ["Optional bounded public evidence."]
  }
}
```

After acceptance, run the exact embedded `continue` command. The runner will dispatch the owning step again with bounded resolution context. Treat this as continuation from the blocked point, not a workflow restart.

## Approval

For `wait_for_approval`, treat the latest inline compiled approval prompt as the complete user-facing source: workflow prompt, required reads, approval attachments, prompt input, output contract, and validating writer.

Before asking:

1. Read only files explicitly listed under `Required reads`.
2. Attach every file listed under `Approval attachments` through the host approval mechanism without opening or reading its contents.
3. In Codex/Codex Desktop, render each attachment as an absolute Markdown file link.
4. Never replace attachments with summaries, plain paths, or inline full artifact bodies.
5. Open an attachment only if the user explicitly asks a content question after the gate is presented.
6. If attachment rendering is unavailable, state the capability gap and name the affected path/reference.

Do not reduce the gate to a summary-only question. Put the complete user-facing approval request in the final message, but keep the validating command and lease token internal. After the user answers, normalize only to the strict requested JSON, call the runner-provided writer, then follow the exact embedded `continue` command.

## Pointer recovery

Use pointer commands only when the user explicitly asks to roll back or return to an earlier workflow stage.

List valid adjacent moves:

```bash
bun "$ORBITA_SKILL_ROOT/lib/entrypoints/cli/workflow-runner.mjs" list-pointer-transitions --run-id <run-id> --lease-token "$lease_token"
```

Choose only the transition whose `to.cursor` matches the requested stage, then run:

```bash
bun "$ORBITA_SKILL_ROOT/lib/entrypoints/cli/workflow-runner.mjs" move-pointer --run-id <run-id> --transition-id <id> --lease-token "$lease_token"
```

Add `--acknowledge-retained-state` only when the listed transition requires it and the user intentionally accepts retained outputs/artifacts/state. If no transition matches, stop blocked and report the available moves. Never edit baton or history files.

## Stop conditions

- Accepted resolution or approval: run exact `continue` and follow new stdout.
- User input required: stop and ask; do not continue.
- Unsupported or incomplete runner directive: report a runner contract bug.
- `done`: report the terminal result from the embedded response JSON and its workflow-specific baton/projection. Do not presume a generic `result` field.
