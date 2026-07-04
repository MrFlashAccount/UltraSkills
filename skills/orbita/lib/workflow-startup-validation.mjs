export function createWorkflowStartupValidator({ validateWorkflowFile, publicErrorMessage }) {
  return function validateWorkflowStartup({ workflowPath } = {}) {
    try {
      validateWorkflowFile(workflowPath);
    } catch (error) {
      throw new Error(`workflow startup validation failed: ${publicErrorMessage(error?.message ?? error)}`);
    }
    return { ok: true, workflowPath };
  };
}
