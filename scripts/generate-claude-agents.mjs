import fs from 'node:fs';
import path from 'node:path';
import { readRoles, roleInstructions, root, title } from './role-agent-material.mjs';

const agentsDir = path.join(root, 'claude-agents');
const pluginManifestPath = path.join(root, '.claude-plugin', 'plugin.json');

// JSON strings are valid YAML double-quoted scalars, so descriptions with
// colons or quotes stay safe in frontmatter.
const yamlString = (value) => JSON.stringify(value);

fs.rmSync(agentsDir, { recursive: true, force: true });
fs.mkdirSync(agentsDir, { recursive: true });

const roles = readRoles();

for (const roleEntry of roles) {
  const { role, description } = roleEntry;
  const agentDescription = [
    `Use this agent for the ${title(role)} role from the Skills role catalog.`,
    description,
  ]
    .filter(Boolean)
    .join(' ');
  const markdown = [
    '---',
    `name: ${role}`,
    `description: ${yamlString(agentDescription)}`,
    '---',
    '',
    roleInstructions(roleEntry, 'Claude Code'),
    '',
  ].join('\n');

  fs.writeFileSync(path.join(agentsDir, `${role}.md`), markdown, 'utf8');
}

// Claude Code plugin manifests only accept explicit agent file paths, so keep
// the list in sync with the generated files.
const manifest = JSON.parse(fs.readFileSync(pluginManifestPath, 'utf8'));
manifest.agents = roles.map(({ role }) => `./claude-agents/${role}.md`);
fs.writeFileSync(pluginManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`generated ${roles.length} agent files in ${agentsDir}`);
