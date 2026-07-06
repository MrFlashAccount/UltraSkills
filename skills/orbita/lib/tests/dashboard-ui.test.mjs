import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { startDashboardServer } from '../dashboard/server/dashboard-server.mjs';
import { dashboardLanes, dashboardWindowSize } from '../dashboard/ui/constants.ts';
import { createDashboardViewModel, normalizeRuns, toDashboardSnapshot } from '../dashboard/ui/contracts.ts';
import { clearDrawerFocusIntent, focusIntentForRunSelection, shouldFocusDrawerControl } from '../dashboard/ui/interaction.ts';
import { renderDashboard, renderDashboardShell } from '../dashboard/ui/render.mjs';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(testDir, 'fixtures/dashboard-ui/safe-dashboard-dto.json');
const uiRoot = path.join(testDir, '../dashboard/ui');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));

test('dashboard UI renders the board-first lane order from safe DTOs', () => {
  const html = renderDashboard(fixture);
  const laneIndexes = dashboardLanes.map((lane) => html.indexOf(`id="lane-${lane.id}"`));

  assert.deepEqual(laneIndexes.every((index) => index >= 0), true);
  assert.deepEqual([...laneIndexes].sort((a, b) => a - b), laneIndexes);
  assert.match(html, /Approve implementation plan/);
  assert.match(html, /Backend observer daemon/);
  assert.match(html, /Workflow complete/);
  assert.match(html, /data-read-only="true"/);
});

test('dashboard UI normalizes actual backend projection DTOs', () => {
  const [run] = normalizeRuns([fixture.runs[0]]);

  assert.equal(run.id, 'run-waiting-1234567890');
  assert.equal(run.laneId, 'waiting_for_user');
  assert.equal(run.workflowName, 'dev-harness');
  assert.equal(run.stepId, 'backend_implementation + frontend_implementation');
  assert.deepEqual(run.cursorBranches, ['backend_implementation', 'frontend_implementation']);
  assert.deepEqual(run.miniMap.map((step) => [step.id, step.state]), [
    ['research', 'completed'],
    ['backend_implementation', 'active'],
    ['frontend_implementation', 'active'],
  ]);
  assert.deepEqual(run.historyExcerpt.map((entry) => entry.summary), [
    'Runner requested host approval.',
    'Worker output accepted.',
  ]);
});

test('dashboard TypeScript view model consumes only allowlisted DTO fields', () => {
  const snapshot = toDashboardSnapshot(fixture);
  const viewModel = createDashboardViewModel(snapshot);

  assert.equal(snapshot.runs.length, fixture.runs.length);
  assert.equal(viewModel.rootLabel, '~/.orbita/workflow-runs/v1');
  assert.equal(viewModel.selectedRun?.id, 'run-waiting-1234567890');
  assert.equal(viewModel.countsByLane.get('waiting_for_user'), 1);
  assert.equal(JSON.stringify(viewModel).includes('/Users/sergeigarin/private/workflow.json'), false);
});

test('dashboard UI shows parallel cursor chips on cards and drawer details', () => {
  const html = renderDashboard(fixture);

  assert.match(html, /aria-label="Active cursor branches"/);
  assert.match(html, /<code>backend_implementation<\/code>/);
  assert.match(html, /<code>frontend_implementation<\/code>/);
  assert.match(html, /Workflow mini-map/);
  assert.match(html, /data-secondary-surface="mini-map"/);
});

test('dashboard drawer renders artifacts, bounded history, and degraded diagnostics', () => {
  const selectedHtml = renderDashboard(fixture);
  const degradedHtml = renderDashboard({ ...fixture, selectedRunId: 'run-degraded-444444' });

  assert.match(selectedHtml, /Artifacts/);
  assert.match(selectedHtml, /planning_draft/);
  assert.match(selectedHtml, /Bounded history excerpt/);
  assert.match(selectedHtml, /Runner requested host approval/);
  assert.match(degradedHtml, /Degraded diagnostics/);
  assert.match(degradedHtml, /state file could not be parsed/);
});

test('dashboard UI exposes no runner control affordance text', () => {
  const html = renderDashboardShell(fixture).toLowerCase();
  const forbiddenControlWords = [
    'write-output',
    'bind-agent',
    'lease-token',
    'run_worker',
    'workflow-runner',
    'drag handle',
    'drop zone',
    'manual movement',
  ];

  for (const word of forbiddenControlWords) {
    assert.equal(html.includes(word), false, `${word} must not appear in browser UI`);
  }
});

