# Output Contract

Return one structured packet with these top-level fields exactly:

- `outcome` (runner discriminator)
- `summary`
- `repo`
- `issue_url`
- `status`
- `implementer_owners`
- `execution_contract_basis`
- `branch_name`
- `pr_url`
- `change_summary`
- `verification_results`
- `review_branches` when routing to internal review
- `reviewer_handoffs` when routing to internal review
- `review_handoff`
- `warnings`
- `next_action`
- `issue_comment`

`outcome` and `status` are both `ready_for_review` for an initial or
reviewer-requested implementation pass. They are both `ready_for_user_approval`
after user-requested rework. An in-progress request does not submit a packet.

Conditional rules:

- `verification_results` and `review_handoff` are always populated.
- `ready_for_review` requires non-empty `review_branches`, one matching
  `reviewer_handoffs` entry per selected reviewer, and `review_status = pending`.
- `ready_for_user_approval` forbids reviewer routing fields and requires
  `review_status = user_rework_not_reviewed`.

Field intent:

- `summary`: short execution outcome.
- `repo`: repo name or canonical repo identifier.
- `issue_url`: source issue/task URL, or empty string if none.
- `status`: current handoff state.
- `implementer_owners`: owner-to-zone map using only `backend`, `frontend` and `architect`.
- `execution_contract_basis`: short reference to the approved architecture Canvas and actual gate decision used for development.
- `branch_name`: working branch used or prepared for transport.
- `pr_url`: published PR URL when transport already supplied one; otherwise empty.
- `change_summary`: concise user-visible changes.
- `verification_results`: commands/checks run, results, notable gaps, and whether each delegated implementer satisfied loaded role material's additional, final-answer, or output requirements.
- `review_branches`: exact internal reviewer fanout for this activation.
- `reviewer_handoffs`: reviewer-specific evidence keyed by selected branch id.
- `review_handoff`: compact internal-review context, including intended coverage
  and review-sensitive hotspots. For architecture-sensitive work, include resolved
  proof obligations, deviations from the architecture contract, unresolved
  compatibility surfaces, and negative checks run.
If progress requires help because of a concrete execution blocker, contradiction, missing implementation-critical fact, missing external input or permission, required approved-contract change, redesign/plan decision, or unsafe repo/environment state, report `NON_BLOCKING_STOP` through the orchestrator/host control channel with the smallest help request. Do not return a completed packet for that stop; resume the same implementation task after resolution. Red tests caused by your own in-scope changes are implementation work to fix and rerun, not a reason to stop.
- `warnings`: non-blocking risks, follow-ups, or caveats.
- `next_action`: one explicit next step for the caller.
- `issue_comment`: transport-ready comment body another layer can persist.

`review_handoff` minimum shape:

- `prior`: always `hostile_prior`
- `review_status`: `pending` before internal review or
  `user_rework_not_reviewed` after user-requested rework
- `reviewer_plan`: concise reviewer roster and scope from the approved architecture Canvas
- `hotspots`: ordered list of files/areas that deserve close review attention
- `contract_gaps`: empty list when none; otherwise any remaining caveats the review stage should explicitly judge
- `resolved_proof_obligations`: applicable architecture proof obligations satisfied, or empty when not applicable
- `architecture_contract_deviations`: deviations from Architect contract with approval/status, or empty when none
- `unresolved_compatibility_surfaces`: remaining wrappers/deprecated exports/aliases/legacy imports, or empty when none
- `negative_checks_run`: negative checks for forbidden imports/paths, deletion proof, compatibility absence, naming honesty, and schema/domain alignment, or empty when not applicable

Packet rules:

- Keep values concise and factual.
- Do not include raw agent transcripts.
- While work is active, continue the same request; use a non-blocking stop only when concrete help is required.
- Use `ready_for_review` when code and verification are complete and internal
  review must run or rerun.
- Use `ready_for_user_approval` only after user-requested rework that intentionally
  returns directly to the same gate.
- Do not imply that independent review passed before the review owner aggregates it.
