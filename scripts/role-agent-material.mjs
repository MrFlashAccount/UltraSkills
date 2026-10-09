import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

export const root = path.resolve(scriptDir, '..');
export const rolesDir = path.join(root, 'roles');

export const title = (value) =>
  value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const splitFrontmatter = (value) => {
  const normalized = value.replace(/\r\n/g, '\n');

  if (!normalized.startsWith('---\n')) {
    return { frontmatter: '', body: normalized };
  }

  const end = normalized.indexOf('\n---\n', 4);

  if (end === -1) {
    return { frontmatter: '', body: normalized };
  }

  return {
    frontmatter: normalized.slice(4, end),
    body: normalized.slice(end + '\n---\n'.length).replace(/^\n/, ''),
  };
};

export const stripFrontmatter = (value) => splitFrontmatter(value).body;

export const frontmatterField = (value, field) => {
  const { frontmatter } = splitFrontmatter(value);
  const line = frontmatter.split('\n').find((candidate) => candidate.startsWith(`${field}:`));

  if (!line) {
    return '';
  }

  return line
    .slice(field.length + 1)
    .trim()
    .replace(/^"(.*)"$/, '$1');
};

const collectRoleFiles = (roleDir) => {
  const files = [];

  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        visit(fullPath);
        continue;
      }

      if (entry.isFile() && /\.(md|txt)$/i.test(entry.name)) {
        files.push(fullPath);
      }
    }
  };

  visit(roleDir);

  const order = new Map([
    ['ROLE.md', 0],
    ['RUBRIC.md', 1],
    ['LEARNINGS.md', 2],
  ]);

  return files.sort((left, right) => {
    const leftRelative = path.relative(roleDir, left);
    const rightRelative = path.relative(roleDir, right);
    const leftRank = order.get(leftRelative) ?? 10;
    const rightRank = order.get(rightRelative) ?? 10;

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return leftRelative.localeCompare(rightRelative);
  });
};

/** Reads every role under roles/ with its embedded material, in stable order. */
export const readRoles = () =>
  fs
    .readdirSync(rolesDir)
    .filter((name) => fs.statSync(path.join(rolesDir, name)).isDirectory())
    .sort()
    .map((role) => {
      const roleDir = path.join(rolesDir, role);
      const roleFiles = collectRoleFiles(roleDir);
      const chunks = roleFiles.map((filepath) => {
        const roleRelativePath = path
          .join('roles', role, path.relative(roleDir, filepath))
          .split(path.sep)
          .join('/');

        return `## ${roleRelativePath}\n\n${stripFrontmatter(fs.readFileSync(filepath, 'utf8'))}`;
      });

      return {
        role,
        description: frontmatterField(fs.readFileSync(path.join(roleDir, 'ROLE.md'), 'utf8'), 'description'),
        fileCount: roleFiles.length,
        material: chunks.join('\n\n---\n\n'),
      };
    });

export const roleInstructions = ({ role, fileCount, material }, host) =>
  [
    `You are the ${title(role)} role from the Skills role catalog.`,
    '',
    `Follow the embedded role material below as binding developer instructions for this spawned ${host} subagent. ROLE.md is primary. RUBRIC.md, LEARNINGS.md, role-local references, and nested learning files are supporting material. Stay inside the delegated task scope from the parent orchestrator. Do not take over orchestration unless explicitly asked. Return concise, evidence-backed output in the format requested by the parent. When reviewing code or plans, lead with blocker-level findings and concrete references.`,
    '',
    `Embedded role files: ${fileCount}.`,
    '',
    '# Embedded role material',
    '',
    material,
  ].join('\n');
