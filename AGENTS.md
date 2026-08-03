# AGENTS.md

## Agent execution rules
- When an execution/implementation agent starts tests, lint, validation, typecheck, build checks, or similar long-running verification, it must wait at least 5 minutes before polling/reporting that the command is still running. Do not do short 30s/60s "still running" polling loops. If the command exits or produces an actionable failure sooner, handle that result immediately.
- Avoid heavy subprocess-based tests when the same behavior can be exercised by importing the module/API directly. Use `spawn`/`spawnSync` for CLI coverage only when process boundaries, argument parsing, shell command portability, stdin/stdout/stderr, exit codes, environment/cwd behavior, or another CLI-only contract is the actual subject under test.
- For Orbita dependency boundary changes, run `bun run depcruise:check`. Treat dependency-cruiser failures as real dependency-rule findings, not as checker flakiness.

## Repo rules
- This repo is self-contained.
- Do not rely on critical external skill dependencies.
- If a skill depends on another skill, that dependency must also live in this repo.
- Keep atomic runtime skills under `skills/` and multi-stage runner-owned processes under `workflows/`.
- When explicitly migrating a skill process into a workflow, copy its runtime-required contents into `workflows/<name>/` and remove the replaced skill entrypoint only after repository routing points at the workflow package.
- Copy the runtime-required package contents, including references, scripts, assets, templates, schemas, and any other required files.
- Do not copy auxiliary repo/editor docs when they are not part of the skill runtime behavior.
- `skills/` is the source of truth for local runtime loading.
- `workflows/` is the source of truth for workflow-runner loading; do not keep duplicate `SKILL.md` facades for migrated workflows.
- `shared/` holds reusable reference packages, not runtime skills.
- Shared packages must not contain `SKILL.md`; keep them discoverable from `README.md` instead.
- Every skill listed in `README.md` must include compact guidance in this exact shape: `What it is`, `Use when`, `Do not use when`.
- Skills are simple atomic tools (`caveman`/`forthright`/`hat` style); multi-stage processes are workflows that describe the high-level process and roles they invoke.
- Do not describe a role as the essence of a skill; workflows orchestrate roles, and reusable roles live under `roles/`.
- Roles are self-contained knowledge/thinking containers.
- Use `hat <role>` when you need to converse or work through a role lens.
- A skill is an atomic runtime tool, not a facade for one role or a duplicate workflow entrypoint.
- Do not create `skills/<role>` just to mirror, load, or re-export `roles/<role>`.
- Skills may reference a role entrypoint and rubric when the skill is a real process adapter that needs that role boundary or quality bar.
- Allowed from `skills/**`: `roles/<role>/ROLE.md`.
- Allowed from `skills/**`: `roles/<role>/RUBRIC.md`.
- Forbidden from `skills/**`: `roles/<role>/LEARNINGS.md`.
- Forbidden from `skills/**`: `roles/<role>/references/**`.
- Detailed role references, checklists, and templates are loaded by the role itself, not by skills.
- If a process adapter needs an exception, make that exception explicit and local; do not imply blanket access to role internals.
- In skill runtime instructions, resolve paths relative to the skill root (`skills/<name>/`), not relative to nested reference files.
- For repo-level shared roles/conventions from a skill, use skill-root-relative paths such as `../../roles/<role>/...` or `../../conventions/<file>.md`.
- For sibling skills from a skill, use skill-root-relative paths such as `../<skill-name>/...`; do not use `skills/<skill-name>/...` inside runtime instructions unless describing the repository map rather than a load path.
- Every role directory must contain `ROLE.md`, `RUBRIC.md`, and `LEARNINGS.md`; `LEARNINGS.md` may be minimal or empty but must exist.
- Avoid premature shared infrastructure across skills.
- If a small repeated dependency is simpler to embed as behavior than to turn into cross-skill coupling, embed it.
- Directory names should use lowercase kebab-case by default.
- Do not rely on case-only path differences; treat path casing as canonical and consistent.
- Keep convention-required filenames unchanged, including `SKILL.md`, `README.md`, and `AGENTS.md`.
