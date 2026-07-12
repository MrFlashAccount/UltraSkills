---
name: loop
description: "Generic agent-agnostic loop router for repeated task cycles with explicit state, worker handoff, progress reporting, and safe stop conditions."
origin: ECC-adapted
---

# Loop Skill

Run a bounded, stateful agent loop for tasks that benefit from repeated independent cycles, for example: `Loop: find bugs in project X`.

This skill is agent-agnostic. It does not require Claude, CI, PRs, or any specific implementation runner. Use the executor/subagent mechanism available in the current environment.

## Source note

Adapted from the MIT-licensed ECC autonomous loop material. The upstream catalog informed the stability mechanisms here: bounded iterations, persistent state/baton, separate worker contexts, retry context, verification gates, saturation stops, and approval boundaries. The upstream Claude-specific command catalog is intentionally not the operational path for this skill.

## Triggers

Use when the request asks for a repeated autonomous cycle, or starts with forms like:

- `Loop: <task>`
- `Run a loop to <task>`
- `Keep iterating on <task> until <condition>`
- `Find more bugs in <project>`
- `Repeat cleanup/review passes until no progress`

Do not use when a one-shot answer is enough, when safe continuation criteria are missing and cannot be inferred, or when the next action requires approval that has not been granted.

## Inputs

Collect or infer:

- `task`: the work objective for each cycle.
- `maxIterations`: default `3` unless the user gives another bound.
- `successCriteria`: what counts as done or good enough.
- `stopConditions`: max iterations, executable saturation/no progress, user stop, risk threshold, or success signal.
- `helpConditions`: missing orchestrator/user input, capability, permission, or approval boundary; these trigger `NON_BLOCKING_STOP`, not loop completion.
- `verificationRequirements`: optional checks/review/tests that must run before considering a cycle successful.
- `executorConstraints`: allowed tools, write permissions, external actions, target paths/repos, and reporting format.

If the task is risky, destructive, external-writing, financial, privacy-sensitive, or under-specified in a way that changes safety, report `NON_BLOCKING_STOP` with the smallest approval or clarification request before starting the iteration.

## State Baton

Keep a compact baton after every iteration and pass it to the next executor.

```yaml
task: "..."
maxIterations: 3
iteration: 1
successCriteria:
  - "..."
stopConditions:
  - "..."
helpConditions:
  - "..."
verificationRequirements:
  - "..."
lastResult: "none yet"
nextAction: "start first cycle"
noProgressCount: 0
openRisks: []
artifacts:
  files: []
  prs: []
  issues: []
  notes: []
retryContext: null
approvalBoundaries:
  - "..."
```

Minimum per-iteration state:

- iteration number
- last result
- next action
- no-progress count
- open risks or unmet help conditions, if any
- artifacts/PRs/issues/files, if any
- verification result, if any
- retry context for failures

## Loop Lifecycle

1. Initialize the state baton from the inputs.
2. Start exactly one executor/subagent for the current iteration.
3. Executor performs one focused cycle, reports result, then stops.
4. Main/orchestrator reports progress to the user.
5. Main/orchestrator updates the state baton.
6. Main/orchestrator decides: continue, retry with context, finish, or report `NON_BLOCKING_STOP` and request help while preserving the current iteration.
7. If continuing, start the next executor with the updated baton.
8. Do not give a final answer until either the next iteration has been started or the loop has explicitly finished. A `NON_BLOCKING_STOP` is not a final answer; resume the same iteration after resolution.

## Executor Protocol

Each executor gets one iteration only.

Executor instructions must include:

- the task and current baton
- the exact iteration number
- what to inspect/change/run in this cycle
- verification/review requirements for this cycle
- approval and safety boundaries
- required report fields: result, evidence, artifacts, verification, open risks, next recommended action

Executor must:

- run only its assigned cycle
- preserve exact paths, commands, IDs, errors, and artifacts in the report
- stop after reporting
- not launch its own loop or next iteration unless explicitly assigned
- not bypass approval, external-action, destructive-action, or privacy boundaries

## Orchestrator Contract

The main/orchestrator owns continuity.

After each executor result:

- summarize progress to the user before continuing when the environment supports visible progress updates
- update the baton
- increment `iteration`
- update `noProgressCount`
- capture failures as `retryContext`
- decide whether continuation criteria still allow another cycle
- start the next executor if continuing
- explicitly finish if done, saturated, unsafe, or out of iterations; if progress needs orchestrator/user help or approval, report `NON_BLOCKING_STOP` and resume the same iteration after resolution

Final report must include:

- why the loop stopped
- iterations completed
- results found or changes made
- verification performed
- open risks and any resolved help conditions
- artifacts/PRs/issues/files touched, if any
- recommended next step

## Continuation and Stop Rules

Continue only when all are true:

- `iteration < maxIterations`
- no stop condition has fired
- there is a concrete next action
- the last cycle made progress, or the retry context changes the next attempt materially
- no new approval boundary is required before the next action

Finish the loop when any are true:

- success criteria are met
- max iterations reached
- `noProgressCount >= 2` by default
- verification proves the approach is failing
- user asks to stop

If the same unmet dependency repeats without new information, or continuation requires approval for an external, destructive, risky, or privacy-sensitive action, report `NON_BLOCKING_STOP` instead of finishing. Request the smallest concrete orchestrator/user help, preserve the current iteration, and resume it after resolution.

## Stability Mechanisms

- **Bounded loop:** default `maxIterations: 3`; never infinite by default.
- **State baton:** durable, compact handoff between independent contexts.
- **One-cycle executors:** workers cannot silently self-loop.
- **Progress reporting:** user sees cycle results before the next cycle decision.
- **Saturation stop:** repeated no-progress cycles stop instead of burning time.
- **Retry context:** failures carry exact logs/errors/diffs into the next attempt.
- **Verification gates:** checks/reviews are explicit, not assumed.
- **Approval boundaries:** external writes, destructive operations, secrets, finance, security-sensitive changes, and remote pushes still need the surrounding environment's approval rules.
- **Resume behavior:** if interrupted, reload the last baton/artifacts, verify repo/task state, then continue only from the next safe iteration.
- **Separate contexts:** author/reviewer or search/fix phases can be separate executors when bias or complexity matters.

## Generic Examples

### Bughunt loop

Input: `Loop: find bugs in project X, max 3 iterations, verify with targeted tests when possible.`

Cycle shape:

1. Executor audits one area and reports a concrete bug or no finding.
2. Orchestrator records evidence and chooses the next area.
3. Stop on two no-finding cycles, max iterations, or unapproved write boundary.

### Docs cleanup loop

Input: `Loop: improve onboarding docs until the quickstart is coherent.`

Cycle shape:

1. Executor reviews one doc path or user journey and edits only approved files.
2. Executor reports changed files and remaining gaps.
3. Orchestrator runs/requests verification if configured, then continues or stops.

### PR comment loop

Input: `Loop: address unresolved review comments, max 5, stop before pushing.`

Cycle shape:

1. Executor handles one coherent group of comments.
2. Executor reports comment IDs, files changed, and checks run.
3. Orchestrator continues while comments remain and local changes are safe; stops before any unapproved push/merge.

## Reference Protocol

For a copyable baton schema and worker/orchestrator report templates, see `references/protocol.md`.
