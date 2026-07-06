export type DashboardLaneId =
  | 'waiting_for_user'
  | 'worker_running'
  | 'blocked'
  | 'degraded'
  | 'done';

export type DashboardCursorDto = {
  kind?: string;
  steps?: unknown[];
  display?: unknown;
  stepId?: unknown;
  id?: unknown;
};

export type DashboardRunDto = {
  runId?: unknown;
  id?: unknown;
  title?: unknown;
  summary?: unknown;
  promptSummary?: unknown;
  workflow?: { identity?: unknown };
  workflowName?: unknown;
  status?: unknown;
  statusLabel?: unknown;
  lane?: { id?: unknown; label?: unknown };
  laneId?: unknown;
  cursor?: DashboardCursorDto | DashboardCursorDto[] | string;
  cursorBranches?: unknown[];
  stepId?: unknown;
  currentStepId?: unknown;
  updatedAt?: unknown;
  createdAt?: unknown;
  artifacts?: unknown[];
  results?: unknown[];
  historyExcerpt?: { lines?: unknown[] } | unknown[];
  miniMap?: {
    currentSteps?: unknown[];
    completedSteps?: unknown[];
    provenance?: unknown;
  } | unknown[];
  degraded?: { reason?: unknown; message?: unknown };
  diagnostics?: unknown[];
};

export type DashboardSnapshotDto = {
  rootLabel?: unknown;
  generatedAt?: unknown;
  freshnessLabel?: unknown;
  selectedRunId?: unknown;
  runs?: unknown[];
};

export type DashboardArtifact = {
  id: string;
  contentType: string;
  summary: string;
};

export type DashboardHistoryEntry = {
  summary: string;
  at: string;
  age: string;
};

export type DashboardDiagnostic = {
  severity: string;
  message: string;
};

export type DashboardMiniMapStep = {
  id: string;
  state: 'active' | 'completed' | 'pending' | 'blocked' | 'degraded' | string;
};

export type DashboardRun = {
  id: string;
  laneId: DashboardLaneId;
  title: string;
  summary: string;
  workflowName: string;
  stepId: string;
  statusLabel: string;
  updatedAt: string;
  createdAt: string;
  cursorBranches: string[];
  artifacts: DashboardArtifact[];
  historyExcerpt: DashboardHistoryEntry[];
  diagnostics: DashboardDiagnostic[];
  miniMap: DashboardMiniMapStep[];
  miniMapProvenance: string;
};

export type DashboardModel = {
  rootLabel: string;
  freshnessLabel: string;
  generatedAt: string;
  runs: DashboardRun[];
};

export type DashboardLane = {
  id: DashboardLaneId;
  label: string;
  tone: string;
};

export type DashboardViewModel = {
  query: string;
  selectedRunId: string | null;
  visibleRuns: DashboardRun[];
  selectedRun: DashboardRun | null;
  runsByLane: Map<DashboardLaneId, DashboardRun[]>;
};

export type DashboardClientEvent =
  | { type: 'snapshot' }
  | { type: 'run_updated'; runId: string }
  | { type: 'error'; message: string };
