# create-design workflow

Design-memory workflow replacing the former skill package.

It preserves the `review`, `proposal`, and `implement` modes and treats
`implement` as either `create` or `edit`. A read-only intake may inspect enough
repository context to select the mode and scope, but every substantive path,
including review, starts only after explicit approval.

The workflow uses Frontend-Taste separately as proposer/design architect and
hostile-prior attacker. Creating or repairing design law without a chosen
direction pauses for up to three rounds of exactly three distinct direction
options and Sergey's explicit decision, then requires direction synthesis
before canonical `DESIGN.md` work. Proposal mode stays read-only; direction
approval is not write approval unless implement mode was already approved.

Implementation is limited to `DESIGN.md` and justified supporting
design-memory artifacts. Product UI, application code, Figma, components, and
styling are out of scope. A separate post-edit Frontend-Taste review must pass
before the workflow can claim a clean implementation; loop exhaustion preserves
remaining findings instead of manufacturing a pass.
