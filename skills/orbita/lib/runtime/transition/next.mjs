import { Step } from '../../entities/Step/index.mjs';
import { responseForStepEntry } from '../output/response.mjs';
import { markUserPromptInjectedForStep, validateSelectedStartupUserPromptTarget } from '../user-prompt.mjs';

function withoutResolvedPointerTransitions(baton, completedStepId) {
  const transitions = baton.pointerTransitions;
  if (!transitions) return baton;
  const retained = {};
  let retainedCount = 0;
  let removed = false;
  for (const transitionId in transitions) {
    if (!Object.hasOwn(transitions, transitionId)) continue;
    const transition = transitions[transitionId];
    if (transition.targetStepId === completedStepId) {
      removed = true;
      continue;
    }
    retained[transitionId] = transition;
    retainedCount += 1;
  }
  if (!removed) return baton;
  const nextBaton = { ...baton };
  if (retainedCount === 0) delete nextBaton.pointerTransitions;
  else nextBaton.pointerTransitions = retained;
  return nextBaton;
}

export function applyNextTransition({ workflow, baton, cursorStep, workerOutput, stepId = baton.cursor }) {
  const cursor = new Step({ id: stepId, step: cursorStep });
  const batonWithPromptMarker = markUserPromptInjectedForStep({
    workflow,
    baton,
    stepId,
  });
  const applied = cursor.applyOutput({ workflow, baton: batonWithPromptMarker, output: workerOutput });
  const completedBaton = withoutResolvedPointerTransitions(applied.baton, stepId);
  const response = responseForStepEntry(completedBaton, workflow);
  const updatedBaton = validateSelectedStartupUserPromptTarget({
    workflow,
    baton: response.baton,
    steps: response.steps,
  });

  return { ...response, baton: updatedBaton };
}
