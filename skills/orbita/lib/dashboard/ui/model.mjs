import { dashboardLaneIds, dashboardLanes, fallbackLaneId, laneRenderWindowSize } from './constants.mjs';

export function normalizeRuns(runs = []) {
  if (!Array.isArray(runs)) return [];
  return runs.map((run) => {
    const id = String(run.runId ?? run.id ?? '');
    const laneId = dashboardLaneIds.has(run.lane?.id) ? run.lane.id : (dashboardLaneIds.has(run.laneId) ? run.laneId : fallbackLaneId);
    const cursorBranches = normalizeCursorBranches(run.cursorBranches ?? run.cursor);
    return {
      id,
      laneId,
      title: run.title || run.summary || run.promptSummary || 'Untitled run',
      summary: run.summary,
      workflowName: run.workflowName || run.workflow?.identity || 'Unknown workflow',
      stepId: run.stepId || run.currentStepId || run.cursor?.display || cursorBranches[0] || 'unknown_step',
      statusLabel: run.statusLabel || run.lane?.label || labelForLane(laneId),
      updatedAt: run.updatedAt,
      createdAt: run.createdAt,
      cursorBranches,
      artifacts: normalizeArtifacts(run.artifacts),
      historyExcerpt: normalizeHistoryExcerpt(run.historyExcerpt),
      diagnostics: normalizeDiagnostics(run),
      miniMap: normalizeMiniMap(run.miniMap),
      miniMapProvenance: run.miniMap?.provenance,
    };
  });
}

export function filterRuns(runs, searchQuery = '') {
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

export function countsByLane(runs) {
  const counts = new Map(dashboardLanes.map((lane) => [lane.id, 0]));
  for (const run of runs) counts.set(run.laneId, (counts.get(run.laneId) ?? 0) + 1);
  return counts;
}

export function visibleLaneRuns(laneRuns, selectedRunId, windowSize = laneRenderWindowSize) {
  if (laneRuns.length <= windowSize) return { runs: laneRuns, hiddenCount: 0, selectedPinned: false };
  const visibleRuns = laneRuns.slice(0, windowSize);
  const selectedRun = laneRuns.find((run) => run.id === selectedRunId);
  const selectedPinned = Boolean(selectedRun && !visibleRuns.some((run) => run.id === selectedRun.id));
  if (selectedPinned) visibleRuns[visibleRuns.length - 1] = selectedRun;
  return {
    runs: visibleRuns,
    hiddenCount: laneRuns.length - visibleRuns.length,
    selectedPinned,
  };
}

export function nextSelectedRunId({ currentSelectedRunId, runs = [], hasLoadedRuns = false, selectionDismissed = false } = {}) {
  if (currentSelectedRunId) return currentSelectedRunId;
  if (selectionDismissed || hasLoadedRuns) return null;
  return runs[0]?.runId ?? runs[0]?.id ?? null;
}

export function redactPrivateText(value) {
  return String(value)
    .replace(/\/Users\/[^\s"'<>]+/g, '[local path]')
    .replace(/~\/[^\s"'<>]+/g, '[local path]')
    .replace(/[A-Za-z0-9_-]{24,}/g, '[private token]');
}

function normalizeCursorBranches(cursor) {
  if (Array.isArray(cursor)) return cursor.map((item) => String(item.stepId ?? item.id ?? item)).filter(Boolean);
  if (Array.isArray(cursor?.steps)) return cursor.steps.map((step) => String(step)).filter(Boolean);
  if (cursor && typeof cursor === 'object') return [String(cursor.stepId ?? cursor.id ?? '')].filter(Boolean);
  if (typeof cursor === 'string') return [cursor];
  return [];
}

function normalizeArtifacts(artifacts) {
  if (!Array.isArray(artifacts)) return [];
  return artifacts.map((artifact) => ({
    id: artifact.id,
    contentType: artifact.contentType ?? artifact.content_type,
    summary: artifact.summary,
  }));
}

function normalizeHistoryExcerpt(historyExcerpt) {
  if (Array.isArray(historyExcerpt)) return historyExcerpt;
  if (Array.isArray(historyExcerpt?.lines)) {
    return historyExcerpt.lines.map((line) => ({ summary: line }));
  }
  return [];
}

function normalizeDiagnostics(run) {
  if (Array.isArray(run.diagnostics)) return run.diagnostics;
  if (run.degraded) return [{ severity: 'warning', message: run.degraded.message ?? run.degraded.reason ?? 'degraded read' }];
  return [];
}

function normalizeMiniMap(miniMap) {
  if (Array.isArray(miniMap)) return miniMap;
  if (!miniMap || typeof miniMap !== 'object') return [];
  const current = new Set(Array.isArray(miniMap.currentSteps) ? miniMap.currentSteps : []);
  const completed = new Set(Array.isArray(miniMap.completedSteps) ? miniMap.completedSteps : []);
  const ids = [...new Set([...completed, ...current])];
  return ids.map((id) => ({
    id,
    state: current.has(id) ? 'active' : 'completed',
  }));
}

function labelForLane(laneId) {
  return dashboardLanes.find((lane) => lane.id === laneId)?.label ?? 'Degraded';
}
