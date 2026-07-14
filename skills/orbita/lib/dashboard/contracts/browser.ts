/** Browser-safe dashboard v2 contracts. Durable records, paths, and control data never cross this boundary. */
import { z } from "zod";

export const DASHBOARD_SCHEMA_VERSION = "2" as const;
export const EXPOSURE_POLICY_VERSION = "2" as const;

export const DASHBOARD_RESOURCE_LIMITS = {
  snapshotBytes: 1_572_864,
  pageBytes: 65_536,
  workflowPageBytes: 262_144,
  workflowSteps: 200,
  traversalSteps: 100,
  activityEvents: 200,
  artifacts: 100,
  textBytes: 1_048_576,
  activeBytes: 2_097_152,
  rasterPdfBytes: 33_554_432,
  mediaBytes: 67_108_864,
  mimeProbeBytes: 8192,
} as const;

export const DASHBOARD_LANE_ORDER = [
  "waiting_for_user",
  "worker_running",
  "needs_help",
  "degraded",
  "done",
] as const;

export const DashboardLaneIdSchema = z.enum(DASHBOARD_LANE_ORDER);
export type DashboardLaneId = z.infer<typeof DashboardLaneIdSchema>;

export const PUBLIC_TEXT_LIMITS = {
  artifact_summary: { codePoints: 240, utf8Bytes: 1024 },
  managed_markdown: { codePoints: 262_144, utf8Bytes: DASHBOARD_RESOURCE_LIMITS.textBytes },
  activity_label: { codePoints: 240, utf8Bytes: 1024 },
  public_diagnostic: { codePoints: 80, utf8Bytes: 256 },
  result_summary: { codePoints: 240, utf8Bytes: 1024 },
  run_summary: { codePoints: 500, utf8Bytes: 2048 },
  run_title: { codePoints: 160, utf8Bytes: 512 },
} as const;

export type PublicTextSource = keyof typeof PUBLIC_TEXT_LIMITS;
const PublicTextSourceSchema = z.enum(
  Object.keys(PUBLIC_TEXT_LIMITS) as [PublicTextSource, ...Array<PublicTextSource>],
);

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export const PublicDisplayTextSchema = z
  .object({
    policyVersion: z.literal(EXPOSURE_POLICY_VERSION),
    sourceClass: PublicTextSourceSchema,
    value: z.string().min(1),
  })
  .strict()
  .superRefine((text, context) => {
    const limits = PUBLIC_TEXT_LIMITS[text.sourceClass];
    if (Array.from(text.value).length > limits.codePoints) {
      context.addIssue({
        code: "custom",
        message: "public text exceeds its code-point ceiling",
        path: ["value"],
      });
    }
    if (utf8Length(text.value) > limits.utf8Bytes) {
      context.addIssue({
        code: "custom",
        message: "public text exceeds its UTF-8 byte ceiling",
        path: ["value"],
      });
    }
  });
export type PublicDisplayText = z.infer<typeof PublicDisplayTextSchema>;

const IsoDateSchema = z.string().datetime({ offset: true });
const SafeIdentifierSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u);
export const RunIdSchema = SafeIdentifierSchema;
export const WorkflowIdentitySchema = SafeIdentifierSchema;
export const StepIdSchema = SafeIdentifierSchema;
export const ArtifactIdSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u);

const OpaqueLocatorSchema = z
  .string()
  .min(16)
  .max(512)
  .regex(/^[A-Za-z0-9_-]+$/u);
export const ArtifactRefSchema = OpaqueLocatorSchema.brand("ArtifactRef");
export const PageCursorSchema = OpaqueLocatorSchema.brand("PageCursor");

export const CursorSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }).strict(),
  z.object({ kind: z.literal("single"), step: StepIdSchema }).strict(),
  z.object({ kind: z.literal("unsupported") }).strict(),
]);

export const OccupancySchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("unclaimed") }).strict(),
  z.object({ state: z.literal("occupied") }).strict(),
  z.object({ state: z.literal("stale") }).strict(),
]);

export const ObserverFreshnessSchema = z
  .object({
    failureCode: z.enum(["observer_refresh_failed", "observer_refresh_timeout"]).optional(),
    lastRefreshAttemptAt: IsoDateSchema,
    lastSuccessfulRefreshAt: IsoDateSchema.nullable(),
    observerRevision: z.string().regex(/^[1-9]\d*$/u),
    retryAt: IsoDateSchema.nullable(),
    staleAfterMs: z.number().int().min(1000).max(600_000),
    staleSince: IsoDateSchema.nullable(),
    state: z.enum(["fresh", "stale"]),
  })
  .strict();

