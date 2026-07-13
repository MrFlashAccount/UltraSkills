# <Project/Issue> Implementation Plan — <Capability>

## Artifact Metadata

- Owner:
- Date:
- Source artifacts:
- Scope boundary:

## Goal

<The concrete implementation outcome. Keep it tied to the approved context and architecture.>

## Work breakdown

| Workstream | Owner role | Files/zones | Add/change | Done when |
| --- | --- | --- | --- | --- |
| A | <role> | <exact files, folders, modules, or zones> | <new/change/remove at planning level> | <observable completion signal> |
| B | <role> | <exact files, folders, modules, or zones> | <new/change/remove at planning level> | <observable completion signal> |
| C | <role> | <exact files, folders, modules, or zones> | <new/change/remove at planning level> | <observable completion signal> |
| D | <role> | <exact files, folders, modules, or zones> | <new/change/remove at planning level> | <observable completion signal> |

## REASONS-to-workstream trace

| REASONS section | Planning decision | Workstream / DoD coverage |
| --- | --- | --- |
| Requirements | <accepted behavior/scope from architecture artifact> | <workstream or DoD item> |
| Entities | <implementation entities/file zones> | <workstream> |
| Approach/Structure | <chosen implementation shape> | <workstream/reviewer> |
| Norms/Safeguards | <constraints/checks/rollback> | <DoD/verification/review> |

## Exact implementation tasks

### A. <Workstream name>

- In `<file/zone>`, add/change `<class/entity/function/method/config/doc section>` to <planning-level behavior>.
- Preserve <boundary/invariant/compatibility constraint>.

### B. <Workstream name>

- In `<file/zone>`, add/change `<class/entity/function/method/config/doc section>` to <planning-level behavior>.

### C. <Workstream name>

- In `<file/zone>`, add/change `<class/entity/function/method/config/doc section>` to <planning-level behavior>.

### D. <Workstream name>

- In `<file/zone>`, add/change `<class/entity/function/method/config/doc section>` to <planning-level behavior>.

## UI Design Proposal

Complete this section when an approved `ui-design-proposal` is applicable. If the UI design proposal gate marked the slice not applicable, record that reason instead of inventing UI design proposal.

| Topic | Approved UI design proposal | Implementation planning consequence |
| --- | --- | --- |
| User / task | <who and what job> | <what the plan must preserve> |
| Product / surface route | <application workflow/admin/form/table/docs/navigation/marketing/mixed/etc. + evidence> | <which UI rules/review expectations apply> |
| Primary / secondary actions | <actions> | <workstream / DoD coverage> |
| First read / hierarchy | <what should be understood first> | <screen/component planning implication> |
| Screen / zones | <semantic zones> | <component/file-zone planning implication> |
| Product-level data hierarchy | <product concepts, primary facts, secondary facts, debug/detail-only facts> | <data shaping and rendering implication> |
| Selected content patterns | <form/table/document/navigation/list/card/etc. and why selected> | <component/state/proof implication> |
| Card / list rules, if selected | <anatomy, primary/secondary facts, hidden fields, selected/unselected/hover/focus states, spacing, containment> | <style/state/proof implication, or not applicable> |
| Detail overlay / panel rules, if selected | <approved placement by breakpoint, open/closed/no-selection states, selected sync, animation properties, focus, reduced motion> | <overlay/state/responsive/proof implication, or not applicable> |
| Responsive containment / wrapping | <containment rules and forbidden wrapping for chips/buttons/pills/tabs/segmented controls/status labels> | <layout/control/proof implication> |
| Required states | <loading/empty/error/success/disabled/etc.> | <state/component/test implication> |
| Interaction expectations | <forms/dialogs/drawers/navigation/focus/responsive/motion> | <implementation/review implication> |
| Design basis | <DESIGN.md/existing UI/reference/fallback> | <UI-kit/tokens/taste-review implication> |
| Visual evidence / proof assets | <screenshots/references/proof pages/mockups/current UI/gaps> | <what to preserve, compare, capture, or request> |

