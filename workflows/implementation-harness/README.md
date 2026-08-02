# Implementation harness workflow

This package is the Orbita translation of `skills/implementation-harness`: the post-approval development stage for an approved task, approved research, and an approved execution plan.

The workflow keeps the source skill's three boundaries:

1. `implementation_intake` accepts only approved, closed task/research/plan input and resolves canonical `backend` / `frontend` ownership. Both branches are selected only for disjoint file zones.
2. `implementation` delegates the approved zones to backend and/or frontend implementers, requires loaded role material and meaningful verification, and aggregates their handoffs.
3. `done` returns a `ready_for_review` development packet. Hostile-prior independent review is explicitly `not_run` and remains a separate stage.

Missing approval, scope or ownership, missing role/delegation capability, implementation-critical facts, required redesign or scope growth, and unsafe verification gaps use Orbita's non-blocking-stop channel and resume the same request after resolution. In-scope failures are fixed and re-verified rather than reported as blockers.

The workflow intentionally does not add cryptographic provenance, obligation IDs, verification IDs, path-policy enforcement, discovery, planning, approval seeking, review execution, GitHub transport, or persistence. Runtime routing lives in `workflow.toml`; worker output contracts live in `schemas/`; copied implementer routing guidance lives in `references/roles/`.
