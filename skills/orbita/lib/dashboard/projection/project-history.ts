/** Pure projection of bounded managed history using the durable runner format. */
import {
  ActivityPageSchema,
  LogsPageSchema,
  TraversalPageSchema,
  type ActivityPageDTO,
  type LogsPageDTO,
  type TraversalPageDTO,
} from "../contracts/browser";
import { exposeIdentifier, exposePublicText } from "./exposure-policy";

export type ManagedHistoryRequest = { action?: string; id: string };

export type ManagedHistoryEntry = {
  acceptedStepId?: string;
  batonStepId?: string;
  debugSummary?: string;
  markdown: string;
  output?: string;
  requests: Array<ManagedHistoryRequest>;
  source?: string;
  timestamp?: string;
  transition?: { from: string; to: string };
};

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const DIGITS = /^\d+$/u;

function identifier(value: unknown): string | undefined {
  return typeof value === "string" && SAFE_ID.test(value)
    ? exposeIdentifier("step_id", value)
    : undefined;
}

function requestsFrom(markdown: string): Array<ManagedHistoryRequest> {
  const line = /^- (?:requests|steps): (.+)$/mu.exec(markdown)?.[1];
  if (!line) {
    return [];
  }
  return line.split(/;\s*/u).flatMap((part) => {
    const match = /^id=([^\s]+) action=([^\s]+)$/u.exec(part.trim());
    const id = identifier(match?.[1]);
    return id ? [{ id, ...(match?.[2] ? { action: match[2] } : {}) }] : [];
  });
}

function debugSummaryFrom(markdown: string): string | undefined {
  const lines = markdown.split("\n");
  const marker = lines.indexOf("- debug-summary body:");
  if (marker < 0) {
    return undefined;
  }
  const bodyLines: Array<string> = [];
  for (const line of lines.slice(marker + 1)) {
    if (!line.startsWith("  ") && line.length !== 0) {
      break;
    }
    bodyLines.push(line);
  }
  const body = bodyLines
    .map((line) => (line.startsWith("  ") ? line.slice(2) : line))
    .join("\n")
    .trim();
  return body || undefined;
}

export function parseManagedHistoryEntries(text: string): Array<ManagedHistoryEntry> {
  return text.split(/(?=^## )/gmu).flatMap((entry) => {
    const markdown = entry.trim();
    if (!markdown) {
      return [];
    }
    const firstLine = markdown.split("\n", 1)[0] ?? "";
    const timestamp = firstLine.startsWith("## ") ? firstLine.slice(3).trim() : undefined;
    const source = /^- source: (.+)$/mu.exec(markdown)?.[1]?.trim();
    const transitionMatch =
      /^- (?:transition|pointer move edge): cursor=([A-Za-z0-9_.-]+) status=\S+ -> cursor=([A-Za-z0-9_.-]+) status=\S+$/mu.exec(
        markdown,
      );
    const acceptedStepId = identifier(
      /^- accepted output summary: step=([^\s]+) action=/mu.exec(markdown)?.[1],
    );
    const batonStepId = identifier(/^- baton: cursor=([^\s]+) status=/mu.exec(markdown)?.[1]);
    const output = /^- output: (.+)$/mu.exec(markdown)?.[1]?.trim();
    const debugSummary = debugSummaryFrom(markdown);
    return [
      {
        markdown,
        requests: requestsFrom(markdown),
        ...(acceptedStepId ? { acceptedStepId } : {}),
        ...(batonStepId ? { batonStepId } : {}),
        ...(debugSummary ? { debugSummary } : {}),
        ...(output ? { output } : {}),
        ...(source ? { source } : {}),
        ...(timestamp ? { timestamp } : {}),
        ...(transitionMatch?.[1] && transitionMatch[2]
          ? { transition: { from: transitionMatch[1], to: transitionMatch[2] } }
          : {}),
      },
    ];
  });
}

