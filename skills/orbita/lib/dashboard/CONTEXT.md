# Dashboard context

`lib/dashboard/**` owns the read-only Orbita observer application. It reads
durable workflow-runner state, projects versioned and disclosure-safe DTOs, and
renders the attention-first board through one Bun-served TanStack Start
deployment.

This context implements the dashboard section of `../../ARCHITECTURE.md`, uses
`../../DESIGN.md` as its visual/interaction contract, and documents its
supported developer/runtime surface in `README.md`.

## Source zones and ownership

- `contracts/**` owns strict Zod schemas, inferred browser-safe types, schema
  versions, lane/event/error constants, identifier bounds,
  `PublicDisplayText`, and adversarial contract fixtures. It is the only shared
  server/browser dashboard zone.
- `projection/**` owns lane classification, source-specific exposure policy,
  fixed public diagnostics, safe summary/detail projection, authored workflow
  pages, step-path reconstruction from existing managed history, step-scoped
  Activity/Logs, and artifact descriptor projection. It is server-only.
- `observer/**` owns read-only durable adapters, bounded-concurrency reads,
  per-run failure isolation, the process-local `DashboardReadModel`, watcher and
  periodic reconciliation, immutable snapshot replacement, freshness lifecycle,
  invalidation subscriptions, and close behavior. It is server-only.
- `ui/src/server/**` owns validated process configuration and the one server-only
  composition root for the observer lifecycle.
- `ui/src/routes/api.dashboard.v2.*` owns only HTTP/SSE framing, ETag and
  conditional responses, same-origin headers, method/status handling, and fixed
  public error envelopes. Route code does not own domain/projection policy.
- `ui/src/routes/{__root.tsx,index.tsx}`, `ui/src/app/**`, `ui/src/features/**`,
  `ui/src/components/**`, `ui/src/lib/**`, and `ui/src/styles/**` own browser
  composition, Query/Router state, invalidation adapters, derived board state,
  virtualization, focus/selection, responsive detail, primitives, and rendering.
- Root Bun scripts are the only supported dashboard command surface.
  `lib/entrypoints/**` must not export or wrap dashboard serve/API functions.

Do not add a root dashboard barrel that mixes browser-safe and server-only
exports. Do not add generic repositories, service ports, or shared utility
folders for the one concrete observer/deployment.

## Public and runtime contracts

- Dashboard code is read-only. It must not write run directories, mutate baton
  or history, acquire or refresh leases, advance workflow cursors, or repair
  run state.
- Pointer recovery remains a runner control-plane concern. Dashboard code must
  not call, wrap, expose, or provide controls for the `listPointerTransitions` /
  `movePointer` API functions or the `list-pointer-transitions` /
  `move-pointer` CLI modes, and must not display lease-required recovery
  metadata as a browser action surface.
- `contracts/**` is the shared source for the browser-visible DTO surface. The
  server, projection, UI fixtures, and renderer must agree on the same list,
  detail, event, workflow, traversal, Activity, Logs, artifact, cursor, and
  preview shapes.
- `projection/**` may read validated records and plain values supplied by
  adapters, then return allowlisted DTOs. It must not parse CLI arguments,
  inspect process state, perform filesystem IO, or call runner mutation/control
  use cases.
- `server/**` may perform read-only filesystem/API/static IO and response
  formatting. It must route all browser-visible run data through the safe
  projection/contract boundary. It may read the validated per-run authority
  record to overlay canonical status and occupancy, but must not import or call
  its writer/update operations.
- `ui/**` must depend only on browser APIs and dashboard DTO contracts. It must
  not import Node filesystem modules, persistence adapters, workflow-runner API
  shells, CLI modules, use cases, or entity internals.
- Degraded dashboard state describes observer/read health only. It must stay
  ephemeral and must not be persisted as workflow state or represented as a
  terminal workflow result unless durable state is actually terminal.
- SSE updates are observational and lossy. Connected clients must not create
  backpressure into workflow execution or make runner writes depend on UI state.

