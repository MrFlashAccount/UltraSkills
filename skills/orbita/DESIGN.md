# Orbita Dashboard Design

## Scope

This document is the durable design contract for the read-only Orbita runs
dashboard and atomic run-inspection v2 surface. It covers the attention-first
board, run detail, truthful occurrence selection, Workflow/Activity/Logs/
Artifacts inspection, artifact preview, responsive containment, focus, motion,
and visible states. It does not define style for other skills.

Implementation must also follow `ARCHITECTURE.md` and
`lib/dashboard/CONTEXT.md`. The approved Direction A HTML/proof assets remain
the visual evidence source; this document records their stable laws rather than
replacing those assets.

## User and product route

Orbita dashboard is an operational inspection surface for expert local users
watching `workflow-runner` and DevHarness runs. It is closed/private tooling,
not a public SaaS product.

The first board read answers what needs attention. The detail read answers:

- where the run is now and how workflow ownership moved;
- which repeated owner occurrence is selected;
- which fanout/shard peers belong to that activation;
- what Activity, managed Logs, and artifacts belong to the occurrence;
- whether evidence is complete, truncated, legacy-unavailable, previewable, or
  download-only.

Primary actions are selecting a run, selecting an occurrence, switching among
Workflow/Activity/Logs/Artifacts, selecting a workflow node, loading bounded
earlier pages, and previewing or downloading an artifact. Search/filter and
closing overlays are secondary. None of these actions mutates runner state.

Forbidden actions include retry, continue, repair, move, bind, write, lease,
drag/drop, manual lane movement, and every other runner-shaped control.

## Selected direction

Direction A is selected for run inspection v2. Direction B and Direction C
detail alternatives are rejected. Direction A composes inside the existing
attention-weighted five-lane board; it does not replace or reorder board lanes.

Board lanes remain observer classification buckets in this order:

1. `Waiting for user`
2. `Worker running`
3. `Needs help`
4. `Degraded`
5. `Done`

The detail hierarchy is fixed and flat:

1. stable run identity and status;
2. compact ordered occurrence selector;
3. exactly four tabs: `Workflow`, `Activity`, `Logs`, `Artifacts`;
4. one selected panel;
5. optional nested artifact preview.

There is no standalone Metadata tab. Safe run metadata belongs above the tabs
or in its relevant panel. Avoid oversized headings, nested cards, decorative
containers, and file splitting that does not own behavior.

## Identity and selection law

Occurrence items use truthful `(stepId, ordinal)` identity and display
`stepId · ordinal`, state, selection, and current status. Repeated visits never
merge. Long safe identifiers truncate in the row while retaining accessible
full text. The ordered selector progressively scrolls or discloses `Show
earlier`; chips, statuses, and controls do not wrap. After initial load,
selection, or earlier-page accumulation, the selector scrolls the exact selected
identity into view without changing selection or stealing document focus.

Occurrence selection scopes only Activity, Logs, and Artifacts. Workflow is
always run-scoped: its graph, zoom/fit controls, node selection, Step Details,
and workflow-step artifact pane neither receive nor reset from occurrence
selection. A partially loaded workflow is visibly incomplete until
both its definition and traversal inputs are complete; accumulated partial data
must never be labeled as a complete graph.

Fanout/shard work appears as peer work nested under its durable activation. It
does not become a workflow occurrence or parallel cursor chip. Legacy ambiguity
renders `legacy_unavailable`; the UI never invents an ordinal or silently shows
an empty/success state. When replayed pages contain the same peer, the newest
durable lifecycle fact wins so pending/accepted/stopped state does not regress.

## Screen zones and composition

The board remains the primary surface and has no decorative outer card. Its
sticky compact top bar owns identity, search/filter, freshness, and bounded run
count. Five attention-weighted lanes own cards and counts. Selecting a card
opens the existing responsive run-detail surface.

Run detail composition has stable responsibilities:

- the outer surface owns desktop/tablet/mobile placement, close behavior, and
  focus return to the originating run card;
- the body owns header, selector, tabs, local query/selection orchestration, and
  panel composition;
- Workflow owns graph interaction independently of occurrence;
- Activity owns durable activation peers and bounded events; it may use a dense
  table where width permits, but narrow/mobile presentation reflows the same
  semantics into contained labeled rows rather than clipping a desktop-width
  table;
- Logs owns bounded managed Markdown with load-older/truncated/end states;
- Artifacts owns the selected-occurrence subset while retaining run aggregate
  count, producer/type/preview/download facts, explicit continuation, and end
  state;
- the local Markdown renderer is shared by Logs and safe Markdown artifacts,
  disables raw HTML, escapes code, and discloses external links;
