# Lightweight engineering workflows

Status: implemented. This document preserves the shared routing rationale and
design contracts; each package now contains a runnable graph, prompts, schemas,
templates, and a package README.

Implemented packages:

- `workflows/red-green-refactor/`
- `workflows/pair-programming/`
- `workflows/review-fix-verify/`
- `workflows/make-it-fast/`
- `workflows/deep-debugging/`

`Lightweight` means narrower and less ceremonial than `dev-harness`, not that
every route is cheap. `make-it-fast` and `deep-debugging` are intentionally
specialized evidence workflows
for tasks where direct execution would otherwise become guesswork.

## Why these workflows

The repository has strong paths for research, architecture, approved execution,
multi-role review, and repeated work. It does not have a small, proof-oriented
path between a direct edit and those heavier workflows.

That gap matters for bounded bug fixes, small behavior changes, concrete review
follow-up, measured optimization, and difficult diagnosis. A direct edit is
cheap but has no reusable execution contract. `implementation-harness` expects
approved task, research, and execution-plan input. `dev-harness` owns a larger
research-to-review lifecycle. `loop` repeats generic cycles without owning the
evidence contract for any of these task types.

The proposed workflows add only the missing middle:

1. a single-writer test-driven cycle for changes that can be proved with a
   focused test;
2. a parallel driver/navigator cycle for small changes where an independent
   second track is likely to catch a meaningful miss;
3. a findings-to-proof cycle for concrete review or CI feedback;
4. a measurement-first cycle for performance work;
5. a convergent hypothesis loop for difficult bugs whose cause cannot be
   established from local code inspection alone.

They must remain cheaper than the failure or rework they prevent. They are not
default ceremony for every code edit.

## Routing boundary

| Route | Use when | Do not use when |
| --- | --- | --- |
| Direct execution | The edit is mechanical, obvious, and cheaply verified: wording, formatting, a local config value, or an equally narrow change. | Behavior must be reproduced, a regression test is valuable, or an independent second perspective is justified. |
| `red-green-refactor` | One bounded behavior or invariant can be demonstrated by a focused automated test and changed by one implementation owner. | The test boundary is unavailable or disproportionately expensive, or the work contains an unresolved product or architecture decision. |
| `pair-programming` | The change is still bounded and locally observable, but edge cases or regression risk make independent parallel investigation or test design worth the extra worker. | The bug needs repeated external reproduction and runtime evidence, file ownership cannot be made safe, or integration is more expensive than the likely second-track value. |
| `review-fix-verify` | Review comments, CI findings, or other concrete findings already identify a bounded correction surface. | The root cause is still unknown, the finding requires product or architecture decisions, or the task is open-ended review. |
| `make-it-fast` | Performance is the primary acceptance target and a stable workload, baseline, and metric can be established. | The optimization is speculative, measurement is too noisy, or performance is only an optional concern inside a correctness change. |
| `deep-debugging` | The symptom is real but the root cause is uncertain, local reproduction is insufficient, or user/remote reproduction plus diagnostic logs are required. | The cause is already concrete enough for `red-green-refactor`, the input is an existing finding, or the task is a live incident requiring domain-specific operational control. |
| `implementation-harness` | The task already has approved, closed task/research/plan input and disjoint implementation ownership. | Discovery, architecture, or product decisions are still open. |
| `dev-harness` | The work needs staged research, architecture or UI direction, approval, broad implementation, or multi-role review. | The work is a small, closed change that one of the lighter routes can prove directly. |

A focused route has one primary behavior, finding set, metric, or symptom; clear
ownership; and no unresolved product or architecture decision. TDD and pair work
normally keep a bounded file zone. Performance and difficult-bug work may cross
several diagnostic surfaces while still preserving one measured target or
causal question. File count alone is not a routing rule.

## Workflow 1: `red-green-refactor`

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

## Workflow 2: `pair-programming`

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
as meaningful boundary cases, concurrency or state transitions, compatibility
behavior, or a risky regression surface that both agents can inspect in the
same local evidence cycle.

Route a deterministic one-file fix to direct execution or
`red-green-refactor`. Route repeated user/remote reproduction and unknown root
cause to `deep-debugging`. Escalate broad ownership, unresolved
design, unsafe integration, or cross-system changes to a heavier workflow.

## Workflow 3: `review-fix-verify`

### Purpose

Turn concrete review comments, CI findings, or other bounded findings into an
evidence-backed disposition without assuming that every finding is correct.

