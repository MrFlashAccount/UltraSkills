import { WorkflowRuntimeError } from '../errors.mjs';
import { LOOP_PROGRESS_STATE_KEY } from './baton-state.mjs';
import { isDangerousObjectKey } from './state-keys.mjs';
import { NEXT_KIND, normalizeTransitionNext } from './transition-next.mjs';

function fail(message) {
  throw new WorkflowRuntimeError(`workflow semantic validation failed: ${message}`);
}

function transitionTargetsForDescriptor(descriptor) {
  if (descriptor.kind === NEXT_KIND.STATIC_TARGET) return { targetSets: [[descriptor.target]], fanout: false };
  if (descriptor.kind === NEXT_KIND.MATCH_CASES) {
    return {
      targetSets: Object.values(descriptor.cases).map((target) => [target]),
      fanout: false,
    };
  }

  return { targetSets: [], fanout: false };
}

function collectStaticEdges(workflow) {
  const edges = [];
  for (const [stepId, step] of Object.entries(workflow.steps)) {
    if (!Object.hasOwn(step, 'next')) continue;
    const { targetSets, fanout } = transitionTargetsForDescriptor(normalizeTransitionNext(step.next));
    for (const targets of targetSets) {
      const isFanout = fanout || targets.length > 1;
      for (const target of targets) edges.push({ from: stepId, to: target, fanout: isFanout });
    }
  }
  return edges;
}

