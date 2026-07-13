import { describe, expect, test } from "bun:test";
import { PUBLIC_TEXT_LIMITS, type PublicTextSource } from "../contracts/browser";
import { exposePublicText } from "./exposure-policy";
import { projectRunDetail, projectRunSummary } from "./project-run";

const run = {
  createdAt: "2026-07-12T00:00:00.000Z",
  runId: "run-safe",
  status: "running",
  summary: "Visible summary",
  title: "Visible title",
  updatedAt: "2026-07-12T00:00:01.000Z",
  workerLease: { tokenHash: "a".repeat(64), leaseExpiresAt: "2026-07-12T00:02:00.000Z" },
  workflow: { identity: "dev-harness", path: "/private/workflow.toml" },
};

describe("dashboard public projection", () => {
  test("omits secret and command variants and enforces every source byte ceiling", () => {
    for (const unsafe of [
      "/home/private/token.txt",
      "--lease-token secret",
      "WORKFLOW_RUN_TOKEN=secret",
      "workflow-runner.mjs instructions --run-id x",
      "private prompt",
      "hidden transcript",
      "curl -H Authorization: bearer secret",
      "a".repeat(64),
      String.raw`C:\Users\private\token.txt`,
      "npm run private-task",
      "API_SECRET=secret",
      "api_key=lowercase-secret",
      "PaSsWoRd: mixed-secret",
      "python -c print(1)",
      "AWS_ACCESS_KEY_ID=identifier",
      "pwsh -Command Get-Secret",
      "ruby -e puts(1)",
      "npx private-task",
    ]) {
      expect(exposePublicText("run_summary", unsafe)).toBeUndefined();
    }
    for (const source of Object.keys(PUBLIC_TEXT_LIMITS) as Array<PublicTextSource>) {
      const exposed = exposePublicText(source, "🙂".repeat(600));
      expect(exposed?.sourceClass).toBe(source);
      expect(new TextEncoder().encode(exposed!.value).byteLength).toBeLessThanOrEqual(
        PUBLIC_TEXT_LIMITS[source].utf8Bytes,
      );
      expect(Array.from(exposed!.value).length).toBeLessThanOrEqual(
        PUBLIC_TEXT_LIMITS[source].codePoints,
      );
    }
  });

  test("degrades cursor cardinality above one and never projects private fields", () => {
    const detail = projectRunDetail(
      {
        persistedState: {
          baton: {
            cursor: ["one", "two"],
            status: "running",
            user_prompt: "private",
            state: {
              artifacts: [
                {
                  producerStepId: "implementation",
                  artifact: {
                    id: "handoff",
                    path: "/private/artifact.md",
                    summary: "Safe artifact",
                  },
                },
              ],
              results: [{ summary: "--lease-token secret", rawError: "/private/error" }],
            },
          },
          history: { mode: "embedded-text", text: "safe line\n/private/path\nhidden transcript" },
        },
        run,
      },
      { now: new Date("2026-07-12T00:01:00.000Z") },
    );
    expect(detail.laneId).toBe("degraded");
    expect(detail.cursor).toEqual({ kind: "unsupported" });
    expect(detail.history.map((line) => line.value)).toEqual(["safe line"]);
    expect(detail.miniMap).toEqual({ state: "unavailable" });
    expect(JSON.stringify(detail)).not.toMatch(
      /tokenHash|user_prompt|private|rawError|artifact\.md/u,
    );
  });

  test("bounds history by approved item and total byte ceilings and projects workflow mini-map", () => {
    const detail = projectRunDetail({
      persistedState: {
        baton: {
          cursor: "implementation",
          status: "running",
          state: { research: { outcome: "ok" } },
        },
        history: {
          mode: "embedded-text",
          text: Array.from(
            { length: 30 },
            (_, index) => `history ${index} ${"🙂".repeat(240)}`,
          ).join("\n"),
        },
      },
      run,
      workflowDocument: {
        steps: {
          research: { kind: "worker", next: "implementation" },
          implementation: {
            branches: { frontend: {}, backend: {} },
            kind: "fanout",
            max_parallel: 2,
            next: { cases: { approved: "done", retry: "research" } },
          },
          done: { kind: "done" },
        },
      },
    });
    expect(detail.history).toHaveLength(8);
    expect(
      detail.history.reduce(
        (bytes, line) => bytes + new TextEncoder().encode(line.value).byteLength,
        0,
      ),
    ).toBeLessThanOrEqual(8192);
    expect(detail.historyTruncated).toBe(true);
    expect(detail.miniMap).toEqual({
      state: "available",
      steps: [
        {
          kind: "worker",
          nextStepIds: ["implementation"],
          state: "completed",
          stepId: "research",
        },
        {
          kind: "fanout",
          nextStepIds: ["done", "research"],
          parallelism: { count: 2, maxParallel: 2, mode: "branches" },
          state: "current",
          stepId: "implementation",
        },
        { kind: "done", nextStepIds: [], state: "pending", stepId: "done" },
      ],
      totalSteps: 3,
      truncated: false,
    });
  });

  test("classifies resolved and unresolved non-blocking stops truthfully", () => {
    const unresolved = projectRunSummary({
      persistedState: {
        baton: {
          cursor: "implementation",
          status: "running",
          nonBlockingStops: { implementation: { needed: "Approval" } },
          state: {},
        },
      },
      run,
    });
    const resolved = projectRunSummary({
      persistedState: {
        baton: {
          cursor: "implementation",
          status: "running",
          nonBlockingStops: { implementation: { needed: "Approval", resolution: {} } },
          state: {},
        },
      },
      run,
    });
    expect(unresolved.laneId).toBe("needs_help");
    expect(resolved.laneId).toBe("worker_running");
  });
});
