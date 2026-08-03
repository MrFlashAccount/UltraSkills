# Skill Authoring

Read this reference when creating or materially restructuring a skill.

## Start from evidence

Inspect the source material, target runtime, existing skill, related repo instructions, and real usage before drafting. Recover answers from those sources instead of asking the user to repeat known context.

Identify:

- what users actually ask for
- what successful output or behavior looks like
- which facts or preferences are not recoverable from the environment
- which failures have actually occurred
- which operations are flexible, fragile, sensitive, or destructive

Use enough representative asks to cover material branches and negative trigger boundaries. Do not force an arbitrary count.

## Choose the degree of freedom

- Use guidance and judgment when several approaches are valid or surrounding context should decide.
- Use a preferred pattern or parameterized script when consistency matters but variation remains legitimate.
- Use a narrow script, schema, state transition, or hard rule when mistakes are costly, the sequence is fragile, or evidence shows the model repeatedly fails.

Do not convert a local preference into a universal rule. If a rule is specific to one runtime, repo, product, or user, say so or keep it in that narrower context.

## Design the skill surface

Keep `SKILL.md` focused on:

- precise trigger metadata
- the common operating path
- non-obvious rules needed on most invocations
- conditional routes to detailed resources

Use:

- `references/` for detailed knowledge or branches loaded only when relevant
- `scripts/` for deterministic or repeated work
- `assets/` for files copied or transformed into outputs

Prefer high-fidelity references such as source code, schemas, test suites, executable scripts, HTML artifacts, and real specifications over summaries or screenshots when those sources exist.

Do not duplicate the same instruction in `SKILL.md`, references, role material, and worker prompts. Put behavior at the narrowest layer that owns it.

## Subtractive context audit

For every strong rule or substantial paragraph, ask:

1. Is this a safety or protocol invariant?
2. Is this a durable user, team, product, or runtime preference?
3. Is it supported by an observed failure, eval, or compatibility requirement?
4. Can the model recover it from the request, repo, tools, code, or source artifact?
5. Does it conflict with or repeat another instruction source?
6. Would removing it change measured behavior?

Keep hard constraints when the first three answers justify them. Remove, soften, or defer material that is obvious, duplicated, speculative, or unproven.

## Frontmatter and structure

- Keep the folder name in lowercase kebab-case and name the entrypoint exactly `SKILL.md`.
- Make `name` match the folder.
- Make `description` state both what the skill does and when it should trigger.
- Include relevant files, surfaces, environments, or user language when they materially improve triggering.
- Keep runtime-specific metadata only when the target runtime uses it.
- Do not add auxiliary README, changelog, installation, or process-history files to the runtime skill folder.
- Keep references directly discoverable from `SKILL.md` and make each load condition clear.

## Finish

Verify that:

- intended and paraphrased asks trigger
- adjacent asks stay quiet
- claimed branches are executable or have an explicit stop
- deterministic scripts run successfully
- referenced files exist
- the common path does not load irrelevant context
- the result matches the requested read/write scope

Use risk-appropriate review. A direct low-risk edit may need only targeted verification; sensitive or protocol-bearing work may justify independent review and stronger gates.
