/** Render the instruction contract for one current normal host consumer. */
import { renderWorkerInstructions } from '../runtime/render-worker-instructions.mjs';
import { appendPromptText } from '../runtime/prompt-text.mjs';
import { approvalInstructionsForEntry } from './host-requests.mjs';

function withPointerTransitionFeedback(instructions, baton) {
  const feedback = baton?.pointerTransition?.feedback;
  if (typeof feedback !== 'string' || feedback.length === 0) return instructions;
  return appendPromptText(instructions, [
    '## Pointer rollback feedback',
    'This step was explicitly re-entered. Address the feedback below before submitting replacement output.',
    feedback,
  ].join('\n\n'));
}

export function renderCurrentRequestInstructions({
  request,
  workflow,
  baton,
  entry,
  currentEntries,
  resources,
  requests,
  runId,
  runsRoot,
  leaseToken,
  followUp = false,
} = {}) {
  if (request?.action === 'run_worker') {
    return withPointerTransitionFeedback(renderWorkerInstructions({
      workflow,
      baton,
      entry,
      currentEntries,
      resources,
      followUp,
    }), baton);
  }
  if (request?.action === 'wait_for_approval') {
    return withPointerTransitionFeedback(approvalInstructionsForEntry(entry, {
      baton,
      resources,
      requests,
      runId,
      runsRoot,
      leaseToken,
    }), baton);
  }
  throw new Error(`host request '${request?.stepId ?? request?.id ?? 'unknown'}' has no loadable instructions`);
}
