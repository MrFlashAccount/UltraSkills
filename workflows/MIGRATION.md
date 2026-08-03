# Workflow skill migration

This records the direct skill-to-workflow migration. Each replaced source skill
was removed after its process and runtime sub-files moved into one self-contained
`workflows/<skill-name>/` package. `workflows/spdd/workflow.toml` is the
structural reference for worker steps, approvals where the source requires
them, bounded loops, non-blocking stops, typed outputs, and terminal projection.

## Completion contract

A migration is complete only when the workflow:

- preserves the skill's trigger boundary, owned stages, approval boundaries,
  role routing, stop conditions, and final handoff;
- expresses the source process directly as runner-owned steps and navigation;
- has explicit worker/approval steps, schemas for every worker output, bounded
  loops where the skill permits revision, and an intentional terminal output;
- has a catalog-quality name and description plus a package README;
- passes `bun run workflow:validate` and focused workflow tests or smoke checks;
- carries every runtime-required reference, script, template, schema, and asset
  formerly owned by the replaced skill.

## Queue

| Order | Skill | Status | Notes |
| --- | --- | --- | --- |
| 1 | `research-critic` | migrated | Researcher draft, hostile attack, one bounded revision, and terminal wrapper handoff without implicit persistence. |
| 2 | `implementation-harness` | migrated | Approved-input intake, disjoint backend/frontend execution, verification, and `ready_for_review` handoff. |
| 3 | `code-review-orchestrator` | migrated | Read-only risk-based reviewer fanout, evidence-first merge, and optional fresh re-review capped at three passes. |
| 4 | `create-architecture` | migrated | Audit/scaffold/improve routing, proposal pressure, explicit approval, implementation, and post-implementation review. |
| 5 | `create-design` | migrated | Review/proposal/implement routing, opening approval, Frontend-Taste proposal/attack, and post-edit review. |
| 6 | `create-skill` | migrated | Thin request-authorized authoring path with optional bounded comparative evaluation and no added approval gate. |
| 7 | `loop` | migrated | Generic bounded executor/controller cycle with durable state, explicit exits, and non-blocking-stop recovery. |
| 8 | `devrel-copywriter` | migrated | Tiny/full-cycle repository README routing, framing proposal pressure, drafting, hostile review, synthesis, humanizer passes, and final quality checks. |
| 9 | `docs-writer` | migrated | Tiny/full-cycle documentation routing, doc-mode contract, teaching-plan critique, drafting, and two review checkpoints. |

## Not migration targets

- `orbita` is the host adapter and runtime entrypoint, not a task workflow.
- `improve-codebase-architecture` is a legacy donor/reference skill routed to
  `create-architecture`.
- `grill-me`, `hat`, `caveman`, `forthright`, `humanizer`, and `obsidian` are
  atomic conversational/domain tools without a multi-role
  workflow contract. They should stay skills unless their contracts gain real
  runner-owned stages, gates, or durable outputs.
