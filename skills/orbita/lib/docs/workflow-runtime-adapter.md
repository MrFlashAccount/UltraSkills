# Workflow Runner Host Adapter Boundary

## Status

Host-adapter shape plus first-class shard and fanout runtime contracts.

## Boundary

Deterministic code owns the workflow loop:

- start or resume a run;
- render the current step prompt;
- return host action requests;
- apply host outputs already accepted by the validating writer;
- persist baton state and history;
- repeat until another host action is needed or the workflow reaches `done`.

The host adapter is thin. It executes requests with whatever capabilities the environment provides, writes each host action result through the runner's validating writer, and calls the runner again after outputs are accepted. It does not choose transitions.

## Semantic loop limits

Workflow loop limits are interpreter-owned. When a workflow declares validated
`loopPolicies`, the runner enforces them after output.schema validation has
succeeded and after the selected route target has been resolved, but before the
cursor is advanced.

`maxIterations` counts selected valid internal route events inside the validated
SCC/self-loop region. It does not count malformed output.schema retry attempts
and does not count full human-described cycle rounds. When the next selected
internal route event would exceed the limit, the runner persists loop progress
and routes to the configured `onLimit` target instead of the original cycle
target.

Baton stores loop progress counters only. It must not store workflow policy
definitions such as selected steps, limits, or targets. Loop progress uses a
loop-specific namespace distinct from output.schema retry attempt keys such as
`<stepId>:output.schema`.

The host adapter does not enforce loop limits, choose `onLimit`, reset counters,
or infer cycles from history. It only observes the runner's next public
directive after accepted output is applied. Runtime history, repeated cursors,
backward jumps, per-transition `cycleId`, manual scopes, and prompt-only limits
are not supported loop policy mechanisms.

Consecutive pass/success early exit is not part of the current public runtime
contract. Hosts and workflow authors must not rely on success streak or
`onSuccess` behavior unless a later workflow contract explicitly adds it.

## Runner commands

```bash
bun "$ORBITA_SKILL_ROOT/lib/entrypoints/cli/workflow-runner.mjs" next --lease-token <token> --run-id <run-id> [--workflow <workflow-file>] [--user-prompt <text> | --user-prompt-file <path>]
bun "$ORBITA_SKILL_ROOT/lib/entrypoints/cli/workflow-runner.mjs" write-output --lease-token <token> --run-id <run-id> --step-id <id> [--debug-summary-file <path>] [--json <json>] [--workflow <workflow-file>]
bun "$ORBITA_SKILL_ROOT/lib/entrypoints/cli/workflow-runner.mjs" continue --lease-token <token> --run-id <run-id> [--bind-agent <step-id=agent-id>...] [--orchestrator-debug-json <json> | --orchestrator-debug-file <path>] [--workflow <workflow-file>]
bun "$ORBITA_SKILL_ROOT/lib/entrypoints/cli/workflow-runner.mjs" instructions [--follow-up] --run-id <run-id> --step-id <id> --lease-token <token>
bun "$ORBITA_SKILL_ROOT/lib/entrypoints/cli/workflow-runner.mjs" list-pointer-transitions --lease-token <token> --run-id <run-id> [--workflow <workflow-file>]
bun "$ORBITA_SKILL_ROOT/lib/entrypoints/cli/workflow-runner.mjs" move-pointer --run-id <run-id> --transition-id <id> --lease-token <token> [--workflow <workflow-file>]
```

`--workflow` accepts either a TOML or JSON workflow file. `next` and `continue` also accept `--only-instructions`; with that flag stdout is exactly the `orchestratorInstruction` text instead of the full JSON host response. `next` creates the run files if needed and returns the current host work. `write-output` validates and accepts one current request output directly into baton/state, then returns only acceptance JSON or validation errors; it does not accept `--only-instructions`, does not drive orchestrator navigation, and must not accept or mutate worker binding metadata. `continue` can also accept repeatable `--bind-agent <step-id=agent-id>` values and one orchestrator debug note through `--orchestrator-debug-json` or `--orchestrator-debug-file`; it records those runner-owned host side effects, applies already-accepted outputs from baton/state, persists the new baton, and returns the next host work. `instructions` prints only the compiled instructions for one current requested step, does not accept `--only-instructions`, and fails for unknown or unsafe step ids. Current requests and instructions are rendered from the indexed workflow plus `baton.json`; durable runner state is baton plus history plus advisory top-level worker bindings. Every write-capable, bind-capable, or instruction-loading command validates a fresh explicit `--lease-token` before creating run directories, locks, index entries, baton/history, binding metadata, or durable commit files; `runId` is identity only, and durable lease state keeps only token hash, token epoch, and lease expiry.

