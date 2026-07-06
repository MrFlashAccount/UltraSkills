import assert from 'node:assert/strict';
import { readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { get } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { listDashboardRuns, getDashboardRun, startDashboardServer } from '../dashboard/api.mjs';
import { DashboardEventPublisher } from '../dashboard/server/dashboard-event-publisher.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const defaultWorkflow = path.join(root, 'workflows/dev-harness/workflow.toml');
const tempRoots = [];

afterAll(async () => {
  for (const dir of tempRoots) rmSync(dir, { recursive: true, force: true });
});

async function makeRunsRoot(label) {
  const tempRoot = await mkdtemp(path.join(tmpdir(), `orbita-dashboard-${label}-`));
  tempRoots.push(tempRoot);
  const runsRoot = path.join(tempRoot, 'runs');
  await mkdir(runsRoot, { recursive: true });
  return runsRoot;
}

async function writeIndex(runsRoot, runs) {
  await writeFile(path.join(runsRoot, 'runs.json'), `${JSON.stringify({
    schemaVersion: 1,
    topologyVersion: 'workflow-runs-v1',
    runs,
  }, null, 2)}\n`, { mode: 0o600 });
}

async function writeRunState(runsRoot, runId, baton, history = '') {
  const runDir = path.join(runsRoot, runId);
  await mkdir(path.join(runDir, '.workflow-runner'), { recursive: true });
  await writeFile(path.join(runDir, 'baton.json'), `${JSON.stringify(baton, null, 2)}\n`, { mode: 0o600 });
  await writeFile(path.join(runDir, 'history.md'), history, { mode: 0o600 });
}

function indexRun(runId, patch = {}) {
  return {
    runId,
    workflow: { identity: 'dev-harness', path: defaultWorkflow },
    status: 'running',
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: patch.updatedAt ?? '2026-06-01T10:00:00.000Z',
    workerLease: patch.workerLease ?? null,
    title: patch.title,
    summary: patch.summary,
  };
}

function jsonDoesNotContainForbiddenValues(value) {
  const json = JSON.stringify(value);
  assert.doesNotMatch(json, /lease-secret/);
  assert.doesNotMatch(json, /tokenHash/);
  assert.doesNotMatch(json, /user_prompt/);
  assert.doesNotMatch(json, /workerBindings/);
  assert.doesNotMatch(json, /workflow-runner\.mjs['"]?\s+instructions/);
  assert.doesNotMatch(json, /\.workflow-runner\/instructions\/backend_implementation/);
  assert.doesNotMatch(json, /bind-agent/);
  assert.doesNotMatch(json, /preferred agent/i);
  assert.doesNotMatch(json, /\/private\/artifact\.md/);
}

test('dashboard projection exposes safe DTOs with lanes, parallel cursor, minimap, and redacted history', async () => {
  const runsRoot = await makeRunsRoot('projection');
  const runId = `dashboard-projection-${process.pid}`;
  await writeIndex(runsRoot, {
    [runId]: indexRun(runId, {
      title: 'Dashboard run',
      workerLease: {
        tokenHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        tokenEpoch: 1,
        leaseExpiresAt: '2026-06-01T10:05:00.000Z',
      },
    }),
  });
  await writeRunState(runsRoot, runId, {
    cursor: ['backend_implementation', 'frontend_implementation'],
    status: 'running',
    workerBindings: { backend: 'preferred-agent-1' },
    user_prompt: 'private prompt must not leave state',
    state: {
      artifacts: [{
        producerStepId: 'backend_implementation',
        artifact: {
          id: 'backend-handoff',
          content_type: 'text/markdown',
          path: '/private/artifact.md',
          summary: 'Backend handoff',
        },
      }],
      results: [{ type: 'decision', summary: 'Safe result summary', ref: 'R1' }],
      backend_implementation: { outcome: 'implemented' },
    },
  }, [
    'visible line',
    "bun workflow-runner.mjs instructions --run-id secret --lease-token lease-secret",
    'WORKFLOW_RUN_TOKEN=lease-secret bind-agent preferred agent',
    'kept line',
  ].join('\n'));

  const run = await getDashboardRun({
    runsRoot,
    runId,
    now: () => new Date('2026-06-01T10:01:00.000Z'),
  });

  assert.equal(run.runId, runId);
  assert.deepEqual(run.cursor, {
    kind: 'parallel',
    steps: ['backend_implementation', 'frontend_implementation'],
    display: 'backend_implementation + frontend_implementation',
  });
  assert.equal(run.lane.id, 'worker_running');
  assert.equal(run.occupancy.state, 'occupied');
  assert.equal(run.artifacts[0].id, 'backend-handoff');
  assert.equal('path' in run.artifacts[0], false);
  assert.deepEqual(run.miniMap.currentSteps, ['backend_implementation', 'frontend_implementation']);
  assert.deepEqual(run.miniMap.completedSteps, ['backend_implementation']);
  assert.deepEqual(run.historyExcerpt.lines, ['visible line', 'kept line']);
  jsonDoesNotContainForbiddenValues(run);
});

test('dashboard projection treats resolved recoveries as worker continuation, not blocked', async () => {
  const runsRoot = await makeRunsRoot('resolved-recovery');
  const unresolvedId = `dashboard-unresolved-recovery-${process.pid}`;
  const resolvedId = `dashboard-resolved-recovery-${process.pid}`;
  await writeIndex(runsRoot, {
    [unresolvedId]: indexRun(unresolvedId, { title: 'Unresolved recovery' }),
    [resolvedId]: indexRun(resolvedId, { title: 'Resolved recovery' }),
  });
  const recovery = {
    summary: 'Need approval before continuing.',
    source_step_id: 'backend_implementation',
    needed: 'Approve the smallest recovery question.',
  };
  await writeRunState(runsRoot, unresolvedId, {
    cursor: 'backend_implementation',
    status: 'running',
    recoverableWorkerBlockers: { backend_implementation: recovery },
    state: { artifacts: [], results: [] },
  });
  await writeRunState(runsRoot, resolvedId, {
    cursor: 'backend_implementation',
    status: 'running',
    recoverableWorkerBlockers: {
      backend_implementation: {
        ...recovery,
        resolution: {
          summary: 'Approval was granted.',
          decision: 'Proceed with the smallest recovery question approved.',
        },
      },
    },
    state: { artifacts: [], results: [] },
  });

  const runs = await listDashboardRuns({ runsRoot });
  const byId = new Map(runs.map((run) => [run.runId, run]));

  assert.equal(byId.get(unresolvedId).lane.id, 'blocked');
  assert.equal(byId.get(resolvedId).lane.id, 'worker_running');
});

test('dashboard list isolates per-run read failures as degraded without hiding healthy runs', async () => {
  const runsRoot = await makeRunsRoot('degraded');
  const healthyId = `dashboard-healthy-${process.pid}`;
  const corruptId = `dashboard-corrupt-${process.pid}`;
  await writeIndex(runsRoot, {
    [healthyId]: indexRun(healthyId, { title: 'Healthy', updatedAt: '2026-06-01T10:02:00.000Z' }),
    [corruptId]: indexRun(corruptId, { title: 'Corrupt', updatedAt: '2026-06-01T10:01:00.000Z' }),
  });
  await writeRunState(runsRoot, healthyId, {
    cursor: 'approval_gate',
    status: 'running',
    state: { artifacts: [], results: [] },
  });
  await mkdir(path.join(runsRoot, corruptId), { recursive: true });
  await writeFile(path.join(runsRoot, corruptId, 'baton.json'), '{not json', { mode: 0o600 });

  const runs = await listDashboardRuns({ runsRoot });
  const byId = new Map(runs.map((run) => [run.runId, run]));

  assert.equal(byId.get(healthyId).lane.id, 'waiting_for_user');
  assert.equal(byId.get(corruptId).lane.id, 'degraded');
  assert.equal(byId.get(corruptId).degraded.reason, 'read_failed');
  assert.equal(runs.length, 2);
});

test('dashboard observer rebuilds read model from durable state after restart', async () => {
  const runsRoot = await makeRunsRoot('restart');
  const runId = `dashboard-restart-${process.pid}`;
  await writeIndex(runsRoot, { [runId]: indexRun(runId, { title: 'Restarted' }) });
  await writeRunState(runsRoot, runId, {
    cursor: 'done_step',
    status: 'done',
    state: { artifacts: [], results: [] },
  });

  const first = await listDashboardRuns({ runsRoot });
  const second = await listDashboardRuns({ runsRoot });

  assert.deepEqual(second, first);
  assert.equal(second[0].lane.id, 'done');
});

test('dashboard event publisher emits changed snapshots through polling without requiring backpressure', async () => {
  let version = 0;
  const publisher = new DashboardEventPublisher({
    pollMs: 10,
    snapshot: async () => [{ runId: `run-${version}` }],
  });
  const events = [];
  const unsubscribe = publisher.subscribe((event) => events.push(event));
  await publisher.refresh();
  version = 1;
  await publisher.refresh();
  const lateEvents = [];
  const unsubscribeLate = publisher.subscribe((event) => lateEvents.push(event));
  unsubscribe();
  unsubscribeLate();
  publisher.close();

  assert.equal(events.length, 2);
  assert.equal(events[0].data[0].runId, 'run-0');
  assert.equal(events[1].data[0].runId, 'run-1');
  assert.deepEqual(lateEvents[0].data, [{ runId: 'run-1' }]);
});

function readSseEvent(url) {
  return new Promise((resolve, reject) => {
    const request = get(url, (response) => {
      let body = '';
      response.on('data', (chunk) => {
        body += chunk.toString('utf8');
        if (body.includes('\n\n')) {
          request.destroy();
          resolve({ statusCode: response.statusCode, body });
        }
      });
    });
    request.on('error', (error) => {
      if (bodyContainsEvent(error)) return;
      reject(error);
    });
  });
}

function bodyContainsEvent(error) {
  return error?.code === 'ECONNRESET';
}

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const filePath = path.join(dir, name);
    if (statSync(filePath).isDirectory()) return sourceFiles(filePath);
    return /\.(?:mjs|js|ts|tsx)$/.test(name) ? [filePath] : [];
  });
}

