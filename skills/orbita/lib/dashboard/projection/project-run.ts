/** Pure durable-state to bounded public DTO projections. */
import {
  RunDetailSchema,
  RunSummarySchema,
  type CursorDTO,
  type RunDetailDTO,
  type RunSummaryDTO,
} from "../contracts/browser";
import { exposeIdentifier, exposePublicText, fixedPublicText } from "./exposure-policy";
import { classifyDashboardLane } from "./lane-classifier";

function cursorProjection(cursor: unknown): CursorDTO {
  if (cursor == null || cursor === "") {
    return { kind: "none" };
  }
  if (typeof cursor === "string") {
    const step = exposeIdentifier("step_id", cursor);
    return step ? { kind: "single", step } : { kind: "unsupported" };
  }
  if (Array.isArray(cursor) && cursor.length === 0) {
    return { kind: "none" };
  }
  if (Array.isArray(cursor) && cursor.length === 1) {
    const step = exposeIdentifier("step_id", cursor[0]);
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

function projectArtifacts(state: any): RunDetailDTO["artifacts"] {
  if (!Array.isArray(state?.artifacts)) {
    return [];
  }
  return state.artifacts.slice(0, 100).flatMap((entry: any) => {
    const artifact = entry?.artifact ?? entry;
    const id = exposeIdentifier("artifact_id", artifact?.id);
    if (!id) {
      return [];
    }
    const producerStepId = exposeIdentifier("step_id", entry?.producerStepId);
    const summary = exposePublicText("artifact_summary", artifact?.summary);
    const contentType =
      typeof artifact?.content_type === "string" &&
      /^[\w.+-]+\/[\w.+-]+$/u.test(artifact.content_type)
        ? artifact.content_type.slice(0, 120)
        : undefined;
    return [
      {
        id,
        ...(producerStepId ? { producerStepId } : {}),
        ...(contentType ? { contentType } : {}),
        ...(summary ? { summary } : {}),
      },
    ];
  });
}

function projectResults(state: any): RunDetailDTO["results"] {
  if (!Array.isArray(state?.results)) {
    return [];
  }
  return state.results
    .slice(0, 100)
    .map((result: any) => {
      const type = exposeIdentifier("step_id", result?.type);
      const outcome = exposeIdentifier("step_id", result?.outcome);
      const summary = exposePublicText("result_summary", result?.summary);
      const ref = exposeIdentifier("result_ref", result?.ref);
      return {
        ...(type ? { type } : {}),
        ...(outcome ? { outcome } : {}),
        ...(summary ? { summary } : {}),
        ...(ref ? { ref } : {}),
      };
    })
    .filter((result: object) => Object.keys(result).length > 0);
}

function projectHistory(historyInput: any): Pick<RunDetailDTO, "history" | "historyTruncated"> {
  const raw = historyInput?.mode === "embedded-text" ? String(historyInput.text ?? "") : "";
  const lines = raw.replaceAll("\r\n", "\n").split("\n");
  const candidates = lines.flatMap((line) => {
    const value = exposePublicText("history_line", line);
    return value ? [value] : [];
  });
  const history: RunDetailDTO["history"] = [];
  let totalBytes = 0;
  for (const value of candidates) {
    const nextBytes = new TextEncoder().encode(value.value).byteLength;
    if (history.length >= 20 || totalBytes + nextBytes > 8192) {
      break;
    }
    history.push(value);
    totalBytes += nextBytes;
  }
  return {
    history,
    historyTruncated:
      history.length < candidates.length || new TextEncoder().encode(raw).byteLength > 8192,
  };
}

function projectMiniMap(workflowDocument: any, baton: any): RunDetailDTO["miniMap"] {
  if (
    !workflowDocument?.steps ||
    typeof workflowDocument.steps !== "object" ||
    Array.isArray(workflowDocument.steps)
  ) {
    return { state: "unavailable" };
  }
  const cursor = cursorProjection(baton?.cursor);
  const state =
    baton?.state && typeof baton.state === "object" && !Array.isArray(baton.state)
      ? baton.state
      : {};
  const stepIds = Object.keys(workflowDocument.steps).flatMap((stepId) => {
    const safe = exposeIdentifier("step_id", stepId);
    return safe ? [safe] : [];
  });
  const steps = stepIds.slice(0, 24).map((stepId) => ({
    state: Object.hasOwn(state, stepId)
      ? ("completed" as const)
      : cursor.kind === "single" && cursor.step === stepId
        ? ("current" as const)
        : ("pending" as const),
    stepId,
  }));
  return {
    state: "available",
    steps,
    totalSteps: stepIds.length,
    truncated: stepIds.length > steps.length,
  };
}

export function projectRunDetail(
  input: { degraded?: boolean; persistedState?: any; run: any; workflowDocument?: any },
  options: { now?: Date } = {},
): RunDetailDTO {
  const summary = baseProjection(
    input.run,
    input.persistedState,
    Boolean(input.degraded),
    options.now ?? new Date(),
  );
  const state = input.persistedState?.baton?.state ?? {};
  const publicSummary = exposePublicText("run_summary", input.run?.summary);
  const history = projectHistory(input.persistedState?.history);
  return RunDetailSchema.parse({
    ...summary,
    schemaVersion: "1",
    ...(publicSummary ? { summary: publicSummary } : {}),
    facts: [
      { label: "Run id", value: summary.runId },
      { label: "Workflow", value: summary.workflow },
      ...(summary.currentStep ? [{ label: "Current step", value: summary.currentStep }] : []),
    ],
    ...history,
    artifacts: projectArtifacts(state),
    miniMap: projectMiniMap(input.workflowDocument, input.persistedState?.baton),
    results: projectResults(state),
  });
}
