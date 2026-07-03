import { WorkflowRuntimeError, invariant } from '../../errors.mjs';
import { appendPromptText } from '../../runtime/prompt-text.mjs';

export const SHARDING_STATE_KEY = 'shards';
export const SHARD_REQUEST_SEPARATOR = '__shard__';
export const SHARD_ID = /^[A-Za-z0-9_.-]+$/;

function fail(message) {
  throw new WorkflowRuntimeError(`workflow sharding validation failed: ${message}`);
}

function clone(value) {
  return structuredClone(value);
}

function safeShardId(value, fieldPath) {
  if (typeof value !== 'string' || !SHARD_ID.test(value) || value === '.' || value === '..') {
    fail(`${fieldPath} must be a safe shard id matching ${SHARD_ID}`);
  }
  if (value.includes(SHARD_REQUEST_SEPARATOR)) {
    fail(`${fieldPath} must not contain reserved separator '${SHARD_REQUEST_SEPARATOR}'`);
  }
  return value;
}

export function shardRequestId(ownerStepId, shardId) {
  return `${ownerStepId}${SHARD_REQUEST_SEPARATOR}${shardId}`;
}

export function shardPlanId(ownerStepId) {
  return `${ownerStepId}:review_shards`;
}

export function shardObligationId(ownerStepId, shardId) {
  return `${ownerStepId}:${shardId}`;
}

export function isShardedStep(step) {
  return step?.kind === 'worker' && step.sharding?.enabled === true;
}

export function shardingPolicyForStep(step) {
  if (!isShardedStep(step)) return undefined;
  return step.sharding;
}

export function normalizeShardingPolicy(policy, { stepId = '<unknown>' } = {}) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) fail(`step '${stepId}' sharding must be an object`);
  if (policy.enabled !== true) fail(`step '${stepId}' sharding.enabled must be true`);
  if (policy.mode !== 'review_shards') fail(`step '${stepId}' sharding.mode must be 'review_shards'`);
  if (!Array.isArray(policy.obligations) || policy.obligations.length === 0) {
    fail(`step '${stepId}' sharding.obligations must be a non-empty array`);
  }

  const seen = new Set();
  let requiredCount = 0;
  const obligations = policy.obligations.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(`step '${stepId}' sharding.obligations/${index} must be an object`);
    const shardId = safeShardId(raw.shard_id, `step '${stepId}' sharding.obligations/${index}/shard_id`);
    if (seen.has(shardId)) fail(`step '${stepId}' declares duplicate shard id '${shardId}'`);
    seen.add(shardId);
    if (typeof raw.reviewer_role !== 'string' || raw.reviewer_role.length === 0) {
      fail(`step '${stepId}' sharding.obligations/${index}/reviewer_role must be a non-empty string`);
    }
    const required = raw.required !== false;
    if (required) requiredCount += 1;
    const privacyRoute = raw.privacy_route ?? policy.privacy_route ?? 'safe_context';
    if (privacyRoute !== 'safe_context') {
      fail(`step '${stepId}' shard '${shardId}' privacy_route '${privacyRoute}' is not supported; expected safe_context`);
    }
    const maxAttempts = raw.max_attempts ?? policy.max_attempts ?? 1;
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
      fail(`step '${stepId}' shard '${shardId}' max_attempts must be an integer >= 1`);
    }
    const sourceEvidence = raw.source_evidence === undefined ? [] : raw.source_evidence;
    if (!Array.isArray(sourceEvidence) || sourceEvidence.some((item) => typeof item !== 'string' || item.length === 0)) {
      fail(`step '${stepId}' shard '${shardId}' source_evidence must be an array of non-empty strings`);
    }
    return {
      shard_id: shardId,
      reviewer_role: raw.reviewer_role,
      required,
      privacy_route: privacyRoute,
      max_attempts: maxAttempts,
      source_evidence: [...sourceEvidence],
    };
  });

  if (requiredCount === 0) fail(`step '${stepId}' sharding.obligations must include at least one required obligation`);
  return { enabled: true, mode: 'review_shards', obligations };
}

export function assertWorkflowShardingPolicies(workflow, { allowedRoles } = {}) {
  const roleCatalogLoaded = allowedRoles === undefined || allowedRoles.loaded !== false;
  const allowedRoleNames = Array.isArray(allowedRoles) ? allowedRoles : allowedRoles?.names;
  const roleSet = new Set(Array.isArray(allowedRoleNames) ? allowedRoleNames : []);
  for (const [stepId, step] of Object.entries(workflow.steps ?? {})) {
    if (step?.sharding !== undefined && step.kind !== 'worker') {
      fail(`step '${stepId}' sharding is only supported on worker steps`);
    }
    if (!isShardedStep(step)) continue;
    const policy = normalizeShardingPolicy(step.sharding, { stepId });
    for (const obligation of policy.obligations) {
      if (roleCatalogLoaded && !roleSet.has(obligation.reviewer_role)) {
        const expected = [...roleSet].join(', ');
        fail(`step '${stepId}' shard '${obligation.shard_id}' reviewer_role '${obligation.reviewer_role}' is not an allowed role${expected ? `; expected one of: ${expected}` : ''}`);
      }
    }
  }
}

