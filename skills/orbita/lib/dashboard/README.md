# Orbita dashboard

The Orbita dashboard is a local, read-only TanStack Start application for
scanning durable workflow runs as an attention-first board and progressively
inspecting one run through the version-2 occurrence-aware surface. Durable run
files remain authoritative; the dashboard never claims a lease, mutates a run,
or persists a dashboard cache.

Architecture and placement rules live in `../../ARCHITECTURE.md` and
`CONTEXT.md`. Visual and interaction rules live in `../../DESIGN.md`.

## Commands

Run these from the repository root:

- `bun run dashboard:dev` — start the Vite/TanStack Start development server.
- `bun run dashboard:format` — format dashboard sources with the pinned
  `@sergeigarin/hygene` Oxfmt configuration.
- `bun run dashboard:format:check` — verify dashboard formatting without
  writing files.
- `bun run dashboard:lint` — run the shared hygiene Oxlint baseline plus local
  dashboard boundary overrides.
- `bun run dashboard:build` — build the production Nitro Bun application.
- `bun run dashboard:start` — start the built Bun server from
  `skills/orbita/lib/dashboard/ui/.output/server/index.mjs`.
- `bun run dashboard:typecheck` — check the dashboard TypeScript project.
- `bun run dashboard:test` — run dashboard contract/component tests.
- `bun run dashboard:test:runtime` — run dashboard server/runtime tests natively
  under Bun.
- `bun run dashboard:test:browser` — run Playwright browser scenarios.
- `bun run depcruise:check` — enforce contracts/projection/observer/server/
  browser dependency direction.

The dashboard application runtime is Bun-only. Development, build, production
start, and runtime tests execute under Bun; workflow TOML parsing intentionally
relies on `Bun.TOML`. Vitest remains the Node-based UI component-test tool and
does not stand in for Bun runtime coverage.

The TypeScript project extends `@sergeigarin/hygene/tsconfig.json`. TanStack
Router owns generated `routeTree.gen.ts`; handwritten-source format/lint gates
do not treat it as a manually edited file.

## Process configuration

Configuration is read from the server process. Browser requests, refs, cursors,
and URL search cannot choose the runs root or any filesystem path.

| Variable                        | Default                              | Accepted value                                                            |
| ------------------------------- | ------------------------------------ | ------------------------------------------------------------------------- |
| `ORBITA_DASHBOARD_RUNS_ROOT`    | Orbita's standard workflow-runs root | Existing absolute directory                                               |
| `ORBITA_DASHBOARD_HOST`         | `127.0.0.1`                          | Bounded host/address string; keep loopback unless exposure is intentional |
| `ORBITA_DASHBOARD_PORT`         | `3000`                               | Integer `0..65535`                                                        |
| `ORBITA_DASHBOARD_POLL_MS`      | `2000`                               | Integer `250..300000`                                                     |
| `ORBITA_DASHBOARD_HEARTBEAT_MS` | `15000`                              | Integer `1000..120000`                                                    |
| `ORBITA_DASHBOARD_STALE_MS`     | `10000`                              | Integer `1000..600000`; caps full reconciliation interval                 |
| `ORBITA_DASHBOARD_COALESCE_MS`  | `100`                                | Integer `10..1000`; coalesces filesystem-watch bursts                     |

Invalid configuration fails server composition instead of accepting a
browser-controlled or ambiguous fallback.

## HTTP contract

The supported application exposes the root plus exactly nine version-2 GET
resources:

- `/api/dashboard/v2/runs` — summary snapshot and authoritative freshness.
- `/api/dashboard/v2/events` — data-free invalidation SSE and heartbeats.
- `/api/dashboard/v2/runs/:runId` — bounded light detail.
- `/api/dashboard/v2/runs/:runId/workflow` — paged complete workflow definition.
- `/api/dashboard/v2/runs/:runId/traversal` — ordered owner occurrences and
  activation peers.
- `/api/dashboard/v2/runs/:runId/activity` — occurrence-scoped Activity.
- `/api/dashboard/v2/runs/:runId/logs` — occurrence-scoped managed Markdown.
- `/api/dashboard/v2/runs/:runId/artifacts` — descriptors for exactly one
  occurrence (`occurrenceRef`) or workflow step (`stepId`).
- `/api/dashboard/v2/runs/:runId/artifacts/:artifactRef?mode=preview|download`
  — verified content from an immutable accepted-byte snapshot.

There are no version-1 routes, aliases, redirects, unversioned dashboard APIs,
custom static server/assets, supported `orbita-dashboard serve` CLI, or public
`startDashboardServer` API.

Board snapshot reads consume zero `history.md` body bytes, workflow bodies, and
artifact bytes. Workflow, traversal, Activity, Logs, artifacts, and content are
separate bounded and cancellable reads. Refs and cursors are deterministic
authenticated-encrypted values capped at 512 characters. Their sealing key
derives from the configured canonical runs-root location and directory identity,
so normal process restart preserves them without registry/eviction state;
moving or replacing that authority intentionally makes them stale. They never
contain or grant path or content authority.

Approved bounds:

| Resource                                                | Bound                                          |
| ------------------------------------------------------- | ---------------------------------------------- |
| Snapshot                                                | 1.5 MiB                                        |
| Light detail, traversal, Activity, Logs, artifact pages | 64 KiB                                         |
| Workflow page                                           | 256 KiB / 200 steps                            |
| Traversal / Activity / artifacts                        | 100 occurrences / 200 events / 100 descriptors |
| Text / active HTML or SVG                               | 1 MiB / 2 MiB                                  |
| Raster or PDF / audio or video                          | 32 MiB / 64 MiB                                |
| MIME probe                                              | 8 KiB                                          |

