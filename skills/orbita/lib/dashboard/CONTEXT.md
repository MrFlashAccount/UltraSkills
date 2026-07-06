# Dashboard context

`lib/dashboard/**` owns the read-only Orbita dashboard observer subsystem.
It observes durable workflow-runner state, projects safe dashboard DTOs, serves
a local read-only API/event/static surface, and renders the browser board UI.
The approved frontend runtime direction is React, TanStack Start, React Aria
Components, CSS Modules, and TypeScript, constrained to the browser-only
dashboard UI boundary described here.

This context implements the dashboard section of `../../ARCHITECTURE.md` and
uses `../../DESIGN.md` as the board/drawer UI input.

## Source zones

- `contracts/**` owns browser-visible dashboard DTO names, lane/event constants,
  allowed fields, and contract fixtures/examples.
- `projection/**` owns safe read models, lane classification, history excerpt
  policy, workflow mini-map projection, artifact/result summaries, and degraded
  read diagnostics.
- `server/**` owns the local daemon request handler, list/detail/SSE/static
  surfaces, compiled dashboard asset serving, watch/poll refresh, restart
  rebuild behavior, public error shape, and per-run read isolation.
- `ui/**` owns browser rendering, TanStack Start route structure, route-level
  data fetching over safe daemon endpoints, browser API/SSE consumption,
  dashboard-local view models, local UI kit components, CSS Modules,
  virtualization, and generated browser assets from dashboard DTOs only.

Expected `ui/**` source zones are local to this context:

- route/app code owns URL/search/detail-selection orchestration and may fetch
  only safe daemon DTO endpoints;
- client code owns browser-safe `/api/runs`, `/api/runs/:runId`, `/api/events`,
  and `/api/dashboard/*` compatibility calls;
- view-model code owns DTO filtering, lane grouping, selected drawer state, and
  freshness/error derivation;
- component code owns the dashboard-local UI kit and dashboard widgets with
  colocated CSS Modules;
- virtualization code owns large lane/card rendering for 1000+ runs;
- generated asset output is a static browser artifact served by `server/**`, not
  a source of runtime architecture rules.

## Binding rules

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
  detail, event, degraded diagnostic, artifact, history excerpt, cursor, and
  mini-map shapes.
- `projection/**` may read validated records and plain values supplied by
  adapters, then return allowlisted DTOs. It must not parse CLI arguments,
  inspect process state, perform filesystem IO, or call runner mutation/control
  use cases.
- `server/**` may perform read-only filesystem/API/static IO and response
  formatting. It must route all browser-visible run data through the safe
  projection/contract boundary.
- `server/**` may serve compiled dashboard assets from the configured static
  root, including nested or hashed generated files when produced by the frontend
  build. It must reject traversal and redact local static-root/runs-root paths
  on failures.
- `ui/**` must depend only on browser APIs, dashboard DTO contracts, and
  dashboard-local browser modules. It must not import Node filesystem modules,
  persistence adapters, workflow-runner API shells, CLI modules, use cases,
  entity internals, command builders, lease/lock/write modules, pointer recovery
  APIs, or worker lifecycle/session modules.
- TanStack Start route-level data fetching must call the existing safe daemon
  HTTP/SSE DTO boundary. Start server functions/loaders must not become a
  shortcut into persistence, local run directories, runner internals, Node IO,
  or workflow-runner command surfaces.
- The dashboard-local UI kit may define primitives such as Link, Button,
  Drawer, Card, and Text. It is scoped to the dashboard and must not become a
  shared repo design system without a separate architecture decision.
- Degraded dashboard state describes observer/read health only. It must stay
  ephemeral and must not be persisted as workflow state or represented as a
  workflow blocked result unless durable state is actually blocked.
- SSE updates are observational and lossy. Connected clients must not create
  backpressure into workflow execution or make runner writes depend on UI state.

## Forbidden dependencies and fields

Dashboard runtime code must not import, execute, shell out to, expose, or wrap:

- workflow-runner `next`, `continue`, `write-output`, or `instructions`
  command surfaces, including worker binding flags on `continue`;
- workflow-runner `listPointerTransitions` / `movePointer` API functions or
  `list-pointer-transitions` / `move-pointer` CLI modes;
- run claiming, lease authority, heartbeat, lock mutation, or persisted-state
  writer code;
- host worker lifecycle/session concepts;
- token-bearing command builders or raw instruction command builders;
- direct persistence, use-case, entity, entrypoint, Node filesystem/path, or
  local run-directory reads from browser UI source;
- TanStack Start server-side data paths that bypass the safe daemon DTO
  endpoints.

Browser-visible DTOs and UI fixtures must not include:

- lease tokens, token hashes, token-bearing commands, or raw instruction
  commands;
- private prompts, hidden transcripts, instruction storage paths, preferred
  agent ids, worker binding flags, or worker lifecycle metadata;
- raw baton, raw history, raw artifact filesystem paths, local runs-root paths,
  or absolute user-machine paths;
- unallowlisted owner/user/request metadata.

Generated dashboard build artifacts must not expose private local paths, hidden
runtime artifacts, run roots, raw artifact paths, or instruction storage paths.
Source maps are disabled by default; if enabled later, they require an explicit
privacy check proving the same boundary.

## Review checks

Dashboard changes must include focused evidence for:

- no runner mutation/control imports or command strings in dashboard runtime
  code;
- no pointer-recovery controls, imports, command strings, lease acquisition, or
  manual current-pointer movement affordances in dashboard runtime or browser UI;
- safe DTO redaction for forbidden fields above;
- per-run degraded read isolation without hiding healthy runs;
- restart rebuild from durable state;
- SSE/poll recovery without execution backpressure;
- UI rendering from daemon DTOs or an explicitly named adapter over those DTOs;
- route-level data fetching over safe daemon DTO endpoints only, with no
  TanStack Start server-side bypass into persistence or runner internals;
- dependency-cruiser or equivalent checks for browser-only no-go imports when
  frontend source paths exist;
- compiled static asset serving from the configured static root, including
  traversal rejection and static-root/runs-root redaction;
- generated source maps/static metadata disabled or proven not to expose private
  local paths or hidden runtime artifacts;
- no control affordances, drag/drop, manual lane movement, or browser direct
  filesystem reads.