- the artifact preview overlay owns preview/gallery state and never injects
  active HTML/SVG bytes into the parent React tree.

Repeated table/list/state/overlay scaffolding belongs in named local feature
components or state surfaces. Existing Button, Badge, Tabs, Select/Popover,
Tooltip, Sheet/Dialog, Skeleton, tokens, spacing, and focus conventions remain
the primitive path. No shared primitive or repo-global Markdown renderer is
justified by this slice.

## Product data hierarchy

Board primary facts are lane/status reason, policy-approved title, and age;
workflow identity and one current owner are secondary. Full ids, artifacts,
history, diagnostics, raw paths, commands, prompts, tokens, bindings, and host
metadata do not belong on cards.

Detail primary facts are safe run identity/status, current occurrence, ordered
occurrence identity, and selected evidence. Secondary facts include activation
peers, completeness/truncation, artifact producer/type/preview/download state,
and fixed public errors. Private records, filesystem paths, prompts, tokens,
bindings, raw errors, and unbounded logs never render.

Artifact rows keep id as primary and producer occurrence, type, preview state,
and download state as secondary. Activity rows keep time/source/status/event.
Logs preserve complete managed Markdown entry boundaries. Metadata remains
visible through loading/error/unsupported/download-only states so failure does
not erase identity.

## Card law

Each run card is one semantic selection target keyed by `runId`:

- top line: non-wrapping status/reason and updated age;
- title: policy-approved title or `Untitled run`, at most two lines;
- facts: workflow and zero/one current owner, ellipsized;
- optional short run id only when needed for disambiguation.

Cards use compact 10–12px padding, 7px radius, readable metadata, distinct
hover/selected/focus states, and a minimum 44px target. Selection may use an
inset accent edge; focus-visible remains a separate 2px ring. Do not use raw
debug dumps, arbitrary height, one-letter wraps, inline execution controls, or
index identity.

## Detail overlay and focus law

- At 1100px and wider, detail is a complementary right region, 340–400px and
  at most 34vw. The board stays visible and operable.
- From 760–1099px, detail is a modal right sheet sized `min(420px, 92vw)` with
  backdrop, inert background, and inner scroll.
- Below 760px, detail is a modal bottom sheet, full width and at most 88dvh,
  with safe-area padding, sticky header, and inner scroll.

The outer surface restores focus to the exact originating run card. If that
card vanished, focus returns to its lane header. A filtered/missing selection
keeps its id and never selects a neighbor.

Artifact preview is a nested Radix dialog/gallery. The trusted parent owns
close/download controls, metadata, disclosure, and visible loading/error/
unsupported/oversized/download-only states. Closing preview restores focus to
the exact artifact control that opened it. Escape closes only the top overlay;
closing the outer detail then restores the separate run-card origin.

For active HTML/SVG, disclosure states that the opaque sandbox still permits
artifact scripts and HTTP(S) network access while denying same-origin,
top-navigation, popup, and download capability. Preview chrome remains in the
trusted parent.

Preview state is authoritative before navigation. A typed stale locator is a
recoverable local state that refreshes the descriptor/page and preserves the
selected occurrence; mismatch, unsupported, oversized, legacy, or otherwise
ineligible content stays download-only/unavailable and never opens an empty or
misleading success frame.

Stale paging preserves already loaded evidence while restarting that resource
from page 1 under a fresh process locator. It does not clear the panel, borrow
placeholder data from another run/occurrence, or silently advance selection.
Traversal recovery is owned and rendered once by the occurrence selector;
Workflow must not duplicate a second recovery control for the same traversal
query failure.

Drawer spatial motion is 180ms; preview spatial motion is 140ms. Motion explains
only location/overlay change. Reduced-motion mode uses 0ms/static transitions,
no transform, pulse, or looping indicator.

## Responsive and containment law

Reading order and semantics remain the same at desktop, tablet, and mobile.
The outer sheet changes placement, not information architecture. The occurrence
selector scrolls/discloses progressively inside the sheet. Tabs, chips, badges,
pills, statuses, and buttons never wrap. Long ids ellipsize with accessible
full text; bounded opaque values may break only inside contained code regions.

The page must not overflow horizontally. Inner graph, selector, log, and gallery
regions own bounded overflow. Activity changes presentation at narrow widths
instead of keeping a clipped minimum-width table. Narrow layouts keep Waiting,
Needs help, and Degraded attention visible; secondary filters move into one
Filter popover.

Occurrence rows have at least 40px targets; compact primary controls have at
least 44px targets. Keyboard traversal follows visual order, focus is always
visible, live updates do not steal focus, and query/page replacement does not
silently reset run, occurrence, tab, graph node, or overlay origin.

## Visual system

Use the existing warm graphite, Catppuccin Mocha-derived dark system:

