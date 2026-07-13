/** Worker-only Template adapter for one effective run_worker entry. */
import { renderWorkflowPrompt } from '../entities/Template/index.mjs';
import { batonForFanoutPrompt } from './fanout.mjs';
import { shardInterpolationContext } from './shard.mjs';
import { assertStartupUserPromptTargetRenderable, selectedUserPromptStepId } from './user-prompt.mjs';

export function renderWorkerInstructions({ workflow, baton, entry, currentEntries = [entry], resources, includeDiagnostics = false, followUp = false } = {}) {
  if (entry?.action !== 'run_worker' || !['worker', 'fanout', 'shard'].includes(entry?.step?.kind)) {
    throw new Error(`worker instruction renderer only accepts effective run_worker entries, received '${entry?.action ?? 'missing'}'`);
  }
  assertStartupUserPromptTargetRenderable({ workflow, baton, steps: currentEntries });
  const userPromptStepId = selectedUserPromptStepId({ workflow, baton });
  const stepResources = {
    ...resources,
    validatingWriterCommand: resources?.validatingWriterCommandForStep?.(entry.id, entry.step) ?? resources?.validatingWriterCommand,
    reportStopCommand: resources?.reportStopCommandForStep?.(entry.id) ?? resources?.reportStopCommand,
    artifactOutputDir: resources?.artifactOutputDirForStep?.(entry.id) ?? resources?.artifactOutputDir,
    debugSummaryPath: resources?.debugSummaryPathForStep?.(entry.id, entry.step) ?? resources?.debugSummaryPath,
  };
  return renderWorkflowPrompt({
    workflow,
    baton: batonForFanoutPrompt({ workflow, baton, entry }),
    stepId: entry.id,
    step: entry.step,
    resources: stepResources,
    shard: shardInterpolationContext({ baton, entry }),
    includeDiagnostics,
    userPrompt: userPromptStepId === entry.id ? baton.user_prompt : undefined,
    followUp,
  }).prompt;
}
