import { sanitizeVisibleReadError } from './normalizers.mjs';
import { renderDashboard } from './render.mjs';

const state = {
  snapshot: {},
  runs: [],
  selectedRunId: null,
  lastSelectedRunId: null,
  selectionInitialized: false,
  drawerClosedByUser: false,
  searchQuery: '',
  isLoading: true,
  readError: '',
};

const endpoints = {
  list: '/api/runs',
  detail: (runId) => `/api/runs/${encodeURIComponent(runId)}`,
  events: '/api/events',
};

async function loadRuns() {
  state.isLoading = true;
  renderSnapshot();
  const response = await fetch(endpoints.list, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`dashboard list failed: ${response.status}`);
  const snapshot = await response.json();
  state.snapshot = snapshot && typeof snapshot === 'object' ? snapshot : {};
  state.runs = Array.isArray(snapshot.runs) ? snapshot.runs : [];
  if (!state.selectionInitialized) {
    state.selectedRunId = state.runs[0]?.runId ?? state.runs[0]?.id ?? null;
    state.selectionInitialized = true;
  }
  state.isLoading = false;
  state.readError = '';
  renderSnapshot();
}

async function selectRun(runId) {
  state.selectedRunId = runId;
  state.lastSelectedRunId = runId;
  state.selectionInitialized = true;
  state.drawerClosedByUser = false;
  renderSnapshot();
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
  focusDrawer();
}

function renderSnapshot() {
  const scrollState = captureScrollState();
  const nextSnapshot = {
    ...state.snapshot,
    runs: state.runs,
    selectedRunId: state.selectedRunId,
    searchQuery: state.searchQuery,
    isLoading: state.isLoading,
    readError: state.readError,
  };
  const existing = document.querySelector('.orbita-dashboard');
  if (existing) {
    existing.outerHTML = renderDashboard(nextSnapshot);
  } else {
    document.body.insertAdjacentHTML('afterbegin', renderDashboard(nextSnapshot));
  }
  restoreScrollState(scrollState);
}

function focusDrawer() {
  document.querySelector('.drawer')?.focus?.();
}

function focusLastSelectedCard() {
  if (!state.lastSelectedRunId) return;
  document.querySelector(`.run-card[data-run-id="${escapeCssIdentifier(state.lastSelectedRunId)}"]`)?.focus?.();
}

function captureScrollState() {
  return {
    boardLeft: document.querySelector('.board')?.scrollLeft ?? 0,
    drawerTop: document.querySelector('.drawer')?.scrollTop ?? 0,
  };
}

function restoreScrollState(scrollState) {
  const board = document.querySelector('.board');
  const drawer = document.querySelector('.drawer');
  if (board) board.scrollLeft = scrollState.boardLeft;
  if (drawer) drawer.scrollTop = scrollState.drawerTop;
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
    if (update?.runId) mergeRunUpdate(update);
  });
  source.addEventListener('dashboard.error', (event) => {
    const payload = JSON.parse(event.data);
    showReadError(new Error(payload?.error ?? payload?.message ?? 'dashboard event degraded'));
  });
}

function showReadError(error) {
  state.isLoading = false;
  state.readError = sanitizeVisibleReadError(error.message);
  renderSnapshot();
}

function mergeRunUpdate(update) {
  state.runs = state.runs.map((run) => ((run.runId ?? run.id) === update.runId ? { ...run, ...update } : run));
  state.readError = '';
  renderSnapshot();
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
    state.selectionInitialized = true;
    state.drawerClosedByUser = true;
    renderSnapshot();
    focusLastSelectedCard();
  }
});

loadRuns().then(connectEvents).catch(showReadError);