function uniqueSourceEvidence(obligations) {
  return [...new Set(obligations.flatMap((obligation) => obligation.source_evidence))].sort();
}

function previousObligation(previousPlan, obligationId, shardId) {
  return previousPlan?.obligations?.find((obligation) =>
    obligation?.obligation_id === obligationId || obligation?.shard_id === shardId
  );
}

export function createShardPlan({ ownerStepId, policy, previousPlan }) {
  const normalized = normalizeShardingPolicy(policy, { stepId: ownerStepId });
  const planId = previousPlan?.plan_id ?? shardPlanId(ownerStepId);
  return {
    plan_id: planId,
    owner_step_id: ownerStepId,
    source_evidence: uniqueSourceEvidence(normalized.obligations),
    status: 'dispatching',
    obligations: normalized.obligations.map((obligation) => {
      const obligationId = shardObligationId(ownerStepId, obligation.shard_id);
      const previous = previousObligation(previousPlan, obligationId, obligation.shard_id);
      return {
        obligation_id: obligationId,
        ...clone(obligation),
        request_id: shardRequestId(ownerStepId, obligation.shard_id),
        status: previous?.status ?? 'pending',
        attempts: previous?.attempts ?? 0,
        ...(previous?.reason ? { reason: previous.reason } : {}),
      };
    }),
    accepted_outputs: clone(previousPlan?.accepted_outputs ?? {}),
    blocked: clone(previousPlan?.blocked ?? {}),
    join_proof: clone(previousPlan?.join_proof ?? null),
  };
}

export function acceptedShardObligation(obligation) {
  return {
    ...clone(obligation),
    status: 'accepted',
    attempts: obligation.attempts + 1,
  };
}

export function blockedShardObligation(obligation, reason) {
  return {
    ...clone(obligation),
    status: 'blocked',
    attempts: Math.min(obligation.attempts + 1, obligation.max_attempts),
    reason,
  };
}

export function pendingRetryShardObligation(obligation, reason) {
  return {
    ...clone(obligation),
    status: 'pending',
    attempts: obligation.attempts + 1,
    reason,
  };
}

export function acceptedShardOutputRecord(obligation, output) {
  return {
    obligation_id: obligation.obligation_id,
    shard_id: obligation.shard_id,
    reviewer_role: obligation.reviewer_role,
    request_id: obligation.request_id,
    status: 'accepted',
    output: clone(output),
  };
}

export function blockedShardOutputRecord(obligation, reason, output) {
  return {
    obligation_id: obligation.obligation_id,
    shard_id: obligation.shard_id,
    reviewer_role: obligation.reviewer_role,
    request_id: obligation.request_id,
    reason,
    output: clone(output ?? {}),
  };
}

function shardPromptSuffix({ ownerStepId, obligation }) {
  const evidence = obligation.source_evidence.length > 0
    ? `\nSource evidence:\n${obligation.source_evidence.map((item) => `- ${item}`).join('\n')}`
    : '';
  return [
    `Shard owner step: ${ownerStepId}`,
    `Shard obligation id: ${obligation.obligation_id}`,
    `Shard id: ${obligation.shard_id}`,
    `Reviewer role: ${obligation.reviewer_role}`,
    `Required: ${obligation.required ? 'true' : 'false'}`,
    'Return output for only this shard obligation.',
    'The JSON output must include matching shard_id and reviewer_role fields.',
    evidence,
  ].filter(Boolean).join('\n');
}

function stepForShard(ownerStepId, ownerStep, obligation) {
  const step = clone(ownerStep);
  delete step.sharding;
  step.agent = shardRequestId(ownerStepId, obligation.shard_id);
  step.input = {
    ...(step.input ?? {}),
    role: obligation.reviewer_role,
    prompt: appendPromptText(step.input?.prompt, shardPromptSuffix({ ownerStepId, obligation })),
  };
  return step;
}

export { stepForShard };

export function shardPlanForBaton({ baton, ownerStepId, ownerStep }) {
  const previousPlan = baton?.state?.[SHARDING_STATE_KEY]?.[ownerStepId];
  return createShardPlan({ ownerStepId, policy: ownerStep.sharding, previousPlan });
}