UI design proposal gates:
- Preserve the approved UI design proposal; do not rewrite visual hierarchy, density, tone, or screen semantics in implementation planning.
- Card/list and drawer/sidebar/bottom-sheet details are required only when those patterns are selected by the approved HTML artifact. Do not introduce them as generic composition defaults.
- If architecture or implementation reality conflicts with approved UI design proposal, report a non-blocking stop through the runner control channel requesting plan revision instead of silently changing the interface.
- Keep file/component architecture in the Frontend composition plan, not in this section.
- The plan is a routing translation, not a substitute for the approved `ui-design-proposal` HTML artifact or its human approval evidence. Frontend implementation and frontend-taste review must inspect both directly and compare rendered proof for fidelity.

## Frontend composition plan

Complete this section when `frontend_implementation` is selected for non-trivial user-facing UI. If the frontend slice is non-UI, trivial, or intentionally preserves an existing component shape, record that reason instead of inventing components.

| Layer | Planned components / hooks / selectors | Existing UI kit / tokens / conventions to use | File zones | Responsibility boundary |
| --- | --- | --- | --- | --- |
| Page / screen containers | <route/page/view shells> | <repo conventions> | <files/folders> | <data orchestration, composition, routing/state boundary> |
| Feature components | <domain panels/forms/cards/tables/editors> | <repo conventions> | <files/folders> | <domain-specific rendering/interaction> |
| Layout components | <PageShell/Section/Stack/Grid/Toolbar/FormRow/etc.> | <tokens/layout primitives> | <files/folders> | <spacing/structure only> |
| Primitives / UI kit | <Button/Link/Input/Select/etc. existing or new> | <existing primitive/token path> | <files/folders> | <control behavior/styling contract> |
| Overlays and composites | <Modal/Drawer/Menu/Tabs/Toast/List/Card/etc.> | <existing primitive/composite path> | <files/folders> | <overlay/list/form family behavior> |
| State surfaces | <loading/error/empty/skeleton/disabled/permission states> | <existing state components/patterns> | <files/folders> | <visible recovery and pending behavior> |
| Hooks / selectors / adapters | <useXModel/selectX/normalizeX/mutations/url-state> | <state/data conventions> | <files/folders> | <state ownership, derived data, side effects> |

Frontend composition gates:
- The route/page component should remain mostly orchestration and composition; it should not own control styling, repeated list/card markup, overlay internals, state surfaces, and business-state transitions inline.
- Repeated className/token clusters, repeated controls, repeated overlay/list/form scaffolds, and repeated status-state branches should use existing primitives/composites or be extracted into named local components/helpers.
- New shared primitives require evidence that no suitable repo primitive exists; otherwise use the existing design-system path.
- Do not split decorative one-off markup into files without a stable responsibility.

## Definition of Done

- <Functional result is present.>
- <Approved architecture boundaries are preserved.>
- <Tests/checks/docs are updated as needed.>
- <No unrelated files or behavior changed.>
- <Review blockers resolved or explicitly accepted.>

## Reviewer plan

When a structured output schema asks for reviewer selection, keep this table aligned with the JSON `review_plan.reviewers` roles/reasons/surfaces/required flags. This is a declaration for downstream selection, not runtime fan-out.

| Review role | Focus | Required evidence |
| --- | --- | --- |
| Architecture reviewer | Placement, ownership, dependencies, integration boundaries | <diff/docs/tests to inspect> |
| Implementation reviewer | Correctness, maintainability, edge cases | <diff/tests/manual check> |
| QA/reliability reviewer | Failure modes, regression risk, verification completeness | <test output/manual scenario> |
| Docs/process reviewer | User-facing or process documentation accuracy | <changed docs/README/reference> |

## Rollback plan

- <Smallest safe revert path.>
- <Data/config compatibility note, if applicable.>
- <How to detect rollback is needed.>

## Appendix: <source artifact name>

<Paste approved architecture-derived context needed by implementers/reviewers. Add more appendix sections as needed.>

## Template rules

- Be concrete and file-level: name file zones, classes, entities, functions, methods, configs, and docs at planning level.
- Use ABCD workstreams when helpful; keep roles/owners explicit.
- Include DoD, reviewer roles, rollback, and any source appendices needed to make the plan self-contained.
- Consume the approved architecture summary, `reasons-canvas-architecture`, and applicable `ui-design-proposal` artifacts as the active contracts. Do not consume research separately; rely on the architecture and UI design proposal artifacts to carry forward any research context that remains valid.
- Do not include code, diffs, command sequences, or process handoff instructions.