### Target topology

```text
findings_intake -> finding_triage -> fix_cycle -> independent_recheck -> done
                                      ^                 |
                                      |-----------------|
                                         one rework pass
```

### Findings contract

1. **Findings intake** records a stable id, source, exact claim, affected
   surface, available evidence, requested outcome, and authority boundary for
   every finding.
2. **Finding triage** assigns exactly one disposition:
   `accepted`, `rejected_with_evidence`, `needs_input`, `duplicate`, or
   `out_of_scope`. Reviewer prose is input evidence, not automatic truth.
3. **Fix cycle** changes only accepted findings, preserves unrelated work, and
   records focused verification for each finding id. Disjoint findings may fan
   out only with explicit non-overlapping ownership.
4. **Independent recheck** verifies the original claim against the current
   diff and evidence rather than trusting the implementer's summary.

The terminal packet maps every finding to disposition, changed files,
verification, remaining disagreement, and any external action still needed.

### Applicability limits

This workflow starts from already concrete findings. Unknown root cause routes
to `deep-debugging`; open-ended discovery routes to research or
review. Broad redesign, new product decisions, and architecture changes are
escalations rather than findings that can be silently accepted.

GitHub, Arcanum, CI, or other provider transport stays outside this workflow.
It may prepare replies and evidence, but must not comment, resolve, push, rerun,
or approve without authority from the outer request.

## Workflow 4: `make-it-fast`

### Purpose

Improve an explicit performance target through reproducible measurement rather
than intuition or incidental micro-optimization.

### Target topology

```text
metric_intake -> baseline -> profile_hypothesis -> implement -> compare -> review -> done
                                  ^                              |
                                  |------------------------------|
                                        one bounded rework pass
```

### Measurement contract

1. **Metric intake** fixes the workload, metric, acceptance threshold,
   correctness guard, environment, warm-up policy, and known sources of noise.
2. **Baseline** runs the same representative workload enough times to establish
   a usable comparison. An unstable baseline stops optimization rather than
   legitimizing a convenient number.
3. **Profile hypothesis** identifies a measured hot path or resource mechanism
   and predicts which metric should change. It must not start from code that
   merely looks slow.
4. **Implementation** changes one measured mechanism at a time through the
   appropriate backend or frontend owner.
5. **Comparison** repeats the baseline method and reports the before/after
   delta, variance, correctness result, and any shifted cost.
6. **Review** checks measurement fidelity, correctness, resource trade-offs,
   and whether the claimed improvement exceeds noise.

Use this workflow only when performance is the task's primary outcome. Keep
`FAST` inside `red-green-refactor` when performance is only a conditional final
checkpoint. Do not claim success from a one-off timing, a changed workload, or
an improvement that breaks correctness or moves cost outside the measured
window.

## Workflow 5: `deep-debugging`

### Purpose

Converge from a confirmed symptom to a minimal causal mechanism and a proven
fix when code inspection alone cannot establish the root cause. The workflow's
unit of progress is reduced uncertainty, not edits, logs, or hypothesis count.

The root cause may be one defect or a minimal causal chain. It must still be
specific enough to predict the symptom and explain why the fix breaks that
chain.

### Target topology

```text
bug_intake -> static_diagnosis
                    | exact cause
                    v
                fix_and_verify -> final_review -> done

static_diagnosis -> diagnostic_cycle
                        |
                        +-> hypothesis -> instrumentation -> local_or_user_repro
                                                               |
                                                               v
                                                        evidence_judgment
                                                          |     |      |
                                                     confirm  continue  stall
                                                          |     |      |
                                                          v     +------+
                                                   fix_and_verify      |
                                                                       v
                                                               hostile_reset
                                                                /          \
                                                         critic_attack  external_search
                                                                \          /
                                                                    reframe
                                                                       |
                                                               diagnostic_cycle
```

### Intake and fast path

**Bug intake** records expected and observed behavior, environment/build/version,
reproduction state, available logs, affected users or surfaces, privacy limits,
and the exact signal that would prove the symptom occurred.

**Static diagnosis** inspects the executing code path and existing evidence
before adding instrumentation. It may take the fast path only when it can:

- explain the complete `input -> mechanism -> symptom` chain;
- identify the exact faulty boundary without an implementation-critical guess;
- define a reproduction or regression proof that fails before the fix;
- predict why the proposed change will break the causal chain.

