# State Machines

Read this reference only when unfinished output or invalid transitions can escape into user-visible or external state.

## Use a state machine when

Several of these are true:

- a verdict determines the next step
- unfinished output must remain hidden
- an old ready/approved state must not carry into a new turn
- retries need a hard limit or escalation path
- partial execution can mutate external state
- recovery must resume a specific unfinished transition

A normal draft/review/fix cycle does not need a state machine merely because it has multiple steps.

## Define the interface

Specify:

- states
- allowed transitions
- transition inputs and outputs
- terminal states
- retry or loop bounds
- persisted state and freshness rules
- recovery behavior after interruption

Use enums, schemas, scripts, or tests to make the transition interface explicit when possible.

## Validate

Test:

- every verdict reaches one allowed next state
- unfinished states cannot emit final output
- stale ready/approval state is rejected
- retry bounds terminate or escalate predictably
- interruption resumes without duplicating external effects
- invalid transitions fail clearly

Keep this contract in a conditional reference. Do not load it for ordinary skill authoring.
