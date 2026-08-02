# Documentation contract

Return the typed contract and routing result before any edit.

- classify the task as `tiny` or `full-cycle`
- name one current or target documentation mode
- state artifact/goal, reader, job to be done, first win, scope, and non-goals
- list prerequisites, source-of-truth evidence, and risks/unknowns
- include concrete evidence inspected during intake

For a clear DevRel-owned request, return `devrel_writer` with
`files_edited: false`, the exact `route_target`
`workflows/devrel-copywriter/workflow.toml`, and a concise route reason. Do not
fabricate a docs contract or stop for clarification. Mixed work stops only when
the docs/DevRel scope split is genuinely ambiguous.

Use a runner non-blocking stop instead of inventing missing implementation-critical input.