function adjacencyFromEdges(workflow, edges) {
  const adjacency = new Map(Object.keys(workflow.steps).map((stepId) => [stepId, []]));
  for (const edge of edges) adjacency.get(edge.from)?.push(edge.to);
  return adjacency;
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function reachableSteps(adjacency, start) {
  const visited = new Set();
  const queue = [start];
  while (queue.length > 0) {
    const stepId = queue.shift();
    if (visited.has(stepId)) continue;
    visited.add(stepId);
    for (const target of adjacency.get(stepId) ?? []) queue.push(target);
  }
  return visited;
}

function resolveOnLimitTransition(policy, transition, resolver) {
  if (typeof resolver !== 'function') {
    throw new WorkflowRuntimeError('loop policy transition requires an onLimit resolver');
  }
  const resolved = resolver(policy.onLimit);
  return { ...transition, targetStepId: resolved.targetStepId };
}

function policyEdges(edges, region) {
  return {
    incoming: edges.filter((edge) => !region.has(edge.from) && region.has(edge.to)),
    internal: edges.filter((edge) => region.has(edge.from) && region.has(edge.to)),
    external: edges.filter((edge) => region.has(edge.from) && !region.has(edge.to)),
  };
}

function collectStaticOnLimitEdges(workflow) {
  const edges = [];
  for (const [policyId, policy] of Object.entries(workflow.loopPolicies ?? {})) {
    const { targetSets } = transitionTargetsForDescriptor(normalizeTransitionNext(policy.onLimit));
    for (const targets of targetSets) {
      for (const target of targets) edges.push({ policyId, from: policy.boundary, to: target, fanout: targets.length > 1 });
    }
  }
  return edges;
}

export function assertLoopPolicies(workflow, edges = collectStaticEdges(workflow), onLimitEdges = collectStaticOnLimitEdges(workflow)) {
  const policies = workflow.loopPolicies;
  if (policies === undefined) return;
  if (!policies || typeof policies !== 'object' || Array.isArray(policies)) fail('loopPolicies must be an object keyed by policy id');

  const claimedSteps = new Map();
  for (const [policyId, policy] of Object.entries(policies)) {
    if (isDangerousObjectKey(policyId)) fail(`loopPolicy id '${policyId}' is unsafe as a JavaScript object key`);
    const steps = sortedUnique(policy.steps);
    for (const stepId of steps) {
      if (!Object.hasOwn(workflow.steps, stepId)) fail(`loopPolicy '${policyId}' references unknown step '${stepId}'`);
      if (claimedSteps.has(stepId)) fail(`loopPolicy '${policyId}' overlaps with loopPolicy '${claimedSteps.get(stepId)}' at step '${stepId}'`);
      claimedSteps.set(stepId, policyId);
    }

    const region = new Set(steps);
    if (!region.has(policy.entry)) fail(`loopPolicy '${policyId}' entry '${policy.entry}' is not in the loop region`);
    if (!region.has(policy.boundary)) fail(`loopPolicy '${policyId}' boundary '${policy.boundary}' is not in the loop region`);

    const { incoming, internal, external } = policyEdges(edges, region);
    const internalAdjacency = adjacencyFromEdges(workflow, internal);
    const reverseInternalAdjacency = adjacencyFromEdges(
      workflow,
      internal.map((edge) => ({ ...edge, from: edge.to, to: edge.from })),
    );
    const reachableFromEntry = reachableSteps(internalAdjacency, policy.entry);
    const canReachEntry = reachableSteps(reverseInternalAdjacency, policy.entry);
    const disconnected = steps.find((stepId) => !reachableFromEntry.has(stepId) || !canReachEntry.has(stepId));
    if (disconnected) {
      fail(`loopPolicy '${policyId}' steps must describe one declared cycle`);
    }
    if (region.has(workflow.start) && workflow.start !== policy.entry) {
      fail(`loopPolicy '${policyId}' workflow start '${workflow.start}' must equal entry '${policy.entry}'`);
    }
    const wrongIncoming = incoming.find((edge) => edge.to !== policy.entry);
    if (wrongIncoming) {
      fail(`loopPolicy '${policyId}' external transition '${wrongIncoming.from}' -> '${wrongIncoming.to}' bypasses entry '${policy.entry}'`);
    }

    const wrongEntryPredecessor = internal.find((edge) => edge.to === policy.entry && edge.from !== policy.boundary);
    if (wrongEntryPredecessor) {
      fail(`loopPolicy '${policyId}' internal transition '${wrongEntryPredecessor.from}' -> '${policy.entry}' bypasses boundary '${policy.boundary}'`);
    }
    const repeatEdges = internal.filter((edge) => edge.from === policy.boundary && edge.to === policy.entry);
    if (repeatEdges.length === 0) {
      fail(`loopPolicy '${policyId}' boundary '${policy.boundary}' must declare the repeat target '${policy.entry}'`);
    }
    const ambiguousBoundaryRoute = internal.find((edge) => edge.from === policy.boundary && edge.to !== policy.entry);
    if (ambiguousBoundaryRoute) {
      fail(`loopPolicy '${policyId}' boundary '${policy.boundary}' has ambiguous internal target '${ambiguousBoundaryRoute.to}'`);
    }
    const policyLimitEdges = onLimitEdges.filter((edge) => edge.policyId === policyId);
    if (policyLimitEdges.length === 0) {
      fail(`loopPolicy '${policyId}' onLimit must resolve to at least one validation-proven target`);
    }
    for (const limitEdge of policyLimitEdges) {
      if (region.has(limitEdge.to)) {
        fail(`loopPolicy '${policyId}' onLimit target '${limitEdge.to}' stays inside the exhausted loop region`);
      }
      if (workflow.steps[policy.boundary]?.kind !== 'approval'
        && !external.some((edge) => edge.from === policy.boundary && edge.to === limitEdge.to)) {
        fail(`loopPolicy '${policyId}' onLimit target '${limitEdge.to}' must be a declared external target of boundary '${policy.boundary}'`);
      }
    }

    for (const edge of edges) {
      if (steps.includes(edge.from) && edge.fanout) fail(`loopPolicy '${policyId}' does not support fanout transition from step '${edge.from}'`);
    }
  }
}

export function applyLoopPolicyTransition({ workflow, baton, stepId, transition, resolveOnLimitTransition: resolveLimit }) {
  const policies = workflow.loopPolicies;
  const targetStepId = transition.targetStepId;
  if (!policies || !targetStepId) return { transition };

  const policyEntry = Object.entries(policies).find(([, policy]) => (
    policy.boundary === stepId || (policy.steps.includes(stepId) && policy.boundary === targetStepId)
  ));
  if (!policyEntry) return { transition };

  const [policyId, policy] = policyEntry;
  const currentProgress = baton.state?.[LOOP_PROGRESS_STATE_KEY] ?? {};
  const currentCount = currentProgress[policyId] ?? 0;

  if (policy.entry === policy.boundary && stepId === policy.boundary) {
    const completedCount = Math.min(currentCount + 1, policy.maxIterations);
    const loopProgress = { ...currentProgress, [policyId]: completedCount };
    if (targetStepId === policy.entry && completedCount >= policy.maxIterations) {
      return { transition: resolveOnLimitTransition(policy, transition, resolveLimit), loopProgress };
    }
    return { transition, loopProgress };
  }

  if (stepId === policy.boundary && targetStepId === policy.entry && currentCount >= policy.maxIterations) {
    const loopProgress = { ...currentProgress, [policyId]: currentCount };
    return { transition: resolveOnLimitTransition(policy, transition, resolveLimit), loopProgress };
  }

  if (policy.steps.includes(stepId) && targetStepId === policy.boundary) {
    const loopProgress = { ...currentProgress, [policyId]: Math.min(currentCount + 1, policy.maxIterations) };
    return { transition, loopProgress };
  }

  return { transition };
}