export const RunSummarySchema = z
  .object({
    createdAt: IsoDateSchema.optional(),
    currentStep: StepIdSchema.optional(),
    cursor: CursorSchema,
    laneId: DashboardLaneIdSchema,
    occupancy: OccupancySchema,
    reason: PublicDisplayTextSchema.optional(),
    runId: RunIdSchema,
    status: SafeIdentifierSchema.optional(),
    title: PublicDisplayTextSchema,
    updatedAt: IsoDateSchema.optional(),
    workflow: WorkflowIdentitySchema,
  })
  .strict();

export const SnapshotEnvelopeSchema = z
  .object({
    freshness: ObserverFreshnessSchema,
    generatedAt: IsoDateSchema,
    runs: z.array(RunSummarySchema).max(10_000),
    schemaVersion: z.literal(DASHBOARD_SCHEMA_VERSION),
    snapshotVersion: z.string().regex(/^[1-9]\d*$/u),
  })
  .strict();

export const RunLightDetailSchema = z
  .object({
    run: RunSummarySchema,
    schemaVersion: z.literal(DASHBOARD_SCHEMA_VERSION),
    summary: PublicDisplayTextSchema.optional(),
  })
  .strict();

const WorkflowStepKindSchema = z.enum(["worker", "approval", "fanout", "shard", "done"]);
export const WorkflowNodeSchema = z
  .object({
    kind: WorkflowStepKindSchema,
    parallelism: z
      .object({
        count: z.number().int().min(1).max(100_000).optional(),
        maxParallel: z.number().int().min(1).max(16).optional(),
        mode: z.enum(["branches", "shards"]),
      })
      .strict()
      .optional(),
    stepId: StepIdSchema,
  })
  .strict();

export const WorkflowEdgeSchema = z.object({ from: StepIdSchema, to: StepIdSchema }).strict();
export const WorkflowPageSchema = z
  .object({
    complete: z.boolean(),
    edges: z.array(WorkflowEdgeSchema).max(400),
    nextCursor: PageCursorSchema.optional(),
    nodes: z.array(WorkflowNodeSchema).max(DASHBOARD_RESOURCE_LIMITS.workflowSteps),
    runId: RunIdSchema,
    schemaVersion: z.literal(DASHBOARD_SCHEMA_VERSION),
    truncated: z.boolean().optional(),
    workflowFingerprint: OpaqueLocatorSchema,
  })
  .strict();

export const ActivationPeerSchema = z
  .object({
    activation: z.number().int().min(1),
    kind: z.enum(["fanout_branch", "shard"]),
    producerRequestId: SafeIdentifierSchema,
    state: z.enum(["pending", "accepted", "stopped"]),
    workItem: z.union([z.string().min(1).max(160), z.number().int().min(0)]),
  })
  .strict();

export const TraversalStepSchema = z
  .object({
    peers: z.array(ActivationPeerSchema).max(1000),
    state: z.enum(["current", "completed"]),
    stepId: StepIdSchema,
  })
  .strict();
export const TraversalStepTransitionSchema = z
  .object({
    from: StepIdSchema,
    to: StepIdSchema,
  })
  .strict();
export const TraversalPageSchema = z
  .object({
    complete: z.boolean(),
    items: z.array(TraversalStepSchema).max(DASHBOARD_RESOURCE_LIMITS.traversalSteps),
    nextCursor: PageCursorSchema.optional(),
    runId: RunIdSchema,
    schemaVersion: z.literal(DASHBOARD_SCHEMA_VERSION),
    transitions: z
      .array(TraversalStepTransitionSchema)
      .max(DASHBOARD_RESOURCE_LIMITS.traversalSteps)
      .optional(),
    truncated: z.boolean().optional(),
  })
  .strict();

export const ActivityEventSchema = z
  .object({
    event: PublicDisplayTextSchema,
    occurredAt: IsoDateSchema.optional(),
    producerRequestId: SafeIdentifierSchema.optional(),
    source: z.enum([
      "route",
      "request",
      "accepted_output",
      "pointer_route",
      "coverage_seed",
      "stop_reported",
      "stop_resolved",
    ]),
    state: z.enum(["pending", "accepted", "completed", "stopped"]).optional(),
  })
  .strict();
