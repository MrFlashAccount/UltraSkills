import { dashboardLanes } from './constants.mjs';
import { sanitizeVisibleReadError } from './normalizers.mjs';

export const laneRenderLimit = 50;

export function createDashboardViewModel(snapshot = {}) {
  const runs = filterRuns(snapshot.runs, snapshot.searchQuery);
  const selectedRunId = Object.hasOwn(snapshot, 'selectedRunId') ? snapshot.selectedRunId : runs[0]?.id;
  const selectedRun = runs.find((run) => run.id === selectedRunId);
  return {
    runs,
    selectedRun,
    selectedRunId,
    counts: countsByLane(runs),
    isLoading: Boolean(snapshot.isLoading),
    readError: snapshot.readError ? sanitizeVisibleReadError(snapshot.readError) : '',
    rootLabel: snapshot.rootLabel,
    freshness: snapshot.freshness,
    searchQuery: snapshot.searchQuery ?? '',
  };
}

export function runsForLane(runs, laneId, selectedRunId, limit = laneRenderLimit) {
  const laneRuns = runs.filter((run) => run.laneId === laneId);
  const visible = laneRuns.slice(0, limit);
  const selected = laneRuns.find((run) => run.id === selectedRunId);
  if (selected && !visible.some((run) => run.id === selected.id)) {
    return { all: laneRuns, visible: [selected, ...visible.slice(0, Math.max(0, limit - 1))], clipped: laneRuns.length - limit, selectedPinned: true };
  }
  return { all: laneRuns, visible, clipped: Math.max(0, laneRuns.length - visible.length), selectedPinned: false };
}

function countsByLane(runs) {
  const counts = new Map(dashboardLanes.map((lane) => [lane.id, 0]));
  for (const run of runs) counts.set(run.laneId, (counts.get(run.laneId) ?? 0) + 1);
  return counts;
}

function filterRuns(runs = [], searchQuery = '') {
  const query = String(searchQuery ?? '').trim().toLowerCase();
  if (!query) return runs;
  return runs.filter((run) => [
    run.id,
    run.title,
    run.summary,
    run.workflowName,
    run.stepId,
    run.statusLabel,
  ].some((value) => String(value ?? '').toLowerCase().includes(query)));
}
