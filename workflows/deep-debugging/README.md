# Deep Debugging

## What it is

A convergent bug-fix workflow for failures that cannot be solved from code inspection alone. It separates hypothesis generation, diagnostic instrumentation, reproduction, and independent evidence judgment; caps unproductive attempts; and performs one fresh hostile reset with analogous-problem research.

## Use when

The symptom is observable but the causal mechanism is unclear, especially when reproduction requires logs, runtime instrumentation, a user action, or discrimination between multiple system boundaries.

## Do not use when

The exact causal chain and fix are already evident, no observable reproduction can be defined, or the task is merely to address known review findings. Use `red-green-refactor` or `review-fix-verify` instead.

## Convergence contract

- Every experiment has a falsifiable hypothesis and fingerprint `(component_or_boundary, mechanism, observable, edit_surface)`.
- The active debugger cannot award its own information gain.
- One no-information round forces experiment redesign.
- Two consecutive no-information rounds or three pre-reset rounds force hostile reset.
- Hostile reset happens at most once and runs a fresh critic plus external analogous-problem research in parallel.
- External reports generate local hypotheses; they never prove local cause.
- At most two post-reset experiments may run.
- User-reproduction waits use non-blocking stops and do not consume a round.
- Every terminal exit cleans up temporary instrumentation.
- `fixed` requires pre-fix evidence, confirmed mechanism, the same reproduction passing, regression evidence, and independent final review.

Honest non-fixed results are `mitigated_not_explained`, `locally_verified_pending_user_repro`, `not_reproduced`, and `unresolved_with_evidence`.
