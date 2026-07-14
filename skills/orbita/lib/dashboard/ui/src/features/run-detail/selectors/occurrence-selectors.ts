import type { ActivityPageDTO, TraversalPageDTO } from "@dashboard-contracts";
import {
  type ActivityEventItem,
  type ActivityGroupItem,
  type OccurrenceItem,
  type StepPathItem,
} from "../run-detail-view-model";
import { accumulatePages, mergeTraversalPages } from "./page-accumulation";

/** Resolve the newest trustworthy occurrence behind a step-only UI selection. */
export function selectOccurrenceForStep(
  occurrences: ReadonlyArray<OccurrenceItem>,
  stepId?: string,
): OccurrenceItem | undefined {
  return occurrences
    .filter((occurrence) => occurrence.stepId === stepId)
    .toSorted((left, right) => right.ordinal - left.ordinal)[0];
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

/** Collapse transition history to the unique active path; repeated visits never enter the UI. */
export function toStepPathItems(
  pages: ReadonlyArray<TraversalPageDTO> | undefined,
  currentStepId?: string,
): Array<StepPathItem> {
  const path: Array<string> = [];
  const transitions = (pages ?? []).toReversed().flatMap((page) => page.transitions ?? []);
  for (const transition of transitions) {
    alignPath(path, transition.from);
    alignPath(path, transition.to);
  }
  if (currentStepId) {
    alignPath(path, currentStepId);
  }
  return path.map((stepId) => ({
    state: stepId === currentStepId ? "current" : "completed",
    stepId,
  }));
}

function alignPath(path: Array<string>, stepId: string): void {
  const existing = path.lastIndexOf(stepId);
  if (existing >= 0) {
    path.splice(existing + 1);
    return;
  }
  path.push(stepId);
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
