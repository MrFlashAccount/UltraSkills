# Dev harness workflow

This workflow is the heavy path for non-trivial implementation work. Use it when the task needs staged research, architecture review, implementation planning, explicit approval, selective implementation, and review before completion.

Implementation and review are first-class fanout owner steps. Each activation runs the selected branch workers, returns to the same owner cursor, and then runs the owner worker to choose the next fanout branch set. There are no dispatch or join workers. Rework selection uses the review owner's output first and falls back to the approved plan only when review has not requested a narrower pass.

Keep workflow mechanics in `workflow.toml` and schemas in `schemas/*.json`. Use this README for human workflow intent and EA-agent operating rules, not for runtime routing.

## Approval summaries and artifacts

Every draft step that feeds a human approval gate must emit a compact `summary` as the human-facing proposal state and a file-backed artifact for the proposal body.

Approval gates present the draft-produced `summary`, attach the referenced artifact, include the attack verdict, and wait for explicit approval. The orchestrator must not read the artifact body to invent a fresh approval summary.

Attack, review, implementation, and planning workers should continue to consume the artifact or structured contract fields they need. Do not replace their evidence context with the approval summary.

The implementation plan body is artifact-only. `planning_draft` JSON must not inline the readable plan/proposal body; it should contain only compact routing and reviewer-selection fields needed by the runner plus `summary`, `artifacts`, and blockers.

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

The architecture step must identify affected public contract and API surfaces before finalizing `reasons-canvas-architecture` and its compact output `summary`.

Public contract/API surfaces include exported APIs, CLI or user-facing commands, schemas, workflow interfaces, integration boundaries, compatibility promises, and observable behavior.

When code, docs, or existing contracts answer the question, inspect them instead of asking the user. When a user-owned decision remains about contract shape, naming, compatibility, migration behavior, or accepted breakage, use the recoverable blocker flow:

- return `outcome: "blocked"`;
- set `blocker.source_step_id` to `architecture_draft`;
- put the smallest concrete public contract or API decision in `blocker.needed`;
- include the recommended answer in `blocker.summary` or `blocker.needed`;
- ask one question at a time.

After the orchestrator resolves the blocker, continue the same architecture step from the resolved decision and only then finalize the architecture artifact and compact summary.
