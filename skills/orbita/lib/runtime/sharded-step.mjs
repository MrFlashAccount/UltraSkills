import { invariant } from '../errors.mjs';
import { applyOutputToBatonState } from './baton-state.mjs';
import { statusForStep } from './step-status.mjs';
import { Step } from '../entities/Step/index.mjs';
import { responseFor, responseForCursor } from '../use-cases/runtime/output/response.mjs';
import { assertOutputSchemaIfDeclared } from '../use-cases/runtime/output/worker-output.mjs';
import {
  SHARDING_STATE_KEY,
  acceptedShardOutputRecord,
  acceptedShardObligation,
  assertNoUnexpectedShardOutputs,
  assertShardOutputMatchesObligation,
  blockedShardOutputRecord,
  blockedShardObligation,
  joinProofFor,
  outputForShard,
  pendingRetryShardObligation,
  shardPlanForBaton,
  stepForShard,
} from '../entities/Baton/sharding.mjs';

function clone(value) {
  return structuredClone(value);
}

function replaceObligation(obligations, nextObligation) {
  const index = obligations.findIndex((item) => item.obligation_id === nextObligation.obligation_id);
  if (index === -1) return obligations;
  obligations.splice(index, 1, nextObligation);
  return obligations;
}

function blockReason(kind, ownerStepId, obligation, details) {
  if (kind === 'missing') return `sharded step '${ownerStepId}' missing required shard obligation '${obligation.obligation_id}'`;
  if (kind === 'blocked') return `sharded step '${ownerStepId}' required shard obligation '${obligation.obligation_id}' blocked after ${Math.min(obligation.attempts + 1, obligation.max_attempts)}/${obligation.max_attempts} attempts`;
  if (kind === 'retry_exhausted') return `sharded step '${ownerStepId}' shard obligation '${obligation.obligation_id}' retry budget exhausted after ${obligation.max_attempts}/${obligation.max_attempts} attempts: ${details}`;
  return `sharded step '${ownerStepId}' shard obligation '${obligation.obligation_id}' failed validation: ${details}`;
}

function ownerBlockedOutput({ ownerStepId, joinProof, blocked }) {
  const blockedIds = Object.keys(blocked).sort();
  return {
    outcome: 'blocked',
    shard_join_proof: joinProof,
    blocker: {
      summary: `Sharded step '${ownerStepId}' has incomplete required coverage.`,
      source_step_id: ownerStepId,
      needed: `Resolve blocked shard obligations: ${blockedIds.join(', ') || 'none'}.`,
      evidence: [
        `missing_required_obligation_ids=${joinProof.missing_required_obligation_ids.join(',') || 'none'}`,
        `blocked_obligation_ids=${joinProof.blocked_obligation_ids.join(',') || 'none'}`,
      ],
      risk: 'Continuing would allow a sharded review owner step to pass without complete required coverage.',
    },
  };
}

function responseForBlockedJoin({ workflow, baton, ownerStepId, ownerStep, plan, obligations, acceptedOutputs, blocked }) {
  const joinProof = joinProofFor({ ownerStepId, obligations, acceptedOutputs, blocked });
  const ownerOutput = ownerBlockedOutput({ ownerStepId, joinProof, blocked });
  const blockedPlan = {
    ...plan,
    obligations,
    status: 'blocked',
    accepted_outputs: acceptedOutputs,
    blocked,
    join_proof: joinProof,
  };
  const blockedBaton = {
    ...baton,
    state: {
      ...(baton.state ?? {}),
      [ownerStepId]: ownerOutput,
      [SHARDING_STATE_KEY]: {
        ...(baton.state?.[SHARDING_STATE_KEY] ?? {}),
        [ownerStepId]: blockedPlan,
      },
    },
    cursor: ownerStepId,
    status: 'running',
    recoverableWorkerBlockers: {
      ...(baton.recoverableWorkerBlockers ?? {}),
      [ownerStepId]: ownerOutput.blocker,
    },
  };
  return responseFor(blockedBaton, ownerStepId, ownerStep, workflow);
}

function responseForPendingRetries({ workflow, baton, ownerStepId, ownerStep, plan, obligations, acceptedOutputs, blocked }) {
  const retryPlan = {
    ...plan,
    obligations,
    status: 'dispatching',
    accepted_outputs: acceptedOutputs,
    blocked,
    join_proof: null,
  };
  const retryBaton = {
    ...baton,
    state: {
      ...(baton.state ?? {}),
      [SHARDING_STATE_KEY]: {
        ...(baton.state?.[SHARDING_STATE_KEY] ?? {}),
        [ownerStepId]: retryPlan,
      },
    },
    cursor: ownerStepId,
    status: 'running',
  };
  return responseForCursor(retryBaton, workflow);
}

