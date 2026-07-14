/** Render the instruction contract for one current normal host consumer. */
import { renderWorkerInstructions } from '../runtime/render-worker-instructions.mjs';
import { approvalInstructionsForEntry } from './host-requests.mjs';

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
    return renderWorkerInstructions({
      workflow,
      baton,
      entry,
      currentEntries,
      resources,
      followUp,
    });
  }
  if (request?.action === 'wait_for_approval') {
    return approvalInstructionsForEntry(entry, {
      baton,
      resources,
      requests,
      runId,
      runsRoot,
      leaseToken,
    });
  }
  throw new Error(`host request '${request?.stepId ?? request?.id ?? 'unknown'}' has no loadable instructions`);
}
