# Research critic handoff

Return one compact JSON wrapper packet for the latest `reasons-canvas-research` artifact.

## Required packet

- `outcome`: `handoff_ready` means the packet is terminally projected, not that research has human approval.
- `reasons_canvas_artifact`: `producerStepId: research_draft` plus the exact latest Canvas metadata under `artifact`.
- `critic_findings`: short findings from the latest hostile attack.
- `missing_evidence`: absent facts or verification that materially affect confidence.
- `unresolved_blockers`: short stop signs that currently block approval or responsible downstream work.
- `verdict`: `approve_as_is`, `approve_with_changes`, or `needs_more_research`.
- `readiness_note`: whether the packet is ready to present for explicit human handoff approval to Architect or execution planning, or must return to research.

## Rules

- Do not reproduce or rewrite the Canvas body.
- Do not create a second research artifact.
- Do not claim that the Canvas was externally saved, published, routed, or approved.
- Keep missing evidence distinct from its blocking consequence.
- Preserve unresolved attack findings when the bounded loop ends; never project a false clean pass.
- Use the appended output schema for exact JSON shape and artifact-reference mechanics.