function shouldRetry(obligation) {
  return obligation.attempts + 1 < obligation.max_attempts;
}

export function applyShardedStepOutputs({ workflow, baton, ownerStepId, ownerStep, allOutput, resources }) {
  const plan = shardPlanForBaton({ baton, ownerStepId, ownerStep });
  assertNoUnexpectedShardOutputs(allOutput, plan.obligations);

  let updatedBaton = clone(baton);
  const acceptedOutputs = clone(plan.accepted_outputs ?? {});
  const blocked = clone(plan.blocked ?? {});
  const obligations = plan.obligations.map((obligation) => clone(obligation));
  for (const obligation of plan.obligations) {
    const rawOutput = outputForShard(allOutput, obligation.request_id);
    if (rawOutput === undefined) {
      if (obligation.status === 'accepted') continue;
      if (obligation.required) {
        const reason = blockReason('missing', ownerStepId, obligation);
        blocked[obligation.obligation_id] = blockedShardOutputRecord(obligation, reason);
        replaceObligation(obligations, blockedShardObligation(obligation, reason));
      }
      continue;
    }
    const shardStep = stepForShard(ownerStepId, ownerStep, obligation);
    let workerOutput;
    try {
      const validation = assertOutputSchemaIfDeclared({
        baton: updatedBaton,
        stepId: obligation.request_id,
        step: shardStep,
        workerOutput: rawOutput,
        resources,
      });
      if (validation.retryResponse) {
        throw new Error('output failed schema validation and requires retry');
      }
      workerOutput = validation.workerOutput;
      assertShardOutputMatchesObligation(ownerStepId, obligation, workerOutput);
    } catch (error) {
      const reason = blockReason('validation', ownerStepId, obligation, error.message);
      if (shouldRetry(obligation)) {
        replaceObligation(obligations, pendingRetryShardObligation(obligation, reason));
        continue;
      }
      blocked[obligation.obligation_id] = blockedShardOutputRecord(obligation, reason, rawOutput);
      replaceObligation(obligations, blockedShardObligation(obligation, reason));
      continue;
    }
    if (workerOutput.outcome === 'blocked') {
      const reason = blockReason('blocked', ownerStepId, obligation);
      if (shouldRetry(obligation)) {
        replaceObligation(obligations, pendingRetryShardObligation(obligation, reason));
        continue;
      }
      blocked[obligation.obligation_id] = blockedShardOutputRecord(obligation, reason, workerOutput);
      replaceObligation(obligations, blockedShardObligation(obligation, reason));
      continue;
    }
    acceptedOutputs[obligation.obligation_id] = acceptedShardOutputRecord(obligation, workerOutput);
    replaceObligation(obligations, acceptedShardObligation(obligation));
    updatedBaton.state = applyOutputToBatonState(updatedBaton, workerOutput, undefined, obligation.request_id);
  }

  const joinProof = joinProofFor({ ownerStepId, obligations, acceptedOutputs, blocked });
  if (obligations.some((obligation) => obligation.status === 'pending' && obligation.attempts > 0)) {
    return responseForPendingRetries({
      workflow,
      baton: updatedBaton,
      ownerStepId,
      ownerStep,
      plan,
      obligations,
      acceptedOutputs,
      blocked,
    });
  }
  if (!joinProof.coverage_complete) {
    return responseForBlockedJoin({
      workflow,
      baton: updatedBaton,
      ownerStepId,
      ownerStep,
      plan,
      obligations,
      acceptedOutputs,
      blocked,
    });
  }
  const ownerOutput = {
    outcome: 'ready',
    shard_join_proof: joinProof,
  };
  const cursor = new Step({ id: ownerStepId, step: ownerStep });
  updatedBaton.state = {
    ...updatedBaton.state,
    [ownerStepId]: ownerOutput,
    [SHARDING_STATE_KEY]: {
      ...(updatedBaton.state?.[SHARDING_STATE_KEY] ?? {}),
      [ownerStepId]: {
        ...plan,
        obligations,
        status: 'joined',
        accepted_outputs: acceptedOutputs,
        blocked,
        join_proof: joinProof,
      },
    },
  };
  const applied = cursor.applyOutput({ workflow, baton: updatedBaton, output: ownerOutput, storeStepOutput: false });
  const targetStep = workflow.steps?.[applied.targetStepId];
  invariant(targetStep, `transition target not found in workflow: ${applied.targetStepId}`);
  const nextBaton = {
    ...applied.baton,
    state: updatedBaton.state,
    cursor: applied.targetStepId,
    status: statusForStep(workflow, applied.targetStepId, targetStep),
  };
  return responseFor(nextBaton, applied.targetStepId, targetStep, workflow);
}
