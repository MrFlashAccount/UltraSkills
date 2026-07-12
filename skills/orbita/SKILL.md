---
name: orbita
description: Use Orbita for workflow-runner host-adapter jobs when the user says /orbita, orbita, workflow-runner, run/continue/resume a workflow-runner run, follow runner stdout, handle workflow-runner host actions, worker handoff, approval gate, list workflow-runner workflows, create/design a workflow-runner workflow, or drive a run through the runner CLI.
---

# Orbita

Portable host adapter for `workflow-runner`. The runner owns state, navigation, current requests, validating writers, and terminal projection. This skill bootstraps/resumes runs and supplies host-only safety rules.

## Contract

- Latest `next` or `continue --only-instructions` stdout is the sole active directive. It supersedes older stdout.
- Execute that directive exactly. It already supplies current actions, dynamic commands, schemas, bindings, approval text, continuation, and terminal JSON. Do not restate or reconstruct them from this skill.
- Use public run/runner commands only. Never inspect or mutate private run files, task-repository source, workflow source, runner `lib/**`, schemas, CLI help, hidden prompts, or transcripts to recover protocol.
- `write-output` accepts one current request output; it does not navigate. Only the exact embedded `continue` advances after all current outputs are accepted. Never substitute `next`.
- Orbita is not the task implementer. While a worker owns a request, do not independently inspect, implement, review, or test that task.
- Runner state is the only durable workflow state. Do not create host registries, copied batons, transcripts, attempts, or output handoff files.
- Only runner status `done` is terminal. Pending requests, accepted output, non-blocking stops, approvals, and `needs_host_actions` are not completion.
- Before any Orbita command, set `ORBITA_SKILL_ROOT` to the directory containing this `SKILL.md`. Export it separately; a same-command assignment expands too late. Use these absolute entrypoints:
  - `$ORBITA_SKILL_ROOT/lib/entrypoints/cli/workflow-catalog.mjs`
  - `$ORBITA_SKILL_ROOT/lib/entrypoints/cli/workflow-runs.mjs`
  - `$ORBITA_SKILL_ROOT/lib/entrypoints/cli/workflow-runner.mjs`

Runs default to `~/.orbita/workflow-runs/v1`, or `$ORBITA_HOME/workflow-runs/v1`. Set `WORKFLOW_RUNS_ROOT` only for an explicit non-default root.

## Start or resume

If active runner stdout exists, skip bootstrap and follow it.

List-only request:

```bash
bun "$ORBITA_SKILL_ROOT/lib/entrypoints/cli/workflow-catalog.mjs" list --human
```

Show the list and stop unless execution was also requested. Otherwise resolve the named/fuzzy workflow before creating a run:

```bash
bun "$ORBITA_SKILL_ROOT/lib/entrypoints/cli/workflow-catalog.mjs" resolve '<workflow name>' --json
```

Use public `name` and description for routing; only returned absolute catalog `path` is executable. One match: use it. Several: ask by name/description. No name or match: offer at most three catalog candidates, then resolve the reply again. No fit: offer listing or workflow design. Never accept user-typed/repo-relative paths, walk workflow directories, or inspect step prompts to choose.

List public runs:

```bash
bun "$ORBITA_SKILL_ROOT/lib/entrypoints/cli/workflow-runs.mjs" list
```

Select only from public identity, summary, status, timestamps, task fingerprint, and occupancy. Reuse one clear unoccupied match; ask when several match or one is occupied. Otherwise create with the resolved path:

```bash
bun "$ORBITA_SKILL_ROOT/lib/entrypoints/cli/workflow-runs.mjs" create --workflow <absolute-catalog-path> --title '<title>' --summary '<summary>'
```

Claim it:

```bash
lease_token=$(bun "$ORBITA_SKILL_ROOT/lib/entrypoints/cli/workflow-runs.mjs" claim --run-id <run-id> --owner <owner> --harness <harness> --session-id <session-id> --print-lease-token)
```

If claim reports `occupied` or `stale`, stop and tell the user that the run
already has a lease from another holder. Offer a forced takeover by rerunning
that exact claim command with `--takeover`; never force takeover without user
approval.
After approval, preserve the newly issued token because takeover invalidates
the previous holder's token.

