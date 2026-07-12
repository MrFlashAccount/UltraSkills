import type {
  DashboardLaneId,
  RunDetailDTO,
  RunSummaryDTO,
  SnapshotEnvelope,
} from "@dashboard-contracts";

const timestamp = "2026-07-12T12:00:00.000Z";

export function makeRun(index = 1, laneId: DashboardLaneId = "waiting_for_user"): RunSummaryDTO {
  return {
    createdAt: timestamp,
    currentStep: `step-${index}`,
    cursor: { kind: "single", step: `step-${index}` },
    laneId,
    occupancy: { state: "unclaimed" },
    reason: {
      sourceClass: "public_diagnostic",
      value: laneId === "waiting_for_user" ? "Approval needed" : "Status update",
      policyVersion: "1",
    },
    runId: `run-${index}`,
    status: "active",
    title: { sourceClass: "run_title", value: `Run ${index} needs attention`, policyVersion: "1" },
    updatedAt: timestamp,
    workflow: index % 2 ? "dev-harness" : "research",
  };
}

export function makeSnapshot(runs: Array<RunSummaryDTO>): SnapshotEnvelope {
  return {
    freshness: {
      state: "fresh",
      observerRevision: "1",
      lastRefreshAttemptAt: timestamp,
      lastSuccessfulRefreshAt: timestamp,
      staleSince: null,
      staleAfterMs: 10_000,
      retryAt: null,
    },
    generatedAt: timestamp,
    runs,
    schemaVersion: "1",
    snapshotVersion: "1",
  };
}

export function makeDetail(run = makeRun()): RunDetailDTO {
  return {
    ...run,
    artifacts: [{ id: "ui-design-proposal", contentType: "text/html" }],
    facts: [{ label: "Workflow", value: "dev-harness" }],
    history: [{ sourceClass: "history_line", value: "Awaiting approval", policyVersion: "1" }],
    historyTruncated: false,
    miniMap: {
      state: "available",
      steps: [
        { stepId: "research", state: "completed" },
        { stepId: "implementation", state: "current" },
      ],
      truncated: false,
      totalSteps: 2,
    },
    results: [],
    schemaVersion: "1",
    summary: { sourceClass: "run_summary", value: "A bounded public summary.", policyVersion: "1" },
  };
}