The only dashboard HTTP surfaces are same-origin v2 GET routes:

- `/api/dashboard/v2/runs` and `/api/dashboard/v2/runs/:runId` — validated run
  summary and light-detail records.
- `/api/dashboard/v2/runs/:runId/workflow` and `traversal` — authored workflow
  and the current ordered path reconstructed from existing runner state.
- `/api/dashboard/v2/runs/:runId/activity`, `logs`, and `artifacts` — resources
  requiring one validated existing workflow `stepId`.
- `/api/dashboard/v2/runs/:runId/artifacts/:artifactRef` — one validated artifact
  preview/download stream.
- `/api/dashboard/v2/events` — `InvalidationEvent` plus heartbeats.

SSE is lossy invalidation, not state. Its frame contains only an event name and
revision id. `snapshot_changed` is server-coalesced; `observer_stale` and
`observer_recovered` publish immediately. The browser rejects invalid or
non-increasing ids, coalesces refetch signals to 100ms, refetches after reconnect,
and performs a normal snapshot GET every 15 seconds. Clients never create
backpressure into observer refresh or workflow execution.

Durable run files are authoritative. `DashboardReadModel` is ephemeral and
fully rebuildable; it never persists dashboard cache or degraded state. It owns
the last-good immutable snapshot and observer freshness:

- success atomically publishes validated runs and fresh state;
- failure before a good snapshot is a bounded first-load error;
- failure after a good snapshot retains cards, advances freshness revision and
  ETag, preserves the first `staleSince`, and emits `observer_stale`;
- repeated failures remain stale; only successful recovery emits
  `observer_recovered` and permits fresh state again.

Browser freshness is conservative: observer state must be fresh, no newer stale
event hint may be awaiting reconciliation, and transport must be connected.
EventSource connectivity alone never means Live. `ORBITA_DASHBOARD_STALE_MS`
caps the server refresh interval through `min(POLL_MS, STALE_MS)`; it is not a
browser elapsed-age gate.

Process lifecycle is likewise bounded and explicit. Composition is a lazy
process singleton; creation starts the watcher and periodic refresh. Idempotent
close clears watcher, poll/watch/invalidation timers, and subscribers and is
registered on `beforeExit`. Every SSE request clears its own heartbeat and
subscription on abort/cancel.

Request authority has three owners: process configuration selects the runs
root, the validated snapshot revision owns board/freshness data, and the
router's exact `run` search value owns detail selection. Detail query keys use
that id, transport URL-encodes it, and the route decodes/validates it before an
exact index lookup. Filtering or a missing result preserves selection and must
not choose a fallback run.

The projection exposes exactly five lanes in this order:
`waiting_for_user`, `worker_running`, `needs_help`, `degraded`, `done`. Degraded is
observer/read health, not durable workflow state. Cursor cardinality is `0..1`;
more than one step becomes a bounded unsupported/degraded projection.

Run inspection adds no durable identity or storage. The selected `stepId` is a
browser read-model key only. Traversal, Activity, managed debug-summary logs,
and artifact ownership are derived from the existing Baton, managed history,
workflow document, and artifact records. Fanout/shard request ids remain old
request addresses and may be mapped to their owning workflow step for display;
they never become workflow steps or new persisted entities. Workflow stays
run-wide while step selection scopes only Activity, Logs, and Artifacts.

## Disclosure boundary

Every browser-visible prose value passes exposure policy version `2` under one
implemented source class. The policy performs NFKC normalization, replaces
control characters, collapses whitespace, truncates to the source's
120/160/240-code-point ceiling, and omits forbidden absolute paths, lease/token/
hash shapes, commands, private instruction markers, prompts, and transcripts.
`PublicDisplayText` then enforces non-empty text with a maximum length of 240.
New prose fields default to omission until their source class, necessity,
ceiling, fallback, fixtures, and policy version are approved. Snapshot and
detail responses have aggregate UTF-8 caps of 1.5 MiB and 64 KiB; no per-field
UTF-8 byte ceiling is currently implemented.

