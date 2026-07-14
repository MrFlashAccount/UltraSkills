/** Pure occurrence/run-scoped aggregate artifact descriptor projection. */
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
  effectiveTypes: Map<string, string>;
  encodeArtifactRef: (entry: any) => string;
  isOccurrenceAvailable?: (stepId: string, occurrence: number) => boolean;
  nextCursor?: string;
  runAggregateCount: number;
  runId: string;
  scope: { kind: "occurrence"; occurrenceRef: string } | { kind: "workflow_step"; stepId: string };
}): ArtifactPageDTO {
  const items: Array<Record<string, unknown>> = input.artifacts.flatMap(
    (entry): Array<Record<string, unknown>> => {
      const id = exposeIdentifier("artifact_id", entry?.artifact?.id);
      const producerStepId = exposeIdentifier("step_id", entry?.producerStepId);
      const producerRequestId = exposeIdentifier("step_id", entry?.producerRequestId);
      const producerOccurrence = entry?.producerOccurrence;
      const declaredContentType = entry?.artifact?.content_type;
      const hasV2Provenance =
        producerRequestId &&
        Number.isInteger(producerOccurrence) &&
        producerOccurrence >= 1 &&
        entry?.acceptedFileStamp &&
        (input.isOccurrenceAvailable?.(producerStepId ?? "", producerOccurrence) ?? true);
      if (!id || !producerStepId || typeof declaredContentType !== "string") {
        return [];
      }
      if (!hasV2Provenance) {
        const summary = exposePublicText("artifact_summary", entry?.artifact?.summary);
        return [
          {
            declaredContentType,
            effectiveContentType: "application/octet-stream",
            id,
            mimeMismatch: true,
            previewState: "legacy_unavailable" as const,
            producerStepId,
            ...(summary ? { summary } : {}),
          },
        ];
      }
      const artifactRef = input.encodeArtifactRef(entry);
      const effectiveContentType = input.effectiveTypes.get(artifactRef);
      if (!effectiveContentType || !Number.isFinite(entry.acceptedFileStamp.size)) {
        return [];
      }
      const mimeMismatch = declaredContentType.toLowerCase() !== effectiveContentType.toLowerCase();
      const size = entry?.acceptedFileStamp?.size;
      const previewState = artifactPreviewState(declaredContentType, effectiveContentType, size);
      const summary = exposePublicText("artifact_summary", entry.artifact.summary);
      return [
        {
          artifactRef,
          declaredContentType,
          effectiveContentType,
          id,
          mimeMismatch,
          previewState,
          producerOccurrence: Number(producerOccurrence),
          producerRequestId: String(producerRequestId),
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
    scope: input.scope,
  });
}
