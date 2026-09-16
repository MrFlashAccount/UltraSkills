/** Projects unresolved pointer-transition feedback into its target step only. */
import { appendPromptText } from '../runtime/prompt-text.mjs';

function pointerTransitionFeedbackLines(baton, targetStepId) {
  const transitions = baton?.pointerTransitions;
  if (!transitions || typeof transitions !== 'object' || Array.isArray(transitions)) return [];
  const lines = [];
  for (const transitionId in transitions) {
    if (!Object.hasOwn(transitions, transitionId)) continue;
    const transition = transitions[transitionId];
    if (transition?.targetStepId !== targetStepId) continue;
    lines.push(`### ${transitionId}`, transition.feedback);
  }
  return lines;
}

export function appendPointerTransitionFeedback(instructions, baton, targetStepId) {
  const feedbackLines = pointerTransitionFeedbackLines(baton, targetStepId);
  if (feedbackLines.length === 0) return instructions;
  return appendPromptText(instructions, [
    '## Pointer rollback feedback',
    'This step was explicitly re-entered. Address every unresolved rollback request below before submitting replacement output.',
    ...feedbackLines,
  ].join('\n\n'));
}
