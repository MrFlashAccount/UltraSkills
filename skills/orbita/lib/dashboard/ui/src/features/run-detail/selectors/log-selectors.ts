import type { LogsPageDTO } from "@dashboard-contracts";
import { type ManagedLogEntry } from "../run-detail-view-model";
import { accumulatePages } from "./page-accumulation";

export function toManagedLogEntries(
  pages: ReadonlyArray<LogsPageDTO> | undefined,
): Array<ManagedLogEntry> {
  return accumulatePages(
    (pages ?? []).map((page) => ({ items: page.entries })),
    (entry) => `${entry.source}:${entry.markdown.value}`,
  ).map((entry, entryIndex) => ({
    id: `${entryIndex}:${entry.source}:${entry.markdown.value}`,
    markdown: entry.markdown.value,
    ...(entry.occurredAt ? { timestamp: entry.occurredAt } : {}),
    ...(entry.redacted === undefined ? {} : { redacted: entry.redacted }),
    source: entry.source,
    ...(entry.truncated === undefined ? {} : { truncated: entry.truncated }),
  }));
}
