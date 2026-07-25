import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "bun:test";
import { inspectSkill, validateEvalFile } from "./doctor.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const withTempDir = (run) => {
  const root = mkdtempSync(path.join(tmpdir(), "create-skill-doctor-"));
  try {
    return run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

test("doctor returns context and review evidence without failing heuristics", () =>
  withTempDir((root) => {
    const skillRoot = path.join(root, "example-skill");
    mkdirSync(path.join(skillRoot, "references"), { recursive: true });
    writeFileSync(
      path.join(skillRoot, "SKILL.md"),
      [
        "---",
        "name: example-skill",
        "description: Example skill used for doctor tests.",
        "---",
        "",
        "Use judgment for normal work.",
        "Always preserve the source contract because the target system depends on it.",
        "Read `references/details.md` when the task needs protocol details.",
        "Inspect `../../roles/*` when role-specific behavior matters.",
        "This repeated instruction is intentionally long enough to qualify as duplicate review evidence.",
        "",
      ].join("\n"),
    );
    writeFileSync(
      path.join(skillRoot, "references", "details.md"),
      [
        "# Details",
        "",
        "This repeated instruction is intentionally long enough to qualify as duplicate review evidence.",
        "",
      ].join("\n"),
    );
    const evalPath = path.join(root, "cases.jsonl");
    writeFileSync(
      evalPath,
      [
        JSON.stringify({
          id: "trigger",
          prompt: "Use the example skill",
          should_trigger: true,
          criteria: ["Produces the requested artifact"],
        }),
        JSON.stringify({
          id: "no-trigger",
          prompt: "Answer an unrelated question",
          should_trigger: false,
        }),
        "",
      ].join("\n"),
    );

    const report = inspectSkill(skillRoot, { evalPath });

    assert.equal(report.ok, true);
    assert.equal(report.metadata.name, "example-skill");
    assert.equal(report.references.direct.length, 2);
    assert.equal(report.references.direct[0].conditional, true);
    assert.equal(report.references.direct[1].pattern, true);
    assert.equal(report.references.direct[1].exists, null);
    assert.equal(report.references.unconditional_loads.length, 0);
    assert.equal(report.review_candidates.strong_rules.length, 1);
    assert.equal(report.review_candidates.repeated_lines.length, 1);
    assert.equal(report.evals.cases, 2);
    assert.equal(report.evals.trigger_positive, 1);
    assert.equal(report.evals.trigger_negative, 1);
  }));

test("doctor fails structural errors but does not invent semantic verdicts", () =>
  withTempDir((root) => {
    const skillRoot = path.join(root, "actual-folder");
    mkdirSync(skillRoot);
    writeFileSync(
      path.join(skillRoot, "SKILL.md"),
      [
        "---",
        "name: wrong-name",
        "description: Invalid fixture.",
        "---",
        "",
        "Read `references/missing.md` for every task.",
        "",
      ].join("\n"),
    );

    const report = inspectSkill(skillRoot);
    assert.equal(report.ok, false);
    assert.deepEqual(
      report.structural_errors.map(({ code }) => code),
      ["name-folder-mismatch", "missing-direct-reference"],
    );
    assert.equal(report.references.unconditional_loads.length, 1);
  }));

test("doctor accepts Markdown link titles without treating them as part of the path", () =>
  withTempDir((root) => {
    const skillRoot = path.join(root, "example-skill");
    mkdirSync(path.join(skillRoot, "references"), { recursive: true });
    for (const filename of ["double.md", "single.md", "parenthesized.md", "spaced guide.md"]) {
      writeFileSync(path.join(skillRoot, "references", filename), "# Guide\n");
    }
    writeFileSync(
      path.join(skillRoot, "SKILL.md"),
      [
        "---",
        "name: example-skill",
        "description: Example skill used for doctor tests.",
        "---",
        "",
        '[Double](references/double.md "Detailed guide")',
        "[Single](references/single.md 'Detailed guide')",
        "[Parenthesized](references/parenthesized.md (Detailed guide))",
        '[Spaced](<references/spaced guide.md> "Detailed guide")',
        "",
      ].join("\n"),
    );

    const report = inspectSkill(skillRoot);

    assert.equal(report.ok, true);
    assert.deepEqual(
      report.references.direct.map(({ target }) => target),
      [
        "references/double.md",
        "references/single.md",
        "references/parenthesized.md",
        "references/spaced guide.md",
      ],
    );
  }));

test("eval validation reports invalid and duplicate cases", () =>
  withTempDir((root) => {
    const evalPath = path.join(root, "cases.jsonl");
    writeFileSync(
      evalPath,
      [
        JSON.stringify({ id: "same", prompt: "first", should_trigger: true }),
        JSON.stringify({ id: "same", prompt: "", should_trigger: "yes" }),
        "{not-json}",
        "",
      ].join("\n"),
    );

    const result = validateEvalFile(evalPath);
    assert.equal(result.cases, 2);
    assert.deepEqual(
      result.errors.map(({ code }) => code),
      ["duplicate-eval-id", "invalid-eval-prompt", "invalid-eval-trigger", "invalid-eval-json"],
    );
  }));

test("doctor accepts the existing skill catalog structural contracts", () => {
  const skillsRoot = path.join(repoRoot, "skills");
  const failures = readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      report: inspectSkill(path.join(skillsRoot, entry.name)),
    }))
    .filter(({ report }) => !report.ok)
    .map(({ name, report }) => ({
      name,
      errors: report.structural_errors,
    }));

  assert.deepEqual(failures, []);
});
