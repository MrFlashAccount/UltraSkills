import { dashboardLanes, dashboardLaneIds, fallbackLaneId } from '../constants/dashboard';
import type {
  ArtifactDto,
  CursorDto,
  DashboardLaneId,
  DashboardRun,
  DashboardRunDto,
  DiagnosticDto,
  HistoryDto,
  MiniMapDto,
  MiniMapSummaryDto,
} from '../types/dashboard';

export function normalizeRuns(runs: unknown): DashboardRun[] {
  if (!Array.isArray(runs)) return [];
  return runs.map((run) => normalizeRun(run as DashboardRunDto));
}

export function normalizeRun(run: DashboardRunDto): DashboardRun {
  const cursorBranches = normalizeCursorBranches(run.cursorBranches ?? run.cursor);
  const laneId = normalizeLaneId(run);
  const miniMap = normalizeMiniMap(run.miniMap);
  return {
    id: String(run.runId ?? run.id ?? ''),
    laneId,
    title: run.title || run.summary || run.promptSummary || 'Untitled run',
    summary: run.summary,
    workflowName: run.workflowName || run.workflow?.identity || 'Unknown workflow',
    stepId: run.stepId || run.currentStepId || cursorDisplay(run.cursor) || cursorBranches[0] || 'unknown_step',
    statusLabel: run.statusLabel || run.lane?.label || labelForLane(laneId),
    updatedAt: run.updatedAt,
    createdAt: run.createdAt,
    cursorBranches,
    artifacts: normalizeArtifacts(run.artifacts),
    historyExcerpt: normalizeHistoryExcerpt(run.historyExcerpt),
    diagnostics: normalizeDiagnostics(run),
    miniMap,
    miniMapProvenance: isMiniMapSummary(run.miniMap) ? run.miniMap.provenance : undefined,
  };
}

function normalizeLaneId(run: DashboardRunDto): DashboardLaneId {
  const laneId = run.lane?.id ?? run.laneId;
  return dashboardLaneIds.has(laneId as DashboardLaneId) ? laneId as DashboardLaneId : fallbackLaneId;
}

function normalizeCursorBranches(cursor: CursorDto | undefined): string[] {
  if (Array.isArray(cursor)) return cursor.map((item) => String(typeof item === 'object' ? item.stepId ?? item.id ?? '' : item)).filter(Boolean);
  if (cursor && typeof cursor === 'object') {
    if (Array.isArray(cursor.steps)) return cursor.steps.map(String).filter(Boolean);
    return [String(cursor.stepId ?? cursor.id ?? '')].filter(Boolean);
  }
  if (typeof cursor === 'string') return [cursor];
  return [];
}

function cursorDisplay(cursor: CursorDto | undefined): string | undefined {
  if (cursor && typeof cursor === 'object' && !Array.isArray(cursor)) return cursor.display || undefined;
  return undefined;
}

function normalizeArtifacts(artifacts: ArtifactDto[] | undefined): ArtifactDto[] {
  if (!Array.isArray(artifacts)) return [];
  return artifacts.map((artifact) => ({
    id: artifact.id,
    contentType: artifact.contentType ?? artifact.content_type,
    summary: artifact.summary,
  }));
}

function normalizeHistoryExcerpt(historyExcerpt: DashboardRunDto['historyExcerpt']): HistoryDto[] {
  if (Array.isArray(historyExcerpt)) return historyExcerpt;
  if (Array.isArray(historyExcerpt?.lines)) return historyExcerpt.lines.map((line) => ({ summary: line }));
  return [];
}

function normalizeDiagnostics(run: DashboardRunDto): DiagnosticDto[] {
  if (Array.isArray(run.diagnostics)) return run.diagnostics;
  if (run.degraded) return [{ severity: 'warning', message: run.degraded.message ?? run.degraded.reason ?? 'degraded read' }];
  return [];
}

function normalizeMiniMap(miniMap: DashboardRunDto['miniMap']): MiniMapDto[] {
  if (Array.isArray(miniMap)) return miniMap;
  if (!isMiniMapSummary(miniMap)) return [];
  const current = new Set(miniMap.currentSteps ?? []);
  const completed = new Set(miniMap.completedSteps ?? []);
  return [...new Set([...completed, ...current])].map((id) => ({
    id,
    state: current.has(id) ? 'active' : 'completed',
  }));
}

function isMiniMapSummary(miniMap: DashboardRunDto['miniMap']): miniMap is MiniMapSummaryDto {
  return Boolean(miniMap && !Array.isArray(miniMap) && typeof miniMap === 'object');
}

function labelForLane(laneId: DashboardLaneId): string {
  return dashboardLanes.find((lane) => lane.id === laneId)?.label ?? 'Degraded';
}
