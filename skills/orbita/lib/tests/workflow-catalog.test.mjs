import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterAll, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { readWorkflowDocument } from '../persistence/workflow-resources/workflow-document-reader.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const tempDir = mkdtempSync(path.join(tmpdir(), 'workflow-catalog-'));
const emptyConfigPath = path.join(tempDir, 'missing-orbita.toml');

afterAll(() => rmSync(tempDir, { recursive: true, force: true }));

function runCatalog(args, options = {}) {
  return spawnSync(process.execPath, ['skills/orbita/lib/entrypoints/cli/workflow-catalog.mjs', ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ORBITA_CONFIG: emptyConfigPath, ...(options.env ?? {}) },
  });
}

function runCli(args, options = {}) {
  return spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ORBITA_CONFIG: emptyConfigPath, ...(options.env ?? {}) },
  });
}

function writeWorkflowPackage(workflowsRoot, packageName, { name = packageName, description = `${name} description`, extension = 'json' } = {}) {
  const workflowDir = path.join(workflowsRoot, packageName);
  mkdirSync(workflowDir, { recursive: true });
  const workflowPath = path.join(workflowDir, `workflow.${extension}`);
  const workflowDoc = {
    name,
    description,
    version: 1,
    start: 'done',
    done: 'done',
    steps: {
      done: { name: 'Done', kind: 'done' },
    },
  };
  writeFileSync(workflowPath, extension === 'toml'
    ? `name = "${name}"\ndescription = "${description}"\nversion = 1\nstart = "done"\ndone = "done"\n\n[steps.done]\nname = "Done"\nkind = "done"\n`
    : `${JSON.stringify(workflowDoc, null, 2)}\n`);
  return realpathSync(workflowPath);
}

function writeWorkerWorkflowPackage(workflowsRoot, packageName, { name = packageName, description = `${name} description` } = {}) {
  const workflowDir = path.join(workflowsRoot, packageName);
  mkdirSync(workflowDir, { recursive: true });
  writeFileSync(path.join(workflowDir, 'output.md'), 'Return a concise markdown status.\n');
  const workflowPath = path.join(workflowDir, 'workflow.json');
  writeFileSync(workflowPath, `${JSON.stringify({
    name,
    description,
    version: 1,
    start: 'prepare',
    done: 'done',
    steps: {
      prepare: {
        name: 'Prepare',
        kind: 'worker',
        input: { prompt: 'Prepare the custom workflow smoke.' },
        output: { template: 'output.md' },
        next: 'done',
      },
      done: { name: 'Done', kind: 'done' },
    },
  }, null, 2)}\n`);
  return realpathSync(workflowPath);
}

function workflowConfig(roots) {
  return roots.map((rootConfig) => [
    '[[workflow_roots]]',
    `source_id = "${rootConfig.sourceId}"`,
    `path = "${rootConfig.path.replaceAll('\\', '\\\\')}"`,
    '',
  ].join('\n')).join('\n');
}

function nestedWorkflowConfig(roots) {
  return ['[workflow_catalog]', '', ...roots.map((rootConfig) => [
    '[[workflow_catalog.roots]]',
    `source_id = "${rootConfig.sourceId}"`,
    `path = "${rootConfig.path.replaceAll('\\', '\\\\')}"`,
    '',
  ].join('\n'))].join('\n');
}

test('workflow catalog lists checked-in workflows from top-level descriptions', () => {
  const result = runCatalog(['list', '--json']);

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  const names = parsed.workflows.map((workflow) => workflow.name);

  assert.deepEqual(names, ['dev-harness', 'research-critic', 'workflow-authoring']);
  assert.deepEqual(
    parsed.workflows.map((workflow) => workflow.path),
    [
      path.join(root, 'workflows/dev-harness/workflow.toml'),
      path.join(root, 'workflows/research-critic/workflow.toml'),
      path.join(root, 'workflows/workflow-authoring/workflow.json'),
    ],
  );
  assert.deepEqual(
    parsed.workflows.map((workflow) => [workflow.sourceId, workflow.rootOrder, workflow.workflowRef, workflow.relativePath, workflow.resolveEligible]),
    [
      ['built-in', 0, 'built-in:dev-harness', 'dev-harness', true],
      ['built-in', 0, 'built-in:research-critic', 'research-critic', true],
      ['built-in', 0, 'built-in:workflow-authoring', 'workflow-authoring', true],
    ],
  );
  assert.equal(parsed.workflows.every((workflow) => path.isAbsolute(workflow.path)), true);
  assert.match(parsed.workflows.find((workflow) => workflow.name === 'workflow-authoring').description, /Create or materially update workflow-runner workflows/);
});

