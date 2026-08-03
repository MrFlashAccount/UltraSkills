# Code review orchestrator workflow

Read-only multi-role review workflow replacing the former skill package.

`review_intake` resolves the repository/path/ref/PR and base comparison, reads
the target guidance and evidence, runs the sensitive-surface scanner when
needed, and selects the smallest risk-based set of canonical reviewers.
Sensitive surfaces always include `privacy_review`; contract-bearing work
always includes `architect_review` unless the approved contract names an
explicit alternative drift gate.

`review` fans the selected reviewers out in parallel and merges one
evidence-first PASS/FAIL report with must-fix, should-fix, can-delay,
disagreements, contract/docs drift, and sensitive-surface coverage. The
workflow does not implement findings or mutate pull requests. When the user
requested iteration and external rework is ready, it may re-run intake and
review for at most three total passes; otherwise FAIL is terminal.

The runtime-required sensitive-surface scanner is copied into `scripts/` so the
workflow package does not depend on the source skill directory.

Validate with:

```sh
bun run workflow:validate
```
