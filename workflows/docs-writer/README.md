# docs-writer workflow

## What it is

A contract-first documentation workflow replacing the former skill package. It
preserves the TechWriter role boundary, documentation modes, tiny/full-cycle
routing, hostile-prior review policy, and source-grounded teaching rules.

The `tiny` path creates a compact contract, makes one narrow edit without
changing the teaching flow or primary doc mode, and runs one independent
hostile review. The `full-cycle` path locks one primary doc mode, critiques the
teaching plan, runs one TechWriter-versus-Critic debate round, drafts, reviews,
fixes, and runs a second independent review checkpoint. A bounded final FAIL is
reported honestly rather than projected as a clean pass.

## Use when

Use it for setup, usage, quick starts, tutorials, how-tos, onboarding,
migration docs, API behavior/options/examples, reference clarity, and README
sections whose main job is teaching readers to succeed.

## Do not use when

Do not use it for product framing, positioning, README openings, full
product-facing repository README rewrites, launch copy, changelog blurbs, or
polish-first DevRel messaging. Clear DevRel-owned requests route without edits
to `workflows/devrel-copywriter/workflow.toml`; only a genuinely ambiguous
mixed docs/DevRel scope uses a non-blocking stop.

Runtime routing lives in `workflow.toml`; typed worker contracts live in
`schemas/`; compact output guidance lives in `templates/`; copied source
guidance lives in `references/`.

Validate from the repository root:

```sh
bun skills/orbita/lib/entrypoints/cli/validate-workflow.mjs workflows/docs-writer
```
