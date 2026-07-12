# Orbita Architecture

## Scope

This document is the architecture contract for the Orbita workflow-runner
runtime. It records layer ownership, dependency direction, retired surfaces,
conditional helper/schema zones, shard/fanout control steps, and review gates.

This contract covers `skills/orbita/**`. It does not define the dashboard visual
design; that remains in `DESIGN.md`.

## Supported Runtime Surface

The canonical workflow-runner command surface is:

- `next`
- `instructions`
- `write-output`
- `continue`
- API `listPointerTransitions` / CLI `list-pointer-transitions`
- API `movePointer` / CLI `move-pointer`

Validation and persistence behavior that supports these commands belongs to the
current runtime architecture. Orchestrator debug notes and worker binding are
bounded `continue` side effects; they do not navigate separately and do not
accept worker output. Obsolete backward-compatibility surfaces do not.

`listPointerTransitions` and `movePointer` are runner API control-plane recovery
surfaces for repositioning only the current baton pointer along already observed
history. Their shell-facing CLI modes are `list-pointer-transitions` and
`move-pointer`. Both require an active run lease. `listPointerTransitions` is a
logical read: it may use the run-state boundary for consistency, but it must not
initialize missing run state, append history, renew authority, or mutate the
baton/current pointer. It is not an unleased public read because it exposes
pointer/history and retained-output recovery metadata. `movePointer` mutates only
baton cursor/status through the existing lease, lock, validation, durable writer,
history, and per-run authority path. Neither surface rolls back, prunes, rewrites, or cleans
`baton.state`, accepted outputs, artifacts/results, worker bindings, prompt
markers, attempts, or existing history. The first supported slice is limited to
one adjacent observed transition edge from the current pointer/status. Terminal
single-cursor positions, including a completed `done` run, may move backward to
an observed non-terminal step; terminal status must not by itself make pointer
recovery unsupported. Array cursors are rejected by the baton schema and cannot
enter pointer recovery.
Targets with retained accepted output require visible retained-state disclosure
and explicit acknowledgement before mutation.

Retired surfaces:

- `start-run`
- `persist-run-state`
- `workflow-interpreter`
- legacy command aliases
- compatibility wrappers whose only purpose is preserving obsolete paths

Retired surfaces must not remain in supported command paths, exports, docs, or
boundary-check allow lists.

## Custom Workflow Catalog

Custom workflow support is a runtime catalog feature for existing workflow
documents, not a plugin marketplace, visual editor, or autonomous workflow
rewriter. Built-in workflows remain the first-party root. User-provided
workflows are discovered from an Orbita TOML config at `~/.orbita/orbita.toml`
or `ORBITA_CONFIG`.

The supported config shape is:

```toml
[workflow_catalog]

[[workflow_catalog.roots]]
source_id = "team"
path = "~/orbita-workflows"
```

Many configured roots are allowed. They stack after the built-in root in config
order. `source_id` values are stable catalog identities and must not use reserved
ids such as `built-in` or `override`.

Catalog identity is source/path-qualified:

- `workflowRef = <sourceId>:<relativeWorkflowPath>`
- workflow `name` is display and fuzzy-routing metadata
- duplicate names are ambiguous unless an exact `workflowRef` is provided

`workflow-catalog --workflows-root <dir>` remains an isolated compatibility
override. It does not merge with built-ins or configured roots and uses the
reserved `override` source id.

Startup validation is non-bypassable for newly initialized runs. `workflow-runs
create` validates the selected workflow before writing a run-index entry, and
`workflow-runner next` validates before creating a missing lease/index/baton.
Runtime continuation must use the persisted absolute workflow path and must not
rediscover catalog/config roots.

Workflow resource loading is source-aware and bounded to the workflow package
root unless the workflow is built-in and explicitly allowed to use repository
role/template/shared material. Custom workflow names must not widen resource
access by basename.

Workflow-authoring/autotrain is an upstream producer only. Authored packages
become runtime-visible only after human-reviewed promotion into a configured
root or an explicit `--workflows-root` override. Runtime list/resolve/run code
must not import authoring/autotrain internals, scan staging locations, or promote
generated workflows implicitly.

## Layer Ownership

### Entrypoints

Owner: `lib/entrypoints/**`

Entrypoints are transport shells. They parse CLI/API input, coordinate IO with
persistence adapters, acquire or pass through leases where needed, call named
use-case APIs, and format public output.

