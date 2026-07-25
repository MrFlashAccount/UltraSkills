#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const strongRulePattern =
  /\b(must|always|never|mandatory|required|exactly|only|do not|don't|hard rule|fail)\b/i;
const conditionalLoadPattern = /\b(if|when|only when|as needed|before|after)\b/i;
const loadIntentPattern = /\b(read|load|run|use|see|consult)\b/i;

const toPosix = (value) => value.split(path.sep).join("/");

const countText = (value) => {
  const normalized = value.replace(/\r\n/g, "\n").replace(/\n$/, "");
  return {
    lines: normalized === "" ? 0 : normalized.split("\n").length,
    words: normalized.trim() === "" ? 0 : normalized.trim().split(/\s+/).length,
  };
};

const listFiles = (root, predicate) => {
  const files = [];

  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
      left.name.localeCompare(right.name),
    )) {
      const filepath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(filepath);
      } else if (entry.isFile() && predicate(filepath)) {
        files.push(filepath);
      }
    }
  };

  visit(root);
  return files;
};

const unquote = (value) => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const parseFrontmatter = (content, skillRoot) => {
  const errors = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");

  if (lines[0] !== "---") {
    return {
      metadata: {},
      errors: [
        {
          code: "missing-frontmatter",
          file: "SKILL.md",
          line: 1,
          message: "SKILL.md must start with YAML frontmatter",
        },
      ],
    };
  }

  const end = lines.indexOf("---", 1);
  if (end === -1) {
    return {
      metadata: {},
      errors: [
        {
          code: "unclosed-frontmatter",
          file: "SKILL.md",
          line: 1,
          message: "SKILL.md frontmatter is not closed",
        },
      ],
    };
  }

  const metadata = {};
  for (let index = 1; index < end; index += 1) {
    const match = lines[index].match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (/^[>|][+-]?$/.test(rawValue)) {
      const block = [];
      for (let blockIndex = index + 1; blockIndex < end; blockIndex += 1) {
        if (!/^\s+/.test(lines[blockIndex])) break;
        block.push(lines[blockIndex].trim());
        index = blockIndex;
      }
      metadata[key] = rawValue.startsWith("|") ? block.join("\n") : block.join(" ");
    } else {
      metadata[key] = unquote(rawValue);
    }
  }

  if (!metadata.name) {
    errors.push({
      code: "missing-name",
      file: "SKILL.md",
      line: 1,
      message: "Frontmatter is missing name",
    });
  } else if (metadata.name !== path.basename(skillRoot)) {
    errors.push({
      code: "name-folder-mismatch",
      file: "SKILL.md",
      line: lines.findIndex((line) => line.startsWith("name:")) + 1,
      message: `Frontmatter name "${metadata.name}" does not match folder "${path.basename(skillRoot)}"`,
    });
  }

  if (metadata.name && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metadata.name)) {
    errors.push({
      code: "invalid-name-format",
      file: "SKILL.md",
      line: lines.findIndex((line) => line.startsWith("name:")) + 1,
      message: "Frontmatter name must use lowercase kebab-case",
    });
  }

  if (!metadata.description) {
    errors.push({
      code: "missing-description",
      file: "SKILL.md",
      line: 1,
      message: "Frontmatter is missing description",
    });
  }

  return { metadata, errors };
};

const markdownLinkTitlePattern =
  /\s+(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\))\s*$/;

const cleanReferenceTarget = (value) =>
  value
    .trim()
    .replace(markdownLinkTitlePattern, "")
    .replace(/^<|>$/g, "")
    .split("#", 1)[0]
    .split("?", 1)[0];

const isLocalReference = (value) =>
  value !== "" &&
  !value.startsWith("#") &&
  !/^[a-z][a-z0-9+.-]*:/i.test(value) &&
  !value.includes("{") &&
  !value.includes("}");

