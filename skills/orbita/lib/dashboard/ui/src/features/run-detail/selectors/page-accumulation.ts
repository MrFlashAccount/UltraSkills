import type { TraversalPageDTO } from "@dashboard-contracts";

export type CursorPage<T> = {
  items: ReadonlyArray<T>;
};

/** Preserve server order while removing duplicate records introduced by page replay. */
export function accumulatePages<T>(
  pages: ReadonlyArray<CursorPage<T>> | undefined,
  identity: (item: T) => string,
): Array<T> {
  const seen = new Set<string>();
  const accumulated: Array<T> = [];
  for (const page of pages ?? []) {
    for (const item of page.items) {
      const key = identity(item);
      if (!seen.has(key)) {
        seen.add(key);
        accumulated.push(item);
      }
    }
  }
  return accumulated;
}

type TraversalStep = TraversalPageDTO["items"][number];

/** Merge replayed step pages while retaining peers first seen in older bounded pages. */
export function mergeTraversalPages(
  pages: ReadonlyArray<TraversalPageDTO> | undefined,
): Array<TraversalStep> {
  const steps = new Map<string, TraversalStep>();
  for (const page of pages ?? []) {
    for (const step of page.items) {
      const existing = steps.get(step.stepId);
      if (!existing) {
        steps.set(step.stepId, { ...step, peers: [...step.peers] });
        continue;
      }
      const peerIds = new Set(existing.peers.map((peer) => peer.producerRequestId));
      const olderPeers = step.peers.filter((peer) => !peerIds.has(peer.producerRequestId));
      if (olderPeers.length) {
        steps.set(step.stepId, {
          ...existing,
          peers: [...existing.peers, ...olderPeers],
        });
      }
    }
  }
  return [...steps.values()];
}
