/** Pure projection of complete bounded managed-history entries and v2 provenance facts. */
import {
  ActivityPageSchema,
  LogsPageSchema,
  TraversalPageSchema,
  type ActivityPageDTO,
  type LogsPageDTO,
  type TraversalPageDTO,
} from "../contracts/browser";
import { exposeIdentifier, exposePublicText } from "./exposure-policy";

const PEER_STATE_EVENTS = new Set(["accepted_output", "stop_reported"]);
const PUBLIC_ACTIVITY_EVENTS = new Set([
  "route",
  "request",
  "accepted_output",
  "pointer_route",
  "coverage_seed",
  "stop_reported",
  "stop_resolved",
]);
const MANAGED_LOG_SOURCES = new Set([
  "workflow-runner",
  "workflow-runner-continue",
  "workflow-runner-write-output",
  "workflow-runner-move-pointer",
  "workflow-runner-report-stop",
  "workflow-runner-resolve-stop",
]);

export type ManagedHistoryEntry = {
  facts: Array<any>;
  markdown: string;
  source?: string;
  timestamp?: string;
};

type TraversalOccurrenceProjection = {
  ordinal: number;
  peers: Array<{
    activation: number;
    kind: "fanout_branch" | "shard";
    producerRequestId: string;
    state: "pending" | "accepted" | "stopped";
    workItem: string | number;
  }>;
  state: "completed";
  stepId: string;
};

export function parseManagedHistoryEntries(text: string): Array<ManagedHistoryEntry> {
  return text.split(/(?=^## )/gmu).flatMap((entry) => {
    const markdown = entry.trim();
    if (!markdown) {
      return [];
    }
    const firstLine = markdown.split("\n", 1)[0] ?? "";
    const timestamp = firstLine.startsWith("## ") ? firstLine.slice(3).trim() : undefined;
    const source = /^- source: (.+)$/mu.exec(markdown)?.[1]?.trim();
    const facts = [...markdown.matchAll(/^- orbita-v2: (\{.*\})$/gmu)].flatMap((match) => {
      try {
        return [JSON.parse(match[1]!)];
      } catch {
        return [];
      }
    });
    return [
      {
        facts,
        markdown,
        ...(source ? { source } : {}),
        ...(timestamp ? { timestamp } : {}),
      },
    ];
  });
}

function occurrenceMatches(fact: any, stepId: string, ordinal: number): boolean {
  return fact?.ownerStepId === stepId && fact?.ownerOccurrence === ordinal;
}

export function projectTraversalPage(input: {
  availability: "available" | "legacy_unavailable";
  complete: boolean;
  current?: { ordinal: number; stepId: string };
  encodeOccurrenceRef: (stepId: string, ordinal: number) => string;
  entries: Array<ManagedHistoryEntry>;
  isOccurrenceAvailable?: (stepId: string, ordinal: number) => boolean;
  nextCursor?: string;
  runId: string;
  truncated?: boolean;
}): TraversalPageDTO {
  const occurrences = new Map<string, TraversalOccurrenceProjection>();
  const peersByRequest = new Map<string, TraversalOccurrenceProjection["peers"][number]>();
  for (const entry of input.entries) {
    for (const fact of entry.facts) {
      const stepId = exposeIdentifier("step_id", fact?.ownerStepId);
      const ordinal = fact?.ownerOccurrence;
      if (!stepId || !Number.isInteger(ordinal) || ordinal < 1) {
        continue;
      }
      if (input.isOccurrenceAvailable && !input.isOccurrenceAvailable(stepId, ordinal)) {
        continue;
      }
      const key = `${stepId}\0${ordinal}`;
      const occurrence: TraversalOccurrenceProjection = occurrences.get(key) ?? {
        ordinal,
        peers: [],
        state: "completed",
        stepId,
      };
      const producerRequestId = exposeIdentifier("step_id", fact.producerRequestId);
      if (
        fact.event === "request" &&
        producerRequestId &&
        (typeof fact.workItem === "string" || Number.isInteger(fact.workItem))
      ) {
        const peer: TraversalOccurrenceProjection["peers"][number] = {
          activation:
            Number.isInteger(fact.activation) && fact.activation > 0 ? fact.activation : 1,
          kind: typeof fact.workItem === "number" ? "shard" : "fanout_branch",
          producerRequestId,
          state: "pending",
          workItem: fact.workItem,
        };
        occurrence.peers.push(peer);
        peersByRequest.set(`${key}\0${producerRequestId}`, peer);
      }
      if (PEER_STATE_EVENTS.has(fact.event) && producerRequestId) {
        const peerKey = `${key}\0${producerRequestId}`;
        let peer = peersByRequest.get(peerKey);
        if (!peer && (typeof fact.workItem === "string" || Number.isInteger(fact.workItem))) {
          peer = {
            activation:
              Number.isInteger(fact.activation) && fact.activation > 0 ? fact.activation : 1,
            kind: typeof fact.workItem === "number" ? "shard" : "fanout_branch",
            producerRequestId,
            state: "pending",
            workItem: fact.workItem,
          };
          occurrence.peers.push(peer);
          peersByRequest.set(peerKey, peer);
        }
        if (peer) {
          peer.state = fact.event === "accepted_output" ? "accepted" : "stopped";
        }
      }
      if (fact.event === "stop_resolved" && producerRequestId) {
        const peerKey = `${key}\0${producerRequestId}`;
        let peer = peersByRequest.get(peerKey);
        if (!peer && (typeof fact.workItem === "string" || Number.isInteger(fact.workItem))) {
          peer = {
            activation:
              Number.isInteger(fact.activation) && fact.activation > 0 ? fact.activation : 1,
            kind: typeof fact.workItem === "number" ? "shard" : "fanout_branch",
            producerRequestId,
            state: "pending",
            workItem: fact.workItem,
          };
          occurrence.peers.push(peer);
          peersByRequest.set(peerKey, peer);
        }
        if (peer && peer.state === "stopped") {
          peer.state = "pending";
        }
      }
      occurrences.set(key, occurrence);
    }
  }
  const items = [...occurrences.values()]
    .slice(-100)
    .reverse()
    .map((item) => ({
      ...item,
      peers: item.peers.toSorted(
        (left, right) =>
          left.activation - right.activation ||
          (left.kind === "shard" && right.kind === "shard"
            ? Number(left.workItem) - Number(right.workItem)
            : 0),
      ),
      state:
        input.current?.stepId === item.stepId && input.current.ordinal === item.ordinal
          ? ("current" as const)
          : ("completed" as const),
      occurrenceRef: input.encodeOccurrenceRef(item.stepId, item.ordinal),
    }));
  return TraversalPageSchema.parse({
    availability: input.availability,
    complete: input.complete,
    items,
    ...(input.nextCursor ? { nextCursor: input.nextCursor } : {}),
    runId: input.runId,
    schemaVersion: "2",
    truncated: input.truncated ?? !input.complete,
  });
}

