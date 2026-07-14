import { describe, expect, test } from "bun:test";
import {
  parseManagedHistoryEntries,
  projectLogsPage,
  projectTraversalPage,
} from "./project-history";

describe("managed history public projection", () => {
  test("uses a positive structured log projection instead of arbitrary debug-summary markdown", () => {
    const entries = parseManagedHistoryEntries(`## 2026-07-14T00:00:00.000Z
- source: workflow-runner-write-output
- orbita-v2: {"event":"accepted_output","ownerStepId":"implementation","ownerOccurrence":1,"producerRequestId":"implementation"}
- debug-summary body:
  SECRET_PROMPT lease-token-local-path
`);
    const page = projectLogsPage({
      complete: true,
      entries,
      occurrenceRef: "opaque_occurrence_ref",
      ordinal: 1,
      runId: "run-a",
      stepId: "implementation",
    });
    expect(page.entries).toHaveLength(1);
    expect(page.entries[0]?.redacted).toBe(true);
    expect(page.entries[0]?.markdown.value).toContain("accepted output");
    expect(page.entries[0]?.markdown.value).not.toMatch(/SECRET_PROMPT|lease-token|local-path/u);
  });

  test("reconstructs numeric shard order and stop lifecycle deterministically", () => {
    const entries = parseManagedHistoryEntries(`## 2026-07-14T00:00:00.000Z
- source: workflow-runner
- orbita-v2: {"event":"request","ownerStepId":"owner","ownerOccurrence":1,"producerRequestId":"shard_2","activation":1,"workItem":2}
- orbita-v2: {"event":"request","ownerStepId":"owner","ownerOccurrence":1,"producerRequestId":"shard_0","activation":1,"workItem":0}
- orbita-v2: {"event":"stop_reported","ownerStepId":"owner","ownerOccurrence":1,"producerRequestId":"shard_0","activation":1,"workItem":0}
- orbita-v2: {"event":"accepted_output","ownerStepId":"owner","ownerOccurrence":1,"producerRequestId":"shard_2","activation":1,"workItem":2}
`);
    const page = projectTraversalPage({
      availability: "available",
      complete: true,
      encodeOccurrenceRef: () => "opaque_occurrence_ref",
      entries,
      runId: "run-a",
    });
    expect(page.items[0]?.peers.map((peer) => [peer.workItem, peer.state])).toEqual([
      [0, "stopped"],
      [2, "accepted"],
    ]);
  });

  test("reconstructs repeated activations and split stop resolution without page-local state", () => {
    const entries = parseManagedHistoryEntries(`## 2026-07-14T00:00:00.000Z
- source: workflow-runner
- orbita-v2: {"event":"request","ownerStepId":"owner","ownerOccurrence":3,"producerRequestId":"owner__fanout__1__branch_a","activation":1,"workItem":"branch_a"}

## 2026-07-14T00:00:01.000Z
- source: workflow-runner-report-stop
- orbita-v2: {"event":"stop_reported","ownerStepId":"owner","ownerOccurrence":3,"producerRequestId":"owner__fanout__1__branch_a","activation":1,"workItem":"branch_a"}

## 2026-07-14T00:00:02.000Z
- source: workflow-runner-resolve-stop
- orbita-v2: {"event":"stop_resolved","ownerStepId":"owner","ownerOccurrence":3,"producerRequestId":"owner__fanout__1__branch_a","activation":1,"workItem":"branch_a"}

## 2026-07-14T00:00:03.000Z
- source: workflow-runner
- orbita-v2: {"event":"request","ownerStepId":"owner","ownerOccurrence":3,"producerRequestId":"owner__fanout__2__branch_a","activation":2,"workItem":"branch_a"}

## 2026-07-14T00:00:04.000Z
- source: workflow-runner-write-output
- orbita-v2: {"event":"accepted_output","ownerStepId":"owner","ownerOccurrence":3,"producerRequestId":"owner__fanout__1__branch_a","activation":1,"workItem":"branch_a"}
`);
    const page = projectTraversalPage({
      availability: "available",
      complete: false,
      encodeOccurrenceRef: () => "opaque_occurrence_ref",
      entries,
      nextCursor: "opaque_cursor_value",
      runId: "run-a",
      truncated: true,
    });
    expect(page.items[0]?.peers).toEqual([
      {
        activation: 1,
        kind: "fanout_branch",
        producerRequestId: "owner__fanout__1__branch_a",
        state: "accepted",
        workItem: "branch_a",
      },
      {
        activation: 2,
        kind: "fanout_branch",
        producerRequestId: "owner__fanout__2__branch_a",
        state: "pending",
        workItem: "branch_a",
      },
    ]);
    expect(page.complete).toBe(false);
    expect(page.truncated).toBe(true);
  });

  test("keeps the seeded legacy occurrence unavailable after later covered routes", () => {
    const entries = parseManagedHistoryEntries(`## 2026-07-14T00:00:00.000Z
- source: workflow-runner-provenance-seed
- orbita-v2: {"event":"coverage_seed","ownerStepId":"implementation","ownerOccurrence":1,"historyBytes":4096}

## 2026-07-14T00:00:01.000Z
- source: workflow-runner-continue
- orbita-v2: {"event":"route","fromOwnerStepId":"implementation","fromOccurrence":1,"ownerStepId":"review","ownerOccurrence":1}

## 2026-07-14T00:00:02.000Z
- source: workflow-runner-continue
- orbita-v2: {"event":"route","fromOwnerStepId":"review","fromOccurrence":1,"ownerStepId":"implementation","ownerOccurrence":2}
`);
    const page = projectTraversalPage({
      availability: "legacy_unavailable",
      complete: true,
      current: { stepId: "implementation", ordinal: 2 },
      encodeOccurrenceRef: (stepId, ordinal) => `${stepId}_${ordinal}_covered_ref`,
      entries,
      isOccurrenceAvailable: (stepId, ordinal) =>
        (stepId === "review" && ordinal >= 1) || (stepId === "implementation" && ordinal >= 2),
      runId: "run-a",
    });

    expect(page.availability).toBe("legacy_unavailable");
    expect(page.items.map(({ stepId, ordinal }) => [stepId, ordinal])).toEqual([
      ["implementation", 2],
      ["review", 1],
    ]);
    expect(page.items.some((item) => item.stepId === "implementation" && item.ordinal === 1)).toBe(
      false,
    );
    expect(page.transitions).toEqual([
      { from: "implementation", to: "review" },
      { from: "review", to: "implementation" },
    ]);
  });

  test("projects legacy transition history without inventing occurrence identity", () => {
    const entries = parseManagedHistoryEntries(`## 2026-07-14T00:00:00.000Z
- source: workflow-runner-continue
- transition: cursor=research status=running -> cursor=architecture status=running

## 2026-07-14T00:00:01.000Z
- source: workflow-runner-pointer
- pointer move edge: cursor=architecture status=running -> cursor=research status=running
`);
    const page = projectTraversalPage({
      availability: "legacy_unavailable",
      complete: true,
      encodeOccurrenceRef: () => "unused_occurrence_ref",
      entries,
      runId: "run-a",
    });

    expect(page.items).toEqual([]);
    expect(page.transitions).toEqual([
      { from: "research", to: "architecture" },
      { from: "architecture", to: "research" },
    ]);
  });
});