test('dashboard local server exposes list, detail, events, and static surfaces', async () => {
  const runsRoot = await makeRunsRoot('server');
  const runId = `dashboard-server-${process.pid}`;
  await writeIndex(runsRoot, { [runId]: indexRun(runId, { title: 'Server run' }) });
  await writeRunState(runsRoot, runId, {
    cursor: 'backend_implementation',
    status: 'running',
    state: { artifacts: [], results: [] },
  });

  const dashboard = await startDashboardServer({ runsRoot, pollMs: 25 });
  try {
    const listResponse = await fetch(`${dashboard.url}/api/runs`);
    assert.equal(listResponse.status, 200);
    assert.equal((await listResponse.json()).runs[0].runId, runId);

    const detailResponse = await fetch(`${dashboard.url}/api/runs/${encodeURIComponent(runId)}`);
    assert.equal(detailResponse.status, 200);
    assert.equal((await detailResponse.json()).run.runId, runId);

    const staticResponse = await fetch(`${dashboard.url}/`);
    assert.equal(staticResponse.status, 200);
    const staticHtml = await staticResponse.text();
    assert.match(staticHtml, /Orbita Dashboard/);
    assert.doesNotMatch(staticHtml, /\/dashboard\/client\.js|\/dashboard\/render\.mjs|renderDashboardShell|start-client\.js/);

    const dashboardAppResponse = await fetch(`${dashboard.url}/dashboard`);
    assert.equal(dashboardAppResponse.status, 200);
    assert.match(await dashboardAppResponse.text(), /Orbita Dashboard/);

    const sse = await readSseEvent(`${dashboard.url}/api/events`);
    assert.equal(sse.statusCode, 200);
    assert.match(sse.body, /event: dashboard\.snapshot/);
    assert.match(sse.body, new RegExp(runId));

    const aliasListResponse = await fetch(`${dashboard.url}/api/dashboard/runs`);
    assert.equal(aliasListResponse.status, 404);
  } finally {
    await dashboard.close();
  }
});

