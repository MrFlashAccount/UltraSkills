# Architecture proposal review exit

Return only the schema-defined projection of the latest Critic result.

- `ready_for_approval`: the Critic approved; `unresolved_findings` must be empty.
- `exhausted`: the bounded proposal-review loop ended with `needs_revision`; copy every latest Critic finding into `unresolved_findings` and state that approval and implementation were not reached.

Do not add a new review judgment or soften findings.
