import { describe, expect, test } from "bun:test";
import {
  DASHBOARD_LANE_ORDER,
  InvalidationEventSchema,
  RunSummarySchema,
  SnapshotEnvelopeSchema,
} from "./browser";

const summary = {
  cursor: { kind: "single", step: "implementation" },
  laneId: "worker_running",
  occupancy: { state: "unclaimed" },
  runId: "run-1",
  title: { sourceClass: "run_title", value: "Safe run", policyVersion: "2" },
  workflow: "spdd",
} as const;

describe("dashboard browser contracts", () => {
  test("fixes lane order and rejects unknown DTO fields", () => {
    expect(DASHBOARD_LANE_ORDER).toEqual([
      "waiting_for_user",
      "worker_running",
      "needs_help",
      "degraded",
      "done",
    ]);
    expect(RunSummarySchema.parse(summary)).toEqual(summary);
    expect(() => RunSummarySchema.parse({ ...summary, tokenHash: "secret" })).toThrow();
  });

  test("strictly validates snapshot freshness and closed invalidation reasons", () => {
    const snapshot = {
      freshness: {
        state: "fresh",
        observerRevision: "1",
        lastRefreshAttemptAt: "2026-07-12T00:00:00.000Z",
        lastSuccessfulRefreshAt: "2026-07-12T00:00:00.000Z",
        staleSince: null,
        staleAfterMs: 10_000,
        retryAt: null,
      },
      generatedAt: "2026-07-12T00:00:00.000Z",
      runs: [summary],
      schemaVersion: "2",
      snapshotVersion: "1",
    };
    expect(SnapshotEnvelopeSchema.parse(snapshot)).toEqual(snapshot);
    expect(() =>
      SnapshotEnvelopeSchema.parse({
        ...snapshot,
        freshness: { ...snapshot.freshness, rawError: "/private/path" },
      }),
    ).toThrow();
    expect(() =>
      InvalidationEventSchema.parse({
        changeId: "1",
        emittedAt: "2026-07-12T00:00:00.000Z",
        reason: "snapshot",
        schemaVersion: "2",
        type: "invalidation",
      }),
    ).toThrow();
  });

  test("keeps representative 1,000-run snapshot below the transport budget", () => {
    const runs = Array.from({ length: 1000 }, (_, index) => ({
      ...summary,
      laneId: index < 900 ? ("waiting_for_user" as const) : ("done" as const),
      runId: `run-${index}`,
      title: {
        sourceClass: "run_title" as const,
        value: `Run ${index} ${"x".repeat(100)}`,
        policyVersion: "2" as const,
      },
    }));
    const envelope = SnapshotEnvelopeSchema.parse({
      freshness: {
        state: "fresh",
        observerRevision: "1",
        lastRefreshAttemptAt: "2026-07-12T00:00:00.000Z",
        lastSuccessfulRefreshAt: "2026-07-12T00:00:00.000Z",
        staleSince: null,
        staleAfterMs: 10_000,
        retryAt: null,
      },
      generatedAt: "2026-07-12T00:00:00.000Z",
      runs,
      schemaVersion: "2",
      snapshotVersion: "1",
    });
    expect(new TextEncoder().encode(JSON.stringify(envelope)).byteLength).toBeLessThanOrEqual(
      1.5 * 1024 * 1024,
    );
  });
});
