import type {
  DashboardLaneId,
  RunLightDetailDTO,
  RunSummaryDTO,
  SnapshotEnvelope,
} from "@dashboard-contracts";
import { RunLightDetailSchema } from "@dashboard-contracts";

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
      policyVersion: "2",
    },
    runId: `run-${index}`,
    status: "active",
    title: { sourceClass: "run_title", value: `Run ${index} needs attention`, policyVersion: "2" },
    updatedAt: timestamp,
    workflow: index % 2 ? "spdd" : "research",
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
    schemaVersion: "2",
    snapshotVersion: "1",
  };
}

export function makeDetail(run = makeRun()): RunLightDetailDTO {
  return RunLightDetailSchema.parse({
    run,
    schemaVersion: "2",
    summary: {
      policyVersion: "2",
      sourceClass: "run_summary",
      value: "A bounded public summary.",
    },
  });
}
