---
name: create-skill
description: Create, rewrite, audit, simplify, or restructure a Claude/OpenClaw skill folder. Use when building a skill from source material, reviewing an existing skill, tuning trigger metadata, removing unnecessary instructions, designing progressive disclosure, adding deterministic scripts, or comparing a skill against a thinner or no-skill baseline.
---

Build the smallest skill that adds durable value beyond the model, repo, tools, and user request.

## Request authority

The request that triggers this skill authorizes the requested mode. Start when target and scope are clear.

- Keep audit and proposal requests read-only unless the user also requests edits.
- Ask only for a missing decision that would materially change the result.
- Preserve independent safety, privacy, destructive-action, publishing, commit, and push boundaries.

## Default path

1. Inspect the real source, current skill, runtime, and representative usage.
2. Separate non-obvious knowledge and fragile invariants from instructions the model can infer.
3. Choose the smallest useful `SKILL.md`, references, scripts, and assets.
4. Validate trigger behavior and task quality on enough real cases to cover material risks.
5. Compare against the current and no-skill baseline when the change is substantial.
6. Remove context that has no demonstrated value; restore only what evidence shows is needed.

Scale the process to the risk. Do not force a proposal, fixed number of examples, critic loop, or state machine when a direct edit plus verification is enough.

## Core rules

- Encode opinions, product knowledge, local gotchas, and procedures that are specific to the user, team, product, or runtime.
- Prefer expressive interfaces, schemas, scripts, tests, code, and source artifacts over prose that teaches the model how to reason.
- Match instruction strength to fragility: allow judgment for flexible work; use hard constraints for safety, destructive actions, exact protocols, and repeatedly observed failures.
- Check for conflicts and repetition across the user request, repo instructions, roles, tools, the target skill, and its references.
- Keep the common path in `SKILL.md`; load detailed or variant-specific material only when the task needs it.
- Add scripts for deterministic or repeated work and assets only for output resources.
- Keep claimed capabilities aligned with the files, tools, and paths that actually ship.
- For sensitive surfaces, keep repo-visible content local-safe and run the relevant privacy/data-safety review.

## Read only when needed

- Read `references/authoring.md` when creating or restructuring skill files.
- Read `references/evaluation.md` before a substantial rewrite, trigger tuning, or evidence-based simplification.
- Read `references/state-machines.md` only when unfinished output or invalid transitions can escape into user-visible or external state.
- Run `scripts/doctor.mjs` with Bun and `<skill-folder> [--eval <cases.jsonl>] [--json]` when auditing context shape, direct references, repeated rules, or eval-corpus structure.
