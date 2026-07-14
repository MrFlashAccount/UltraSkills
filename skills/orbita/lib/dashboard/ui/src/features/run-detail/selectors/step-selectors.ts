import type { ActivityPageDTO, TraversalPageDTO } from "@dashboard-contracts";
import {
  type ActivityEventItem,
  type ActivityGroupDescriptor,
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

export function toActivityGroupDescriptors(
  step: TraversalStep | undefined,
): Array<ActivityGroupDescriptor> {
  const groups = new Map<string, ActivityGroupDescriptor>();
  for (const peer of (step?.peers ?? []).toReversed()) {
    const id = `activation:${peer.activation}:${peer.kind}`;
    if (!groups.has(id)) {
      groups.set(id, {
        id,
        label: `${peer.kind === "fanout_branch" ? "Fanout" : "Shard"} activation ${peer.activation}`,
        state: peer.state,
      });
    }
  }
  groups.set("step", {
    id: "step",
    label: "Step lifecycle",
    state: step?.state ?? "completed",
  });
  return [...groups.values()];
}

export function toActivityGroup(
  descriptor: ActivityGroupDescriptor,
  pages: ReadonlyArray<ActivityPageDTO> | undefined,
  step: TraversalStep | undefined,
): ActivityGroupItem {
  const peerByRequest = new Map((step?.peers ?? []).map((peer) => [peer.producerRequestId, peer]));
  const events = accumulatePages(pages, (event) =>
    [event.occurredAt, event.producerRequestId, event.source, event.state, event.event.value].join(
      ":",
    ),
  );
  return {
    ...descriptor,
    events: events.map((event, index) => {
      const peer = event.producerRequestId ? peerByRequest.get(event.producerRequestId) : undefined;
      return {
        event: event.event.value,
        id: `${descriptor.id}:${event.producerRequestId ?? event.source}:${index}`,
        source: peer ? String(peer.workItem) : event.source,
        state: event.state ?? peer?.state ?? "completed",
        time: event.occurredAt ?? "Time unavailable",
      } satisfies ActivityEventItem;
    }),
  };
}
