# Orbita Dashboard Design

## Scope

This document is the durable design contract for the read-only Orbita runs
dashboard from issue #201. It applies to the dashboard board, toolbar, run
cards, freshness/state surfaces, responsive detail, and supporting run-
observation UI. It does not define visual style for other skills.

Implementation must also follow `ARCHITECTURE.md` and
`lib/dashboard/CONTEXT.md`. The approved UI proposal remains the visual proof
source; this document records the selected direction and stable laws rather
than replacing that artifact.

## User and Product Route

Orbita dashboard is an operations surface for watching live `workflow-runner`
and `dev-harness` runs.

Audience:
- expert local users running multiple Codex/Orbita sessions
- closed/private tooling, not a public SaaS product

Primary read:
- what needs attention right now
- which runs are waiting for a human, which are executing worker actions, which
  need help, are done, or are degraded

The primary job is to identify Waiting, Needs help, and Degraded work in
seconds, inspect one run, and return to the same board position without causing
or implying mutation.

Primary action:

- select one run for read-only inspection.

Secondary actions:

- search and filter;
- expand or collapse a lane on narrow layouts;
- copy a policy-approved run id from detail;
- close detail and return focus.

Columns are host-action/status buckets, not workflow steps:
- `Waiting for user`
- `Worker running`
- `Needs help`
- `Degraded`
- `Done`

Forbidden actions include retry, continue, repair, move, bind, write, drag/drop,
manual lane movement, and every other runner-shaped control. The surface is not
a table, chart wall, workflow editor, graph-first navigator, marketing page, or
decorative cockpit.

## Selected Direction

Use Direction B: an attention-weighted five-lane Kanban. Lanes are observer
classification buckets, not mutable workflow steps, and remain in this order:

1. `Waiting for user`
2. `Worker running`
3. `Needs help`
4. `Degraded`
5. `Done`

Waiting and Running receive a modest width advantage without hiding or
reordering any lane. Done remains present with lower border/surface emphasis,
never reduced text readability. Lane placement and count must communicate
status faster than repeated card copy.

Current runtime cursor truth is `0..1`. Cards and detail render at most one
current step. An array-shaped DTO may remain internal, but multiple values are a
bounded unsupported/degraded state, never parallel cursor chips or fanout
semantics. A future durable multi-cursor runtime requires a separate approved
design change.

## First Read and Screen Zones

The visual and semantic hierarchy is:

1. freshness/connection only when unhealthy;
2. stable lane order and counts, especially Waiting, Needs help, and Degraded;
3. card status reason and bounded title;
4. workflow, current step, and age;
5. detail only after selection.

Screen zones:

- sticky compact top bar: Orbita identity, search, filters, quiet freshness,
  and bounded run count;
- board: five attention-weighted rails with sticky headers and independent
  vertical scrolling/virtualization;
- wide contextual right detail: complementary, non-modal inspection;
- tablet/mobile detail: non-modal right sidebar that may cover the board only on
  the narrowest viewport;
- narrow attention summary and stacked lane disclosures;
- global feedback/live region for load, connectivity, and reclassification.

The board is the surface; do not wrap it in a decorative outer card.

## Product Data Hierarchy

Lane primary facts are stable label, semantic text/icon/color cue, and filtered
count. Classification internals stay hidden.

Run card primary facts are status/reason, policy-approved title, and age.
Workflow identity and one current step are secondary. A shortened run id appears
only when needed for disambiguation. Full id, artifacts/results/history,
diagnostics, raw paths, commands, prompts, tokens, bindings, and host metadata
do not belong on the card.

Run detail primary facts are safe identity, lane/status, workflow, current step,
and freshness. A compact ordered step path sits above the tabs. Workflow remains
the full authored graph and does not react to step selection. Activity, Logs,
and Artifacts are scoped by the selected existing workflow step. Managed
Markdown is formatted through the safe renderer; image artifacts use a gallery,
and all supported artifacts have a contained preview/download viewer. Raw
Baton/history/transcript, filesystem paths, token/hash or command text, and
private host/worker metadata never render.

Connection UI answers whether the board is trustworthy. Healthy/live is quiet;
stale/reconnecting is explicit. Transport stack traces and raw events stay
hidden.

## Card Law

Each run card is one semantic selection target with this anatomy:

- top line: status/reason chip and updated age; one line, chip at most 55%, age
  never wraps;
