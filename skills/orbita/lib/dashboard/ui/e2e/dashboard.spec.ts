import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { buildSnapshot, detailFor } from './fixtures';

const proofDir = new URL('./proof/', import.meta.url).pathname;

async function mockDashboard(page: Page, distribution: 'balanced' | 'waiting' | 'done' = 'balanced') {
  const snapshot = buildSnapshot(1_000, distribution);
  await installStableEvents(page);
  await mockSnapshot(page, snapshot);
  return snapshot;
}

async function installStableEvents(page: Page) {
  await page.addInitScript(() => {
    const eventSources: EventTarget[] = [];
    class StableEventSource extends EventTarget {
      static readonly OPEN = 1;
      readonly OPEN = 1;
      readonly CONNECTING = 0;
      readonly CLOSED = 2;
      readyState = 1;
      url: string;
      withCredentials = false;
      onopen: ((event: Event) => void) | null = null;
      onerror = null;
      onmessage = null;
      constructor(url: string | URL) { super(); this.url = String(url); eventSources.push(this); setTimeout(() => this.onopen?.(new Event('open')), 0); }
      close() { this.readyState = 2; }
    }
    Object.defineProperty(window, 'EventSource', { value: StableEventSource });
    Object.defineProperty(window, '__orbitaEventSources', { value: eventSources });
    Object.defineProperty(window, '__orbitaLongTasks', { value: [] as number[] });
    Object.defineProperty(window, '__orbitaSnapshotResponseAt', { value: 0, writable: true });
    Object.defineProperty(window, '__orbitaFetchCounts', { value: { snapshot: 0, detail: 0 } });
    Object.defineProperty(window, '__orbitaExpectedLane', { value: '', writable: true });
    Object.defineProperty(window, '__orbitaExpectedTitle', { value: '', writable: true });
    Object.defineProperty(window, '__orbitaReconciliationLatency', { value: Number.POSITIVE_INFINITY, writable: true });
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await nativeFetch(...args);
      const requestUrl = String(args[0] instanceof Request ? args[0].url : args[0]);
      const counts = (window as unknown as { __orbitaFetchCounts: { snapshot: number; detail: number } }).__orbitaFetchCounts;
      if (requestUrl.endsWith('/api/dashboard/v1/runs')) counts.snapshot += 1;
      else if (/\/api\/dashboard\/v1\/runs\/[^/]+$/u.test(requestUrl)) counts.detail += 1;
      if (requestUrl.endsWith('/api/dashboard/v1/runs') && response.ok) (window as unknown as { __orbitaSnapshotResponseAt: number }).__orbitaSnapshotResponseAt = performance.now();
      return response;
    };
    window.addEventListener('DOMContentLoaded', () => {
      new MutationObserver(() => {
        const state = window as unknown as { __orbitaExpectedLane: string; __orbitaExpectedTitle: string; __orbitaSnapshotResponseAt: number; __orbitaReconciliationLatency: number };
        if (!state.__orbitaExpectedLane) return;
        const card = [...document.querySelectorAll<HTMLElement>('.run-card')].find((element) => element.getAttribute('aria-label')?.startsWith(state.__orbitaExpectedTitle));
        if (card?.closest<HTMLElement>('.lane')?.dataset.lane !== state.__orbitaExpectedLane) return;
        const validatedAt = performance.getEntriesByName('orbita-snapshot-validated').at(-1)?.startTime;
        if (validatedAt == null) return;
        state.__orbitaReconciliationLatency = performance.now() - validatedAt;
        state.__orbitaExpectedLane = '';
      }).observe(document.body, { childList: true, subtree: true });
    }, { once: true });
    try {
      new PerformanceObserver((list) => {
        const durations = (window as unknown as { __orbitaLongTasks: number[] }).__orbitaLongTasks;
        for (const entry of list.getEntries()) durations.push(entry.duration);
      }).observe({ type: 'longtask', buffered: true });
    } catch {}
  });
}