The API functions `listPointerTransitions` and `movePointer` are exposed through
the CLI modes `list-pointer-transitions` and `move-pointer`. They are operator
recovery commands, not normal workflow-loop commands. Both validate a fresh
explicit `--lease-token`. `listPointerTransitions` is a logical read but remains
lease-required because it exposes bounded pointer/history recovery metadata. It
returns only current pointer, observed earlier transition options, and
unsupported reasons; it must not initialize
missing run state, append history, update the run index, mutate baton/current
pointer state, or emit raw baton, raw history, private paths, lease data, or
token-bearing commands. `movePointer` accepts one listed observed transition id
and mutates only baton cursor/status through the existing lease, lock,
validation, durable writer, history append, and run-index path. One move may
target any earlier cursor reachable through the run's observed history. It
must not roll back, prune, rewrite, or clean `baton.state`, accepted outputs,
artifacts/results, worker bindings, prompt markers, attempts, or existing
history. Terminal `done` runs may move backward to an observed non-terminal
step; array cursors are invalid persisted state. Baton state is preserved
without a separate acknowledgement gate.

Commands returned in host responses are rendered with the absolute path to `workflow-runner.mjs` and an explicit absolute `--runs-root`, quoted for shell execution, so a worker or host can run them from any current working directory. For human-authored commands, set `ORBITA_SKILL_ROOT` to the directory containing `skills/orbita/SKILL.md` and invoke CLI entrypoints through `$ORBITA_SKILL_ROOT/lib/entrypoints/cli/...`; do not rely on the current working directory.

The default runs root is `~/.orbita/workflow-runs/v1`, or `$ORBITA_HOME/workflow-runs/v1` when `ORBITA_HOME` is set. Hosts that need a different storage location must set the single explicit override `WORKFLOW_RUNS_ROOT` before the first run command.

### Startup user prompt

When starting a new run, `next` may receive the raw startup user prompt with `--user-prompt` or `--user-prompt-file`. The runner stores it once as top-level `baton.user_prompt`. Existing runs are resumed as-is: later `next` calls do not overwrite `baton.user_prompt`, and `continue` preserves it while advancing the baton.

At run initialization, the runner deterministically selects and persists `baton.user_prompt_target` from the startup topology. A target is stable only when all possible startup paths that can be chosen before the first worker guarantee the same worker target; ambiguous dynamic transitions, divergent `match/cases`, and terminal/no-worker `match/cases` branches fail loudly instead of accepting a prompt that might be unused.

The runner/interpreter injects the startup prompt only into the render context for the persisted `baton.user_prompt_target` until that selected worker's output is applied. Rendering validates that the saved target is still defined, is still a worker, and is present whenever the current response renders workers or reaches a terminal step; otherwise the runner fails rather than silently dropping `baton.user_prompt`. It persists `baton.user_prompt_injected: true` only when applying that selected worker output, so a crash or repeated `next` before completion keeps the prompt in that same worker's instructions, while resume or workflow-shape drift after completion cannot reinject it into a later worker. The template compiler only renders a `## User prompt` section for worker steps when that render-time value is passed; it does not decide eligibility itself. `workflow.start` may be a control step; approval/user-gate answers are separate host interactions, not startup `user_prompt`, and later workers do not receive this section unless the workflow explicitly carries derived context through normal state/output paths.

## Workflow shards

A `kind = "shard"` step applies one nested worker template to a non-empty
array of values in bounded parallel batches, then runs the genuine final worker
represented by the shard step. It is a generic execution pattern, not a review,
validation, coverage, or role-specific policy.

The authoring contract is:

- normal top-level `input` and `output` for the final worker;
- `input.shards` as a non-empty literal JSON array or schema-covered
  `input.*` expression resolving to a non-empty array;
