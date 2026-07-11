# Run-state persistence context

`persistence/run-state/**` owns the split-file durable run-state aggregate: paths, locks, atomic writes, durable commits, and persisted-state schema.

Binding rules:

- No compatibility facades outside this folder are approved for run-state read/write.
- API and CLI callers import `PersistedRunStateReader.mjs`, `PersistedRunStateWriter.mjs`, `paths.mjs`, and `lock.mjs` directly.
- This folder must not import DTOs or runtime use-cases. Projection belongs at the entrypoint/use-case boundary.
- A persisted-state snapshot is a validated command-local record, not a cache.
  Snapshot reuse is allowed only when the reader captured it inside the same
  active per-run lock scope; the writer returns the replacement snapshot after
  each durable write. Snapshots and their baton/state graph are deeply frozen.
  When the same-scope transaction completes, the returned snapshot and rollback
  bytes are derived from the validated transition without rereading the full
  aggregate. A pending commit supersedes the caller snapshot. Direct
  writes outside the aggregate writer, including append-only history entries,
  invalidate the snapshot before any later aggregate update.
- Snapshot reuse must never weaken pre-lock or under-lock authority checks,
  recovery, rollback, fsync, atomic rename, schema validation, or path/symlink
  safety. Snapshot lock tokens and exact rollback target bytes are process-local
  metadata and must never be serialized into run state. Recovery may reuse those
  bytes only for the same in-scope snapshot. A v2 history transaction may use
  its persisted base existence and byte size for rollback because append never
  changes the base prefix; other rollback targets must be reread when no scoped
  snapshot is available.
- `.workflow-runner/authority.json` is the canonical per-run record for absolute
  workflow binding, private claim context, lifecycle/task projection, and
  token-hash lease authority. Raw lease tokens, run-state snapshots, prompts,
  and host/session metadata must never be written to it.
- Runner commands must validate authority before waiting on the per-run lock and
  re-read/revalidate it while holding that lock. Successful renewal writes only
  the per-run record atomically. Matching-token renewal preserves `tokenEpoch`;
  a tokenless stale takeover increments it while rotating the token hash.
- `runs.json` is a discovery and list/dashboard projection. Once a valid per-run
  authority file exists, runner binding, claim context, lease checks, status,
  and task metadata must not trust a conflicting catalog copy. Warm runner
  commands must not read, lock, or rewrite the catalog. Catalog list/dashboard
  readers overlay per-run authority with bounded concurrency.
- A legacy v1 catalog entry may supply authority only while the per-run file is
  absent. The first successful mutating runner or claim operation persists the
  canonical record. A present but corrupt, mismatched, or symlinked authority
  file fails closed and must never trigger legacy fallback.
- New durable commits use append transaction v2. The pending record stores one
  transaction id, `baseExists`, `baseSize`, bounded `entryText`, its SHA-256
  hash, and requested baton/current-request values. It must not contain the full
  existing history. The transaction id is also written into the human-facing
  history entry.
- Retriable `continue` and `move-pointer` commits persist a canonical input
  fingerprint, pre-commit baton signature, and original public result in the
  pending transaction. Recovery publishes `operation-receipt.json` before
  unlinking the journal. A matching retry replays the receipt only while its
  post-commit baton signature is still current; a later baton mutation
  supersedes it. Mismatched pending retries fail closed. Legacy v1 and
  pre-replay-v2 journals omit this metadata and remain recoverable.
  Replay results replace the active lease token with a private placeholder on
  disk and restore it only in the authenticated command response.
- V2 recovery is byte-oriented and idempotent. The history file may be exactly
  at the recorded base, contain an exact partial prefix of `entryText`, or
  contain the full entry. Recovery truncates only the partial transaction tail,
  writes the complete entry at `baseSize`, fsyncs it, then applies the remaining
  durable targets. Any unrelated tail, file shorter than the base, oversized
  append, hash mismatch, unsafe path, or symlink fails closed. A complete entry
  is never appended twice. Legacy v1 full-history pending records remain
  recoverable but are not emitted by new writes.
