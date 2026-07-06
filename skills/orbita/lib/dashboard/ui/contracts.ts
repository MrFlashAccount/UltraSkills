import { dashboardLaneIds, dashboardLanes, fallbackLaneId } from './constants';
import type {
  DashboardArtifact,
  DashboardDiagnostic,
  DashboardHistoryEntry,
  DashboardLaneId,
  DashboardMiniMapStep,
  DashboardRun,
  DashboardSnapshot,
  DashboardViewModel,
} from './types';

const runnerControlPattern = /\b(next|continue|write-output|bind-agent|retry|rerun|repair|move|drag|drop)\b/gi;

export function toDashboardSnapshot(value: unknown): DashboardSnapshot {
  const source = asRecord(value);
  return {
    rootLabel: stringOrUndefined(source.rootLabel),
    generatedAt: stringOrUndefined(source.generatedAt),
    freshnessLabel: stringOrUndefined(source.freshnessLabel),
    selectedRunId: nullableString(source.selectedRunId),
    searchQuery: stringOrUndefined(source.searchQuery),
    runs: normalizeRuns(source.runs),
  };
}

export function normalizeRuns(value: unknown): DashboardRun[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeRun).filter((run): run is DashboardRun => run !== null && run.id.length > 0);
}

export function createDashboardViewModel(snapshot: DashboardSnapshot): DashboardViewModel {
  const runs = filterRuns(snapshot.runs, snapshot.searchQuery);
  const selectedRunId = Object.hasOwn(snapshot, 'selectedRunId') ? snapshot.selectedRunId : runs[0]?.id;
  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? null;
  const counts = new Map<DashboardLaneId, number>(dashboardLanes.map((lane) => [lane.id, 0]));
  const byLane = new Map<DashboardLaneId, DashboardRun[]>(dashboardLanes.map((lane) => [lane.id, []]));

  for (const run of runs) {
    counts.set(run.laneId, (counts.get(run.laneId) ?? 0) + 1);
    byLane.get(run.laneId)?.push(run);
  }

  return {
    rootLabel: snapshot.rootLabel || 'Root not configured',
    freshness: snapshot.freshnessLabel ?? relativeTimeLabel(snapshot.generatedAt),
    searchQuery: snapshot.searchQuery ?? '',
    runs,
    selectedRun,
    countsByLane: counts,
    lanes: dashboardLanes,
    visibleRunsByLane: byLane,
  };
}

export function filterRuns(runs: readonly DashboardRun[], searchQuery = ''): DashboardRun[] {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return [...runs];
  return runs.filter((run) => [
    run.id,
    run.title,
    run.summary,
    run.workflowName,
    run.stepId,
    run.statusLabel,
  ].some((candidate) => String(candidate ?? '').toLowerCase().includes(query)));
}

export function relativeTimeLabel(value: string | undefined): string {
  if (!value) return 'freshness unknown';
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

export function redactControlText(value: string): string {
  return value.replace(runnerControlPattern, 'control action');
}

export function shortRunId(runId: string): string {
  return runId.length > 18 ? `${runId.slice(0, 10)}...${runId.slice(-6)}` : runId;
}

function normalizeRun(value: unknown): DashboardRun | null {
  const source = asRecord(value);
  const id = String(source.runId ?? source.id ?? '');
  if (!id) return null;
  const laneRecord = asRecord(source.lane);
  const laneCandidate = stringOrUndefined(laneRecord.id) ?? stringOrUndefined(source.laneId);
  const laneId = isDashboardLaneId(laneCandidate) ? laneCandidate : fallbackLaneId;
  const cursorBranches = normalizeCursorBranches(source.cursorBranches ?? source.cursor);
  const workflowRecord = asRecord(source.workflow);

  return {
    id,
    laneId,
    title: stringOrUndefined(source.title) ?? stringOrUndefined(source.summary) ?? stringOrUndefined(source.promptSummary) ?? 'Untitled run',
    summary: stringOrUndefined(source.summary),
    workflowName: stringOrUndefined(source.workflowName) ?? stringOrUndefined(workflowRecord.identity) ?? 'Unknown workflow',
    stepId: stringOrUndefined(source.stepId) ?? stringOrUndefined(source.currentStepId) ?? stringOrUndefined(asRecord(source.cursor).display) ?? cursorBranches[0] ?? 'unknown_step',
    statusLabel: stringOrUndefined(source.statusLabel) ?? stringOrUndefined(laneRecord.label) ?? labelForLane(laneId),
    updatedAt: stringOrUndefined(source.updatedAt),
    createdAt: stringOrUndefined(source.createdAt),
    cursorBranches,
    artifacts: normalizeArtifacts(source.artifacts),
    historyExcerpt: normalizeHistoryExcerpt(source.historyExcerpt),
    diagnostics: normalizeDiagnostics(source),
    miniMap: normalizeMiniMap(source.miniMap),
    miniMapProvenance: stringOrUndefined(asRecord(source.miniMap).provenance),
  };
}

function normalizeCursorBranches(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(asRecord(item).stepId ?? asRecord(item).id ?? item)).filter(Boolean);
  const record = asRecord(value);
  if (Array.isArray(record.steps)) return record.steps.map(String).filter(Boolean);
  if (typeof value === 'object' && value !== null) return [String(record.stepId ?? record.id ?? '')].filter(Boolean);
  if (typeof value === 'string') return [value];
  return [];
}