- one nested `worker` template for every shard request;
- optional `max_parallel` from 1 through 16;
- normal `next` after the final worker succeeds.

Array elements may be any JSON values. The runner does not accept numeric
shard-count shorthand and does not require author-provided ids. It creates
synthetic request ids from parent step, activation, and array index.

The resolved array is snapshotted once under `baton.state.shards`. Partial
completion and resume reuse the same values and order. Accepted output remains
once under its synthetic request id; shard control state stores only index,
request id, status, and `output_ref`.

Shard worker prompts may explicitly interpolate `${{ shard.value }}`,
`${{ shard.index }}`, `${{ shard.total }}`, and nested value paths. These
expressions use normal prompt interpolation rendering. The runner never appends
the shard value, JSON context, or shard metadata to a worker prompt implicitly.

Public shard host requests expose only parent step id, activation, phase, index,
total, and request id. They do not expose the raw value, hidden prompt,
transcript, private paths, output paths, session/lifecycle internals, or
standalone lease/token fields. Protocol tokens remain confined to generated
command strings.

The cursor remains the shard step during parallel batches and the final worker.
After all shard outputs are accepted, the next response requests the shard step
itself. Its accepted output follows normal output validation and `next`
transition behavior. There is no separate dispatch step, aggregation section,
or runtime-generated completion output.

Fanout remains the fixed named-branch pattern. Shard is the homogeneous
value-partition pattern. Neither is a compatibility wrapper for the other.

## Host request response

Worker steps with an explicit logical `agent` may declare fresh-worker runtime preferences per host harness. Use a dotted key to keep TOML authoring compact:

```toml
[steps.architecture_draft]
name = "Architecture draft"
kind = "worker"
agent = "architect"
agent_runtime.codex = { model = "gpt-5.5", thinking_level = "high" }
```

Shard workflows put parallel-worker fields under `steps.<id>.worker`; generated shard requests inherit that source worker/template configuration. `agent_runtime` is invalid without an explicit source `agent`, and each harness profile contains exactly `model` and `thinking_level`.

The current harness is private claim control-plane state in the runs index as `claimContext: { harness }`, next to the lease. Plain create stores no claim context. Create-with-claim and every successful claim replace it with the supplied harness; a successful claim without a harness clears it, while heartbeat preserves it. It is not exposed in the baton or public run list.

Harness matching is ASCII case-insensitive: new successful claims persist a lowercase harness, while runtime also folds legacy mixed-case claim state and workflow keys. Workflow keys that differ only by case are rejected as ambiguous. On a match, the executable source worker's `run_worker` request includes `agentRuntime: { model, thinkingLevel }`, and `--only-instructions` adds one short sentence telling the host which model and thinking level to use for a fresh subagent. Orbita leaves configured model and thinking values unchanged. A missing source agent, claim harness, or profile match emits neither the field nor the sentence. Restored preferred workers keep their existing runtime; a fresh fallback applies the preference.

When host work is needed, the runner returns:

