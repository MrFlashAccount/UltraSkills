/** Pure durable-state projection for the zero-history board and light run detail. */
import {
  RunLightDetailSchema,
  RunSummarySchema,
  type CursorDTO,
  type RunLightDetailDTO,
  type RunSummaryDTO,
} from "../contracts/browser";
import { exposeIdentifier, exposePublicText, fixedPublicText } from "./exposure-policy";
import { classifyDashboardLane } from "./lane-classifier";

function cursorProjection(cursor: unknown): CursorDTO {
  if (cursor == null || cursor === "" || (Array.isArray(cursor) && cursor.length === 0)) {
    return { kind: "none" };
  }
  const candidate = Array.isArray(cursor) && cursor.length === 1 ? cursor[0] : cursor;
  if (typeof candidate === "string") {
    const step = exposeIdentifier("step_id", candidate);
    return step ? { kind: "single", step } : { kind: "unsupported" };
  }
  return { kind: "unsupported" };
}

function occupancyProjection(workerLease: any, now: Date): RunSummaryDTO["occupancy"] {
  const leaseExpiresAt = workerLease?.leaseExpiresAt;
  if (typeof leaseExpiresAt !== "string" || !Number.isFinite(Date.parse(leaseExpiresAt))) {
    return { state: "unclaimed" };
  }
  return Date.parse(leaseExpiresAt) > now.getTime() ? { state: "occupied" } : { state: "stale" };
}

function safeDate(value: unknown): string | undefined {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : undefined;
}

function baseProjection(
  run: any,
  persistedState: any,
  degraded: boolean,
  now: Date,
): RunSummaryDTO {
  const baton = persistedState?.baton;
  const cursor = cursorProjection(baton?.cursor);
  const workflow = exposeIdentifier("workflow_identity", run?.workflow?.identity) ?? "unknown";
  const title =
    exposePublicText("run_title", run?.title) ?? fixedPublicText("run_title", "Untitled run");
  const reason = degraded
    ? fixedPublicText("public_diagnostic", "Run data could not be read")
    : cursor.kind === "unsupported"
      ? fixedPublicText("public_diagnostic", "Unsupported cursor state")
      : undefined;
  const status = exposeIdentifier("step_id", baton?.status ?? run?.status);
  return RunSummarySchema.parse({
    runId: run?.runId,
    title,
    ...(reason ? { reason } : {}),
    laneId: classifyDashboardLane({
      run,
      baton,
      degraded,
      unsupportedCursor: cursor.kind === "unsupported",
    }),
    workflow,
    ...(status ? { status } : {}),
    ...(safeDate(run?.createdAt) ? { createdAt: safeDate(run.createdAt) } : {}),
    ...(safeDate(run?.updatedAt) ? { updatedAt: safeDate(run.updatedAt) } : {}),
    ...(cursor.kind === "single" ? { currentStep: cursor.step } : {}),
    cursor,
    occupancy: occupancyProjection(run?.workerLease, now),
  });
}

export function projectRunSummary(
  input: { degraded?: boolean; persistedState?: any; run: any },
  options: { now?: Date } = {},
): RunSummaryDTO {
  return baseProjection(
    input.run,
    input.persistedState,
    Boolean(input.degraded),
    options.now ?? new Date(),
  );
}

export function projectRunLightDetail(
  input: { degraded?: boolean; persistedState?: any; run: any },
  options: {
    encodeOccurrenceRef: (value: { ordinal: number; runId: string; stepId: string }) => string;
    now?: Date;
  },
): RunLightDetailDTO {
  const run = baseProjection(
    input.run,
    input.persistedState,
    Boolean(input.degraded),
    options.now ?? new Date(),
  );
  const provenance = input.persistedState?.baton?.state?.$occurrenceProvenance;
  const current = provenance?.current;
  const firstAvailable = provenance?.coverage?.firstAvailableByStep?.[current?.ownerStepId];
  const currentAvailable =
    provenance?.coverage?.mode === "complete" ||
    (Number.isInteger(firstAvailable) && current?.occurrence >= firstAvailable) ||
    (firstAvailable === undefined && provenance?.coverage?.currentAvailable === true);
  const safeStepId = exposeIdentifier("step_id", current?.ownerStepId);
  const currentOccurrence =
    currentAvailable &&
    safeStepId &&
    Number.isInteger(current?.occurrence) &&
    current.occurrence >= 1
      ? {
          occurrenceRef: options.encodeOccurrenceRef({
            runId: run.runId,
            stepId: safeStepId,
            ordinal: current.occurrence,
          }),
          ordinal: current.occurrence,
          state: "current" as const,
          stepId: safeStepId,
        }
      : null;
  const summary = exposePublicText("run_summary", input.run?.summary);
  return RunLightDetailSchema.parse({
    currentOccurrence,
    occurrenceAvailability: currentAvailable ? "available" : "legacy_unavailable",
    run,
    schemaVersion: "2",
    ...(summary ? { summary } : {}),
  });
}
