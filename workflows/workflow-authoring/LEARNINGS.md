# Workflow Authoring Learnings

Durable lessons for authoring workflow-runner workflows. Apply these before designing, implementing, analyzing, or reviewing workflow changes.

## Routing And Schema Contracts

- Treat `output.schema` as part of the runtime route contract, not just documentation. Dynamic `next` expressions must reference paths that semantic validation can prove are required in the producer schema.
- If a dynamic route reads a nested path such as `output.verdict.selected_review_steps`, make every segment required on the success output shape, or expose a dedicated top-level route field. Conditional `allOf` requirements are only safe when the semantic validator proves that branch for the relevant outcome.
- Do not use `contains` plus `maxContains` as a uniqueness-only check unless `minContains: 0` is also set. In JSON Schema, `contains` requires at least one matching item by default.
- Keep fanout route fields exact. A selected step list means "run these branches", not "these branches were considered".

## Fanout And Review Loops

- Separate selected branches from skipped/considered branches. Optional, informational, or absence-confirmation reviewers belong in skipped evidence, not in the fanout target.
- Re-review fanout should route from the current review owner selection, not from the original plan, so passed branches are not rerun unless their owned surfaces changed.
- Review joins must aggregate the branches selected for the current review pass, not stale planning-time branches.
- Expanded fanout needs an explicit risk reason. Default to the smallest reviewer set that covers material independent risk classes.

## Worker Phase Boundaries

- Non-implementation phases may inspect files, diffs, artifacts, and prior evidence, but they should not run tests, lint, validation, typecheck, build checks, or `git diff --check`. Implementation workers own those commands and must report evidence.
- Review, analysis, dispatch, join, approval, and final-report steps should evaluate existing evidence instead of creating new verification evidence.
- Loop continuity is prompt/state based. Do not assume persistent worker session state across draft/attack/revision loops; include required prior outputs in prompt input context.

## Evidence Hygiene

- Public or PR-facing validation summaries should use repo-relative commands and avoid local absolute paths.
- Smoke or E2E workflow evidence should use an explicit isolated `WORKFLOW_RUNS_ROOT`, clean it up, and include a negative source-tree artifact leakage check.
