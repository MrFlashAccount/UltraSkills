import workflowSchema from './workflow-document.json' with { type: 'json' };
import { assertJsonSchema } from '../../../../shared/scripts/schema-validation/schema-validation.mjs';

export class WorkflowSchemaError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WorkflowSchemaError';
  }
}

function hasMatchCasesShape(value) {
  return value && typeof value === 'object' && !Array.isArray(value) && 'match' in value && 'cases' in value;
}

function assertNoNestedMatchCasesTarget(target, fieldPath) {
  if (hasMatchCasesShape(target)) throw new WorkflowSchemaError(`nested match/cases transitions are not supported at ${fieldPath}`);
}

function assertWorkflowNoNestedMatchCases(workflowDoc) {
  const steps = workflowDoc?.steps;
  if (!steps || typeof steps !== 'object' || Array.isArray(steps)) return;

  for (const [stepId, step] of Object.entries(steps)) {
    const next = step?.next;
    if (!hasMatchCasesShape(next) || !next.cases || typeof next.cases !== 'object' || Array.isArray(next.cases)) continue;
    for (const [caseKey, target] of Object.entries(next.cases)) {
      assertNoNestedMatchCasesTarget(target, `steps.${stepId}.next.cases.${caseKey}`);
    }
  }
}

function assertNoLegacyApprovalAuthoring(workflowDoc) {
  const steps = workflowDoc?.steps;
  if (!steps || typeof steps !== 'object' || Array.isArray(steps)) return;
  for (const [stepId, step] of Object.entries(steps)) {
    if (step?.kind !== 'approval') continue;
    const input = step.input;
    if (input && typeof input === 'object' && !Array.isArray(input)) {
      if (Object.hasOwn(input, 'prompt') || Object.hasOwn(input, 'template')) {
        throw new WorkflowSchemaError(`step '${stepId}' approval prompt/template authoring was removed; use typed input.summary, input.artifacts, and optional input.verdict selectors`);
      }
      if (!Object.hasOwn(input, 'summary')) {
        throw new WorkflowSchemaError(`step '${stepId}' approval input.summary is required and must select an upstream producer string`);
      }
    }
    if (Object.hasOwn(step, 'output') || Object.hasOwn(step, 'approvalOutput')) {
      throw new WorkflowSchemaError(`step '${stepId}' approval output/schema authoring was removed; output is runner-owned and next must route output.approval`);
    }
  }
}

function assertUnambiguousAgentRuntimeHarnesses(workflowDoc) {
  for (const [stepId, step] of Object.entries(workflowDoc.steps)) {
    const sources = [];
    if (step.kind === 'worker' || step.kind === 'fanout' || step.kind === 'shard') sources.push({ worker: step, field: 'agent_runtime' });
    if (step.kind === 'shard') sources.push({ worker: step.worker, field: 'shard.worker.agent_runtime' });
    if (step.kind === 'fanout') {
      for (const [branchId, branch] of Object.entries(step.branches ?? {})) {
        sources.push({ worker: branch, field: `fanout branch '${branchId}' agent_runtime` });
      }
    }
    for (const source of sources) {
      const profiles = source.worker?.agent_runtime;
      if (!profiles) continue;
      const seen = new Map();
      for (const harness of Object.keys(profiles)) {
        const folded = harness.toLowerCase();
        const previous = seen.get(folded);
        if (previous !== undefined) {
          throw new WorkflowSchemaError(`step '${stepId}' ${source.field} harness keys '${previous}' and '${harness}' differ only by ASCII case`);
        }
        seen.set(folded, harness);
      }
    }
  }
}

export { workflowSchema };

export function assertWorkflowSchema(workflowDoc, { externalSchemas = [] } = {}) {
  try {
    assertWorkflowNoNestedMatchCases(workflowDoc);
    assertNoLegacyApprovalAuthoring(workflowDoc);
    assertJsonSchema(workflowSchema, workflowDoc, 'workflow', { schemas: [workflowSchema, ...externalSchemas] });
    assertUnambiguousAgentRuntimeHarnesses(workflowDoc);
  } catch (error) {
    if (error instanceof WorkflowSchemaError) throw new WorkflowSchemaError(`workflow failed schema validation: ${error.message}`);
    if (error?.name === 'SchemaValidationError') throw new WorkflowSchemaError(error.message);
    throw error;
  }
}
