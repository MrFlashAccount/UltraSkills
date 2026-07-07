# <Project/Issue> UI Intent Contract — <Surface>

Use this after approved research and before architecture when a task may affect user-facing UI. This is a product-surface contract, not code architecture and not durable design law.

## Artifact Metadata

- Owner:
- Date:
- Source artifacts:
- UI gate decision: Applicable | Not applicable
- Reason:

## Source Research

<Link or summarize the approved research requirements and evidence that shape the UI surface. Do not add new implementation scope.>

## UI Applicability

State whether this task needs a UI intent gate.

- **Applicable** when the task creates or materially changes screens, flows, visible states, navigation, forms, lists/tables/cards, overlays, interaction patterns, visual hierarchy, density, or user-facing copy that affects task comprehension.
- **Not applicable** when the task is backend-only, non-UI plumbing, trivial copy, invisible bug fix, or preserves an existing UI shape with no meaningful surface decision.

## User Task

- Primary user:
- User job:
- Primary action:
- Secondary actions:
- Success signal:

## Screen / Surface Structure

| Zone | Purpose | Primary content/actions | Notes / constraints |
| --- | --- | --- | --- |
| <toolbar/header/filter/list/detail/form/dialog/etc.> | <why this zone exists> | <what it must contain> | <constraints, if any> |

## First Read / Hierarchy

- What the user should understand in the first 3 seconds:
- Most important visual/action priority:
- Secondary information:
- Dangerous or irreversible actions:
- What must not compete for attention:

## Required States

| State | Required surface behavior | Recovery / next action |
| --- | --- | --- |
| Loading / pending | <visible expectation> | <if any> |
| Empty | <visible expectation> | <one clear next action> |
| Error | <visible expectation> | <retry/recovery> |
| Success / confirmation | <visible expectation> | <if any> |
| Disabled / permission / partial data | <visible expectation> | <if relevant> |

## Interaction Expectations

- Navigation / routing:
- Forms / validation:
- Modal / drawer / popover / menu behavior:
- Keyboard / focus expectations:
- Responsive expectations:
- Motion expectations:

## Design Basis

- Existing `DESIGN.md` / design memory:
- Existing UI/screens/components to preserve:
- References or product examples, if used:
- Density / tone:
- Missing or weak design-law areas:

## Open UI Tensions For Architecture

List UI constraints architecture must preserve without deciding visual taste:

- <state ownership pressure, route/state tension, data dependency, interaction edge case, or surface constraint>

## Non-goals

- <What this UI intent does not decide, especially file paths, component filenames, hooks, storage boundaries, or durable design-law changes.>

## Template Rules

- Do not define code structure, file paths, component names, hooks, or state-storage ownership; architecture and planning own those.
- Do not author or repair `DESIGN.md`; if durable design law is missing and required, return blocked/reroute instead of guessing.
- Keep the contract concrete enough that architecture and planning can preserve the intended surface without inventing UI from scratch.
