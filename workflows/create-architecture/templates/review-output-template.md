# Create-Architecture Review Output

Return only the JSON shape required by the step schema. Do not create or edit
files.

For an Architect pass using `reviewed-output.json`:

- `outcome`: `reviewed`
- `verdict.status`: `pass` or `fail`
- `verdict.summary`
- `verdict.evidence_checked`
- `verdict.findings`

For a Critic or final Architect gate using `review-output.json`:

- `outcome`: `approved` or `needs_revision`
- `gate_summary`
- `verdict.summary`
- `verdict.evidence_checked`
- `verdict.findings`

Every finding contains `severity`, `finding`, exact `evidence`, and
`required_next_action`. `approved` or `pass` permits no `must_fix` or
`should_fix` finding.
