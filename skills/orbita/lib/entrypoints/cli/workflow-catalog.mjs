#!/usr/bin/env bun
import { parseArgs } from 'node:util';
import { readWorkflowCatalog } from '../../workflow-catalog-reader.mjs';
import { resolveWorkflowCatalogEntry } from '../../use-cases/WorkflowCatalogPolicy.mjs';

function fail(message) {
  console.error(`workflow-catalog: ${message}`);
  process.exit(1);
}

function usage() {
  return 'usage: bun skills/orbita/lib/entrypoints/cli/workflow-catalog.mjs list [--human|--json] [--workflows-root <dir>] [--config <file>] | resolve <query> [--human|--json] [--workflows-root <dir>] [--config <file>]';
}

function parseCliArgs(argv) {
  const [mode, ...rest] = argv;
  if (!['list', 'resolve'].includes(mode)) fail(usage());
  try {
    const parsed = parseArgs({
      args: rest,
      options: {
        human: { type: 'boolean', default: false },
        json: { type: 'boolean', default: false },
        'workflows-root': { type: 'string' },
        config: { type: 'string' },
      },
      strict: true,
      allowPositionals: mode === 'resolve',
    });
    if (parsed.values.human && parsed.values.json) fail(usage());
    if (mode === 'list' && parsed.positionals.length > 0) fail(usage());
    if (mode === 'resolve' && parsed.positionals.length !== 1) fail(usage());
    return { mode, values: parsed.values, positionals: parsed.positionals };
  } catch (error) {
    fail(`${error.message}\n${usage()}`);
  }
}

function formatHuman(workflows) {
  if (workflows.length === 0) return 'No workflows found.';
  return workflows.map((workflow) => `${workflow.name} [${workflow.workflowRef}] - ${workflow.description}\n  absolute workflow path for --workflow: ${workflow.path}`).join('\n');
}

function formatResolveHuman(result) {
  if (result.status === 'none') return `No workflow matched: ${result.query}`;
  if (result.status === 'single') {
    const workflow = result.candidates[0];
    return `Matched workflow: ${workflow.name}\n  ref: ${workflow.workflowRef}\n  description: ${workflow.description}\n  absolute workflow path for --workflow: ${workflow.path}`;
  }
  return `Multiple workflows matched: ${result.query}\n${result.candidates.map((workflow) => `- ${workflow.name} [${workflow.workflowRef}]: ${workflow.description}`).join('\n')}`;
}

const { mode, values, positionals } = parseCliArgs(process.argv.slice(2));
let workflows;
try {
  workflows = readWorkflowCatalog({ workflowsRoot: values['workflows-root'], configPath: values.config });
} catch (error) {
  fail(error.message);
}

if (mode === 'resolve') {
  const result = resolveWorkflowCatalogEntry(workflows, positionals[0]);
  if (values.json) console.log(JSON.stringify(result, null, 2));
  else console.log(formatResolveHuman(result));
} else if (values.json) {
  console.log(JSON.stringify({ workflows }, null, 2));
} else {
  console.log(formatHuman(workflows));
}
