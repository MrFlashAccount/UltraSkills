# Artifact contract prototype

This is a narrow contract prototype for DevHarness/research workflows. It centralizes low-level artifact mechanics in schema definitions and renderer-generated field notes while keeping workflow step prompts focused on semantic instructions.

It does not implement a full Artifact Store, promotion model, aliases, revisions, or runtime-managed artifact persistence. The prompt builder remains a dumb renderer: it reads templates/schemas, replaces supported placeholders, appends strict generated sections, and does not choose artifact ids, paths, or workflow behavior.

## Central artifact schema shape

The shared baton schema owns artifact metadata under `./lib/file-contracts/baton/baton.json#/$defs/artifact`:

```json
{
  "id": "reasons-canvas-research",
  "content_type": "text/markdown",
  "path": "/path/to/run/research_draft/artifacts/reasons-canvas-research.md",
  "summary": "Research Canvas for approval."
}
```

Required fields:

- `id`: artifact id unique within the producer step.
- `content_type`: MIME/content type, for example `text/markdown` or `application/json`.
- `path`: full absolute filesystem path to the generated artifact file. The
  runner renders the exact occurrence-aware output directory for the current
  request; new worker output validation requires the path to remain inside that
  canonical directory.

Optional fields:

- `summary`: compact handoff text.

Not included: `type`, `kind`, `ref`, `producer_step_id`, `version`, `replaces`, `aliases`, promotion, or final/approved artifact semantics.

## Baton state boundary

The worker-facing read path for the current producer output remains:

```js
baton.state[producerStepId].artifacts[]
```

Occurrence-aware inspection and audit use the runner-owned
`baton.state.artifacts` aggregate rather than treating the current producer
slot as complete traversal history. Each wrapped `artifact`
must still satisfy the exact central `{ id, content_type, path, summary? }`
schema with no extra fields. New wrappers also carry runner-owned
`producerOccurrence`, `producerRequestId`, and `acceptedFileStamp` provenance;
those fields never enter worker-authored artifact metadata.

For new records, aggregate identity is
`{ ownerStepId, ownerOccurrence, producerRequestId, artifactId }`. This keeps
the same artifact id from repeated owner visits or requests distinct. Explicit
legacy `{ producerStepId, artifact }` wrappers remain readable without an
invented occurrence and without rewriting their bytes or paths.

The accepted file stamp records device/inode/size/mtime/ctime after the runner
has proven that the canonical occurrence-aware path is contained, regular, and
not a followed symlink. Content readers must reopen and revalidate canonical
aggregate metadata plus that stamp on every request; an opaque artifact ref is
a locator, never filesystem authority.

The renderer does not choose artifact ids or read persisted artifact files. It
renders the runner-selected occurrence-aware output directory from the
applied/current Baton, including a just-routed next owner rather than stale
pre-transition state, and adds schema-derived notes from loaded schemas.
External schema refs such as the central Baton artifact `$ref` must resolve
deterministically; unresolved external refs fail prompt rendering instead of
being silently omitted.

Legacy aggregate wrappers remain descriptor-readable, but missing runner-owned
occurrence/request/file-stamp provenance is represented as
`legacy_unavailable`. Such a descriptor has no artifact ref and cannot acquire a
preview/download capability by reusing its historical absolute path. This is a
forward-only compatibility surface, not an alias or migration mechanism.

## Artifact usage metadata

Artifact field semantics live with the schema using the existing metadata style only:

- `description`: neutral field meaning.
- `x-usage`: producer/reader usage guidance rendered as schema-derived field notes.

This keeps low-level mechanics out of reusable markdown templates and workflow prompts. A producer sees schema-derived fill notes; a reader sees schema-derived usage notes for prompt input values from the same central metadata.

## Prompt separation rule

Workflow step prompts may say semantic things like:

- create the human-facing research Canvas as a markdown artifact;
- attack the prompt input research Canvas artifact as the approval source of truth;
- show the prompt input research Canvas artifact and critic verdict to the user;
- produce architecture decisions from the approved research Canvas.

Workflow step prompts and markdown templates must not repeat low-level mechanics:

- where to write artifact files on disk;
- how to fill the artifact JSON shape;
- where/how to technically read artifact content;
- standard artifact field semantics.

Those mechanics belong in schema definitions and renderer-generated field notes.

## DevHarness end-to-end flow

1. `research_draft` emits `artifacts[0]` for the full human-facing research Canvas, for example:

   ```json
   {
     "id": "reasons-canvas-research",
     "content_type": "text/markdown",
     "path": "/path/to/run/research_draft/artifacts/reasons-canvas-research.md",
     "summary": "Research Canvas for approval."
   }
   ```

2. `research_attack` reads artifact `reasons-canvas-research` from `research_draft` and reviews/attacks that artifact.
3. If attack returns `needs_revision`, `research_draft` projects `research_attack`, revises the Canvas, and emits a fresh artifact for the revised Canvas using the same central schema contract.
4. `approve_research` presents artifact `reasons-canvas-research` from `research_draft` plus `research_attack.verdict` and waits for explicit human approval.
5. On approval, `architecture_draft` uses the approved/current `reasons-canvas-research` artifact from `research_draft` as the research source of truth and emits the minimal architecture decision/structural contract as `reasons-canvas-architecture` artifact metadata plus a compact output `summary`. The full architecture contract body lives in the referenced artifact file, not inline JSON.

The JSON output remains authoritative for workflow branching, prompt input context, and gates. The markdown artifact is the human-facing Canvas for review/approval. If the user asks the orchestrator for the research/proposal file, the orchestrator must retrieve or export the existing run artifact referenced by prompt input/output artifacts; it must not ask a worker to recreate the Canvas in an arbitrary temp path.

## Explicit non-goals

- No artifact store, promotion model, alias/version system, bulk path migration,
  or compatibility directory is introduced.
- Workers continue to emit the absolute `path` in the unchanged central artifact
  metadata shape; occurrence/request/file provenance remains runner-owned.
- Host/orchestrator file requests use existing Baton/output artifact references;
  no separate export service or preview repository is introduced.
- Rollback never rewrites aggregate artifacts. Once v2 stamped wrappers may
  exist, additive Baton parsing and aggregate compatibility remain even if the
  dashboard v2 read surface is rolled back.
