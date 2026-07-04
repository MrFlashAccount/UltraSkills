import { invariant } from '../errors.mjs';
import { Step } from '../entities/Step/index.mjs';
import { statusForStep } from './step-status.mjs';
import { applyOutputToBatonState } from './baton-state.mjs';
import { responseFor, responseForCursor } from './output/response.mjs';
import { assertOutputSchemaIfDeclared } from './output/worker-output.mjs';
import {
  MATRIX_STATE_KEY,
  assertNoUnexpectedMatrixOutputs,
  batonWithMatrixPlan,
  joinProofForMatrix,
  matrixOutputForRequest,
  matrixPlanForBaton,
  stepForMatrixUnit,
} from './matrix.mjs';

function clone(value) {
  return structuredClone(value);
}

function replaceUnit(units, nextUnit) {
  const index = units.findIndex((item) => item.unit_id === nextUnit.unit_id);
  if (index === -1) return units;
  units.splice(index, 1, nextUnit);
  return units;
}

function shouldRetry(unit, plan) {
  return unit.attempts + 1 < plan.max_attempts;
}

function blockReason(kind, ownerStepId, unit, details) {
  if (kind === 'missing') return `matrix step '${ownerStepId}' missing required unit '${unit.unit_id}'`;
  if (kind === 'blocked') return `matrix step '${ownerStepId}' required unit '${unit.unit_id}' blocked after ${Math.min(unit.attempts + 1, unit.max_attempts ?? 1)}/${unit.max_attempts ?? 1} attempts`;
  return `matrix step '${ownerStepId}' unit '${unit.unit_id}' failed validation: ${details}`;
}

function acceptedUnit(unit, plan) {
  return {
    ...clone(unit),
    status: 'accepted',
    attempts: unit.attempts + 1,
    max_attempts: plan.max_attempts,
  };
}

function blockedUnit(unit, plan, reason) {
  return {
    ...clone(unit),
    status: 'blocked',
    attempts: Math.min(unit.attempts + 1, plan.max_attempts),
    max_attempts: plan.max_attempts,
    reason,
  };
}

function pendingRetryUnit(unit, reason) {
  return {
    ...clone(unit),
    status: 'pending',
    attempts: unit.attempts + 1,
    reason,
  };
}

function acceptedRecord(unit, output) {
  const artifactIds = Array.isArray(output?.artifacts) ? output.artifacts.map((artifact) => artifact?.id).filter(Boolean) : [];
  const resultCount = Array.isArray(output?.results) ? output.results.length : 0;
  return {
    unit_id: unit.unit_id,
    request_id: unit.request_id,
    status: 'accepted',
    output_ref: { step_id: unit.request_id },
    artifact_ids: artifactIds,
    result_count: resultCount,
  };
}

function blockedRecord(unit, reason) {
  return {
    unit_id: unit.unit_id,
    request_id: unit.request_id,
    reason,
  };
}

function planWithUpdates(plan, { units, acceptedOutputs, blocked, currentRequests = [], status = 'dispatching', joinProof = null }) {
  return {
    ...clone(plan),
    status,
    current_requests: currentRequests,
    units,
    accepted_outputs: acceptedOutputs,
    blocked,
    join_proof: joinProof,
  };
}

function ownerBlockedOutput({ ownerStepId, joinProof, blocked }) {
  const blockedIds = Object.keys(blocked).sort();
  return {
    outcome: 'blocked',
    matrix_join_proof: joinProof,
    blocker: {
      summary: `Matrix step '${ownerStepId}' has incomplete required coverage.`,
      source_step_id: ownerStepId,
      needed: `Resolve blocked matrix units: ${blockedIds.join(', ') || 'none'}.`,
      evidence: [
        `missing_required_unit_ids=${joinProof.missing_required_unit_ids.join(',') || 'none'}`,
        `blocked_unit_ids=${joinProof.blocked_unit_ids.join(',') || 'none'}`,
      ],
      risk: 'Continuing would allow a matrix owner step to pass without complete required coverage.',
    },
  };
}