- title: policy-approved title or `Untitled run`; maximum two lines,
  14px/600 at 1.3 line height;
- facts: workflow and zero or one current step; two compact label/value rows,
  values ellipsize;
- optional footer: shortened run id only when needed; monospace and one line.

Visual contract:

- radius 7px;
- padding 10–12px;
- lane width 240–340px;
- target card height 112–144px, with measured virtualization for exceptions;
- hover changes surface/border;
- selected uses `card selected` surface plus inset focus-color border;
- focus-visible uses a distinct 2px outer focus ring with 2px offset and may
  coexist with selection;
- card minimum target is 44px.

Do not use nested cards, accent-only left borders, raw debug dumps, full
unbounded ids, arbitrary card growth, one-letter wraps, inline execution
buttons, or index identity. `runId` is the card, selection, ordering, query, and
virtual item identity.

## Detail Law

No selection means no drawer/sheet and no reserved blank rail. The board uses
the available width; a subtle toolbar hint may invite inspection.

- At 1100px and wider, detail is a non-modal complementary right region with
  internal scrolling. The board remains
  visible, operable, and not inert. Focus enters the heading/close target but is
  not trapped; normal navigation and Shift+Tab may return to the board.
- From 760–1099px, detail remains a non-modal complementary right region. There
  is no backdrop and the board is not inert.
- Below 760px, detail uses the full available width with safe-area padding,
  sticky header, and inner scroll. It is still an `aside`, not a dialog; explicit
  close and Escape are supported.

Escape while focus is within detail or explicit close returns focus to the
originating card. If that card vanished, focus returns to its lane header. A
filtered or missing selection keeps its id and displays `This run is no longer
in the current results`; it never selects a neighbor.

The sidebar opens without modal-sheet motion. Missing-selection content may
crossfade at most 100ms. Reduced-motion mode changes visibility instantly.

## Responsive and Containment Law

- At 1440px and wider, all five lanes are visible with detail closed. Direction
  B attention widths apply.
- From 1100–1439px, the first three or four lanes remain visible and the board,
  not the page, may scroll horizontally.
- From 760–1099px, lanes use stacked or two-column sections and selected detail
  remains a non-modal right sidebar.
- Below 760px, lanes are one-column disclosures in the same order. Every
  non-empty Waiting, Needs help, and Degraded lane starts expanded and is repeated
  in an always-visible attention summary. Running and Done alone may start
  collapsed. Selected detail takes the available viewport width.

Page-level horizontal overflow is forbidden. Counts remain visible for
collapsed lanes. Secondary filters move into one Filter popover on narrow
layouts.

Buttons, tabs, segmented controls, status chips, badges, counts, and lane
headers never wrap. Shorten or ellipsize, use an accessible named icon, or move
secondary controls to overflow. Workflow, step, and short id use one line with
ellipsis. Drawer prose wraps at words; bounded opaque values may break inside a
contained code region.

## Visual System

Use a warm graphite, Catppuccin Mocha-derived dark system:

- app foundation: `#14131A`;
- top bar/detail: `#191720`;
- lane: `#201D29`;
- card: `#292632`;
- selected card: `#332F40`;
- primary/body/metadata text: `#F4F0F7`;
- disabled/unavailable text only: `#AFA6BA`;
- border: `#4A4357`;
- strong divider: `#5C536A`;
- focus/running: `#CBA6F7`;
- Waiting: `#FAB387`;
- Needs help: `#F38BA8`;
- Degraded: `#9A92A8`;
- Done: `#A6E3A1`.

State roles:
- waiting for user: `#FAB387` or `#F9E2AF`
- worker running: `#CBA6F7` or `#B4BEFE`, never cyan-first
- needs help: `#F38BA8`
- degraded: `#9A92A8`
- done: `#A6E3A1`

Foundation brightness progresses page < top/detail < lane < card < selected.
Semantic color never carries meaning alone; pair it with text and an icon or
shape. Accents are state markers, not decoration. Avoid blue/cyan as the product
mood and preserve WCAG 2.2 AA contrast.

Typography is sans-first and dense: page 18–20px/700, lane 13px/700, card title
14px/600 at 1.3, body 13px/1.45, metadata 11–12px at full readable contrast.
Monospace is limited to ids and steps. Do not create hierarchy by dimming small
text.

Use the 4/8/12/16/24px spacing scale, 10–12px lane gaps, and 6–8px radii. Avoid
marketing spacing, large empty areas, saturated panels, novelty branding, and
unused generated UI-kit components.

