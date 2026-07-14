/** Builds request-scoped worker writer and occurrence-aware artifact directory capabilities. */
import { currentOccurrence } from '../runtime/occurrence-provenance.mjs';

export function createRunnerResourcesBuilder({
  artifactOutputDirForOccurrence,
  assertSafeStepId,
  join,
  reportStopCommandForStep,
  writeOutputCommandForStep,
}) {
  return function resourcesWithValidatingWriter(resources, paths, { leaseToken, baton } = {}) {
    const requiresDebugSummary = (step) => ['worker', 'fanout', 'shard'].includes(step?.kind);
    const debugSummaryPathForStep = (stepId) => {
      assertSafeStepId(stepId);
      return join(paths.runDir, stepId, 'debug-summary.md');
    };
    return {
      ...resources,
      validatingWriterCommandForStep: (stepId, step) => writeOutputCommandForStep(paths.runId, stepId, {
        runsRoot: paths.runsRoot,
        leaseToken,
        debugSummaryFile: requiresDebugSummary(step) ? debugSummaryPathForStep(stepId) : undefined,
      }),
      reportStopCommandForStep: (stepId) => reportStopCommandForStep(paths.runId, stepId, { runsRoot: paths.runsRoot, leaseToken }),
      artifactOutputDirForStep: (stepId) => {
        assertSafeStepId(stepId);
        const occurrence = currentOccurrence(baton) ?? { ownerStepId: baton?.cursor, occurrence: 1 };
        return artifactOutputDirForOccurrence(paths, {
          ownerStepId: occurrence.ownerStepId,
          occurrence: occurrence.occurrence,
          producerRequestId: stepId,
        });
      },
      debugSummaryPathForStep: (stepId, step) => requiresDebugSummary(step) ? debugSummaryPathForStep(stepId) : undefined,
    };
  };
}