History pages contain whole managed entries under byte and entry-count limits,
remain stable across append, and report `complete`, `truncated`, and
`nextCursor` separately. Workflow cursors resolve to a content fingerprint;
history cursors resolve to resource/occurrence scope and one immutable file
snapshot; artifact cursors resolve to exactly one occurrence or workflow-step
scope; artifact refs resolve to canonical aggregate identity. Stale,
cross-authority, cross-run, cross-route, cross-scope, replaced, shrunk,
malformed, or forged locators return fixed public failures without disclosing
their sealed state.

Traversal reads at most 100 source entries, Activity at most 11 source entries
before its 200-event DTO ceiling, and Logs at most 200 source entries. Workflow
loading rejects a source above 8 MiB and fingerprints/parses one verified
no-follow file snapshot.

## Occurrence and artifact truth

An occurrence is one durable workflow cursor-owner visit identified by
`(stepId, ordinal)`. Self/backward loops produce distinct ordinals. Fanout and
shard work remains nested under the owning activation and is not promoted to a
workflow occurrence. When a legacy run is seeded, its inherited current cursor
remains unavailable. Later routes persist per-step `firstAvailableByStep`
boundaries for newly observed visits without moving coverage backward over the
seed. Ambiguous panels show `legacy_unavailable`; the dashboard does not infer
an ordinal from old history or relabel a seeded occurrence as covered.

Workflow is run-scoped and independent of the path-step selector. The selector
shows unique steps on the active transition path and hides occurrence ordinals.
Selecting a step resolves its newest trustworthy occurrence internally and
changes only Activity, Logs, and the occurrence-scoped Artifacts tab; the
Workflow pane requests artifacts independently by selected `stepId`. The
artifact resource requires exactly one scope and has no run-wide form. Aggregate
artifact identity includes owner step, owner occurrence, producer request, and
artifact id, so repeated owners cannot overwrite or merge one another.
Worker-authored artifact metadata remains `{id, content_type, path, summary?}`.
Legacy aggregate wrappers remain descriptor-visible with
`legacy_unavailable`, but receive no artifact ref or content capability when
provenance/stamp truth is absent.

Paged panels expose continuation/end explicitly. A stale cursor preserves
already loaded evidence and restarts only that resource at page 1. Query
placeholder data is exact-key scoped and never carries detail, selection, or
preview state from one run/occurrence into another.

## Trust, content, and recovery

- Private JSON/data routes require the configured Host authority, permit only
  the request URL's same origin when Origin is present, and require exact
  same-origin Fetch Metadata. They reject `Origin: null`, cross-site,
  navigation/image/script requests, duplicate parameters, and unknown query
  fields.
- Only an eligible canonical preview request accepts same-origin iframe
  navigation. Active HTML/SVG renders in an opaque-origin nested frame with CSP
  sandbox and without same-origin, top-navigation, popup, or download
  capability. It may still execute scripts and contact HTTP(S) network
  resources, which the trusted parent must disclose.
- Artifact files are reopened through their canonical occurrence/request
  directory handle and verified against the accepted
  device/inode/size/mtime/ctime stamp. Exactly the accepted bounded byte length
  is copied and restatted before the filesystem handle closes; full and Range
  responses serve only that immutable snapshot. Descriptor and transport use one
  MIME/size policy. Mismatch is download-only; mismatch, unsupported, oversized,
  and legacy content cannot enter preview even through a direct URL.
- Content uses exact MIME, `nosniff`, safe disposition, `no-store`,
  no-referrer, ETag/file stamp, and fixed errors. PDF/audio/video/download allow
  one valid Range; malformed, multiple, or unsatisfiable ranges return 416.
- Browser-visible prose is source-classified, bounded, and disclosure-filtered.
  Logs are newly constructed from allowlisted structured v2 facts, never raw
  managed-history or `debug-summary.md` bodies. Raw Baton/history, paths,
  prompts, transcripts, credentials/tokens/hashes, commands, bindings, private
  host/worker metadata, and raw errors are not DTOs.
- One corrupt run becomes one Degraded card. Initial failure is explicit; a
  later refresh failure retains the last-good board until successful recovery.
- Watch notifications and SSE are lossy. Periodic validated GET reconciliation
  remains the repair path; a connected event stream alone does not mean Live.

The trusted React parent owns preview controls and never injects active artifact
bytes into its DOM. Markdown rendering is local to run detail, uses pinned
`react-markdown` plus `remark-gfm`, disables raw HTML, escapes code, and marks
external links with disclosure and `rel="noreferrer"`.

The dashboard remains inspection-only: no retry, continue, repair, move, bind,
write-output, drag/drop, lease, or other control action belongs in UI or routes.

## Rollback boundary

Dashboard rollback is atomic at the React/Start v2 surface: do not leave mixed
v1/v2 routes, aliases, flags, or partial panels. Durable run files are never
rewritten or deleted. If any v2 provenance/history/artifact write may have
occurred, keep additive Baton parsing, provenance validation, and stamped
aggregate compatibility while rolling back the observer/UI. A strict pre-v2
runtime/schema rollback is allowed only with positive evidence that no v2 write
occurred. Locators have no registry state to migrate; the same canonical
runs-root authority preserves their lifecycle, while moving or replacing that
authority intentionally invalidates them.
