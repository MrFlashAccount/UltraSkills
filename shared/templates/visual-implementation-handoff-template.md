# Implementation handoff

Write a short Markdown handoff in the user's language. The workflow's output
schema owns routing and machine fields; do not turn them into a second report.
No Markdown/HTML tables, ownership matrices or copied Canvas sections.

## What changed

State the observable result. Show an annotated affected-file tree when it helps
locate changes, including frontend components, state owners and reused primitives
when applicable. Link the approved Canvas instead of repeating the architecture.

## What proves it

Group short items by behavior. For each binding requirement, name the exact
source condition, implementation evidence and actual verification result.
Preserve names, limits and approved semantic mappings. Never replace a contract
with similar wording. Distinguish tests, source inspection and rendered/runtime
evidence; an unexecuted check stays unexecuted.

Missing or partial mandatory coverage, unapproved deviations and contradictions
require a non-blocking stop before a completed handoff. Fix failed checks caused
by in-scope changes and rerun them. Green tests alone do not prove source fidelity.

## What needs review

Name review focus, touched surfaces, compatibility/rollback concerns, negative
checks and evidence gaps. Keep approved owner zones and reviewer coverage exact.
Record architecture or frontend-composition deviations with their approval;
do not imply independent review has passed when it has not run.