test('dashboard API and server redact corrupt runs index paths', async () => {
  const runsRoot = await makeRunsRoot('redaction');
  await writeFile(path.join(runsRoot, 'runs.json'), '{not json\n', { mode: 0o600 });

  await assert.rejects(
    () => listDashboardRuns({ runsRoot }),
    (error) => {
      assert.match(error.message, /workflow runs index/);
      assert.doesNotMatch(error.message, /runs\.json/);
      assert.doesNotMatch(error.message, new RegExp(runsRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      return true;
    },
  );

  const dashboard = await startDashboardServer({ runsRoot, pollMs: 25 });
  try {
    const response = await fetch(`${dashboard.url}/api/runs`);
    assert.equal(response.status, 500);
    const payload = await response.json();
    assert.match(payload.error, /workflow runs index/);
    assert.doesNotMatch(payload.error, /runs\.json/);
    assert.doesNotMatch(payload.error, new RegExp(runsRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  } finally {
    await dashboard.close();
  }
});

test('dashboard SSE error events redact corrupt runs index paths', async () => {
  const runsRoot = await makeRunsRoot('sse-redaction');
  await writeFile(path.join(runsRoot, 'runs.json'), '{not json\n', { mode: 0o600 });
  const runsRootPattern = new RegExp(runsRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const dashboard = await startDashboardServer({ runsRoot, pollMs: 25 });
  try {
    const sse = await readSseEvent(`${dashboard.url}/api/events`);
    assert.equal(sse.statusCode, 200);
    assert.match(sse.body, /event: dashboard\.error/);
    assert.match(sse.body, /workflow runs index/);
    assert.doesNotMatch(sse.body, /runs\.json/);
    assert.doesNotMatch(sse.body, runsRootPattern);

    const aliasResponse = await fetch(`${dashboard.url}/api/dashboard/events`);
    assert.equal(aliasResponse.status, 404);
  } finally {
    await dashboard.close();
  }
});

test('dashboard unknown app asset paths do not expose local paths', async () => {
  const runsRoot = await makeRunsRoot('static-redaction');
  await writeIndex(runsRoot, {});
  const dashboard = await startDashboardServer({ runsRoot, pollMs: 25 });
  try {
    const response = await fetch(`${dashboard.url}/dashboard/missing.js`);
    assert.equal(response.status, 404);
    assert.doesNotMatch(await response.text(), new RegExp(runsRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  } finally {
    await dashboard.close();
  }
});

test('dashboard backend source does not import or call workflow runner control surfaces', () => {
  const dashboardRoot = path.join(root, 'skills/orbita/lib/dashboard');
  const entrypoint = path.join(root, 'skills/orbita/lib/entrypoints/api/dashboard.mjs');
  const files = [
    entrypoint,
    ...sourceFiles(path.join(dashboardRoot, 'app')),
    ...sourceFiles(path.join(dashboardRoot, 'contracts')),
    ...sourceFiles(path.join(dashboardRoot, 'projection')),
    ...sourceFiles(path.join(dashboardRoot, 'server')),
  ];
  const source = files.map((file) => readFileSync(file, 'utf8')).join('\n');

  assert.doesNotMatch(source, /lease-authority/);
  assert.doesNotMatch(source, /runner-command-builder/);
  assert.doesNotMatch(source, /PersistedRunStateWriter/);
  assert.doesNotMatch(source, /claimWorkflowRun|heartbeatWorkflowRun|continueRun|runNext/);
  assert.doesNotMatch(source, /workflow-runner\.mjs['"]?\s+(next|continue|write-output|bind-agent)\b/);
});
