# Red Green Refactor

## What it is

A small-change workflow that makes the TDD evidence chain explicit: the test fails for the intended reason, the smallest change makes it pass, optional cleanup preserves behavior, and an independent reviewer checks the evidence.

## Use when

The behavior is understood, a cheap deterministic test can express it, and the edit is narrow enough for one driver plus at most one review rework pass.

## Do not use when

The root cause or contract is unknown, reproduction depends on a user environment, the change spans broad ownership, or performance is the primary objective. Use `deep-debugging`, `pair-programming`, or `make-it-fast` instead.

## Runtime contract

- RED must fail for the intended behavioral reason.
- GREEN reruns the same focused test and relevant regressions.
- REFACTOR is conditional, not mandatory churn.
- FAST is optional and requires a comparable baseline.
- The reviewer is a different logical agent and does not create missing evidence.
- One bounded rework pass is allowed; exhaustion is reported honestly.