function responseForBlockedJoin({ workflow, baton, ownerStepId, ownerStep, plan, units, acceptedOutputs, blocked }) {
  const joinProof = joinProofForMatrix({ ownerStepId, plan: { ...plan, units, accepted_outputs: acceptedOutputs, blocked } });
  const ownerOutput = ownerBlockedOutput({ ownerStepId, joinProof, blocked });
  const blockedPlan = planWithUpdates(plan, {
    units,
    acceptedOutputs,
    blocked,
    status: 'blocked',
    joinProof,
  });
  const blockedBaton = {
    ...batonWithMatrixPlan(baton, ownerStepId, blockedPlan),
    state: {
      ...(baton.state ?? {}),
      [ownerStepId]: ownerOutput,
      [MATRIX_STATE_KEY]: {
        ...(baton.state?.[MATRIX_STATE_KEY] ?? {}),
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
  return {
    baton: blockedBaton,
    steps: [{
      id: ownerStepId,
      action: 'run_worker',
      step: {
        ...clone(ownerStep.worker),
        kind: 'worker',
        next: ownerStep.next,
      },
    }],
  };
}

function responseForPending({ workflow, baton, ownerStepId, plan, units, acceptedOutputs, blocked }) {
  const pendingPlan = planWithUpdates(plan, {
    units,
    acceptedOutputs,
    blocked,
    status: 'dispatching',
  });
  return responseForCursor(batonWithMatrixPlan(baton, ownerStepId, pendingPlan), workflow);
}

export function applyMatrixStepOutputs({ workflow, baton, ownerStepId, ownerStep, allOutput, resources }) {
  const plan = matrixPlanForBaton({ baton, ownerStepId, ownerStep });
  assertNoUnexpectedMatrixOutputs(allOutput, plan);

  let updatedBaton = clone(baton);
  const acceptedOutputs = clone(plan.accepted_outputs ?? {});
  const blocked = clone(plan.blocked ?? {});
  const units = plan.units.map((unit) => clone(unit));
  const unitsByRequestId = new Map(plan.units.map((unit) => [unit.request_id, unit]));

  for (const requestId of plan.current_requests ?? []) {
    const unit = unitsByRequestId.get(requestId);
    if (!unit || unit.status === 'accepted') continue;
    const rawOutput = matrixOutputForRequest(allOutput, requestId);
    if (rawOutput === undefined) {
      if (unit.required) {
        const reason = blockReason('missing', ownerStepId, unit);
        blocked[unit.unit_id] = blockedRecord(unit, reason);
        replaceUnit(units, blockedUnit(unit, plan, reason));
      }
      continue;
    }

    const unitStep = stepForMatrixUnit(ownerStepId, ownerStep, unit);
    let workerOutput;
    try {
      const validation = assertOutputSchemaIfDeclared({
        baton: updatedBaton,
        stepId: unit.request_id,
        step: unitStep,
        workerOutput: rawOutput,
        resources,
      });
      if (validation.retryResponse) throw new Error('output failed schema validation and requires retry');
      workerOutput = validation.workerOutput;
    } catch (error) {
      const reason = blockReason('validation', ownerStepId, unit, error.message);
      if (shouldRetry(unit, plan)) {
        replaceUnit(units, pendingRetryUnit(unit, reason));
        if (updatedBaton.state) delete updatedBaton.state[unit.request_id];
        continue;
      }
      blocked[unit.unit_id] = blockedRecord(unit, reason);
      replaceUnit(units, blockedUnit(unit, plan, reason));
      if (updatedBaton.state) delete updatedBaton.state[unit.request_id];
      continue;
    }

    if (workerOutput.outcome === 'blocked') {
      const reason = blockReason('blocked', ownerStepId, unit);
      if (shouldRetry(unit, plan)) {
        replaceUnit(units, pendingRetryUnit(unit, reason));
        if (updatedBaton.state) delete updatedBaton.state[unit.request_id];
        continue;
      }
      blocked[unit.unit_id] = blockedRecord(unit, reason);
      replaceUnit(units, blockedUnit(unit, plan, reason));
      if (updatedBaton.state) delete updatedBaton.state[unit.request_id];
      continue;
    }

    acceptedOutputs[unit.unit_id] = acceptedRecord(unit, workerOutput);
    replaceUnit(units, acceptedUnit(unit, plan));
    updatedBaton.state = applyOutputToBatonState(updatedBaton, workerOutput, undefined, unit.request_id);
    delete updatedBaton.state[unit.request_id];
  }

  const nextPlan = { ...plan, units, accepted_outputs: acceptedOutputs, blocked };
  const joinProof = joinProofForMatrix({ ownerStepId, plan: nextPlan });
  if (units.some((unit) => unit.status === 'pending')) {
    return responseForPending({
      workflow,
      baton: updatedBaton,
      ownerStepId,
      plan,
      units,
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
      units,
      acceptedOutputs,
      blocked,
    });
  }

  const ownerOutput = {
    outcome: 'ready',
    matrix_join_proof: joinProof,
  };
  const joinedPlan = planWithUpdates(plan, {
    units,
    acceptedOutputs,
    blocked,
    status: 'joined',
    joinProof,
  });
  updatedBaton.state = {
    ...updatedBaton.state,
    [ownerStepId]: ownerOutput,
    [MATRIX_STATE_KEY]: {
      ...(updatedBaton.state?.[MATRIX_STATE_KEY] ?? {}),
      [ownerStepId]: joinedPlan,
    },
  };
  const cursor = new Step({ id: ownerStepId, step: ownerStep });
  const applied = cursor.applyOutput({ workflow, baton: updatedBaton, output: ownerOutput, storeStepOutput: false });
  const targetStep = workflow.steps?.[applied.targetStepId];
  invariant(targetStep, `transition target not found in workflow: ${applied.targetStepId}`);
  const nextBaton = {
    ...applied.baton,
    state: updatedBaton.state,
    cursor: applied.targetStepId,
    status: statusForStep(workflow, applied.targetStepId, targetStep),
  };
  if (nextBaton.recoverableWorkerBlockers?.[ownerStepId]) {
    delete nextBaton.recoverableWorkerBlockers[ownerStepId];
    if (Object.keys(nextBaton.recoverableWorkerBlockers).length === 0) delete nextBaton.recoverableWorkerBlockers;
  }
  return responseFor(nextBaton, applied.targetStepId, targetStep, workflow);
}
