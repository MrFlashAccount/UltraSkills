import fs from 'node:fs';
import path from 'node:path';
import { readRoles, roleInstructions, root, title } from './role-agent-material.mjs';

const agentsDir = path.join(root, 'agents');

const tomlLiteral = (value) => {
  if (value.includes("'''")) {
    throw new Error('Role content contains TOML literal delimiter');
  }

  return `'''\n${value.replace(/\r\n/g, '\n')}\n'''`;
};

fs.mkdirSync(agentsDir, { recursive: true });

const roles = readRoles();

for (const roleEntry of roles) {
  const { role } = roleEntry;
  const toml = [
    `name = "${role}"`,
    `description = "Use this agent for the ${title(role)} role from the Skills role catalog."`,
    `developer_instructions = ${tomlLiteral(roleInstructions(roleEntry, 'Codex'))}`,
    '',
  ].join('\n');

  fs.writeFileSync(path.join(agentsDir, `${role}.toml`), toml, 'utf8');
}

console.log(`generated ${roles.length} agent files in ${agentsDir}`);
