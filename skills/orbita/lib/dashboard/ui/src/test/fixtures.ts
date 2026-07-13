import type {
  DashboardLaneId,
  RunActivityPageDTO,
  RunDetailDTO,
  RunOutputsDTO,
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
    facts: [{ label: "Workflow", value: "dev-harness" }],
    miniMap: {
      state: "available",
      steps: [
        {
          kind: "worker",
          nextStepIds: ["implementation"],
          stepId: "research",
          state: "completed",
        },
        {
          kind: "fanout",
          nextStepIds: ["done"],
          parallelism: { count: 3, maxParallel: 2, mode: "branches" },
          stepId: "implementation",
          state: "current",
        },
        {
          kind: "done",
          nextStepIds: [],
          stepId: "done",
          state: "pending",
        },
      ],
      truncated: false,
      totalSteps: 3,
    },
    schemaVersion: "1",
    summary: { sourceClass: "run_summary", value: "A bounded public summary.", policyVersion: "1" },
  };
}

export function makeActivityPage(runId = "run-1"): RunActivityPageDTO {
  return {
    activities: [
      {
        id: "activity-1",
        markdown: {
          sourceClass: "activity_markdown",
          value: `## ${timestamp}\n\n- source: workflow-runner\n\n## Awaiting approval\n\n- Ready for review`,
          policyVersion: "1",
        },
        occurredAt: timestamp,
        stepIds: ["research"],
      },
    ],
    nextCursor: null,
    runId,
    schemaVersion: "1",
  };
}

export function makeOutputs(runId = "run-1"): RunOutputsDTO {
  return {
    artifacts: [
      {
        id: "ui-design-proposal",
        contentType: "text/markdown",
        previewKind: "markdown",
        producerStepId: "research",
      },
    ],
    results: [],
    runId,
    schemaVersion: "1",
  };
}