Pointer recovery entrypoints must keep API and CLI behavior aligned: both
`listPointerTransitions` and `movePointer` require active lease authority, return
only bounded DTOs/errors, and redact lease tokens, token hashes, raw private
paths, raw baton dumps, and full private history text.

Entrypoints may depend on:

- named use-case APIs
- persistence adapters
- DTOs, request/response records, and transport-local schemas

Entrypoints must not depend on:

- `lib/use-cases/runtime/**` internals for stable behavior
- sibling entrypoint shells, including CLI-to-API imports
- entity internals except through approved use-case or DTO boundaries

### Use Cases

Owner: `lib/use-cases/**`

Use cases own application flow over DTOs and plain values. They call entity
owners and IO-free runtime helpers, then return DTOs, projections, or command
results to entrypoints.

Top-level use cases must not import other top-level use cases as a stable
pattern. Shared application policy belongs in a colocated helper or an internal
use-case helper zone only when multiple use cases need the same policy.

`ContinueRun -> ApplyWorkflowOutput` was migrated into an internal workflow-output
helper. Recurrence of top-level use-case-to-use-case imports must fail boundary
checks instead of becoming a stable pattern.

### Entities

Owner: `lib/entities/**`

Entities own workflow-domain invariants and behavior for concepts such as
Workflow, Step, Template, and Baton. Entities are IO-free and owner-isolated.

Entities must not import:

- persistence
- entrypoints
- filesystem/path APIs
- unrelated entity owner internals

`entities/Baton` owns Baton behavior. A durable Baton schema shared by multiple
layers is a file contract, not an entity behavior dependency for persistence.

### Runtime Helpers

Owner: `lib/use-cases/runtime/**` and `lib/runtime/**`

Runtime helpers are deterministic and IO-free. They operate over supplied
values, entities, DTOs, and supplied schema/path facts.

Runtime helpers must not import:

- `node:fs`
- `node:path`
- persistence modules
- workflow-resource loaders

Output validation in runtime helpers consumes loaded schemas and explicit path
facts. Schema loading, realpath probing, symlink checks, and artifact path facts
belong to adapters or file-contract owners.

Pointer transition projection belongs under runner-owned runtime/use-case
internals, not the dashboard. It derives adjacent observed transition edges from
persisted baton plus durable history and must be shared by list and move
validation so inspect-before-mutate output cannot drift from mutation rules.
Retained accepted-output detection must use the same per-step accepted-output
surface in `baton.state[stepId]` that `continue` uses; if extracted, it remains a
small runner-owned helper with tests for current `continue` reuse semantics.

Non-blocking stop helpers under `lib/runtime/**` own public shaping and
redaction of stop/resolution records. They must receive path facts from the
caller and must not discover workflow-run storage through persistence imports.

Shard runtime helpers own IO-free activation projection, shard output application, bounded batching, and final-worker readiness. They may consume
Workflow, Step, Baton, file contracts, loaded output schemas, and supplied path
facts. They must not import persistence, entrypoints, dashboard code, filesystem
APIs, workflow-resource loaders, host sessions, transcripts, private paths, or
lease-token concerns.

### Persistence

Owner: `lib/persistence/**`

Persistence owns filesystem and durable-state integration:

- workflow resource loading
- run-state records
- locks and leases
- durable commits
- per-run authority records and the global run-catalog projection
- path safety facts
- current migration behavior
- schema loading for persisted/file records

Persistence may depend on DTOs, records, and file contracts. Persistence must
not import use cases.

Persistence must not import entity-owned Baton schema after the schema has a
neutral or narrowly colocated file-contract owner.

### File Contracts And Schemas

Owner: a neutral contract zone or a narrow colocated owner, selected by deletion
proof.

Use a separate file-contract/schema zone only when a durable schema is consumed
by multiple layers or when separating it prevents recurring schema/domain
ownership drift. If one narrow owner is enough, colocate the contract with that
owner.

A file-contract/schema zone must own real contracts, not act as a dumping ground
for constants or pass-through wrappers.

Shard execution adds two durable file-contract surfaces:

- `workflow-document.json` owns the first-class `kind: "shard"` authoring contract.
- Baton schema owns `state.shards` activation snapshots and bounded output references.

These contracts are shared across validation, runtime, persistence validation, tests, and documentation.

### Boundary Checks

Owner: `.dependency-cruiser.cjs`

