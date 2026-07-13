/** Pure durable-state to bounded public DTO projections. */
import {
  RunActivityPageSchema,
  RunDetailSchema,
  RunOutputsSchema,
  RunSummarySchema,
  type CursorDTO,
  type RunActivityPageDTO,
  type RunDetailDTO,
  type RunOutputsDTO,
  type RunSummaryDTO,
} from "../contracts/browser";
import {
  exposeIdentifier,
  exposePublicMarkdown,
  exposePublicText,
  fixedPublicText,
} from "./exposure-policy";
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

const PREVIEW_IMAGE_TYPES = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);

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

function projectArtifacts(state: any): RunOutputsDTO["artifacts"] {
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
    const previewKind =
      producerStepId && typeof artifact?.path === "string" && contentType === "text/markdown"
        ? ("markdown" as const)
        : producerStepId &&
            typeof artifact?.path === "string" &&
            PREVIEW_IMAGE_TYPES.has(contentType ?? "")
          ? ("image" as const)
          : undefined;
    return [
      {
        id,
        ...(producerStepId ? { producerStepId } : {}),
        ...(contentType ? { contentType } : {}),
        ...(previewKind ? { previewKind } : {}),
        ...(summary ? { summary } : {}),
      },
    ];
  });
}

function projectResult(result: any, producerStepId?: string): RunOutputsDTO["results"][number] {
  const type = exposeIdentifier("step_id", result?.type);
  const outcome = exposeIdentifier("step_id", result?.outcome ?? result?.status);
  const summary = exposePublicText("result_summary", result?.summary);
  const ref = exposeIdentifier("result_ref", result?.ref);
  return {
    ...(producerStepId ? { producerStepId } : {}),
    ...(type ? { type } : {}),
    ...(outcome ? { outcome } : {}),
    ...(summary ? { summary } : {}),
    ...(ref ? { ref } : {}),
  };
}

function projectResults(state: any): RunOutputsDTO["results"] {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return [];
  }
  const projected: RunOutputsDTO["results"] = [];
  const attributedFingerprints = new Set<string>();
  for (const [rawStepId, output] of Object.entries(state)) {
    const producerStepId = exposeIdentifier("step_id", rawStepId);
    if (!producerStepId || !Array.isArray((output as any)?.results)) {
      continue;
    }
    for (const result of (output as any).results) {
      const item = projectResult(result, producerStepId);
      if (Object.keys(item).length <= 1) {
        continue;
      }
      projected.push(item);
      attributedFingerprints.add(JSON.stringify(projectResult(result)));
    }
  }
  for (const result of Array.isArray(state.results) ? state.results : []) {
    const item = projectResult(result);
    if (!Object.keys(item).length || attributedFingerprints.has(JSON.stringify(item))) {
      continue;
    }
    projected.push(item);
  }
  return projected.slice(0, 100);
}

