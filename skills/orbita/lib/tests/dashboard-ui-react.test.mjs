import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { createRunUpdateQueue } from '../dashboard/ui/dashboardEventQueue.ts';
import {
  buildDashboardViewModel,
  mergeRunUpdate,
  normalizeDashboardSnapshot,
  normalizeRun,
} from '../dashboard/ui/dashboardModel.ts';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDir, '../../../..');
const fixturePath = path.join(testDir, 'fixtures/dashboard-ui/safe-dashboard-dto.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
const uiRoot = path.join(root, 'skills/orbita/lib/dashboard/ui');

test('React dashboard model normalizes safe DTOs for board and drawer rendering', () => {
  const model = normalizeDashboardSnapshot(fixture);
  const view = buildDashboardViewModel(model, 'Approve', fixture.selectedRunId);

  assert.equal(model.runs.length, 5);
  assert.equal(view.visibleRuns.length, 1);
  assert.equal(view.selectedRun?.id, 'run-waiting-1234567890');
  assert.equal(view.selectedRun?.laneId, 'waiting_for_user');
  assert.equal(view.selectedRun?.workflowName, 'dev-harness');
  assert.deepEqual(view.selectedRun?.cursorBranches, ['backend_implementation', 'frontend_implementation']);
  assert.deepEqual(view.selectedRun?.miniMap.map((step) => [step.id, step.state]), [
    ['research', 'completed'],
    ['backend_implementation', 'active'],
    ['frontend_implementation', 'active'],
  ]);
});

test('React dashboard model degrades unknown lanes and omits unsafe fields', () => {
  const run = normalizeRun({
    runId: 'unsafe-lane',
    laneId: 'surprise',
    tokenHash: 'lease-secret',
    owner: 'sergeigarin',
    workflowPath: '/Users/sergeigarin/private/workflow.json',
    cursor: [{ stepId: 'parallel_a' }],
  });
  const json = JSON.stringify(run);

  assert.equal(run.laneId, 'degraded');
  assert.deepEqual(run.cursorBranches, ['parallel_a']);
  assert.doesNotMatch(json, /lease-secret|tokenHash|sergeigarin|\/Users\//);
});

test('React dashboard browser client is API and SSE only', () => {
  const client = readFileSync(path.join(uiRoot, 'dashboardClient.ts'), 'utf8');

  assert.match(client, /\/api\/runs/);
  assert.match(client, /\/api\/events/);
  assert.match(client, /EventSource/);
  assert.doesNotMatch(client, /node:|readFile|writeFile|workflow-runner|lease-token|bind-agent/);
});

test('React dashboard components use React Aria reusable controls and no control affordances', () => {
  const componentSources = [
    'components/DashboardTopbar.tsx',
    'components/RunDetailDrawer.tsx',
    'components/DashboardStates.tsx',
  ].map((relativePath) => readFileSync(path.join(uiRoot, relativePath), 'utf8')).join('\n');

  assert.match(componentSources, /react-aria-components/);
  assert.match(componentSources, /SearchField/);
  assert.match(componentSources, /Button/);
  assert.doesNotMatch(componentSources, /write-output|bind-agent|lease-token|workflow-runner|dragstart|draggable|drop zone/);
});

test('React dashboard source exposes SSE degraded errors while preserving the ready board', () => {
  const appSource = readFileSync(path.join(uiRoot, 'DashboardApp.tsx'), 'utf8');
  const statesSource = readFileSync(path.join(uiRoot, 'components/DashboardStates.tsx'), 'utf8');

  assert.match(appSource, /setDegradedMessage\(event\.message\)/);
  assert.match(appSource, /current\.status === 'ready' \? current/);
  assert.match(appSource, /<DegradedBanner message=\{degradedMessage\} onRefresh=\{refreshSnapshot\}/);
  assert.match(statesSource, /function DegradedBanner/);
  assert.match(statesSource, /role=\"alert\"/);
});

test('React dashboard drawer source handles focus movement, Escape close, and focus restore', () => {
  const appSource = readFileSync(path.join(uiRoot, 'DashboardApp.tsx'), 'utf8');
  const drawerSource = readFileSync(path.join(uiRoot, 'components/RunDetailDrawer.tsx'), 'utf8');

  assert.match(appSource, /drawerRef\.current\?\.focus\(\)/);
  assert.match(appSource, /event\.key !== 'Escape'/);
  assert.match(appSource, /selectedCardRef\.current\?\.focus\(\)/);
  assert.match(drawerSource, /data-run-detail-drawer=\"true\"/);
  assert.match(drawerSource, /tabIndex=\{-1\}/);
});

test('React dashboard large-run model keeps grouping, filtering, selection, and updates bounded', () => {
  const runs = Array.from({ length: 1200 }, (_, index) => ({
    runId: `run-large-${index}`,
    title: index === 777 ? 'Need human approval' : `Run ${index}`,
    workflow: { identity: 'dev-harness' },
    lane: { id: index % 5 === 0 ? 'waiting_for_user' : 'worker_running', label: index % 5 === 0 ? 'Waiting for user' : 'Worker running' },
    cursor: { steps: [`step_${index % 9}`], display: `step_${index % 9}` },
    updatedAt: '2026-07-02T14:20:00.000Z',
    artifacts: [],
  }));
  const model = normalizeDashboardSnapshot({ ...fixture, runs });
  const filtered = buildDashboardViewModel(model, 'human', 'run-large-777');
  const updated = normalizeRun({ ...runs[777], title: 'Need human approval updated' });
  const merged = mergeRunUpdate(model.runs, updated);

  assert.equal(model.runs.length, 1200);
  assert.equal((buildDashboardViewModel(model, '', null).runsByLane.get('worker_running') ?? []).length, 960);
  assert.equal(filtered.visibleRuns.length, 1);
  assert.equal(filtered.selectedRun?.id, 'run-large-777');
  assert.equal(merged.length, 1200);
  assert.equal(merged[777].title, 'Need human approval updated');
});

test('React dashboard SSE update queue coalesces repeated run updates before applying', async () => {
  const applied = [];
  const loaded = [];
  const timers = [];
  const queue = createRunUpdateQueue({
    delayMs: 25,
    setTimer: (callback) => {
      timers.push(callback);
      return timers.length;
    },
    clearTimer: () => {},
    loadRun: async (runId) => {
      loaded.push(runId);
      return normalizeRun({ runId, title: `Updated ${runId}`, lane: { id: 'worker_running', label: 'Worker running' } });
    },
    applyRuns: (runs) => applied.push(runs),
    onError: (error) => assert.fail(`unexpected queue error: ${error}`),
  });

  queue.enqueue('run-large-1');
  queue.enqueue('run-large-1');
  queue.enqueue('run-large-2');
  assert.equal(timers.length, 1);
  await queue.flush();

  assert.deepEqual(loaded, ['run-large-1', 'run-large-2']);
  assert.equal(applied.length, 1);
  assert.deepEqual(applied[0].map((run) => run.id), ['run-large-1', 'run-large-2']);
});

test('React dashboard SSE update queue reports failed detail loads without applying partial runs', async () => {
  const applied = [];
  const errors = [];
  const queue = createRunUpdateQueue({
    delayMs: 25,
    setTimer: (callback) => {
      void callback;
      return 1;
    },
    clearTimer: () => {},
    loadRun: async (runId) => {
      throw new Error(`detail failed for ${runId}`);
    },
    applyRuns: (runs) => applied.push(runs),
    onError: (error, runIds) => errors.push({ message: error.message, runIds }),
  });

  queue.enqueue('run-failing-1');
  queue.enqueue('run-failing-2');
  await queue.flush();

  assert.deepEqual(applied, []);
  assert.deepEqual(errors, [{
    message: 'detail failed for run-failing-1',
    runIds: ['run-failing-1', 'run-failing-2'],
  }]);
});

test('Start routes use the React dashboard instead of placeholder route markup', () => {
  const indexRoute = readFileSync(path.join(root, 'skills/orbita/lib/dashboard/app/src/routes/index.tsx'), 'utf8');
  const dashboardRoute = readFileSync(path.join(root, 'skills/orbita/lib/dashboard/app/src/routes/dashboard.tsx'), 'utf8');

  assert.match(indexRoute, /DashboardApp/);
  assert.match(dashboardRoute, /DashboardApp/);
  assert.doesNotMatch(indexRoute + dashboardRoute, /<p>Read-only workflow board<\/p>/);
});
