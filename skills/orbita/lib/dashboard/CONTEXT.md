# Dashboard context

`lib/dashboard/**` owns the read-only Orbita dashboard observer subsystem.
It observes durable workflow-runner state, projects safe dashboard DTOs, serves
a local read-only TanStack Start API/event/app surface, and renders the browser
board UI.

This context implements the dashboard section of `../../ARCHITECTURE.md` and
uses `../../DESIGN.md` as the board/drawer UI input.

`adr/tanstack-start-runtime.md` records the accepted runtime direction for the
dashboard migration: TanStack Start for the dashboard app/backend serving
boundary, TypeScript/TSX for migrated dashboard runtime surfaces, React for UI
composition, React Aria Components for reusable interactive controls, and CSS
Modules for component-local styling.

## Source zones

- `contracts/**` owns browser-visible dashboard DTO names, lane/event constants,
  allowed fields, and contract fixtures/examples.
- `app/**` owns the dashboard TanStack Start app shell, app routes, server
  route handlers, route loaders, build/dev integration, and root/dashboard app
  serving.
- `projection/**` owns safe read models, lane classification, history excerpt
  policy, workflow mini-map projection, artifact/result summaries, and degraded
  read diagnostics.
- `server/**` owns the thin local Start launcher, runtime context wiring,
  read-only observer construction, SSE publisher lifecycle, watch/poll refresh,
  public error shape, and per-run read isolation used by the TanStack Start
  route/server boundary.
- `ui/**` owns TypeScript/TSX browser rendering, React components, React Aria
  based reusable interactive primitives, CSS Modules, presentation state,
  browser API/SSE consumption, and UI fixtures from dashboard DTOs only.

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
- TanStack Start backend handlers may serve dashboard app/API/event surfaces and
  call read-only dashboard observer/API services. They must not become
  workflow-runner host adapters and must not expose mutation/control endpoints.
- `ui/**` must depend only on browser APIs, React runtime packages, TanStack
  Start browser/client integration, React Aria Components, CSS Modules, and
  dashboard DTO contracts/types. It must not import Node filesystem modules,
  persistence adapters, workflow-runner API shells, CLI modules, use cases,
  entity internals, `server/**`, or `projection/**`.
- Migrated dashboard runtime surfaces are TypeScript/TSX. Existing `.mjs` files
  may remain only as public CLI/API entrypoint wrappers outside the dashboard
  app runtime. They must not preserve obsolete dashboard routes, assets, or
  string rendering adapters.
- Reusable interactive UI components must be based on React Aria Components
  when a matching primitive exists. Bespoke reusable interaction requires local
  justification and must remain read-only.
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
- token-bearing command builders or raw instruction command builders.

Browser UI TypeScript/TSX must not import:

- `node:*`;
- `lib/persistence/**`, `lib/entrypoints/**`, `lib/use-cases/**`, or
  `lib/entities/**`;
- `lib/dashboard/server/**` or `lib/dashboard/projection/**`;
- workflow-runner command builders, lease/lock/claim code, pointer movement,
  run repair, or host worker lifecycle code.

TanStack Start backend handlers must not import or expose:

- workflow-runner mutation/control entrypoints;
- leases, locks, claim or heartbeat authority;
- `write-output`, `continue`, `next`, `instructions`,
  `listPointerTransitions`, or `movePointer` handlers;
- persisted-state writers, host worker lifecycle, or CLI command builders.

Browser-visible DTOs and UI fixtures must not include:

- lease tokens, token hashes, token-bearing commands, or raw instruction
  commands;
- private prompts, hidden transcripts, instruction storage paths, preferred
  agent ids, worker binding flags, or worker lifecycle metadata;
- raw baton, raw history, raw artifact filesystem paths, local runs-root paths,
  or absolute user-machine paths;
- unallowlisted owner/user/request metadata.

## Review checks

Dashboard changes must include focused evidence for:

- no runner mutation/control imports or command strings in dashboard runtime
  code;
- no forbidden browser UI imports in TypeScript/TSX sources and no forbidden
  TanStack Start backend control-plane imports;
- dependency-cruiser TS/TSX resolver support and dashboard no-go rules when the
  Start/UI source paths exist;
- no pointer-recovery controls, imports, command strings, lease acquisition, or
  manual current-pointer movement affordances in dashboard runtime or browser UI;
- safe DTO redaction for forbidden fields above;
- per-run degraded read isolation without hiding healthy runs;
- restart rebuild from durable state;
- SSE/poll recovery without execution backpressure;
- UI rendering from daemon DTOs or an explicitly named adapter over those DTOs;
- root/dashboard app serving, canonical list/detail/SSE routes, retained alias
  routes, public error redaction, and unchanged `orbita-dashboard serve`
  semantics;
- React Aria Components backing reusable interactive controls where matching
  primitives exist;
- 1000+ run grouping/filtering/SSE update behavior, selected drawer stability,
  degraded/error visibility, and virtualization threshold or approved
  alternative;
- no control affordances, drag/drop, manual lane movement, or browser direct
  filesystem reads.
