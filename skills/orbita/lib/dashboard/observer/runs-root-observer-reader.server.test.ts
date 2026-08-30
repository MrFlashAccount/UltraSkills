import { afterAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { RunsRootObserverReader } from "./runs-root-observer-reader.server";

const roots: Array<string> = [];
afterAll(async () => Promise.all(roots.map((root) => rm(root, { force: true, recursive: true }))));

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "orbita-dashboard-reader-"));
  roots.push(root);
  const runsRoot = join(root, "runs");
  await mkdir(runsRoot, { recursive: true });
  const workflowPath = resolve("workflows/dev-harness/workflow.toml");
  const entries = {
    created: {
      runId: "created",
      workflow: { identity: "dev-harness", path: workflowPath },
      status: "running",
      createdAt: "2026-07-12T00:00:00.000Z",
      updatedAt: "2026-07-12T00:03:00.000Z",
      workerLease: null,
      title: "Created",
    },
    corrupt: {
      runId: "corrupt",
      workflow: { identity: "dev-harness", path: workflowPath },
      status: "running",
      createdAt: "2026-07-12T00:00:00.000Z",
      updatedAt: "2026-07-12T00:01:00.000Z",
      workerLease: null,
      title: "Corrupt",
    },
    healthy: {
      runId: "healthy",
      workflow: { identity: "dev-harness", path: workflowPath },
      status: "running",
      createdAt: "2026-07-12T00:00:00.000Z",
      updatedAt: "2026-07-12T00:02:00.000Z",
      workerLease: null,
      title: "Healthy",
    },
    legacy: {
      runId: "legacy",
      workflow: { path: workflowPath },
      status: "running",
      createdAt: "2026-07-12T00:00:00.000Z",
      updatedAt: "2026-07-12T00:04:00.000Z",
      workerLease: null,
      title: "Legacy",
    },
  };
  await writeFile(
    join(runsRoot, "runs.json"),
    JSON.stringify({ runs: entries, schemaVersion: 1, topologyVersion: "workflow-runs-v1" }),
    { mode: 0o600 },
  );
  for (const runId of Object.keys(entries)) {
    await mkdir(join(runsRoot, runId, ".workflow-runner"), { recursive: true });
  }
  await writeFile(
    join(runsRoot, "healthy", "baton.json"),
    JSON.stringify({
      cursor: "approval_gate",
      state: { artifacts: [], results: [] },
      status: "running",
    }),
    { mode: 0o600 },
  );
  await writeFile(join(runsRoot, "healthy", "history.md"), "safe history", { mode: 0o600 });
  await writeFile(join(runsRoot, "corrupt", "baton.json"), "{not json", { mode: 0o600 });
  await writeFile(join(runsRoot, "corrupt", "history.md"), "", { mode: 0o600 });
  return runsRoot;
}

describe("RunsRootObserverReader", () => {
  test("reads workflow TOML under the Bun runtime", async () => {
    expect(Bun.TOML.parse).toBeFunction();
    const runsRoot = await fixture();

    const page = await new RunsRootObserverReader(runsRoot).getWorkflowPage("healthy");

    expect(page?.complete).toBe(true);
    expect(page?.nodes).toHaveLength(13);
    expect(page?.nodes.some((node) => node.stepId === "done" && node.kind === "done")).toBe(true);
  });

  test("isolates corrupt runs and rebuilds exclusively from durable state", async () => {
    const runsRoot = await fixture();
    const first = await new RunsRootObserverReader(runsRoot).listRuns();
    const second = await new RunsRootObserverReader(runsRoot).listRuns();
    expect(first).toEqual(second);
    expect(first.find((run) => run.runId === "created")?.laneId).toBe("worker_running");
    expect(first.find((run) => run.runId === "healthy")?.laneId).toBe("waiting_for_user");
    expect(first.find((run) => run.runId === "corrupt")?.laneId).toBe("degraded");
    expect(first.find((run) => run.runId === "legacy")?.workflow).toBe("dev-harness");
  });

  test("treats whole-index corruption as snapshot failure, never empty success", async () => {
    const runsRoot = await fixture();
    await writeFile(join(runsRoot, "runs.json"), "{not json", { mode: 0o600 });
    await expect(new RunsRootObserverReader(runsRoot).listRuns()).rejects.toThrow();
  });

  test("pages workflow-step artifacts from the durable baton records", async () => {
    const runsRoot = await fixture();
    const runDir = join(runsRoot, "healthy");
    const artifacts = [];
    for (let index = 0; index < 101; index += 1) {
      const directory = join(runDir, "implementation", "artifacts");
      await mkdir(directory, { recursive: true });
      const pathname = join(directory, `artifact-${index}.txt`);
      await writeFile(pathname, `artifact ${index}`);
      artifacts.push({
        artifact: {
          id: `artifact-${index}`,
          content_type: "text/plain",
          path: pathname,
        },
        producerStepId: "implementation",
      });
    }
    await writeFile(
      join(runDir, "baton.json"),
      JSON.stringify({
        cursor: "implementation",
        state: {
          artifacts,
          results: [],
        },
        status: "running",
      }),
      { mode: 0o600 },
    );

    const reader = new RunsRootObserverReader(runsRoot);
    const first = await reader.getArtifactPage("healthy", "implementation");
    expect(first?.scope).toEqual({ kind: "workflow_step", stepId: "implementation" });
    expect(first?.items).toHaveLength(100);
    expect(first?.complete).toBe(false);
    expect(first?.nextCursor).toBeString();

    const second = await reader.getArtifactPage("healthy", "implementation", first?.nextCursor);
    expect(second?.items).toHaveLength(1);
    expect(second?.complete).toBe(true);
    expect(second?.runAggregateCount).toBe(101);
  });
});
