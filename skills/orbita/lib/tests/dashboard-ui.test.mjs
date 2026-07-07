import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { startDashboardServer } from '../dashboard/server/dashboard-server.mjs';
import { dashboardLanes } from '../dashboard/ui/constants.mjs';
import { nextSelectedRunId } from '../dashboard/ui/model.mjs';
import { normalizeRuns, renderDashboard, renderDashboardShell } from '../dashboard/ui/render.mjs';

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
  const client = readFileSync(path.join(uiRoot, 'client.js'), 'utf8');

  assert.match(client, /\/api\/runs/);
  assert.match(client, /\/api\/events/);
  assert.match(client, /redactPrivateText\(error\.message\)/);
  assert.match(client, /target\.textContent = state\.readError/);
  assert.match(client, /state\.selectionDismissed = true/);
  assert.match(client, /nextSelectedRunId/);
  assert.doesNotMatch(client, /\/api\/dashboard\//);
  assert.doesNotMatch(client, /updateSelection/);
  assert.match(client, /EventSource/);
  assert.doesNotMatch(client, /dashboard\.run_updated'[\s\S]{0,400}selectRun/);
  assert.equal(/\bnode:fs\b|\bfs\.|readFile|writeFile|workflow-runner|lease-token/.test(client), false);
  assert.equal(/dragstart|drop|draggable/.test(client), false);
});

test('dashboard drawer can close without selecting the first run again', () => {
  const html = renderDashboard({ ...fixture, selectedRunId: null });

  assert.match(html, /Select a run to inspect read-only details/);
  assert.doesNotMatch(html, /aria-current="true"/);
});

test('dashboard selection model preserves a user-closed drawer across refreshes', () => {
  const selectedOnInitialLoad = nextSelectedRunId({
    currentSelectedRunId: null,
    runs: fixture.runs,
    hasLoadedRuns: false,
    selectionDismissed: false,
  });
  const selectedAfterCloseRefresh = nextSelectedRunId({
    currentSelectedRunId: null,
    runs: fixture.runs,
    hasLoadedRuns: true,
    selectionDismissed: true,
  });
  const selectedAfterSseSnapshot = nextSelectedRunId({
    currentSelectedRunId: null,
    runs: fixture.runs,
    hasLoadedRuns: true,
    selectionDismissed: false,
  });

  assert.equal(selectedOnInitialLoad, fixture.runs[0].runId);
  assert.equal(selectedAfterCloseRefresh, null);
  assert.equal(selectedAfterSseSnapshot, null);
});

test('dashboard drawer exposes a read-only close utility', () => {
  const html = renderDashboard(fixture);

  assert.match(html, /data-drawer-close/);
  assert.match(html, /aria-label="Close run details"/);
});

test('dashboard search filters board cards from safe DTO state', () => {
  const html = renderDashboard({ ...fixture, searchQuery: 'Backend observer' });

  assert.match(html, /Backend observer daemon/);
  assert.doesNotMatch(html, /Approve implementation plan/);
  assert.match(html, /value="Backend observer"/);
});

test('dashboard renders a bounded lane card window for large run lists', () => {
  const manyRuns = Array.from({ length: 1000 }, (_, index) => ({
    ...fixture.runs[0],
    runId: `run-waiting-${String(index).padStart(4, '0')}`,
    title: `Waiting run ${index}`,
  }));
  const html = renderDashboard({
    ...fixture,
    runs: manyRuns,
    selectedRunId: 'run-waiting-0999',
  });

  assert.equal((html.match(/<article class="run-card/g) ?? []).length, 80);
  assert.match(html, /1000 runs/);
  assert.match(html, /Showing visible card window: 80 of 1000; selected run is pinned in view\./);
  assert.match(html, /Waiting run 999/);
});

test('dashboard observer notice redacts local paths', () => {
  const html = renderDashboard({ ...fixture, readError: 'failed to read /Users/sergeygarin/private/state.json with token fake-secret-token-value-1234567890' });

  assert.match(html, /Observer degraded/);
  assert.match(html, /\[local path\]/);
  assert.match(html, /\[private token\]/);
  assert.doesNotMatch(html, /\/Users\/sergeygarin/);
  assert.doesNotMatch(html, /fake-secret-token-value/);
});

test('dashboard style follows the DESIGN token baseline', () => {
  const css = readFileSync(path.join(uiRoot, 'style.css'), 'utf8');

  for (const color of ['#14131A', '#191720', '#201D29', '#292632', '#332F40', '#CBA6F7']) {
    assert.match(css, new RegExp(color, 'i'));
  }
  assert.match(css, /grid-auto-flow: column/);
  assert.match(css, /prefers-reduced-motion/);
});

test('dashboard run normalization degrades unknown lanes instead of crashing', () => {
  const [run] = normalizeRuns([{ id: 'unsafe-lane', laneId: 'unexpected', cursor: [{ stepId: 'parallel_a' }] }]);

  assert.equal(run.laneId, 'degraded');
  assert.deepEqual(run.cursorBranches, ['parallel_a']);
});

test('dashboard server root loads the implemented UI assets', async () => {
  const dashboard = await startDashboardServer({ staticRoot: uiRoot, pollMs: 1000 });
  try {
    const rootResponse = await fetch(`${dashboard.url}/`);
    const rootHtml = await rootResponse.text();
    assert.equal(rootResponse.status, 200);
    assert.match(rootHtml, /\/dashboard\/style\.css/);
    assert.match(rootHtml, /\/dashboard\/client\.js/);

    const clientResponse = await fetch(`${dashboard.url}/dashboard/client.js`);
    assert.equal(clientResponse.status, 200);
    assert.match(await clientResponse.text(), /\/api\/runs/);

    const renderResponse = await fetch(`${dashboard.url}/dashboard/render.mjs`);
    assert.equal(renderResponse.status, 200);
    assert.match(await renderResponse.text(), /renderDashboard/);
  } finally {
    await dashboard.close();
  }
});
