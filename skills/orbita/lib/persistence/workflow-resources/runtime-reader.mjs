import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { readWorkflowFileRef, resolveWorkflowFileRef, defaultRepositoryRootForWorkflow } from './resource-resolver.mjs';
import { loadOutputSchema } from './output-schema-loader.mjs';
import { isInside } from '../filesystem/path-safety.mjs';
import { WorkflowRuntimeError } from '../../errors.mjs';
import { listAllowedWorkflowRoles, workflowRoleMaterialPath, REQUIRED_WORKFLOW_ROLE_MATERIAL_FILES } from './role-material-catalog.mjs';
import { assertWorkflowSchema } from '../../file-contracts/workflow-document-schema.mjs';
import { readWorkflowDocument } from './workflow-document-reader.mjs';
import { assertBatonSchema, batonSchema } from '../../file-contracts/baton/baton-schema.mjs';
import { compileWorkflowForRuntime } from '../../runtime/compiled-workflow.mjs';
import { isValidatedPersistedBaton } from '../validated-baton.mjs';

const compiledRuntimeCache = new Map();
const COMPILED_RUNTIME_CACHE_MAX_ENTRIES = 64;

function readJson(pathname, kind) {
  try {
    return JSON.parse(readFileSync(pathname, 'utf8'));
  } catch (error) {
    throw new WorkflowRuntimeError(`failed to read ${kind} JSON: ${error.message}`);
  }
}

function fileSignature(pathname) {
  try {
    const stats = statSync(pathname);
    return `${path.resolve(pathname)}:${stats.mtimeMs}:${stats.size}`;
  } catch (error) {
    if (error?.code === 'ENOENT') return `${path.resolve(pathname)}:missing`;
    throw error;
  }
}

function templateRefs(workflow) {
  const refs = [];
  const seen = new Set();
  for (const step of Object.values(workflow?.steps ?? {})) {
    const refsForStep = [
      ['input', step?.input?.template],
      ['output', step?.output?.template],
      ['input', step?.worker?.input?.template],
      ['output', step?.worker?.output?.template],
    ];
    for (const branch of Object.values(step?.branches ?? {})) {
      refsForStep.push(['input', branch?.input?.template], ['output', branch?.output?.template]);
    }
    for (const [fieldName, ref] of refsForStep) {
      if (!ref || seen.has(`${fieldName}:${ref}`)) continue;
      seen.add(`${fieldName}:${ref}`);
      refs.push({ ref, fieldName });
    }
  }
  return refs;
}

function schemaRefs(workflow) {
  const refs = new Set();
  for (const step of Object.values(workflow?.steps ?? {})) {
    if (step?.kind !== 'approval' && step?.output?.schema) refs.add(step.output.schema);
    if (step?.worker?.output?.schema) refs.add(step.worker.output.schema);
    for (const branch of Object.values(step?.branches ?? {})) {
      if (branch?.output?.schema) refs.add(branch.output.schema);
    }
  }
  return refs;
}

function roleNames(workflow) {
  const roles = new Set();
  for (const step of Object.values(workflow?.steps ?? {})) {
    if (step?.input?.role) roles.add(step.input.role);
    if (step?.worker?.input?.role) roles.add(step.worker.input.role);
    for (const branch of Object.values(step?.branches ?? {})) {
      if (branch?.input?.role) roles.add(branch.input.role);
    }
  }
  return roles;
}

function inputResourceRefs(workflow) {
  const refs = new Set();
  const collect = (input) => {
    for (const ref of input?.resources ?? []) refs.add(ref);
  };
  for (const step of Object.values(workflow?.steps ?? {})) {
    collect(step?.input);
    collect(step?.worker?.input);
    for (const branch of Object.values(step?.branches ?? {})) collect(branch?.input);
  }
  return refs;
}


function resolveSafeRunArtifactPath({ runDir, artifactPath }) {
  if (typeof artifactPath !== 'string' || artifactPath.length === 0) {
    throw new WorkflowRuntimeError('workflow prompt render failed: artifact path must be non-empty string');
  }
  const root = path.resolve(runDir);
  const candidate = path.isAbsolute(artifactPath) ? path.resolve(artifactPath) : path.resolve(root, path.normalize(artifactPath));
  if (!isInside(candidate, root)) {
    throw new WorkflowRuntimeError(`workflow prompt render failed: artifact path cannot escape run directory: ${artifactPath}`);
  }
  return candidate;
}