Preserve exact `runId` and `lease_token`; never invent, shorten, expose, or retype them from memory. Missing token means claim again or report missing authority.

Start new:

```bash
bun "$ORBITA_SKILL_ROOT/lib/entrypoints/cli/workflow-runner.mjs" next --run-id <run-id> --user-prompt '<dense task>' --lease-token "$lease_token" --only-instructions
```

Resume a stable run only when no active stdout exists and no accepted output awaits its embedded `continue`:

```bash
bun "$ORBITA_SKILL_ROOT/lib/entrypoints/cli/workflow-runner.mjs" next --run-id <run-id> --lease-token "$lease_token" --only-instructions
```

## Execute current directive

Execute every listed host request. Unknown action or missing executable data is a runner contract bug. Do not infer a replacement.

### Worker

Use the directive's follow-up loader only when restoring its preferred worker; otherwise use its fresh loader. Replace only a literal `<lease-token>` placeholder when present. Apply any fresh-worker runtime preference from stdout at worker creation.

Send exactly:

```text
Load the step instructions by running:

<selected request instruction command>

Then follow the loaded instructions exactly.

Do not add any behavior, role, output format, or constraints beyond the loaded instructions.

If the instructions cannot be loaded, stop with an error and do not continue.
```

Add no user context, role hints, output rules, watchdog prose, or metadata. The worker owns the task until accepted output or a concrete blocker. Workers use their loaded validating writer and never call `continue`. Do not duplicate their task in the orchestrator. Dispatch independent current requests before waiting when the harness supports parallel creation.

Use the longest supported event wait, not short polling. Accepted output, actionable failure, or concrete blocker ends it; heartbeat does not.

Treat bootstrap/instruction-load silence separately from active implementation progress. Concrete progress must name current work, inspected or changed surfaces, verification state, and the next bounded checkpoint. If the worker shows that evidence, continue that same worker and ask for the next bounded checkpoint. Do not persist progress in baton, scrape transcripts, read private runner state, or add durable worker status storage.

Allow 10 minutes for load/progress. None: interrupt once for focused status, then wait 2 minutes. Concrete progress: keep the worker. Vague/missed checkpoint: require immediate validating `write-output` or an exact non-blocking stop. Still nothing: close and retry the same request once with the same 10+2-minute bound. Retry failure: use the request's current `report-stop` command with the smallest concrete help request.

After every current request is accepted, run stdout's exact `continue` once with actual worker ids and safe debug value.

### User gate

The current agent owns approvals and user-answerable blockers. If a worker asks before validated output, ask the user and return the answer to that same worker; do not replace it or infer the answer.

Route `nonBlockingStop.needed` as a direct question. Resolve non-user capability blockers through the smallest safe action. Submit `{"stop_id":"<copy nonBlockingStop.stop_id>","resolution":{"summary":"...","decision":"...","evidence":[]}}` through stdout's current `resolveStopCommand`, then follow its continuation.

For approval, the inline compiled prompt is complete. Read only `Required reads`. Render `Approval attachments` without opening them; inspect one only after an explicit user content question. Keep writer command and lease token internal. Normalize the answer to the requested strict JSON, submit it, then follow the new stdout.

### Pointer recovery

Only on explicit rollback request:

```bash
bun "$ORBITA_SKILL_ROOT/lib/entrypoints/cli/workflow-runner.mjs" list-pointer-transitions --run-id <run-id> --lease-token "$lease_token"
bun "$ORBITA_SKILL_ROOT/lib/entrypoints/cli/workflow-runner.mjs" move-pointer --run-id <run-id> --transition-id <id> --lease-token "$lease_token"
```

The list includes every valid earlier cursor observed in this run, not unvisited workflow steps. Choose the backward transition whose target matches the request and move once. The move preserves baton state without extra acknowledgement. No matching target: report available moves and stop. Never edit baton/history.

On `done`, stop and report the terminal embedded JSON using its workflow-specific baton/projection; do not assume a generic `result` field.