```json
{
  "status": "needs_host_actions",
  "orchestratorInstruction": "Supersedes all previous workflow-runner stdout.\nExecute every current host request below and wait until all requested actions finish.\nUse the JSON response requests field as the machine-readable source when available; this stdout keeps a compact executable copy for --only-instructions mode.\n\nCurrent host requests:\n- run_worker: step_id\n  fresh-worker instruction-loader command: bun '/absolute/path/to/skills/orbita/lib/entrypoints/cli/workflow-runner.mjs' instructions --run-id 'run_id' --step-id 'step_id' --runs-root '/workspace/.orbita/workflow-runs/v1' --lease-token <lease-token>\n  send that command to the worker bootstrap; do not run it in the orchestrator\n  preferred-worker follow-up instruction-loader command: bun '/absolute/path/to/skills/orbita/lib/entrypoints/cli/workflow-runner.mjs' instructions --follow-up --run-id 'run_id' --step-id 'step_id' --runs-root '/workspace/.orbita/workflow-runs/v1' --lease-token <lease-token>\n  send that command only when restoring the preferred worker; do not run it in the orchestrator\n  pass actual worker id to continue: --bind-agent 'step_id=<agent-id>'\nThen run this single continue command after every current request has accepted output. Replace every <agent-id> placeholder with the actual selected worker id, and replace the debug JSON placeholder with a concise orchestrator debug summary covering completed host actions, rationale, commands/tools used, validation/evidence, and remaining risks or blockers. Do not include private prompts, hidden reasoning, tokens, or raw transcripts.\nbun '/absolute/path/to/skills/orbita/lib/entrypoints/cli/workflow-runner.mjs' continue --run-id 'run_id' --runs-root '/workspace/.orbita/workflow-runs/v1' --lease-token <lease-token> --bind-agent 'step_id=<agent-id>' --orchestrator-debug-json '<paste orchestrator debug JSON here>' --only-instructions\nFollow that stdout instruction exactly.",
  "baton": {},
  "requests": [
    {
      "id": "step_id",
      "stepId": "step_id",
      "action": "run_worker",
      "preferredAgentId": null,
      "loadInstructionsCommand": "bun '/absolute/path/to/skills/orbita/lib/entrypoints/cli/workflow-runner.mjs' instructions --run-id 'run_id' --step-id 'step_id' --runs-root '/workspace/.orbita/workflow-runs/v1' --lease-token <lease-token>",
      "loadFollowupInstructionsCommand": "bun '/absolute/path/to/skills/orbita/lib/entrypoints/cli/workflow-runner.mjs' instructions --follow-up --run-id 'run_id' --step-id 'step_id' --runs-root '/workspace/.orbita/workflow-runs/v1' --lease-token <lease-token>"
    }
  ]
}
```

`orchestratorInstruction` is a machine-visible directive for the host/orchestrator. Runner stdout is an active directive, not durable history: each new `next` or `continue --only-instructions` stdout supersedes every previous runner stdout. When `status` is `needs_host_actions`, the host must treat the response as non-terminal: finish every current host request, run the embedded `continue --only-instructions` command, and follow the next directive returned by runner stdout. Full JSON responses expose machine-readable request objects in the top-level `requests` field; `--only-instructions` stdout carries a compact executable copy of the current request commands instead of repeating the full request JSON array. `resolve_non_blocking_stop` requests are executed by the orchestrator itself: resolve the bounded `nonBlockingStop`, write structured resolution JSON through `resolveStopCommand`, then continue. The next response dispatches the same request with resolved context. `run_worker` requests are executed by starting or restoring a worker/subagent with a command string selected from the request: use `loadFollowupInstructionsCommand` only when the host can continue or restore the opaque `preferredAgentId`, otherwise use `loadInstructionsCommand` for a fresh worker. When `agentRuntime` is present, the host applies it only while creating that fresh worker; it does not alter a restored preferred worker or copy the preference into the worker prompt. For resolved non-blocking stops, both command paths render the same bounded resolution context into the loaded worker instructions. The selected command is embedded in the strict worker bootstrap and watchdog policy from `skills/orbita/SKILL.md`; the full bootstrap text intentionally lives in the skill instead of every runner response. After the host knows the actual selected worker id, it passes that id through the embedded `continue --bind-agent '<step-id>=<agent-id>'` flag; this writes only `baton.workerBindings[stepId]` and does not use `write-output`. `wait_for_approval` requests are executed by the orchestrator itself; approval requests must not carry `preferredAgentId`, `loadFollowupInstructionsCommand`, or `agentRuntime`. The runner stdout inlines the compiled approval prompt for each current approval request, and the orchestrator uses that prompt as the complete source for the user-facing approval message, including required-read files, approval attachments, prompt input context, workflow step prompt, output contract, and validating writer command. Prompt-input artifacts selected by an approval step render under `Approval attachments`, not `Required reads`; the host attaches them without opening or reading their contents. Non-approval worker/reviewer steps still receive selected artifacts as required reads. In Codex/Codex Desktop, attaching means rendering each listed local artifact as a Markdown file link with an absolute target, for example `[reasons-canvas-research.md](/absolute/path/reasons-canvas-research.md)`; a plain text path, artifact id, or summary is not an attachment. If attachment/file-link rendering is unavailable, the approval message must state that capability gap and name the affected path/reference. Only `done` is terminal. A request reports missing help through `report-stop`; this never becomes step output or advances the cursor.

