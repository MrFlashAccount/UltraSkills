/** Pure workflow-step-scoped artifact descriptor projection. */
import { ArtifactPageSchema, type ArtifactPageDTO } from "../contracts/browser";
import { exposeIdentifier, exposePublicText } from "./exposure-policy";

export function artifactContentLimit(mime: string): number {
  if (mime === "text/html" || mime === "image/svg+xml") {
    return 2_097_152;
  }
  if (mime.startsWith("text/") || mime === "application/json") {
    return 1_048_576;
  }
  if (mime.startsWith("image/") || mime === "application/pdf") {
    return 33_554_432;
  }
  if (mime.startsWith("audio/") || mime.startsWith("video/")) {
    return 67_108_864;
  }
  return 0;
}

export function artifactPreviewState(
  declared: string,
  effective: string,
  size: number,
): "download_only" | "oversized" | "previewable" | "unsupported" {
  if (declared.toLowerCase() !== effective.toLowerCase()) {
    return "download_only";
  }
  const limit = artifactContentLimit(effective);
  if (limit === 0) {
    return "unsupported";
  }
  return size > limit ? "oversized" : "previewable";
}

export function projectArtifactPage(input: {
  artifacts: Array<any>;
  complete: boolean;
  encodeArtifactRef: (entry: any) => string;
  files: Map<string, { contentType: string; size: number }>;
  nextCursor?: string;
  runAggregateCount: number;
  runId: string;
  stepId: string;
}): ArtifactPageDTO {
  const items: Array<Record<string, unknown>> = input.artifacts.flatMap(
    (entry): Array<Record<string, unknown>> => {
      const id = exposeIdentifier("artifact_id", entry?.artifact?.id);
      const producerStepId = exposeIdentifier("step_id", entry?.producerStepId);
      const declaredContentType = entry?.artifact?.content_type;
      if (!id || !producerStepId || typeof declaredContentType !== "string") {
        return [];
      }
      const artifactRef = input.encodeArtifactRef(entry);
      const file = input.files.get(artifactRef);
      const effectiveContentType = file?.contentType ?? "application/octet-stream";
      const mimeMismatch = declaredContentType.toLowerCase() !== effectiveContentType.toLowerCase();
      const previewState = file
        ? artifactPreviewState(declaredContentType, effectiveContentType, file.size)
        : ("unsupported" as const);
      const summary = exposePublicText("artifact_summary", entry.artifact.summary);
      return [
        {
          artifactRef,
          declaredContentType,
          effectiveContentType,
          id,
          mimeMismatch,
          previewState,
          producerStepId,
          ...(summary ? { summary } : {}),
        },
      ];
    },
  );
  return ArtifactPageSchema.parse({
    complete: input.complete,
    items,
    ...(input.nextCursor ? { nextCursor: input.nextCursor } : {}),
    runAggregateCount: input.runAggregateCount,
    runId: input.runId,
    schemaVersion: "2",
    scope: { kind: "workflow_step", stepId: input.stepId },
  });
}
