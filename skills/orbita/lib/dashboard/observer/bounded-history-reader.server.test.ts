import { afterAll, describe, expect, test } from "bun:test";
import { appendFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readBoundedHistoryPage } from "./bounded-history-reader.server";

const roots: Array<string> = [];
afterAll(async () => Promise.all(roots.map((root) => rm(root, { recursive: true, force: true }))));

async function historyFixture(count: number): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "orbita-history-page-"));
  roots.push(root);
  const pathname = join(root, "history.md");
  const entries = Array.from(
    { length: count },
    (_, index) =>
      `## 2026-07-14T00:00:${String(index).padStart(2, "0")}.000Z\n- source: workflow-runner\n- orbita-v2: {"event":"request","ownerStepId":"owner","ownerOccurrence":1,"producerRequestId":"request_${index}","workItem":${index}}\n`,
  );
  await writeFile(pathname, entries.join("\n"));
  return pathname;
}

describe("bounded managed-history paging", () => {
  test("returns count-aware whole entries without overlap and stays stable across append", async () => {
    const pathname = await historyFixture(30);
    const first = await readBoundedHistoryPage(pathname, { maxEntries: 7 });
    expect(first.entryCount).toBe(7);
    expect(first.text.startsWith("## ")).toBe(true);
    expect(first.text.match(/^## /gmu)?.length).toBe(7);
    expect(first.nextOffset).toBeNumber();

    await appendFile(pathname, "\n## 2026-07-14T00:01:00.000Z\n- source: workflow-runner\n");
    const second = await readBoundedHistoryPage(pathname, {
      before: first.nextOffset,
      maxEntries: 7,
      snapshot: first.snapshot,
    });
    expect(second.text.match(/^## /gmu)?.length).toBe(7);
    expect(second.text).not.toContain("request_29");
    expect(second.snapshot).toEqual(first.snapshot);
  });

  test("honors cancellation before opening the history file", async () => {
    const pathname = await historyFixture(1);
    const controller = new AbortController();
    controller.abort();
    await expect(readBoundedHistoryPage(pathname, { signal: controller.signal })).rejects.toThrow();
  });

  test("preserves a continuation for every entry beyond the hard page ceiling", async () => {
    const pathname = await historyFixture(230);
    const first = await readBoundedHistoryPage(pathname, { maxEntries: 500 });
    expect(first.entryCount).toBe(200);
    expect(first.text.match(/^## /gmu)?.length).toBe(200);
    expect(first.text).toContain("request_229");
    expect(first.nextOffset).toBeNumber();

    const second = await readBoundedHistoryPage(pathname, {
      before: first.nextOffset,
      maxEntries: 500,
      snapshot: first.snapshot,
    });
    expect(second.entryCount).toBe(30);
    expect(second.text.match(/^## /gmu)?.length).toBe(30);
    expect(second.text).toContain("request_0");
    expect(second.text).not.toContain('request_30"');
    expect(second.nextOffset).toBeUndefined();
  });
});
