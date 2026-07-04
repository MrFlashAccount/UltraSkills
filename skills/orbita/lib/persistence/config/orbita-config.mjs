import { existsSync, realpathSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';

export const BUILT_IN_WORKFLOW_SOURCE_ID = 'built-in';
export const OVERRIDE_WORKFLOW_SOURCE_ID = 'override';

const SOURCE_ID_RE = /^[a-z][a-z0-9-]{0,63}$/;
const RESERVED_SOURCE_IDS = new Set([BUILT_IN_WORKFLOW_SOURCE_ID, OVERRIDE_WORKFLOW_SOURCE_ID]);

function defaultOrbitaHome() {
  return path.resolve(process.env.ORBITA_HOME ?? path.join(homedir(), '.orbita'));
}

export function defaultOrbitaConfigPath() {
  return path.join(defaultOrbitaHome(), 'orbita.toml');
}

function parseTomlConfig(content, configPath) {
  if (!globalThis.Bun?.TOML?.parse) {
    throw new Error(`failed to read Orbita config TOML: Bun.TOML.parse is not available`);
  }
  try {
    return globalThis.Bun.TOML.parse(content);
  } catch (error) {
    throw new Error(`failed to read Orbita config TOML: ${error.message}`);
  }
}

function configuredRootsFromDocument(document) {
  const roots = document?.workflow_catalog?.roots
    ?? document?.workflowCatalog?.roots
    ?? document?.workflow_catalog?.workflow_roots
    ?? document?.workflow_roots
    ?? document?.workflowRoots
    ?? [];
  if (roots === undefined || roots === null) return [];
  if (!Array.isArray(roots)) throw new Error('Orbita config workflow_roots must be an array');
  return roots;
}

function resolveConfiguredRootPath(rootPath, configDir) {
  if (rootPath === '~') return homedir();
  if (rootPath.startsWith('~/')) return path.join(homedir(), rootPath.slice(2));
  return path.resolve(configDir, rootPath);
}

function normalizeConfiguredRoot(root, index, configDir) {
  const sourceId = root?.source_id ?? root?.sourceId ?? root?.id;
  if (typeof sourceId !== 'string' || sourceId.trim().length === 0) {
    throw new Error(`Orbita config workflow root #${index + 1} is missing source_id`);
  }
  if (!SOURCE_ID_RE.test(sourceId)) {
    throw new Error(`Orbita config workflow root source_id is invalid: ${sourceId}`);
  }
  if (RESERVED_SOURCE_IDS.has(sourceId)) {
    throw new Error(`Orbita config workflow root source_id is reserved: ${sourceId}`);
  }

  const rootPath = root?.path;
  if (typeof rootPath !== 'string' || rootPath.trim().length === 0) {
    throw new Error(`Orbita config workflow root '${sourceId}' path is required`);
  }
  const absoluteRoot = resolveConfiguredRootPath(rootPath, configDir);
  let realRoot;
  try {
    realRoot = realpathSync(absoluteRoot);
  } catch (error) {
    throw new Error(`Orbita config workflow root '${sourceId}' is not readable (${error.code ?? error.message})`);
  }
  return {
    sourceId,
    rootPath: realRoot,
    rootOrder: index + 1,
  };
}

function assertUniqueConfiguredRoots(roots) {
  const sourceIds = new Set();
  const rootPaths = new Map();
  for (const root of roots) {
    if (sourceIds.has(root.sourceId)) throw new Error(`Orbita config has duplicate workflow root source_id: ${root.sourceId}`);
    if (rootPaths.has(root.rootPath)) throw new Error(`Orbita config has duplicate workflow root path for source_id: ${root.sourceId}`);
    sourceIds.add(root.sourceId);
    rootPaths.set(root.rootPath, root.sourceId);
  }
}

export function readOrbitaConfig({ configPath = process.env.ORBITA_CONFIG ?? defaultOrbitaConfigPath() } = {}) {
  const resolvedConfigPath = path.resolve(configPath);
  if (!existsSync(resolvedConfigPath)) return { configPath: resolvedConfigPath, workflowRoots: [] };
  const document = parseTomlConfig(readFileSync(resolvedConfigPath, 'utf8'), resolvedConfigPath);
  const configDir = path.dirname(resolvedConfigPath);
  const workflowRoots = configuredRootsFromDocument(document)
    .map((root, index) => normalizeConfiguredRoot(root, index, configDir));
  assertUniqueConfiguredRoots(workflowRoots);
  return { configPath: resolvedConfigPath, workflowRoots };
}
