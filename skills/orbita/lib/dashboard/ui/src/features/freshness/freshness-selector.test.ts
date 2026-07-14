import { describe, expect, it } from "bun:test";
import { selectFreshness } from "./freshness-selector";

const fresh = {
  lastRefreshAttemptAt: "2026-07-12T12:00:00.000Z",
  lastSuccessfulRefreshAt: "2026-07-12T12:00:00.000Z",
  observerRevision: "5",
  retryAt: null,
  staleAfterMs: 10_000,
  staleSince: null,
  state: "fresh" as const,
};
const signals = {
  eventStale: false,
  httpFailed: false,
  now: Date.parse("2026-07-12T12:00:05.000Z"),
  transport: "connected" as const,
};

describe("freshness selector", () => {
  it("reports healthy only while observer, HTTP, transport, and age agree", () => {
    expect(selectFreshness(fresh, signals)).toMatchObject({ label: "Live", unhealthy: false });
    expect(selectFreshness(fresh, { ...signals, httpFailed: true })).toMatchObject({
      detail: "Snapshot reconciliation failed",
      unhealthy: true,
    });
    expect(selectFreshness(fresh, { ...signals, transport: "disconnected" })).toMatchObject({
      detail: "Transport is reconnecting",
      unhealthy: true,
    });
  });

  it("expires Live at the authoritative stale window even with connected transport", () => {
    const result = selectFreshness(fresh, {
      ...signals,
      now: Date.parse("2026-07-12T12:00:10.000Z"),
    });
    expect(result).toMatchObject({ detail: "Observer data is stale", unhealthy: true });
    expect(result.label).toContain("last update 10s");
  });
});