`.dependency-cruiser.cjs` is the executable source of truth for Orbita source
dependency direction. This document explains the intent and ownership model;
when a dependency rule is concrete enough to enforce, it belongs in
`.dependency-cruiser.cjs` and CI must run it through
`bun run depcruise:check`.

Boundary checks enforce resolved dependency-direction architecture rules. They
should fail recurrence of forbidden imports while avoiding hard failures for
questions that are still unresolved by the architecture contract.

Checks should cover:

- entrypoints importing runtime internals
- CLI entrypoints importing API entrypoints
- lower layers importing entrypoints
- top-level use cases importing other top-level use cases
- entity families importing other entity families, including nested files
- use-case families importing other use-case families, including nested files
- DTO files importing other DTO files
- top-level use cases importing filesystem/path/persistence
- top-level use cases importing catalog readers
- runtime helpers importing filesystem/path/persistence
- persistence importing use cases
- persistence importing entity-owned Baton schema after migration
- run-state persistence importing startup validation
- runner runtime importing catalog/config discovery
- concrete shard runtime/helper imports that violate the dependency rules below

## Conditional Zones

`lib/file-contracts/**` and `lib/use-cases/internal/**` are conditional zones.
They are allowed only when they own shared policy or durable contract behavior
that survives the deletion test.

Deletion test:

- If deleting the zone only removes folder structure and no caller complexity
  returns, the zone is folder theater and should be removed.
- If deleting the zone pushes shared policy or contract handling back into
  multiple callers or wrong layers, the zone is earning its boundary.

Default to colocation for a single narrow helper or schema.

## Runtime Flow

A canonical workflow-runner command enters through a CLI or API entrypoint. The
entrypoint parses input, coordinates persistence and lease concerns where
needed, and calls a named use-case API.

The use case performs application flow over DTOs/plain values, entity behavior,
IO-free runtime helpers, and supplied contracts. Persistence loads workflow
resources, schemas, run-state records, leases, and path facts, then passes plain
values or contracts across the boundary.

Entrypoints format current public output and errors. They do not reach into
runtime helper internals to assemble behavior.

Mutating runner commands may carry one command-scoped operation context after
the pre-lock and under-lock authority checks. Its persisted-state snapshot must
be read inside the active per-run lock scope, may be passed into the durable
writer, and is replaced by the validated snapshot returned after each write.
Snapshots are deeply frozen. After a same-scope commit, the writer builds the
replacement from the already validated transition and exact target bytes rather
than rereading and revalidating the complete aggregate. The snapshot is never
cached across commands. A pending durable commit takes
precedence over a supplied snapshot, and any direct history append invalidates
the snapshot before a later aggregate write. This optimization does not change
the split-file topology, recovery order, fsync/atomic-rename guarantees, lease
revalidation, or path/symlink safety.

Durable aggregate writes use the v2 append transaction for `history.md`. The
atomically written pending record contains a unique transaction id, the base
file existence and byte size, the bounded entry text and its SHA-256 hash, and
the requested baton/current-request side effects. It must not embed or rewrite
the complete history. Under the per-run lock, recovery accepts only an unchanged
base, an exact byte prefix of the pending entry, or the complete pending entry;
it completes and fsyncs a partial append, recognizes a complete append without
duplicating it, and fails closed on any unrelated tail, truncation, or invalid
hash. Baton and current-request files retain their atomic-write behavior. The
legacy v1 full-history pending format remains recoverable for commits already in
flight, but new commits must use v2.

`history.md` remains the canonical human-facing projection. Commands that only
need baton/current requests carry a file reference plus byte size and do not
load the history body. Full history reads are reserved for behavior that
actually projects history, such as pointer inspection/mutation and debug-note
deduplication. No history body or file handle is cached across commands.

`.workflow-runner/authority.json` is canonical for one run's absolute workflow
binding, claim context, lifecycle/task projection, and token-hash lease record.
Every runner command still validates authority once before taking the per-run
lock and again from a fresh record while holding that lock. Matching-token
renewal preserves the token epoch; a tokenless stale takeover rotates the hash
and increments the epoch. Raw lease tokens are never persisted.