test('workflow catalog human output prefers names and shows absolute workflow paths', () => {
  const result = runCatalog(['list', '--human']);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /dev-harness \[built-in:dev-harness\] - /);
  assert.match(result.stdout, new RegExp(`absolute workflow path for --workflow: ${path.join(root, 'workflows/dev-harness/workflow.toml').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.doesNotMatch(result.stdout, /workflow: workflows\/dev-harness\/workflow\.json/);
});

test('workflow catalog resolves exact and fuzzy workflow names', () => {
  const exact = runCatalog(['resolve', 'dev harness', '--json']);
  assert.equal(exact.status, 0, exact.stderr);
  assert.deepEqual(JSON.parse(exact.stdout), {
    status: 'single',
    query: 'dev harness',
    candidates: [
      {
        name: 'dev-harness',
        displayName: 'dev-harness',
        description: readWorkflowDocument(path.join(root, 'workflows/dev-harness/workflow.toml')).description,
        sourceId: 'built-in',
        rootOrder: 0,
        workflowRef: 'built-in:dev-harness',
        relativePath: 'dev-harness',
        path: path.join(root, 'workflows/dev-harness/workflow.toml'),
        resolveEligible: true,
      },
    ],
  });

  const fuzzy = runCatalog(['resolve', 'authoring', '--json']);
  assert.equal(fuzzy.status, 0, fuzzy.stderr);
  const parsed = JSON.parse(fuzzy.stdout);
  assert.equal(parsed.status, 'single');
  assert.equal(parsed.candidates[0].name, 'workflow-authoring');
});

test('workflow catalog reads ordered TOML roots and resolves exact refs', () => {
  const configPath = path.join(tempDir, 'many-roots.toml');
  const alphaRoot = path.join(tempDir, 'alpha-root');
  const betaRoot = path.join(tempDir, 'beta-root');
  const alphaPath = writeWorkflowPackage(alphaRoot, 'alpha-flow', { name: 'shared-name', description: 'Alpha custom workflow.' });
  const betaPath = writeWorkflowPackage(betaRoot, 'beta-flow', { name: 'beta-workflow', description: 'Beta custom workflow.' });
  const nestedBetaPath = writeWorkflowPackage(betaRoot, 'release/triage', { name: 'release-triage', description: 'Nested beta workflow.' });
  writeFileSync(configPath, workflowConfig([
    { sourceId: 'alpha', path: alphaRoot },
    { sourceId: 'beta', path: betaRoot },
  ]));

  const listed = runCatalog(['list', '--json', '--config', configPath]);
  assert.equal(listed.status, 0, listed.stderr);
  const workflows = JSON.parse(listed.stdout).workflows;
  assert.deepEqual(
    workflows.map((workflow) => [workflow.workflowRef, workflow.sourceId, workflow.rootOrder, workflow.relativePath, workflow.path]),
    [
      ['built-in:dev-harness', 'built-in', 0, 'dev-harness', path.join(root, 'workflows/dev-harness/workflow.toml')],
      ['built-in:research-critic', 'built-in', 0, 'research-critic', path.join(root, 'workflows/research-critic/workflow.toml')],
      ['built-in:workflow-authoring', 'built-in', 0, 'workflow-authoring', path.join(root, 'workflows/workflow-authoring/workflow.json')],
      ['alpha:alpha-flow', 'alpha', 1, 'alpha-flow', alphaPath],
      ['beta:beta-flow', 'beta', 2, 'beta-flow', betaPath],
      ['beta:release/triage', 'beta', 2, 'release/triage', nestedBetaPath],
    ],
  );

  const resolved = runCatalog(['resolve', 'alpha:alpha-flow', '--json', '--config', configPath]);
  assert.equal(resolved.status, 0, resolved.stderr);
  const parsed = JSON.parse(resolved.stdout);
  assert.equal(parsed.status, 'single');
  assert.equal(parsed.candidates[0].workflowRef, 'alpha:alpha-flow');
  assert.equal(parsed.candidates[0].path, alphaPath);

  const nestedResolved = runCatalog(['resolve', 'beta:release/triage', '--json', '--config', configPath]);
  assert.equal(nestedResolved.status, 0, nestedResolved.stderr);
  const nestedParsed = JSON.parse(nestedResolved.stdout);
  assert.equal(nestedParsed.status, 'single');
  assert.equal(nestedParsed.candidates[0].workflowRef, 'beta:release/triage');
  assert.equal(nestedParsed.candidates[0].path, nestedBetaPath);
});

test('workflow catalog reads approved nested TOML roots and expands home paths', () => {
  const homeDir = path.join(tempDir, 'home-path-contract');
  const homeWorkflowsRoot = path.join(homeDir, '.orbita', 'workflows');
  const configPath = path.join(tempDir, 'nested-home-config.toml');
  const workflowPath = writeWorkflowPackage(homeWorkflowsRoot, 'home-flow', { name: 'home-flow', description: 'Home configured workflow.' });
  writeFileSync(configPath, nestedWorkflowConfig([
    { sourceId: 'home-source', path: '~/.orbita/workflows' },
  ]));

  const listed = runCatalog(['list', '--json', '--config', configPath], { env: { HOME: homeDir } });
  assert.equal(listed.status, 0, listed.stderr);
  const customWorkflow = JSON.parse(listed.stdout).workflows.find((workflow) => workflow.workflowRef === 'home-source:home-flow');
  assert.deepEqual(
    {
      sourceId: customWorkflow?.sourceId,
      rootOrder: customWorkflow?.rootOrder,
      workflowRef: customWorkflow?.workflowRef,
      relativePath: customWorkflow?.relativePath,
      path: customWorkflow?.path,
    },
    {
      sourceId: 'home-source',
      rootOrder: 1,
      workflowRef: 'home-source:home-flow',
      relativePath: 'home-flow',
      path: workflowPath,
    },
  );
});

test('workflow catalog returns duplicate display names as ordered ambiguous candidates', () => {
  const configPath = path.join(tempDir, 'duplicate-names.toml');
  const alphaRoot = path.join(tempDir, 'duplicate-alpha');
  const betaRoot = path.join(tempDir, 'duplicate-beta');
  writeWorkflowPackage(alphaRoot, 'alpha-flow', { name: 'duplicate-name', description: 'Alpha duplicate.' });
  writeWorkflowPackage(betaRoot, 'beta-flow', { name: 'duplicate-name', description: 'Beta duplicate.' });
  writeFileSync(configPath, workflowConfig([
    { sourceId: 'alpha-dup', path: alphaRoot },
    { sourceId: 'beta-dup', path: betaRoot },
  ]));

  const resolved = runCatalog(['resolve', 'duplicate-name', '--json', '--config', configPath]);
  assert.equal(resolved.status, 0, resolved.stderr);
  assert.deepEqual(JSON.parse(resolved.stdout).candidates.map((workflow) => workflow.workflowRef), [
    'alpha-dup:alpha-flow',
    'beta-dup:beta-flow',
  ]);
});

test('workflow catalog --workflows-root is an isolated override root', () => {
  const configPath = path.join(tempDir, 'override-ignored-config.toml');
  const configuredRoot = path.join(tempDir, 'configured-root');
  const overrideRoot = path.join(tempDir, 'override-root');
  writeWorkflowPackage(configuredRoot, 'configured-flow', { name: 'configured-flow', description: 'Configured workflow.' });
  const overridePath = writeWorkflowPackage(overrideRoot, 'override-flow', { name: 'override-flow', description: 'Override workflow.' });
  writeFileSync(configPath, workflowConfig([{ sourceId: 'configured', path: configuredRoot }]));

  const listed = runCatalog(['list', '--json', '--config', configPath, '--workflows-root', overrideRoot]);
  assert.equal(listed.status, 0, listed.stderr);
  assert.deepEqual(JSON.parse(listed.stdout).workflows, [
    {
      name: 'override-flow',
      displayName: 'override-flow',
      description: 'Override workflow.',
      sourceId: 'override',
      rootOrder: 0,
      workflowRef: 'override:override-flow',
      relativePath: 'override-flow',
      path: overridePath,
      resolveEligible: true,
    },
  ]);
});

test('workflow catalog rejects invalid configured root identity before listing', () => {
  const configPath = path.join(tempDir, 'invalid-source.toml');
  const customRoot = path.join(tempDir, 'invalid-source-root');
  mkdirSync(customRoot, { recursive: true });
  writeFileSync(configPath, workflowConfig([{ sourceId: 'built-in', path: customRoot }]));

  const listed = runCatalog(['list', '--json', '--config', configPath]);
  assert.equal(listed.status, 1);
  assert.match(listed.stderr, /source_id is reserved: built-in/);
});

test('workflow catalog config errors redact private config and root paths', () => {
  const privateDir = path.join(tempDir, 'private-config-errors');
  const readableRoot = path.join(privateDir, 'readable-root');
  mkdirSync(readableRoot, { recursive: true });
  const cases = [
    {
      name: 'malformed TOML',
      configPath: path.join(privateDir, 'malformed.toml'),
      content: '[[workflow_catalog.roots]]\nsource_id = "bad\n',
      match: /failed to read Orbita config TOML/,
    },
    {
      name: 'unreadable root',
      configPath: path.join(privateDir, 'unreadable.toml'),
      content: nestedWorkflowConfig([{ sourceId: 'missing-root', path: path.join(privateDir, 'missing-root') }]),
      match: /workflow root 'missing-root' is not readable/,
    },
    {
      name: 'duplicate root path',
      configPath: path.join(privateDir, 'duplicate-path.toml'),
      content: nestedWorkflowConfig([
        { sourceId: 'first-root', path: readableRoot },
        { sourceId: 'second-root', path: readableRoot },
      ]),
      match: /duplicate workflow root path for source_id: second-root/,
    },
  ];

  for (const item of cases) {
    writeFileSync(item.configPath, item.content);
    const listed = runCatalog(['list', '--json', '--config', item.configPath]);
    assert.equal(listed.status, 1, item.name);
    assert.match(listed.stderr, item.match, item.name);
    assert.doesNotMatch(listed.stderr, new RegExp(privateDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), item.name);
    assert.doesNotMatch(listed.stderr, new RegExp(item.configPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), item.name);
  }
});

test('workflow catalog read errors redact configured workflow paths', () => {
  const privateDir = path.join(tempDir, 'private-catalog-errors');
  const workflowRoot = path.join(privateDir, 'secret-workflows');
  const workflowDir = path.join(workflowRoot, 'bad-flow');
  const configPath = path.join(privateDir, 'orbita.toml');
  mkdirSync(workflowDir, { recursive: true });
  writeFileSync(path.join(workflowDir, 'workflow.json'), '{ bad json\n');
  writeFileSync(configPath, nestedWorkflowConfig([{ sourceId: 'private-source', path: workflowRoot }]));

  const listed = runCatalog(['list', '--json', '--config', configPath]);

  assert.equal(listed.status, 1);
  assert.match(listed.stderr, /failed to read private-source:bad-flow/);
  assert.doesNotMatch(listed.stderr, new RegExp(privateDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(listed.stderr, new RegExp(configPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('workflow catalog rejects invalid config entry matrix before listing', () => {
  const matrixDir = path.join(tempDir, 'invalid-config-matrix');
  const rootA = path.join(matrixDir, 'root-a');
  const rootB = path.join(matrixDir, 'root-b');
  mkdirSync(rootA, { recursive: true });
  mkdirSync(rootB, { recursive: true });
  const cases = [
    {
      name: 'duplicate source id',
      content: nestedWorkflowConfig([
        { sourceId: 'dup-source', path: rootA },
        { sourceId: 'dup-source', path: rootB },
      ]),
      match: /duplicate workflow root source_id: dup-source/,
    },
    {
      name: 'empty path',
      content: nestedWorkflowConfig([{ sourceId: 'empty-path', path: '' }]),
      match: /workflow root 'empty-path' path is required/,
    },
    {
      name: 'invalid source id',
      content: nestedWorkflowConfig([{ sourceId: 'Invalid_Source', path: rootA }]),
      match: /source_id is invalid: Invalid_Source/,
    },
    {
      name: 'unreadable path',
      content: nestedWorkflowConfig([{ sourceId: 'unreadable-path', path: path.join(matrixDir, 'missing') }]),
      match: /workflow root 'unreadable-path' is not readable/,
    },
  ];

  for (const item of cases) {
    const configPath = path.join(matrixDir, `${item.name.replaceAll(' ', '-')}.toml`);
    writeFileSync(configPath, item.content);
    const listed = runCatalog(['list', '--json', '--config', configPath]);
    assert.equal(listed.status, 1, item.name);
    assert.match(listed.stderr, item.match, item.name);
  }
});

test('custom workflow docs sample smoke uses public CLI lifecycle with isolated runs root', () => {
  const smokeRoot = path.join(tempDir, 'public-cli-smoke');
  const workflowsRoot = path.join(smokeRoot, 'workflows');
  const runsRoot = path.join(smokeRoot, 'runs');
  const configPath = path.join(smokeRoot, 'orbita.toml');
  const runId = `workflow-catalog-smoke-${process.pid}`;
  const workflowPath = writeWorkerWorkflowPackage(workflowsRoot, 'sample-custom-flow', {
    name: 'sample-custom-flow',
    description: 'Sample custom workflow for public CLI smoke.',
  });
  writeFileSync(configPath, nestedWorkflowConfig([{ sourceId: 'sample', path: workflowsRoot }]));

  const env = { ORBITA_CONFIG: configPath, WORKFLOW_RUNS_ROOT: runsRoot };
  const validated = runCli(['skills/orbita/lib/entrypoints/cli/validate-workflow.mjs', workflowPath], { env });
  assert.equal(validated.status, 0, validated.stderr);
  assert.equal(JSON.parse(validated.stdout).workflow, 'sample-custom-flow');

  const listed = runCatalog(['list', '--json', '--config', configPath], { env });
  assert.equal(listed.status, 0, listed.stderr);
  assert.equal(JSON.parse(listed.stdout).workflows.some((workflow) => workflow.workflowRef === 'sample:sample-custom-flow'), true);

  const resolved = runCatalog(['resolve', 'sample:sample-custom-flow', '--json', '--config', configPath], { env });
  assert.equal(resolved.status, 0, resolved.stderr);
  const resolvedWorkflowPath = JSON.parse(resolved.stdout).candidates[0].path;
  assert.equal(resolvedWorkflowPath, workflowPath);

  const created = runCli(['skills/orbita/lib/entrypoints/cli/workflow-runs.mjs', 'create', '--run-id', runId, '--workflow', resolvedWorkflowPath], { env });
  assert.equal(created.status, 0, created.stderr);

  const claimed = runCli(['skills/orbita/lib/entrypoints/cli/workflow-runs.mjs', 'claim', '--run-id', runId, '--print-lease-token'], { env });
  assert.equal(claimed.status, 0, claimed.stderr);
  const leaseToken = claimed.stdout.trim();
  assert.ok(leaseToken.length > 0);

  const next = runCli(['skills/orbita/lib/entrypoints/cli/workflow-runner.mjs', 'next', '--run-id', runId, '--lease-token', leaseToken], { env });
  assert.equal(next.status, 0, next.stderr);
  const nextJson = JSON.parse(next.stdout);
  assert.equal(nextJson.status, 'needs_host_actions');
  assert.equal(nextJson.requests[0].stepId, 'prepare');

  const instructions = runCli(['skills/orbita/lib/entrypoints/cli/workflow-runner.mjs', 'instructions', '--run-id', runId, '--step-id', 'prepare', '--lease-token', leaseToken], { env });
  assert.equal(instructions.status, 0, instructions.stderr);
  assert.match(instructions.stdout, /Prepare the custom workflow smoke/);
  assert.equal(existsSync(path.join(root, 'skills/orbita/.workflow-runs')), false);
});

test('custom workflow docs sample keeps isolated runs root in scope for lifecycle commands', () => {
  const docs = readFileSync(path.join(root, 'skills/orbita/lib/docs/custom-workflow-roots.md'), 'utf8');
  assert.equal(docs.includes('export WORKFLOW_RUNS_ROOT='), true);
  assert.equal(docs.includes('export ORBITA_CONFIG='), true);
  assert.equal(docs.includes('workflow-runs.mjs create --run-id sample-run'), true);
  assert.equal(docs.includes('workflow-runs.mjs claim --run-id sample-run'), true);
  assert.equal(docs.includes('workflow-runner.mjs next --run-id sample-run'), true);
  assert.equal(docs.includes('workflow-runner.mjs instructions --run-id sample-run'), true);
  assert.equal(docs.includes('WORKFLOW_RUNS_ROOT="$(mktemp -d)" ORBITA_CONFIG='), false);
});

test('workflow catalog reports no match for unknown workflow names', () => {
  const result = runCatalog(['resolve', 'not-a-real-workflow', '--json']);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    status: 'none',
    query: 'not-a-real-workflow',
    candidates: [],
  });
});

test('workflow catalog rejects catalog workflows without top-level description', () => {
  const workflowsRoot = path.join(tempDir, 'workflows');
  const workflowDir = path.join(workflowsRoot, 'missing-description');
  mkdirSync(workflowDir, { recursive: true });
  writeFileSync(path.join(workflowDir, 'workflow.json'), `${JSON.stringify({
    name: 'missing-description',
    version: 1,
    start: 'done',
    done: 'done',
    steps: {
      done: { name: 'Done', kind: 'done' },
    },
  }, null, 2)}\n`);

  const result = runCatalog(['list', '--json', '--workflows-root', workflowsRoot]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /workflow-catalog: workflow is missing top-level description/);
});
