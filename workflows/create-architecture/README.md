# create-architecture workflow

Orbita workflow form of `skills/create-architecture`.

It preserves the skill's modes and stage boundaries: source audit, context
recovery, option narrowing, proposal, Architect review, Critic pressure,
approval, implementation, post-implementation Architect/Critic pressure, and
a final Architect gate.
Canonical architecture files are not written before approval.

Use this workflow for architecture decision packages and architecture-memory
work. Do not use it for a local implementation task with no architecture
decision or artifact impact.

Modes:

- `audit` reports evidence-backed findings and stops without edits.
- `scaffold` recovers context and produces an approval-ready proposal for a
  repository without a usable architecture package.
- `improve` evolves an existing architecture shape; `align` is its default
  subtype for code/docs/ownership reconciliation rather than redesign.

The proposal gate explicitly covers the selected direction, intended artifact
set, and implementation scope. Proposal-only work ends after approval without
creating canonical artifacts. Implementation runs only when the triggering
request asked for it and the gate approves it.

Validate the package from the repository root:

```sh
bun skills/orbita/lib/entrypoints/cli/validate-workflow.mjs workflows/create-architecture
```