const collectDirectReferences = (content, skillRoot) => {
  const references = [];
  const seen = new Set();
  const lines = content.replace(/\r\n/g, "\n").split("\n");

  const add = (rawTarget, line, lineNumber) => {
    const target = cleanReferenceTarget(rawTarget);
    if (!isLocalReference(target)) return;

    const key = `${lineNumber}:${target}`;
    if (seen.has(key)) return;
    seen.add(key);

    const resolved = path.resolve(skillRoot, target);
    const pattern = /[*?[\]]/.test(target);
    references.push({
      source: "SKILL.md",
      line: lineNumber,
      target: toPosix(target),
      pattern,
      exists: pattern ? null : existsSync(resolved),
      load_intent: loadIntentPattern.test(line),
      conditional: conditionalLoadPattern.test(line),
    });
  };

  for (const [index, line] of lines.entries()) {
    for (const match of line.matchAll(/\[[^\]]*]\(((?:[^()]|\([^()]*\))+)\)/g)) {
      add(match[1], line, index + 1);
    }
    for (const match of line.matchAll(
      /`((?:\.{1,2}\/|references\/|scripts\/|assets\/)[^`\s]+)`/g,
    )) {
      add(match[1], line, index + 1);
    }
  }

  return references;
};

const inspectMarkdown = (markdownFiles, skillRoot) => {
  const files = [];
  const strongRules = [];
  const repeated = new Map();

  for (const filepath of markdownFiles) {
    const relative = toPosix(path.relative(skillRoot, filepath));
    const content = readFileSync(filepath, "utf8");
    const counts = countText(content);
    files.push({ path: relative, ...counts });

    let inFence = false;
    for (const [index, rawLine] of content.replace(/\r\n/g, "\n").split("\n").entries()) {
      if (rawLine.trimStart().startsWith("```")) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;

      const line = rawLine.trim();
      if (line === "") continue;

      const rule = line.match(strongRulePattern);
      if (rule) {
        strongRules.push({
          file: relative,
          line: index + 1,
          marker: rule[1].toLowerCase(),
          text: line,
        });
      }

      const normalized = line
        .replace(/^[-*]\s+/, "")
        .replace(/^\d+\.\s+/, "")
        .replace(/\s+/g, " ")
        .toLowerCase();
      if (normalized.length < 50) continue;

      const locations = repeated.get(normalized) ?? [];
      locations.push({ file: relative, line: index + 1 });
      repeated.set(normalized, locations);
    }
  }

  return {
    files,
    strong_rules: strongRules,
    repeated_lines: [...repeated.entries()]
      .filter(([, locations]) => new Set(locations.map(({ file }) => file)).size > 1)
      .map(([text, locations]) => ({ text, locations })),
  };
};

export const validateEvalFile = (evalPath) => {
  const errors = [];
  const cases = [];
  const ids = new Set();

  if (!existsSync(evalPath)) {
    return {
      path: toPosix(evalPath),
      cases: 0,
      trigger_positive: 0,
      trigger_negative: 0,
      errors: [
        {
          code: "missing-eval-file",
          line: 0,
          message: `Eval file does not exist: ${evalPath}`,
        },
      ],
    };
  }

  const lines = readFileSync(evalPath, "utf8").replace(/\r\n/g, "\n").split("\n");
  for (const [index, rawLine] of lines.entries()) {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (line === "") continue;

    let item;
    try {
      item = JSON.parse(line);
    } catch (error) {
      errors.push({
        code: "invalid-eval-json",
        line: lineNumber,
        message: error.message,
      });
      continue;
    }

    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push({
        code: "invalid-eval-case",
        line: lineNumber,
        message: "Eval case must be a JSON object",
      });
      continue;
    }

    if (typeof item.id !== "string" || item.id.trim() === "") {
      errors.push({
        code: "invalid-eval-id",
        line: lineNumber,
        message: "Eval case id must be a non-empty string",
      });
    } else if (ids.has(item.id)) {
      errors.push({
        code: "duplicate-eval-id",
        line: lineNumber,
        message: `Duplicate eval case id: ${item.id}`,
      });
    } else {
      ids.add(item.id);
    }

    if (typeof item.prompt !== "string" || item.prompt.trim() === "") {
      errors.push({
        code: "invalid-eval-prompt",
        line: lineNumber,
        message: "Eval case prompt must be a non-empty string",
      });
    }

    if (typeof item.should_trigger !== "boolean") {
      errors.push({
        code: "invalid-eval-trigger",
        line: lineNumber,
        message: "Eval case should_trigger must be boolean",
      });
    }

    for (const field of ["criteria", "files"]) {
      if (
        item[field] !== undefined &&
        (!Array.isArray(item[field]) ||
          item[field].some((value) => typeof value !== "string" || value.trim() === ""))
      ) {
        errors.push({
          code: `invalid-eval-${field}`,
          line: lineNumber,
          message: `Eval case ${field} must contain only non-empty strings`,
        });
      }
    }

    cases.push(item);
  }

  return {
    path: toPosix(evalPath),
    cases: cases.length,
    trigger_positive: cases.filter(({ should_trigger }) => should_trigger === true).length,
    trigger_negative: cases.filter(({ should_trigger }) => should_trigger === false).length,
    errors,
  };
};

