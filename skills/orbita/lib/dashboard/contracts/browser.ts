/** Browser-safe, versioned dashboard contracts. No durable-state type may cross this boundary. */
import { z } from 'zod';

export const DASHBOARD_SCHEMA_VERSION = '1' as const;
export const EXPOSURE_POLICY_VERSION = '1' as const;

export const DASHBOARD_LANE_ORDER = [
  'waiting_for_user',
  'worker_running',
  'needs_help',
  'degraded',
  'done',
] as const;

export const DashboardLaneIdSchema = z.enum(DASHBOARD_LANE_ORDER);
export type DashboardLaneId = z.infer<typeof DashboardLaneIdSchema>;

export const PUBLIC_TEXT_LIMITS = {
  run_title: { codePoints: 160, utf8Bytes: 512 },
  run_summary: { codePoints: 500, utf8Bytes: 2_048 },
  artifact_summary: { codePoints: 240, utf8Bytes: 1_024 },
  result_summary: { codePoints: 240, utf8Bytes: 1_024 },
  history_line: { codePoints: 240, utf8Bytes: 1_024 },
  public_diagnostic: { codePoints: 80, utf8Bytes: 256 },
} as const;

export type PublicTextSource = keyof typeof PUBLIC_TEXT_LIMITS;
const PublicTextSourceSchema = z.enum(
  Object.keys(PUBLIC_TEXT_LIMITS) as [PublicTextSource, ...PublicTextSource[]],
);

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export const PublicDisplayTextSchema = z
  .object({
    sourceClass: PublicTextSourceSchema,
    value: z.string().min(1),
    policyVersion: z.literal(EXPOSURE_POLICY_VERSION),
  })
  .strict()
  .superRefine((text, context) => {
    const limits = PUBLIC_TEXT_LIMITS[text.sourceClass];
    if (Array.from(text.value).length > limits.codePoints) {
      context.addIssue({
        code: 'custom',
        message: 'public text exceeds its code-point ceiling',
        path: ['value'],
      });
    }
    if (utf8Length(text.value) > limits.utf8Bytes) {
      context.addIssue({
        code: 'custom',
        message: 'public text exceeds its UTF-8 byte ceiling',
        path: ['value'],
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

export const CursorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }).strict(),
  z.object({ kind: z.literal('single'), step: StepIdSchema }).strict(),
  z.object({ kind: z.literal('unsupported') }).strict(),
]);

export const OccupancySchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('unclaimed') }).strict(),
  z.object({ state: z.literal('occupied') }).strict(),
  z.object({ state: z.literal('stale') }).strict(),
]);

export const ObserverFreshnessSchema = z
  .object({
    state: z.enum(['fresh', 'stale']),
    observerRevision: z.string().regex(/^[1-9]\d*$/u),
    lastRefreshAttemptAt: IsoDateSchema,
    lastSuccessfulRefreshAt: IsoDateSchema.nullable(),
    staleSince: IsoDateSchema.nullable(),
    staleAfterMs: z.number().int().min(1_000).max(600_000),
    failureCode: z.enum(['observer_refresh_failed', 'observer_refresh_timeout']).optional(),
    retryAt: IsoDateSchema.nullable(),
  })
  .strict();

export const RunSummarySchema = z
  .object({
    runId: RunIdSchema,
    title: PublicDisplayTextSchema,
    reason: PublicDisplayTextSchema.optional(),
    workflow: WorkflowIdentitySchema,
    laneId: DashboardLaneIdSchema,
    status: z
      .string()
      .min(1)
      .max(48)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u)
      .optional(),
    createdAt: IsoDateSchema.optional(),
    updatedAt: IsoDateSchema.optional(),
    currentStep: StepIdSchema.optional(),
    cursor: CursorSchema,
    occupancy: OccupancySchema,
  })
  .strict();

export const SnapshotEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(DASHBOARD_SCHEMA_VERSION),
    snapshotVersion: z.string().regex(/^[1-9]\d*$/u),
    generatedAt: IsoDateSchema,
    freshness: ObserverFreshnessSchema,
    runs: z.array(RunSummarySchema).max(10_000),
  })
  .strict();

const DetailFactSchema = z
  .object({
    label: z.enum(['Run id', 'Workflow', 'Current step']),
    value: z
      .string()
      .min(1)
      .max(160)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u),
  })
  .strict();

const DetailArtifactSchema = z
  .object({
    producerStepId: StepIdSchema.optional(),
    id: ArtifactIdSchema,
    contentType: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[\w.+-]+\/[\w.+-]+$/u)
      .optional(),
    summary: PublicDisplayTextSchema.optional(),
  })
  .strict();

const DetailResultSchema = z
  .object({
    type: StepIdSchema.optional(),
    outcome: StepIdSchema.optional(),
    summary: PublicDisplayTextSchema.optional(),
    ref: ResultRefSchema.optional(),
  })
  .strict();

const MiniMapSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('unavailable') }).strict(),
  z
    .object({
      state: z.literal('available'),
      steps: z
        .array(
          z
            .object({
              stepId: StepIdSchema,
              state: z.enum(['completed', 'current', 'pending']),
            })
            .strict(),
        )
        .max(24),
      truncated: z.boolean(),
      totalSteps: z.number().int().min(0),
    })
    .strict(),
]);

export const RunDetailSchema = RunSummarySchema.extend({
  schemaVersion: z.literal(DASHBOARD_SCHEMA_VERSION),
  summary: PublicDisplayTextSchema.optional(),
  facts: z.array(DetailFactSchema).max(3),
  history: z.array(PublicDisplayTextSchema).max(20),
  historyTruncated: z.boolean(),
  artifacts: z.array(DetailArtifactSchema).max(100),
  results: z.array(DetailResultSchema).max(100),
  miniMap: MiniMapSchema,
})
  .strict()
  .superRefine((detail, context) => {
    const totalHistoryBytes = detail.history.reduce(
      (total, line) => total + utf8Length(line.value),
      0,
    );
    if (totalHistoryBytes > 8_192) {
      context.addIssue({
        code: 'custom',
        message: 'history exceeds its total UTF-8 byte ceiling',
        path: ['history'],
      });
    }
  });

export const InvalidationReasonSchema = z.enum([
  'snapshot_changed',
  'observer_stale',
  'observer_recovered',
]);

export const InvalidationEventSchema = z
  .object({
    schemaVersion: z.literal(DASHBOARD_SCHEMA_VERSION),
    type: z.literal('invalidation'),
    reason: InvalidationReasonSchema,
    changeId: z.string().regex(/^[1-9]\d*$/u),
    emittedAt: IsoDateSchema,
  })
  .strict();

const PUBLIC_ERROR_MESSAGES = [
  'Run not found',
  'Only GET is allowed',
  'Dashboard data is temporarily unavailable',
  'Run detail is temporarily unavailable',
  'Dashboard runs root is not configured',
  'Invalid run id',
  'Request authority is not allowed',
] as const;

export const PublicErrorSchema = z
  .object({
    error: z
      .object({
        code: z.enum([
          'not_found',
          'method_not_allowed',
          'observer_unavailable',
          'invalid_request',
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
export type InvalidationEvent = z.infer<typeof InvalidationEventSchema>;