Runner stdout commands include the explicit lease token when the runner was called with one. If a runner-returned command still contains a `<lease-token>` placeholder, hosts must substitute the fresh explicit lease token before executing it; the runner does not read a token from environment variables.

The public host request contract is intentionally narrow: requested action identity and step identity are always public. `resolve_non_blocking_stop` requests additionally expose only bounded `nonBlockingStop` details and `resolveStopCommand`; they must not expose worker reuse fields. `run_worker` requests additionally expose only `loadInstructionsCommand`, `loadFollowupInstructionsCommand`, `preferredAgentId`, optional `agentRuntime`, and bounded `nonBlockingStop` details when a resolved recovery is being continued; they must not expose `attemptId`, agent objects, lifecycle state, session registries, transcripts, output paths, or other control-plane metadata. `preferredAgentId` is either an opaque worker id from top-level `baton.workerBindings[stepId]` or `null` when no binding exists. `agentRuntime` is an advisory `{ model, thinkingLevel }` fresh-spawn preference selected from the executable source worker's case-insensitively matched per-harness profile; provider-specific interpretation belongs to the harness. Approval requests may additionally include output-schema metadata when the workflow step declares `output.schema`, but must not include worker reuse or runtime preference fields. `outputSchema` is the raw workflow reference. `resolvedOutputSchema` is the preferred host-adapter contract when present: it contains `{ ref, schema }`, where `ref` is the same raw workflow reference and `schema` is the JSON payload describing the normalized answer expected back from the host. Neither field exposes runner filesystem paths. Instruction storage paths are private runner state. Output paths are not part of the request contract.

Terminal statuses are:

- `done`

A CLI failure is an execution error and should be reported by the host adapter instead of forcing a workflow transition.

## Output capture

The host wrapper writes completed `run_worker` and `wait_for_approval` results through `workflow-runner write-output`. The command validates strict JSON against the current request/step output schema and accepts the normalized value directly into baton/state. A `resolve_non_blocking_stop` request is control-plane work instead: submit its structured `resolution` object plus the exact current `nonBlockingStop.stop_id` through the generated `resolveStopCommand` / `workflow-runner resolve-stop`; it records recovery metadata without advancing the workflow step. Exact retries are idempotent, while conflicting or stale resolution ids are rejected. For `run_worker` requests, `write-output` also requires the generated `--debug-summary-file` path and reads that side-channel only after the JSON output validates. It is a pure task-output path: it must not accept, store, emit, or mutate worker binding/control-plane metadata. There is no output-path handoff from worker to orchestrator, and `workflow-runner continue` does not accept output paths.

Retained accepted-output detection for pointer recovery uses the same per-step
accepted-output surface in `baton.state[stepId]` that `continue` reads. Pointer
recovery must not invent a separate scanner over arbitrary baton state. If the
accepted-output lookup is extracted for reuse, it remains runner-owned and must
preserve current `continue` reuse semantics.

`write-output` owns accepted-output history projection. After schema validation, artifact path validation, and required worker debug-summary side-channel validation succeed, it may append a deterministic entry to the run's managed `history.md` from the accepted output, accepted step metadata, and the bounded side-channel debug summary. This entry is part of the same durable output acceptance path as the baton update; hidden host transcripts, subagent sessions, private prompts, lease tokens, instruction storage paths, and worker/control-plane metadata must never be scraped or written into history.

Accepted-output history uses two layers:

- A compact fallback summary derived from public accepted output fields such as `outcome`, `approval`, `artifacts`, `results`, and the accepted step id. This fallback remains enabled for compatible existing worker outputs and for debug-history disabled mode.
- A required rich body side-channel for `run_worker` requests, passed through the exact generated `--debug-summary-file` path. Generated worker instructions tell workers to write a concise operational rationale to that file before running the validating writer command. The file is not part of the JSON output, is not stored in baton/state, and does not depend on the worker output schema shape. Rich body ingestion requires the exact expected path, a non-empty regular file, reads only a bounded prefix before normalization, is suppressible by debug-history disabled mode, and is bounded after normalization to 4 KiB or 80 lines, whichever limit is hit first. Truncated rich bodies must include an explicit truncation marker.
- A host/orchestrator debug note passed through `continue --orchestrator-debug-json` or `--orchestrator-debug-file`, used to preserve why the host chose a worker reuse/fresh spawn path, which host actions and commands/tools ran, what evidence was observed, and remaining risks before `continue` advances. This note is bounded, redacted, deduplicated, and never written by direct host file access.

