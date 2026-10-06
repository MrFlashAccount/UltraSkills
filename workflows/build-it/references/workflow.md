# Workflow

1. Architect designs from the task, available evidence and relevant code/docs.
2. A separate Architect challenges the visual Canvas and owner routing.
3. Bounded revisions preserve exact decisions; unresolved findings remain visible
   when the limit routes to the user gate.
4. User approves the architecture or gives feedback for a revised Canvas.
5. Delegate approved disjoint zones to backend, frontend and/or architecture-document workers using
   `../../shared/delegate/delegated-role-task-template.md` and the compact focus
   from `references/roles/implementers.md`. Never implement their work in the parent.
6. Verify all selected work against the exact approved Canvas and hand off for
   separate independent code review. Review status is `not_run`.

No separate research, prepared execution-plan dependency, code-review execution
or transport. The Canvas explains behavior/structure through diagrams and a
source tree; machine routing stays in structured output. No human tables.

In-scope failed verification is work to fix and rerun. Missing authority, unsafe
external verification, ambiguous ownership, contradictions and required redesign
use the runner's non-blocking stop and resume the same request after resolution.
