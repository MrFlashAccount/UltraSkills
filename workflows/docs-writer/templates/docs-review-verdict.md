# Documentation review verdict

Return one independent hostile-prior `PASS` / `FAIL` verdict.

Every finding must include severity, precise location, evidence, impact,
required action, and why existing checks missed it. `PASS` may retain only
`can_delay` findings. Any `must_fix` or `should_fix` finding requires `FAIL`.

Use a runner non-blocking stop when required evidence is unavailable.
