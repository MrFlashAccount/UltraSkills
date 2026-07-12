import type {
  DashboardLaneId,
  RunDetailDTO,
  RunSummaryDTO,
  SnapshotEnvelope,
} from "../../contracts/browser";

const lanes: Array<DashboardLaneId> = [
  "waiting_for_user",
  "worker_running",
  "needs_help",
  "degraded",
  "done",
];
const nonWaiting: Array<DashboardLaneId> = ["worker_running", "needs_help", "degraded", "done"];
const nonDone: Array<DashboardLaneId> = [
  "waiting_for_user",
  "worker_running",
  "needs_help",
  "degraded",
];

export function buildSnapshot(
  count = 1000,
  distribution: "balanced" | "waiting" | "done" = "balanced",
): SnapshotEnvelope {
  const now = new Date().toISOString();
  const runs = Array.from({ length: count }, (_, index): RunSummaryDTO => {
    const laneId =
      distribution === "waiting"
        ? index < 900
          ? "waiting_for_user"
          : nonWaiting[index % nonWaiting.length]
        : distribution === "done"
          ? index < 900
            ? "done"
            : nonDone[index % nonDone.length]
          : lanes[index % lanes.length];
    return {
      createdAt: now,
      currentStep: `step_${index}_with_a_bounded_identifier`,
      cursor: { kind: "single", step: `step-${index}` },
      laneId,
      occupancy: { state: "unclaimed" },
      reason: {
        sourceClass: "public_diagnostic",
        value:
          laneId === "waiting_for_user"
            ? "Approval needed"
            : laneId === "needs_help"
              ? "Decision missing"
              : laneId === "degraded"
                ? "Read health"
                : "Status update",
        policyVersion: "1",
      },
      runId: `run-proof-${index.toString().padStart(4, "0")}`,
      status: "active",
      title: {
        sourceClass: "run_title",
        value:
          index === 0
            ? "A deliberately extremely long policy-approved title that remains bounded to two lines without forcing card growth"
            : `Observe workflow run ${index}`,
        policyVersion: "1",
      },
      updatedAt: now,
      workflow: index % 2 ? "dev-harness" : "research-critic",
    };
  });
  return {
    freshness: {
      state: "fresh",
      observerRevision: "12",
      lastRefreshAttemptAt: now,
      lastSuccessfulRefreshAt: now,
      staleSince: null,
      staleAfterMs: 600_000,
      retryAt: null,
    },
    generatedAt: now,
    runs,
    schemaVersion: "1",
    snapshotVersion: "12",
  };
}

export function detailFor(run: RunSummaryDTO): RunDetailDTO {
  return {
    ...run,
    artifacts: [{ id: "implementation-plan", contentType: "text/markdown" }],
    facts: [{ label: "Workflow", value: run.workflow }],
    history: [
      { sourceClass: "history_line", value: "Snapshot projected", policyVersion: "1" },
      { sourceClass: "history_line", value: "Awaiting inspection", policyVersion: "1" },
    ],
    historyTruncated: false,
    miniMap: {
      state: "available",
      steps: [
        { stepId: "research", state: "completed" },
        { stepId: "implementation", state: "current" },
        { stepId: "review", state: "pending" },
      ],
      truncated: false,
      totalSteps: 3,
    },
    results: [],
    schemaVersion: "1",
    summary: {
      sourceClass: "run_summary",
      value: "Policy-approved summary for rendered proof.",
      policyVersion: "1",
    },
  };
}
