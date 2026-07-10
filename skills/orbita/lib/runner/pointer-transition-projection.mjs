/**
 * Runner-owned projection for adjacent pointer recovery transitions.
 *
 * The projection intentionally exposes only bounded cursor/status metadata and
 * retained-output summaries. It never returns raw history, baton state values,
 * worker bindings, tokens, or file paths.
 */
import { createHash } from 'node:crypto';
import { WorkflowRuntimeError } from '../errors.mjs';
import { Baton } from '../entities/Baton/index.mjs';
import { normalizeCursor } from '../runtime/cursor.mjs';
import { statusForStep } from '../runtime/step-status.mjs';

const TRANSITION_LINE = /^- transition: cursor=(.+?) status=([a-z_]+) -> cursor=(.+?) status=([a-z_]+)$/;
const TERMINAL_STATUSES = new Set(['done', 'blocked']);

function cursorValue(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  if (raw.startsWith('[')) return undefined;
  return raw;
}

function cursorKey(cursor) {
  return cursor;
}

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

function parseObservedTransitions(historyText) {
  const transitions = [];
  if (typeof historyText !== 'string' || historyText.length === 0) return transitions;
  for (const line of historyText.split('\n')) {
    const match = line.match(TRANSITION_LINE);
    if (!match) continue;
    const [, fromCursorRaw, fromStatus, toCursorRaw, toStatus] = match;
    const fromCursor = cursorValue(fromCursorRaw);
    const toCursor = cursorValue(toCursorRaw);
    if (fromCursor === undefined || toCursor === undefined) continue;
    transitions.push({
      from: pointerPosition(fromCursor, fromStatus),
      to: pointerPosition(toCursor, toStatus),
    });
  }
  return transitions;
}

function retainedStateSummary(baton, cursor) {
  const stepId = normalizeCursor(cursor);
  const stepIds = Object.hasOwn(baton?.state ?? {}, stepId) ? [stepId] : [];
  return {
    hasAcceptedOutput: stepIds.length > 0,
    stepIds,
    acknowledgementRequired: stepIds.length > 0,
  };
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

export function projectPointerTransitions({ workflow, baton, historyText } = {}) {
  new Baton(baton).validateAgainst(workflow);
  const current = pointerPosition(baton.cursor, baton.status);
  const currentKey = cursorKey(baton.cursor);
  const adjacent = [];
  for (const observed of parseObservedTransitions(historyText)) {
    if (cursorKey(observed.to.cursor) === currentKey) {
      adjacent.push({ direction: 'backward', from: current, to: observed.from });
    }
    if (cursorKey(observed.from.cursor) === currentKey) {
      adjacent.push({ direction: 'forward', from: current, to: observed.to });
    }
  }

  const transitions = uniqueTransitions(adjacent
    .filter((transition) => transitionIsRunningSingleStep(workflow, transition))
    .map((transition) => {
      const retainedState = retainedStateSummary(baton, transition.to.cursor);
      return {
        id: transitionId(transition),
        direction: transition.direction,
        from: transition.from,
        to: transition.to,
        retainedState,
      };
    }));

  return { current, transitions };
}

export function resolvePointerMove({ workflow, baton, historyText, transitionId: requestedTransitionId, acknowledgeRetainedState = false } = {}) {
  if (typeof requestedTransitionId !== 'string' || requestedTransitionId.length === 0) {
    throw new Error('pointer transition id is required');
  }
  if (acknowledgeRetainedState !== true && acknowledgeRetainedState !== false) {
    throw new Error('acknowledgeRetainedState must be a boolean');
  }
  const projection = projectPointerTransitions({ workflow, baton, historyText });
  if (projection.unsupported) {
    throw new Error(`pointer move unsupported: ${projection.unsupported.reason}`);
  }
  const transition = projection.transitions.find((candidate) => candidate.id === requestedTransitionId);
  if (!transition) {
    throw new Error('pointer transition is stale, non-adjacent, or not observed for the current cursor');
  }
  if (transition.retainedState.acknowledgementRequired && !acknowledgeRetainedState) {
    throw new Error(`pointer transition requires retained state acknowledgement for step ${transition.retainedState.stepIds.join(', ')}`);
  }
  const nextBaton = structuredClone(baton);
  nextBaton.cursor = structuredClone(transition.to.cursor);
  nextBaton.status = transition.to.status;
  new Baton(nextBaton).validateAgainst(workflow);
  return { projection, transition, baton: nextBaton };
}

export function pointerMoveHistoryDetails({ transition } = {}) {
  if (!transition) throw new WorkflowRuntimeError('pointer move history requires a transition');
  const retained = transition.retainedState.hasAcceptedOutput
    ? `retained-output=${transition.retainedState.stepIds.join(',')}`
    : 'retained-output=none';
  return [
    `- pointer move: id=${transition.id} direction=${transition.direction}`,
    `- target position id: ${transition.id}`,
    `- pointer move edge: cursor=${transition.from.display} status=${transition.from.status} -> cursor=${transition.to.display} status=${transition.to.status}`,
    '- state preserved: true',
    `- retained state: ${retained}`,
    `- retained output acknowledgement: ${transition.retainedState.acknowledgementRequired ? 'required' : 'not_required'}`,
  ];
}
