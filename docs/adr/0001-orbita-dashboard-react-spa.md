# Orbita dashboard TypeScript React SPA

Status: accepted

The Orbita dashboard uses a TypeScript React SPA built with React components,
react-aria-components, CSS Modules, and TanStack Start. The dashboard remains a
read-only observer over safe DTOs from the existing dashboard API/SSE boundary;
browser code must not import runner control, persistence, Node IO, leases, or
workflow-runner internals.

Considered options:

- Keep plain browser modules: lowest dependency cost, but it preserves the
  current global client/string-renderer shape instead of giving the dashboard a
  maintainable SPA foundation.
- Solid: plausible for dense reactive UI, but not the approved stack for this
  slice.
- Preact or another lightweight runtime: lower dependency weight, but it would
  weaken the approved React component direction.
- Backend/dashboard rewrite: unnecessary because observer, projection, API/SSE,
  redaction, and alias contracts already exist and must be preserved.

Consequences:

- Dashboard SPA source under `skills/orbita/lib/dashboard/ui/**` must be
  TypeScript/TSX with strict no-any discipline. External payloads enter as
  `unknown` and are narrowed into typed dashboard DTOs before state or component
  use.
- `react-aria-components` is the approved accessibility and interaction
  primitive layer for focus/keyboard-sensitive UI.
- CSS Modules own component styling; global CSS remains limited to root tokens
  and app shell needs.
- TanStack Start/build integration must produce deterministic static assets
  that `orbita-dashboard serve` can serve without requiring a separate frontend
  service during normal local use.
- Existing `/api/runs`, `/api/runs/:runId`, `/api/events`, `/api/dashboard/*`
  aliases, SSE event names, `orbita-dashboard serve` options, `--static-root`,
  safe projection/redaction behavior, and static path protections remain
  compatibility surfaces.
- The implementation must include mechanical checks for forbidden UI imports
  and no-any usage, plus a 1000+ run large-list strategy such as per-lane
  virtualization/windowing or accepted measurement evidence for a non-virtual
  fallback.
