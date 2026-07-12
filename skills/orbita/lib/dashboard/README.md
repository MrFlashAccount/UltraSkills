# Orbita dashboard

The Orbita dashboard is a local, read-only TanStack Start application for
scanning durable workflow runs as an attention-first five-lane board. Durable
run files remain authoritative; the dashboard never claims a lease or mutates a
run.

Architecture and placement rules live in `../../ARCHITECTURE.md` and
`CONTEXT.md`. Visual and interaction rules live in `../../DESIGN.md`.

## Commands

Run these from the repository root:

- `bun run dashboard:dev` — start the Vite/TanStack Start development server.
- `bun run dashboard:build` — build the production Nitro Bun application.
- `bun run dashboard:start` — start the built Bun server from
  `skills/orbita/lib/dashboard/ui/.output/server/index.mjs`.
- `bun run dashboard:typecheck` — check the dashboard TypeScript project.
- `bun run dashboard:test` — run dashboard contract/component tests.
- `bun run dashboard:test:browser` — run Playwright browser scenarios.

`bun run depcruise:check` is the repository boundary gate for dashboard
contracts, projection, observer, server composition, and browser imports.

## Process configuration

Configuration is read from the server process. Browser requests and URL search
cannot choose the runs root or any filesystem path.

| Variable                        | Default                              | Accepted value                                                            |
| ------------------------------- | ------------------------------------ | ------------------------------------------------------------------------- |
| `ORBITA_DASHBOARD_RUNS_ROOT`    | Orbita's standard workflow-runs root | Existing absolute directory                                               |
| `ORBITA_DASHBOARD_HOST`         | `127.0.0.1`                          | Bounded host/address string; keep loopback unless exposure is intentional |
| `ORBITA_DASHBOARD_PORT`         | `3000`                               | Integer `0..65535`                                                        |
| `ORBITA_DASHBOARD_POLL_MS`      | `2000`                               | Integer `250..300000`                                                     |
| `ORBITA_DASHBOARD_HEARTBEAT_MS` | `15000`                              | Integer `1000..120000`                                                    |
| `ORBITA_DASHBOARD_STALE_MS`     | `10000`                              | Integer `1000..600000`; caps the full reconciliation interval             |
| `ORBITA_DASHBOARD_COALESCE_MS`  | `100`                                | Integer `10..1000`; coalesces filesystem-watch bursts                     |

Invalid configuration fails server composition instead of accepting a browser-
controlled or ambiguous fallback.

## HTTP contract

The supported same-origin surface contains exactly three GET routes:

- `/api/dashboard/v1/runs` — complete validated summary snapshot with
  authoritative observer freshness and conditional ETag support.
- `/api/dashboard/v1/runs/:runId` — lazy validated details for one bounded run
  id or a fixed public error. Details include a bounded read-only workflow
  mini-map when workflow step metadata is available, otherwise an explicit
  unavailable state.
- `/api/dashboard/v1/events` — data-free invalidation SSE and heartbeat
  comments.

SSE never carries run state. It only announces `snapshot_changed`,
`observer_stale`, or `observer_recovered`; the browser reconciles through the
snapshot route. A connected event stream alone does not mean the snapshot is
fresh.

Frames carry the reason as the SSE event name and the observer revision as the
event id; they contain no JSON data payload. Snapshot-change publication and
browser refetch signals are coalesced, while stale/recovered events update the
local health hint immediately. The browser ignores invalid/non-increasing ids,
refetches after reconnect, and performs a normal snapshot GET every 15 seconds.
The snapshot route supports `If-None-Match`, although the current browser fetch
adapter does not send that header.

There are no compatibility aliases or redirects for `/api/runs`, `/api/events`,
unversioned `/api/dashboard/*`, `/dashboard/client.js`,
`/dashboard/render.mjs`, or `/dashboard/style.css`. There is no supported
`orbita-dashboard serve` CLI or public `startDashboardServer` API.

## Trust and recovery model

- Browser-visible prose is source-classified, bounded, and disclosure-filtered.
  Raw Baton/history, local paths, prompts, transcripts, tokens/hashes, commands,
  bindings, and exception messages are not public DTO fields.
- One corrupt run becomes one Degraded card; healthy runs remain usable.
- A failed initial snapshot is an explicit error, never an empty board.
- A detail failure stays inside the detail surface.
- A refresh failure after a good snapshot keeps the cards but marks the board
  stale. Repeated failures stay stale; only a successful refresh restores
  fresh/live.
- Watch notifications and SSE are lossy. Periodic reconciliation and conditional
  route support remain the repair path.

Exposure policy version `1` NFKC-normalizes prose, replaces control characters,
collapses whitespace, applies source-specific 120/160/240-code-point ceilings,
and omits values matching forbidden path, secret, command, private-instruction,
prompt, or transcript shapes. `PublicDisplayText` has a non-empty/240 maximum
schema. Aggregate serialized response caps are 1.5 MiB for snapshots and 64 KiB
for details; there is no separate per-field UTF-8 byte ceiling.

`ORBITA_DASHBOARD_STALE_MS` caps the server refresh cadence through
`min(POLL_MS, STALE_MS)`. Live UI state requires authoritative freshness,
connected transport, and no newer stale event hint; the browser does not apply
an elapsed-age stale calculation.

The server composition is created lazily once per process. It starts one
periodic refresh and an optional watcher, closes them idempotently on
`beforeExit`, and clears per-client SSE heartbeat/subscription resources on
abort or cancellation. This is the implemented lifecycle boundary; no broader
signal-hook behavior is implied.

The runs root comes only from process configuration. Snapshot revision is the
authority for board/freshness data. URL search `run` is the authority for detail
selection: it is used as the React Query key, encoded into the request, decoded
and validated by the route, and looked up exactly. Missing or filtered
selection is preserved instead of selecting a neighboring run.

The dashboard is inspection-only: no retry, continue, repair, move, bind,
write-output, drag/drop, or lease/control action belongs in its UI or routes.