export const ActivityPageSchema = z
  .object({
    complete: z.boolean(),
    items: z.array(ActivityEventSchema).max(DASHBOARD_RESOURCE_LIMITS.activityEvents),
    nextCursor: PageCursorSchema.optional(),
    runId: RunIdSchema,
    schemaVersion: z.literal(DASHBOARD_SCHEMA_VERSION),
    stepId: StepIdSchema,
    truncated: z.boolean().optional(),
  })
  .strict();

export const ManagedLogEntrySchema = z
  .object({
    markdown: PublicDisplayTextSchema,
    occurredAt: IsoDateSchema.optional(),
    redacted: z.boolean().optional(),
    source: z.enum([
      "workflow-runner",
      "workflow-runner-continue",
      "workflow-runner-write-output",
      "workflow-runner-move-pointer",
      "workflow-runner-report-stop",
      "workflow-runner-resolve-stop",
    ]),
    truncated: z.boolean().optional(),
  })
  .strict();
export const LogsPageSchema = z
  .object({
    complete: z.boolean(),
    entries: z.array(ManagedLogEntrySchema).max(200),
    nextCursor: PageCursorSchema.optional(),
    runId: RunIdSchema,
    schemaVersion: z.literal(DASHBOARD_SCHEMA_VERSION),
    stepId: StepIdSchema,
    truncated: z.boolean().optional(),
  })
  .strict();

export const PreviewStateSchema = z.enum([
  "previewable",
  "download_only",
  "unsupported",
  "oversized",
]);
export const ArtifactDescriptorSchema = z
  .object({
    artifactRef: ArtifactRefSchema.optional(),
    declaredContentType: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[\w.+-]+\/[\w.+-]+$/u),
    effectiveContentType: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[\w.+-]+\/[\w.+-]+$/u),
    id: ArtifactIdSchema,
    mimeMismatch: z.boolean(),
    previewState: PreviewStateSchema,
    producerStepId: StepIdSchema,
    summary: PublicDisplayTextSchema.optional(),
  })
  .strict();
export const ArtifactPageSchema = z
  .object({
    complete: z.boolean(),
    items: z.array(ArtifactDescriptorSchema).max(DASHBOARD_RESOURCE_LIMITS.artifacts),
    nextCursor: PageCursorSchema.optional(),
    scope: z.object({ kind: z.literal("workflow_step"), stepId: StepIdSchema }).strict(),
    runAggregateCount: z.number().int().min(0),
    runId: RunIdSchema,
    schemaVersion: z.literal(DASHBOARD_SCHEMA_VERSION),
  })
  .strict();

export const InvalidationReasonSchema = z.enum([
  "snapshot_changed",
  "observer_stale",
  "observer_recovered",
]);
export const InvalidationEventSchema = z
  .object({
    changeId: z.string().regex(/^[1-9]\d*$/u),
    emittedAt: IsoDateSchema,
    reason: InvalidationReasonSchema,
    schemaVersion: z.literal(DASHBOARD_SCHEMA_VERSION),
    type: z.literal("invalidation"),
  })
  .strict();

export const PublicErrorSchema = z
  .object({
    error: z
      .object({
        code: z.enum([
          "not_found",
          "method_not_allowed",
          "observer_unavailable",
          "invalid_request",
          "stale_locator",
          "range_not_satisfiable",
          "content_unavailable",
        ]),
        message: z.enum([
          "Run not found",
          "Resource not found",
          "Only GET is allowed",
          "Dashboard data is temporarily unavailable",
          "Dashboard runs root is not configured",
          "Invalid request",
          "Resource locator is stale",
          "Requested range is not satisfiable",
          "Artifact content is unavailable",
        ]),
      })
      .strict(),
  })
  .strict();

export type CursorDTO = z.infer<typeof CursorSchema>;
export type ObserverFreshnessDTO = z.infer<typeof ObserverFreshnessSchema>;
export type RunSummaryDTO = z.infer<typeof RunSummarySchema>;
export type SnapshotEnvelope = z.infer<typeof SnapshotEnvelopeSchema>;
export type RunLightDetailDTO = z.infer<typeof RunLightDetailSchema>;
export type WorkflowPageDTO = z.infer<typeof WorkflowPageSchema>;
export type TraversalPageDTO = z.infer<typeof TraversalPageSchema>;
export type ActivityPageDTO = z.infer<typeof ActivityPageSchema>;
export type LogsPageDTO = z.infer<typeof LogsPageSchema>;
export type ArtifactPageDTO = z.infer<typeof ArtifactPageSchema>;
export type ArtifactDescriptorDTO = z.infer<typeof ArtifactDescriptorSchema>;
export type InvalidationEvent = z.infer<typeof InvalidationEventSchema>;
