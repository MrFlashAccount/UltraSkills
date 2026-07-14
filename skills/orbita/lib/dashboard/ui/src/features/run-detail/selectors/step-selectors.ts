import type { ActivityPageDTO, TraversalPageDTO } from "@dashboard-contracts";
import {
  type ActivityEventItem,
  type ActivityGroupItem,
  type StepPathItem,
} from "../run-detail-view-model";
import { accumulatePages } from "./page-accumulation";

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

type TraversalStep = TraversalPageDTO["items"][number];

export function toActivityGroups(
  pages: ReadonlyArray<ActivityPageDTO> | undefined,
  step: TraversalStep | undefined,
): Array<ActivityGroupItem> {
  const peerByRequest = new Map((step?.peers ?? []).map((peer) => [peer.producerRequestId, peer]));
  const groups = new Map<string, ActivityGroupItem>();
  const events = accumulatePages(pages, (event) =>
    [event.occurredAt, event.producerRequestId, event.source, event.state, event.event.value].join(
      ":",
    ),
  );
  events.forEach((event, index) => {
    const peer = event.producerRequestId ? peerByRequest.get(event.producerRequestId) : undefined;
    const groupId = peer ? `activation:${peer.activation}:${peer.kind}` : "step";
    const group = groups.get(groupId) ?? {
      events: [],
      id: groupId,
      label: peer
        ? `${peer.kind === "fanout_branch" ? "Fanout" : "Shard"} activation ${peer.activation}`
        : "Step lifecycle",
      state: peer?.state ?? event.state ?? step?.state ?? "completed",
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