export const inspectSkill = (target, options = {}) => {
  const skillRoot = path.resolve(target);
  const skillPath = path.join(skillRoot, "SKILL.md");
  const structuralErrors = [];

  if (!existsSync(skillRoot) || !statSync(skillRoot).isDirectory()) {
    throw new Error(`Skill folder does not exist: ${target}`);
  }

  if (!existsSync(skillPath)) {
    return {
      version: 1,
      target: toPosix(path.relative(process.cwd(), skillRoot) || "."),
      ok: false,
      metadata: {},
      context: {
        skill_md: { lines: 0, words: 0 },
        markdown_total: { files: 0, lines: 0, words: 0 },
        files: [],
      },
      references: { direct: [], missing: [], unconditional_loads: [] },
      review_candidates: { strong_rules: [], repeated_lines: [] },
      structural_errors: [
        {
          code: "missing-skill-file",
          file: "SKILL.md",
          line: 0,
          message: "Skill folder is missing SKILL.md",
        },
      ],
      evals: options.evalPath ? validateEvalFile(path.resolve(options.evalPath)) : null,
    };
  }

  const skillContent = readFileSync(skillPath, "utf8");
  const frontmatter = parseFrontmatter(skillContent, skillRoot);
  structuralErrors.push(...frontmatter.errors);

  const directReferences = collectDirectReferences(skillContent, skillRoot);
  for (const reference of directReferences.filter(({ exists }) => exists === false)) {
    structuralErrors.push({
      code: "missing-direct-reference",
      file: reference.source,
      line: reference.line,
      message: `Direct reference does not exist: ${reference.target}`,
    });
  }

  const markdownFiles = listFiles(skillRoot, (filepath) => filepath.endsWith(".md"));
  const markdown = inspectMarkdown(markdownFiles, skillRoot);
  const skillCounts = countText(skillContent);
  const evals = options.evalPath ? validateEvalFile(path.resolve(options.evalPath)) : null;

  const report = {
    version: 1,
    target: toPosix(path.relative(process.cwd(), skillRoot) || "."),
    ok: structuralErrors.length === 0 && (!evals || evals.errors.length === 0),
    metadata: frontmatter.metadata,
    context: {
      skill_md: skillCounts,
      markdown_total: {
        files: markdown.files.length,
        lines: markdown.files.reduce((sum, file) => sum + file.lines, 0),
        words: markdown.files.reduce((sum, file) => sum + file.words, 0),
      },
      files: markdown.files,
    },
    references: {
      direct: directReferences,
      missing: directReferences.filter(({ exists }) => exists === false),
      unconditional_loads: directReferences.filter(
        ({ load_intent, conditional }) => load_intent && !conditional,
      ),
    },
    review_candidates: {
      strong_rules: markdown.strong_rules,
      repeated_lines: markdown.repeated_lines,
    },
    structural_errors: structuralErrors,
    evals,
  };

  return report;
};

export const formatHumanReport = (report) => {
  const lines = [
    `Skill doctor: ${report.target}`,
    `Structure: ${report.ok ? "PASS" : "FAIL"}`,
    `Context: SKILL.md ${report.context.skill_md.lines} lines / ${report.context.skill_md.words} words; all markdown ${report.context.markdown_total.lines} lines / ${report.context.markdown_total.words} words`,
    `Direct references: ${report.references.direct.length}; missing ${report.references.missing.length}; unconditional loads ${report.references.unconditional_loads.length}`,
    `Review candidates: ${report.review_candidates.strong_rules.length} strong-rule lines; ${report.review_candidates.repeated_lines.length} repeated lines across files`,
  ];

  if (report.evals) {
    lines.push(
      `Evals: ${report.evals.cases} cases (${report.evals.trigger_positive} trigger / ${report.evals.trigger_negative} no-trigger); ${report.evals.errors.length} errors`,
    );
  }

  for (const error of report.structural_errors) {
    lines.push(`ERROR ${error.file}:${error.line} [${error.code}] ${error.message}`);
  }
  for (const error of report.evals?.errors ?? []) {
    lines.push(`ERROR eval:${error.line} [${error.code}] ${error.message}`);
  }
  for (const reference of report.references.unconditional_loads.slice(0, 8)) {
    lines.push(`LOAD ${reference.source}:${reference.line} -> ${reference.target}`);
  }
  for (const rule of report.review_candidates.strong_rules.slice(0, 8)) {
    lines.push(`RULE ${rule.file}:${rule.line} [${rule.marker}] ${rule.text}`);
  }
  if (
    report.review_candidates.strong_rules.length > 0 ||
    report.review_candidates.repeated_lines.length > 0
  ) {
    lines.push("Review candidates are evidence, not automatic failures.");
  }

  return lines.join("\n");
};

const usage = () =>
  [
    "Usage:",
    "  bun skills/create-skill/scripts/doctor.mjs <skill-folder> [--eval <cases.jsonl>] [--json]",
  ].join("\n");

const parseArgs = (args) => {
  let target;
  let evalPath;
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--json") {
      json = true;
    } else if (argument === "--eval") {
      evalPath = args[index + 1];
      if (!evalPath) throw new Error("--eval requires a file path");
      index += 1;
    } else if (argument === "--help" || argument === "-h") {
      return { help: true };
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (!target) {
      target = argument;
    } else {
      throw new Error(`Unexpected argument: ${argument}`);
    }
  }

  if (!target) throw new Error("Missing skill folder");
  return { target, evalPath, json };
};

export const runCli = (args) => {
  const options = parseArgs(args);
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }

  const report = inspectSkill(options.target, { evalPath: options.evalPath });
  process.stdout.write(
    options.json ? `${JSON.stringify(report, null, 2)}\n` : `${formatHumanReport(report)}\n`,
  );
  return report.ok ? 0 : 1;
};

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  try {
    process.exitCode = runCli(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n${usage()}\n`);
    process.exitCode = 2;
  }
}
