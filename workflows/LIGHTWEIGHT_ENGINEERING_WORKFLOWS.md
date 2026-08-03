# Lightweight engineering workflows proposal

Status: proposal only. This document defines two target workflow packages; it
does not add runnable workflow graphs, prompts, or schemas.

Proposed packages:

- `workflows/test-driven-change/`
- `workflows/parallel-pair-change/`

## Why these workflows

The repository has strong paths for research, architecture, approved execution,
multi-role review, and repeated work. It does not have a small, proof-oriented
path between a direct edit and those heavier workflows.

That gap matters for bounded bug fixes and small behavior changes. A direct edit
is cheap but has no reusable execution contract. `implementation-harness`
expects approved task, research, and execution-plan input. `dev-harness` owns a
larger research-to-review lifecycle. `loop` is for repeated cycles rather than a
single change.

The proposed workflows add only the missing middle:

1. a single-writer test-driven cycle for changes that can be proved with a
   focused test;
2. a parallel driver/navigator cycle for small changes where an independent
   second track is likely to catch a meaningful miss.

They must remain cheaper than the failure or rework they prevent. They are not
default ceremony for every code edit.

## Routing boundary

| Route | Use when | Do not use when |
| --- | --- | --- |
| Direct execution | The edit is mechanical, obvious, and cheaply verified: wording, formatting, a local config value, or an equally narrow change. | Behavior must be reproduced, a regression test is valuable, or an independent second perspective is justified. |
| `test-driven-change` | One bounded behavior or invariant can be demonstrated by a focused automated test and changed by one implementation owner. | The test boundary is unavailable or disproportionately expensive, or the work contains an unresolved product or architecture decision. |
| `parallel-pair-change` | The change is still bounded, but ambiguity, edge cases, or regression risk make independent parallel investigation or test design worth the extra worker. | The change is trivial, file ownership cannot be made safe, or integration is more expensive than the likely second-track value. |
| `implementation-harness` | The task already has approved, closed task/research/plan input and disjoint implementation ownership. | Discovery, architecture, or product decisions are still open. |
| `dev-harness` | The work needs staged research, architecture or UI direction, approval, broad implementation, or multi-role review. | The work is a small, closed change that one of the lighter routes can prove directly. |

A lightweight change has one primary behavior or invariant, a bounded file
zone, a clear implementation owner, and no unresolved user-owned decision. File
count alone is not a routing rule.

## Workflow 1: `test-driven-change`

### Purpose

Produce the smallest correct change with evidence that the focused behavior
failed before the implementation and passed after it.

### Target topology

```text
intake -> tdd_cycle -> focused_review -> done
                    ^        |
                    |--------|
                     one bounded rework pass
```

`RED`, `GREEN`, `REFACTOR`, and `FAST` are checkpoints inside one driver worker
turn, not separate workers. Splitting them into independent requests would add
handoff cost without improving ownership or independence.

### Cycle contract

1. **Intake** confirms the observed or requested behavior, focused verification
   command, writable file zone, baseline state, and escalation conditions.
2. **RED** adds or identifies a focused test and runs it. The test must fail for
   the intended behavioral reason. An already-green test, an unrelated harness
   failure, or an unreproducible bug is not valid red evidence.
3. **GREEN** makes the minimum production change needed to pass the focused
   test. Scope expansion is rejected or escalated.
4. **REFACTOR** improves the changed design only when the green implementation
   exposes concrete duplication, naming, coupling, or structure debt. Otherwise
   it records `not_needed`. Focused tests must remain green.
5. **FAST** is optional. It runs only when the task has an explicit performance
   concern and a meaningful baseline measurement. Otherwise it records
   `not_applicable`. Performance work must preserve correctness.
6. **Focused review** checks the behavioral claim, test quality, scope, and
   verification evidence. It may request one bounded return to the cycle.

### Terminal evidence

The final packet should contain:

- reproduced behavior and valid red evidence;
- green evidence and final verification commands;
- refactor and performance decisions, including explicit `not_needed` or
  `not_applicable` states;
- changed files and ownership;
- remaining risks, baseline failures, and any escalation.

### Applicability limits

Escalate instead of widening the workflow when the change discovers:

- an unresolved public API, product, compatibility, or architecture decision;
- authentication, privacy, destructive migration, or similarly high-risk work;
- multiple overlapping implementation owners;
- a required UI direction or other human approval boundary;
- a bug that cannot be reproduced or safely characterized with available
  evidence.

Do not force a test-first cycle onto documentation, generated output, or simple
configuration edits where the test would be artificial and cost more than the
change.

## Workflow 2: `parallel-pair-change`

### Purpose

Use two agents concurrently on one bounded change: a Driver advances the patch,
while a Navigator independently attacks assumptions, reproduction, tests, and
edge cases. A single integration owner turns their outputs into the final patch.

