import type { ArtifactDescriptorDTO, ArtifactPageDTO } from "@dashboard-contracts";
import { type RunArtifactItem } from "../run-detail-view-model";
import { accumulatePages } from "./page-accumulation";

export function toRunArtifactItems(
  runId: string,
  pages: ReadonlyArray<ArtifactPageDTO> | undefined,
): Array<RunArtifactItem> {
  return accumulatePages(pages, artifactIdentity).map((artifact) => {
    const artifactRef = artifact.artifactRef;
    const baseUrl = artifactRef
      ? `/api/dashboard/v2/runs/${encodeURIComponent(runId)}/artifacts/${encodeURIComponent(artifactRef)}`
      : undefined;
    return {
      artifactRef,
      declaredContentType: artifact.declaredContentType,
      downloadUrl: baseUrl ? `${baseUrl}?mode=download` : undefined,
      effectiveContentType: artifact.effectiveContentType,
      id: artifact.id,
      key: artifactIdentity(artifact),
      mimeMismatch: artifact.mimeMismatch,
      preview: previewFor(artifact, baseUrl),
      producerLabel:
        artifact.producerOccurrence === undefined
          ? `${artifact.producerStepId} · provenance unavailable`
          : `${artifact.producerStepId} · ${artifact.producerOccurrence}`,
      producerStepId: artifact.producerStepId,
      summary: artifact.summary?.value,
    };
  });
}

function artifactIdentity(artifact: ArtifactDescriptorDTO): string {
  return (
    artifact.artifactRef ??
    `${artifact.producerStepId}:${artifact.producerOccurrence ?? "legacy"}:${artifact.producerRequestId ?? "legacy"}:${artifact.id}`
  );
}

function previewFor(artifact: ArtifactDescriptorDTO, baseUrl?: string): RunArtifactItem["preview"] {
  if (artifact.previewState !== "previewable" || !baseUrl) {
    const state = artifact.previewState === "previewable" ? "error" : artifact.previewState;
    return {
      reason:
        state === "legacy_unavailable"
          ? "This legacy artifact has no verified content locator."
          : artifact.mimeMismatch
            ? "Declared and effective MIME types differ; preview is disabled."
            : "The artifact remains available through its permitted fallback.",
      state,
    };
  }
  const url = `${baseUrl}?mode=preview`;
  if (
    artifact.effectiveContentType.startsWith("image/") &&
    artifact.effectiveContentType !== "image/svg+xml"
  ) {
    return { kind: "image", state: "available", url };
  }
  if (artifact.effectiveContentType.startsWith("audio/")) {
    return { kind: "media", media: "audio", state: "available", url };
  }
  if (artifact.effectiveContentType.startsWith("video/")) {
    return { kind: "media", media: "video", state: "available", url };
  }
  if (["text/markdown", "text/x-markdown"].includes(artifact.effectiveContentType)) {
    return { kind: "markdown", state: "available", url };
  }
  const kind =
    artifact.effectiveContentType === "text/html" ||
    artifact.effectiveContentType === "image/svg+xml"
      ? "active_frame"
      : "document";
  return { kind, state: "available", url };
}