function resolveExistingRunArtifactPath({ runDir, artifactPath }) {
  const root = path.resolve(runDir);
  const candidate = resolveSafeRunArtifactPath({ runDir, artifactPath });
  if (!existsSync(candidate)) {
    throw new WorkflowRuntimeError(`workflow prompt render failed: missing artifact file '${artifactPath}'`);
  }
  const realRoot = realpathSync(root);
  const realCandidate = realpathSync(candidate);
  if (!isInside(realCandidate, realRoot)) {
    throw new WorkflowRuntimeError(`workflow prompt render failed: artifact path cannot escape run directory via symlink: ${artifactPath}`);
  }
  return realCandidate;
}

export function readRunArtifactContent({ runDir, artifactPath }) {
  if (!runDir) throw new WorkflowRuntimeError('workflow prompt render failed: run directory is required to read artifact content');
  const realCandidate = resolveExistingRunArtifactPath({ runDir, artifactPath });
  return readFileSync(realCandidate, 'utf8');
}

function artifactReaderForRunDir(runDir) {
  if (!runDir) return undefined;
  return (artifactPath) => readRunArtifactContent({ runDir, artifactPath });
}

function artifactPathResolverForRunDir(runDir) {
  if (!runDir) return undefined;
  return (artifactPath) => resolveSafeRunArtifactPath({ runDir, artifactPath });
}

function existingArtifactPathResolverForRunDir(runDir) {
  if (!runDir) return undefined;
  return (artifactPath) => resolveExistingRunArtifactPath({ runDir, artifactPath });
}

function isDeferredMissingResource(error) {
  return error instanceof WorkflowRuntimeError && /\b(missing|not found)\b/.test(error.message);
}

function loadTemplates({ workflow, workflowPath, repositoryRoot }) {
  const templates = {};
  for (const { ref, fieldName } of templateRefs(workflow)) {
    try {
      templates[ref] = readWorkflowFileRef({ workflowPath, fileRef: ref, kind: 'template', fieldName, messagePrefix: 'workflow prompt render failed', repositoryRoot });
    } catch (error) {
      if (!isDeferredMissingResource(error)) throw error;
      // Missing templates are reported by the Template entity only if the current render actually needs them.
    }
  }
  return templates;
}

function loadSchemas({ workflow, workflowPath, repositoryRoot }) {
  const outputSchemas = {};
  for (const schemaRef of schemaRefs(workflow)) {
    try {
      outputSchemas[schemaRef] = loadOutputSchema({ workflow, workflowPath, schemaRef, repositoryRoot, messagePrefix: 'workflow prompt render failed' });
    } catch (error) {
      if (!isDeferredMissingResource(error)) throw error;
      // Missing schemas are reported when a rendered/applied step needs the schema.
    }
  }
  return outputSchemas;
}

function readRoleMaterialFile({ root, displayRoot, role, fileName }) {
  const relative = workflowRoleMaterialPath(role, fileName);
  const candidate = path.join(root, relative);
  const displayPath = path.resolve(displayRoot, relative);
  let resolvedPath;
  try {
    resolvedPath = realpathSync(candidate);
  } catch {
    return { path: displayPath };
  }
  if (!isInside(resolvedPath, root)) {
    throw new WorkflowRuntimeError(`workflow prompt render failed: input.role material escapes repository root: ${relative}`);
  }
  return { content: readFileSync(resolvedPath, 'utf8'), path: displayPath };
}

function loadRoleMaterials({ workflow, repositoryRoot }) {
  const root = realpathSync(repositoryRoot);
  const displayRoot = path.resolve(repositoryRoot);
  const roleMaterials = {};
  for (const role of roleNames(workflow)) {
    roleMaterials[role] = REQUIRED_WORKFLOW_ROLE_MATERIAL_FILES.map((fileName) => readRoleMaterialFile({ root, displayRoot, role, fileName }));
    // Missing role material content is reported by Template only when a rendered step needs it.
  }
  return roleMaterials;
}

function loadInputResources({ workflow, workflowPath, repositoryRoot }) {
  const inputResources = {};
  for (const ref of inputResourceRefs(workflow)) {
    const resolvedPath = resolveWorkflowFileRef({
      workflowPath,
      fileRef: ref,
      fieldName: 'input.resources',
      kind: 'resource',
      messagePrefix: 'workflow prompt render failed',
      repositoryRoot,
    });
    if (!statSync(resolvedPath).isFile()) {
      throw new WorkflowRuntimeError(`workflow prompt render failed: input.resources resource must be a file: ${ref}`);
    }
    inputResources[ref] = {
      path: resolvedPath,
    };
  }
  return inputResources;
}

