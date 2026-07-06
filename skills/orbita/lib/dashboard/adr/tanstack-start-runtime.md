# Dashboard TanStack Start Runtime ADR

## Status

Accepted for the dashboard runtime migration.

## Context

The Orbita dashboard is a read-only observation surface over durable
`workflow-runner` run state. Existing architecture keeps this dependency
direction:

```text
run-state files -> observer reader -> safe projection -> dashboard API/events -> browser UI
```

The current browser surface is plain JavaScript and string-rendered HTML. The
approved implementation plan requires a maintainable dashboard foundation with:

- TanStack Start as the dashboard backend/app serving runtime;
- TypeScript for migrated dashboard runtime surfaces;
- React for UI composition;
- React Aria Components as the base for reusable interactive UI components;
- CSS Modules for component-local styling;
- preserved read-only DTO/API/SSE boundaries without carrying obsolete
  dashboard compatibility aliases.

## Decision

Migrate the dashboard to a dashboard-owned TanStack Start runtime while keeping
the observer, projection, and DTO contract ownership intact.

TanStack Start owns the dashboard app/backend serving boundary: app shell,
dashboard routes, server route handlers or adapters, build/dev integration, and
root/dashboard asset serving. Start handlers may call read-only dashboard
observer/API services, but they must not become workflow-runner control
adapters.

Migrated dashboard runtime source is TypeScript/TSX. Existing `.mjs` files may
remain only as public CLI/API entrypoint wrappers outside the dashboard app
runtime. They must not preserve obsolete dashboard routes, assets, or string
rendering adapters.

Reusable interactive UI components must be based on React Aria Components when
a matching primitive exists. Bespoke reusable interaction requires a local
justification and must remain read-only.

## Rejected alternatives

- Keep the current plain JavaScript/string-rendered dashboard as the long-term
  foundation: rejected because it is the current minimal bridge, not the target
  maintainable runtime.
- Use TanStack Start only as static/browser-first scaffolding: rejected because
  the approved plan requires backend/app serving migration to TanStack Start.
- Use React without TanStack Start: rejected because the approved runtime
  includes TanStack Start.
- Use Solid or another lighter UI runtime: rejected because the approved UI
  foundation is React plus React Aria Components.
- Keep migrated dashboard runtime source in JavaScript: rejected because
  TypeScript is mandatory for the migration surfaces.
- Introduce dashboard control actions in the app/server boundary: rejected
  because dashboard remains a read-only observer.

## Ownership

- `app/**` or the selected dashboard-owned Start source zone owns TanStack Start
  app routes, server route handlers, route loaders, generated route inputs, and
  build/dev integration.
- `ui/**` owns TypeScript/TSX browser UI components, React Aria based reusable
  primitives, CSS Modules, presentation state, browser DTO client, fixtures, and
  large-run rendering behavior.
- `contracts/**` owns browser-visible DTO names, lane/event constants, allowed
  fields, and contract fixtures/examples.
- `projection/**` owns safe read models, lane classification, redaction,
  bounded history excerpt, mini-map projection, artifact/result summaries, and
  degraded diagnostics.
- `server/**` owns the thin local Start launcher, runtime context wiring,
  read-only observer construction, SSE publisher lifecycle, and public error
  shaping used by TanStack Start route handlers.
- `entrypoints/**` remains an outer adapter boundary. `orbita-dashboard serve`
  stays a serve-only launcher for the TanStack Start dashboard.

## Compatibility decisions

- Keep canonical `/api/runs`, `/api/runs/:runId`, and `/api/events`.
- Do not keep `/api/dashboard/*` aliases.
- Keep `/` and `/dashboard` as dashboard app routes.
- Keep `listDashboardRuns`, `getDashboardRun`, `startDashboardServer`, and
  `orbita-dashboard serve` as the public read-only entrypoints.
- Remove the old string-rendered `render.mjs`/`client.js` dashboard foundation
  instead of preserving it as a migration adapter.

## Dependency rules

Browser UI TypeScript/TSX must depend only on browser APIs, React, React DOM,
TanStack Start browser/client integration, React Aria Components, CSS Modules,
and browser-safe dashboard contracts/types.

Browser UI TypeScript/TSX must not import:

- `node:*`;
- `lib/persistence/**`;
- `lib/entrypoints/**`;
- `lib/use-cases/**`;
- `lib/entities/**`;
- `lib/dashboard/server/**`;
- `lib/dashboard/projection/**`;
- workflow-runner command builders, lease/lock/claim code, pointer movement,
  run repair, or host worker lifecycle code.

TanStack Start backend handlers may depend on dashboard read-only observer/API
service modules. They must not import workflow-runner mutation/control
entrypoints, leases, locks, write-output/continue/next handlers,
list-pointer-transitions/move-pointer handlers, claim/heartbeat authority,
persisted-state writers, host worker lifecycle, or CLI command builders.

React/TanStack dependencies must not leak into projection or workflow-runner
runtime helpers.

## Evidence ownership

- Architecture artifact update owns this ADR, `CONTEXT.md`, and the dashboard
  section of `ARCHITECTURE.md`.
- Backend implementation owns package/lock/config integration, TanStack
  Start/Vite/build/dev/typecheck scripts, Start route/server fixtures, and
  dependency-cruiser TS/TSX no-go rules.
- Frontend implementation owns TypeScript React UI, browser DTO client,
  component/module fixtures, rendered safety checks, React Aria reusable
  controls, and 1000+ run behavior evidence.
- QA/reliability review verifies that backend-owned tooling evidence and
  frontend-owned UI/performance evidence are both present before join.

## Verification expectations

Implementation must provide evidence for:

- root/dashboard app serving through TanStack Start;
- canonical list/detail/SSE routes, with obsolete aliases absent;
- redacted public API/SSE/app/static errors;
- unchanged `orbita-dashboard serve` semantics;
- TypeScript/TSX typecheck/build/test story;
- dependency-cruiser rules that include TS/TSX paths and enforce browser UI and
  Start backend no-go imports;
- DTO redaction and no private/control browser output;
- board lanes, cards, drawer, search/filter, loading/empty/error/degraded
  states, keyboard/focus behavior, and React Aria reusable controls;
- 1000+ run grouping/filtering/SSE update behavior and virtualization threshold
  or approved alternative.
