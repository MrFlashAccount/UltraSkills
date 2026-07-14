import { describe, expect, test } from "bun:test";
import { PUBLIC_TEXT_LIMITS, type PublicTextSource } from "../contracts/browser";
import { exposePublicText } from "./exposure-policy";
import { projectRunLightDetail, projectRunSummary } from "./project-run";
import { projectWorkflowPage } from "./project-workflow";

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
  test("keeps the seeded legacy boundary unavailable until a successful forward route", () => {
    const base = {
      run: {
        runId: "legacy-seed",
        workflow: { identity: "dev-harness" },
        status: "running",
        title: "Legacy seed",
      },
      persistedState: {
        baton: {
          cursor: "implementation",
          status: "running",
          state: {
            artifacts: [],
            results: [],
            $occurrenceProvenance: {
              version: 2,
              counters: { implementation: 1 },
              current: { ownerStepId: "implementation", occurrence: 1 },
              coverage: { mode: "forward_only", historyBytes: 4096, currentAvailable: false },
              pendingArtifactAcceptances: {},
            },
          },
        },
      },
    };
    const unavailable = projectRunLightDetail(base as any, {
      encodeOccurrenceRef: () => "opaque_occurrence_ref",
      now: new Date("2026-07-14T00:00:00.000Z"),
    });
    expect(unavailable.occurrenceAvailability).toBe("legacy_unavailable");
    expect(unavailable.currentOccurrence).toBeNull();

    base.persistedState.baton.state.$occurrenceProvenance.coverage.currentAvailable = true;
    const available = projectRunLightDetail(base as any, {
      encodeOccurrenceRef: () => "opaque_occurrence_ref",
      now: new Date("2026-07-14T00:00:00.000Z"),
    });
    expect(available.occurrenceAvailability).toBe("available");
    expect(available.currentOccurrence?.ordinal).toBe(1);
  });
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
    const detail = projectRunLightDetail(
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
        },
        run,
      },
      { encodeOccurrenceRef: () => "a".repeat(43), now: new Date("2026-07-12T00:01:00.000Z") },
    );
    expect(detail.run.laneId).toBe("degraded");
    expect(detail.run.cursor).toEqual({ kind: "unsupported" });
    expect(detail.occurrenceAvailability).toBe("legacy_unavailable");
    expect(JSON.stringify(detail)).not.toMatch(
      /tokenHash|user_prompt|private|rawError|artifact\.md/u,
    );
  });

  test("projects complete workflow pages in declaration order", () => {
    const page = projectWorkflowPage({
      fingerprint: "f".repeat(43),
      offset: 0,
      runId: run.runId,
      workflow: {
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
    expect(page).toMatchObject({
      complete: true,
      nodes: [
        {
          kind: "worker",
          stepId: "research",
        },
        {
          kind: "fanout",
          parallelism: { count: 2, maxParallel: 2, mode: "branches" },
          stepId: "implementation",
        },
        { kind: "done", stepId: "done" },
      ],
    });
    expect(page.edges).toEqual([
      { from: "research", to: "implementation" },
      { from: "implementation", to: "done" },
      { from: "implementation", to: "research" },
    ]);
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
