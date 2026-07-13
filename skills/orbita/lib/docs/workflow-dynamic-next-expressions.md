# Dynamic `next` expressions

Workflow steps can set `next` to one whole-string expression:

```json
"next": "${{ output.selected_step }}"
```

V1 expressions are path selectors only. They can read:

- `output`: the current worker or approval output.
- `input`: prior step output selected by the dynamic transition expression itself.

Examples:

```json
"next": "${{ output.next }}"
```

```json
"next": "${{ input.planning_draft.selected_step }}"
```

The resolved value must be one string step id. Arrays are rejected at the workflow schema and output-schema semantic boundary. Target ids must already exist in the workflow. Use a first-class `kind: "fanout"` step with `input.branches` for named branch work. V1 expressions do not support operators, functions, brackets, array indexes, partial template strings, or access to full baton state.

## Enumerability for loop policies

Dynamic `next` can participate in `loopPolicies` only when validation can derive
a closed target set from the referenced output contract/schema. Closed targets
include direct string `const`, string `enum`, or equivalent discriminated schema
branches where every branch maps to a known step id.

The closed graph must prove the policy's declared `entry` and `boundary`, the
single boundary-to-entry repeat, and `onLimit` as an external target already
declared by the boundary step.

`onLimit` is one scalar target: either a static step id or a path-only dynamic
expression. The dynamic form resolves against the boundary step's normal
output/input context. `onLimit` does not accept `match/cases`; it is a limit-exit
selector, not a second routing tree. Every schema-enumerated result must be a
declared external target of `boundary.next`.

If validation cannot enumerate every possible target used by a policy-selected
cyclic region, that `loopPolicy` is invalid. The dynamic route itself may still
be valid for ordinary runtime routing when it passes the existing dynamic `next`
rules; only the dependent policy fails.

Loop policy validation must not infer targets from previous run history,
backward jumps, repeated cursors, worker prompt text, or observed outputs.

Fanout owner activations are not expanded into loop-policy graph edges. A loop
policy must operate on scalar top-level transitions; unsupported fanout
participation fails validation instead of being inferred from branch requests.
