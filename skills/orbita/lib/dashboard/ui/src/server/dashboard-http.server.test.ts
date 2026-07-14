import { Readable } from "node:stream";
import { describe, expect, test } from "bun:test";
import {
  handleArtifactContentRequest,
  handleArtifactsRequest,
  handleLightDetailRequest,
  handleSnapshotRequest,
} from "./dashboard-http.server";

const run = {
  cursor: { kind: "single" as const, step: "implementation" },
  laneId: "worker_running" as const,
  occupancy: { state: "unclaimed" as const },
  runId: "run-1",
  title: { policyVersion: "2" as const, sourceClass: "run_title" as const, value: "Run one" },
  workflow: "dev-harness",
};

const snapshot = {
  freshness: {
    lastRefreshAttemptAt: "2026-07-14T00:00:00.000Z",
    lastSuccessfulRefreshAt: "2026-07-14T00:00:00.000Z",
    observerRevision: "1",
    retryAt: null,
    staleAfterMs: 10_000,
    staleSince: null,
    state: "fresh" as const,
  },
  generatedAt: "2026-07-14T00:00:00.000Z",
  runs: [run],
  schemaVersion: "2" as const,
  snapshotVersion: "1",
};

function composition(readModel: Record<string, any>) {
  return {
    config: {
      coalesceMs: 100,
      heartbeatMs: 15_000,
      host: "127.0.0.1",
      pollMs: 2000,
      port: 3000,
      runsRoot: "/runs",
      staleMs: 10_000,
    },
    readModel,
  } as any;
}

function request(path: string, init: RequestInit = {}): Request {
  return new Request(`http://127.0.0.1:3000${path}`, {
    ...init,
    headers: {
      host: "127.0.0.1:3000",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      ...init.headers,
    },
  });
}

