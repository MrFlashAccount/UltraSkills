import { nextSelectedRunId, redactPrivateText } from './model.mjs';
import { renderDashboard } from './render.mjs';

const state = {
  snapshot: {},
  runs: [],
  selectedRunId: null,
  lastSelectedRunId: null,
  hasLoadedRuns: false,
  selectionDismissed: false,
  searchQuery: '',
  readError: '',
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
  state.selectedRunId = nextSelectedRunId({
    currentSelectedRunId: state.selectedRunId,
    runs: state.runs,
    hasLoadedRuns: state.hasLoadedRuns,
    selectionDismissed: state.selectionDismissed,
  });
  state.hasLoadedRuns = true;
  state.readError = '';
  renderSnapshot();
}

async function selectRun(runId) {
  state.selectedRunId = runId;
  state.lastSelectedRunId = runId;
  state.selectionDismissed = false;
  await refreshRun(runId);
  focusDrawer();
}

async function refreshRun(runId) {
  const response = await fetch(endpoints.detail(runId), { headers: { accept: 'application/json' } });
  if (!response.ok) {
    showReadError(new Error(`dashboard detail failed: ${response.status}`));
    return renderSnapshot();
  }
  const detail = await response.json();
  const nextRun = detail.run ?? detail;
  state.runs = state.runs.map((run) => ((run.runId ?? run.id) === runId ? { ...run, ...nextRun } : run));
  state.readError = '';
  renderSnapshot();
}

function renderSnapshot() {
  const nextSnapshot = {
    ...state.snapshot,
    runs: state.runs,
    selectedRunId: state.selectedRunId,
    searchQuery: state.searchQuery,
    readError: state.readError,
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
    if (!update?.runId) return;
    if (update.runId === state.selectedRunId) {
      refreshRun(update.runId).catch(showReadError);
    } else {
      loadRuns().catch(showReadError);
    }
  });
}

function showReadError(error) {
  state.readError = redactPrivateText(error.message);
  renderSnapshot();
  const target = document.querySelector('.freshness');
  if (target) target.textContent = state.readError;
}

function closeDrawer() {
  state.selectedRunId = null;
  state.selectionDismissed = true;
  renderSnapshot();
  focusLastSelectedCard();
}

document.addEventListener('click', (event) => {
  if (event.target.closest?.('[data-drawer-close]')) {
    closeDrawer();
    return;
  }
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
    closeDrawer();
  }
});

loadRuns().then(connectEvents).catch(showReadError);
