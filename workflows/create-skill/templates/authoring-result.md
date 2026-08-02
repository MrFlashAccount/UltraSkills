# Create Skill Authoring Result

Return the typed authoring result only after the requested audit, proposal, or
implementation work and its risk-appropriate verification are complete.

Include:

- the requested mode, whether edits were requested, and whether files were edited
- a concise result summary and changed files when applicable
- concrete source, trigger, and representative task evidence
- doctor evidence only when doctor was relevant and run
- remaining risks, if any

Return `needs_evaluation` only for a substantial rewrite, trigger change, or
evidence-based simplification. Direct low-risk work may return `complete`.

If a material decision or required evidence is missing, use the runner
non-blocking-stop channel instead of submitting this result.