async function emitInvalidations(page: Page, firstChangeId: number, count: number, reason: 'snapshot_changed' | 'observer_stale' | 'observer_recovered' = 'snapshot_changed') {
  await page.evaluate(async ({ firstChangeId, count, reason }) => {
    const source = (window as unknown as { __orbitaEventSources: EventTarget[] }).__orbitaEventSources[0];
    for (let index = 0; index < count; index += 1) {
      const changeId = String(firstChangeId + index);
      const data = JSON.stringify({ schemaVersion: '1', type: 'invalidation', reason, changeId, emittedAt: new Date().toISOString() });
      source.dispatchEvent(new MessageEvent('invalidation', { data, lastEventId: changeId }));
      if (index % 10 === 9) await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }, { firstChangeId, count, reason });
}

async function mockSnapshot(page: Page, snapshot: ReturnType<typeof buildSnapshot>) {
  await page.route(/\/api\/dashboard\/v1\/runs\/run-proof-\d+$/, (route) => {
    const runId = route.request().url().split('/').at(-1)!;
    const run = snapshot.runs.find((candidate) => candidate.runId === runId)!;
    return route.fulfill({ json: detailFor(run) });
  });
  await page.route('**/api/dashboard/v1/runs', (route) => route.fulfill({ json: snapshot }));
}

test.beforeAll(async () => { await mkdir(proofDir, { recursive: true }); });

test('responsive attention board, detail semantics, virtualization, and keyboard proof', async ({ page }, testInfo) => {
  const snapshot = await mockDashboard(page, testInfo.project.name === 'mobile' ? 'waiting' : 'balanced');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Orbita runs' })).toBeVisible();
  await expect(page.locator('.lane')).toHaveCount(5);
  expect(await page.locator('.run-card').count()).toBeLessThanOrEqual(150);
  const waitingRegion = page.getByRole('region', { name: 'Waiting for user' });
  await expect(waitingRegion.getByRole('list', { name: 'Waiting for user runs' })).toBeVisible();
  const waitingCount = testInfo.project.name === 'mobile' ? 900 : 200;
  await expect(waitingRegion.getByLabel(`${waitingCount} runs`, { exact: true })).toHaveText(String(waitingCount));
  expect(await waitingRegion.getByRole('listitem').count()).toBeGreaterThan(0);
  expect(await page.locator('.status-reason').first().evaluate((element) => getComputedStyle(element).maxWidth)).toBe('55%');
  expect(await page.locator('.lane[data-lane="degraded"] .status-reason').first().evaluate((element) => getComputedStyle(element).color)).toBe('rgb(154, 146, 168)');

  if (testInfo.project.name === 'mobile') {
    await expect(page.getByRole('region', { name: 'Attention summary' })).toBeVisible();
    await expect(page.locator('.lane[data-lane="waiting_for_user"] .lane-body')).toBeVisible();
    await expect(page.locator('.lane[data-lane="needs_help"] .lane-body')).toBeVisible();
    await expect(page.locator('.lane[data-lane="degraded"] .lane-body')).toBeVisible();
    await expect(page.locator('.lane[data-lane="worker_running"] .lane-body')).toBeHidden();
    await expect(page.locator('.lane[data-lane="done"] .lane-body')).toBeHidden();
    const origin = page.locator('.run-card').first();
    await origin.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    const closeDetails = page.getByRole('button', { name: 'Close details' });
    await expect(closeDetails).toBeFocused();
    await origin.focus();
    await expect(closeDetails).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('dialog').locator(':focus')).toHaveCount(1);
    await page.screenshot({ path: `${proofDir}mobile-390x844-bottom-sheet.png` });
    await closeDetails.focus();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.locator('.run-card:focus')).toBeVisible();
    return;
  }

  await page.screenshot({ path: `${proofDir}desktop-1440x900-closed.png` });
  const detailStart = Date.now();
  await page.locator('.run-card').first().click();
  await expect(page.getByRole('complementary', { name: 'Run details' })).toBeVisible();
  expect(Date.now() - detailStart).toBeLessThan(2_000);
  await page.screenshot({ path: `${proofDir}desktop-1440x900-open.png` });
  await page.getByRole('button', { name: 'Close details' }).click();
  await expect(page.locator('.run-card:focus')).toBeVisible();

  const interactiveSamples: number[] = [];
  const interactiveTarget = page.locator('.lane[data-lane="waiting_for_user"] .run-card').first();
  for (let sample = 0; sample < 12; sample += 1) {
    const startedAt = performance.now();
    await interactiveTarget.focus();
    await expect(interactiveTarget).toBeFocused();
    interactiveSamples.push(performance.now() - startedAt);
    await page.getByPlaceholder('Search run, workflow, step').focus();
  }
  interactiveSamples.sort((left, right) => left - right);
  expect(interactiveSamples[Math.ceil(interactiveSamples.length * .95) - 1]).toBeLessThan(2_000);

  const reclassified = snapshot.runs[0];
  await interactiveTarget.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('complementary', { name: 'Run details' })).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  await expect(interactiveTarget).toBeFocused();
  await expect(interactiveTarget).toHaveAttribute('aria-label', new RegExp(reclassified.title.value));
  const reconciliationSamples: number[] = [];
  for (let change = 0; change < 5; change += 1) {
    const laneId = change % 2 === 0 ? 'needs_help' : 'waiting_for_user';
    snapshot.runs[0] = { ...reclassified, laneId, reason: { sourceClass: 'public_diagnostic', value: laneId === 'needs_help' ? 'Decision missing' : 'Approval needed', policyVersion: '1' } };
    snapshot.snapshotVersion = String(Number(snapshot.snapshotVersion) + 1);
    snapshot.freshness.observerRevision = String(Number(snapshot.freshness.observerRevision) + 1);
    await page.evaluate(({ laneId, title }) => {
      const state = window as unknown as { __orbitaExpectedLane: string; __orbitaExpectedTitle: string; __orbitaReconciliationLatency: number };
      state.__orbitaExpectedLane = laneId;
      state.__orbitaExpectedTitle = title;
      state.__orbitaReconciliationLatency = Number.POSITIVE_INFINITY;
    }, { laneId, title: reclassified.title.value });
    await emitInvalidations(page, Number(snapshot.freshness.observerRevision), 1);
    await expect(page.locator(`.lane[data-lane="${laneId}"] .run-card:focus`)).toHaveAttribute('aria-label', new RegExp(reclassified.title.value));
    await expect(page.getByRole('complementary', { name: 'Run details' }).getByText(laneId === 'needs_help' ? 'Needs help' : 'Waiting for user', { exact: true })).toBeVisible();
    reconciliationSamples.push(await page.evaluate(() => (window as unknown as { __orbitaReconciliationLatency: number }).__orbitaReconciliationLatency));
  }
  reconciliationSamples.sort((left, right) => left - right);
  expect(reconciliationSamples[Math.ceil(reconciliationSamples.length * .95) - 1]).toBeLessThan(100);

  await page.evaluate(() => { (window as unknown as { __orbitaLongTasks: number[] }).__orbitaLongTasks.length = 0; });
  await page.evaluate(() => {
    const counts = (window as unknown as { __orbitaFetchCounts: { snapshot: number; detail: number } }).__orbitaFetchCounts;
    counts.snapshot = 0;
    counts.detail = 0;
  });
  await emitInvalidations(page, Number(snapshot.freshness.observerRevision) + 1, 100);
  await page.waitForTimeout(250);
  const fetchCounts = await page.evaluate(() => (window as unknown as { __orbitaFetchCounts: { snapshot: number; detail: number } }).__orbitaFetchCounts);
  expect(fetchCounts.snapshot).toBeLessThanOrEqual(1);
  expect(fetchCounts.detail).toBeLessThanOrEqual(1);
  const longestTask = await page.evaluate(() => Math.max(0, ...(window as unknown as { __orbitaLongTasks: number[] }).__orbitaLongTasks));
  expect(longestTask).toBeLessThanOrEqual(50);
  await page.getByRole('button', { name: 'Close details' }).click();
  await expect(page.locator(`.run-card[data-run-id="${reclassified.runId}"]:focus`)).toBeVisible();

  await page.goto(`/?run=${reclassified.runId}`);
  await expect(page.getByRole('complementary', { name: 'Run details' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Close details' }).click();
  await expect(page.locator(`.run-card[data-run-id="${reclassified.runId}"]`)).toBeFocused();

  await page.locator('.run-card').first().focus();
  await page.keyboard.press('End');
  await expect(page.locator('.run-card:focus')).toHaveAttribute('aria-label', /Observe workflow run 999/);

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.locator('.run-card').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close details' })).toBeFocused();
  await page.locator('.run-card').first().focus();
  await expect(page.getByRole('button', { name: 'Close details' })).toBeFocused();
  await page.screenshot({ path: `${proofDir}narrow-1024x768-selected-sheet.png` });
  await page.getByRole('button', { name: 'Close details' }).click();
  await page.getByRole('button', { name: 'Filter' }).click();
  await expect(page.getByLabel('Run filters')).toBeVisible();
  await page.screenshot({ path: `${proofDir}narrow-1024x768-filter.png` });
  await page.keyboard.press('Escape');
  await page.getByPlaceholder('Search run, workflow, step').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Filter' })).toBeFocused();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const focusedOutline = await page.getByRole('button', { name: 'Filter' }).evaluate((element) => {
    const style = getComputedStyle(element);
    return { width: style.outlineWidth, color: style.outlineColor, transition: style.transitionDuration };
  });
  expect(focusedOutline).toEqual({ width: '2px', color: 'rgb(203, 166, 247)', transition: '1e-05s' });
  await page.screenshot({ path: `${proofDir}keyboard-reduced-motion.png` });
});

