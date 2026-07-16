# Dev harness workflow

This workflow is the heavy path for non-trivial implementation work. Use it when the task needs staged research, architecture review, implementation planning, explicit approval, selective implementation, and review before completion.

Implementation and review are first-class fanout owner steps. Each activation runs the selected branch workers, returns to the same owner cursor, and then runs the owner worker to choose the next fanout branch set. There are no dispatch or join workers. Rework selection uses the review owner's output first and falls back to the approved plan only when review has not requested a narrower pass.

Keep workflow mechanics in `workflow.toml` and schemas in `schemas/*.json`. Use this README for human workflow intent and EA-agent operating rules, not for runtime routing.

## Approval summaries and artifacts

Every draft step that feeds a human approval gate must emit a compact `summary` as the human-facing proposal state and a file-backed artifact for the proposal body.

Approval gates present the draft-produced `summary`, attach the referenced artifact without opening it, include the attack verdict, and wait for explicit approval. The orchestrator must not read the artifact body merely to prepare the gate or invent a fresh approval summary; it may open the attachment later only when the user explicitly asks a content question.

Attack, review, implementation, and planning workers should continue to consume the artifact or structured contract fields they need. Do not replace their evidence context with the approval summary. Frontend implementation and frontend-taste review consume the approved self-contained `ui-design-proposal` HTML, its seven derived PNG reference captures, and explicit approval evidence directly; the implementation-plan translation is not a visual substitute.

The implementation plan body is artifact-only. `planning_draft` JSON must not inline the readable plan/proposal body; it should contain only compact routing and reviewer-selection fields needed by the runner plus `summary` and `artifacts`.

## Research solution discussion

The research step must not create `reasons-canvas-research` while important user-owned product, API, architecture, edge-case, or scope choices are still unresolved.

Before proposing one direction, the researcher must discuss materially different solution options with the user when the task could reasonably be solved in more than one way. This is a real dialogue, not an internal comparison.

When code or repository evidence can answer the question, inspect the code instead of asking the user. When a user-owned direction, edge-case, or scope decision remains, use the runner's non-blocking stop flow to make the orchestrator discuss it with the user:

- report the stop through the request's runner control command, not as output;
- set `non_blocking_stop.source_step_id` to `research_draft`;
- put one focused user-facing discussion prompt in `non_blocking_stop.needed`;
- include the main options, trade-offs, edge cases, failure modes, migration or compatibility impact, operational cost, and recommended direction in `non_blocking_stop.summary` or `non_blocking_stop.needed`;
- after the orchestrator resolves it, continue the same research step and ask the next focused discussion question if another user-owned decision remains.

Only create or revise `reasons-canvas-research` after the needed user dialogue is complete, or after evidence shows no dialogue is needed.

## Architecture contract and API discussion

The architecture step must identify affected public contract and API surfaces before finalizing `reasons-canvas-architecture` and its compact output `summary`.

Public contract/API surfaces include exported APIs, CLI or user-facing commands, schemas, workflow interfaces, integration boundaries, compatibility promises, and observable behavior.

When code, docs, or existing contracts answer the question, inspect them instead of asking the user. When a user-owned decision remains about contract shape, naming, compatibility, migration behavior, or accepted breakage, use the non-blocking stop flow:

- report the stop through the request's runner control command, not as output;
- set `non_blocking_stop.source_step_id` to `architecture_draft`;
- put the smallest concrete public contract or API decision in `non_blocking_stop.needed`;
- include the recommended answer in `non_blocking_stop.summary` or `non_blocking_stop.needed`;
- ask one question at a time.

After the orchestrator resolves the non-blocking stop, continue the same architecture step from the resolved decision and only then finalize the architecture artifact and compact summary.

## UI design proposal contract

When the UI design proposal gate applies, frontend-taste owns both the draft and hostile attack. The self-contained HTML artifact must explicitly record UI applicability and product/surface route, design-basis preflight, user/task and primary/secondary actions, user questions/decisions, first-read hierarchy, screen/zones, product-level data hierarchy, selected pattern contracts, animation/reduced-motion behavior, responsive containment, rendered-proof expectations, and open tensions. Every proposed desktop, narrow, direction, storyboard, and stress-state surface is semantic HTML/CSS inside that artifact; the gate never calls image generation. Related mockup groups use Declarative Shadow DOM with their own internal styles, host reset, and containment so proposal-shell CSS cannot enter and mockup CSS cannot escape.

After the HTML is final and written to disk, the draft worker calls the standalone repository script `scripts/render-html-selector-captures.mjs`; it does not operate browser tooling itself. The worker explicitly passes the existing HTML path, available Chrome/Chromium executable path, viewport, timeout, and ordered capture objects containing selector, URL hash, and exact PNG output path. The renderer uses the runtime's built-in `Bun.WebView`; it does not import Playwright or Orbita `lib`, read the workflow document, embed Dev Harness/REASONS knowledge, choose artifact ids, or choose output paths. It opens one headless view, loads the HTML once, switches hash in-page, clips each selector through Chrome DevTools Protocol, and writes seven PNGs to the paths supplied by the worker. After every output file exists, the worker passes the existing HTML path and those exact PNG paths to `write-output` under the schema's stable artifact ids. These captures are derived visual references, not independently generated proposal art. The hostile attack inspects both the HTML and every PNG; approval attaches all eight artifacts; frontend implementation and frontend-taste review compare actual-product proof against the approved PNGs while using the HTML for semantic detail and annotations.

Use [`examples/orbita-run-triage-ui-design-proposal.html`](examples/orbita-run-triage-ui-design-proposal.html) as a filled reference for the artifact shape and isolated mockup groups.

Card/list anatomy and selection rules are mandatory only when the approved direction selects cards or list rows. Drawer/sidebar/bottom-sheet placement and state rules are mandatory only when the direction selects a detail overlay or panel. The workflow does not impose a generic card-and-drawer composition on forms, tables, documents, navigation, or other surfaces.

The hostile attack checks the proposal's HTML/CSS compositions and visually inspects all derived captures for hierarchy, typography/rhythm, spacing/composition, color/emphasis/contrast, focus-visible and target affordance, responsive containment, motion/reduced-motion, evidence fidelity, clipping, and generic UI slop without inventing `DESIGN.md`. Applicable non-trivial UI must define rendered implementation proof, and implementation plus frontend-taste review must inspect and compare that proof against the approved PNG references.
