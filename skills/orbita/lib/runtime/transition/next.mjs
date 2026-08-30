import { Step } from '../../entities/Step/index.mjs';
import { responseForStepEntry } from '../output/response.mjs';
import { markUserPromptInjectedForStep, validateSelectedStartupUserPromptTarget } from '../user-prompt.mjs';

export function applyNextTransition({ workflow, baton, cursorStep, workerOutput, stepId = baton.cursor }) {
  const cursor = new Step({ id: stepId, step: cursorStep });
  const batonWithPromptMarker = markUserPromptInjectedForStep({
    workflow,
    baton,
    stepId,
  });
  const applied = cursor.applyOutput({ workflow, baton: batonWithPromptMarker, output: workerOutput });
  const response = responseForStepEntry(applied.baton, workflow);
  const updatedBaton = validateSelectedStartupUserPromptTarget({
    workflow,
    baton: response.baton,
    steps: response.steps,
  });

  return { ...response, baton: updatedBaton };
}
