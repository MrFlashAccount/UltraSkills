export type DashboardLaneId = 'waiting_for_user' | 'worker_running' | 'blocked' | 'degraded' | 'done';

export type DashboardLane = {
  id: DashboardLaneId;
  label: string;
  tone: string;
};

export type DashboardSnapshot = {
  runs?: DashboardRunDto[];
  generatedAt?: string;
  rootLabel?: string;
};

export type DashboardRunDto = {
  id?: string;
  runId?: string;
  title?: string;
  summary?: string;
  promptSummary?: string;
  workflowName?: string;
  workflow?: { identity?: string };
  lane?: { id?: string; label?: string };
  laneId?: string;
  stepId?: string;
  currentStepId?: string;
  statusLabel?: string;
  updatedAt?: string;
  createdAt?: string;
  cursor?: CursorDto;
  cursorBranches?: CursorDto;
  artifacts?: ArtifactDto[];
  historyExcerpt?: HistoryDto[] | { lines?: string[] };
  miniMap?: MiniMapDto[] | MiniMapSummaryDto;
  diagnostics?: DiagnosticDto[];
  degraded?: { message?: string; reason?: string };
};

export type CursorDto = string | Array<string | { id?: string; stepId?: string }> | { display?: string; id?: string; stepId?: string; steps?: string[] };

export type ArtifactDto = {
  id?: string;
  name?: string;
  contentType?: string;
  content_type?: string;
  summary?: string;
};

export type HistoryDto = {
  at?: string;
  age?: string;
  summary?: string;
};

export type MiniMapDto = {
  id?: string;
  stepId?: string;
  state?: string;
};

export type MiniMapSummaryDto = {
  currentSteps?: string[];
  completedSteps?: string[];
  provenance?: string;
};

export type DiagnosticDto = {
  severity?: string;
  message?: string;
  summary?: string;
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
  artifacts: ArtifactDto[];
  historyExcerpt: HistoryDto[];
  diagnostics: DiagnosticDto[];
  miniMap: MiniMapDto[];
  miniMapProvenance?: string;
};