`runs.json` is the global discovery/catalog projection, not an authority source
once a per-run record exists. Warm `next`, `instructions`, `write-output`,
`continue`, and pointer mutation read and atomically renew only the small per-run
record; they do not parse, lock, or rewrite the global catalog. Registration,
explicit claim/heartbeat, and deletion may synchronize the catalog projection.
List and dashboard readers start from catalog ids and overlay canonical per-run
records with bounded IO concurrency. A legacy run without `authority.json` may
fall back to its validated v1 catalog entry; its first successful mutating
runner/claim operation writes the per-run record. Once that file exists, a
missing, conflicting, corrupt, or unsafe authority record must not silently fall
back to the catalog.

Pointer recovery follows the same runtime flow. `listPointerTransitions` checks
the active lease, reads existing persisted run state, builds the shared pointer
transition projection, and returns bounded transition and retained-state metadata
without initializing missing run files, appending history, renewing authority,
or mutating baton/current pointer state. `movePointer` checks the active lease
before and inside the run-state lock, rebuilds the projection while locked,
validates the requested adjacent edge and retained-state acknowledgement, updates only baton
cursor/status, validates persisted state, appends bounded pointer-move history,
and renews the canonical per-run authority record.

## Fanout Owner Step

`kind: "fanout"` is the first-class control step for a fixed table of named
worker branches. Authoring selects branches through `input.branches`: a static
branch-id array, one schema-covered input expression, or `first_of` expressions
for selective rework fallback. Each branch is a nested worker template under
`branches.<branch-id>`; branch ids must be globally collision-safe because
accepted branch outputs live at `baton.state[branchId]`.

The top-level cursor remains the fanout owner for the whole activation. Durable
phase and request membership live under `baton.state.fanouts[ownerStepId]` with
the phases `branches`, `owner`, and `completed`. The runner first renders
synthetic branch requests, applies only the current accepted branch outputs,
then renders the genuine owner worker. The owner output is applied through the
normal step output and `next` path. Phase recovery must use this durable record;
request-id parsing, arbitrary state scanning, dispatch workers, and separate
join workers are not valid control flow.

Owner prompt projection includes accepted output only for branches selected in
the current activation. Stale output for unselected branches may remain durable
for audit/history purposes but must not enter the owner prompt. Fanout is a
named workflow-branch primitive; shard is the homogeneous value-partition primitive.

## Shard Workflow Step

`kind: "shard"` is the first-class generic control step for applying one worker
template to a non-empty array of values in parallel. The top-level `input` and
`output` belong to the genuine final worker represented by the shard step;
`worker` is the nested template for parallel shard requests.

`input.shards` accepts either a non-empty literal JSON array or one
schema-covered `input.*` expression that resolves to a non-empty array.
Elements may be arbitrary JSON values. Numeric shard-count shorthand, authored
element ids, branch tables, nested subgraphs, and compatibility aliases are not
part of the contract.

During one activation, the runtime resolves `input.shards` exactly once and
stores the values in order under `baton.state.shards[parentStepId]`.
`baton.cursor` remains the shard step throughout the `shards`, `worker`, and
`completed` phases. Synthetic request ids are activation/index addresses only;
they never become workflow step ids or pointer-recovery targets.

`max_parallel` bounds each current request batch. Accepted worker output remains
once under its synthetic request id. Shard control state stores only a bounded
`output_ref`, request id, index, and status; it never duplicates full output,
prompt, transcript, session, path, token, or host lifecycle data.

Each shard worker receives the normal prompt interpolation context:

- `${{ shard.value }}`
- `${{ shard.index }}`
- `${{ shard.total }}`
- nested paths such as `${{ shard.value.name }}`

These expressions use the same interpolation rendering rules as `input.*`.
The runtime does not append shard values, JSON context, request metadata, or
control instructions to the worker prompt. Only explicitly authored
interpolation reveals a value.

After every shard request is accepted, the runtime renders the genuine worker
represented by the shard step itself. Its schema-valid output follows the normal
`next` transition. There is no dispatch step, aggregation section, deterministic
completion output, or separate completion worker.

## Non-blocking Stops

`baton.nonBlockingStops` is runner-owned durable control-plane state. It is
keyed by active request id and stores only public, bounded stop and resolution
records. It must not contain transcripts, hidden prompts, lease tokens, raw
worker/approval outputs, private workflow-run paths, arbitrary local paths,
credential assignments, or recognizable access keys. Public stop/resolution
text uses a bounded sanitizer that covers absolute, home-relative,
traversal-relative, and `file://` path forms before persistence or projection.

Lifecycle:

- `write-output` accepts only schema-valid completed step output.
- After safe automatic recovery is exhausted, `report-stop` persists a
  sanitized `non_blocking_stop` record without completing the request or
  advancing the cursor. Every new stop carries a worker-generated UUID v4
  `stop_id`. Repeating the exact report with the same id is idempotent;
  conflicting reuse is rejected. A delayed report for a resolved id cannot
  erase its resolution, while a genuinely new stop must use a new id.
- `continue` projects an unresolved record as a
  `resolve_non_blocking_stop` host action. Completed siblings in fanout/shard
  batches remain accepted while the stopped request stays active.
- `resolve-stop` requires the exact current `stop_id` and persists the bounded
  orchestrator/user resolution on that control record. Exact retries are
  idempotent; conflicting retries and stale resolutions for an older stop are
  rejected without mutation.
- `continue` renders the same request again with resolution context and the
  preferred worker hint when available. The record is cleared only after that
  request submits normal completed output through `write-output`.

Managed history records only the stop id for report/resolve lifecycle events;
it never copies the free-text stop or resolution fields. Those bounded fields
live only in the active Baton control record and are deleted with that record
after normal completed output is accepted.

The final runner statuses remain `needs_host_actions` and `done`. A non-blocking
stop is a host-action pause, never a step outcome, transition value, or terminal
runner status.

## Dashboard Observer Architecture

The Orbita dashboard is a read-only observation surface over durable
`workflow-runner` run state. It extends the adapter side of Orbita; it does not
join the runner control protocol and does not become another host adapter.

`skills/orbita/DESIGN.md` is the product/design input for the board, card,
drawer, lane, mini-map, and no-control UI rules. This architecture section owns
the backend/UI boundary that makes those design rules safe.

Target shape:

```text
catalog ids + per-run authority/run-state -> observer reader -> safe projection -> dashboard API/events -> browser UI
```

Intended source zones:

- `lib/dashboard/server/**` owns the local daemon/API shell, static UI serving,
  SSE event stream, file-watch or polling loop, restart rebuild, and degraded
  read isolation.
- `lib/dashboard/projection/**` owns safe dashboard read models, lane
  classification, history excerpt policy, workflow mini-map projection, and
  redaction policy.
- `lib/dashboard/contracts/**` owns browser-visible DTO schemas and examples
  for list, detail, event, degraded diagnostic, artifact summary, cursor chip,
  and mini-map surfaces.
- `lib/dashboard/ui/**` owns browser rendering against those DTOs only.

If these zones become substantial, add `lib/dashboard/CONTEXT.md` in the same
slice to record local ownership and forbidden dependencies. Do not create that
context file for a placeholder-only or documentation-only change.

### Dashboard Bounded Contexts

Dashboard backend is an observer-owned adapter context. It may read durable
workflow-runner state through persistence/run-state adapters or explicit
read-only filesystem adapters, then project the result into dashboard DTOs. It
must isolate per-run read/parse failures as degraded dashboard records and must
not persist those degraded records into workflow state.

Dashboard projection is a read-model context. It owns allowlisted DTOs and
classification policy for `Waiting for user`, `Worker running`, `Needs help`,
`Degraded`, and `Done`. It may expose bounded, redacted history excerpts and
artifact metadata, but it must not expose raw baton, raw history, compiled
instructions, private prompts, token-bearing commands, hidden transcripts,
instruction storage paths, preferred worker agent ids, worker binding flags, or
unnecessary host control-plane metadata.

Dashboard UI is a browser-only inspection context. It consumes safe DTOs from
the daemon API/event surface and follows `DESIGN.md`. It must not read
`~/.orbita` directly, infer runner state from filesystem paths, include
drag/drop movement, or show controls that resemble `next`, `continue`,
`write-output`, retry, repair, or manual lane movement.

### Dashboard Relationships

```mermaid
flowchart LR
  runs[(Durable run state
~/.orbita/workflow-runs/v1)]
  observer[Dashboard observer reader
read-only adapter]
  projection[Safe dashboard projection
allowlisted DTOs]
  api[Dashboard daemon API
list, detail, events, static UI]
  sse[SSE-first event surface
lossy updates]
  ui[Browser dashboard UI
board, drawer, mini-map]
  design[DESIGN.md
board/drawer input]

  runs -->|read only| observer
  observer --> projection
  projection --> api
  api --> sse
  api --> ui
  design --> ui
```

The dashboard daemon may rebuild projections by rereading durable state after
restart or watcher loss. Event delivery is lossy and observational: SSE/poll
recovery must never create backpressure into workflow execution, hold run
leases, or delay `workflow-runner` control commands.