- Baton-only command paths retain `{ mode: 'file-ref', path }` plus process-local
  history byte size and do not read the history body. Full history reads are
  allowed only for consumers whose behavior depends on history content, such as
  pointer projection/mutation, dashboard projection, and orchestrator debug-note
  deduplication. Neither form is cached across commands.
- New `current-requests.json` records bind requests to the post-commit baton
  file signature (absolute path, device/inode, mtime/ctime, and byte size), computed after the baton
  side effect during recovery. This avoids reserializing a large unchanged baton
  only to hash it. Legacy 64-hex semantic hashes remain readable until the next
  successful write refreshes the record. Workflow file signatures keep the same
  file-signature contract.
- An unchanged baton is parsed and schema-validated once per command and is not
  reserialized merely to bind current requests. A changed baton remains one
  canonical atomic JSON file, so clone/serialization/fsync cost is necessarily
  linear in its size. Segmenting baton state is outside this persistence slice.
- Durable workflow state is baton plus history; per-run authority is separate
  durable control-plane state. Current host responses, request lists, and
  compiled prompts are projections of baton plus the authority-bound workflow.
- API `next`, `continue`, `write-output`, and `instructions` read persisted baton before rendering; `continue` and `write-output` validate accepted outputs against the freshly rendered current requests, and `instructions` returns the freshly rendered prompt for the current step.
- Pointer recovery API functions `listPointerTransitions` and `movePointer` use
  CLI modes `list-pointer-transitions` and `move-pointer`. They read persisted
  baton and durable history through this run-state boundary. Both require active
  lease authority. `listPointerTransitions` is a logical read: it may use the
  run-state boundary for consistency, but it must not initialize missing run
  state, append history, renew authority, or mutate baton/current pointer
  state. `movePointer` must use the existing lease, lock, recover, validate,
  durable writer, history append, and per-run authority renewal path; it may change only
  baton cursor/status plus persistence metadata owned by that path.
- Pointer recovery must never edit private run files directly or use an
  alternate manual state writer. It must not roll back, prune, rewrite, or clean
  `baton.state`, accepted outputs, artifacts/results, worker bindings, prompt
  markers, attempts, or existing history content.
- `history.md` is the managed, deterministic, human-facing flight recorder for one run. It records lifecycle/control-flow history, accepted-output summaries, required bounded worker debug-summary side-channel content, terminal outcomes, and safe public failures; it is not a transcript store.
- Standalone deduplicated history writes create a durable pending marker before
  append, embed the deterministic transaction id in the entry, fsync history,
  then atomically mark it applied. Recovery detects an already appended entry,
  preventing both duplicate records and permanent suppression across crashes.
- Heartbeat age alone never makes a lock stale when its owner PID is verifiably
  alive on the same host. Host-tagged metadata prevents treating an unrelated
  local PID as a remote owner's liveness proof.
- `write-output` owns accepted-output history entries after output schema validation, artifact path validation, and worker debug-summary side-channel validation. For `run_worker`, accepted-output projection requires the exact generated `--debug-summary-file` path, validates a non-empty regular file, and reads only a bounded prefix; the debug summary is not part of baton/state. Rich debug-summary body ingestion is suppressible and is bounded after normalization to 4 KiB or 80 lines with a truncation marker.
- `continue` owns transition and terminal history, and those history writes must stay atomic with baton transition durability. Retry/recovery must not duplicate, corrupt, or advance misleading history entries ahead of baton state.
- `movePointer` owns pointer-recovery history entries. They must be append-only
  and atomic with the cursor/status update, recording bounded before/after
  cursor/status edge, transition id, direction, and retained-output step ids or
  `none`. Existing history is never rewritten by pointer recovery.
- Retained accepted-output warnings for pointer recovery must be derived from
  the same per-step accepted-output surface in `baton.state[stepId]` that
  `continue` reads. A reusable helper may be extracted only inside runner-owned
  code and must preserve current `continue` reuse semantics.
- Public command failure history may be appended only when a safe run directory, matching lease context, and managed history path are available. Record only exact relevant public error text after host-safe redaction, bounded after normalization to 2 KiB or 40 lines with a truncation marker. Unsafe or missing context means no history write.
- History must never scrape or persist hidden host transcripts, session registries, private prompts, lease tokens, instruction storage paths, worker lifecycle state, or other host control-plane metadata.
