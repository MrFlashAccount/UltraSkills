import { describe, expect, test } from "bun:test";
import {
  parseManagedHistoryEntries,
  projectActivityPage,
  projectLogsPage,
  projectTraversalPage,
} from "./project-history";

const workflow = {
  steps: {
    research: { kind: "worker" },
    implementation: {
      kind: "fanout",
      branches: { backend: {}, frontend: {} },
    },
    review: { kind: "worker" },
  },
};

describe("managed history public projection", () => {
  test("projects the existing accepted-output debug summary as safe Markdown", () => {
    const entries = parseManagedHistoryEntries(`## 2026-07-14T00:00:00.000Z
- source: workflow-runner-write-output
- baton: cursor=implementation status=running
- output: accepted:implementation
- accepted output summary: step=implementation action=run_worker
- debug-summary body:
  # Safe summary
  API_SECRET=hidden
  - verified tests
`);
    const page = projectLogsPage({
      complete: true,
      entries,
      runId: "run-a",
      stepId: "implementation",
      workflowDocument: workflow,
    });
    expect(page.entries).toHaveLength(1);
    expect(page.entries[0]?.markdown.value).toContain("Safe summary");
    expect(page.entries[0]?.markdown.value).toContain("verified tests");
    expect(page.entries[0]?.markdown.value).not.toContain("API_SECRET");
  });

  test("reconstructs the exact durable path from transition entries", () => {
    const entries = parseManagedHistoryEntries(`## 2026-07-14T00:00:00.000Z
- source: workflow-runner-continue
- transition: cursor=research status=running -> cursor=implementation status=running

## 2026-07-14T00:00:01.000Z
- source: workflow-runner-continue
- transition: cursor=implementation status=running -> cursor=review status=running
`);
    const page = projectTraversalPage({
      complete: true,
      currentStepId: "review",
      entries,
      runId: "run-a",
      workflowDocument: workflow,
    });
    expect(page.items.map(({ stepId, state }) => [stepId, state])).toEqual([
      ["research", "completed"],
      ["implementation", "completed"],
      ["review", "current"],
    ]);
    expect(page.transitions).toEqual([
      { from: "research", to: "implementation" },
      { from: "implementation", to: "review" },
    ]);
  });

  test("groups existing fanout request ids and accepted outputs under their owner step", () => {
    const entries = parseManagedHistoryEntries(`## 2026-07-14T00:00:00.000Z
- source: workflow-runner
- baton: cursor=implementation status=running
- requests: id=implementation__fanout__1__backend action=run_worker; id=implementation__fanout__1__frontend action=run_worker

## 2026-07-14T00:00:01.000Z
- source: workflow-runner-write-output
- baton: cursor=implementation status=running
- output: accepted:implementation__fanout__1__backend
- accepted output summary: step=implementation__fanout__1__backend action=run_worker
`);
    const traversal = projectTraversalPage({
      complete: true,
      currentStepId: "implementation",
      entries,
      runId: "run-a",
      workflowDocument: workflow,
    });
    expect(traversal.items[0]?.peers).toEqual([
      {
        activation: 1,
        kind: "fanout_branch",
        producerRequestId: "implementation__fanout__1__backend",
        state: "accepted",
        workItem: "backend",
      },
      {
        activation: 1,
        kind: "fanout_branch",
        producerRequestId: "implementation__fanout__1__frontend",
        state: "pending",
        workItem: "frontend",
      },
    ]);
    const activity = projectActivityPage({
      complete: true,
      entries,
      groupId: "activation:1:fanout_branch",
      runId: "run-a",
      stepId: "implementation",
      workflowDocument: workflow,
    });
    expect(activity.items.map((item) => item.source)).toEqual([
      "accepted_output",
      "request",
      "request",
    ]);
  });
});
