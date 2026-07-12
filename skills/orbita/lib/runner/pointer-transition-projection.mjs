/**
 * Runner-owned projection for state-resolved pointer recovery transitions.
 *
 * The projection intentionally exposes only bounded cursor/status metadata. It
 * never returns raw history, baton state values, worker bindings, tokens, or
 * file paths.
 */
import { createHash } from 'node:crypto';
import { WorkflowRuntimeError } from '../errors.mjs';
import { Baton } from '../entities/Baton/index.mjs';
import { Step } from '../entities/Step/index.mjs';
import { normalizeCursor } from '../runtime/cursor.mjs';
import { statusForStep } from '../runtime/step-status.mjs';

const TERMINAL_STATUSES = new Set(['done']);

function cursorDisplay(cursor) {
  return cursor;
}

function pointerPosition(cursor, status) {
  return {
    cursor: structuredClone(cursor),
    status,
    display: cursorDisplay(cursor),
  };
}

function transitionId({ from, to, direction }) {
  const digest = createHash('sha256')
    .update(JSON.stringify({ version: 1, direction, from, to }))
    .digest('hex')
    .slice(0, 24);
  return `ptr_${digest}`;
}

function resolvedStateTransitions({ workflow, baton }) {
  const transitions = [];
  for (const stepId of Object.keys(baton?.state ?? {})) {
    const step = workflow.steps?.[stepId];
    if (!step || !Object.hasOwn(step, 'next')) continue;
    const resolved = new Step({ id: stepId, step }).resolveConcreteTargets(baton, workflow, baton.state[stepId]);
    transitions.push({ from: stepId, to: resolved.targetStepId });
  }
  return transitions;
}

function backwardStateTransitions({ workflow, current, baton }) {
  const incomingByCursor = new Map();
  for (const resolved of resolvedStateTransitions({ workflow, baton })) {
    const key = resolved.to;
    const incoming = incomingByCursor.get(key) ?? [];
    incoming.push(resolved.from);
    incomingByCursor.set(key, incoming);
  }

  const visited = new Set([current.cursor]);
  const queue = [current.cursor];
  const transitions = [];
  while (queue.length > 0) {
    const cursor = queue.shift();
    for (const predecessor of incomingByCursor.get(cursor) ?? []) {
      if (visited.has(predecessor)) continue;
      visited.add(predecessor);
      const predecessorStep = workflow.steps[predecessor];
      const transition = {
        direction: 'backward',
        from: current,
        to: pointerPosition(predecessor, statusForStep(workflow, predecessor, predecessorStep)),
      };
      transitions.push({
        ...transition,
        id: transitionId(transition),
      });
      queue.push(predecessor);
    }
  }
  return transitions;
}

function transitionIsRunningSingleStep(workflow, transition) {
  const toStepId = normalizeCursor(transition.to.cursor);
  const step = workflow.steps?.[toStepId];
  if (!step) return false;
  return statusForStep(workflow, toStepId, step) === transition.to.status && !TERMINAL_STATUSES.has(transition.to.status);
}

function uniqueTransitions(transitions) {
  const byId = new Map();
  for (const transition of transitions) {
    if (!byId.has(transition.id)) byId.set(transition.id, transition);
  }
  return [...byId.values()];
}

export function projectPointerTransitions({ workflow, baton } = {}) {
  new Baton(baton).validateAgainst(workflow);
  const current = pointerPosition(baton.cursor, baton.status);
  const projected = backwardStateTransitions({ workflow, current, baton });

  const transitions = uniqueTransitions(projected
    .filter((transition) => transitionIsRunningSingleStep(workflow, transition))
  );

  return { current, transitions };
}

export function resolvePointerMove({ workflow, baton, transitionId: requestedTransitionId } = {}) {
  if (typeof requestedTransitionId !== 'string' || requestedTransitionId.length === 0) {
    throw new Error('pointer transition id is required');
  }
  const projection = projectPointerTransitions({ workflow, baton });
  if (projection.unsupported) {
    throw new Error(`pointer move unsupported: ${projection.unsupported.reason}`);
  }
  const transition = projection.transitions.find((candidate) => candidate.id === requestedTransitionId);
  if (!transition) {
    throw new Error('pointer transition is stale, unavailable, or not a state-bearing predecessor of the current cursor');
  }
  const nextBaton = structuredClone(baton);
  nextBaton.cursor = structuredClone(transition.to.cursor);
  nextBaton.status = transition.to.status;
  new Baton(nextBaton).validateAgainst(workflow);
  return { projection, transition, baton: nextBaton };
}

export function pointerMoveHistoryDetails({ transition } = {}) {
  if (!transition) throw new WorkflowRuntimeError('pointer move history requires a transition');
  return [
    `- pointer move: id=${transition.id} direction=${transition.direction}`,
    `- target position id: ${transition.id}`,
    `- pointer move edge: cursor=${transition.from.display} status=${transition.from.status} -> cursor=${transition.to.display} status=${transition.to.status}`,
    '- state preserved: true',
  ];
}