This is parallel pair work with a join, not a claim of human-style live pairing.

### Target topology

```text
                         /-> driver ----\
pair_intake -> pair_fanout               -> pair_integration -> focused_review -> done
                         \-> navigator -/                            |
                                      one bounded rework pass <------/
```

The fanout is genuinely parallel. Safety comes from an explicit ownership mode,
not from serializing the agents.

### Ownership modes

Choose exactly one mode during intake:

| Mode | Driver | Navigator | Use when |
| --- | --- | --- | --- |
| Isolated workspaces | May implement a candidate in its own workspace. | May implement an independent candidate or test strategy in its own workspace. | The runtime provides isolated copies and the integration owner can compare or selectively apply results. |
| Disjoint zones | Owns the declared production-code paths. | Owns separate declared test, fixture, or diagnostic paths. | The paths do not overlap and both tracks can make useful progress concurrently. |
| Shared zone | Is the only writer. | Is read-only: reproduces, inspects, designs tests, and returns counterexamples or review findings. | Both agents need the same files or isolation is unavailable. |

Concurrent agents must never own writes to the same path. If isolation or
disjoint ownership cannot be proved, the workflow defaults to shared-zone mode.

### Pair contract

1. **Pair intake** defines the behavioral target, evidence needed, ownership
   mode, exact writable zones, shared baseline, and integration owner.
2. **Driver** performs the main implementation and focused verification within
   its assigned zone.
3. **Navigator** independently reproduces the issue, tests the Driver's likely
   assumptions, identifies invariants and edge cases, and proposes the smallest
   falsifying tests. It writes only when its ownership mode permits it.
4. **Pair integration** inspects the current files and diff after fanout rather
   than trusting stale summaries. It selects or combines useful work, resolves
   mismatches, runs focused verification, and becomes the single owner of the
   final patch.
5. **Focused review** checks correctness, ownership compliance, material value
   from the second track, and verification. It may request one bounded rework
   pass.

The Navigator should be prompted to disprove the emerging solution, not merely
echo the Driver. Useful outputs include a failing reproduction, a counterexample,
a missing invariant, an alternative minimal fix, or evidence that the obvious
solution is already sufficient.

### Applicability limits

Use this workflow only when the second track has a concrete expected job, such
as uncertain root cause, meaningful boundary cases, concurrency or state
transitions, compatibility behavior, or a risky regression surface.

Route a deterministic one-file fix to direct execution or
`test-driven-change`. Escalate broad ownership, unresolved design, unsafe
integration, or cross-system changes to a heavier workflow.

## Shared safeguards

- Preserve pre-existing user changes and record the baseline before editing.
- Keep one final integration owner even when workers run in parallel.
- Treat focused verification as proof of the claimed behavior, not proof that
  unrelated repository state is healthy.
- Fix and re-run failures caused by the change. Preserve and report unrelated
  baseline failures.
- Use a runner-owned non-blocking stop for missing capability, permission, or
  user input; do not misreport it as successful completion.
- Do not let either workflow seek approval, publish, push, merge, or perform
  destructive actions unless the outer request already grants that authority.
- Cap review-driven rework at one pass. A second unresolved review result exits
  with evidence and a recommendation to escalate.

## Non-goals

- building a general catalogue of XP ceremonies;
- making pair work mandatory for ordinary implementation;
- replacing `dev-harness`, `implementation-harness`, or independent code review;
- treating `make it fast` as mandatory optimization without a benchmark;
- turning every checkpoint into a separate worker or approval gate;
- claiming success from generated artifacts without executing the relevant
  behavioral path.

## Promotion plan

If this proposal is accepted, implement the two packages in a later PR. Each
package must include its runtime graph, worker schemas, prompts/references,
package README, focused tests, catalog entry, semantic workflow validation, and
an executable smoke path.

Keep them experimental until each has been exercised on several representative
tasks and compared with direct execution. Record:

- success and regression or rework rate;
- worker turns, elapsed time, and token cost;
- whether `RED` failed for the intended reason;
- whether the Navigator found a material issue or merely duplicated the Driver;
- ownership conflicts and integration cost.

Promote `test-driven-change` when its proof contract prevents meaningful
regressions without turning small work into a heavy process. Promote
`parallel-pair-change` when its independent track catches material misses often
enough to repay fanout and integration cost. Otherwise keep direct execution as
the cheaper baseline.

## Recommended defaults for implementation

- one driver owns the complete TDD cycle;
- one bounded review/rework pass;
- shared-zone/read-only Navigator unless isolation or disjoint paths are
  explicit;
- no human approval gate inside either workflow;
- `REFACTOR` and `FAST` are conditional checkpoints, not mandatory work;
- escalation narrows or changes the route; it does not silently grow the
  lightweight workflow into a second `dev-harness`.
