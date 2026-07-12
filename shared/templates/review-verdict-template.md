# <Project/Issue> Review Verdict — <Gate>

Use this as the expected worker answer format for critic/reviewer gates. Keep it compact and evidence-based.

## Status

- Reviewer:
- Date:
- Gate: research critic | architecture review | plan review | implementation review
- Verdict: approved | needs_revision | passed | needs_changes

## Summary

<1-3 bullets with the decision and why.>

## Evidence checked

- <Source packet/artifact, diff, test output, doc, or command result inspected.>

## Findings

| Severity | Finding | Evidence | Required next action |
| --- | --- | --- | --- |
| must_fix | <gap/blocker> | <exact evidence> | <required change or decision> |
| should_fix | <actionable current-scope risk that still requires rework> | <exact evidence> | <required change before pass> |
| can_delay | <explicitly out-of-scope or future cleanup> | <exact evidence> | <follow-up note, not required for this pass> |

## Transition output

- outcome: approved | needs_revision | ready_for_review | passed | needs_changes
- artifacts/results to carry forward: <refs or summaries>

If the verdict cannot yet be produced without help, report `NON_BLOCKING_STOP` through the orchestrator/host control channel with the smallest concrete help request. Do not submit a terminal verdict; resume the same gate after resolution.

## Template rules

- Do not include code, diffs, command sequences, or implementation recipes.
- Tie every blocking finding to evidence.
- Do not return `passed` with actionable `must_fix` or `should_fix` findings. Return `needs_changes` and list the owning implementation step. Use `can_delay` only for non-actionable future cleanup outside the approved slice.
- Keep transition labels aligned with the current workflow edge map.
