# Research critic workflow

Pre-implementation research workflow replacing the former skill package: Researcher draft, hostile Researcher attack, at most one bounded revision/re-review, then a terminal wrapper handoff.

The workflow produces one canonical `reasons-canvas-research` artifact plus the wrapper fields `critic_findings`, `missing_evidence`, `unresolved_blockers`, `verdict`, and `readiness_note`. It does not persist externally, grant human approval, or start architecture, planning, implementation, PR, ticket, or transport work.

The Canvas uses the shared visual-first Markdown REASONS format: plain-language
titles, observed/candidate diagrams and short evidence-backed constraints.
Research depth remains separate from a selected architecture or execution plan.

- Workflow: `workflow.toml`
- Output schemas: `schemas/*.json`
- Handoff template: `templates/research-handoff-template.md`