If any link is speculative, the workflow enters research-style diagnosis. It
must not turn a plausible reading of the code into an unearned root-cause claim.

### Falsifiable hypothesis contract

Every diagnostic experiment starts with one hypothesis record:

```text
hypothesis_id
claim
component_or_boundary
mechanism
observable
edit_surface
evidence_for
evidence_against
if_true_signal
if_false_signal
minimal_experiment
instrumentation_risk
```

The experiment must distinguish at least two remaining explanations. Adding
logs without stating the positive and negative prediction first is invalid.
Instrumentation is minimal, reversible, linked to the hypothesis id, and
designed not to expose credentials, user payloads, private paths, or other
sensitive data.

The controller treats `(component_or_boundary, mechanism, observable,
edit_surface)` as the attempt fingerprint. Rewording a claim without changing
that fingerprint is the same attempt and cannot consume another round unless
new evidence changes its prediction.

When local reproduction is unavailable, the active worker reports a
runner-owned non-blocking stop and resumes the same request after the user
reproduces the bug. The request must state the exact build or instrumentation,
actions, time window, expected marker, and bounded sanitized evidence needed;
`try it again` is not an acceptable reproduction request.

### Independent evidence judgment

A logically independent evidence judge evaluates each result without proposing
the next fix. It returns exactly one outcome:

- `confirmed`: the predicted causal signal was observed and material
  alternatives were excluded;
- `rejected`: the negative prediction or contradictory evidence rules the
  hypothesis out;
- `inconclusive`: the experiment did not distinguish the remaining causes;
- `stalled`: the process is repeating work or no longer reducing uncertainty.

After every experiment the workflow records a progress certificate:

```text
new_evidence
confirmed_or_eliminated_hypotheses
remaining_uncertainty
next_discriminating_experiment
information_gain: yes | no
```

New logs, edits, confidence prose, or additional hypotheses are not progress by
themselves. A round may continue only when it confirms or eliminates a
hypothesis, narrows the causal frontier, exposes a new discriminating
observable, or identifies the precise missing evidence.

The diagnostic worker cannot award its own `information_gain`. The independent
evidence judgment and controller own that decision and the next transition.

Keep at most three active hypotheses. A new hypothesis must replace an
eliminated one, split an existing one using new evidence, or enter because a
new observation exposed a genuinely different mechanism. Paraphrases of a
rejected hypothesis are rejected by the controller.

### Convergence and hostile reset

The normal diagnostic path has these default limits:

- one round without information gain forces a redesigned experiment;
- two consecutive rounds without information gain trigger hostile reset;
- three diagnostic rounds without a confirmed cause trigger hostile reset
  regardless of the active agent's confidence;
- the same hypothesis, observable, or edited surface cannot be repeated without
  new discriminating evidence;
- hostile reset runs at most once;
- after reset, at most two new experiments may run before the workflow exits
  `unresolved_with_evidence`.

An experiment counter advances only after evidence judgment. Waiting for user
reproduction or resolving a missing-capability stop does not consume a round.
The future runtime graph must preserve explicit pre-reset and post-reset budgets;
resume, retry, or hostile reset must not silently clear loop progress.

Hostile reset freezes further edits and fans out two fresh, independent logical
agents:

1. **Critic attack** assumes the current mental model is wrong, identifies
   contradictions, circular reasoning, ignored alternatives, instrumentation
   effects, and why the previous experiments failed to converge.
2. **External evidence search** uses the exact symptom, version, platform,
   dependency, and environment to search authoritative documentation, upstream
   issues, release notes, and comparable mechanisms. If search capability is
   unavailable, it performs a cold codebase/history investigation and records
   the missing external-evidence capability.

Search results generate local falsifiable hypotheses; they do not prove the
local root cause. Superficially similar error text is not enough.

A fresh synthesis owner receives the compact debugging ledger rather than the
full reasoning transcript. It must record discarded assumptions, explain the
lack of convergence, replace or narrow the hypothesis frontier, and select
exactly one highest-information experiment. If it cannot do so, the workflow
exits instead of returning control to blind iteration.

### Debugging ledger

The durable baton contains:

- symptom, environment, build/version, and reproduction status;
- active and retired hypothesis records with stable ids;
- experiments, predictions, evidence, and evidence-judge outcomes;
- remaining causal frontier and progress certificates;
- instrumentation paths, markers, risk, and cleanup state;
- external evidence with applicability limits;
- discarded assumptions, hostile-reset count, and next experiment;
- user reproduction requests and returned evidence.

