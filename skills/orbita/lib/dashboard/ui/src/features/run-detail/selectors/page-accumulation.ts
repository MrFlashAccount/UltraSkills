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

type TraversalOccurrence = TraversalPageDTO["items"][number];

/** Merge replayed occurrence pages while retaining peers first seen in older bounded pages. */
export function mergeTraversalPages(
  pages: ReadonlyArray<TraversalPageDTO> | undefined,
): Array<TraversalOccurrence> {
  const occurrences = new Map<string, TraversalOccurrence>();
  for (const page of pages ?? []) {
    for (const occurrence of page.items) {
      const existing = occurrences.get(occurrence.occurrenceRef);
      if (!existing) {
        occurrences.set(occurrence.occurrenceRef, { ...occurrence, peers: [...occurrence.peers] });
        continue;
      }
      const peerIds = new Set(existing.peers.map((peer) => peer.producerRequestId));
      const olderPeers = occurrence.peers.filter((peer) => !peerIds.has(peer.producerRequestId));
      if (olderPeers.length) {
        occurrences.set(occurrence.occurrenceRef, {
          ...existing,
          peers: [...existing.peers, ...olderPeers],
        });
      }
    }
  }
  return [...occurrences.values()];
}
