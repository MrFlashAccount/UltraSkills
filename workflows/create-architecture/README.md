# create-architecture workflow

Architecture decision workflow replacing the former skill package.

It preserves the skill's modes and stage boundaries: source audit, context
recovery, option narrowing, proposal, Architect review, Critic pressure,
approval, implementation, post-implementation Architect/Critic pressure, and
a final Architect gate.
Canonical architecture files are not written before approval.

Proposal generation is direct by default. An explicit dialectic request inserts one isolated Visionary/Pragmatist position fanout and one independent synthesis fanout before the existing `architecture_proposal` owner. Omission or ambiguity remains direct. The same logical A/B ids are repeated across phases, but correctness depends only on typed artifacts and therefore supports fresh-worker fallback. Convergence or one adjudication selects a traceable lineage; `create_architecture_owner` remains the only approval-proposal producer, followed by the unchanged Architect review, Critic pressure, and approval gates.

Use this workflow for architecture decision packages and architecture-memory
work. Do not use it for a local implementation task with no architecture
decision or artifact impact.

Modes:

- direct `audit` reports evidence-backed findings and stops without edits;
  dialectic `audit` runs competing diagnostic architecture models, produces one
  proposal-only candidate, passes existing review and approval, and still ends
  without architecture implementation.
- `scaffold` recovers context and produces an approval-ready proposal for a
  repository without a usable architecture package.
- `improve` evolves an existing architecture shape; `align` is its default
  subtype for code/docs/ownership reconciliation rather than redesign.

The proposal gate explicitly covers the selected direction, intended artifact
set, and implementation scope. Proposal-only work ends after approval without
creating canonical artifacts. Implementation runs only when the triggering
request asked for it and the gate approves it.

Reject-both or irreparable invalidity routes to `proposal_dialectic_exit`, preserves evidence, and terminates before proposal review, approval, or implementation. A non-blocking stop is used only for concrete help that can resume the same adjudication.

Validate the package from the repository root:

```sh
bun skills/orbita/lib/entrypoints/cli/validate-workflow.mjs workflows/create-architecture
```
