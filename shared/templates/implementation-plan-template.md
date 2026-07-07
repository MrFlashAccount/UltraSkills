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

## UI Intent Contract

Complete this section when an approved `ui-intent-contract` is applicable. If the UI intent gate marked the slice not applicable, record that reason instead of inventing UI intent.

| Topic | Approved UI intent | Implementation planning consequence |
| --- | --- | --- |
| User / task | <who and what job> | <what the plan must preserve> |
| Primary / secondary actions | <actions> | <workstream / DoD coverage> |
| First read / hierarchy | <what should be understood first> | <screen/component planning implication> |
| Screen / zones | <semantic zones> | <component/file-zone planning implication> |
| Required states | <loading/empty/error/success/disabled/etc.> | <state/component/test implication> |
| Interaction expectations | <forms/dialogs/drawers/navigation/focus/responsive/motion> | <implementation/review implication> |
| Design basis | <DESIGN.md/existing UI/reference/fallback> | <UI-kit/tokens/taste-review implication> |

UI intent gates:
- Preserve the approved UI intent; do not rewrite visual hierarchy, density, tone, or screen semantics in implementation planning.
- If architecture or implementation reality conflicts with approved UI intent, return blocked or request plan revision instead of silently changing the interface.
- Keep file/component architecture in the Frontend composition plan, not in this section.

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
- Consume the approved architecture summary, `reasons-canvas-architecture`, and applicable `ui-intent-contract` artifacts as the active contracts. Do not consume research separately; rely on the architecture and UI intent artifacts to carry forward any research context that remains valid.
- Do not include code, diffs, command sequences, or process handoff instructions.
