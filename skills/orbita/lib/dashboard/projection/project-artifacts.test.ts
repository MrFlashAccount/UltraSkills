import { describe, expect, test } from "bun:test";
import { projectArtifactPage } from "./project-artifacts";

describe("artifact descriptor projection", () => {
  test("projects the existing durable artifact record with an opaque viewer ref", () => {
    const page = projectArtifactPage({
      artifacts: [
        {
          producerStepId: "architecture",
          artifact: {
            id: "reasons-canvas",
            content_type: "text/markdown",
            path: "/private/reasons-canvas.md",
          },
        },
      ],
      complete: true,
      encodeArtifactRef: () => "artifact_ref_0001",
      files: new Map([["artifact_ref_0001", { contentType: "text/markdown", size: 1024 }]]),
      runAggregateCount: 1,
      runId: "run-a",
      stepId: "architecture",
    });
    expect(page.items[0]).toMatchObject({
      artifactRef: "artifact_ref_0001",
      id: "reasons-canvas",
      previewState: "previewable",
      producerStepId: "architecture",
    });
    expect(page.scope).toEqual({ kind: "workflow_step", stepId: "architecture" });
  });

  test("uses the current file size and MIME policy for descriptor eligibility", () => {
    const artifact = {
      producerStepId: "implementation",
      artifact: { id: "page", content_type: "text/html", path: "/private/page.html" },
    };
    const page = projectArtifactPage({
      artifacts: [artifact],
      complete: true,
      encodeArtifactRef: () => "artifact_ref_0001",
      files: new Map([["artifact_ref_0001", { contentType: "text/html", size: 2_097_153 }]]),
      runAggregateCount: 1,
      runId: "run-a",
      stepId: "implementation",
    });
    expect(page.items[0]?.previewState).toBe("oversized");
  });
});
