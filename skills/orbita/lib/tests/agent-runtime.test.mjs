import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, test } from 'bun:test';
import { assertWorkflowSchema } from '../file-contracts/workflow-document-schema.mjs';
import { readWorkflowDocument } from '../persistence/workflow-resources/workflow-document-reader.mjs';
import { toHostResponse } from '../runner/host-requests.mjs';

const tempDir = mkdtempSync(path.join(tmpdir(), 'agent-runtime-contract-'));
afterAll(() => rmSync(tempDir, { recursive: true, force: true }));

const options = {
  runId: 'agent-runtime-run',
  workflowPath: '/tmp/agent-runtime-workflow.json',
  repositoryRoot: '/tmp',
  runsRoot: '/tmp/agent-runtime-runs',
  leaseToken: 'lease-token',
  claimContext: { harness: 'codex' },
};

function baton(cursor = 'worker') {
  return { cursor, status: 'running', state: { artifacts: [], results: [] } };
}

function hostFor({ workflow, step, claimContext = options.claimContext }) {
  return toHostResponse({ steps: [step], baton: baton(step.parentStepId ?? step.ownerStepId ?? step.id) }, {
    ...options,
    workflow,
    claimContext,
  });
}

function workerSource(overrides = {}) {
  return {
    name: 'Worker',
    kind: 'worker',
    agent: 'architect',
    agent_runtime: { codex: { model: 'gpt-5.5', thinking_level: 'high' } },
    output: { template: 'output.md' },
    next: 'done',
    ...overrides,
  };
}

test('TOML dotted agent_runtime authoring parses to the per-harness map', () => {
  const workflowPath = path.join(tempDir, 'workflow.toml');
  writeFileSync(workflowPath, `name = "agent-runtime-toml"
version = 1
start = "worker"
done = "done"

[steps.worker]
name = "Worker"
kind = "worker"
agent = "architect"
agent_runtime.codex = { model = "gpt-5.5", thinking_level = "high" }
next = "done"

[steps.worker.output]
template = "output.md"

[steps.done]
name = "Done"
kind = "done"
`);
  const workflow = readWorkflowDocument(workflowPath);
  assert.doesNotThrow(() => assertWorkflowSchema(workflow));
  assert.deepEqual(workflow.steps.worker.agent_runtime, {
    codex: { model: 'gpt-5.5', thinking_level: 'high' },
  });
});

test('agent runtime selects a case-insensitively matched claimed harness only for run_worker', () => {
  const workflow = { steps: { worker: workerSource() } };
  const step = { id: 'worker', action: 'run_worker', step: workflow.steps.worker };
  const matched = hostFor({ workflow, step, claimContext: { harness: 'CoDeX' } });
  assert.deepEqual(matched.requests[0].agentRuntime, { model: 'gpt-5.5', thinkingLevel: 'high' });
  assert.equal(matched.orchestratorInstruction.match(/Recommended for a fresh subagent when available: model gpt-5\.5 with thinking level high; otherwise use the harness default\./g)?.length, 1);

  for (const claimContext of [null, { harness: 'portable' }, { harness: 'toString' }]) {
    const unmatched = hostFor({ workflow, step, claimContext });
    assert.equal(Object.hasOwn(unmatched.requests[0], 'agentRuntime'), false);
    assert.doesNotMatch(unmatched.orchestratorInstruction, /Recommended for a fresh subagent/);
  }

  const mixedKeyWorkflow = structuredClone(workflow);
  mixedKeyWorkflow.steps.worker.agent_runtime = {
    CoDeX: { model: 'MixedCaseModel', thinking_level: 'High' },
  };
  assert.deepEqual(
    hostFor({ workflow: mixedKeyWorkflow, step, claimContext: { harness: 'codex' } }).requests[0].agentRuntime,
    { model: 'MixedCaseModel', thinkingLevel: 'High' },
  );
});

test('agent runtime uses the original shard worker template configuration', () => {
  const template = workerSource();
  delete template.kind;
  delete template.next;
  const workflow = { steps: { work: { name: 'Work', kind: 'shard', worker: template } } };
  const synthetic = {
    id: 'work__shard__1__0',
    parentStepId: 'work',
    action: 'run_worker',
    step: { ...template, agent: 'work__shard__1__0' },
    shard: { parent_step_id: 'work', activation: 1, phase: 'shards', index: 0, total: 1, request_id: 'work__shard__1__0' },
  };
  assert.deepEqual(hostFor({ workflow, step: synthetic }).requests[0].agentRuntime, {
    model: 'gpt-5.5',
    thinkingLevel: 'high',
  });

  delete workflow.steps.work.worker.agent;
  assert.equal(Object.hasOwn(hostFor({ workflow, step: synthetic }).requests[0], 'agentRuntime'), false);
});

test('approval requests never receive agent runtime fields or prose', () => {
  const workflow = { steps: { approval: { name: 'Approval', kind: 'approval', next: 'done' } } };
  const host = hostFor({
    workflow,
    step: { id: 'approval', action: 'wait_for_approval', step: workflow.steps.approval },
  });
  assert.equal(Object.hasOwn(host.requests[0], 'agentRuntime'), false);
  assert.doesNotMatch(host.orchestratorInstruction, /Recommended for a fresh subagent/);
});
