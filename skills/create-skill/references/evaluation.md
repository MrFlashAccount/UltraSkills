# Skill Evaluation

Read this reference before substantial rewrites, trigger tuning, or context reduction.

## Evaluate behavior, not prose

Use real tasks in clean contexts. Keep author conclusions and intended fixes out of the evaluator context.

Cover:

- obvious trigger asks
- paraphrased trigger asks
- adjacent asks that should not trigger
- material workflow branches and edge cases
- previously observed failures

Inline examples are instructions and can narrow exploration. Keep most representative asks in the eval corpus instead of the runtime skill.

## Compare variants

For substantial work, compare:

1. no skill
2. current skill
3. candidate skill

When possible, judge outputs blind. Record:

- task or rubric pass
- trigger correctness
- user correction or retry count
- failed tool or script calls
- token usage
- elapsed time
- unexpected behavior

Do not keep a rule because it sounds prudent. Keep or restore it when the candidate regresses on a relevant case or when it protects a real safety/protocol boundary.

Re-run the corpus after meaningful model or runtime changes. A capability-uplift skill may become unnecessary as the base model improves; an encoded-preference skill remains useful only while it reflects the actual workflow.

## Eval case interface

Store cases outside the runtime skill folder unless the target runtime needs them there. Use JSON Lines:

```json
{"id":"obvious-create","prompt":"Create a skill from this SOP","should_trigger":true,"criteria":["Produces a valid skill folder","Uses source-specific guidance"]}
{"id":"adjacent-docs","prompt":"Rewrite this README quick start","should_trigger":false}
```

Required fields:

- `id`: unique non-empty string
- `prompt`: non-empty string
- `should_trigger`: boolean

Optional fields:

- `criteria`: non-empty strings describing observable success
- `files`: input artifact paths supplied to the evaluator

Validate the static skill and corpus:

```sh
bun skills/create-skill/scripts/doctor.mjs skills/example --eval path/to/cases.jsonl
```

Use `--json` when another tool or agent will consume the evidence packet.

## Interpreting doctor output

Structural errors such as missing frontmatter, broken direct references, or invalid eval records fail the check.

Strong-rule lines, unconditional loads, repeated text, and context size are review candidates, not automatic failures. Decide whether to change them using real behavior and the owning runtime contract.
