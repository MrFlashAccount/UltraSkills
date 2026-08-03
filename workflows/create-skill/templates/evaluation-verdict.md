# Create Skill Evaluation Verdict

Return a compact, typed, evidence-backed verdict for the latest substantial
candidate.

Include:

- `approved` or `needs_revision`
- concise summary, evidence checked, and bounded findings
- representative trigger and task evidence
- a concrete comparison of no skill, current skill, and candidate skill

An approved verdict may retain only `can_delay` findings. Any `must_fix` or
`should_fix` finding requires `needs_revision`.

If required evidence is unavailable, use the runner non-blocking-stop channel
instead of submitting a terminal verdict.
