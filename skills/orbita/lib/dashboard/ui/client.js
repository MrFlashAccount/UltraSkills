import { renderDashboard } from './render.mjs';

const state = {
  snapshot: {},
  runs: [],
  selectedRunId: null,
  lastSelectedRunId: null,
  searchQuery: '',
  transportError: null,
};

const endpoints = {
  list: '/api/runs',
  detail: (runId) => `/api/runs/${encodeURIComponent(runId)}`,
  events: '/api/events',
};

async function loadRuns() {
  const response = await fetch(endpoints.list, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`dashboard list failed: ${response.status}`);
  const snapshot = await response.json();
  state.snapshot = snapshot && typeof snapshot === 'object' ? snapshot : {};
  state.runs = Array.isArray(snapshot.runs) ? snapshot.runs : [];
  state.transportError = null;
  state.selectedRunId ??= state.runs[0]?.runId ?? state.runs[0]?.id ?? null;
  renderSnapshot();
}

async function selectRun(runId) {
  state.selectedRunId = runId;
  state.lastSelectedRunId = runId;
  const response = await fetch(endpoints.detail(runId), { headers: { accept: 'application/json' } });
  if (!response.ok) {
    showReadError(new Error(`dashboard detail failed: ${response.status}`));
    return renderSnapshot();
  }
  const detail = await response.json();
  const nextRun = detail.run ?? detail;
  state.runs = state.runs.map((run) => ((run.runId ?? run.id) === runId ? { ...run, ...nextRun } : run));
  renderSnapshot();
  focusDrawer();
}

function renderSnapshot() {
  const nextSnapshot = {
    ...state.snapshot,
    runs: state.runs,
    selectedRunId: state.selectedRunId,
    searchQuery: state.searchQuery,
    transportError: state.transportError,
  };
  const existing = document.querySelector('.orbita-dashboard');
  if (existing) {
    existing.outerHTML = renderDashboard(nextSnapshot);
  } else {
    document.body.insertAdjacentHTML('afterbegin', renderDashboard(nextSnapshot));
  }
}

function focusDrawer() {
  document.querySelector('.drawer')?.focus?.();
}

function focusLastSelectedCard() {
  if (!state.lastSelectedRunId) return;
  document.querySelector(`.run-card[data-run-id="${escapeCssIdentifier(state.lastSelectedRunId)}"]`)?.focus?.();
}

function escapeCssIdentifier(value) {
  return globalThis.CSS?.escape ? CSS.escape(value) : String(value).replaceAll('"', '\\"');
}

function connectEvents() {
  if (!('EventSource' in window)) return;
  const source = new EventSource(endpoints.events);
  source.addEventListener('dashboard.snapshot', () => {
    loadRuns().catch(showReadError);
  });
  source.addEventListener('dashboard.run_updated', (event) => {
    const update = JSON.parse(event.data);
    if (update?.runId) selectRun(update.runId).catch(showReadError);
  });
  source.addEventListener('dashboard.error', (event) => {
    let message = 'dashboard observer read failed';
    try { message = JSON.parse(event.data)?.message ?? message; } catch {}
    showReadError(new Error(message));
  });
  source.onerror = () => showReadError(new Error('dashboard event connection interrupted'));
}

function showReadError(error) {
  state.transportError = error?.message ?? 'dashboard read failed';
  const target = document.querySelector('.freshness');
  if (target) target.textContent = state.transportError;
}

document.addEventListener('click', (event) => {
  const card = event.target.closest?.('.run-card[data-run-id]');
  if (!card) return;
  selectRun(card.getAttribute('data-run-id')).catch(showReadError);
});

document.addEventListener('input', (event) => {
  if (!event.target.matches?.('.search-label input[name="q"]')) return;
  state.searchQuery = event.target.value;
  renderSnapshot();
  document.querySelector('.search-label input[name="q"]')?.focus?.();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    const card = event.target.closest?.('.run-card[data-run-id]');
    if (card) {
      event.preventDefault();
      selectRun(card.getAttribute('data-run-id')).catch(showReadError);
    }
  }
  if (event.key === 'Escape') {
    state.selectedRunId = null;
    renderSnapshot();
    focusLastSelectedCard();
  }
});

loadRuns().then(connectEvents).catch(showReadError);
