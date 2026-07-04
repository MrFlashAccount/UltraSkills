import { existsSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readWorkflowDocument } from './persistence/workflow-resources/workflow-document-reader.mjs';
import { BUILT_IN_WORKFLOW_SOURCE_ID, OVERRIDE_WORKFLOW_SOURCE_ID, readOrbitaConfig } from './persistence/config/orbita-config.mjs';

export const WORKFLOW_FILENAMES = Object.freeze(['workflow.toml', 'workflow.json']);

export function repoRoot() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  return resolve(scriptDir, '../../..');
}

function catalogPathForWorkflow({ rootPath, workflowPath, sourceId }) {
  return `${sourceId}:${normalizedRelativePath(rootPath, dirname(workflowPath))}`;
}

function workflowPathForDirectory(workflowDir, catalogName) {
  const matches = WORKFLOW_FILENAMES
    .map((filename) => join(workflowDir, filename))
    .filter((pathname) => existsSync(pathname));
  if (matches.length > 1) throw new Error(`multiple workflow definitions found for ${catalogName}`);
  return matches[0];
}

function normalizedRelativePath(workflowsRoot, workflowDir) {
  const value = relative(workflowsRoot, workflowDir).split(/[/\\]/u).join('/');
  return value.length > 0 ? value : '.';
}

function workflowEntryForPath({ workflowPath, rootPath, sourceId, rootOrder }) {
  const catalogPath = catalogPathForWorkflow({ rootPath, workflowPath, sourceId });
  let workflow;
  try {
    workflow = readWorkflowDocument(workflowPath, 'workflow');
  } catch (error) {
    throw new Error(`failed to read ${catalogPath}: ${error.message}`);
  }

  const name = typeof workflow.name === 'string' ? workflow.name.trim() : '';
  const description = typeof workflow.description === 'string' ? workflow.description.trim() : '';
  if (!name) throw new Error(`workflow is missing top-level name: ${catalogPath}`);
  if (!description) throw new Error(`workflow is missing top-level description: ${catalogPath}`);

  const workflowDir = dirname(workflowPath);
  const relativePath = normalizedRelativePath(rootPath, workflowDir);
  return {
    name,
    displayName: name,
    description,
    sourceId,
    rootOrder,
    workflowRef: `${sourceId}:${relativePath}`,
    relativePath,
    path: resolve(workflowPath),
    resolveEligible: true,
  };
}

function discoverWorkflowPaths({ workflowsRoot, currentDir = workflowsRoot }) {
  const relativePath = normalizedRelativePath(workflowsRoot, currentDir);
  const workflowPath = workflowPathForDirectory(currentDir, relativePath);
  if (workflowPath) return [workflowPath];

  return readdirSync(currentDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => discoverWorkflowPaths({ workflowsRoot, currentDir: join(currentDir, entry.name) }));
}

function readWorkflowRootCatalog({ rootPath, sourceId, rootOrder }) {
  const requestedRoot = resolve(rootPath);
  if (!existsSync(requestedRoot)) throw new Error(`workflows directory not found: ${requestedRoot}`);
  const workflowsRoot = realpathSync(requestedRoot);

  const workflows = [];
  for (const workflowPath of discoverWorkflowPaths({ workflowsRoot })) {
    workflows.push(workflowEntryForPath({ workflowPath: realpathSync(workflowPath), rootPath: workflowsRoot, sourceId, rootOrder }));
  }
  return workflows;
}

function builtInWorkflowRoot() {
  return {
    sourceId: BUILT_IN_WORKFLOW_SOURCE_ID,
    rootPath: join(repoRoot(), 'workflows'),
    rootOrder: 0,
  };
}

function overrideWorkflowRoot(workflowsRoot) {
  return {
    sourceId: OVERRIDE_WORKFLOW_SOURCE_ID,
    rootPath: resolve(workflowsRoot),
    rootOrder: 0,
  };
}

function configuredWorkflowRoots(options) {
  const config = readOrbitaConfig(options);
  return [builtInWorkflowRoot(), ...config.workflowRoots];
}

export function readWorkflowCatalog({ workflowsRoot, configPath } = {}) {
  const roots = workflowsRoot === undefined
    ? configuredWorkflowRoots({ configPath })
    : [overrideWorkflowRoot(workflowsRoot)];

  return roots
    .flatMap((root) => readWorkflowRootCatalog(root))
    .sort((left, right) => (
      left.rootOrder - right.rootOrder ||
      left.relativePath.localeCompare(right.relativePath) ||
      left.workflowRef.localeCompare(right.workflowRef)
    ));
}