export function loadWorkflowResources({ workflow, workflowPath, repositoryRoot = defaultRepositoryRootForWorkflow(workflowPath), runDir } = {}) {
  return {
    templates: loadTemplates({ workflow, workflowPath, repositoryRoot }),
    outputSchemas: loadSchemas({ workflow, workflowPath, repositoryRoot }),
    schemaDefinitions: [batonSchema],
    roleMaterials: loadRoleMaterials({ workflow, repositoryRoot }),
    inputResources: loadInputResources({ workflow, workflowPath, repositoryRoot }),
    allowedRoles: listAllowedWorkflowRoles({ repositoryRoot }),
    runDir: runDir ? path.resolve(runDir) : undefined,
    readRunArtifact: artifactReaderForRunDir(runDir),
    resolveRunArtifactPath: artifactPathResolverForRunDir(runDir),
    resolveExistingRunArtifactPath: existingArtifactPathResolverForRunDir(runDir),
  };
}

function runScopedResources(runDir) {
  return {
    runDir: runDir ? path.resolve(runDir) : undefined,
    readRunArtifact: artifactReaderForRunDir(runDir),
    resolveRunArtifactPath: artifactPathResolverForRunDir(runDir),
    resolveExistingRunArtifactPath: existingArtifactPathResolverForRunDir(runDir),
  };
}

function loadWorkflowStaticResources({ workflow, workflowPath, repositoryRoot = defaultRepositoryRootForWorkflow(workflowPath) } = {}) {
  return {
    templates: loadTemplates({ workflow, workflowPath, repositoryRoot }),
    outputSchemas: loadSchemas({ workflow, workflowPath, repositoryRoot }),
    schemaDefinitions: [batonSchema],
    roleMaterials: loadRoleMaterials({ workflow, repositoryRoot }),
    inputResources: loadInputResources({ workflow, workflowPath, repositoryRoot }),
    allowedRoles: listAllowedWorkflowRoles({ repositoryRoot }),
  };
}

function resourceSignaturePaths({ workflowPath, repositoryRoot, resources }) {
  const paths = [workflowPath, path.join(repositoryRoot, 'roles')];
  for (const template of Object.values(resources.templates ?? {})) {
    if (template?.path) paths.push(template.path);
  }
  for (const loaded of Object.values(resources.outputSchemas ?? {})) {
    if (loaded?.schemaPath) paths.push(loaded.schemaPath);
  }
  for (const materials of Object.values(resources.roleMaterials ?? {})) {
    for (const material of materials ?? []) {
      if (material?.path) paths.push(material.path);
    }
  }
  for (const resource of Object.values(resources.inputResources ?? {})) {
    if (resource?.path) paths.push(resource.path);
  }
  return [...new Set(paths.map((entry) => path.resolve(entry)))].sort();
}

function resourceSignature(paths) {
  return paths.map(fileSignature).join('\u001f');
}

function loadCompiledWorkflowPackage({ workflowPath }) {
  const cacheKey = path.resolve(workflowPath);
  const cached = compiledRuntimeCache.get(cacheKey);
  if (cached && resourceSignature(cached.signaturePaths) === cached.signature) return cached;

  const workflow = readWorkflowDocument(workflowPath, 'workflow');
  assertWorkflowSchema(workflow);
  const repositoryRoot = defaultRepositoryRootForWorkflow(workflowPath);
  const staticResources = loadWorkflowStaticResources({ workflow, workflowPath, repositoryRoot });
  const signaturePaths = resourceSignaturePaths({ workflowPath, repositoryRoot, resources: staticResources });
  const entry = {
    workflow: compileWorkflowForRuntime(workflow, staticResources),
    repositoryRoot,
    staticResources,
    signaturePaths,
    signature: resourceSignature(signaturePaths),
  };
  if (!compiledRuntimeCache.has(cacheKey) && compiledRuntimeCache.size >= COMPILED_RUNTIME_CACHE_MAX_ENTRIES) {
    compiledRuntimeCache.delete(compiledRuntimeCache.keys().next().value);
  }
  compiledRuntimeCache.set(cacheKey, entry);
  return entry;
}

export function loadWorkflowRuntime({ workflowPath, batonPath, baton }) {
  const batonDoc = baton ?? readJson(batonPath, 'baton');
  if (!isValidatedPersistedBaton(batonDoc)) assertBatonSchema(batonDoc);
  const compiledPackage = loadCompiledWorkflowPackage({ workflowPath });
  const resources = {
    ...compiledPackage.staticResources,
    ...runScopedResources(batonPath ? path.dirname(batonPath) : undefined),
  };
  return {
    workflow: compileWorkflowForRuntime(compiledPackage.workflow, resources),
    baton: batonDoc,
    resources,
    repositoryRoot: compiledPackage.repositoryRoot,
  };
}

export function readWorkerOutputValue({ outputPath, name = 'worker output' }) {
  return readJson(outputPath, name);
}

export function readWorkerOutputText({ outputPath }) {
  return readFileSync(outputPath, 'utf8');
}
