# Dynamic `next` expressions

Workflow steps can set `next` to one whole-string expression:

```json
"next": "${{ output.selected_steps }}"
```

V1 expressions are path selectors only. They can read:

- `output`: the current worker or approval output.
- `input`: prior step output selected by the dynamic transition expression itself.

Examples:

```json
"next": "${{ output.next }}"
```

```json
"next": "${{ input.planning_draft.selected_reviewers }}"
```

The resolved value is handled like static `next`: a string routes to one step, and an array routes to parallel steps. Target ids must already exist in the workflow. V1 does not support operators, functions, brackets, array indexes, partial template strings, or access to full baton state.

Semantic validation is stricter for parallel fanout: all branches must converge directly into one explicit non-terminal join step. Branch-local `next` before that join must be a static step id; dynamic expressions and conditional match/cases are rejected before the join, even if the JSON schema shape allows them. Transitive branch chains are also rejected.

## Enumerability for loop policies

Dynamic `next` can participate in `loopPolicies` only when validation can derive
a closed target set from the referenced output contract/schema. Closed targets
include direct string `const`, string `enum`, or equivalent discriminated schema
branches where every branch maps to a known step id.

If validation cannot enumerate every possible target used by a policy-selected
cyclic region, that `loopPolicy` is invalid. The dynamic route itself may still
be valid for ordinary runtime routing when it passes the existing dynamic `next`
rules; only the dependent policy fails.

Loop policy validation must not infer targets from previous run history,
backward jumps, repeated cursors, worker prompt text, or observed outputs.

The parallel fanout restriction above is also a loop policy boundary. A policy
must not depend on branch-local dynamic routing, conditional branch routing,
cross-branch cycles, or non-convergent fanout. Unsupported fanout participation
fails validation instead of being interpreted at runtime.
