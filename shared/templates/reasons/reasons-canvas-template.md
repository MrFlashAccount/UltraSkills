# REASONS Canvas

Write one Markdown artifact with a specific feature title and the seven sections
below. Use the user's language and familiar words; retain exact technical names
when they carry a contract. Remove this construction guidance from the result.
The section identities remain Requirements, Entities, Approach, Structure,
Operations, Norms and Safeguards; their display titles below explain their job.

The reader should understand the feature through annotated Mermaid views and a
source/component tree. Text supplies decisions, exact conditions, evidence and
unknowns that diagrams cannot express. Do not narrate the arrows again, copy
generic standards, repeat constraints across sections, set a diagram quota or
give the reader a menu of formatting choices. Keep one rule or check per short
item; do not compress a whole contract into a dense paragraph.

Preserve approved requirements, selected dependencies, public APIs, exact errors,
permission boundaries, state/order invariants, compatibility and resource limits.
A shorter Canvas must not become a weaker contract. Explain a necessary term
briefly; use plain language around it. Label facts, proposed decisions, deductions
and unknowns honestly. Cite source evidence next to claims that depend on it.

Use the producing phase's depth. Research shows observed behavior, domain terms,
candidate directions, risks and unresolved questions; it does not finalize
architecture, file-level changes or implementation order. Architecture owns the
selected structure, planned source changes and assembly contract. Do not invent
paths, fields, states, guarantees or executed checks to fill a section. A section
with no additional evidence can be one honest sentence.

Artifact identity, lifecycle, approval, routing, reviewer roster and machine
handoff fields remain outside the human Canvas. Do not add a second planning
report. Markdown is the Canvas; this format does not require HTML export,
raster images, screenshots, a new renderer dependency or extra verification.
The calling phase decides which checks are authorized.

Write valid Mermaid. Label arrows with actions or data and keep each view focused
on one question. Escape reserved punctuation without changing visible text:
a sequence-message semicolon uses `#59;`, not a literal `;` separator.
Inspect syntax when rendering is unavailable; report that verification limit in
the worker handoff. Claim parsed/rendered proof only after an actual check.

## R — Что должно получиться

Requirements: state the goal in one sentence. Show the meaningful user/caller
journey in Mermaid: actions, visible result and material failure or permission
branches. For internal work, use the actual caller/operator, not an invented UI.
Add only acceptance signals, scope boundaries, compatibility or unresolved choices
not visible in the journey. In research, label candidate behavior rather than
presenting an unresolved option as selected.

For research artifacts, retain the exact UI applicability decision
`UI design needed: yes | no` marker and an evidence-backed reason here.
The marker is product evidence; routing remains in the producer's output.

## E — Данные и состояния

Entities: show meaningful data relationships and lifecycle transitions in focused
Mermaid views. Include identity, ownership, cardinality and contract-bearing
fields when they affect behavior. Preserve distinct states and validation
boundaries. Avoid empty class skeletons, every-method inventories and wrappers
created only for the diagram. Research names observed domain concepts; proposed
architecture records are not presented as existing facts.

## A — Как это работает

Approach: explain the central end-to-end collaboration through an annotated
Mermaid sequence: real participants, trigger, meaningful messages, outcome and
material failure/cancellation branches. Add the reason for the chosen approach
and a rejected alternative only when that trade-off matters. Research instead
shows observed collaboration or bounded candidate approaches with open decisions;
it must not silently select the final solution. Keep the user's journey in R
and component collaboration here.

## S — Где что находится

Structure: draw responsibility and dependency boundaries in Mermaid, including
allowed calls and important forbidden shortcuts. Explain each component's job.

Architecture adds an annotated ASCII tree of the affected source: existing paths
and planned additions, with `добавить`, `изменить` or `убрать`, responsibility
and owner where needed. Show changed areas, not the whole repository. Clearly
label proposed paths; an uninspected path is not evidence of an existing file.
When paths are unknown, use a labelled component tree and state that uncertainty.

Research may map observed components and ownership questions. It does not create
a final change tree or settle structural ownership before architecture.

## O — Как соберём

Operations: architecture shows a Mermaid dependency/outcome graph. Nodes are
completed feature parts with observable results; arrows are actual prerequisites.
Independent parts stay parallel. Keep the workstream owner, source zone,
completion signal and verification clear through tree/node annotations and short
captions. Do not force a serial route where no dependency exists.

Research shows known work implications, evidence dependencies, blockers and
validation questions only. Unknown assembly order remains unknown; no code edits,
final workstreams or implementation plan are manufactured.

Add only migration, intermediate proof or sequencing conditions the graph cannot
show. No human-facing changes table, ownership matrix, method-by-method
pseudocode, patch recipe, command sequence or separate planning report.

## N — Какие правила соблюдаем

Norms: keep only concrete rules that constrain this feature. Name their target:
who owns state, where validation belongs or which dependency is forbidden.
Reference existing local conventions instead of copying generic checklists.
Do not repeat rules already clear in the diagrams or other sections.

## S — Что нельзя сломать и как проверяем

Safeguards: pair each must-preserve behavior with an observable acceptance check.
Keep exact failure/cancellation conditions, permissions, privacy, compatibility,
resource budgets, rollback triggers and the smallest safe rollback explicit.
Use a compact failure/recovery view when it answers a new question.

Group short checks by the behavior they prove. Do not turn them into a dense
technical inventory or weaken them to vague success claims. Research records
risks, evidence gaps and what needs validation; architecture makes applicable
checks and rollback executable at contract depth. Mark missing evidence and
unresolved limits. Proposed checks are not test results, and absent measurements
are not proof.
