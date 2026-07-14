# Dashboard context

`lib/dashboard/**` owns the read-only Orbita observer application. It reads
durable workflow-runner state, projects versioned and disclosure-safe read
models, and renders the attention-first board plus run-inspection v2 through
one Bun-served TanStack Start deployment.

This context implements the dashboard section of `../../ARCHITECTURE.md`, uses
`../../DESIGN.md` as its visual/interaction contract, and documents its
supported developer/runtime surface in `README.md`.

## Source zones and ownership

- `contracts/**` owns strict browser-safe schemas and types for schema version
  2: snapshots, light detail, workflow/traversal/activity/log/artifact pages,
  occurrence and artifact references, page cursors, preview state, invalidation,
  and fixed public errors. `contracts/index.ts` is the only shared
  server/browser dashboard barrel.
- `projection/**` owns pure read-model projection: lane classification,
  disclosure policy, light detail, declaration-ordered workflow pages,
  occurrence/activation grouping, managed-history Activity and Logs, and
  artifact descriptor/preview classification. It receives validated records or
  bounded buffers and performs no IO.
- `observer/**` owns read-only durable adapters, bounded-concurrency reads,
  per-run failure isolation, the process-local `DashboardReadModel`, watcher and
  periodic reconciliation, immutable snapshot replacement, freshness,
  invalidation subscriptions, bounded history pagination, verified artifact
  content handles, and idempotent close behavior. It is server-only.
- `ui/src/server/**` owns validated process configuration and the one
  server-only composition root. Process configuration is the only runs-root
  authority.
- `ui/src/routes/api.dashboard.v2.*` owns only HTTP/SSE framing, host/origin and
  Fetch Metadata gates, ETag/range/content headers, method/status handling, and
  fixed public envelopes. Routes receive observer capabilities through server
  composition and do not project or read files directly.
- Browser-reachable `ui/src/routes/**`, `ui/src/app/**`, `ui/src/features/**`,
  `ui/src/components/**`, `ui/src/lib/**`, and `ui/src/styles/**` own Query and
  Router state, invalidation adapters, accumulated pages, run/occurrence
  selection, virtualization, focus, responsive overlays, primitives, and
  rendering.
- Root Bun scripts are the only supported dashboard command surface.
  `lib/entrypoints/**` must not export or wrap dashboard serve/API functions.

These zones own real behavior. Deleting `contracts` duplicates the cross-runtime
schema; deleting `projection` smears truth/disclosure rules into adapters and
routes; deleting `observer` smears bounded durable reads and content policy into
transport; deleting `ui` removes the product and Start deployment. Do not add a
generic repository, cache, preview service, renderer framework, or ownerless
shared utility zone for this concrete observer.

## Public and runtime contracts

- Dashboard code is read-only. It must not write provenance, run state, Baton,
  history, artifacts, or authority; acquire/refresh leases; advance cursors; or
  call repair, retry, pointer, or output commands.
- Durable run files are authoritative. `DashboardReadModel` is ephemeral and
  fully rebuildable; it never persists dashboard cache, cursors, degraded state,
  preview state, or occurrence selection.
- Board snapshot refreshes load per-run state with `includeHistoryText:false`
  and read zero history-body, workflow-body, and artifact-content bytes. Light
  detail may read only bounded recent traversal facts. Workflow, traversal,
  Activity, Logs, artifact descriptors, and artifact content are independent,
  cancellable lazy capabilities.
- Occurrence identity is the durable cursor-owner pair `(stepId, ordinal)`.
  Repeated self/backward traversal remains distinct. Fanout/shard peers group
  below their owning activation and never become owner occurrences. A seeded
  legacy current cursor remains `legacy_unavailable`. Successful forward routes
  persist `firstAvailableByStep` boundaries for newly observed visits; those
  boundaries never move backward to expose the inherited seed. The dashboard
  never scans old history, calls a seeded occurrence covered, or fabricates an
  ordinal.
- Workflow projection preserves declaration order and stays independent of the
  selected occurrence. A partial workflow page set is explicitly incomplete.
  Selecting an occurrence changes only Activity, Logs, and the occurrence-scoped
  Artifacts tab; Workflow step artifacts follow the graph's selected `stepId`.
- Activity and Logs are distinct managed-history projections. Paging preserves
  complete entry boundaries and exposes truncation separately from completion.
  Logs construct positive Markdown from allowlisted structured v2 facts; raw
  history details, stdout/stderr, and `debug-summary.md` bodies are not browser
  log or activity sources.