export function projectActivityPage(input: {
  complete: boolean;
  entries: Array<ManagedHistoryEntry>;
  nextCursor?: string;
  occurrenceRef: string;
  ordinal: number;
  runId: string;
  stepId: string;
  truncated?: boolean;
}): ActivityPageDTO {
  const items = input.entries
    .flatMap((entry) =>
      entry.facts.flatMap((fact) => {
        if (!occurrenceMatches(fact, input.stepId, input.ordinal)) {
          return [];
        }
        const source = PUBLIC_ACTIVITY_EVENTS.has(fact.event) ? fact.event : undefined;
        const event = exposePublicText("activity_label", source?.replaceAll("_", " "));
        if (!source || !event) {
          return [];
        }
        return [
          {
            event,
            ...(entry.timestamp && Number.isFinite(Date.parse(entry.timestamp))
              ? { occurredAt: new Date(entry.timestamp).toISOString() }
              : {}),
            ...(exposeIdentifier("step_id", fact.producerRequestId)
              ? { producerRequestId: fact.producerRequestId }
              : {}),
            source,
            ...(["accepted_output", "stop_resolved"].includes(source)
              ? {
                  state:
                    source === "accepted_output" ? ("accepted" as const) : ("pending" as const),
                }
              : source === "stop_reported"
                ? { state: "stopped" as const }
                : source === "route"
                  ? { state: "completed" as const }
                  : {}),
          },
        ];
      }),
    )
    .slice(-200)
    .reverse();
  return ActivityPageSchema.parse({
    complete: input.complete,
    items,
    ...(input.nextCursor ? { nextCursor: input.nextCursor } : {}),
    occurrenceRef: input.occurrenceRef,
    runId: input.runId,
    schemaVersion: "2",
    truncated: input.truncated ?? !input.complete,
  });
}

export function projectLogsPage(input: {
  complete: boolean;
  entries: Array<ManagedHistoryEntry>;
  nextCursor?: string;
  occurrenceRef: string;
  ordinal: number;
  runId: string;
  stepId: string;
  truncated?: boolean;
}): LogsPageDTO {
  const entries = input.entries.flatMap((entry) => {
    if (!entry.facts.some((fact) => occurrenceMatches(fact, input.stepId, input.ordinal))) {
      return [];
    }
    const source = entry.source;
    if (!MANAGED_LOG_SOURCES.has(source ?? "")) {
      return [];
    }
    const lines = entry.facts.flatMap((fact) => {
      if (!occurrenceMatches(fact, input.stepId, input.ordinal)) {
        return [];
      }
      const event = PUBLIC_ACTIVITY_EVENTS.has(fact.event)
        ? String(fact.event).replaceAll("_", " ")
        : undefined;
      if (!event) {
        return [];
      }
      const requestId = exposeIdentifier("step_id", fact.producerRequestId);
      const suffix = requestId ? ` — ${requestId}` : "";
      return [`- ${event}${suffix}`];
    });
    if (lines.length === 0) {
      return [];
    }
    const timestamp =
      entry.timestamp && Number.isFinite(Date.parse(entry.timestamp))
        ? new Date(entry.timestamp).toISOString()
        : "Managed event";
    const markdown = exposePublicText(
      "managed_markdown",
      `### ${timestamp}\n\n${lines.join("\n")}`,
    );
    return markdown ? [{ markdown, redacted: true, source, truncated: false }] : [];
  });
  return LogsPageSchema.parse({
    complete: input.complete,
    entries,
    ...(input.nextCursor ? { nextCursor: input.nextCursor } : {}),
    occurrenceRef: input.occurrenceRef,
    runId: input.runId,
    schemaVersion: "2",
    truncated: input.truncated ?? !input.complete,
  });
}
