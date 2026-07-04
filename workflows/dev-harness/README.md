# Dev harness workflow

This workflow is the heavy path for non-trivial implementation work. Use it when the task needs staged research, architecture review, implementation planning, explicit approval, implementation dispatch, and review before completion.

Keep workflow mechanics in `workflow.toml` and schemas in `schemas/*.json`. Use this README for human workflow intent and EA-agent operating rules, not for runtime routing.

## Research solution discussion

The research step must not create `reasons-canvas-research` while important user-owned product, API, architecture, edge-case, or scope choices are still unresolved.

Before proposing one direction, the researcher must discuss materially different solution options with the user when the task could reasonably be solved in more than one way. This is a real dialogue, not an internal comparison.

When code or repository evidence can answer the question, inspect the code instead of asking the user. When a user-owned direction, edge-case, or scope decision remains, use the runner's recoverable blocker flow to make the orchestrator discuss it with the user:

- return `outcome: "blocked"`;
- set `blocker.source_step_id` to `research_draft`;
- put one focused user-facing discussion prompt in `blocker.needed`;
- include the main options, trade-offs, edge cases, failure modes, migration or compatibility impact, operational cost, and recommended direction in `blocker.summary` or `blocker.needed`;
- after the orchestrator resolves it, continue the same research step and ask the next focused discussion question if another user-owned decision remains.

Only create or revise `reasons-canvas-research` after the needed user dialogue is complete, or after evidence shows no dialogue is needed.

## Architecture contract and API discussion

The architecture step must identify affected public contract and API surfaces before finalizing `architecture_contract` or `reasons-canvas-architecture`.

Public contract/API surfaces include exported APIs, CLI or user-facing commands, schemas, workflow interfaces, integration boundaries, compatibility promises, and observable behavior.

When code, docs, or existing contracts answer the question, inspect them instead of asking the user. When a user-owned decision remains about contract shape, naming, compatibility, migration behavior, or accepted breakage, use the recoverable blocker flow:

- return `outcome: "blocked"`;
- set `blocker.source_step_id` to `architecture_draft`;
- put the smallest concrete public contract or API decision in `blocker.needed`;
- include the recommended answer in `blocker.summary` or `blocker.needed`;
- ask one question at a time.

After the orchestrator resolves the blocker, continue the same architecture step from the resolved decision and only then finalize the architecture contract or artifact.
