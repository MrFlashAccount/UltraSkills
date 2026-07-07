import { dashboardLaneIds, dashboardLanes, fallbackLaneId } from './constants.mjs';

export function normalizeRuns(runs = []) {
  if (!Array.isArray(runs)) return [];
  return runs.map((run) => {
    const id = String(run.runId ?? run.id ?? '');
    const laneId = dashboardLaneIds.has(run.lane?.id)
      ? run.lane.id
      : (dashboardLaneIds.has(run.laneId) ? run.laneId : fallbackLaneId);
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

export function relativeTimeLabel(value) {
  if (!value) return 'freshness unknown';
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return String(value);
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

export function shortRunId(runId) {
  return runId.length > 18 ? `${runId.slice(0, 10)}...${runId.slice(-6)}` : runId;
}

export function sanitizeVisibleReadError(value) {
  return String(value ?? 'dashboard read failed')
    .replace(/(?:file:\/\/)?\/(?:Users|private|var|tmp)\/[^\s"'<>)]*/g, '[redacted local path]')
    .replace(/~\/[^\s"'<>)]*/g, '[redacted local path]')
    .replace(/\b[A-Za-z]:\\[^\s"'<>)]*/g, '[redacted local path]')
    .replace(/\b(?:lease-token|token|secret)=?[A-Za-z0-9._-]+/gi, '[redacted credential]');
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
  if (Array.isArray(run.diagnostics)) return run.diagnostics.map(normalizeDiagnostic);
  if (run.degraded) {
    return [normalizeDiagnostic({
      severity: 'warning',
      message: run.degraded.message ?? run.degraded.reason ?? 'degraded read',
    })];
  }
  return [];
}

function normalizeDiagnostic(diagnostic) {
  if (!diagnostic || typeof diagnostic !== 'object') {
    return { severity: 'info', message: sanitizeVisibleReadError(diagnostic) };
  }
  return {
    ...diagnostic,
    message: sanitizeVisibleReadError(diagnostic.message ?? diagnostic.summary ?? ''),
    summary: diagnostic.summary ? sanitizeVisibleReadError(diagnostic.summary) : diagnostic.summary,
  };
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
