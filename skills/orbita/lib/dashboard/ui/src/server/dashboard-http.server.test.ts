import { describe, expect, test } from "bun:test";
import type { RunSummaryDTO } from "../../../../dashboard/contracts/browser";
import { createDashboardComposition } from "./dashboard-composition.server";
import {
  handleActivityRequest,
  handleArtifactRequest,
  handleDetailRequest,
  handleEventsRequest,
  handleOutputsRequest,
  handleSnapshotRequest,
} from "./dashboard-http.server";

const timestamp = "2026-07-12T00:00:00.000Z";
const run: RunSummaryDTO = {
  cursor: { kind: "none" },
  laneId: "worker_running",
  occupancy: { state: "unclaimed" },
  runId: "run-1",
  title: { sourceClass: "run_title", value: "Run", policyVersion: "1" },
  workflow: "dev-harness",
};
const snapshot = {
  freshness: {
    state: "fresh",
    observerRevision: "9",
    lastRefreshAttemptAt: timestamp,
    lastSuccessfulRefreshAt: timestamp,
    staleSince: null,
    staleAfterMs: 10_000,
    retryAt: null,
  },
  generatedAt: timestamp,
  runs: [run],
  schemaVersion: "1",
  snapshotVersion: "7",
} as const;

const config = { heartbeatMs: 60_000, host: "127.0.0.1", port: 3000 };

function request(path = "/api/dashboard/v1/runs", init: RequestInit = {}): Request {
  return new Request(`http://127.0.0.1:3000${path}`, {
    ...init,
    headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000", ...init.headers },
  });
}

function composition() {
  const subscribers = new Set<(event: any) => void>();
  return {
    async close() {},
    config,
    readModel: {
      ensureSnapshot: async () => snapshot,
      getDetail: async (runId: string) =>
        runId === "run-1"
          ? {
              ...run,
              schemaVersion: "1",
              facts: [],
              miniMap: { state: "unavailable" },
            }
          : undefined,
      getActivity: async (runId: string, options: { cursor?: number; stepId?: string }) =>
        runId === "run-1"
          ? {
              activities: [],
              nextCursor: options.cursor ? null : "20",
              runId,
              schemaVersion: "1",
            }
          : undefined,
      getArtifact: async (runId: string, options: { artifactId: string; stepId: string }) =>
        runId === "run-1" && options.artifactId === "research-note" && options.stepId === "research"
          ? {
              bytes: new TextEncoder().encode("# Research note"),
              contentType: "text/markdown" as const,
            }
          : undefined,
      getOutputs: async (runId: string) =>
        runId === "run-1" ? { artifacts: [], results: [], runId, schemaVersion: "1" } : undefined,
      subscribe: (subscriber: (event: any) => void) => {
        subscribers.add(subscriber);
        return () => subscribers.delete(subscriber);
      },
    },
    subscribers,
  };
}