When debug-history rich ingestion is disabled, `write-output` still validates the required worker debug-summary side-channel but suppresses its body while preserving the compact accepted-output fallback summary and the normal control-flow history. The debug summary must not require a new generic debug field in the worker-output envelope or a baton schema expansion.

On success, `write-output` stdout is acceptance JSON such as `{ "ok": true, "accepted": true, ... }`. The host must not treat `write-output` stdout as the next workflow directive: it only marks one current request output as accepted. After every current request is accepted, the host continues following the latest `next`/`continue` instruction and runs the embedded `continue --only-instructions` command.

Typical worker output envelope:

```json
{
  "outcome": "ready",
  "artifacts": [],
  "results": [{ "type": "summary", "summary": "completed" }]
}
```

Approval output without a declared schema is any host/user JSON object compatible with the approval transition, commonly:

```json
{
  "approval": "approved"
}
```

When an approval step declares `output.schema`, the host should normalize the user's answer as strict JSON matching that schema before calling `write-output`. The schema normalizes the answer shape for validation/routing.

After bounded automatic recovery fails, missing host capability is reported through the control channel, not as step output or a transition decision:

```json
{
  "non_blocking_stop": {
    "stop_id": "123e4567-e89b-42d3-a456-426614174000",
    "summary": "Missing host capability",
    "needed": "Provide a worker-capable host"
  }
}
```

Submit that object through the request's generated `report-stop` command. Do not send it to `write-output`.
Generate one UUID v4 `stop_id` for each genuinely new stop. Retrying the exact report with the same id is idempotent; reusing an id with different content is rejected, and replaying a resolved report cannot erase its resolution. Managed history stores only this id for report/resolve lifecycle entries, not stop or resolution free text.

For each requested step, accept output first:

```bash
bun "$ORBITA_SKILL_ROOT/lib/entrypoints/cli/workflow-runner.mjs" write-output --lease-token "$WORKFLOW_RUN_TOKEN" --run-id "$RUN_ID" --step-id "step_id" --debug-summary-file "$RUN_DIR/step_id/debug-summary.md" --workflow "$WORKFLOW" <<'JSON'
{ "outcome": "ready", "artifacts": [], "results": [] }
JSON
```

After every current request has submitted completed output or a non-blocking stop, continue without `--output`:

```bash
bun "$ORBITA_SKILL_ROOT/lib/entrypoints/cli/workflow-runner.mjs" continue --lease-token "$WORKFLOW_RUN_TOKEN" --run-id "$RUN_ID" --workflow "$WORKFLOW" --only-instructions
```

For fanout branch requests, call `write-output` once per requested synthetic `stepId`; `continue` collects accepted values from baton/state into the internal `{ "steps": { ... } }` envelope before applying the current fanout batch.

## History ownership

`history.md` is the single human-facing flight recorder for one run. It is deterministic per run and may contain lifecycle/control-flow events, accepted worker output summaries, required bounded worker debug-summary side-channel content, terminal outcomes, and exact relevant public errors when they are safely attributable. It is not a transcript store and not a private runner-state export.

`continue` owns transition and terminal history. Transition entries are written only while applying already-accepted outputs and advancing baton state, so the visible history stays aligned with durable workflow state. Terminal `done` outcomes must be reconstructable from the transition/terminal history without reading private request or transcript state.

Public runner failure history is allowed only when all attribution checks pass: the command has a safe run directory, the lease context matches the run being operated on, and the target is the managed `history.md` path for that run. The recorded text must be exact relevant public error text after host-safe redaction, bounded after normalization to 2 KiB or 40 lines, whichever limit is hit first, with an explicit truncation marker when shortened. If any context is unsafe or missing, no failure-history write occurs. Durable retry/recovery must not duplicate failure entries, corrupt history, or advance misleading history ahead of baton state.

