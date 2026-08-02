# Loop workflow

## What it is

A generic bounded workflow for repeated independent task cycles. It normalizes the request into a compact durable baton, runs exactly one executor cycle per worker request, and gives a separate controller the continuation decision.

## Use when

Use it for requests such as `Loop: <task>`, repeated bug hunts, cleanup passes, or review/fix cycles with observable success and safe continuation criteria.

## Do not use when

Do not use it for a one-shot task, an unbounded autonomous process, or work whose first safe action already needs unresolved permission, approval, capability, or user input.

## Runtime contract

The startup worker infers or validates the task, success criteria, stop/help conditions, verification requirements, executor constraints, and approval boundaries. It defaults `max_iterations` to `3` and executable saturation to two no-progress cycles. The workflow runner requires a static loop policy, so the runtime hard limit is also three complete executor-to-controller traversals. A requested limit of one or two is enforced by the controller. A requested limit above three is retained in `requested_max_iterations`, capped in `max_iterations`, and explained in `limit_mismatch`; it cannot make this workflow exceed the static runner limit. An explicitly requested saturation threshold is honored when it fits inside the three-cycle runtime bound.

Each `execute_cycle` request receives the latest baton, performs only its current `next_action`, records exact evidence and verification, and stops. `control_cycle` then updates the baton and chooses `continue`, `retry`, or `finish`. It must stop on success, the configured executable-saturation threshold, the effective iteration limit, verification-proven failure, unsafe continuation, or a user stop.

Missing input, capability, permission, or an approval boundary is not loop completion. The active worker reports a runner-owned non-blocking stop, preserves the current iteration, and resumes the same request after the orchestrator resolves it. The terminal step reports the stop reason, completed iterations, accumulated results, verification evidence, resolved help, open risks, touched files/PRs/issues/notes, limit mismatch, and recommended next step.
