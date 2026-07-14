/** Occurrence persistence and accepted-output enrichment kept outside the command orchestrator. */
import {
  OCCURRENCE_PROVENANCE_STATE_KEY,
  currentOccurrence,
  currentOccurrenceIsAvailable,
  ensureOccurrenceProvenance,
  recordArtifactAcceptance,
} from "../runtime/occurrence-provenance.mjs";

export function createPersistedOccurrenceEnsurer({
  readPersistedRunState,
  writePersistedRunStateUpdate,
}) {
  return async function ensurePersistedOccurrenceProvenance(paths, current) {
    if (current.baton?.state?.[OCCURRENCE_PROVENANCE_STATE_KEY]) return current;
    const loaded =
      current.history?.mode === "embedded-text"
        ? current
        : await readPersistedRunState(paths, { includeHistoryText: true });
    const historyBytes = Buffer.byteLength(loaded.history?.text ?? "", "utf8");
    const baton = ensureOccurrenceProvenance(loaded.baton, { historyBytes });
    return writePersistedRunStateUpdate(
      paths,
      {
        baton,
        history: {
          source: "workflow-runner-provenance-seed",
          baton,
          details: [
            `- orbita-v2: ${JSON.stringify({
              event: "coverage_seed",
              ownerStepId: baton.cursor,
              ownerOccurrence: 1,
              coverageMode: "forward_only",
              historyBytes,
              currentAvailable: false,
            })}`,
          ],
        },
      },
      { currentState: loaded },
    );
  };
}

export function batonWithAcceptedOutputProvenance({
  baton,
  stepId,
  output,
  ownerStepId,
  acceptedFiles = [],
}) {
  let nextBaton = structuredClone(baton);
  nextBaton.state = { ...nextBaton.state, [stepId]: structuredClone(output) };
  if (nextBaton.nonBlockingStops?.[stepId]) {
    delete nextBaton.nonBlockingStops[stepId];
    if (Object.keys(nextBaton.nonBlockingStops).length === 0) delete nextBaton.nonBlockingStops;
  }
  if (acceptedFiles.length === 0 || !currentOccurrenceIsAvailable(nextBaton)) return nextBaton;
  const occurrence = currentOccurrence(nextBaton);
  if (!occurrence || occurrence.ownerStepId !== ownerStepId) {
    throw new Error(
      `workflow request '${stepId}' does not match current occurrence owner '${occurrence?.ownerStepId ?? "unknown"}'`,
    );
  }
  nextBaton = recordArtifactAcceptance(nextBaton, {
    ownerStepId,
    ownerOccurrence: occurrence.occurrence,
    producerRequestId: stepId,
    artifacts: acceptedFiles,
  });
  return nextBaton;
}

export function stopLifecycleHistoryFact(baton, { event, producerRequestId, request }) {
  const occurrence = currentOccurrence(baton);
  if (!occurrence) return undefined;
  return `- orbita-v2: ${JSON.stringify({
    event,
    ownerStepId: occurrence.ownerStepId,
    ownerOccurrence: occurrence.occurrence,
    producerRequestId,
    activation: request?.fanout?.activation ?? request?.shard?.activation,
    workItem: request?.fanout?.branch_id ?? request?.shard?.index,
  })}`;
}
