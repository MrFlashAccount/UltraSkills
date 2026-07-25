import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { Workflow } from '../entities/Workflow/index.mjs';
import { loadInstructions as runnerLoadInstructions, next as runnerNext } from './helpers/orbita-production-api.mjs';
import { validateWorkflowFile } from './helpers/orbita-production-api.mjs';
import { workflowSemanticValidationOptions } from '../runtime/workflow-semantic-validation.mjs';
import { read, readAllowedRoles, readOutputSchemas } from '../persistence/workflow-resources/workflow-file-reader.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const RESEARCH_CRITIC_WORKFLOW_PATH = path.join(REPO_ROOT, 'workflows/research-critic/workflow.toml');
const researchCriticWorkflowDoc = read(RESEARCH_CRITIC_WORKFLOW_PATH).toJSON();
const tempDir = mkdtempSync(path.join(tmpdir(), 'workflow-validation-parity-'));
afterAll(() => rmSync(tempDir, { recursive: true, force: true }));

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function parityWorkflowDoc(schemaRef) {
  return {
    name: 'workflow-validation-parity-fixture',
    version: 1,
    start: 'prepare',
    done: 'done',
    steps: {
      prepare: {
        name: 'Prepare',
        kind: 'worker',
        input: { prompt: 'Prepare baton-linked output.' },
        output: { template: 'output.md', schema: schemaRef },
        next: 'done',
      },
      done: { name: 'Done', kind: 'done' },
    },
  };
}

function typedApprovalWorkflowDoc(schemaRef) {
  const workflow = parityWorkflowDoc(schemaRef);
  workflow.steps.prepare.next = 'approve';
  workflow.steps.approve = {
    name: 'Approve',
    kind: 'approval',
    input: { summary: '${{ input.prepare.summary }}' },
    next: { match: '${{ output.approval }}', cases: { approved: 'done', rejected: 'done' } },
  };
  return workflow;
}

test('validate-workflow, direct Workflow validation, Workflow.validateOutputSchemas, and workflow-runner share baton $ref semantic-validation parity', async () => {
  const workflowPath = RESEARCH_CRITIC_WORKFLOW_PATH;
  const outputSchemas = readOutputSchemas({ workflow: researchCriticWorkflowDoc, workflowPath, repositoryRoot: REPO_ROOT });
  const allowedRoles = readAllowedRoles({ repositoryRoot: REPO_ROOT });
  const validationOptions = workflowSemanticValidationOptions({ outputSchemas, allowedRoles });
  const directValidation = new Workflow(researchCriticWorkflowDoc).validate(validationOptions);
  const schemaValidation = new Workflow(researchCriticWorkflowDoc).validateOutputSchemas(validationOptions.outputSchemas, validationOptions);
  const validation = validateWorkflowFile(workflowPath);

  assert.deepEqual(directValidation, {
    ok: true,
    workflow: 'research-critic',
    steps: Object.keys(researchCriticWorkflowDoc.steps).length,
  });
  assert.equal(schemaValidation.ok, true);
  assert.equal(schemaValidation.warnings.length, 0);
  assert.equal(schemaValidation.schemasByStep.has('save_research_canvas'), true);
  assert.deepEqual(validation, {
    ok: true,
    workflow: 'research-critic',
    steps: Object.keys(researchCriticWorkflowDoc.steps).length,
  });

  const runId = `workflow-validation-parity-${process.pid}-research-critic`;
  const runsRoot = path.join(tempDir, 'research-critic-runs');
  const leaseToken = `workflow-validation-parity-token-${process.pid}`;
  process.env.WORKFLOW_RUN_TOKEN = leaseToken;

  const response = await runnerNext({ runId, workflowPath, runsRoot, leaseToken });
  assert.equal(response.status, 'needs_host_actions');
  assert.equal(response.requests[0].stepId, 'research_draft');

  const instructions = await runnerLoadInstructions({ runId, stepId: 'research_draft', runsRoot, leaseToken });
  assert.match(instructions, /Normalize the task input/);
});

