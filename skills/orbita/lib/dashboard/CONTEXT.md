# Dashboard context

`lib/dashboard/**` owns the read-only Orbita dashboard observer subsystem.
It observes durable workflow-runner state, projects safe dashboard DTOs, serves
a local read-only API/event/static surface, and renders the browser board UI as
a TypeScript React SPA.

This context implements the dashboard section of `../../ARCHITECTURE.md` and
uses `../../DESIGN.md` as the board/drawer UI input.

## Source zones

- `contracts/**` owns browser-visible dashboard DTO names, lane/event constants,
  allowed fields, and contract fixtures/examples.
- `projection/**` owns safe read models, lane classification, history excerpt
  policy, workflow mini-map projection, artifact/result summaries, and degraded
  read diagnostics.
- `server/**` owns the local daemon request handler, list/detail/SSE/static
  surfaces, watch/poll refresh, restart rebuild behavior, public error shape,
  and per-run read isolation.
- `ui/**` owns the browser-only TypeScript React SPA over dashboard DTOs only:
  typed API/SSE client, unknown-to-DTO narrowing, local view state, selectors,
  React components, react-aria-components accessibility primitives, CSS
  Modules, large-list windowing, focus/keyboard behavior, and typed browser
  fixtures.

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
- `ui/**` must depend only on React, react-aria-components, TanStack
  browser/runtime surfaces, TypeScript type-only DTO contracts, CSS Modules,
  browser APIs, and dashboard DTO contracts. It must not import Node filesystem
  modules, persistence adapters, workflow-runner API shells, CLI modules,
  mutation/control use cases, lease or lock authority, run-state writers, host
  worker lifecycle modules, or entity internals.
- `ui/**` source must be TypeScript/TSX with strict no-any discipline. DTOs,
  API/SSE payloads, state/selectors, component props, event handlers,
  virtualization state, and fixtures must have explicit types or
  unknown-to-known narrowing; `any` is not allowed as an escape hatch.
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
- no forbidden UI imports from Node IO, persistence, entrypoints, runner
  control/use-case internals, leases/locks, run-state writers, or host worker
  lifecycle modules;
- no `any` usage in dashboard SPA source, DTO/type definitions, state,
  selectors, props, event handlers, virtualization state, or fixtures;
- no pointer-recovery controls, imports, command strings, lease acquisition, or
  manual current-pointer movement affordances in dashboard runtime or browser UI;
- safe DTO redaction for forbidden fields above;
- per-run degraded read isolation without hiding healthy runs;
- restart rebuild from durable state;
- SSE/poll recovery without execution backpressure;
- UI rendering from daemon DTOs or an explicitly named adapter over those DTOs;
- no control affordances, drag/drop, manual lane movement, or browser direct
  filesystem reads.

The approved dashboard runtime decision is recorded in
`../../../docs/adr/0001-orbita-dashboard-react-spa.md`.
