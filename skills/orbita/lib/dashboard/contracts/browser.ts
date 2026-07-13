/** Browser-safe, versioned dashboard contracts. No durable-state type may cross this boundary. */
import { z } from "zod";

export const DASHBOARD_SCHEMA_VERSION = "1" as const;
export const EXPOSURE_POLICY_VERSION = "1" as const;
export const RUN_ACTIVITY_PAGE_MAX_UTF8_BYTES = 128 * 1024;
export const RUN_DETAIL_MAX_UTF8_BYTES = 128 * 1024;
export const RUN_OUTPUTS_MAX_UTF8_BYTES = 128 * 1024;

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
  activity_markdown: { codePoints: 32_768, utf8Bytes: 65_536 },
  artifact_summary: { codePoints: 240, utf8Bytes: 1024 },
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
export const RunIdSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u);
export const WorkflowIdentitySchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u);
export const StepIdSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u);
const ArtifactIdSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u);
const ResultRefSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u);

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
    status: z
      .string()
      .min(1)
      .max(48)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u)
      .optional(),
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

const DetailFactSchema = z
  .object({
    label: z.enum(["Run id", "Workflow", "Current step"]),
    value: z
      .string()
      .min(1)
      .max(160)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u),
  })
  .strict();

export const DetailArtifactSchema = z
  .object({
    contentType: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[\w.+-]+\/[\w.+-]+$/u)
      .optional(),
    id: ArtifactIdSchema,
    previewKind: z.enum(["image", "markdown"]).optional(),
    producerStepId: StepIdSchema.optional(),
    summary: PublicDisplayTextSchema.optional(),
  })
  .strict();

export const DetailResultSchema = z
  .object({
    outcome: StepIdSchema.optional(),
    producerStepId: StepIdSchema.optional(),
    ref: ResultRefSchema.optional(),
    summary: PublicDisplayTextSchema.optional(),
    type: StepIdSchema.optional(),
  })
  .strict();

export const ActivityEntrySchema = z
  .object({
    id: z.string().regex(/^activity-[1-9]\d*$/u),
    markdown: PublicDisplayTextSchema,
    occurredAt: IsoDateSchema.optional(),
    stepIds: z.array(StepIdSchema).max(24),
  })
  .strict();

const WorkflowStepKindSchema = z.enum(["worker", "approval", "fanout", "shard", "done"]);
const ParallelismSchema = z
  .object({
    count: z.number().int().min(1).max(100).optional(),
    maxParallel: z.number().int().min(1).max(16).optional(),
    mode: z.enum(["branches", "shards"]),
  })
  .strict();

const MiniMapSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("unavailable") }).strict(),
  z
    .object({
      state: z.literal("available"),
      steps: z
        .array(
          z
            .object({
              kind: WorkflowStepKindSchema,
              nextStepIds: z.array(StepIdSchema).max(24),
              parallelism: ParallelismSchema.optional(),
              state: z.enum(["completed", "current", "pending"]),
              stepId: StepIdSchema,
            })
            .strict(),
        )
        .max(100),
      totalSteps: z.number().int().min(0),
      truncated: z.boolean(),
    })
    .strict(),
]);

export const RunDetailSchema = RunSummarySchema.extend({
  facts: z.array(DetailFactSchema).max(3),
  miniMap: MiniMapSchema,
  schemaVersion: z.literal(DASHBOARD_SCHEMA_VERSION),
  summary: PublicDisplayTextSchema.optional(),
}).strict();

export const RunActivityPageSchema = z
  .object({
    activities: z.array(ActivityEntrySchema).max(20),
    nextCursor: z.string().regex(/^\d+$/u).nullable(),
    runId: RunIdSchema,
    schemaVersion: z.literal(DASHBOARD_SCHEMA_VERSION),
  })
  .strict();

export const RunOutputsSchema = z
  .object({
    artifacts: z.array(DetailArtifactSchema).max(100),
    results: z.array(DetailResultSchema).max(100),
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

const PUBLIC_ERROR_MESSAGES = [
  "Run not found",
  "Only GET is allowed",
  "Dashboard data is temporarily unavailable",
  "Run detail is temporarily unavailable",
  "Dashboard runs root is not configured",
  "Invalid activity cursor",
  "Invalid run id",
  "Invalid step id",
  "Request authority is not allowed",
] as const;

export const PublicErrorSchema = z
  .object({
    error: z
      .object({
        code: z.enum([
          "not_found",
          "method_not_allowed",
          "observer_unavailable",
          "invalid_request",
        ]),
        message: z.enum(PUBLIC_ERROR_MESSAGES),
      })
      .strict(),
  })
  .strict();

export type CursorDTO = z.infer<typeof CursorSchema>;
export type ObserverFreshnessDTO = z.infer<typeof ObserverFreshnessSchema>;
export type RunSummaryDTO = z.infer<typeof RunSummarySchema>;
export type SnapshotEnvelope = z.infer<typeof SnapshotEnvelopeSchema>;
export type RunDetailDTO = z.infer<typeof RunDetailSchema>;
export type RunActivityPageDTO = z.infer<typeof RunActivityPageSchema>;
export type RunOutputsDTO = z.infer<typeof RunOutputsSchema>;
export type InvalidationEvent = z.infer<typeof InvalidationEventSchema>;
