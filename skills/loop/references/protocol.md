# Generic Loop Protocol

This reference is the copyable protocol for `skills/loop`. It is intentionally agent-agnostic: replace "executor" with the current runtime's worker, subagent, script, or human-assisted pass.

## Iteration Baton

```yaml
loopId: "short human-readable id"
task: "original user task"
maxIterations: 3
iteration: 1
successCriteria:
  - "observable done condition"
stopConditions:
  - "max iterations"
  - "success criteria met"
  - "noProgressCount >= 2"
helpConditions:
  - "missing orchestrator or user input"
  - "unapproved approval boundary"
verificationRequirements:
  - "tests/checks/review to run when relevant"
lastResult:
  summary: "none yet"
  evidence: []
  artifacts: []
  verification: []
nextAction: "specific next cycle objective"
noProgressCount: 0
blocker: null
retryContext: null
approvalBoundaries:
  - "no remote push without approval"
  - "no destructive command without approval"
```

## Executor Prompt Template

```markdown
You are the executor for loop iteration {iteration}/{maxIterations}.

Task: {task}
Current baton:
{baton}

Do exactly one cycle:
1. Work only on `nextAction` unless a small prerequisite lookup is required.
2. Respect approval/safety boundaries.
3. Run configured verification when applicable and safe.
4. Report compactly, then stop. Do not start the next iteration.

Return:
- status: completed | partial | no-progress
- result:
- evidence: exact paths/commands/IDs/errors/findings

When continuation needs orchestrator or user help, emit `NON_BLOCKING_STOP` through the control channel instead of returning a terminal status. Resume the same iteration after resolution.
- artifacts: files/PRs/issues/notes created or changed
- verification: checks run and outcomes, or why not run
- blocker:
- next: recommended next action
```

## Orchestrator Update Template

```markdown
Iteration {n} result: {one-line summary}
Evidence: {key evidence}
Verification: {check status}
Decision: continue | retry-with-context | stop | non-blocking-stop
Reason: {continuation/stop rule}
Next action: {specific next cycle objective, if continuing}
```

## Progress Accounting

Update `noProgressCount` as follows:

- Reset to `0` when the executor finds a new useful result, lands an approved change, removes a blocker, or produces new evidence that changes the next action.
- Increment by `1` when an otherwise executable attempt repeats known information or produces no actionable evidence.
- Do not increment for a missing decision, permission, capability, or external input. Report `NON_BLOCKING_STOP`, preserve the current iteration, and request the smallest concrete orchestrator/user help instead.
- Finish at `noProgressCount >= 2` only for executable saturation unless the user explicitly requested a larger saturation window.

## Resume Checklist

Before resuming an interrupted loop:

1. Read the last baton and final executor report.
2. Inspect current artifacts/state; do not trust stale baton entries blindly.
3. Re-run only cheap, relevant verification if state may have changed.
4. Continue from the next safe iteration. If an approval/help boundary is active, report `NON_BLOCKING_STOP` and resume this same iteration after resolution.
