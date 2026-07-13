# Workflow validation

Validation ownership is split by runtime owner:

- Workflow documents: `./lib/file-contracts/workflow-document-schema.mjs` and `./lib/file-contracts/workflow-document.json`.
- Baton documents: `./lib/file-contracts/baton/baton-schema.mjs` and `./lib/file-contracts/baton/baton.json`.
- Generic JSON Schema mechanics: workspace package `schema-validation` under `shared/scripts/schema-validation/**`.
- Runtime output contracts: `./lib/runtime/output/schema/**` and `./lib/runtime/output/output-schema-validation.mjs`.
- Runtime host response contracts: `./lib/persistence/run-state/schema/**`.
- CLI argument contract: `./lib/entrypoints/cli/schema/**`.

DevHarness workflow-output schemas remain external under `workflows/dev-harness/schemas/**`; tests or DevHarness entrypoints inject them explicitly instead of making `./lib` own them.

## Loop policy validation

`loopPolicies` are owned by the workflow document contract. They are optional:
workflows without them must keep existing validation and runtime behavior.

Validation for a loop policy is semantic, not just JSON shape validation. The
validator must build or describe a finite route graph from the workflow artifact
and output contracts, then prove the policy against that graph before runtime
execution.

Route graph expansion includes:

- literal `next` targets;
- `match/cases` route targets;
- approval/user-input route targets;
- dynamic `next` only when the output contract/schema gives a closed enumerable
  set of target step ids.

Dynamic target sets are enumerable when schema inspection can derive all
possible target step ids from closed values such as `const`, `enum`, or
equivalent discriminated branches. A dynamic route that is not enumerable can
remain valid for ordinary routing, but any `loopPolicy` depending on that route
must fail validation.

Cycle detection is structural. Validation detects SCCs and self-loops in the
expanded graph. A policy-selected step set must normalize to exactly one
detected SCC or one valid self-loop. Partial regions, multi-SCC selections,
overlapping policies, and regions with no internal route event fail validation.

MVP policy identity and fields:

- the object key under `loopPolicies`: unique policy id inside the workflow;
- `steps`: member steps used to select one detected cyclic region;
- `entry`: the single step through which each iteration enters the region;
- `boundary`: the single step that completes an iteration and owns repeat/exit
  routing (`entry` and `boundary` are the same step for a self-loop);
- `maxIterations`: positive count of complete entry-to-boundary traversals;
- `onLimit`: an existing external target already declared by the boundary step,
  used when another boundary-to-entry repeat would exceed the limit.

Validation must reject ambiguous fanout participation, branch-local dynamic
routing before a join, cross-branch cycles, non-convergent fanout, entries that
bypass the declared entry, ambiguous boundary repeats, `onLimit` targets absent
from the boundary's declared external routes, targets that route back into the
exhausted region, and policy definitions that try to use
`cycleId`, manual scopes, runtime history, or prompt behavior as the primary
loop mechanism.

Consecutive pass/success early exit is deferred. Do not accept success-streak or
`onSuccess` policy fields in the MVP unless a newer approved architecture
contract defines reset, precedence, and target semantics.

The compiled validation result may provide runtime metadata such as policy key,
computed region, internal iteration edges, progress key, max iteration limit,
and `onLimit` target. That metadata is derived from the workflow document; it is
not an alternate policy source.
