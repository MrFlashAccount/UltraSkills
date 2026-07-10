import { WorkflowRuntimeError } from '../../errors.mjs';
import { applyWorkflowOutput } from '../../use-cases/ApplyWorkflowOutput.mjs';
import { inspectWorkflow } from '../../use-cases/InspectWorkflow.mjs';
import { runNext } from '../../use-cases/RunNext.mjs';
import { loadWorkflowRuntime, readWorkerOutputText } from '../../persistence/workflow-resources/runtime-reader.mjs';

export function runWorkflowRuntimeApi({ mode, workflowPath, batonPath, outputPath, includeDiagnostics = false }) {
  try {
    const runtime = loadWorkflowRuntime({ workflowPath, batonPath });
    let response;
    if (mode === 'inspect') {
      response = inspectWorkflow({ workflowDoc: runtime.workflow, batonDoc: runtime.baton, resources: runtime.resources });
    } else if (mode === 'render') {
      response = runNext({
        workflowDoc: runtime.workflow,
        batonDoc: runtime.baton,
        resources: runtime.resources,
        includeDiagnostics,
      });
    } else if (mode === 'apply') {
      response = applyWorkflowOutput({
        workflowDoc: runtime.workflow,
        batonDoc: runtime.baton,
        outputContent: readWorkerOutputText({ outputPath }),
        resources: runtime.resources,
      });
    } else {
      throw new WorkflowRuntimeError(`unsupported workflow runtime mode '${mode}'`);
    }
    return { status: 0, stdout: `${JSON.stringify(response, null, 2)}\n`, stderr: '' };
  } catch (error) {
    return {
      status: 1,
      stdout: '',
      stderr: `workflow-runtime: ${error?.message ?? error}\n`,
    };
  }
}