- Aggregate artifact identity is `(ownerStepId, ownerOccurrence,
producerRequestId, artifactId)`. Artifact pages require exactly one scope:
  `occurrenceRef` for the Artifacts tab or workflow `stepId` for the Workflow
  pane. They have separate scope-bound cursors and no run-wide form. Browser
  artifact references are restart-stable sealed locators, not filesystem
  authority. Every descriptor/content request is revalidated against canonical
  aggregate metadata and the accepted file stamp. Legacy wrappers remain
  descriptor-visible as `legacy_unavailable` but have no artifact ref or content
  capability.
- Degraded dashboard state describes observer/read health only. It is ephemeral
  and never becomes workflow state or a terminal result.
- SSE is lossy invalidation, not state. Connected clients cannot create
  backpressure into workflow execution or make runner writes depend on UI state.

## Versioned HTTP surface

The application root and these nine version-2 GET resources are the complete
supported dashboard surface:

- `/api/dashboard/v2/runs` — validated snapshot with authoritative freshness
  and conditional ETag support.
- `/api/dashboard/v2/events` — data-free invalidation SSE plus heartbeats.
- `/api/dashboard/v2/runs/:runId` — light run detail.
- `/api/dashboard/v2/runs/:runId/workflow` — declaration-ordered workflow page.
- `/api/dashboard/v2/runs/:runId/traversal` — occurrence/activation page.
- `/api/dashboard/v2/runs/:runId/activity` — selected-occurrence Activity page.
- `/api/dashboard/v2/runs/:runId/logs` — selected-occurrence managed Markdown
  page.
- `/api/dashboard/v2/runs/:runId/artifacts` — artifact descriptor page plus run
  aggregate count, requiring exactly one `occurrenceRef` or workflow `stepId`.
- `/api/dashboard/v2/runs/:runId/artifacts/:artifactRef?mode=preview|download`
  — verified preview or download content.

Version 1 routes/contracts/client references are `delete_now`: there are no
aliases, redirects, mixed versions, or unversioned fallbacks. Server and browser
contracts ship atomically under schema version 2.

Refs and cursors are deterministic authenticated-encrypted values with a
512-character ceiling. The sealing key derives from the configured canonical
runs-root location and directory identity, so locators survive normal process
restart without server-side registry state; moving or replacing that authority
intentionally invalidates them. Workflow cursors resolve to a content
fingerprint; history cursors resolve to an immutable file snapshot and backward
byte position; artifact cursors resolve to exactly one occurrence or workflow
step; artifact refs resolve to canonical aggregate identity. Malformed,
overlong, cross-authority, cross-run, cross-route, cross-scope, stale, replaced,
shrunk, or forged locators fail with fixed public errors and never reveal paths,
offsets, file identity, or raw exceptions.

Approved response/content bounds are:

- snapshot: 1.5 MiB;
- light detail, traversal, Activity, Logs, and artifact pages: 64 KiB;
- workflow page: 256 KiB and at most 200 steps;
- traversal: at most 100 occurrences; Activity: at most 200 events; artifacts:
  at most 100 descriptors;
- text/Markdown content: 1 MiB; active HTML/SVG: 2 MiB; raster/PDF: 32 MiB;
  audio/video: 64 MiB; MIME probe: 8 KiB.

History pagination returns whole managed entries under byte and entry-count
limits, remains stable across append, rejects shrink/replacement, and reports
`complete`, `truncated`, and `nextCursor` without conflating them. Artifact
content is reopened through the canonical occurrence/request directory handle,
read as exactly the accepted bounded byte length, restatted, and served only
from the resulting immutable snapshot after the filesystem handle closes. The
shared descriptor/content MIME and size policy is applied before exposure.
PDF/audio/video/download support one valid Range; malformed, multiple, or
unsatisfiable ranges return fixed 416, and both full and Range responses slice
the same snapshot so concurrent growth cannot bypass the accepted class limit.

Traversal reads at most 100 source entries, Activity at most 11 source entries
before its 200-event DTO ceiling, and Logs at most 200 source entries. Workflow
reads reject files above 8 MiB and fingerprint/parse one verified no-follow file
snapshot; a route cannot fingerprint one identity and parse another.

## Trust and disclosure boundary

Process configuration, never browser input, selects the runs root. Run ids,
occurrence refs, artifact refs, and cursors select only allowlisted read-model
resources after exact schema validation; none selects a path.

Private JSON/data routes require the configured Host authority, permit only the
request URL's same origin when Origin is present, and require an exact
same-origin Fetch Metadata shape. They reject `Origin: null`, cross-site
requests, document/iframe/image/script navigation, duplicate parameters, and
unknown query fields. Only an eligible canonical preview content request
accepts same-origin iframe navigation.