Fresh reviewers consume this ledger, not a persuasive narrative written by the
same agent that formed the hypothesis.

### Fix and terminal truth

`fixed` requires all of the following:

1. the original scenario or an evidence-equivalent reproduction confirmed the
   bug before the fix;
2. predicted evidence confirmed the root cause or minimal causal chain;
3. the change removed that mechanism;
4. the same reproduction no longer produces the bug;
5. a regression guard fails before the fix and passes after it when an
   executable guard is feasible;
6. temporary instrumentation is removed and its absence verified;
7. an independent final review checks that the change did not merely mask the
   symptom, alter timing into a Heisenbug, or cargo-cult an external solution.

If the symptom disappears but the mechanism remains unproven, return
`mitigated_not_explained`. If the final user reproduction is still required,
return `locally_verified_pending_user_repro`. Other honest terminal states are
`not_reproduced` and `unresolved_with_evidence`; none may be projected as
`fixed`. Missing input, permission, or capability uses the runner's
non-blocking-stop contract and resumes the same request rather than becoming a
terminal bugfix result.

## Shared safeguards

- Preserve pre-existing user changes and record the baseline before editing.
- Keep one final integration owner even when workers run in parallel.
- Give independent authors, evidence judges, critics, and external investigators
  distinct logical agent ids so runtime worker reuse does not collapse the
  intended independence.
- Treat focused verification as proof of the claimed behavior, not proof that
  unrelated repository state is healthy.
- Fix and re-run failures caused by the change. Preserve and report unrelated
  baseline failures.
- Use a runner-owned non-blocking stop for missing capability, permission, or
  user input; do not misreport it as successful completion.
- Remove or roll back temporary instrumentation on every terminal exit and
  verify the cleanup. Retain it only when the outer request explicitly asks for
  a diagnostic handoff, and record the remaining paths and risk.
- Do not let any workflow seek approval, publish, push, merge, or perform
  destructive actions unless the outer request already grants that authority.
- Cap review-driven rework at one pass. A second unresolved review result exits
  with evidence and a recommendation to escalate.

## Non-goals

- building a general catalogue of XP ceremonies or debugging rituals;
- making pair work mandatory for ordinary implementation;
- replacing `dev-harness`, `implementation-harness`, or independent code review;
- treating `make it fast` as mandatory optimization without a benchmark;
- treating more hypotheses, logging, or internet search as diagnostic progress;
- turning every checkpoint into a separate worker or approval gate;
- claiming success from generated artifacts without executing the relevant
  behavioral path.

## Evaluation plan

Each package includes its runtime graph, worker schemas, prompts, package
README, catalog entry, semantic workflow validation, and an executable smoke
path. Keep the routes experimental until they have been exercised on several
representative tasks and compared with direct execution.

Record:

- success and regression or rework rate;
- worker turns, elapsed time, and token cost;
- whether `RED` failed for the intended reason;
- whether the Navigator found a material issue or merely duplicated the Driver;
- ownership conflicts and integration cost.
- findings closed, rejected, or reopened after `review-fix-verify`;
- benchmark stability and measured improvement relative to noise;
- hypothesis rounds, information-gain failures, hostile resets, user
  reproduction count, and final bugfix truth state.

Promote `red-green-refactor` when its proof contract prevents meaningful
regressions without turning small work into a heavy process. Promote
`pair-programming` when its independent track catches material misses often
enough to repay fanout and integration cost. Otherwise keep direct execution as
the cheaper baseline. Promote `review-fix-verify` when it closes concrete
feedback with less reviewer churn. Promote `make-it-fast` only when measured
improvements survive identical reruns. Promote `deep-debugging` when its
convergence controller resolves difficult
bugs with fewer repeated experiments and never projects mitigation or stalled
investigation as a fix.

## Recommended defaults for implementation

- one driver owns the complete TDD cycle;
- one bounded review/rework pass;
- shared-zone/read-only Navigator unless isolation or disjoint paths are
  explicit;
- no human approval gate inside the ordinary path of any workflow;
- `REFACTOR` and `FAST` are conditional checkpoints, not mandatory work;
- no performance claim without a stable before/after method;
- no difficult-bug continuation without an information-gain certificate;
- one hostile reset per debugging run, followed by an honest bounded exit;
- escalation narrows or changes the route; it does not silently grow the
  lightweight workflow into a second `dev-harness`.