function workflowSteps(workflowDocument: any): Array<[string, any]> {
  const steps = workflowDocument?.steps;
  return steps && typeof steps === "object" && !Array.isArray(steps) ? Object.entries(steps) : [];
}

/** Map durable request ids back to their existing workflow step owner. */
export function ownerStepIdForRequest(
  workflowDocument: any,
  requestId: string,
): string | undefined {
  const safeRequest = identifier(requestId);
  if (!safeRequest) {
    return undefined;
  }
  const steps = workflowSteps(workflowDocument);
  if (steps.some(([stepId]) => stepId === safeRequest)) {
    return safeRequest;
  }
  for (const [ownerStepId, step] of steps) {
    if (step?.kind === "fanout") {
      for (const branchId of Object.keys(step.branches ?? {})) {
        const prefix = `${ownerStepId}__fanout__`;
        const suffix = `__${branchId}`;
        const activation = safeRequest.slice(prefix.length, -suffix.length);
        if (
          safeRequest === branchId ||
          (safeRequest.startsWith(prefix) &&
            safeRequest.endsWith(suffix) &&
            DIGITS.test(activation))
        ) {
          return ownerStepId;
        }
      }
    }
    if (step?.kind === "shard") {
      const prefix = `${ownerStepId}__shard__`;
      const [activation, index, extra] = safeRequest.slice(prefix.length).split("__");
      if (
        safeRequest.startsWith(prefix) &&
        !extra &&
        DIGITS.test(activation ?? "") &&
        DIGITS.test(index ?? "")
      ) {
        return ownerStepId;
      }
    }
  }
  return undefined;
}

export function artifactProducerBelongsToStep(
  workflowDocument: any,
  producerStepId: string,
  selectedStepId: string,
): boolean {
  if (producerStepId === selectedStepId) {
    return true;
  }
  const step = workflowDocument?.steps?.[selectedStepId];
  return step?.kind === "fanout" && Object.hasOwn(step.branches ?? {}, producerStepId);
}

function requestActivation(requestId: string):
  | {
      activation: number;
      kind: "fanout_branch" | "shard";
      workItem: string | number;
    }
  | undefined {
  const fanout = /__fanout__(\d+)__(.+)$/u.exec(requestId);
  if (fanout?.[1] && fanout[2]) {
    return { activation: Number(fanout[1]), kind: "fanout_branch", workItem: fanout[2] };
  }
  const shard = /__shard__(\d+)__(\d+)$/u.exec(requestId);
  if (shard?.[1] && shard[2]) {
    return { activation: Number(shard[1]), kind: "shard", workItem: Number(shard[2]) };
  }
  return undefined;
}

function requestState(entries: Array<ManagedHistoryEntry>, requestId: string) {
  if (entries.some((entry) => entry.acceptedStepId === requestId)) {
    return "accepted" as const;
  }
  if (entries.some((entry) => entry.output === `stopped:${requestId}`)) {
    return "stopped" as const;
  }
  return "pending" as const;
}

export function projectTraversalPage(input: {
  complete: boolean;
  currentStepId?: string;
  entries: Array<ManagedHistoryEntry>;
  nextCursor?: string;
  runId: string;
  truncated?: boolean;
  workflowDocument: any;
}): TraversalPageDTO {
  const transitions = input.entries.flatMap((entry) =>
    entry.transition ? [entry.transition] : [],
  );
  const stepIds = new Set<string>();
  for (const transition of transitions) {
    stepIds.add(transition.from);
    stepIds.add(transition.to);
  }
  if (input.currentStepId) {
    stepIds.add(input.currentStepId);
  }
  const items = [...stepIds].slice(-100).map((stepId) => {
    const peers = [];
    for (const entry of input.entries) {
      for (const request of entry.requests) {
        if (ownerStepIdForRequest(input.workflowDocument, request.id) !== stepId) {
          continue;
        }
        const activation = requestActivation(request.id);
        if (activation) {
          peers.push({
            ...activation,
            producerRequestId: request.id,
            state: requestState(input.entries, request.id),
          });
        }
      }
    }
    return {
      peers,
      state: stepId === input.currentStepId ? ("current" as const) : ("completed" as const),
      stepId,
    };
  });
  return TraversalPageSchema.parse({
    complete: input.complete,
    items,
    ...(input.nextCursor ? { nextCursor: input.nextCursor } : {}),
    runId: input.runId,
    schemaVersion: "2",
    transitions,
    truncated: input.truncated ?? !input.complete,
  });
}

