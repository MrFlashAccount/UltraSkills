import { makeTestWorkflowRunsRoot } from './helpers/test-temp-dir.mjs';

if (!process.env.WORKFLOW_RUNS_ROOT) {
  process.env.WORKFLOW_RUNS_ROOT = makeTestWorkflowRunsRoot('workflow-runs');
}
