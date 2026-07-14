import { ArtifactPageSchema, type TraversalPageDTO } from "@dashboard-contracts";
import { describe, expect, it } from "bun:test";
import {
  accumulatePages,
  mergeTraversalPages,
  selectOccurrenceForStep,
  toActivityGroups,
  toRunArtifactItems,
  toStepPathItems,
} from "./page-selectors";

const traversalPage = (peers: Array<Record<string, unknown>>): TraversalPageDTO =>
  ({
    availability: "available",
    complete: false,
    items: [
      {
        occurrenceRef: "occurrence_ref_architecture_1",
        ordinal: 1,
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

  it("resolves the latest occurrence behind a step selection", () => {
    const occurrences = [
      { occurrenceRef: "a:1", ordinal: 1, state: "completed" as const, stepId: "a" },
      { occurrenceRef: "a:2", ordinal: 2, state: "current" as const, stepId: "a" },
    ];
    expect(selectOccurrenceForStep(occurrences, "a")?.occurrenceRef).toBe("a:2");
    expect(selectOccurrenceForStep(occurrences, "missing")).toBeUndefined();
  });

  it("collapses repeated visits to one active step path", () => {
    expect(
      toStepPathItems(
        [
          {
            ...traversalPage([]),
            items: [
              {
                occurrenceRef: "a_ref_2",
                ordinal: 2,
                peers: [],
                state: "completed",
                stepId: "a",
              },
              {
                occurrenceRef: "b_ref_2",
                ordinal: 2,
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
    const [occurrence] = mergeTraversalPages([
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
    expect(occurrence?.peers).toMatchObject([
      { producerRequestId: "request-a", state: "pending" },
      { producerRequestId: "request-b", state: "accepted" },
    ]);
  });

  it("renders stopped then resumed peer lifecycle without losing either fact", () => {
    const groups = toActivityGroups(
      [
        {
          complete: false,
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
          occurrenceRef: "occurrence_ref_architecture_1" as never,
          runId: "run-1",
          schemaVersion: "2",
        },
        {
          complete: true,
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
          occurrenceRef: "occurrence_ref_architecture_1" as never,
          runId: "run-1",
          schemaVersion: "2",
        },
      ],
      mergeTraversalPages([
        traversalPage([
          {
            activation: 1,
            kind: "fanout_branch",
            producerRequestId: "request-a",
            state: "pending",
            workItem: "spec",
          },
        ]),
      ])[0],
    );
    expect(groups[0]).toMatchObject({
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
            producerOccurrence: 2,
            producerRequestId: "request-2",
            producerStepId: "review",
          },
        ],
        runAggregateCount: 1,
        runId: "run-1",
        schemaVersion: "2",
        scope: { kind: "occurrence", occurrenceRef: "occurrence_ref_2" },
      }),
    ]);
    expect(artifact?.preview).toMatchObject({ state: "download_only" });
    expect(artifact?.downloadUrl).toBe(
      "/api/dashboard/v2/runs/run-1/artifacts/opaque_artifact_ref?mode=download",
    );
  });
});
