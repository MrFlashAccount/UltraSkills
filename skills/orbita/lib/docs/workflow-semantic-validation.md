# Workflow semantic validation

Canonical validation docs moved to `./lib/validate/workflow-validation.md`.

Canonical validation agent instructions live at `./lib/validate/validation-agent-instructions.md`.

Run the deterministic validator through the existing CLI wrapper:

```sh
bun "$ORBITA_SKILL_ROOT/lib/entrypoints/cli/validate-workflow.mjs" "$ORBITA_SKILL_ROOT/../../workflows/dev-harness"
```

or:

```sh
bun run workflow:validate
```
