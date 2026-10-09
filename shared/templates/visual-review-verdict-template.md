# Review result

Use the workflow's exact verdict/output schema. In the user's language, give
the decision and reason, then short evidence-backed findings. No Markdown/HTML
tables, generic checklists, copied Canvas sections or a second report.

Each finding names severity, location, evidence, impact and the required next
action. A pass requires no remaining actionable must-fix or should-fix finding.
Keep unmet source contracts blocking; an approved alternative representation
needs its exact mapping and evidence. Do not invent findings to fill a section.

List only evidence actually inspected. Distinguish source inspection from tests,
rendering and runtime proof. Missing evidence or authority that prevents a verdict
uses the runner's non-blocking-stop channel rather than a completed verdict.
