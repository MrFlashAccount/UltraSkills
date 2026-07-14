import type { ActivityPageDTO, TraversalPageDTO } from "@dashboard-contracts";
import {
  type ActivityEventItem,
  type ActivityGroupItem,
  type OccurrenceItem,
} from "../run-detail-view-model";
import { accumulatePages, mergeTraversalPages } from "./page-accumulation";

/** Keep explicit selection stable; only choose current/last occurrence before a user selection exists. */
export function selectOccurrence(
  occurrences: ReadonlyArray<OccurrenceItem>,
  selectedRef?: string,
): OccurrenceItem | undefined {
  if (selectedRef) {
    return occurrences.find((occurrence) => occurrence.occurrenceRef === selectedRef);
  }
  return occurrences.find((occurrence) => occurrence.state === "current") ?? occurrences.at(-1);
}

export function toOccurrenceItems(
  pages: ReadonlyArray<TraversalPageDTO> | undefined,
): Array<OccurrenceItem> {
  return mergeTraversalPages(pages).map((occurrence) => ({
    occurrenceRef: occurrence.occurrenceRef,
    ordinal: occurrence.ordinal,
    state: occurrence.state,
    stepId: occurrence.stepId,
  }));
}

type TraversalOccurrence = TraversalPageDTO["items"][number];

export function toActivityGroups(
  pages: ReadonlyArray<ActivityPageDTO> | undefined,
  occurrence: TraversalOccurrence | undefined,
): Array<ActivityGroupItem> {
  const peerByRequest = new Map(
    (occurrence?.peers ?? []).map((peer) => [peer.producerRequestId, peer]),
  );
  const groups = new Map<string, ActivityGroupItem>();
  const events = accumulatePages(pages, (event) =>
    [event.occurredAt, event.producerRequestId, event.source, event.state, event.event.value].join(
      ":",
    ),
  );
  events.forEach((event, index) => {
    const peer = event.producerRequestId ? peerByRequest.get(event.producerRequestId) : undefined;
    const groupId = peer ? `activation:${peer.activation}:${peer.kind}` : "occurrence";
    const group = groups.get(groupId) ?? {
      events: [],
      id: groupId,
      label: peer
        ? `${peer.kind === "fanout_branch" ? "Fanout" : "Shard"} activation ${peer.activation}`
        : "Occurrence lifecycle",
      state: peer?.state ?? event.state ?? occurrence?.state ?? "completed",
    };
    (group.events as Array<ActivityEventItem>).push({
      event: event.event.value,
      id: `${groupId}:${event.producerRequestId ?? event.source}:${index}`,
      source: peer ? String(peer.workItem) : event.source,
      state: event.state ?? peer?.state ?? "completed",
      time: event.occurredAt ?? "Time unavailable",
    });
    groups.set(groupId, group);
  });
  return [...groups.values()];
}