function historyBlocks(raw: string): Array<string> {
  const starts = [...raw.matchAll(/^##\s+.+$/gmu)].map((match) => match.index ?? 0);
  if (!starts.length) {
    return raw.trim() ? [raw] : [];
  }
  return starts.map((start, index) => raw.slice(start, starts[index + 1] ?? raw.length));
}

function historyStepIds(block: string): Array<string> {
  const explicitLines = block
    .split("\n")
    .filter((line) => /^-\s+(?:requests|steps|accepted output summary):/u.test(line));
  const candidates = explicitLines.flatMap((line) =>
    [...line.matchAll(/(?:^|[;\s])(?:id|step)=([A-Za-z0-9][A-Za-z0-9._:-]*)/gu)].map(
      (match) => match[1],
    ),
  );
  if (!candidates.length) {
    const cursor = block.match(/^-\s+baton:\s+cursor=([A-Za-z0-9][A-Za-z0-9._:-]*)/mu)?.[1];
    if (cursor && cursor !== "unknown") {
      candidates.push(cursor);
    }
  }
  return [
    ...new Set(
      candidates.flatMap((candidate) => {
        if (!candidate) {
          return [];
        }
        const fanoutBranch = candidate.match(/__fanout__\d+__([A-Za-z0-9][A-Za-z0-9._:-]*)$/u)?.[1];
        const shardOwner = candidate.match(/^([A-Za-z0-9][A-Za-z0-9._:-]*)__shard__\d+/u)?.[1];
        const safe = exposeIdentifier("step_id", fanoutBranch ?? shardOwner ?? candidate);
        return safe ? [safe] : [];
      }),
    ),
  ].slice(0, 24);
}

function projectActivityPage(
  runId: string,
  historyInput: any,
  options: { cursor?: number; limit?: number; stepId?: string } = {},
): RunActivityPageDTO {
  const raw = historyInput?.mode === "embedded-text" ? String(historyInput.text ?? "") : "";
  const candidates = historyBlocks(raw.replaceAll("\r\n", "\n"));
  const activities: RunActivityPageDTO["activities"] = [];
  const cursor = options.cursor ?? 0;
  const limit = Math.min(20, Math.max(1, options.limit ?? 20));
  let nextCursor: string | null = null;
  for (let index = cursor; index < candidates.length; index++) {
    const block = candidates[index];
    if (!block) {
      continue;
    }
    const stepIds = historyStepIds(block);
    if (options.stepId && stepIds.every((stepId) => stepId !== options.stepId)) {
      continue;
    }
    const markdown = exposePublicMarkdown(block);
    if (!markdown) {
      continue;
    }
    if (activities.length >= limit) {
      nextCursor = String(index);
      break;
    }
    const rawDate = block.match(/^##\s+([^\n]+)$/mu)?.[1];
    activities.push({
      id: `activity-${index + 1}`,
      markdown,
      ...(safeDate(rawDate) ? { occurredAt: safeDate(rawDate) } : {}),
      stepIds,
    });
  }
  return RunActivityPageSchema.parse({
    activities,
    nextCursor,
    runId,
    schemaVersion: "1",
  });
}

const WORKFLOW_STEP_KINDS = new Set(["worker", "approval", "fanout", "shard", "done"]);

function transitionTargets(next: any): Array<string> {
  const candidates =
    typeof next === "string"
      ? next.includes("${{")
        ? []
        : [next]
      : next?.cases && typeof next.cases === "object" && !Array.isArray(next.cases)
        ? Object.values(next.cases)
        : [];
  return [
    ...new Set(
      candidates.flatMap((target) => {
        const safe = exposeIdentifier("step_id", target);
        return safe ? [safe] : [];
      }),
    ),
  ].slice(0, 24);
}

function parallelism(stepId: string, step: any, baton: any) {
  if (step.kind === "fanout") {
    const count = Object.keys(step.branches ?? {}).length;
    return {
      ...(count ? { count } : {}),
      ...(Number.isInteger(step.max_parallel) ? { maxParallel: step.max_parallel } : {}),
      mode: "branches" as const,
    };
  }
  if (step.kind !== "shard") {
    return undefined;
  }
  const activationValues = baton?.state?.shards?.[stepId]?.values;
  const configuredValues = step.input?.shards;
  const count = Array.isArray(activationValues)
    ? activationValues.length
    : Array.isArray(configuredValues)
      ? configuredValues.length
      : undefined;
  return {
    ...(count ? { count } : {}),
    ...(Number.isInteger(step.max_parallel) ? { maxParallel: step.max_parallel } : {}),
    mode: "shards" as const,
  };
}

function fanoutBranchState(
  ownerStepId: string,
  branchStepId: string,
  baton: any,
  state: Record<string, unknown>,
): "completed" | "current" | "pending" {
  if (Object.hasOwn(state, branchStepId)) {
    return "completed";
  }
  const fanout = (state as any)?.fanouts?.[ownerStepId];
  const record = Array.isArray(fanout?.branch_records)
    ? fanout.branch_records.find((candidate: any) => candidate?.branch_id === branchStepId)
    : undefined;
  if (record?.status === "accepted") {
    return "completed";
  }
  const cursor = cursorProjection(baton?.cursor);
  return cursor.kind === "single" && cursor.step === ownerStepId && record ? "current" : "pending";
}

type ProjectedWorkflowStep = {
  nextStepIds: Array<string>;
  ownerStepId?: string;
  raw: any;
  stepId: string;
};

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
  const projectedSteps: Array<ProjectedWorkflowStep> = Object.entries(
    workflowDocument.steps,
  ).flatMap(([stepId, step]: [string, any]): Array<ProjectedWorkflowStep> => {
    const safe = exposeIdentifier("step_id", stepId);
    if (!safe || !WORKFLOW_STEP_KINDS.has(step?.kind)) {
      return [];
    }
    const nextStepIds = transitionTargets(step.next);
    const branches =
      step.kind === "fanout" && step.branches && typeof step.branches === "object"
        ? Object.entries(step.branches).flatMap(([branchStepId, branch]: [string, any]) => {
            const safeBranchStepId = exposeIdentifier("step_id", branchStepId);
            return safeBranchStepId
              ? [
                  {
                    nextStepIds,
                    ownerStepId: safe,
                    raw: { ...branch, kind: "worker" },
                    stepId: safeBranchStepId,
                  },
                ]
              : [];
          })
        : [];
    return [
      {
        nextStepIds: branches.length ? branches.map((branch) => branch.stepId) : nextStepIds,
        raw: step,
        stepId: safe,
      },
      ...branches,
    ];
  });
  const steps = projectedSteps.slice(0, 100).map(({ nextStepIds, ownerStepId, raw, stepId }) => ({
    kind: raw.kind,
    nextStepIds,
    ...(parallelism(stepId, raw, baton) ? { parallelism: parallelism(stepId, raw, baton) } : {}),
    state: ownerStepId
      ? fanoutBranchState(ownerStepId, stepId, baton, state)
      : cursor.kind === "single" && cursor.step === stepId
        ? ("current" as const)
        : Object.hasOwn(state, stepId)
          ? ("completed" as const)
          : ("pending" as const),
    stepId,
  }));
  return {
    state: "available",
    steps,
    totalSteps: projectedSteps.length,
    truncated: projectedSteps.length > steps.length,
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
  const publicSummary = exposePublicText("run_summary", input.run?.summary);
  return RunDetailSchema.parse({
    ...summary,
    schemaVersion: "1",
    ...(publicSummary ? { summary: publicSummary } : {}),
    facts: [
      { label: "Run id", value: summary.runId },
      { label: "Workflow", value: summary.workflow },
      ...(summary.currentStep ? [{ label: "Current step", value: summary.currentStep }] : []),
    ],
    miniMap: projectMiniMap(input.workflowDocument, input.persistedState?.baton),
  });
}

export function projectRunActivity(
  input: { persistedState?: any; run: any },
  options: { cursor?: number; limit?: number; stepId?: string } = {},
): RunActivityPageDTO {
  return projectActivityPage(input.run.runId, input.persistedState?.history, options);
}

export function projectRunOutputs(
  input: { persistedState?: any; run: any },
  options: { stepId?: string } = {},
): RunOutputsDTO {
  const state = input.persistedState?.baton?.state ?? {};
  const artifacts = projectArtifacts(state).filter(
    (artifact) => !options.stepId || artifact.producerStepId === options.stepId,
  );
  const results = projectResults(state).filter(
    (result) => !options.stepId || result.producerStepId === options.stepId,
  );
  return RunOutputsSchema.parse({
    artifacts,
    results,
    runId: input.run.runId,
    schemaVersion: "1",
  });
}