History entries must preserve the public boundary: no hidden transcripts, session registries, worker lifecycle internals, private prompts, lease tokens, raw instruction storage paths, or other host control-plane metadata. Artifact manifests may be referenced only through accepted output metadata; rich worker debug-summary content may be read only through the exact generated `--debug-summary-file` side-channel and only under the enabled policy above. Orchestrator debug notes must go through runner-owned command flags, usually the embedded `continue --orchestrator-debug-json`; the host must not inspect or mutate `history.md` directly.

Pointer recovery history is append-only and bounded. A successful `movePointer`
entry records the transition id, direction, before/after cursor/status edge, and
retained-output step ids or `none`. State preservation is enforced by the
pointer-only mutation boundary and validation, not by copying full state into the
history entry. The entry must not copy full accepted outputs, raw baton/history,
private paths, lease tokens, or token hashes. Existing history content is never
rewritten by pointer
recovery.

## OpenClaw mapping example

OpenClaw is one possible host adapter:

- `run_worker` maps to spawning a fresh subagent/ACP session or continuing/restoring the opaque `preferredAgentId` when the host can do so.
- Level 1 loop continuity across workflow iterations is prompt-only: draft/critic/revision workers must rely on explicit prompt input and prior accepted step outputs, not persistent worker lifecycle machinery. A concise clarification is an allowed same-session continuation: the subagent asks, pauses, receives the routed user reply in that same clarification session, and continues from existing context without restart or context widening. Worker reuse hints only choose between `loadInstructionsCommand` and `loadFollowupInstructionsCommand`; they do not create lifecycle/session semantics.
- The bootstrap must use this shape and substitute `<command>` with either `loadFollowupInstructionsCommand` for a restored preferred worker or `loadInstructionsCommand` for a fresh worker:

  ```text
  Load the step instructions by running:

  <command>

  Then follow the loaded instructions exactly.

  Do not add any behavior, role, output format, or constraints beyond the loaded instructions.

  If the instructions cannot be loaded, stop with an error and do not continue.
  ```

- After the wrapper knows the actual selected worker id, it passes that id through the embedded `continue --bind-agent '<step-id>=<agent-id>'` flag. This binding is advisory, retry-safe, and stored only as top-level `baton.workerBindings[stepId]`.
- The loaded instructions must provide an exact validating writer command/tool. The subagent should use that single command/tool to write its generated JSON. If the command/tool returns validation errors, the subagent fixes the JSON and reruns the same command/tool for a bounded number of attempts. On success, the subagent reports acceptance, not an output path.
- `wait_for_approval` does not spawn a worker. The wrapper/orchestrator follows the inline approval prompt in runner stdout, reads only files under `Required reads`, renders files under `Approval attachments` without opening them, asks only for the requested decision/input, and writes the normalized approval JSON with the validating writer command from that prompt.
- If no exact worker-side validating writer protocol is provided, the wrapper uses the current `report-stop` command instead of capturing a fallback output file.
- The wrapper calls the latest embedded `workflow-runner.mjs continue` command without `--output` after every current request has submitted completed output or a stop resolution, replacing any bind/debug placeholders in that single command.
- If OpenClaw cannot provide the requested capability, the wrapper reports a non-blocking stop through `report-stop` when possible.
- The adapter repeats until the runner returns terminal `done`.

This mapping is not part of the portable workflow contract. Other hosts can execute the same requests differently as long as they accept compatible JSON through `write-output` before `continue`. If a host action produces markdown or a report, the wrapper should wrap it in the step's expected JSON output or store it as a referenced artifact; it should not pass arbitrary markdown as runner output unless the step schema/runtime explicitly expects that.

## Not final in this draft

- The runner request schema is not yet split into a standalone JSON schema.
- Host action types beyond the existing workflow actions are intentionally minimal.
- `workflow-runner.mjs continue` uses an internal per-run lock guard so only one host continue operation mutates a single run at a time; lock paths are private runner state.
- The CLI shape is small on purpose and can be renamed after review.

Run initialization and instruction rendering are owned by `workflow-runner next`.
No legacy initialization or inspection CLI is part of the supported runtime
surface.
