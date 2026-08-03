import { describe, expect, it } from "bun:test";
import { makeRun } from "@/test/fixtures";
import { filterRuns, groupRuns, workflowsFor } from "./board-selectors";

describe("board selectors", () => {
  const runs = [makeRun(1, "waiting_for_user"), makeRun(2, "needs_help"), makeRun(3, "done")];

  it("filters bounded card fields without copying server state", () => {
    expect(filterRuns(runs, { q: "step-2" }).map((run) => run.runId)).toEqual(["run-2"]);
    expect(filterRuns(runs, { lane: "done", q: "" })).toEqual([runs[2]!]);
  });

  it("keeps all five lanes including empty lanes", () => {
    const lanes = groupRuns(runs);
    expect(Object.keys(lanes)).toEqual([
      "waiting_for_user",
      "worker_running",
      "needs_help",
      "degraded",
      "done",
    ]);
    expect(lanes.worker_running).toEqual([]);
  });

  it("returns stable unique workflow options", () => {
    expect(workflowsFor(runs)).toEqual(["research", "spdd"]);
  });
});