test('dashboard UI does not render unallowlisted local paths or user context fields', () => {
  const unsafeSnapshot = {
    runs: [{
      ...fixture.runs[0],
      workflowPath: '/Users/sergeigarin/private/workflow.json',
      owner: 'sergeigarin',
      currentRequestSummary: 'private request details',
      tokenHash: 'lease-secret',
    }],
    selectedRunId: fixture.runs[0].runId,
  };
  const html = renderDashboard(unsafeSnapshot);
  const fixtureText = readFileSync(fixturePath, 'utf8');

  assert.doesNotMatch(fixtureText, /\/Users\/|workflowPath|owner|currentRequestSummary|tokenHash|lease-secret/);
  assert.doesNotMatch(html, /\/Users\/|sergeigarin|private request details|tokenHash|lease-secret/);
});

test('dashboard browser client consumes API and SSE surfaces without filesystem access', () => {
  const api = readFileSync(path.join(uiRoot, 'api.ts'), 'utf8');
  const app = readFileSync(path.join(uiRoot, 'App.tsx'), 'utf8');
  const main = readFileSync(path.join(uiRoot, 'main.tsx'), 'utf8');

  assert.match(api, /\/api\/runs/);
  assert.match(api, /\/api\/events/);
  assert.match(api, /toDashboardSnapshot\(await response\.json\(\)\)/);
  assert.match(api, /EventSource/);
  assert.match(app, /loadDashboardSnapshot/);
  assert.match(main, /createRoot/);
  assert.doesNotMatch(`${api}\n${app}\n${main}`, /\/api\/dashboard\//);
  assert.equal(/\bnode:fs\b|\bfs\.|readFile|writeFile|workflow-runner|lease-token/.test(`${api}\n${app}\n${main}`), false);
  assert.equal(/dragstart|drop|draggable/.test(`${api}\n${app}\n${main}`), false);
});

test('dashboard drawer can close without selecting the first run again', () => {
  const html = renderDashboard({ ...fixture, selectedRunId: null });

  assert.match(html, /Select a run to inspect read-only details/);
  assert.doesNotMatch(html, /aria-current="true"/);
});

test('dashboard drawer focus intent is created only by explicit run selection', () => {
  const snapshot = toDashboardSnapshot(fixture);
  const viewModel = createDashboardViewModel(snapshot);

  assert.equal(viewModel.selectedRun?.id, 'run-waiting-1234567890');
  assert.equal(shouldFocusDrawerControl({
    runId: viewModel.selectedRun?.id ?? null,
    focusIntent: null,
  }), false);

  const focusIntent = focusIntentForRunSelection('run-waiting-1234567890');
  assert.equal(shouldFocusDrawerControl({
    runId: viewModel.selectedRun?.id ?? null,
    focusIntent,
  }), true);
  assert.equal(shouldFocusDrawerControl({
    runId: 'run-worker-222222',
    focusIntent,
  }), false);
  assert.equal(clearDrawerFocusIntent(), null);
});

test('dashboard search filters board cards from safe DTO state', () => {
  const html = renderDashboard({ ...fixture, searchQuery: 'Backend observer' });
  const snapshot = toDashboardSnapshot({ ...fixture, searchQuery: 'Backend observer' });
  const viewModel = createDashboardViewModel(snapshot);

  assert.match(html, /Backend observer daemon/);
  assert.doesNotMatch(html, /Approve implementation plan/);
  assert.match(html, /value="Backend observer"/);
  assert.deepEqual(viewModel.runs.map((run) => run.title), ['Backend observer daemon']);
});

test('dashboard React source uses React Aria primitives, CSS Modules, and drawer focus handling', () => {
  const dashboard = readFileSync(path.join(uiRoot, 'Dashboard.tsx'), 'utf8');
  const app = readFileSync(path.join(uiRoot, 'App.tsx'), 'utf8');

  assert.match(dashboard, /from 'react-aria-components'/);
  assert.match(dashboard, /<Button/);
  assert.match(dashboard, /<SearchField/);
  assert.match(dashboard, /Dashboard\.module\.css/);
  assert.match(dashboard, /data-read-only="true"/);
  assert.match(dashboard, /onKeyDown/);
  assert.match(dashboard, /Escape/);
  assert.match(app, /lastSelectedRunId/);
  assert.match(app, /\.focus\(\)/);
  assert.match(dashboard, /aria-label="Close run details"/);
  assert.match(dashboard, /closeButtonRef\.current\?\.focus\(\)/);
  assert.doesNotMatch(dashboard, /dangerouslySetInnerHTML|innerHTML/);
});

test('dashboard CSS Module follows the DESIGN token baseline', () => {
  const css = readFileSync(path.join(uiRoot, 'Dashboard.module.css'), 'utf8');

  for (const color of ['#14131A', '#191720', '#201D29', '#292632', '#332F40', '#CBA6F7']) {
    assert.match(css, new RegExp(color, 'i'));
  }
  assert.match(css, /grid-auto-flow: column/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /max-height: calc\(100vh - 136px\)/);
});

test('dashboard TypeScript no-any check surface covers UI source', () => {
  const tsconfig = JSON.parse(readFileSync(path.join(uiRoot, 'tsconfig.json'), 'utf8'));
  const sourceFiles = [
    'types.ts',
    'constants.ts',
    'contracts.ts',
    'interaction.ts',
    'api.ts',
    'Dashboard.tsx',
    'App.tsx',
    'main.tsx',
    'route.tsx',
  ];
  const source = sourceFiles.map((file) => readFileSync(path.join(uiRoot, file), 'utf8')).join('\n');

  assert.equal(tsconfig.compilerOptions.strict, true);
  assert.equal(tsconfig.compilerOptions.noImplicitAny, true);
  assert.deepEqual(tsconfig.include, ['./**/*.ts', './**/*.tsx', './**/*.d.ts']);
  assert.doesNotMatch(source, /\bany\b|as unknown as|@ts-ignore|@ts-expect-error/);
});

test('dashboard run normalization degrades unknown lanes instead of crashing', () => {
  const [run] = normalizeRuns([{ id: 'unsafe-lane', laneId: 'unexpected', cursor: [{ stepId: 'parallel_a' }] }]);

  assert.equal(run.laneId, 'degraded');
  assert.deepEqual(run.cursorBranches, ['parallel_a']);
});

test('dashboard view model supports 1000+ runs with per-lane windowing source', () => {
  const runs = Array.from({ length: 1005 }, (_, index) => ({
    ...fixture.runs[index % fixture.runs.length],
    runId: `run-${String(index).padStart(4, '0')}`,
    lane: { id: 'worker_running', label: 'Worker running' },
  }));
  const snapshot = toDashboardSnapshot({ ...fixture, runs });
  const viewModel = createDashboardViewModel(snapshot);
  const dashboard = readFileSync(path.join(uiRoot, 'Dashboard.tsx'), 'utf8');

  assert.equal(viewModel.runs.length, 1005);
  assert.equal(viewModel.visibleRunsByLane.get('worker_running').length, 1005);
  assert.equal(dashboardWindowSize, 80);
  assert.match(dashboard, /runs\.slice\(0, dashboardWindowSize\)/);
});

test('dashboard server root loads the implemented UI assets', async () => {
  const dashboard = await startDashboardServer({ pollMs: 1000 });
  try {
    const rootResponse = await fetch(`${dashboard.url}/`);
    const rootHtml = await rootResponse.text();
    assert.equal(rootResponse.status, 200);
    assert.match(rootHtml, /orbita-dashboard-root/);
    assert.match(rootHtml, /\/dashboard\/assets\/index-[A-Za-z0-9_-]+\.js/);
    assert.match(rootHtml, /\/dashboard\/assets\/index-[A-Za-z0-9_-]+\.css/);
    assert.doesNotMatch(rootHtml, /\/dashboard\/client\.js|\/dashboard\/style\.css|\/dashboard\/render\.mjs/);
    assert.doesNotMatch(rootHtml, /\.tsx|main\.tsx/);

    const assetPath = rootHtml.match(/\/dashboard\/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0];
    assert.ok(assetPath);
    const clientResponse = await fetch(`${dashboard.url}${assetPath}`);
    assert.equal(clientResponse.status, 200);
    assert.match(await clientResponse.text(), /\/api\/runs/);

    const cssPath = rootHtml.match(/\/dashboard\/assets\/index-[A-Za-z0-9_-]+\.css/)?.[0];
    assert.ok(cssPath);
    const cssResponse = await fetch(`${dashboard.url}${cssPath}`);
    assert.equal(cssResponse.status, 200);
    assert.match(await cssResponse.text(), /grid-auto-flow:\s*column/);
  } finally {
    await dashboard.close();
  }
});
