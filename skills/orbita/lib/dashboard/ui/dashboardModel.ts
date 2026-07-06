import { dashboardCopy, dashboardLaneIds, dashboardLanes, fallbackLaneId } from './dashboardConstants';
import { redactControlText } from './dashboardText';
import type {
  DashboardArtifact,
  DashboardDiagnostic,
  DashboardHistoryEntry,
  DashboardLaneId,
  DashboardMiniMapStep,
  DashboardModel,
  DashboardRun,
  DashboardRunDto,
  DashboardSnapshotDto,
  DashboardViewModel,
} from './dashboardTypes';

export function normalizeDashboardSnapshot(snapshot: DashboardSnapshotDto = {}): DashboardModel {
  const runs = Array.isArray(snapshot.runs) ? snapshot.runs : [];
  return {
    rootLabel: text(snapshot.rootLabel, dashboardCopy.emptyRoot),
    generatedAt: text(snapshot.generatedAt),
    freshnessLabel: text(snapshot.freshnessLabel, relativeTimeLabel(text(snapshot.generatedAt))),
    runs: runs.map(normalizeRun).filter((run) => run.id.length > 0),
  };
}

export function buildDashboardViewModel(
  model: DashboardModel,
  query: string,
  selectedRunId: string | null,
): DashboardViewModel {
  const visibleRuns = filterRuns(model.runs, query);
  const selectedRun = visibleRuns.find((run) => run.id === selectedRunId) ?? null;
  return {
    query,
    selectedRunId,
    visibleRuns,
    selectedRun,
    runsByLane: groupRunsByLane(visibleRuns),
  };
}

export function mergeRunUpdate(runs: DashboardRun[], nextRun: DashboardRun): DashboardRun[] {
  let replaced = false;
  const merged = runs.map((run) => {
    if (run.id !== nextRun.id) return run;
    replaced = true;
    return nextRun;
  });
  return replaced ? merged : [nextRun, ...merged];
}

export function normalizeRun(value: unknown): DashboardRun {
  const run = objectValue(value) as DashboardRunDto;
  const id = text(run.runId ?? run.id);
  const laneId = normalizeLaneId(run.lane?.id ?? run.laneId);
  const cursorBranches = normalizeCursorBranches(run.cursorBranches ?? run.cursor);
  const stepId = text(run.stepId ?? run.currentStepId ?? cursorDisplay(run.cursor) ?? cursorBranches[0], 'unknown_step');

  return {
    id,
    laneId,
    title: text(run.title ?? run.summary ?? run.promptSummary, 'Untitled run'),
    summary: text(run.summary ?? run.promptSummary),
    workflowName: text(run.workflowName ?? run.workflow?.identity, 'Unknown workflow'),
    stepId,
    statusLabel: text(run.statusLabel ?? run.lane?.label, labelForLane(laneId)),
    updatedAt: text(run.updatedAt),
    createdAt: text(run.createdAt),
    cursorBranches,
    artifacts: normalizeArtifacts(run.artifacts),
    historyExcerpt: normalizeHistory(run.historyExcerpt),
    diagnostics: normalizeDiagnostics(run),
    miniMap: normalizeMiniMap(run.miniMap, cursorBranches),
    miniMapProvenance: text(objectValue(run.miniMap).provenance),
  };
}

function filterRuns(runs: DashboardRun[], query: string): DashboardRun[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return runs;
  return runs.filter((run) => [
    run.id,
    run.title,
    run.summary,
    run.workflowName,
    run.stepId,
    run.statusLabel,
    ...run.cursorBranches,
  ].some((value) => value.toLowerCase().includes(normalizedQuery)));
}

function groupRunsByLane(runs: DashboardRun[]) {
  const grouped = new Map<DashboardLaneId, DashboardRun[]>(dashboardLanes.map((lane) => [lane.id, []]));
  for (const run of runs) grouped.get(run.laneId)?.push(run);
  return grouped;
}

function normalizeCursorBranches(cursor: unknown): string[] {
  if (Array.isArray(cursor)) return cursor.map((item) => text(objectValue(item).stepId ?? objectValue(item).id ?? item)).filter(Boolean);
  const cursorObject = objectValue(cursor);
  if (Array.isArray(cursorObject.steps)) return cursorObject.steps.map((step) => text(step)).filter(Boolean);
  const single = text(cursorObject.stepId ?? cursorObject.id ?? (typeof cursor === 'string' ? cursor : ''));
  return single ? [single] : [];
}

function normalizeArtifacts(artifacts: unknown): DashboardArtifact[] {
  if (!Array.isArray(artifacts)) return [];
  return artifacts.map((artifact) => {
    const item = objectValue(artifact);
    return {
      id: text(item.id ?? item.name, 'artifact'),
      contentType: text(item.contentType ?? item.content_type),
      summary: text(item.summary),
    };
  });
}

function normalizeHistory(history: unknown): DashboardHistoryEntry[] {
  if (Array.isArray(history)) return history.map(historyEntry);
  const historyObject = objectValue(history);
  if (!Array.isArray(historyObject.lines)) return [];
  return historyObject.lines.map((line) => ({ summary: redactControlText(text(line)), at: '', age: '' }));
}

function normalizeDiagnostics(run: DashboardRunDto): DashboardDiagnostic[] {
  if (Array.isArray(run.diagnostics)) {
    return run.diagnostics.map((diagnostic) => {
      const item = objectValue(diagnostic);
      return { severity: text(item.severity, 'info'), message: text(item.message ?? item.summary) };
    });
  }
  if (!run.degraded) return [];
  return [{ severity: 'warning', message: text(run.degraded.message ?? run.degraded.reason, 'degraded read') }];
}

function normalizeMiniMap(miniMap: unknown, cursorBranches: string[]): DashboardMiniMapStep[] {
  if (Array.isArray(miniMap)) return miniMap.map(miniMapStep);
  const miniMapObject = objectValue(miniMap);
  const current = new Set((Array.isArray(miniMapObject.currentSteps) ? miniMapObject.currentSteps : cursorBranches).map((step) => text(step)));
  const completed = new Set((Array.isArray(miniMapObject.completedSteps) ? miniMapObject.completedSteps : []).map((step) => text(step)));
  return [...new Set([...completed, ...current])]
    .filter(Boolean)
    .map((id) => ({ id, state: current.has(id) ? 'active' : 'completed' }));
}

function miniMapStep(value: unknown): DashboardMiniMapStep {
  const item = objectValue(value);
  return { id: text(item.id ?? item.stepId), state: text(item.state, 'pending') };
}

function historyEntry(value: unknown): DashboardHistoryEntry {
  const item = objectValue(value);
  return { summary: redactControlText(text(item.summary ?? value)), at: text(item.at), age: text(item.age) };
}

function normalizeLaneId(value: unknown): DashboardLaneId {
  const candidate = text(value);
  return dashboardLaneIds.has(candidate as DashboardLaneId) ? candidate as DashboardLaneId : fallbackLaneId;
}

function labelForLane(laneId: DashboardLaneId) {
  return dashboardLanes.find((lane) => lane.id === laneId)?.label ?? 'Degraded';
}

function cursorDisplay(cursor: unknown) {
  return objectValue(cursor).display;
}

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? value as Record<string, any> : {};
}

function text(value: unknown, fallback = '') {
  const next = value === null || value === undefined ? '' : String(value);
  return next || fallback;
}

export function shortRunId(runId: string) {
  return runId.length > 18 ? `${runId.slice(0, 10)}...${runId.slice(-6)}` : runId;
}

export function relativeTimeLabel(value: string) {
  if (!value) return 'freshness unknown';
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}
