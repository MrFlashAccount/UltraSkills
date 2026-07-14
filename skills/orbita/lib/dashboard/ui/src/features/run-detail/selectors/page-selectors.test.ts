import { ArtifactPageSchema, type TraversalPageDTO } from "@dashboard-contracts";
import { describe, expect, it } from "bun:test";
import {
  accumulatePages,
  mergeTraversalPages,
  toActivityGroup,
  toActivityGroupDescriptors,
  toRunArtifactItems,
  toStepPathItems,
} from "./page-selectors";

const traversalPage = (peers: Array<Record<string, unknown>>): TraversalPageDTO =>
  ({
    complete: false,
    items: [
      {
        peers,
        state: "current",
        stepId: "architecture",
      },
    ],
    runId: "run-1",
    schemaVersion: "2",
  }) as TraversalPageDTO;

describe("run detail page selectors", () => {
  it("preserves server order and ignores replayed page records", () => {
    expect(
      accumulatePages(
        [{ items: [{ id: "a" }, { id: "b" }] }, { items: [{ id: "b" }, { id: "c" }] }],
        (item) => item.id,
      ),
    ).toEqual([{ id: "a" }, { id: "b" }, { id: "c" }]);
  });

  it("collapses repeated visits to one active step path", () => {
    expect(
      toStepPathItems(
        [
          {
            ...traversalPage([]),
            items: [
              {
                peers: [],
                state: "completed",
                stepId: "a",
              },
              {
                peers: [],
                state: "current",
                stepId: "b",
              },
            ],
            transitions: [
              { from: "a", to: "b" },
              { from: "b", to: "a" },
              { from: "a", to: "b" },
            ],
          },
        ] as never,
        "b",
      ),
    ).toEqual([
      { state: "completed", stepId: "a" },
      { state: "current", stepId: "b" },
    ]);
  });

  it("merges peer facts across replayed traversal pages while newer lifecycle state wins", () => {
    const [step] = mergeTraversalPages([
      traversalPage([
        {
          activation: 1,
          kind: "fanout_branch",
          producerRequestId: "request-a",
          state: "pending",
          workItem: "spec",
        },
      ]),
      traversalPage([
        {
          activation: 1,
          kind: "fanout_branch",
          producerRequestId: "request-a",
          state: "stopped",
          workItem: "spec",
        },
        {
          activation: 1,
          kind: "fanout_branch",
          producerRequestId: "request-b",
          state: "accepted",
          workItem: "data",
        },
      ]),
    ]);
    expect(step?.peers).toMatchObject([
      { producerRequestId: "request-a", state: "pending" },
      { producerRequestId: "request-b", state: "accepted" },
    ]);
  });

  it("renders stopped then resumed peer lifecycle without losing either fact", () => {
    const step = mergeTraversalPages([
      traversalPage([
        {
          activation: 1,
          kind: "fanout_branch",
          producerRequestId: "request-a",
          state: "pending",
          workItem: "spec",
        },
      ]),
    ])[0];
    const descriptor = toActivityGroupDescriptors(step)[0]!;
    const group = toActivityGroup(
      descriptor,
      [
        {
          complete: false,
          groupId: "activation:1:fanout_branch",
          items: [
            {
              event: {
                policyVersion: "2",
                sourceClass: "activity_label",
                value: "stop resolved",
              },
              producerRequestId: "request-a",
              source: "stop_resolved",
              state: "pending",
            },
          ],
          runId: "run-1",
          schemaVersion: "2",
          stepId: "architecture",
        },
        {
          complete: true,
          groupId: "activation:1:fanout_branch",
          items: [
            {
              event: {
                policyVersion: "2",
                sourceClass: "activity_label",
                value: "stop reported",
              },
              producerRequestId: "request-a",
              source: "stop_reported",
              state: "stopped",
            },
          ],
          runId: "run-1",
          schemaVersion: "2",
          stepId: "architecture",
        },
      ],
      step,
    );
    expect(group).toMatchObject({
      events: [{ state: "pending" }, { state: "stopped" }],
      state: "pending",
    });
  });

  it("keeps MIME mismatches download-only and exposes only opaque browser locators", () => {
    const [artifact] = toRunArtifactItems("run-1", [
      ArtifactPageSchema.parse({
        complete: true,
        items: [
          {
            artifactRef: "opaque_artifact_ref",
            declaredContentType: "text/html",
            effectiveContentType: "text/plain",
            id: "report.html",
            mimeMismatch: true,
            previewState: "download_only",
            producerStepId: "review",
          },
        ],
        runAggregateCount: 1,
        runId: "run-1",
        schemaVersion: "2",
        scope: { kind: "workflow_step", stepId: "review" },
      }),
    ]);
    expect(artifact?.preview).toMatchObject({ state: "download_only" });
    expect(artifact?.downloadUrl).toBe(
      "/api/dashboard/v2/runs/run-1/artifacts/opaque_artifact_ref?mode=download",
    );
  });
});