### Dashboard Dependency Rules

Binding rules for dashboard code:

- `lib/dashboard/**` must not import runner mutation/control entrypoints, CLI
  command builders, lease authority, write-output/continue/next/
  listPointerTransitions/movePointer API handlers, list-pointer-transitions/
  move-pointer CLI modes, or host worker lifecycle code.
- Browser UI code must depend only on dashboard DTO contracts and browser
  platform APIs; it must not import persistence, filesystem helpers,
  workflow-runner API shells, or Node-only modules.
- Projection code may depend on DTO/schema/value helpers and read-only records,
  but must not depend on CLI argument parsing, process environment, locks,
  leases, or mutation use cases.
- Dashboard server code may coordinate read-only IO and response formatting, but
  workflow-domain decisions still belong in existing entities/use cases and
  dashboard-specific display decisions belong in projection.
- Dashboard artifacts, degraded diagnostics, bounded history excerpts, cursor
  chips, and mini-map data are projections. They are not durable workflow state
  and must not be written back into run directories.

Add mechanical boundary checks for these rules when dashboard code is added.
At minimum, tests/checks must prove absence of lease tokens, token-bearing
commands, raw instruction commands, private prompts, hidden transcripts, raw
instruction paths, preferred agent ids, worker binding flags, and unnecessary
host control-plane metadata in browser-visible DTOs.

### Workflow Loop Policies

Workflow loop limits are an opt-in workflow-document contract. A workflow may
declare `loopPolicies` to bound valid semantic cycles such as review -> fix ->
review or approval -> revision -> approval. Workflows without `loopPolicies`
must validate and run with unchanged behavior.

The intended shape is static-graph first:

- the workflow document owns policy definitions;
- validation expands a finite route graph from literal `next`, `match/cases`,
  approval/user routes, and schema-enumerable dynamic `next` expressions;
- validation detects cyclic regions with SCC/self-loop analysis;
- each policy must select exactly one unambiguous detected region;
- runtime counts selected valid internal route events, not full human-described
  cycle rounds;
- `maxIterations` exhausts when the next selected internal event would exceed
  the limit, and runtime routes to the configured `onLimit` target instead of
  the original cycle target;
- baton stores only loop progress counters in a loop-specific namespace, never
  workflow policy definitions.

Loop policies are separate from output.schema retry. Invalid worker or approval
output that is retried by output.schema validation must not increment loop
policy progress. The retry key shape `<stepId>:output.schema` remains reserved
for output.schema attempts; loop policy progress must use a distinct namespace.

Rejected primary models:

- per-transition `cycleId` labels;
- arbitrary named step scopes that create cycles manually;
- runtime history, repeated cursor, backward-jump, or graph traversal heuristics;
- prompt-only loop limits.

Consecutive pass/success early exit is not part of the first loopPolicies
architecture slice. Do not document or implement it as available behavior unless
a later approved architecture contract adds reset, precedence, and success
target semantics.

Parallel/fanout support is conservative for the first slice. A policy that
depends on ambiguous branch-local, cross-branch, non-convergent, or
non-enumerable fanout routing must fail validation instead of being guessed at
runtime.

## Dependency Rules

Allowed:

- `entrypoints -> use-cases`
- `entrypoints -> persistence`
- `use-cases -> entities`
- `use-cases -> runtime helpers`
- `use-cases -> file contracts`
- `runtime helpers -> entities`
- `runtime helpers -> file contracts`
- `persistence -> DTOs/records/file contracts`
- Workflow loop policy validation may depend on workflow contracts, output
  schema target enumerability, route graph expansion, and SCC/self-loop
  detection; it must not depend on baton history or host adapter state.
- Runtime loop policy enforcement may depend on compiled validation metadata,
  the selected valid route event, and baton progress counters; it must not own
  workflow policy definitions.
- Baton schema may define loop progress storage, but workflow schema remains
  the policy source of truth.

Forbidden:

- `entrypoints -> use-cases/runtime/**`
- `entrypoints/cli -> entrypoints/api`
- `use-cases/<top-level> -> use-cases/<top-level>`
- `use-cases/runtime -> node:fs`
- `use-cases/runtime -> node:path`
- `use-cases/runtime -> persistence`
- `lib/runtime -> node:fs`
- `lib/runtime -> node:path`
- `lib/runtime -> persistence`
- top-level use cases -> catalog readers
- runner runtime -> catalog/config discovery
- `persistence -> use-cases`
- run-state persistence -> startup validation
- `persistence -> entities/Baton/schema/**` after schema ownership migration
- shard runtime/entity helpers -> `node:fs`
- shard runtime/entity helpers -> `node:path`
- shard runtime/entity helpers -> persistence
- shard runtime/entity helpers -> entrypoints
- shard runtime/entity helpers -> dashboard
- persistence -> shard runtime/use-case helpers
- supported command paths or exports for retired legacy surfaces
- dashboard code mutating run state, acquiring leases, invoking runner
  navigation/output/pointer-recovery commands, or exposing private runner
  control data through browser-visible DTOs

## Review Gates

Architecture review must verify:

- the changed source still reveals the layer model
- retired surfaces are absent from supported paths
- no new compatibility wrapper is introduced under a different name
- helper/schema zones are colocated unless shared ownership pressure is proven
- docs, checks, and source agree on supported command surface and dependency
  rules
- pointer recovery docs, API exports, CLI modes, tests, and source agree that
  `listPointerTransitions` and `movePointer` require active lease authority,
  preserve baton state, allow terminal single-cursor rollback along observed
  non-terminal backward edges, reject invalid legacy array cursor state, require
  retained-output acknowledgement where applicable, and expose only redacted
  bounded metadata
- dashboard changes preserve the read-only observer boundary, safe projection
  layer, SSE/poll recovery behavior, degraded per-run isolation, and
  `DESIGN.md` board/drawer/no-control contract
- dashboard tests or boundary checks prove browser DTOs exclude private
  runner/control fields and dashboard code does not import or call runner
  mutation/control surfaces
- shard docs, workflow schema, Baton schema, runtime behavior, tests, and boundary checks agree on the first-class `kind: "shard"` contract and `state.shards` ownership
- shard execution keeps `baton.cursor` on the parent step, snapshots values once, batches by activation/index, stores bounded output references, and runs the genuine final step worker
- shard DTO and prompt tests prove values appear only through explicitly authored interpolation and public request context excludes raw values, prompts, transcripts, private paths, and standalone token fields

Backend review must verify:

- canonical `next`, `instructions`, `write-output`, `report-stop`,
  `resolve-stop`, and `continue` behavior remains coherent
- output validation, artifact metadata handling, run-state persistence, leases,
  history, and current migration semantics did not change accidentally
- imports obey the dependency rules above
- custom workflow roots validate before run creation, retain source-qualified
  catalog identity, and do not widen resource access by duplicate workflow name
- shard `input.shards` expansion snapshots arbitrary JSON values once, restart rerenders the durable current batch, accepted outputs remain single primary records, and final worker output follows normal `next`
- existing sequential, approval, fanout, output schema, lease, artifact/debug-summary, history, worker binding, and non-blocking stop behavior remains compatible

QA/reliability review must verify:

- focused workflow-runner checks cover canonical command behavior
- boundary checks fail resolved forbidden imports and retired-surface exposure
- retired legacy names are absent from supported command paths, exports, docs,
  and allow lists
- shard workflow tests cover literal and dynamic arrays, arbitrary JSON values, explicit value/index/total interpolation, absent implicit JSON injection, batching, durable resume, bounded output references, genuine final worker execution, invalid empty/non-array inputs, and fanout regressions

Security and privacy review must verify:

- artifact path handling remains constrained to approved run artifact
  directories
- run-state, lease, history, and output records do not expose new private data
  surfaces while ownership moves
- shard values are durably snapshotted only as required for resume, omitted from public request DTOs, and rendered into prompts only through explicit interpolation

## Non-Goals

- Preserve backward compatibility for obsolete legacy entrypoints, aliases, or
  wrappers.
- Redesign the current public workflow-runner protocol beyond removing obsolete
  surfaces from supported architecture.
- Change host lifecycle semantics for the canonical current runner surface.
- Keep `start-run`, `persist-run-state`, or `workflow-interpreter` as temporary
  exceptions.
- Add broad framework seams where a narrow colocated helper or named use-case
  API is enough.
- Add brittle boundary rules for ownership questions that remain unresolved.
- Add numeric shard-count shorthand, compatibility aliases, optional/fail-fast policy, branch tables, nested per-value subgraphs, distributed child runs, dashboard mutation behavior, or pointer-recovery mutation for synthetic shard requests.