- app `#14131A`; top/detail `#191720`; lane `#201D29`; card `#292632`;
  selected `#332F40`;
- primary/body/metadata text `#F4F0F7`; disabled/unavailable only `#AFA6BA`;
- border `#4A4357`; strong divider `#5C536A`; focus/running `#CBA6F7`;
- Waiting `#FAB387`; Needs help `#F38BA8`; Degraded `#9A92A8`; Done
  `#A6E3A1`.

Foundation brightness progresses page < top/detail < lane < card < selected.
Semantic color is paired with text/icon/shape and never carries meaning alone.
Use sans-first dense type, monospace only for ids/steps, the 4/8/12/16/24px
spacing scale, 10–12px gaps, 6–8px radii, flat separators, and readable
non-muted metadata. Avoid marketing spacing, saturated panels, novelty mood,
and decorative nesting.

## Required states

Distinct visible states are mandatory:

- initial/detail loading and panel-local loading;
- true empty versus filtered empty;
- first-load error, local panel/preview error, and last-good stale recovery;
- `legacy_unavailable` and missing occurrence selection;
- partial/truncated/load-more/end and stale cursor recovery;
- unsupported, oversized, disabled, MIME-mismatch, and download-only content;
- preview loading/success/error;
- long/pathological identifiers;
- one corrupt Degraded run among healthy runs;
- filtered/missing run selection without fallback.

Failed data never looks empty or successful. Local failure preserves the board,
other tabs, stable identity, and recoverable metadata. Copy must remain
inspection-oriented and avoid execution language such as `retry run`, `repair`,
or `continue`.

Query placeholder/previous data is scoped to the exact schema version, run,
resource, occurrence/artifact ref, and cursor. Opening another run must not show
the previous run's detail, selection, evidence, or preview while its own request
is pending.

## Performance and proof contract

The board retains independent lane virtualization with stable `runId` keys and
the approved 1,000-run responsiveness gates. Run inspection adds these hard
proof requirements:

- desktop, tablet, and mobile Direction A layouts;
- the six-moment operations storyboard;
- Activity, Logs, and Artifacts selected-occurrence panels;
- loading/empty/error/legacy/stale/truncated/unsupported/long-id state matrix;
- independent drawer/preview focus origins, Escape stack, keyboard access, and
  reduced motion;
- repeated traversal proving occurrence identity and Workflow independence;
- large workflow progressive loading without presenting a partial graph as
  complete.

Approved visual evidence names are `ui-selected-desktop`,
`ui-selected-mobile`, `ui-tablet`, `ui-operations-storyboard`, `ui-activity`,
`ui-logs`, `ui-artifacts`, `ui-state-matrix`, `ui-interaction-proof`, and
`ui-repeated-traversal`, with `ui-direction-a` as the selected comparison frame.

Implementation recapture evidence lives under `ui/e2e/proof/` and uses the
`v2-board-{desktop,mobile}`, `v2-direction-a-{desktop,tablet,mobile}`,
`v2-activity-{desktop,mobile}`,
`v2-logs-{desktop,mobile}`, `v2-artifacts-{desktop,mobile}`,
`v2-artifact-paging-{desktop,mobile}`, `v2-stale-paging-{desktop,mobile}`,
`v2-preview-{desktop,mobile}`, `v2-artifact-recovery-{desktop,mobile}`,
`v2-focus-return-{desktop,mobile}`, and
`v2-artifacts-long-id-{desktop,mobile}` files. These are implementation proof,
not replacements for the approved Direction A comparison assets.

Acceptance requires visible focus, deterministic dual focus return, no page
overflow, no clipped/wrapped compact controls, explicit state truth, stable
selection during updates, and fidelity to Direction A. Architecture or source
reality conflict requires approved plan revision; do not redesign locally.

## Hard nos

- no mutation/control affordance, drag/drop, or manual lane movement;
- no automatic first/neighbor run or occurrence selection;
- no occurrence-scoped Workflow or merged repeated identities;
- no fabricated legacy ordinal or fanout/shard trail occurrence;
- no raw debug/durable/private content or browser path authority;
- no active artifact bytes injected into the parent DOM;
- no same-origin active preview, popup/top-navigation/download sandbox power;
- no nested-card hierarchy, novelty theme, page-level overflow, or wrapping
  chips/tabs/buttons;
- no looping decorative animation or motion-only meaning.

## Downstream review

Frontend implementation and frontend-taste review compare rendered proof with
the approved Direction A assets. Architecture review compares this document,
`ARCHITECTURE.md`, dashboard `CONTEXT.md`/`README.md`, persistence/artifact
contracts, schemas/routes/tests, and implementation. Contract drift is
blocker-level.
