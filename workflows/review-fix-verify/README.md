# Review Fix Verify

## What it is

A focused workflow for an existing batch of review findings: normalize them, decide each disposition from current evidence, implement accepted items, and independently recheck the mapping.

## Use when

Review comments, audit findings, or a QA defect list already exists and the job is to address that bounded set without losing traceability.

## Do not use when

The root cause is unknown, no concrete findings exist, or the requested job includes fetching/replying/resolving comments in GitHub or another external system. Pair this workflow with the appropriate transport skill when external writes are authorized.

## Runtime contract

- Every finding keeps a stable id.
- Allowed dispositions are `accepted`, `rejected_with_evidence`, `needs_input`, `duplicate`, and `out_of_scope`.
- Accepted findings carry owner, edit surface, acceptance check, and order.
- The fixer does not widen scope or mutate external review state.
- The verifier is independent and checks every disposition against current code and evidence.
- One bounded fix/recheck pass is allowed.
