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

function stronglyConnectedComponents(workflow, edges) {
  const adjacency = adjacencyFromEdges(workflow, edges);
  const indexByNode = new Map();
  const lowLinkByNode = new Map();
  const stack = [];
  const onStack = new Set();
  const components = [];
  let index = 0;

  function visit(node) {
    indexByNode.set(node, index);
    lowLinkByNode.set(node, index);
    index += 1;
    stack.push(node);
    onStack.add(node);

    for (const target of adjacency.get(node) ?? []) {
      if (!indexByNode.has(target)) {
        visit(target);
        lowLinkByNode.set(node, Math.min(lowLinkByNode.get(node), lowLinkByNode.get(target)));
      } else if (onStack.has(target)) {
        lowLinkByNode.set(node, Math.min(lowLinkByNode.get(node), indexByNode.get(target)));
      }
    }

    if (lowLinkByNode.get(node) !== indexByNode.get(node)) return;
    const component = [];
    let current;
    do {
      current = stack.pop();
      onStack.delete(current);
      component.push(current);
    } while (current !== node);
    components.push(component.sort());
  }

  for (const stepId of Object.keys(workflow.steps)) if (!indexByNode.has(stepId)) visit(stepId);
  return components;
}

function cyclicRegions(workflow, edges) {
  const selfLoops = new Set(edges.filter((edge) => edge.from === edge.to).map((edge) => edge.from));
  return stronglyConnectedComponents(workflow, edges)
    .filter((component) => component.length > 1 || selfLoops.has(component[0]))
    .map((component) => component.sort());
}

function sameMembers(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function reachesAny(adjacency, start, targets) {
  const visited = new Set();
  const queue = [start];
  while (queue.length > 0) {
    const stepId = queue.shift();
    if (visited.has(stepId)) continue;
    visited.add(stepId);
    if (targets.has(stepId)) return true;
    for (const target of adjacency.get(stepId) ?? []) queue.push(target);
  }
  return false;
}

function retargetSingleTransition(transition, targetStepId) {
  return { ...transition, targetStepId };
}

function policyEdges(edges, region) {
  return {
    incoming: edges.filter((edge) => !region.has(edge.from) && region.has(edge.to)),
    internal: edges.filter((edge) => region.has(edge.from) && region.has(edge.to)),
    external: edges.filter((edge) => region.has(edge.from) && !region.has(edge.to)),
  };
}

export function assertLoopPolicies(workflow, edges = collectStaticEdges(workflow)) {
  const policies = workflow.loopPolicies;
  if (policies === undefined) return;
  if (!policies || typeof policies !== 'object' || Array.isArray(policies)) fail('loopPolicies must be an object keyed by policy id');

  const regions = cyclicRegions(workflow, edges);
  const adjacency = adjacencyFromEdges(workflow, edges);
  const claimedSteps = new Map();
  for (const [policyId, policy] of Object.entries(policies)) {
    if (isDangerousObjectKey(policyId)) fail(`loopPolicy id '${policyId}' is unsafe as a JavaScript object key`);
    const steps = sortedUnique(policy.steps);
    for (const stepId of steps) {
      if (!Object.hasOwn(workflow.steps, stepId)) fail(`loopPolicy '${policyId}' references unknown step '${stepId}'`);
      if (claimedSteps.has(stepId)) fail(`loopPolicy '${policyId}' overlaps with loopPolicy '${claimedSteps.get(stepId)}' at step '${stepId}'`);
      claimedSteps.set(stepId, policyId);
    }

    if (!Object.hasOwn(workflow.steps, policy.onLimit)) fail(`loopPolicy '${policyId}' onLimit target not found: ${policy.onLimit}`);
    if (steps.includes(policy.onLimit)) fail(`loopPolicy '${policyId}' onLimit target '${policy.onLimit}' stays inside the exhausted loop region`);

    const matches = regions.filter((region) => sameMembers(region, steps));
    if (matches.length !== 1) {
      fail(`loopPolicy '${policyId}' steps must exactly match one unambiguous SCC or self-loop region`);
    }
    const region = new Set(matches[0]);
    if (!region.has(policy.entry)) fail(`loopPolicy '${policyId}' entry '${policy.entry}' is not in the loop region`);
    if (!region.has(policy.boundary)) fail(`loopPolicy '${policyId}' boundary '${policy.boundary}' is not in the loop region`);

    const { incoming, internal, external } = policyEdges(edges, region);
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
    if (!external.some((edge) => edge.from === policy.boundary && edge.to === policy.onLimit)) {
      fail(`loopPolicy '${policyId}' onLimit target '${policy.onLimit}' must be a declared external target of boundary '${policy.boundary}'`);
    }
    if (reachesAny(adjacency, policy.onLimit, region)) {
      fail(`loopPolicy '${policyId}' onLimit target '${policy.onLimit}' routes back into the exhausted loop region`);
    }

    for (const edge of edges) {
      if (steps.includes(edge.from) && edge.fanout) fail(`loopPolicy '${policyId}' does not support fanout transition from step '${edge.from}'`);
    }
  }
}

export function applyLoopPolicyTransition({ workflow, baton, stepId, transition }) {
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
      return { transition: retargetSingleTransition(transition, policy.onLimit), loopProgress };
    }
    return { transition, loopProgress };
  }

  if (stepId === policy.boundary && targetStepId === policy.entry && currentCount >= policy.maxIterations) {
    const loopProgress = { ...currentProgress, [policyId]: currentCount };
    return { transition: retargetSingleTransition(transition, policy.onLimit), loopProgress };
  }

  if (policy.steps.includes(stepId) && targetStepId === policy.boundary) {
    const loopProgress = { ...currentProgress, [policyId]: Math.min(currentCount + 1, policy.maxIterations) };
    return { transition, loopProgress };
  }

  return { transition };
}
