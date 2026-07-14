import { describe, expect, test } from "bun:test";
import { projectArtifactPage } from "./project-artifacts";

describe("artifact descriptor projection", () => {
  test("keeps legacy artifacts visible with explicit unavailable provenance", () => {
    const page = projectArtifactPage({
      artifacts: [
        {
          producerStepId: "legacy_step",
          artifact: {
            id: "legacy-packet",
            content_type: "text/markdown",
            path: "/private/legacy.md",
          },
        },
      ],
      complete: true,
      effectiveTypes: new Map(),
      encodeArtifactRef: () => {
        throw new Error("legacy refs must not be minted");
      },
      runAggregateCount: 1,
      runId: "run-a",
      scope: { kind: "workflow_step", stepId: "legacy_step" },
    });
    expect(page.items).toEqual([
      expect.objectContaining({
        id: "legacy-packet",
        previewState: "legacy_unavailable",
        producerStepId: "legacy_step",
      }),
    ]);
    expect(Object.hasOwn(page.items[0]!, "artifactRef")).toBe(false);
  });

  test("uses the same size and MIME policy for descriptor eligibility", () => {
    const artifact = {
      producerStepId: "implementation",
      producerOccurrence: 2,
      producerRequestId: "implementation_request",
      acceptedFileStamp: { device: 1, inode: 2, size: 2_097_153, mtimeMs: 3, ctimeMs: 4 },
      artifact: { id: "page", content_type: "text/html", path: "/private/page.html" },
    };
    const page = projectArtifactPage({
      artifacts: [artifact],
      complete: true,
      effectiveTypes: new Map([["artifact_ref_0001", "text/html"]]),
      encodeArtifactRef: () => "artifact_ref_0001",
      runAggregateCount: 1,
      runId: "run-a",
      scope: { kind: "occurrence", occurrenceRef: "occurrence_ref_0001" },
    });
    expect(page.items[0]?.previewState).toBe("oversized");
  });

  test("does not mint v2 content capability before the persisted forward boundary", () => {
    const page = projectArtifactPage({
      artifacts: [
        {
          producerStepId: "seeded_step",
          producerOccurrence: 1,
          producerRequestId: "seeded_step",
          acceptedFileStamp: { device: 1, inode: 2, size: 4, mtimeMs: 3, ctimeMs: 4 },
          artifact: { id: "seeded", content_type: "text/plain", path: "/private/seeded.txt" },
        },
      ],
      complete: true,
      effectiveTypes: new Map(),
      encodeArtifactRef: () => {
        throw new Error("uncovered artifacts must not receive refs");
      },
      isOccurrenceAvailable: () => false,
      runAggregateCount: 1,
      runId: "run-a",
      scope: { kind: "workflow_step", stepId: "seeded_step" },
    });

    expect(page.items[0]?.previewState).toBe("legacy_unavailable");
    expect(page.items[0]).not.toHaveProperty("artifactRef");
    expect(page.items[0]).not.toHaveProperty("producerOccurrence");
  });
});
