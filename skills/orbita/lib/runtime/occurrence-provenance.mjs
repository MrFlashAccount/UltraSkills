/** Runner-owned forward-only workflow occurrence and artifact acceptance provenance. */
import { WorkflowRuntimeError } from "../errors.mjs";

export const OCCURRENCE_PROVENANCE_STATE_KEY = "$occurrenceProvenance";
export const OCCURRENCE_PROVENANCE_VERSION = 2;

function assertStepId(value, path) {
  if (typeof value !== "string" || value.length === 0) {
    throw new WorkflowRuntimeError(
      `baton semantic validation failed: ${path} must be a non-empty step id`,
    );
  }
}

function assertPositiveInteger(value, path) {
  if (!Number.isInteger(value) || value < 1) {
    throw new WorkflowRuntimeError(
      `baton semantic validation failed: ${path} must be a positive integer`,
    );
  }
}

function validateFileStamp(stamp, path) {
  if (!stamp || typeof stamp !== "object" || Array.isArray(stamp)) {
    throw new WorkflowRuntimeError(
      `baton semantic validation failed: ${path} must be an accepted file stamp`,
    );
  }
  for (const field of ["device", "inode", "size", "mtimeMs", "ctimeMs"]) {
    if (!Number.isFinite(stamp[field]) || stamp[field] < 0) {
      throw new WorkflowRuntimeError(
        `baton semantic validation failed: ${path}.${field} must be a non-negative finite number`,
      );
    }
  }
}

export function validateOccurrenceProvenance(state) {
  const provenance = state?.[OCCURRENCE_PROVENANCE_STATE_KEY];
  if (provenance === undefined) return;
  if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) {
    throw new WorkflowRuntimeError(
      `baton semantic validation failed: state.${OCCURRENCE_PROVENANCE_STATE_KEY} must be an object`,
    );
  }
  if (provenance.version !== OCCURRENCE_PROVENANCE_VERSION) {
    throw new WorkflowRuntimeError(
      `baton semantic validation failed: state.${OCCURRENCE_PROVENANCE_STATE_KEY}.version must be ${OCCURRENCE_PROVENANCE_VERSION}`,
    );
  }
  const current = provenance.current;
  assertStepId(
    current?.ownerStepId,
    `state.${OCCURRENCE_PROVENANCE_STATE_KEY}.current.ownerStepId`,
  );
  assertPositiveInteger(
    current?.occurrence,
    `state.${OCCURRENCE_PROVENANCE_STATE_KEY}.current.occurrence`,
  );
  if (
    !provenance.counters ||
    typeof provenance.counters !== "object" ||
    Array.isArray(provenance.counters)
  ) {
    throw new WorkflowRuntimeError(
      `baton semantic validation failed: state.${OCCURRENCE_PROVENANCE_STATE_KEY}.counters must be an object`,
    );
  }
  for (const [stepId, occurrence] of Object.entries(provenance.counters)) {
    assertStepId(stepId, `state.${OCCURRENCE_PROVENANCE_STATE_KEY}.counters key`);
    assertPositiveInteger(
      occurrence,
      `state.${OCCURRENCE_PROVENANCE_STATE_KEY}.counters.${stepId}`,
    );
  }
  if (provenance.counters[current.ownerStepId] !== current.occurrence) {
    throw new WorkflowRuntimeError(
      `baton semantic validation failed: state.${OCCURRENCE_PROVENANCE_STATE_KEY}.current must match counters`,
    );
  }
  const coverage = provenance.coverage;
  if (
    !coverage ||
    !["complete", "forward_only"].includes(coverage.mode) ||
    !Number.isInteger(coverage.historyBytes) ||
    coverage.historyBytes < 0
  ) {
    throw new WorkflowRuntimeError(
      `baton semantic validation failed: state.${OCCURRENCE_PROVENANCE_STATE_KEY}.coverage must contain mode and non-negative historyBytes`,
    );
  }
  if (coverage.currentAvailable !== undefined && typeof coverage.currentAvailable !== "boolean") {
    throw new WorkflowRuntimeError(
      `baton semantic validation failed: state.${OCCURRENCE_PROVENANCE_STATE_KEY}.coverage.currentAvailable must be boolean when present`,
    );
  }
  if (coverage.firstAvailableByStep !== undefined) {
    if (
      !coverage.firstAvailableByStep ||
      typeof coverage.firstAvailableByStep !== "object" ||
      Array.isArray(coverage.firstAvailableByStep)
    ) {
      throw new WorkflowRuntimeError(
        `baton semantic validation failed: state.${OCCURRENCE_PROVENANCE_STATE_KEY}.coverage.firstAvailableByStep must be an object when present`,
      );
    }
    for (const [stepId, occurrence] of Object.entries(coverage.firstAvailableByStep)) {
      assertStepId(
        stepId,
        `state.${OCCURRENCE_PROVENANCE_STATE_KEY}.coverage.firstAvailableByStep key`,
      );
      assertPositiveInteger(
        occurrence,
        `state.${OCCURRENCE_PROVENANCE_STATE_KEY}.coverage.firstAvailableByStep.${stepId}`,
      );
      if (occurrence > (provenance.counters[stepId] ?? 0)) {
        throw new WorkflowRuntimeError(
          `baton semantic validation failed: state.${OCCURRENCE_PROVENANCE_STATE_KEY}.coverage.firstAvailableByStep.${stepId} exceeds its counter`,
        );
      }
    }
  }
  for (const [requestId, acceptance] of Object.entries(
    provenance.pendingArtifactAcceptances ?? {},
  )) {
    assertStepId(
      requestId,
      `state.${OCCURRENCE_PROVENANCE_STATE_KEY}.pendingArtifactAcceptances key`,
    );
    assertStepId(
      acceptance?.ownerStepId,
      `state.${OCCURRENCE_PROVENANCE_STATE_KEY}.pendingArtifactAcceptances.${requestId}.ownerStepId`,
    );
    assertPositiveInteger(
      acceptance?.ownerOccurrence,
      `state.${OCCURRENCE_PROVENANCE_STATE_KEY}.pendingArtifactAcceptances.${requestId}.ownerOccurrence`,
    );
    if (acceptance?.producerRequestId !== requestId || !Array.isArray(acceptance?.artifacts)) {
      throw new WorkflowRuntimeError(
        `baton semantic validation failed: state.${OCCURRENCE_PROVENANCE_STATE_KEY}.pendingArtifactAcceptances.${requestId} is invalid`,
      );
    }
    for (const [index, artifact] of acceptance.artifacts.entries()) {
      if (typeof artifact?.id !== "string" || artifact.id.length === 0) {
        throw new WorkflowRuntimeError(
          `baton semantic validation failed: pending artifact acceptance ${requestId}/${index} requires id`,
        );
      }
      validateFileStamp(
        artifact.acceptedFileStamp,
        `pending artifact acceptance ${requestId}/${index}.acceptedFileStamp`,
      );
    }
  }
}

