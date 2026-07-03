#!/usr/bin/env bun
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { WorkflowRuntimeError } from '../../errors.mjs';
import { validateWorkflowFile } from '../validate-workflow-file.mjs';

const WORKFLOW_FILENAMES = Object.freeze(['workflow.toml', 'workflow.json']);

function fail(message) {
  console.error(`validate-workflow: ${message}`);
  process.exit(1);
}

function workflowPathForDirectory(root, label = root) {
  const matches = WORKFLOW_FILENAMES
    .map((filename) => join(root, filename))
    .filter((pathname) => existsSync(pathname));
  if (matches.length > 1) fail(`multiple workflow definitions found for ${label}: ${matches.join(', ')}`);
  return matches[0];
}

function listWorkflowPaths(workflowsRoot) {
  const root = resolve(workflowsRoot);
  if (!existsSync(root)) fail(`workflow path does not exist: ${workflowsRoot}`);
  const directWorkflowPath = workflowPathForDirectory(root, workflowsRoot);
  if (directWorkflowPath) return [directWorkflowPath];

  const paths = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const workflowPath = workflowPathForDirectory(join(root, entry.name), entry.name);
    if (workflowPath) paths.push(workflowPath);
  }
  if (paths.length === 0) fail(`no workflow files found in directory: ${workflowsRoot}`);
  return paths.sort();
}

function expandArgument(value) {
  const resolved = resolve(value);
  if (!existsSync(resolved)) fail(`workflow path does not exist: ${value}`);
  if (statSync(resolved).isDirectory()) return listWorkflowPaths(resolved);
  return [resolved];
}

try {
  const args = process.argv.slice(2);
  if (args.length === 0) fail('workflow path is required');
  const workflowPaths = args.flatMap(expandArgument);
  const results = workflowPaths.map((workflowPath) => validateWorkflowFile(workflowPath));
  console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
} catch (error) {
  if (error instanceof WorkflowRuntimeError) fail(error.message);
  throw error;
}
