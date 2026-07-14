import { FileWarning } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MarkdownContent } from "./MarkdownContent";
import { type RunArtifactItem } from "./run-detail-view-model";
import { PanelLoading } from "./states/PanelStates";

type AvailablePreview = Extract<RunArtifactItem["preview"], { state: "available" }>;

/** Typed preview body. Framed resources are status-checked before navigation. */
export function ArtifactPreviewBody({ artifact }: Readonly<{ artifact: RunArtifactItem }>) {
  const preview = artifact.preview;
  if (preview.state !== "available") {
    return (
      <PreviewFailure
        message={preview.reason}
        title={previewTitle(preview.state)}
        urgent={preview.state === "error"}
      />
    );
  }
  if (preview.kind === "image") {
    return <ImagePreview artifact={artifact} preview={preview} />;
  }
  if (preview.kind === "media") {
    return <MediaPreview artifact={artifact} preview={preview} />;
  }
  if (preview.kind === "markdown") {
    return <MarkdownArtifactPreview preview={preview} />;
  }
  return <FramedPreview artifact={artifact} preview={preview} />;
}

function ImagePreview({
  artifact,
  preview,
}: Readonly<{ artifact: RunArtifactItem; preview: Extract<AvailablePreview, { kind: "image" }> }>) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <PreviewFailure message="The image response could not be rendered." />
  ) : (
    <img
      alt={artifact.summary ?? `Preview of ${artifact.id}`}
      onError={() => setFailed(true)}
      src={preview.url}
    />
  );
}

function MediaPreview({
  artifact,
  preview,
}: Readonly<{ artifact: RunArtifactItem; preview: Extract<AvailablePreview, { kind: "media" }> }>) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <PreviewFailure message="The media response could not be rendered." />;
  }
  const label = `${preview.media === "audio" ? "Audio" : "Video"} preview of ${artifact.id}`;
  return preview.media === "audio" ? (
    // Artifact descriptors do not carry caption resources; do not fabricate a caption track.
    // oxlint-disable-next-line react-doctor/media-has-caption
    <audio aria-label={label} controls onError={() => setFailed(true)} src={preview.url} />
  ) : (
    // Artifact descriptors do not carry caption resources; do not fabricate a caption track.
    // oxlint-disable-next-line react-doctor/media-has-caption
    <video aria-label={label} controls onError={() => setFailed(true)} src={preview.url} />
  );
}

function MarkdownArtifactPreview({
  preview,
}: Readonly<{ preview: Extract<AvailablePreview, { kind: "markdown" }> }>) {
  const resource = usePreviewResource(preview.url, true);
  return resource.state === "loading" ? (
    <PanelLoading label="Loading safe Markdown preview…" />
  ) : resource.state === "error" ? (
    <PreviewFailure message="The Markdown response could not be loaded safely." />
  ) : (
    <article className="artifact-preview-markdown">
      <MarkdownContent>{resource.content}</MarkdownContent>
    </article>
  );
}

function FramedPreview({
  artifact,
  preview,
}: Readonly<{
  artifact: RunArtifactItem;
  preview: Extract<AvailablePreview, { kind: "active_frame" | "document" }>;
}>) {
  const resource = usePreviewResource(preview.url, false);
  const [renderFailed, setRenderFailed] = useState(false);
  if (resource.state === "loading") {
    return <PanelLoading label="Checking preview response…" />;
  }
  if (resource.state === "error" || renderFailed) {
    return <PreviewFailure message="The framed response could not be rendered safely." />;
  }
  return (
    <iframe
      onError={() => setRenderFailed(true)}
      referrerPolicy="no-referrer"
      sandbox={preview.kind === "active_frame" ? "allow-scripts" : ""}
      src={preview.url}
      title={`Preview of ${artifact.id}`}
    />
  );
}

type PreviewResource =
  | { state: "error" }
  | { state: "loading" }
  | { content: string; state: "ready" };

function usePreviewResource(url: string, readText: boolean): PreviewResource {
  const query = useQuery({
    queryFn: async ({ signal }) => {
      const response = await fetch(url, {
        headers: { Accept: readText ? "text/markdown" : "*/*" },
        signal,
      });
      if (!response.ok) {
        throw new Error("preview_unavailable");
      }
      if (readText) {
        return response.text();
      }
      await response.body?.cancel();
      return "";
    },
    queryKey: ["artifact-preview", url, readText],
    retry: false,
  });
  return query.isPending
    ? { state: "loading" }
    : query.isError
      ? { state: "error" }
      : { content: query.data, state: "ready" };
}

export function PreviewFailure({
  message,
  title = "Preview unavailable",
  urgent = true,
}: Readonly<{ message: string; title?: string; urgent?: boolean }>) {
  return (
    <div className="artifact-preview-fallback" role={urgent ? "alert" : undefined}>
      <FileWarning aria-hidden="true" size={28} />
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}

function previewTitle(state: Exclude<RunArtifactItem["preview"]["state"], "available">) {
  return state === "download_only"
    ? "Download only"
    : state === "oversized"
      ? "Preview is too large"
      : state === "unsupported"
        ? "Preview is unsupported"
        : "Preview unavailable";
}