describe("dashboard v1 HTTP handlers", () => {
  test("serves conditional strict snapshot and bounded method errors", async () => {
    const fake = composition();
    const response = await handleSnapshotRequest(request(), fake as any);
    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toBe('"dashboard-v1-s7-o9"');
    const conditional = await handleSnapshotRequest(
      request(undefined, { headers: { "if-none-match": '"dashboard-v1-s7-o9"' } }),
      fake as any,
    );
    expect(conditional.status).toBe(304);
    const rejected = await handleSnapshotRequest(
      request(undefined, { method: "POST" }),
      fake as any,
    );
    expect(rejected.status).toBe(405);
  });

  test("enforces configured Host and same-origin authority", async () => {
    const fake = composition();
    const foreignHost = request(undefined, {
      headers: { host: "evil.example", origin: "http://evil.example" },
    });
    expect((await handleSnapshotRequest(foreignHost, fake as any)).status).toBe(403);
    const foreignOrigin = request(undefined, {
      headers: { host: "127.0.0.1:3000", origin: "https://evil.example" },
    });
    expect((await handleSnapshotRequest(foreignOrigin, fake as any)).status).toBe(403);
    expect(handleEventsRequest(foreignOrigin, fake as any).status).toBe(403);
  });

  test("validates ids and returns closed detail errors", async () => {
    const fake = composition();
    expect((await handleDetailRequest(request("/"), "../secret", fake as any)).status).toBe(400);
    expect((await handleDetailRequest(request("/"), "missing", fake as any)).status).toBe(404);
    const detail = await handleDetailRequest(request("/"), "run-1", fake as any);
    expect(detail.status).toBe(200);
    expect(detail.headers.get("etag")).toBe('"dashboard-v1-detail-s7-o9-run-1"');
  });

  test("serves activity and outputs independently with bounded query validation", async () => {
    const fake = composition();
    expect(
      (await handleActivityRequest(request("/?cursor=bad"), "run-1", fake as any)).status,
    ).toBe(400);
    expect(
      (await handleActivityRequest(request("/?step=../secret"), "run-1", fake as any)).status,
    ).toBe(400);
    const activity = await handleActivityRequest(
      request("/?cursor=20&step=research"),
      "run-1",
      fake as any,
    );
    expect(activity.status).toBe(200);
    expect(await activity.json()).toMatchObject({ nextCursor: null, runId: "run-1" });
    const outputs = await handleOutputsRequest(request("/?step=research"), "run-1", fake as any);
    expect(outputs.status).toBe(200);
    expect(await outputs.json()).toMatchObject({ artifacts: [], results: [], runId: "run-1" });
  });

  test("serves allowlisted artifact content only for an exact step and artifact", async () => {
    const fake = composition();
    expect(
      (await handleArtifactRequest(request("/"), "run-1", "research-note", fake as any)).status,
    ).toBe(400);
    const response = await handleArtifactRequest(
      request("/?step=research"),
      "run-1",
      "research-note",
      fake as any,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/markdown");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).toBe("# Research note");
    expect(
      (
        await handleArtifactRequest(
          request("/?step=implementation"),
          "run-1",
          "research-note",
          fake as any,
        )
      ).status,
    ).toBe(404);
  });

  test("streams the versioned invalidation record and unsubscribes on cancel", async () => {
    const fake = composition();
    const response = handleEventsRequest(request("/api/dashboard/v1/events"), fake as any);
    const reader = response.body!.getReader();
    await reader.read();
    const event = {
      changeId: "10",
      emittedAt: timestamp,
      reason: "observer_stale",
      schemaVersion: "1",
      type: "invalidation",
    };
    for (const subscriber of fake.subscribers) {
      subscriber(event);
    }
    const frame = new TextDecoder().decode((await reader.read()).value);
    expect(frame).toBe(`id: 10\nevent: invalidation\ndata: ${JSON.stringify(event)}\n\n`);
    expect(frame).not.toContain('"runs"');
    await reader.cancel();
    expect(fake.subscribers.size).toBe(0);
  });

  test("keeps connected SSE truthful through stale, repeated stale, conditional GET, and recovery", async () => {
    let failure = false;
    const readerSource = {
      getRun: async () => undefined,
      getRunActivity: async () => undefined,
      getRunArtifact: async () => undefined,
      getRunOutputs: async () => undefined,
      listRuns: async () => {
        if (failure) {
          throw new Error("/private/root secret");
        }
        return [run];
      },
    };
    const real = createDashboardComposition(
      {
        coalesceMs: 10,
        heartbeatMs: 60_000,
        host: "127.0.0.1",
        pollMs: 60_000,
        port: 3000,
        runsRoot: process.cwd(),
        staleMs: 10_000,
      },
      readerSource,
    );
    const model = real.readModel;
    await model.refresh();
    let activeSubscriptions = 0;
    const subscribe = model.subscribe.bind(model);
    (model as any).subscribe = (subscriber: any) => {
      activeSubscriptions++;
      const unsubscribe = subscribe(subscriber);
      return () => {
        activeSubscriptions--;
        unsubscribe();
      };
    };
    const stream = handleEventsRequest(request("/api/dashboard/v1/events"), real as any);
    const streamReader = stream.body!.getReader();
    await streamReader.read();
    const first = await handleSnapshotRequest(request(), real as any);
    const firstEtag = first.headers.get("etag")!;
    const firstBody = await first.json();

    failure = true;
    await model.refresh();
    const staleEvent = new TextDecoder().decode((await streamReader.read()).value);
    expect(staleEvent).toContain('"reason":"observer_stale"');
    const staleResponse = await handleSnapshotRequest(
      request(undefined, { headers: { "if-none-match": firstEtag } }),
      real as any,
    );
    expect(staleResponse.status).toBe(200);
    const staleEtag = staleResponse.headers.get("etag")!;
    const staleBody = await staleResponse.json();
    expect(staleBody.runs).toEqual(firstBody.runs);
    expect(staleBody.snapshotVersion).toBe(firstBody.snapshotVersion);
    expect(staleBody.freshness.state).toBe("stale");
    expect(staleEtag).not.toBe(firstEtag);

    await model.refresh();
    const repeatedEvent = new TextDecoder().decode((await streamReader.read()).value);
    expect(repeatedEvent).toContain('"reason":"observer_stale"');
    const repeated = await handleSnapshotRequest(
      request(undefined, { headers: { "if-none-match": staleEtag } }),
      real as any,
    );
    expect(repeated.status).toBe(200);
    expect(repeated.headers.get("etag")).not.toBe(staleEtag);

    failure = false;
    await model.refresh();
    const recoveredEvent = new TextDecoder().decode((await streamReader.read()).value);
    expect(recoveredEvent).toContain('"reason":"observer_recovered"');
    expect(
      (await (await handleSnapshotRequest(request(), real as any)).json()).freshness.state,
    ).toBe("fresh");
    await streamReader.cancel();
    expect(activeSubscriptions).toBe(0);
    await real.close();
  });

  test("streams the real read model through Bun HTTP and releases the client on disconnect", async () => {
    let failure = false;
    const source = {
      getRun: async () => undefined,
      getRunActivity: async () => undefined,
      getRunArtifact: async () => undefined,
      getRunOutputs: async () => undefined,
      listRuns: async () => {
        if (failure) {
          throw new Error("refresh failed");
        }
        return [run];
      },
    };
    const real = createDashboardComposition(
      {
        coalesceMs: 10,
        heartbeatMs: 60_000,
        host: "127.0.0.1",
        pollMs: 60_000,
        port: 0,
        runsRoot: process.cwd(),
        staleMs: 10_000,
      },
      source,
    );
    await real.readModel.refresh();
    let activeSubscriptions = 0;
    const subscribe = real.readModel.subscribe.bind(real.readModel);
    (real.readModel as any).subscribe = (subscriber: any) => {
      activeSubscriptions++;
      const unsubscribe = subscribe(subscriber);
      return () => {
        activeSubscriptions--;
        unsubscribe();
      };
    };
    const server = Bun.serve({
      fetch: (incoming) =>
        new URL(incoming.url).pathname.endsWith("/events")
          ? handleEventsRequest(incoming, real as any)
          : handleSnapshotRequest(incoming, real as any),
      hostname: "127.0.0.1",
      port: 0,
    });
    const controller = new AbortController();
    try {
      const base = `http://127.0.0.1:${server.port}/api/dashboard/v1`;
      expect((await fetch(`${base}/runs`)).status).toBe(200);
      const response = await fetch(`${base}/events`, { signal: controller.signal });
      const body = response.body!.getReader();
      expect(new TextDecoder().decode((await body.read()).value)).toContain(": connected");
      failure = true;
      await real.readModel.refresh();
      expect(new TextDecoder().decode((await body.read()).value)).toContain(
        '"reason":"observer_stale"',
      );
      controller.abort();
      await body.cancel().catch(() => {});
    } finally {
      await server.stop(true);
      await real.close();
    }
    expect(activeSubscriptions).toBe(0);
  });
});