test('validate-workflow and workflow-runner reject unresolved external refs with the same semantic failure', async () => {
  const workflowRoot = path.join(tempDir, 'missing-external-ref');
  const workflowPath = path.join(workflowRoot, 'workflow.json');
  const schemaRef = 'missing-external-output.schema.json';
  const missingRef = 'https://example.test/workflow/missing#/$defs/artifact';

  mkdirSync(workflowRoot, { recursive: true });
  writeFileSync(path.join(workflowRoot, 'output.md'), 'Return strict JSON.\n');
  writeJson(path.join(workflowRoot, schemaRef), {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['outcome', 'artifacts'],
    properties: {
      outcome: { enum: ['ok'] },
      artifacts: {
        type: 'array',
        items: { $ref: missingRef },
      },
    },
    additionalProperties: false,
  });
  writeJson(workflowPath, parityWorkflowDoc(schemaRef));

  assert.throws(
    () => validateWorkflowFile(workflowPath),
    (error) => {
      assert.match(error.message, /output\.schema 'missing-external-output\.schema\.json' is not a valid JSON Schema/);
      assert.match(error.message, new RegExp(missingRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      return true;
    },
  );

  const runId = `workflow-validation-parity-${process.pid}-missing-ref`;
  const runsRoot = path.join(tempDir, 'missing-ref-runs');
  const leaseToken = `workflow-validation-parity-missing-ref-token-${process.pid}`;
  process.env.WORKFLOW_RUN_TOKEN = leaseToken;

  await assert.rejects(
    () => runnerNext({ runId, workflowPath, runsRoot, leaseToken }),
    (error) => {
      assert.match(error.message, /output\.schema 'missing-external-output\.schema\.json' is not a valid JSON Schema/);
      assert.match(error.message, new RegExp(missingRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      return true;
    },
  );
});

test('repo-shaped workflow roots named workflows keep repository boundary compatibility', async () => {
  const packageRoot = path.join(tempDir, 'custom-root-basename-case', 'workflows', 'custom-flow');
  const workflowPath = path.join(packageRoot, 'workflow.json');
  const siblingSchema = path.join(tempDir, 'custom-root-basename-case', 'workflows', 'shared.schema.json');
  mkdirSync(packageRoot, { recursive: true });
  writeFileSync(path.join(packageRoot, 'output.md'), 'Return strict JSON.\n');
  writeJson(siblingSchema, {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['outcome'],
    properties: { outcome: { enum: ['ok'] } },
    additionalProperties: false,
  });
  writeJson(workflowPath, parityWorkflowDoc('../shared.schema.json'));

  assert.deepEqual(validateWorkflowFile(workflowPath), {
    ok: true,
    workflow: 'workflow-validation-parity-fixture',
    steps: 2,
  });

  const runId = `workflow-validation-parity-${process.pid}-basename-root`;
  const runsRoot = path.join(tempDir, 'basename-root-runs');
  const leaseToken = `workflow-validation-parity-basename-root-token-${process.pid}`;

  const response = await runnerNext({ runId, workflowPath, runsRoot, leaseToken });
  assert.equal(response.status, 'needs_host_actions');
  assert.equal(response.requests[0].stepId, 'prepare');
});

test('typed approval startup validation matches the public runner and legacy approval authoring fails at both seams', async () => {
  const workflowRoot = path.join(tempDir, 'approval-startup-parity');
  const workflowPath = path.join(workflowRoot, 'workflow.json');
  const schemaPath = path.join(workflowRoot, 'producer.schema.json');
  mkdirSync(workflowRoot, { recursive: true });
  writeFileSync(path.join(workflowRoot, 'output.md'), 'Return typed output.\n');
  writeJson(schemaPath, {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['outcome', 'summary'],
    properties: {
      outcome: { const: 'ready' },
      summary: { type: 'string', minLength: 1 },
    },
    additionalProperties: false,
  });
  const typed = typedApprovalWorkflowDoc(path.basename(schemaPath));
  writeJson(workflowPath, typed);

  assert.deepEqual(validateWorkflowFile(workflowPath), {
    ok: true,
    workflow: 'workflow-validation-parity-fixture',
    steps: 3,
  });
  const runId = `workflow-validation-parity-${process.pid}-typed-approval`;
  const runsRoot = path.join(tempDir, 'typed-approval-runs');
  const leaseToken = `workflow-validation-parity-typed-approval-${process.pid}`;
  const response = await runnerNext({ runId, workflowPath, runsRoot, leaseToken });
  assert.equal(response.requests[0].stepId, 'prepare');

  const legacy = structuredClone(typed);
  legacy.steps.approve.input = { prompt: 'Approve the old prompt.' };
  writeJson(workflowPath, legacy);
  const migrationError = /approval prompt\/template authoring was removed; use typed input\.summary, input\.artifacts, and optional input\.verdict selectors/;
  assert.throws(
    () => validateWorkflowFile(workflowPath),
    migrationError,
  );
  const invalidRunId = `workflow-validation-parity-${process.pid}-legacy-approval`;
  await assert.rejects(
    () => runnerNext({ runId: invalidRunId, workflowPath, runsRoot, leaseToken: `${leaseToken}-legacy` }),
    migrationError,
  );
});

test('approval selectors accept conditionally required producer paths only when the condition is guaranteed', async () => {
  const workflowRoot = path.join(tempDir, 'approval-conditional-required-parity');
  const workflowPath = path.join(workflowRoot, 'workflow.json');
  const schemaPath = path.join(workflowRoot, 'producer.schema.json');
  const runsRoot = path.join(tempDir, 'approval-conditional-required-runs');
  mkdirSync(workflowRoot, { recursive: true });
  writeFileSync(path.join(workflowRoot, 'output.md'), 'Return typed output.\n');
  const producerSchema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['outcome'],
    properties: {
      outcome: { enum: ['ready', 'skipped'] },
      summary: { type: 'string', minLength: 1 },
    },
    if: { properties: { outcome: { const: 'ready' } }, required: ['outcome'] },
    then: { required: ['summary'] },
    additionalProperties: false,
  };
  writeJson(schemaPath, producerSchema);
  writeJson(workflowPath, typedApprovalWorkflowDoc(path.basename(schemaPath)));

  const conditionalPathError = /input\.summary expression .* must reference a required output\.schema path/;
  assert.throws(() => validateWorkflowFile(workflowPath), conditionalPathError);
  await assert.rejects(
    () => runnerNext({
      runId: `workflow-validation-parity-${process.pid}-conditional-required`,
      workflowPath,
      runsRoot,
      leaseToken: `workflow-validation-parity-${process.pid}-conditional-required-token`,
    }),
    conditionalPathError,
  );

  producerSchema.properties.outcome.enum = ['ready'];
  writeJson(schemaPath, producerSchema);
  assert.equal(validateWorkflowFile(workflowPath).ok, true);

  producerSchema.properties.outcome.enum = ['ready', 'skipped'];
  producerSchema.else = { required: ['summary'] };
  writeJson(schemaPath, producerSchema);
  assert.equal(validateWorkflowFile(workflowPath).ok, true);
});

test('approval selector producers must be guaranteed to execute before the gate at validation and runner startup seams', async () => {
  const workflowRoot = path.join(tempDir, 'approval-producer-order-parity');
  const workflowPath = path.join(workflowRoot, 'workflow.json');
  const schemaRef = 'producer.schema.json';
  mkdirSync(workflowRoot, { recursive: true });
  writeFileSync(path.join(workflowRoot, 'output.md'), 'Return typed output.\n');
  writeJson(path.join(workflowRoot, schemaRef), {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['outcome', 'summary'],
    properties: {
      outcome: { const: 'ready' },
      summary: { type: 'string', minLength: 1 },
    },
    additionalProperties: false,
  });
  for (const [fileName, routeValues] of [
    ['bypass-router.schema.json', ['prepare', 'approve']],
    ['dominance-router.schema.json', ['prepare', 'alternate']],
    ['loop-router.schema.json', ['loop_b', 'prepare']],
  ]) {
    writeJson(path.join(workflowRoot, fileName), {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      required: ['outcome', 'summary', 'route'],
      properties: {
        outcome: { const: 'ready' },
        summary: { type: 'string', minLength: 1 },
        route: { enum: routeValues },
      },
      additionalProperties: false,
    });
  }

  const cases = [
    {
      name: 'self',
      mutate(workflow) {
        workflow.steps.approve.input.summary = '${{ input.approve.summary }}';
      },
      error: /selector cannot select the current approval gate/,
    },
    {
      name: 'downstream-cycle',
      mutate(workflow) {
        workflow.steps.approve.input.summary = '${{ input.later.summary }}';
        workflow.steps.approve.next.cases = { approved: 'later', rejected: 'later' };
        workflow.steps.later = {
          name: 'Later producer',
          kind: 'worker',
          input: { prompt: 'Produce a later summary.' },
          output: { template: 'output.md', schema: schemaRef },
          next: 'approve',
        };
      },
      error: /selector producer 'later' is not guaranteed to execute before the approval gate/,
    },
    {
      name: 'dynamic-bypass',
      mutate(workflow) {
        workflow.start = 'router';
        workflow.steps.router = {
          name: 'Dynamic router',
          kind: 'worker',
          input: { prompt: 'Choose the approval route.' },
          output: { template: 'output.md', schema: 'bypass-router.schema.json' },
          next: '${{ output.route }}',
        };
      },
      error: /selector producer 'prepare' is not guaranteed to execute before the approval gate/,
    },
  ];

  for (const fixture of cases) {
    const workflow = typedApprovalWorkflowDoc(schemaRef);
    fixture.mutate(workflow);
    writeJson(workflowPath, workflow);
    assert.throws(() => validateWorkflowFile(workflowPath), fixture.error);
    await assert.rejects(
      () => runnerNext({
        runId: `workflow-validation-parity-${process.pid}-approval-${fixture.name}`,
        workflowPath,
        runsRoot: path.join(tempDir, 'approval-producer-order-runs'),
        leaseToken: `workflow-validation-parity-approval-${fixture.name}-${process.pid}`,
      }),
      fixture.error,
    );
  }

  const validCases = [
    {
      name: 'dynamic-dominance',
      mutate(workflow) {
        workflow.start = 'router';
        workflow.steps.router = {
          name: 'Dynamic router',
          kind: 'worker',
          input: { prompt: 'Choose a producer route.' },
          output: { template: 'output.md', schema: 'dominance-router.schema.json' },
          next: '${{ output.route }}',
        };
        workflow.steps.alternate = {
          name: 'Alternate route',
          kind: 'worker',
          input: { prompt: 'Converge on the producer.' },
          output: { template: 'output.md', schema: schemaRef },
          next: 'prepare',
        };
      },
      expectedStart: 'router',
    },
  ];

  for (const fixture of validCases) {
    const workflow = typedApprovalWorkflowDoc(schemaRef);
    fixture.mutate(workflow);
    writeJson(workflowPath, workflow);
    assert.equal(validateWorkflowFile(workflowPath).ok, true);
    const response = await runnerNext({
      runId: `workflow-validation-parity-${process.pid}-approval-${fixture.name}`,
      workflowPath,
      runsRoot: path.join(tempDir, 'approval-producer-order-runs'),
      leaseToken: `workflow-validation-parity-approval-${fixture.name}-${process.pid}`,
    });
    assert.equal(response.requests[0].stepId, fixture.expectedStart);
  }
});

test('conditional approval verdict topology permits bounded critic exits and rejects indirect critic bypasses', async () => {
  const workflowRoot = path.join(tempDir, 'conditional-verdict-on-limit-parity');
  const workflowPath = path.join(workflowRoot, 'workflow.json');
  const runsRoot = path.join(tempDir, 'conditional-verdict-on-limit-runs');
  mkdirSync(workflowRoot, { recursive: true });
  writeFileSync(path.join(workflowRoot, 'output.md'), 'Return typed output.\n');
  writeJson(path.join(workflowRoot, 'producer.schema.json'), {
    type: 'object', required: ['outcome', 'summary'],
    properties: { outcome: { enum: ['ready_for_attack', 'ready_for_approval'] }, summary: { type: 'string', minLength: 1 } },
    additionalProperties: false,
  });
  writeJson(path.join(workflowRoot, 'critic.schema.json'), {
    type: 'object', required: ['outcome', 'summary', 'findings'],
    properties: {
      outcome: { enum: ['approved', 'needs_revision'] },
      summary: { type: 'string', minLength: 1 },
      findings: { type: 'array', items: { type: 'string' } },
    },
    additionalProperties: false,
  });
  writeJson(path.join(workflowRoot, 'revision.schema.json'), {
    type: 'object', required: ['outcome'], properties: { outcome: { enum: ['retry', 'escape'] } }, additionalProperties: false,
  });

  const workflowDoc = () => ({
    name: 'conditional-verdict-on-limit-parity', version: 1, start: 'producer', done: 'done',
    steps: {
      producer: {
        name: 'Producer', kind: 'worker', input: { prompt: 'Produce the approval candidate.' },
        output: { template: 'output.md', schema: 'producer.schema.json' },
        next: { match: '${{ output.outcome }}', cases: { ready_for_attack: 'critic', ready_for_approval: 'approve' } },
      },
      critic: {
        name: 'Critic', kind: 'worker', input: { prompt: 'Critique the candidate.' },
        output: { template: 'output.md', schema: 'critic.schema.json' },
        next: { match: '${{ output.outcome }}', cases: { approved: 'approve', needs_revision: 'producer' } },
      },
      approve: {
        name: 'Approve', kind: 'approval',
        input: {
          summary: '${{ input.producer.summary }}',
          verdict: {
            outcome: '${{ input.critic.outcome }}', summary: '${{ input.critic.summary }}', findings: '${{ input.critic.findings }}',
            include_when: { selector: '${{ input.producer.outcome }}', equals: 'ready_for_attack' },
          },
        },
        next: { match: '${{ output.approval }}', cases: { approved: 'done', rejected: 'done' } },
      },
      done: { name: 'Done', kind: 'done' },
    },
  });
  const assertStartupRejects = async (workflow, name, error) => {
    writeJson(workflowPath, workflow);
    assert.throws(() => validateWorkflowFile(workflowPath), error);
    await assert.rejects(() => runnerNext({
      runId: `workflow-validation-parity-${process.pid}-${name}`,
      workflowPath,
      runsRoot,
      leaseToken: `workflow-validation-parity-${name}-${process.pid}`,
    }), error);
  };

  const boundedCriticExit = workflowDoc();
  boundedCriticExit.loopPolicies = {
    critique: { steps: ['producer', 'critic'], entry: 'producer', boundary: 'critic', maxIterations: 1, onLimit: 'approve' },
  };
  writeJson(workflowPath, boundedCriticExit);
  assert.equal(validateWorkflowFile(workflowPath).ok, true);
  const boundedResponse = await runnerNext({
    runId: `workflow-validation-parity-${process.pid}-bounded-critic-exit`,
    workflowPath,
    runsRoot,
    leaseToken: `workflow-validation-parity-bounded-critic-exit-${process.pid}`,
  });
  assert.equal(boundedResponse.requests[0].stepId, 'producer');

  const nonSuccessRetarget = workflowDoc();
  nonSuccessRetarget.steps.critic.next.cases.needs_revision = 'revision';
  nonSuccessRetarget.steps.revision = {
    name: 'Revision handoff', kind: 'worker', input: { prompt: 'Prepare another critic pass.' },
    output: { template: 'output.md', schema: 'revision.schema.json' },
    next: { match: '${{ output.outcome }}', cases: { retry: 'critic', escape: 'approve' } },
  };
  nonSuccessRetarget.loopPolicies = {
    critique: { steps: ['critic', 'revision'], entry: 'critic', boundary: 'revision', maxIterations: 1, onLimit: 'approve' },
  };
  await assertStartupRejects(nonSuccessRetarget, 'non-success-retarget', /onLimit to route critic 'critic' non-success to the approval gate/);

  const directCorrection = workflowDoc();
  writeJson(workflowPath, directCorrection);
  assert.equal(validateWorkflowFile(workflowPath).ok, true);
  const response = await runnerNext({
    runId: `workflow-validation-parity-${process.pid}-direct-correction`, workflowPath, runsRoot,
    leaseToken: `workflow-validation-parity-direct-correction-${process.pid}`,
  });
  assert.equal(response.requests[0].stepId, 'producer');
});

test('workflow validation boundaries keep baton schema composition and Step entity materialization outside Workflow owner', () => {
  const adapterPaths = [
    'skills/orbita/lib/use-cases/ValidateWorkflow.mjs',
    'skills/orbita/lib/runtime/guards/workflow.mjs',
    'skills/orbita/lib/use-cases/LoadInstructions.mjs',
  ];
  const workflowOwnerPaths = readdirSync(path.join(REPO_ROOT, 'skills/orbita/lib/entities/Workflow'))
    .filter((entry) => entry.endsWith('.mjs'))
    .map((entry) => path.join('skills/orbita/lib/entities/Workflow', entry));

  for (const relativePath of adapterPaths) {
    const source = readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
    assert.doesNotMatch(source, /file-contracts\/baton\/baton-schema\.mjs/);
  }

  for (const relativePath of workflowOwnerPaths) {
    const source = readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
    assert.doesNotMatch(source, /file-contracts\/baton\/baton-schema\.mjs/);
  }

  const workflowIndex = readFileSync(path.join(REPO_ROOT, 'skills/orbita/lib/entities/Workflow/index.mjs'), 'utf8');
  assert.doesNotMatch(workflowIndex, /\.\.\/Step\/index\.mjs/);
});