## UI Kit and Interaction Inventory

Use source-owned shadcn/ui components on approved Radix primitives, Tailwind
CSS variables, and Lucide icons. Prefer semantic native controls. Add only
primitives used by the product: Button, Input, Badge, Sheet/Dialog, Popover,
Select, Tooltip, Skeleton, and Collapsible. Native overflow is preferred;
ScrollArea requires concrete evidence that native overflow is insufficient.

Icon roles:

- Search for search;
- Filter for filter menu;
- Wifi/WifiOff for transport state;
- ChevronDown/Up for narrow disclosure;
- X for close;
- Copy for safe run id copy;
- CircleAlert for Needs help/Degraded support;
- Check for Done;
- LoaderCircle for Running, static under reduced motion.

Compact icon buttons have at least a 36px hit area and an accessible name.
Keyboard order is toolbar, lanes/cards in visual order, then complementary
detail. Virtualized navigation scrolls a logical offscreen run into the mounted
range before focus; offscreen runs are never skipped. Live updates do not steal
focus or selection. Reclassification keeps detail open, announces the new lane
politely, and does not move keyboard focus.

Only drawer/sheet orientation and 100–120ms surface/focus transitions animate.
Live changes never pulse or loop. Reduced-motion indicators are static.

## Required States and Copy

Degraded:
- one unreadable run must appear as degraded without crashing or hiding other
  runs
- degraded is observer/read health, not the same as a workflow request needing help

Needs help:
- needs help is an active request lane, not a workflow terminal state
- show the bounded non-blocking stop summary when available

Required distinct states:

- stable lane-shell loading skeletons;
- first-load failure: `Could not load runs` with transport-only `Try again`;
- `Runs root is not configured`;
- `No runs yet`;
- `No runs match these filters` with `Clear filters`;
- empty individual lane;
- stale/reconnecting last-good board: `Reconnecting · last update {age}`;
- one corrupt Degraded run among usable healthy runs;
- drawer-local `Run details unavailable`;
- missing/filtered selection with `Back to board`;
- unsupported multiple-cursor input;
- Done and zero-result states.

Failed data never looks empty or successful. Stale state does not replace the
last-good board with a destructive full-screen error. Avoid execution language
such as `retry run`, `repair`, or `continue`.

## Performance and Proof Contract

Each expanded lane owns one independent vertical TanStack Virtual instance with
stable runId keys, measured exceptional rows, and at most eight overscan items
before and after the visible range.

At 1,000 runs:

- at most 150 RunCard elements are mounted;
- the board becomes interactive within 2 seconds p95 after process readiness;
- one validated snapshot reconciles within 100ms p95 on the main thread;
- a 100-change burst introduces no task longer than 50ms.

Proof fixtures include balanced lanes, 900 Waiting, 900 Done, long allowed
text/id, rapid reclassification, detail open, and narrow layout.

Required rendered evidence:

- 1440x900, balanced distribution, detail closed and open;
- 1024x768, selected run and filter open;
- 390x844, attention summary, attention lanes expanded, Running/Done collapsed,
  and full-width non-modal detail;
- pathological density;
- initial error, empty root/result, stale/reconnect, corrupt run, detail failure,
  and missing selection;
- keyboard-only navigation and reduced motion.

Acceptance requires visible focus, reachable virtual items, deterministic focus
return, no page overflow, no clipped compact controls, no attention lane hidden
by default on mobile, bounded mounted nodes, stable scroll/focus during updates,
and fidelity to Direction B. Architecture or implementation conflict requires
approved plan revision; do not silently redesign or weaken the proof gate.

## Hard Nos

- no mutation/control affordance, drag/drop, or manual lane movement;
- no automatic first/neighbor selection;
- no parallel active cursor chips under the current runtime;
- no raw debug/durable/private content;
- no chart/graph/table as the primary surface;
- no novelty theme, aviation metaphor, decorative outer card, or fake metric;
- no page-level horizontal overflow, unbounded card, or index-keyed virtual row;
- no browser-side run-root/filesystem read;
- no looping decorative animation or motion-only meaning.

## Downstream Review

Frontend implementation and frontend-taste review must inspect the approved UI
proposal directly and compare rendered proof. Architecture review must compare
this document, `ARCHITECTURE.md`, dashboard `CONTEXT.md`, routes/schemas/tests,
and implementation. Contract drift is blocker-level.
