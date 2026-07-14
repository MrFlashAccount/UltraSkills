import {
  RunLightDetailSchema,
  type DashboardLaneId,
  type RunLightDetailDTO,
  type RunSummaryDTO,
  type SnapshotEnvelope,
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
export const occurrenceRef = "occurrence_ref_proof_01";

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
      currentStep: `step-${index}`,
      cursor: { kind: "single", step: `step-${index}` },
      laneId,
      occupancy: { state: "unclaimed" },
      reason: publicText(
        laneId === "waiting_for_user"
          ? "Approval needed"
          : laneId === "needs_help"
            ? "Decision missing"
            : laneId === "degraded"
              ? "Read health"
              : "Status update",
        "public_diagnostic",
      ),
      runId: `run-proof-${index.toString().padStart(4, "0")}`,
      status: "active",
      title: publicText(
        index === 0 ? "Run detail inspection" : `Observe workflow run ${index}`,
        "run_title",
      ),
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
    schemaVersion: "2",
    snapshotVersion: "12",
  };
}

export function detailFor(run: RunSummaryDTO): RunLightDetailDTO {
  return RunLightDetailSchema.parse({
    currentOccurrence: { occurrenceRef, ordinal: 2, state: "current", stepId: "architecture" },
    occurrenceAvailability: "available",
    run,
    schemaVersion: "2",
    summary: publicText("Inspect workflow traversal, managed logs, and artifacts.", "run_summary"),
  });
}

export function resourcesFor(run: RunSummaryDTO) {
  const runId = run.runId;
  return {
    activity: {
      complete: true,
      items: [
        {
          event: publicText("Fanout activation 1 started", "activity_label"),
          occurredAt: run.updatedAt,
          producerRequestId: "request-proof-01",
          source: "route",
          state: "completed",
        },
        {
          event: publicText("spec_modeling accepted", "activity_label"),
          occurredAt: run.updatedAt,
          producerRequestId: "request-proof-01",
          source: "accepted_output",
          state: "accepted",
        },
      ],
      occurrenceRef,
      runId,
      schemaVersion: "2",
    },
    artifacts: {
      complete: true,
      items: [artifactDescriptor("architecture", 2), longIdentifierArtifact()],
      runAggregateCount: 3,
      runId,
      schemaVersion: "2",
      scope: { kind: "occurrence", occurrenceRef },
    },
    logs: {
      complete: true,
      entries: [
        {
          markdown: publicText(
            "## Managed evidence\n\nFanout activation 1 completed.",
            "managed_markdown",
          ),
          source: "workflow-runner",
        },
      ],
      occurrenceRef,
      runId,
      schemaVersion: "2",
    },
    workflowArtifacts: {
      complete: true,
      items: [artifactDescriptor("architecture", 2), longIdentifierArtifact()],
      runAggregateCount: 3,
      runId,
      schemaVersion: "2",
      scope: { kind: "workflow_step", stepId: "architecture" },
    },
    traversal: {
      availability: "available",
      complete: true,
      items: [
        {
          occurrenceRef: "occurrence_ref_proof_00",
          ordinal: 1,
          peers: [],
          state: "completed",
          stepId: "research",
        },
        {
          occurrenceRef: "occurrence_ref_proof_ui_01",
          ordinal: 1,
          peers: [],
          state: "completed",
          stepId: "ui_intent",
        },
        {
          occurrenceRef: "occurrence_ref_proof_arch_01",
          ordinal: 1,
          peers: [],
          state: "completed",
          stepId: "architecture",
        },
        {
          occurrenceRef: "occurrence_ref_proof_ui_02",
          ordinal: 2,
          peers: [],
          state: "completed",
          stepId: "ui_intent",
        },
        {
          occurrenceRef,
          ordinal: 2,
          peers: [
            {
              activation: 1,
              kind: "fanout_branch",
              producerRequestId: "request-proof-01",
              state: "accepted",
              workItem: "spec_modeling",
            },
          ],
          state: "current",
          stepId: "architecture",
        },
      ],
      runId,
      schemaVersion: "2",
    },
    workflow: {
      complete: true,
      edges: [{ from: "research", to: "architecture" }],
      nodes: [
        { kind: "worker", stepId: "research" },
        {
          kind: "fanout",
          parallelism: { count: 3, maxParallel: 2, mode: "branches" },
          stepId: "architecture",
        },
      ],
      runId,
      schemaVersion: "2",
      workflowFingerprint: "workflow_fingerprint_proof_01",
    },
  } as const;
}

function artifactDescriptor(producerStepId: string, producerOccurrence: number) {
  return {
    artifactRef: `artifact_ref_${producerStepId}_${producerOccurrence}`,
    declaredContentType: "image/png",
    effectiveContentType: "image/png",
    id: producerStepId === "research" ? "reasons-canvas-research.png" : "workflow-trail.png",
    mimeMismatch: false,
    previewState: "previewable",
    producerOccurrence,
    producerRequestId: `request-${producerStepId}`,
    producerStepId,
  } as const;
}

function longIdentifierArtifact() {
  return {
    artifactRef: "artifact_ref_long_identifier_0001",
    declaredContentType: "application/json",
    effectiveContentType: "application/json",
    id: "architecture-review-evidence-with-an-intentionally-long-identifier-for-contained-layout.json",
    mimeMismatch: false,
    previewState: "download_only",
    producerOccurrence: 2,
    producerRequestId: "request-architecture-long-identifier",
    producerStepId: "architecture",
  } as const;
}

function publicText(
  value: string,
  sourceClass:
    | "activity_label"
    | "managed_markdown"
    | "public_diagnostic"
    | "run_summary"
    | "run_title",
) {
  return { policyVersion: "2", sourceClass, value } as const;
}