Identifiers, content types, outcomes, timestamps, counts, and lane/event/error
values use dedicated bounded schemas rather than the prose policy. Fixed public
diagnostics replace raw exceptions. Raw Baton/history, paths, run roots,
instructions, prompts, transcripts, tokens/hashes, commands, bindings, host or
worker metadata, and raw errors never enter browser DTOs, fixtures, logs, or the
client bundle.

## Binding dependency rules

- `contracts/**` must not import `projection/**`, `observer/**`, UI
  implementation, persistence, entrypoints, or Node-only modules.
- `projection/**` may import contracts and validated plain records. It must not
  import filesystem/process APIs, watcher code, Start routes, observer code,
  leases/locks/writers, runner control/mutation use cases, or UI modules.
- `observer/**` may import contracts, projection, approved read-only run-state
  modules, and Node read/watch APIs. It must not import writers, run-index locks,
  lease/claim/heartbeat code, runner mutation/control APIs, CLI shells, host
  lifecycle, or browser/UI modules.
- API routes may import observer code only through
  `ui/src/server/dashboard-composition.server.ts`. They must not classify lanes,
  project/redact records, read durable files directly, or return raw errors.
- Client-reachable routes/features/components/hooks/primitives must not import
  `observer/**`, `projection/**`, persistence, entrypoints, runtime/use-cases/
  entities, Node built-ins, process environment, or `.server.ts` modules.
- No dashboard module may import, execute, shell out to, expose, or construct
  `next`, `continue`, `write-output`, `instructions`, `listPointerTransitions`,
  `movePointer`, list/move-pointer CLI modes, claim/lease/heartbeat/bind-agent,
  repair/retry-run, writer, or manual-move surfaces.
- Dashboard records, freshness, diagnostics, artifacts/results/history facts,
  and cursor projections are read models. They must never be written into run
  directories.

`.dependency-cruiser.cjs` enforces these path-level rules. Production client
bundle inspection independently proves absence after bundling/tree-shaking.

## Compatibility decision

The prototype is `delete_now`, with no temporary owner or expiry because no
compatibility layer is approved. The final source must not contain:

- `listDashboardRuns`, `getDashboardRun`, or `startDashboardServer`;
- `orbita-dashboard serve` or dashboard API entrypoint re-exports;
- the custom Node HTTP/static server or whole-snapshot event publisher;
- string `renderDashboard*`, `client.js`, or direct dashboard CSS/assets;
- v1 routes, `/api/runs`, `/api/events`, unversioned `/api/dashboard/*`, or redirects;
- automatic first selection, multiple active cursor chips, drag/drop, or runner
  control affordances.

Durable workflow-runner formats and all mutation/control APIs remain unchanged.

## Review gates

Dashboard changes must provide focused evidence for:

- strict DTO validation and adversarial disclosure/identifier boundaries;
- no mutation/control imports, strings, routes, affordances, or browser paths;
- per-run degraded isolation and bounded whole-index/first-load failure;
- restart rebuild, watcher plus periodic reconciliation, bounded coalescing,
  invalidation-only SSE, disconnect and idempotent shutdown;
- connected-SSE refresh failure visibly becoming stale while last-good cards
  remain, staying stale across failures, and becoming fresh only on recovery;
- only the documented v2 GET routes and no v1/legacy exports/CLI/aliases/assets;
- TypeScript source direction via dependency-cruiser and forbidden server/
  private material absence in the production client bundle;
- the approved board/focus/responsive state contract and 1,000-run performance
  gates defined by `DESIGN.md` and the approved implementation plan;
- explicit drift comparison across implementation, schemas/tests, commands,
  `ARCHITECTURE.md`, this file, `DESIGN.md`, and `README.md`.

Green tests do not override a missing path-level negative check, compatibility
residue, browser disclosure leak, or contract/docs drift.
