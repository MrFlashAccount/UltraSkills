import { WorkflowRuntimeError } from '../../errors.mjs';
import { assertWorkerOutputSchema } from './worker-output-schema.mjs';
import { validateAgainstOutputSchema, OUTPUT_SCHEMA_MAX_ATTEMPTS } from './output-schema-validation.mjs';
import { invalidJsonOutputRetry, outputSchemaAttempt, responseForOutputSchemaRetry } from '../loop/guard.mjs';
import { validateApprovalDecision } from '../approval-contract.mjs';

export function readWorkerOutputForStep({ baton, stepId, step, allOutput, outputParseError }) {
  if (!step.output?.schema) return { workerOutput: allOutput, retryResponse: undefined };
  if (outputParseError) return { workerOutput: undefined, retryResponse: invalidJsonOutputRetry({ baton, stepId, step, error: outputParseError }) };
  return { workerOutput: allOutput, retryResponse: undefined };
}

export function assertCompletedStepOutput(output) {
  if (!output || typeof output !== 'object' || Array.isArray(output)) return;
  if (Object.hasOwn(output, 'non_blocking_stop')) {
    throw new WorkflowRuntimeError('completed step output must not contain non_blocking_stop; use workflow-runner report-stop');
  }
  if (Object.hasOwn(output, 'blocker') || output.outcome === 'blocked' || output.approval === 'blocked') {
    throw new WorkflowRuntimeError('completed step output uses a removed stop-as-output contract; use workflow-runner report-stop');
  }
}

export function assertOutputSchemaIfDeclared({ baton, stepId, step, workerOutput, resources }) {
  assertCompletedStepOutput(workerOutput);
  if (step.kind === 'approval') {
    return { workerOutput: validateApprovalDecision(workerOutput), retryResponse: undefined };
  }
  const schemaRef = step.output?.schema;
  if (!schemaRef) {
    assertWorkerOutputSchema(workerOutput);
    return { workerOutput, retryResponse: undefined };
  }

  const loaded = resources?.outputSchemas instanceof Map ? resources.outputSchemas.get(schemaRef) : resources?.outputSchemas?.[schemaRef];
  const schema = loaded?.schema ?? loaded;
  if (!schema) throw new WorkflowRuntimeError(`output schema validation failed: missing output.schema '${schemaRef}'`);
  const validation = validateAgainstOutputSchema({ schemaRef, schema, output: workerOutput });
  if (validation.ok) return { workerOutput: validation.output, retryResponse: undefined };

  const attempt = outputSchemaAttempt(baton, stepId);
  if (attempt >= OUTPUT_SCHEMA_MAX_ATTEMPTS) {
    throw new WorkflowRuntimeError(
      `output schema validation failed for step '${stepId}' after ${OUTPUT_SCHEMA_MAX_ATTEMPTS} attempts: ${validation.errors}`,
    );
  }

  return {
    workerOutput,
    retryResponse: responseForOutputSchemaRetry({ baton, stepId, step, errors: validation.errors, attempt }),
  };
}
