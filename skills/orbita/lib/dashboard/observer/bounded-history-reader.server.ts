/** Backward bounded history reads tied to one append-stable regular-file snapshot. */
import { constants } from "node:fs";
import { open } from "node:fs/promises";

export type HistorySnapshot = {
  device: number;
  inode: number;
  snapshotSize: number;
};

export type BoundedHistoryPage = {
  entryCount: number;
  identity: string;
  nextOffset?: number;
  snapshot: HistorySnapshot;
  text: string;
  truncated: boolean;
};

export function historySnapshotIdentity(snapshot: HistorySnapshot): string {
  return `${snapshot.device}:${snapshot.inode}:${snapshot.snapshotSize}`;
}

export async function readBoundedHistoryPage(
  pathname: string,
  options: {
    before?: number;
    maxBytes?: number;
    maxEntries?: number;
    signal?: AbortSignal;
    snapshot?: HistorySnapshot;
  } = {},
): Promise<BoundedHistoryPage> {
  options.signal?.throwIfAborted();
  const handle = await open(
    pathname,
    constants.O_RDONLY | constants.O_NONBLOCK | (constants.O_NOFOLLOW ?? 0),
  );
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) {
      throw new Error("stale_locator");
    }
    const snapshot = options.snapshot ?? {
      device: stat.dev,
      inode: stat.ino,
      snapshotSize: stat.size,
    };
    if (
      stat.dev !== snapshot.device ||
      stat.ino !== snapshot.inode ||
      stat.size < snapshot.snapshotSize
    ) {
      throw new Error("stale_locator");
    }
    const end = options.before ?? snapshot.snapshotSize;
    if (!Number.isSafeInteger(end) || end < 0 || end > snapshot.snapshotSize) {
      throw new Error("stale_locator");
    }
    const maxBytes = Math.min(Math.max(options.maxBytes ?? 65_536, 1024), 65_536);
    const rawStart = Math.max(0, end - maxBytes);
    const buffer = Buffer.alloc(end - rawStart);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, rawStart);
    options.signal?.throwIfAborted();
    let text = buffer.subarray(0, bytesRead).toString("utf8");
    let start = rawStart;
    let truncated = false;
    if (rawStart > 0) {
      const boundary = text.indexOf("\n## ");
      if (boundary < 0) {
        return {
          entryCount: 0,
          identity: historySnapshotIdentity(snapshot),
          nextOffset: rawStart,
          snapshot,
          text: "",
          truncated: true,
        };
      }
      const discarded = Buffer.byteLength(text.slice(0, boundary + 1), "utf8");
      start += discarded;
      text = text.slice(boundary + 1);
      truncated = true;
    }
    const starts = [
      ...(text.startsWith("## ") ? [0] : []),
      ...[...text.matchAll(/\n## /gu)].map((match) => (match.index ?? 0) + 1),
    ];
    const maxEntries = Math.min(Math.max(options.maxEntries ?? 200, 1), 200);
    if (starts.length > maxEntries) {
      const selectedStart = starts[starts.length - maxEntries]!;
      start += Buffer.byteLength(text.slice(0, selectedStart), "utf8");
      text = text.slice(selectedStart);
      truncated = true;
    }
    return {
      entryCount: Math.min(starts.length, maxEntries),
      identity: historySnapshotIdentity(snapshot),
      ...(start > 0 ? { nextOffset: start } : {}),
      snapshot,
      text,
      truncated,
    };
  } finally {
    await handle.close();
  }
}
