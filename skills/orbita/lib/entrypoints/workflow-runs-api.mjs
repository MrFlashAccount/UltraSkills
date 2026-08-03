import {
  claimWorkflowRunAtRoot,
  deleteWorkflowRunAtRoot,
  heartbeatWorkflowRunAtRoot,
  listWorkflowRunsAtRoot,
  registerWorkflowRunAtRoot,
  releaseWorkflowRunAtRoot,
  summarizeWorkflowRuns as summarizeWorkflowRunsAtRoot,
} from '../persistence/run-state/workflow-runs.mjs';
import { defaultWorkflowPath } from '../persistence/run-state/paths.mjs';
import { publicErrorMessage } from '../public-error.mjs';
import { createWorkflowRuns } from '../use-cases/WorkflowRuns.mjs';
import { resolveAbsoluteWorkflowPath } from '../workflow-path-boundary.mjs';
import { createWorkflowStartupValidator } from '../workflow-startup-validation.mjs';
import { validateWorkflowFile } from './validate-workflow-file.mjs';

const validateWorkflowStartup = createWorkflowStartupValidator({
  validateWorkflowFile,
  publicErrorMessage,
});

const workflowRuns = createWorkflowRuns({
  claimWorkflowRunAtRoot,
  deleteWorkflowRunAtRoot,
  heartbeatWorkflowRunAtRoot,
  listWorkflowRunsAtRoot,
  registerWorkflowRunAtRoot,
  releaseWorkflowRunAtRoot,
  summarizeWorkflowRuns: summarizeWorkflowRunsAtRoot,
  publicErrorMessage,
  defaultWorkflowPath,
  resolveAbsoluteWorkflowPath,
  validateWorkflowStartup,
});

export const {
  claimWorkflowRun,
  deleteWorkflowRun,
  heartbeatWorkflowRun,
  listWorkflowRuns,
  registerWorkflowRun,
  releaseWorkflowRun,
  summarizeWorkflowRuns,
} = workflowRuns;
