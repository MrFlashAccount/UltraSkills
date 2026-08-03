# Workflow validation

Validation ownership is split by runtime owner:

- Workflow documents: `./lib/file-contracts/workflow-document-schema.mjs` and `./lib/file-contracts/workflow-document.json`.
- Baton documents: `./lib/file-contracts/baton/baton-schema.mjs` and `./lib/file-contracts/baton/baton.json`.
- Generic JSON Schema mechanics: workspace package `schema-validation` under `shared/scripts/schema-validation/**`.
- Runtime output contracts: `./lib/runtime/output/schema/**` and `./lib/runtime/output/output-schema-validation.mjs`.
- Runtime host response contracts: `./lib/persistence/run-state/schema/**`.
- CLI argument contract: `./lib/entrypoints/cli/schema/**`.

SPDD workflow-output schemas remain external under `workflows/spdd/schemas/**`; tests or SPDD entrypoints inject them explicitly instead of making `./lib` own them.

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

Cycle identity is declarative. `steps` defines the policy-owned cycle; validation
checks the graph induced by those declared members and proves that every member
is reachable from `entry` and can return to it. A declared cycle may sit inside
a larger graph cycle created by external exits and later returns without those
external steps becoming policy members. Linear or disconnected selections,
overlapping policies, and selections with no boundary-to-entry repeat fail
validation.

MVP policy identity and fields:

- the object key under `loopPolicies`: unique policy id inside the workflow;
- `steps`: explicit member steps that define the cycle;
- `entry`: the single step through which each iteration enters the region;
- `boundary`: the single step that completes an iteration and owns repeat/exit
  routing (`entry` and `boundary` are the same step for a self-loop);
- `maxIterations`: positive count of complete entry-to-boundary traversals;
- `onLimit`: an independent transition descriptor using the same literal,
  dynamic-expression, or `match/cases` forms and boundary output/input context
  as `next`; it may use different routing logic, but every validation-proven
  result must be an external target already declared by the boundary step and
  is used when another repeat would exceed the limit.

Validation must reject ambiguous fanout participation, branch-local dynamic
routing before a join, cross-branch cycles, non-convergent fanout, entries that
bypass the declared entry, ambiguous boundary repeats, `onLimit` targets absent
from the boundary's declared external routes, and policy definitions that try
to use per-transition `cycleId`, runtime-inferred membership, runtime history,
or prompt behavior as the primary loop mechanism.

Consecutive pass/success early exit is deferred. Do not accept success-streak or
`onSuccess` policy fields in the MVP unless a newer approved architecture
contract defines reset, precedence, and target semantics.

The compiled validation result may provide runtime metadata such as policy key,
declared region, internal iteration edges, progress key, max iteration limit,
and `onLimit` target. That metadata is derived from the workflow document; it is
not an alternate policy source.