test('failure states never masquerade as empty success', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile');
  await page.route('**/api/dashboard/v1/events', (route) => route.fulfill({ status: 200, contentType: 'text/event-stream', body: '' }));
  await page.route('**/api/dashboard/v1/runs', (route) => route.fulfill({ status: 503, json: { error: { code: 'observer_unavailable', message: 'Observer unavailable' } } }));
  await page.goto('/');
  await expect(page.getByText('Could not load runs')).toBeVisible();
  await page.screenshot({ path: `${proofDir}failure-initial-error.png` });
  await page.unroute('**/api/dashboard/v1/runs');
  await page.route('**/api/dashboard/v1/runs', (route) => route.fulfill({ status: 400, json: { error: { code: 'invalid_request', message: 'Dashboard runs root is not configured' } } }));
  await page.reload();
  await expect(page.getByText('Runs root is not configured')).toBeVisible();
  await page.screenshot({ path: `${proofDir}failure-unconfigured-root.png` });
});

test('pathological density stays virtualized and contained', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile');
  await mockDashboard(page, 'done');
  await page.goto('/');
  await expect(page.getByText('900', { exact: true })).toBeVisible();
  expect(await page.locator('.run-card').count()).toBeLessThanOrEqual(150);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: `${proofDir}pathological-900-done.png` });
});

