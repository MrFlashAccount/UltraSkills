# Custom Workflow Roots

Orbita loads checked-in built-in workflows by default. Additional workflow packages can be added through `orbita.toml`:

```toml
[workflow_catalog]

[[workflow_catalog.roots]]
source_id = "team"
path = "~/.orbita/workflows"
```

Each configured root is scanned for child directories containing `workflow.toml` or `workflow.json`. Catalog refs use `source_id:relative-path`, for example `team:release/triage`.

Public CLI smoke for a promoted custom workflow package:

```bash
export WORKFLOW_RUNS_ROOT="$(mktemp -d)"
export ORBITA_CONFIG="$HOME/.orbita/orbita.toml"

bun skills/orbita/lib/entrypoints/cli/validate-workflow.mjs "$HOME/.orbita/workflows/sample/workflow.json"
bun skills/orbita/lib/entrypoints/cli/workflow-catalog.mjs list --json --config "$ORBITA_CONFIG"
bun skills/orbita/lib/entrypoints/cli/workflow-catalog.mjs resolve 'team:sample' --json --config "$ORBITA_CONFIG"
bun skills/orbita/lib/entrypoints/cli/workflow-runs.mjs create --run-id sample-run --workflow "$HOME/.orbita/workflows/sample/workflow.json"
lease_token="$(bun skills/orbita/lib/entrypoints/cli/workflow-runs.mjs claim --run-id sample-run --print-lease-token)"
bun skills/orbita/lib/entrypoints/cli/workflow-runner.mjs next --run-id sample-run --lease-token "$lease_token"
bun skills/orbita/lib/entrypoints/cli/workflow-runner.mjs instructions --run-id sample-run --step-id prepare --lease-token "$lease_token"
```

Use an isolated `WORKFLOW_RUNS_ROOT` for smoke runs. Do not write run artifacts into `skills/orbita/.workflow-runs`.
