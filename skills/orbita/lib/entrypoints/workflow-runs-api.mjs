import {
  claimWorkflowRunAtRoot,
  heartbeatWorkflowRunAtRoot,
  listWorkflowRunsAtRoot,
  registerWorkflowRunAtRoot,
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
  heartbeatWorkflowRunAtRoot,
  listWorkflowRunsAtRoot,
  registerWorkflowRunAtRoot,
  summarizeWorkflowRuns: summarizeWorkflowRunsAtRoot,
  publicErrorMessage,
  defaultWorkflowPath,
  resolveAbsoluteWorkflowPath,
  validateWorkflowStartup,
});

export const {
  claimWorkflowRun,
  heartbeatWorkflowRun,
  listWorkflowRuns,
  registerWorkflowRun,
  summarizeWorkflowRuns,
} = workflowRuns;
