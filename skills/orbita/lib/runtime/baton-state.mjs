import { WorkflowRuntimeError } from '../errors.mjs';
import { cloneCentralArtifactMetadata } from '../entities/Baton/artifact-contract.mjs';
import { takeArtifactAcceptance } from './occurrence-provenance.mjs';

export const LOOP_PROGRESS_STATE_KEY = '$loopProgress';

function cloneBoundaryData(dto) {
  return typeof dto?.toJSON === 'function' ? dto.toJSON() : structuredClone(dto);
}

function cloneArtifactMetadata(artifact, path) {
  return cloneCentralArtifactMetadata(artifact, path, { errorPrefix: 'worker output failed schema validation' });
}

function producerStepIdForArtifact({ stepId, artifact, path }) {
  if (!stepId) {
    const id = typeof artifact?.id === 'string' && artifact.id ? artifact.id : '<missing id>';
    throw new WorkflowRuntimeError(`worker output failed schema validation: ${path} cannot determine producerStepId for artifact '${id}'; pass stepId`);
  }
  return stepId;
}

function aggregateArtifactEntry(stepId, artifact, { path = '/artifacts/*', acceptance } = {}) {
  const entry = {
    producerStepId: producerStepIdForArtifact({ stepId, artifact, path }),
    artifact: cloneArtifactMetadata(artifact, path),
  };
  if (acceptance) {
    const acceptedArtifact = acceptance.artifacts.find((candidate) => candidate.id === artifact.id);
    if (!acceptedArtifact) {
      throw new WorkflowRuntimeError(`worker output failed schema validation: ${path} has no accepted file stamp for artifact '${artifact.id}'`);
    }
    entry.producerStepId = acceptance.ownerStepId;
    entry.producerOccurrence = acceptance.ownerOccurrence;
    entry.producerRequestId = acceptance.producerRequestId;
    entry.acceptedFileStamp = structuredClone(acceptedArtifact.acceptedFileStamp);
  }
  return entry;
}

function normalizeAggregateArtifactEntry(entry, index) {
  const path = `/state/artifacts/${index}`;
  if (!entry || typeof entry !== 'object' || Array.isArray(entry) || typeof entry.producerStepId !== 'string' || !entry.producerStepId || !entry.artifact) {
    throw new WorkflowRuntimeError(`worker output failed schema validation: ${path} must be aggregate artifact {producerStepId, artifact}`);
  }
  const normalized = {
    producerStepId: entry.producerStepId,
    artifact: cloneArtifactMetadata(entry.artifact, `${path}/artifact`),
  };
  for (const field of ['producerOccurrence', 'producerRequestId', 'acceptedFileStamp']) {
    if (entry[field] !== undefined) normalized[field] = structuredClone(entry[field]);
  }
  return normalized;
}

function artifactIdentity(entry) {
  const { producerStepId, artifact } = entry;
  return entry.producerOccurrence === undefined
    ? `legacy::${producerStepId}::${artifact.id}`
    : `${producerStepId}::${entry.producerOccurrence}::${entry.producerRequestId}::${artifact.id}`;
}

function assertUniqueAggregateArtifacts(entries, { errorPrefix }) {
  const seen = new Map();
  for (const [index, entry] of entries.entries()) {
    const identity = artifactIdentity(entry);
    if (seen.has(identity)) {
      throw new WorkflowRuntimeError(
        `${errorPrefix}: duplicate artifact identity {producerStepId: '${entry.producerStepId}', artifact.id: '${entry.artifact.id}'} at entries ${seen.get(identity)} and ${index}`,
      );
    }
    seen.set(identity, index);
  }
}

function mergeArtifacts(existingArtifacts, newArtifacts = [], stepId, acceptance) {
  const merged = existingArtifacts.map((entry, index) => normalizeAggregateArtifactEntry(entry, index));
  assertUniqueAggregateArtifacts(merged, { errorPrefix: 'worker output failed schema validation: /state/artifacts' });

  const incomingBatch = newArtifacts.map((artifact, index) => aggregateArtifactEntry(stepId, artifact, { path: `/artifacts/${index}`, acceptance }));
  assertUniqueAggregateArtifacts(incomingBatch, { errorPrefix: 'worker output failed schema validation: /artifacts' });

  for (const incoming of incomingBatch) {
    const incomingIdentity = artifactIdentity(incoming);
    const existingIndex = merged.findIndex((existing) => artifactIdentity(existing) === incomingIdentity);
    if (existingIndex >= 0) merged[existingIndex] = incoming;
    else merged.push(incoming);
  }
  return merged;
}

function appendResults(existingResults = [], newResults = []) {
  return [...existingResults, ...newResults];
}

function aggregateArray(output, fieldName) {
  const value = output[fieldName];
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new WorkflowRuntimeError(`worker output failed schema validation: /${fieldName} must be array`);
  return value;
}

export function applyOutputToBatonState(baton, output, attempts, stepId, { loopProgress, producerRequestId = stepId } = {}) {
  const batonData = cloneBoundaryData(baton);
  const state = {
    ...batonData.state,
    results: appendResults(batonData.state?.results ?? [], aggregateArray(output, 'results')),
  };
  const acceptance = producerRequestId ? takeArtifactAcceptance(state, producerRequestId) : undefined;
  state.artifacts = mergeArtifacts(batonData.state?.artifacts ?? [], aggregateArray(output, 'artifacts'), stepId, acceptance);

  if (stepId) {
    state[stepId] = structuredClone(output);
  }

  if (attempts) state.attempts = attempts;
  if (loopProgress) state[LOOP_PROGRESS_STATE_KEY] = loopProgress;
  return state;
}