function normalizeArtifacts(value: unknown): DashboardArtifact[] {
  if (!Array.isArray(value)) return [];
  return value.map((artifact) => {
    const record = asRecord(artifact);
    return {
      id: stringOrUndefined(record.id) ?? stringOrUndefined(record.name) ?? 'artifact',
      contentType: stringOrUndefined(record.contentType) ?? stringOrUndefined(record.content_type),
      summary: stringOrUndefined(record.summary),
    };
  });
}

function normalizeHistoryExcerpt(value: unknown): DashboardHistoryEntry[] {
  if (Array.isArray(value)) {
    return value.map((entry) => {
      const record = asRecord(entry);
      return {
        at: stringOrUndefined(record.at),
        age: stringOrUndefined(record.age),
        summary: stringOrUndefined(record.summary) ?? '',
      };
    });
  }
  const record = asRecord(value);
  if (Array.isArray(record.lines)) return record.lines.map((line) => ({ summary: String(line) }));
  return [];
}

function normalizeDiagnostics(run: Record<string, unknown>): DashboardDiagnostic[] {
  if (Array.isArray(run.diagnostics)) {
    return run.diagnostics.map((diagnostic) => {
      const record = asRecord(diagnostic);
      return {
        severity: stringOrUndefined(record.severity) ?? 'info',
        message: stringOrUndefined(record.message) ?? stringOrUndefined(record.summary) ?? '',
      };
    });
  }
  const degraded = asRecord(run.degraded);
  if (Object.keys(degraded).length > 0) {
    return [{
      severity: 'warning',
      message: stringOrUndefined(degraded.message) ?? stringOrUndefined(degraded.reason) ?? 'degraded read',
    }];
  }
  return [];
}

function normalizeMiniMap(value: unknown): DashboardMiniMapStep[] {
  if (Array.isArray(value)) {
    return value.map((step) => {
      const record = asRecord(step);
      return {
        id: String(record.id ?? record.stepId ?? ''),
        state: stringOrUndefined(record.state) ?? 'pending',
      };
    }).filter((step) => step.id.length > 0);
  }
  const record = asRecord(value);
  const current = new Set(Array.isArray(record.currentSteps) ? record.currentSteps.map(String) : []);
  const completed = new Set(Array.isArray(record.completedSteps) ? record.completedSteps.map(String) : []);
  return [...new Set([...completed, ...current])].map((id) => ({
    id,
    state: current.has(id) ? 'active' : 'completed',
  }));
}

function labelForLane(laneId: DashboardLaneId): string {
  return dashboardLanes.find((lane) => lane.id === laneId)?.label ?? 'Degraded';
}

function isDashboardLaneId(value: string | undefined): value is DashboardLaneId {
  return value !== undefined && dashboardLaneIds.has(value as DashboardLaneId);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function nullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  return stringOrUndefined(value);
}