Browser-visible prose is source-classified, bounded, normalized, and
disclosure-filtered. Raw Baton/history, paths, roots, instructions, prompts,
transcripts, credentials/tokens/hashes, commands, bindings, host/worker metadata,
and raw errors never enter DTOs, fixtures, logs, or the client bundle.

Artifact content is reopened and revalidated as a contained regular file using
its accepted device/inode/size/mtime/ctime stamp. Descriptor and transport use
the same preview-state and class-limit policy. Declared/effective MIME mismatch
is download-only; mismatch, unsupported, oversized, and legacy content cannot
be previewed through a direct URL. Responses use exact content type, `nosniff`,
safe disposition, `no-store`, no-referrer, ETag/file stamp, and fixed errors.
Active HTML/SVG runs only in a nested opaque-origin sandbox with CSP; it has no
same-origin, top-navigation, popup, or download capability. It may still execute
scripts and contact HTTP(S) network resources; the trusted parent discloses that
capability, owns preview controls, and never injects active bytes into its React
tree.

## Reconciliation and request authority

`DashboardReadModel` owns the last-good immutable board snapshot and observer
freshness. Initial failure is explicit; a later failure retains last-good cards,
preserves the original stale boundary, advances freshness/ETag, and remains
stale until a successful refresh. One corrupt run becomes one Degraded summary
without hiding healthy runs.

Invalidation events remain data-free and may be dropped, duplicated, delayed,
reordered, or reset. The browser reconciles through validated GETs and periodic
snapshot refresh. EventSource connectivity alone never proves Live.

Request authority is split deliberately: process configuration owns the runs
root; snapshot revision owns board/freshness; the exact `run` search value owns
run selection; local run-detail state owns selected occurrence and tab; the
Workflow pane independently owns selected `stepId`. Each query key includes
schema version, run id, resource, exact occurrence or workflow-step artifact
scope, relevant ref, and cursor. Cancellation propagates to fetch aborts.
Missing or filtered selection is preserved and never falls back to a neighboring
run. Placeholder/previous data must match that exact key and must not cross a
run, occurrence, or workflow-step boundary. A stale paging token preserves
accumulated evidence and restarts only that resource from page 1 with freshly
derived locators.

## Binding dependency rules

- `contracts/**` must not import projection, observer, UI implementation,
  persistence, entrypoints, or Node-only modules.
- `projection/**` may import contracts and validated plain records/bounded
  buffers. It must not import filesystem/process APIs, observers, routes,
  watchers, leases/locks/writers, control/mutation use cases, or UI modules.
- `observer/**` may import contracts, projection, approved read-only persistence,
  and Node read/watch/content APIs. It must not import writers, lease/claim/
  heartbeat code, runner mutation/control APIs, CLI shells, host lifecycle, or
  browser/UI modules.
- API routes may reach observer code only through
  `ui/src/server/dashboard-composition.server.ts`. They do not classify,
  project/redact records, parse durable state, select paths, or return raw
  errors.
- Client-reachable code must not import observer, projection, persistence,
  entrypoints, runtime/use-cases/entities, Node built-ins, process environment,
  or `.server.ts` modules.
- No dashboard module may import, execute, shell out to, expose, or construct
  `next`, `continue`, `write-output`, `instructions`, pointer recovery,
  claim/lease/heartbeat/bind-agent, repair/retry, writers, or manual move.

`.dependency-cruiser.cjs` enforces these rules. Production client-bundle
inspection independently proves that Node/server/private/control material is
absent after bundling.

## Compatibility and review gates

HTTP/contracts v1 and the retired vanilla/CLI/static-server surface are
`delete_now`. Provenance-free runs are the only temporary public exception:
summaries and legacy descriptors stay readable with explicit
`legacy_unavailable`, but inherited occurrence panels and unstamped artifact
content do not gain refs. There are no alias paths, rewritten bytes, fabricated
identity, or bulk migration.

Review must prove:

- root plus exactly nine v2 GET resources, with no v1/unversioned aliases;
- zero history-body/workflow/artifact bytes on board snapshot refresh;
- bounded/cancellable pages, stable cursors, exact occurrence and activation
  ordering, explicit partial/end/legacy states, and fixed public errors;
- canonical file-handle/race/MIME/range/header behavior and the full origin plus
  Fetch Metadata matrix;
- contracts -> pure projection -> observer -> server composition -> routes ->
  browser dependency direction and absence of control/private material;
- Direction A hierarchy, occurrence selection scope, Workflow independence,
  focus restoration, responsive containment, reduced motion, and state proof;
- drift-free agreement across source, schemas, tests, `ARCHITECTURE.md`,
  `DESIGN.md`, this file, `README.md`, run-state context, and artifact contract.

Green tests do not override a missing negative check, compatibility residue,
browser disclosure leak, unsafe active preview, or contract/docs drift.
