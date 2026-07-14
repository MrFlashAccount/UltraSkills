/** Pure declaration-order workflow paging. */
import { WorkflowPageSchema, type WorkflowPageDTO } from "../contracts/browser";
import { exposeIdentifier } from "./exposure-policy";

const STEP_KINDS = new Set(["worker", "approval", "fanout", "shard", "done"]);

function transitionTargets(next: any): Array<string> {
  const values =
    typeof next === "string" && !next.includes("${{")
      ? [next]
      : next?.cases && typeof next.cases === "object" && !Array.isArray(next.cases)
        ? Object.values(next.cases)
        : [];
  return values.flatMap((value) => {
    const safe = exposeIdentifier("step_id", value);
    return safe ? [safe] : [];
  });
}

function parallelism(step: any) {
  if (step.kind === "fanout") {
    const count = Object.keys(step.branches ?? {}).length;
    return {
      ...(count > 0 ? { count } : {}),
      ...(Number.isInteger(step.max_parallel) ? { maxParallel: step.max_parallel } : {}),
      mode: "branches" as const,
    };
  }
  if (step.kind === "shard") {
    const count = Array.isArray(step.input?.shards) ? step.input.shards.length : undefined;
    return {
      ...(count ? { count } : {}),
      ...(Number.isInteger(step.max_parallel) ? { maxParallel: step.max_parallel } : {}),
      mode: "shards" as const,
    };
  }
  return undefined;
}

export function projectWorkflowPage(input: {
  fingerprint: string;
  nextCursor?: string;
  offset: number;
  runId: string;
  workflow: any;
}): WorkflowPageDTO {
  const entries = Object.entries(input.workflow?.steps ?? {}).flatMap(
    ([stepId, step]: [string, any]) => {
      const safe = exposeIdentifier("step_id", stepId);
      return safe && STEP_KINDS.has(step?.kind) ? [{ stepId: safe, step }] : [];
    },
  );
  const pageEntries = entries.slice(input.offset, input.offset + 200);
  const complete = input.offset + pageEntries.length >= entries.length;
  return WorkflowPageSchema.parse({
    complete,
    edges: pageEntries.flatMap(({ stepId, step }) =>
      transitionTargets(step.next).map((to) => ({ from: stepId, to })),
    ),
    ...(complete ? {} : { nextCursor: input.nextCursor }),
    nodes: pageEntries.map(({ stepId, step }) => ({
      kind: step.kind,
      ...(parallelism(step) ? { parallelism: parallelism(step) } : {}),
      stepId,
    })),
    runId: input.runId,
    schemaVersion: "2",
    workflowFingerprint: input.fingerprint,
  });
}