export function batonWithShardPlan(baton, ownerStepId, plan) {
  return {
    ...clone(baton),
    state: {
      ...(baton?.state ?? {}),
      [SHARDING_STATE_KEY]: {
        ...(baton?.state?.[SHARDING_STATE_KEY] ?? {}),
        [ownerStepId]: clone(plan),
      },
    },
  };
}

export function shardedStepEntries(ownerStepId, ownerStep, baton) {
  const plan = shardPlanForBaton({ baton, ownerStepId, ownerStep });
  return plan.obligations.filter((obligation) => obligation.status !== 'accepted').map((obligation) => ({
    id: shardRequestId(ownerStepId, obligation.shard_id),
    ownerStepId,
    action: 'run_worker',
    step: stepForShard(ownerStepId, ownerStep, obligation),
    shard: {
      obligation_id: obligation.obligation_id,
      shard_id: obligation.shard_id,
      reviewer_role: obligation.reviewer_role,
      required: obligation.required,
      privacy_route: obligation.privacy_route,
      max_attempts: obligation.max_attempts,
      source_evidence: clone(obligation.source_evidence),
    },
  }));
}

export function assertNoUnexpectedShardOutputs(allOutput, obligations) {
  const steps = allOutput?.steps;
  invariant(steps && typeof steps === 'object' && !Array.isArray(steps), 'sharded output must include object steps');
  const expected = new Set(obligations.map((obligation) => obligation.request_id));
  for (const key of Object.keys(steps)) {
    invariant(expected.has(key), `sharded output included unexpected shard request '${key}'`);
  }
}

export function outputForShard(allOutput, requestId) {
  const steps = allOutput?.steps;
  invariant(steps && typeof steps === 'object' && !Array.isArray(steps), 'sharded output must include object steps');
  return steps[requestId];
}

export function assertShardOutputMatchesObligation(ownerStepId, obligation, output) {
  invariant(output && typeof output === 'object' && !Array.isArray(output), `sharded output for '${obligation.shard_id}' must be an object`);
  invariant(output.shard_id === obligation.shard_id, `sharded step '${ownerStepId}' output shard_id '${output.shard_id}' does not match required shard '${obligation.shard_id}'`);
  invariant(output.reviewer_role === obligation.reviewer_role, `sharded step '${ownerStepId}' output reviewer_role '${output.reviewer_role}' does not match required role '${obligation.reviewer_role}'`);
}

export function joinProofFor({ ownerStepId, obligations, acceptedOutputs, blocked = {} }) {
  const acceptedObligationIds = Object.keys(acceptedOutputs).sort();
  const blockedObligationIds = Object.keys(blocked).sort();
  const acceptedShards = obligations
    .filter((obligation) => acceptedObligationIds.includes(obligation.obligation_id))
    .map((obligation) => obligation.shard_id)
    .sort();
  const blockedShards = obligations
    .filter((obligation) => blockedObligationIds.includes(obligation.obligation_id))
    .map((obligation) => obligation.shard_id)
    .sort();
  const requiredShards = obligations.filter((obligation) => obligation.required).map((obligation) => obligation.shard_id).sort();
  const optionalShards = obligations.filter((obligation) => !obligation.required).map((obligation) => obligation.shard_id).sort();
  const requiredObligationIds = obligations.filter((obligation) => obligation.required).map((obligation) => obligation.obligation_id).sort();
  const optionalObligationIds = obligations.filter((obligation) => !obligation.required).map((obligation) => obligation.obligation_id).sort();
  const missingRequiredObligationIds = obligations
    .filter((obligation) =>
      obligation.required &&
      !acceptedObligationIds.includes(obligation.obligation_id)
    )
    .map((obligation) => obligation.obligation_id)
    .sort();
  const coverageComplete = requiredObligationIds.every((obligationId) => acceptedObligationIds.includes(obligationId)) &&
    !requiredObligationIds.some((obligationId) => blockedObligationIds.includes(obligationId));
  return {
    owner_step_id: ownerStepId,
    plan_id: shardPlanId(ownerStepId),
    required_shards: requiredShards,
    optional_shards: optionalShards,
    accepted_shards: acceptedShards,
    blocked_shards: blockedShards,
    required_obligation_ids: requiredObligationIds,
    optional_obligation_ids: optionalObligationIds,
    accepted_obligation_ids: acceptedObligationIds,
    blocked_obligation_ids: blockedObligationIds,
    missing_required_obligation_ids: missingRequiredObligationIds,
    coverage_complete: coverageComplete,
    outcome: coverageComplete ? 'pass' : 'block',
    reason: coverageComplete ? 'required shard obligations accepted' : 'required shard coverage incomplete',
  };
}
