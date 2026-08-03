# create-skill workflow

The deliberately thin skill-authoring workflow, replacing the former skill package.

The triggering request authorizes its requested mode. Audit and proposal stay
read-only unless edits were requested, and the workflow adds no approval gate.

The graph has three states:

1. `skill_authoring` inspects real sources and usage, chooses the smallest useful
   skill surface, and checks representative trigger and task behavior.
2. Direct low-risk work goes straight to `done`. Only substantial rewrites,
   trigger tuning, or evidence-based simplification enter `skill_evaluation`.
3. `skill_evaluation` compares no-skill, current-skill, and candidate behavior.
   Bounded evidence-backed findings return to authoring for at most two
   evaluation passes; the terminal projection preserves unresolved findings if
   the limit is reached.

Detailed authoring/evaluation/state-machine guidance and `doctor.mjs` are copied
into this package and loaded or run only when relevant. The workflow does not
force a proposal, arbitrary eval count, critic pass, state machine, script, or
asset onto small work.

Validate with:

```sh
bun run workflow:validate
```
