export type DashboardLaneId =
  | 'waiting_for_user'
  | 'worker_running'
  | 'blocked'
  | 'degraded'
  | 'done';

export type DashboardLane = {
  id: DashboardLaneId;
  label: string;
  tone: 'waiting' | 'running' | 'blocked' | 'degraded' | 'done';
};

export type DashboardArtifact = {
  id: string;
  contentType?: string;
  summary?: string;
};

export type DashboardDiagnostic = {
  severity: string;
  message: string;
};

export type DashboardMiniMapStep = {
  id: string;
  state: 'active' | 'completed' | 'pending' | string;
};

export type DashboardHistoryEntry = {
  at?: string;
  age?: string;
  summary: string;
};

export type DashboardRun = {
  id: string;
  laneId: DashboardLaneId;
  title: string;
  summary?: string;
  workflowName: string;
  stepId: string;
  statusLabel: string;
  updatedAt?: string;
  createdAt?: string;
  cursorBranches: string[];
  artifacts: DashboardArtifact[];
  historyExcerpt: DashboardHistoryEntry[];
  diagnostics: DashboardDiagnostic[];
  miniMap: DashboardMiniMapStep[];
  miniMapProvenance?: string;
};

export type DashboardSnapshot = {
  rootLabel?: string;
  generatedAt?: string;
  freshnessLabel?: string;
  selectedRunId?: string | null;
  searchQuery?: string;
  runs: DashboardRun[];
};

export type DashboardViewModel = {
  rootLabel: string;
  freshness: string;
  searchQuery: string;
  runs: DashboardRun[];
  selectedRun: DashboardRun | null;
  countsByLane: ReadonlyMap<DashboardLaneId, number>;
  lanes: readonly DashboardLane[];
  visibleRunsByLane: ReadonlyMap<DashboardLaneId, DashboardRun[]>;
};

export type DashboardLoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; snapshot: DashboardSnapshot }
  | { kind: 'error'; message: string; snapshot?: DashboardSnapshot };

export type DashboardEvent =
  | { type: 'dashboard.snapshot'; data?: unknown }
  | { type: 'dashboard.run_updated'; data: { runId: string } }
  | { type: 'dashboard.error'; data: { message: string } };
