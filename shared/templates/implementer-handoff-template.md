# <Project/Issue> Implementer Handoff — <Slice>

Use this as the format/context packet passed to an implementer for one approved implementation slice. Fill it from the source-of-truth task, proposal/plan, review notes, and any explicit constraints. Do not use this as a new planning surface.

## Status

- Owner:
- Date:
- State: Ready for implementation | In progress | Implemented
- Repo / branch:
- Issue / PR:
- Based on source task/proposal/plan:

## Loaded / source-of-truth context

<Insert or link the exact context the implementer must treat as binding: task statement, proposal/plan slice, prior review findings, constraints, approvals, and non-goals.>

## Implementer assignment

- Assigned file zones:
- Explicit non-goals:
- Do not edit outside:

## Implementation objective

<One short paragraph: what this implementer must make true in this slice.>

## Todo checklist

- [ ] <Concrete task tied to a requirement/source row.>
- [ ] <Concrete task tied to a required test/check/doc update.>
- [ ] <Concrete cleanup or compatibility task, if required.>

## Source contract checklist

| Requirement id | Source | Exact requirement / approved mapping | Required implementation evidence | Required test/check evidence | Required docs evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | <issue/proposal/plan/review> | <exact requirement text, or approved semantic mapping> | <code/schema/runtime artifact> | <test/check> | <doc/update or n/a> | not_started |
| R2 | <issue/proposal/plan/review> | <exact requirement text, or approved semantic mapping> | <code/schema/runtime artifact> | <test/check> | <doc/update or n/a> | not_started |

Rules:

- Treat every row in this table as a mandatory hard gate for the assigned slice, not as a preference or checklist hint.
- Do not replace source terms with “close enough” names or behavior, satisfy rows through alternate wording, or use unapproved semantic mappings unless the row includes that approved mapping.
- If a row cannot be satisfied in scope, report `NON_BLOCKING_STOP` through the orchestrator/host control channel with the exact row id, reason, and the smallest concrete approval question needed to proceed. Do not submit a completed handoff; resume the same task after resolution.
- If implementation discovers a contradiction with the approved plan or would require a deviation from an approved row, stop instead of redesigning silently.

## Workstream tasks

- In `<file/zone>`, add/change `<entity/behavior>` so that `<requirement id>` is satisfied.
- Preserve `<boundary/invariant/compatibility rule>`.
- Update `<test/doc/check>` required by the source contract checklist.

## Frontend component map

Complete this section when the slice includes non-trivial user-facing UI. If not applicable, state why.

| Layer | Components / hooks / selectors implemented or changed | Files | Boundary / reuse scope | Existing primitive/token path used |
| --- | --- | --- | --- | --- |
| Page / screen containers | <route/page/view shells> | <files> | <composition/orchestration boundary> | <repo convention or n/a> |
| Feature components | <domain panels/forms/cards/tables/editors> | <files> | <domain responsibility> | <repo convention or n/a> |
| Layout components | <shells/sections/stacks/grids/toolbars/rows> | <files> | <layout-only responsibility> | <tokens/layout primitives> |
| Primitives / UI kit | <Button/Link/Input/etc. used or introduced> | <files> | <control contract> | <existing primitive/token path> |
| Overlays and composites | <Dialog/Drawer/Menu/List/Card/etc.> | <files> | <composite behavior> | <existing primitive/composite path> |
| State surfaces | <loading/error/empty/skeleton/disabled/permission> | <files> | <visible state/recovery behavior> | <existing state pattern> |
| Hooks / selectors / adapters | <useX/selectX/normalizeX/mutation/url-state> | <files> | <state ownership / side effects / derived data> | <state/data convention> |

Frontend component-map rules:

- Name any approved `Frontend composition plan` deviations and why they were necessary.
- Name repeated style/control/list/overlay/state scaffolding eliminated or intentionally left with justification.
- Do not use this section to claim componentization without matching files and boundaries.

## Verification expected from implementer

- Run:
  - `<targeted test/check>`
  - `<project-native check>`
- Also report:
  - rows fully satisfied
  - rows needing help or partial
  - files changed
  - any approved mapping used

## Output required

Return:

- summary
- changed files
- source contract checklist with final row statuses: `covered` or `partial`
- verification run + result
- review handoff notes

Do not claim `ready_for_review` unless every mandatory row is `covered`; `partial`, unmapped rows, not-applicable waivers, or rows satisfied only through unapproved alternate wording require a `NON_BLOCKING_STOP` and help request before this same task can resume.