export function initialOccurrenceProvenance(ownerStepId) {
  assertStepId(ownerStepId, "initial occurrence ownerStepId");
  return {
    version: OCCURRENCE_PROVENANCE_VERSION,
    counters: { [ownerStepId]: 1 },
    current: { ownerStepId, occurrence: 1 },
    coverage: {
      mode: "complete",
      historyBytes: 0,
      currentAvailable: true,
      firstAvailableByStep: { [ownerStepId]: 1 },
    },
    pendingArtifactAcceptances: {},
  };
}

export function ensureOccurrenceProvenance(baton, { historyBytes = 0 } = {}) {
  if (baton?.state?.[OCCURRENCE_PROVENANCE_STATE_KEY]) return structuredClone(baton);
  const ownerStepId = baton?.cursor;
  assertStepId(ownerStepId, "legacy occurrence ownerStepId");
  const next = structuredClone(baton);
  next.state[OCCURRENCE_PROVENANCE_STATE_KEY] = {
    ...initialOccurrenceProvenance(ownerStepId),
    coverage: {
      mode: "forward_only",
      historyBytes,
      currentAvailable: false,
      firstAvailableByStep: {},
    },
  };
  return next;
}

export function currentOccurrence(baton) {
  const current = baton?.state?.[OCCURRENCE_PROVENANCE_STATE_KEY]?.current;
  return current ? structuredClone(current) : undefined;
}

export function advanceOccurrence(baton, targetStepId) {
  const next = ensureOccurrenceProvenance(baton);
  const provenance = next.state[OCCURRENCE_PROVENANCE_STATE_KEY];
  const occurrence = (provenance.counters[targetStepId] ?? 0) + 1;
  provenance.counters[targetStepId] = occurrence;
  provenance.current = { ownerStepId: targetStepId, occurrence };
  provenance.coverage.currentAvailable = true;
  provenance.coverage.firstAvailableByStep ??= {};
  provenance.coverage.firstAvailableByStep[targetStepId] ??= occurrence;
  return next;
}

export function currentOccurrenceIsAvailable(baton) {
  const provenance = baton?.state?.[OCCURRENCE_PROVENANCE_STATE_KEY];
  const current = provenance?.current;
  return Boolean(
    current && occurrenceIsAvailable(provenance, current.ownerStepId, current.occurrence),
  );
}

export function occurrenceIsAvailable(provenance, ownerStepId, occurrence) {
  const coverage = provenance?.coverage;
  if (!coverage || !Number.isInteger(occurrence) || occurrence < 1) return false;
  if (coverage.mode === "complete") return true;
  const firstAvailable = coverage.firstAvailableByStep?.[ownerStepId];
  if (Number.isInteger(firstAvailable)) return occurrence >= firstAvailable;
  // Compatibility for provenance written before the persisted per-step boundary:
  // only the explicitly current routed owner may be treated as covered.
  return Boolean(
    coverage.currentAvailable === true &&
    provenance?.current?.ownerStepId === ownerStepId &&
    provenance?.current?.occurrence === occurrence,
  );
}

export function recordArtifactAcceptance(
  baton,
  { ownerStepId, ownerOccurrence, producerRequestId, artifacts },
) {
  if (!Array.isArray(artifacts) || artifacts.length === 0) return structuredClone(baton);
  const next = ensureOccurrenceProvenance(baton);
  next.state[OCCURRENCE_PROVENANCE_STATE_KEY].pendingArtifactAcceptances[producerRequestId] = {
    ownerStepId,
    ownerOccurrence,
    producerRequestId,
    artifacts: structuredClone(artifacts),
  };
  return next;
}

export function takeArtifactAcceptance(state, producerRequestId) {
  const provenance = state?.[OCCURRENCE_PROVENANCE_STATE_KEY];
  const acceptance = provenance?.pendingArtifactAcceptances?.[producerRequestId];
  if (!acceptance) return undefined;
  delete provenance.pendingArtifactAcceptances[producerRequestId];
  return acceptance;
}
