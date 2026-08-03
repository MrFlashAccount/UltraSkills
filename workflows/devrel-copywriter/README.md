# DevRel copywriter workflow

## What it is

A repository README workflow for product-facing framing and opening structure. It replaces the former `devrel-copywriter` skill package with explicit tiny and full-cycle routes, independent hostile review, conditional positioning approval, synthesis, humanizer passes, and bounded final quality checks.

## Use when

Use it when a repository README is the product-facing entrypoint and needs framing, structure choice, first-screen pitch, positioning, message hierarchy, or a local wording fix that changes those concerns.

## Do not use when

Do not use it when the main job is teaching setup, usage, configuration, product flow, migration, tutorials, reference material, or API behavior. Route that work to `workflows/docs-writer/workflow.toml`.

## Runtime contract

`readme_intake` grounds a compact writing contract in the repository and selects `tiny`, `full_cycle`, or `docs_writer`. Tiny work runs edit, humanizer, and independent review with at most one bounded correction pass. Full-cycle work runs framing alternatives, a hostile pre-draft attack, reconciliation, a conditional human approval gate for material public-positioning changes, draft attack, synthesis, two humanizer/review checkpoints, and a bounded final-checklist correction loop.

The workflow-local references preserve the former skill's task contract, README process, and review policy. DevRel quality remains owned by `roles/dev-rel/ROLE.md` and `roles/dev-rel/RUBRIC.md`.

Validate with:

```sh
bun skills/orbita/lib/entrypoints/cli/validate-workflow.mjs workflows/devrel-copywriter/workflow.toml
```