test('empty, stale, detail-error, and missing-selection states render explicitly', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile');
  await installStableEvents(page);
  let snapshot = buildSnapshot(0);
  await mockSnapshot(page, snapshot);
  await page.goto('/');
  await expect(page.getByText('No runs yet')).toBeVisible();
  await page.screenshot({ path: `${proofDir}failure-empty-board.png` });

  await page.unroute('**/api/dashboard/v1/runs');
  snapshot = buildSnapshot(10);
  snapshot.freshness = { ...snapshot.freshness, state: 'stale', staleSince: snapshot.generatedAt, failureCode: 'observer_refresh_failed', retryAt: snapshot.generatedAt };
  await page.route('**/api/dashboard/v1/runs', (route) => route.fulfill({ json: snapshot }));
  await page.reload();
  await expect(page.getByText(/Existing runs remain visible/)).toBeVisible();
  await page.screenshot({ path: `${proofDir}failure-stale-last-good.png` });

  await page.route(/\/api\/dashboard\/v1\/runs\/run-proof-\d+$/, (route) => route.fulfill({ status: 503, json: { error: { code: 'observer_unavailable', message: 'Unavailable' } } }));
  await page.locator('.run-card').first().click();
  await expect(page.getByText('Run details unavailable')).toBeVisible();
  await page.screenshot({ path: `${proofDir}failure-detail-local.png` });
  await page.getByRole('button', { name: 'Close details' }).click();

  await page.goto('/?run=run-proof-0000&q=not-present');
  await expect(page.getByText('This run is no longer in the current results')).toBeVisible();
  await expect(page.locator('.sheet-overlay')).toHaveCount(0);
  await page.screenshot({ path: `${proofDir}failure-missing-selection.png` });
  await page.getByRole('button', { name: 'Back to board' }).click();
  await expect(page.getByRole('heading', { name: 'Waiting for user' })).toBeFocused();
});
