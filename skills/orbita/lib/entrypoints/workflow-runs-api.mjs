import {
  claimWorkflowRunAtRoot,
  heartbeatWorkflowRunAtRoot,
  listWorkflowRunsAtRoot,
  registerWorkflowRunAtRoot,
  summarizeWorkflowRuns as summarizeWorkflowRunsAtRoot,
} from '../persistence/run-state/workflow-runs.mjs';
import { publicErrorMessage } from '../public-error.mjs';
import { createWorkflowRuns } from '../use-cases/WorkflowRuns.mjs';

const workflowRuns = createWorkflowRuns({
  claimWorkflowRunAtRoot,
  heartbeatWorkflowRunAtRoot,
  listWorkflowRunsAtRoot,
  registerWorkflowRunAtRoot,
  summarizeWorkflowRuns: summarizeWorkflowRunsAtRoot,
  publicErrorMessage,
});

export const {
  claimWorkflowRun,
  heartbeatWorkflowRun,
  listWorkflowRuns,
  registerWorkflowRun,
  summarizeWorkflowRuns,
} = workflowRuns;
