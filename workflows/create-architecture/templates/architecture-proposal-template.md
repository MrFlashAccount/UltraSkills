# <Project/Issue> Architecture Proposal

This is an approval artifact, not canonical architecture documentation.

## Proposal metadata

- Mode: scaffold | improve
- Improve subtype: align | not applicable
- Recommended direction:
- Implementation scope: proposal only | implement after approval
- Source evidence:

## Problem and representative asks

- Problem:
- Representative asks (3-5 unless truly tiny):
- Constraints and explicit unknowns:

## Options narrowed

For each serious option, state fit, pressure relieved, team/process consequence,
introduced complexity, deliberate non-goals, required artifacts, likely failure
mode, and why it won or lost.

## Recommended decision

- Target architecture:
- Accepted trade-offs:
- Rejected alternatives:

## Structural change contract

- What changes:
- What does not change:
- Entity delta:
- Affected modules and relationships:
- Ownership and source zones:
- Boundary and source-layout expectations:
- Import/export and dependency direction:
- Binding `must_not_import` rules:
- Inbound/outbound ports, adapters, and composition root when relevant:

## Target artifact map

List the proposed `ARCHITECTURE.md` entrypoint, Architecture Decision, C4 Context,
Container, and Component/Module views, strategic/tactical DDD artifacts when
required, ports/adapters view when required, local `CONTEXT.md` contracts, and
migration plan. State what each artifact is for.

## Conditional architecture-sensitive proof

Include only when triggered:

- `domain_source_proof_map`
- source/runtime/schema alignment evidence
- `compatibility_surface_plan`
- fake-module/deletion proof
- naming-honesty risks
- negative checks and reviewer gates

## Migration / PR slices

For every reviewable slice, state its structural delta, sequencing dependency,
rollback pressure when relevant, and architecture checks.

## Open questions

List only questions that materially affect the decision.

## Approval requested

Approval must cover all three:

1. selected architecture direction
2. intended artifact set
3. implementation scope