describe("dashboard v2 HTTP", () => {
  test("serves a bounded v2 snapshot and honors ETag", async () => {
    const model = { ensureSnapshot: async () => snapshot };
    const first = await handleSnapshotRequest(
      request("/api/dashboard/v2/runs"),
      composition(model),
    );
    expect(first.status).toBe(200);
    expect((await first.json()).schemaVersion).toBe("2");
    const second = await handleSnapshotRequest(
      request("/api/dashboard/v2/runs", {
        headers: { "if-none-match": first.headers.get("etag")! },
      }),
      composition(model),
    );
    expect(second.status).toBe(304);
  });

  test("serves light detail without embedded history/workflow/artifacts", async () => {
    const detail = {
      run,
      schemaVersion: "2",
    };
    const response = await handleLightDetailRequest(
      request("/api/dashboard/v2/runs/run-1"),
      "run-1",
      composition({ getLightDetail: async () => detail }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(detail);
    expect(JSON.stringify(body)).not.toMatch(/history|artifacts|workflowPath/u);
  });

  test("rejects opaque-origin and cross-site access to private JSON", async () => {
    const model = { ensureSnapshot: async () => snapshot };
    const opaque = request("/api/dashboard/v2/runs", { headers: { origin: "null" } });
    const crossSite = request("/api/dashboard/v2/runs", {
      headers: { "sec-fetch-site": "cross-site" },
    });
    expect((await handleSnapshotRequest(opaque, composition(model))).status).toBe(403);
    expect((await handleSnapshotRequest(crossSite, composition(model))).status).toBe(403);
  });

  test("requires trusted Fetch Metadata and rejects extra query fields", async () => {
    const model = { ensureSnapshot: async () => snapshot };
    const missingMetadata = new Request("http://127.0.0.1:3000/api/dashboard/v2/runs", {
      headers: { host: "127.0.0.1:3000" },
    });
    expect((await handleSnapshotRequest(missingMetadata, composition(model))).status).toBe(403);
    expect(
      (await handleSnapshotRequest(request("/api/dashboard/v2/runs?private=1"), composition(model)))
        .status,
    ).toBe(400);
  });

  test("requires a bounded workflow-step artifact scope", async () => {
    const calls: Array<Array<unknown>> = [];
    const model = {
      getArtifactPage: async (...args: Array<unknown>) => {
        calls.push(args);
        const stepId = args[1] as string | undefined;
        return {
          complete: true,
          items: [],
          runAggregateCount: 7,
          runId: "run-1",
          schemaVersion: "2",
          scope: { kind: "workflow_step", stepId },
        };
      },
    };
    const workflowStep = await handleArtifactsRequest(
      request("/api/dashboard/v2/runs/run-1/artifacts?stepId=implementation"),
      "run-1",
      composition(model),
    );
    expect(workflowStep.status).toBe(200);
    expect((await workflowStep.json()).scope).toEqual({
      kind: "workflow_step",
      stepId: "implementation",
    });
    expect(calls[0]?.[1]).toBe("implementation");

    expect(
      (
        await handleArtifactsRequest(
          request("/api/dashboard/v2/runs/run-1/artifacts"),
          "run-1",
          composition(model),
        )
      ).status,
    ).toBe(400);
  });

  test("streams one verified range and applies active preview sandbox headers", async () => {
    const bytes = Buffer.from("<!doctype html><script>document.body.textContent='safe'</script>");
    const handle = {
      close: async () => {},
      contentLimit: 2_097_152,
      createReadStream: (range?: { end: number; start: number }) =>
        Readable.from(bytes.subarray(range?.start ?? 0, (range?.end ?? bytes.length - 1) + 1)),
      declaredContentType: "text/html",
      effectiveContentType: "text/html",
      filename: "preview.html",
      mimeMismatch: false,
      previewEligible: true,
      size: bytes.length,
      stampTag: '"stamp"',
    };
    const previewRequest = request(
      "/api/dashboard/v2/runs/run-1/artifacts/aaaaaaaaaaaaaaaa?mode=preview",
      { headers: { "sec-fetch-dest": "iframe", "sec-fetch-mode": "navigate" } },
    );
    const preview = await handleArtifactContentRequest(
      previewRequest,
      "run-1",
      "aaaaaaaaaaaaaaaa",
      composition({ getArtifactHandle: async () => handle }),
    );
    expect(preview.status).toBe(200);
    expect(preview.headers.get("content-security-policy")).toContain("sandbox allow-scripts");
    expect(preview.headers.get("content-security-policy")).not.toContain("allow-same-origin");

    const rangeRequest = request(
      "/api/dashboard/v2/runs/run-1/artifacts/aaaaaaaaaaaaaaaa?mode=download",
      { headers: { range: "bytes=0-3" } },
    );
    const range = await handleArtifactContentRequest(
      rangeRequest,
      "run-1",
      "aaaaaaaaaaaaaaaa",
      composition({ getArtifactHandle: async () => handle }),
    );
    expect(range.status).toBe(206);
    expect(range.headers.get("content-range")).toBe(`bytes 0-3/${bytes.length}`);
  });

  test("enforces canonical preview eligibility and fixed range failures", async () => {
    const bytes = Buffer.from("plain text");
    let closed = 0;
    const handle = {
      close: async () => {
        closed += 1;
      },
      contentLimit: 1_048_576,
      createReadStream: () => Readable.from(bytes),
      declaredContentType: "text/html",
      effectiveContentType: "text/plain",
      filename: "mismatch.html",
      mimeMismatch: true,
      previewEligible: false,
      size: bytes.length,
      stampTag: '"stamp"',
    };
    const preview = await handleArtifactContentRequest(
      request("/api/dashboard/v2/runs/run-1/artifacts/aaaaaaaaaaaaaaaa?mode=preview", {
        headers: { "sec-fetch-dest": "iframe", "sec-fetch-mode": "navigate" },
      }),
      "run-1",
      "aaaaaaaaaaaaaaaa",
      composition({ getArtifactHandle: async () => handle }),
    );
    expect(preview.status).toBe(409);
    expect(closed).toBe(1);

    const invalidRange = await handleArtifactContentRequest(
      request("/api/dashboard/v2/runs/run-1/artifacts/aaaaaaaaaaaaaaaa?mode=download", {
        headers: { range: "bytes=0-1,4-5" },
      }),
      "run-1",
      "aaaaaaaaaaaaaaaa",
      composition({ getArtifactHandle: async () => ({ ...handle, previewEligible: true }) }),
    );
    expect(invalidRange.status).toBe(416);
    expect(invalidRange.headers.get("content-range")).toBe(`bytes */${bytes.length}`);

    const navigatedDownload = await handleArtifactContentRequest(
      request("/api/dashboard/v2/runs/run-1/artifacts/aaaaaaaaaaaaaaaa?mode=download", {
        headers: { "sec-fetch-dest": "iframe", "sec-fetch-mode": "navigate" },
      }),
      "run-1",
      "aaaaaaaaaaaaaaaa",
      composition({ getArtifactHandle: async () => handle }),
    );
    expect(navigatedDownload.status).toBe(403);
  });
});
