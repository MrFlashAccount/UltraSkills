# Shared Templates

Reusable artifact templates for cross-skill planning artifacts and worker output formats.

This package is reference-only. It is not a runtime skill and must not contain `SKILL.md`.

## Template role

These files are reusable output templates. Workflow descriptors reference them with normal paths relative to the directory containing the active `workflow.json`, for example `../../shared/templates/<file>.md` from `workflows/<name>/workflow.json`. There is no repository-root or `shared/...` alias and no silent fallback.

## Templates

- [`research-canvas-save-metadata-template.md`](research-canvas-save-metadata-template.md): compact persistence metadata for saved research Canvas artifacts.
- [`architecture-proposal-template.md`](architecture-proposal-template.md): concise architecture proposal for entities, placement, ownership, dependencies, interfaces, integrations, and docs impact. No implementation plan or code.
- [`reasons/`](reasons/): shared SPDD structured prompt/spec template for immutable REASONS Canvas artifacts.
- [`ui-design-proposal-template.html`](ui-design-proposal-template.html): first-class inspectable UI design proposal organized as a REASONS evidence chain. Requirements is a concise text-first, prioritized, solution-independent contract covering functional, interaction, information, and non-functional quality requirements plus out-of-scope boundaries and success checks; it intentionally contains no selected-direction mockup before Approach. Entities uses a relationship map; Approach uses controlled direction frames; Structure uses annotated raster anatomy; Operations uses a raster storyboard; Norms uses observable interface laws; Safeguards uses rendered stress cases and approval gates. Proposed screens remain sibling raster image artifacts embedded by relative paths. Direction frames are one part of the argument, not the whole artifact, and selected-pattern contracts remain conditional rather than universal defaults.
- [`implementation-plan-template.md`](implementation-plan-template.md): concrete approved-work plan with ABCD workstreams, exact file zones, planning-level entities/methods, DoD, owners, reviewers, rollback, and generic source appendices.
- [`implementer-handoff-template.md`](implementer-handoff-template.md): implementation handoff packet for an assigned slice, including source-of-truth context, todo checklist, contract rows, evidence expectations, and output fields.
- [`reviewer-handoff-template.md`](reviewer-handoff-template.md): review handoff packet with source-of-truth context, implementation evidence, review checklist, contract-trace rows, and verdict fields.
- [`review-verdict-template.md`](review-verdict-template.md): compact critic/reviewer worker output for review gates, with verdict, evidence, findings, and transition output.
- [`reviewer-to-implementer-handoff-template.md`](reviewer-to-implementer-handoff-template.md): narrow fix-pass packet from reviewer findings back to implementers, with source-of-truth context, todo checklist, must-fix gap rows, and verification expectations.

## Usage notes

- These files define artifact formats only; they do not define orchestration, worker spawning, or approval-gate process.
- Add or remove source appendix sections to fit the artifact being prepared.
- Keep role loading, delegated-worker invocation, and harness-specific sequencing in the consuming skill or process docs, not in these templates.