function occurredAt(entry: ManagedHistoryEntry): string | undefined {
  return entry.timestamp && Number.isFinite(Date.parse(entry.timestamp))
    ? new Date(entry.timestamp).toISOString()
    : undefined;
}

export function projectActivityPage(input: {
  complete: boolean;
  entries: Array<ManagedHistoryEntry>;
  nextCursor?: string;
  runId: string;
  stepId: string;
  truncated?: boolean;
  workflowDocument: any;
}): ActivityPageDTO {
  const items = input.entries
    .flatMap((entry) => {
      const events: Array<Record<string, unknown>> = [];
      if (entry.transition?.to === input.stepId) {
        events.push({
          event: `entered from ${entry.transition.from}`,
          source: "route",
          state: "completed",
        });
      } else if (entry.transition?.from === input.stepId) {
        events.push({
          event: `continued to ${entry.transition.to}`,
          source: "route",
          state: "completed",
        });
      }
      for (const request of entry.requests) {
        if (ownerStepIdForRequest(input.workflowDocument, request.id) === input.stepId) {
          events.push({
            event: request.action ? request.action.replaceAll("_", " ") : "request",
            producerRequestId: request.id,
            source: "request",
            state: requestState(input.entries, request.id),
          });
        }
      }
      if (
        entry.acceptedStepId &&
        ownerStepIdForRequest(input.workflowDocument, entry.acceptedStepId) === input.stepId
      ) {
        events.push({
          event: "accepted output",
          producerRequestId: entry.acceptedStepId,
          source: "accepted_output",
          state: "accepted",
        });
      }
      return events.flatMap((event) => {
        const label = exposePublicText("activity_label", event.event);
        return label
          ? [
              {
                ...event,
                event: label,
                ...(occurredAt(entry) ? { occurredAt: occurredAt(entry) } : {}),
              },
            ]
          : [];
      });
    })
    .slice(-200)
    .reverse();
  return ActivityPageSchema.parse({
    complete: input.complete,
    items,
    ...(input.nextCursor ? { nextCursor: input.nextCursor } : {}),
    runId: input.runId,
    schemaVersion: "2",
    stepId: input.stepId,
    truncated: input.truncated ?? !input.complete,
  });
}

export function projectLogsPage(input: {
  complete: boolean;
  entries: Array<ManagedHistoryEntry>;
  nextCursor?: string;
  runId: string;
  stepId: string;
  truncated?: boolean;
  workflowDocument: any;
}): LogsPageDTO {
  const entries = input.entries.flatMap((entry) => {
    if (
      !entry.acceptedStepId ||
      ownerStepIdForRequest(input.workflowDocument, entry.acceptedStepId) !== input.stepId
    ) {
      return [];
    }
    const body = entry.debugSummary ?? `Accepted output from \`${entry.acceptedStepId}\`.`;
    const markdown = exposePublicText("managed_markdown", body);
    if (!markdown) {
      return [];
    }
    return [
      {
        markdown,
        ...(occurredAt(entry) ? { occurredAt: occurredAt(entry) } : {}),
        redacted: true,
        source: "workflow-runner-write-output" as const,
        truncated: entry.markdown.includes("[truncated:"),
      },
    ];
  });
  return LogsPageSchema.parse({
    complete: input.complete,
    entries,
    ...(input.nextCursor ? { nextCursor: input.nextCursor } : {}),
    runId: input.runId,
    schemaVersion: "2",
    stepId: input.stepId,
    truncated: input.truncated ?? !input.complete,
  });
}
