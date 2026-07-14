/** Browser-safe view models consumed by the run-detail feature components. */
export type StepPathItem = {
  state: "completed" | "current";
  stepId: string;
};

export type ActivityEventItem = {
  event: string;
  id: string;
  source: string;
  state: string;
  time: string;
};

export type ActivityGroupItem = {
  events: ReadonlyArray<ActivityEventItem>;
  id: string;
  label: string;
  state: string;
};

export type PagingState = "complete" | "error" | "loading" | "more" | "stale";

export type StepEvidenceState =
  | "error"
  | "loading"
  | "missing_selection"
  | "ready"
  | "traversal_pending";

export type ManagedLogEntry = {
  id: string;
  markdown: string;
  redacted?: boolean;
  source?: string;
  timestamp?: string;
  truncated?: boolean;
};

export type ArtifactPreview =
  | { kind: "active_frame" | "document"; state: "available"; url: string }
  | { kind: "image"; state: "available"; url: string }
  | { kind: "markdown"; state: "available"; url: string }
  | { kind: "media"; media: "audio" | "video"; state: "available"; url: string }
  | {
      reason: string;
      state: "download_only" | "error" | "oversized" | "unsupported";
    };

export type RunArtifactItem = {
  artifactRef?: string | undefined;
  declaredContentType: string;
  downloadUrl?: string | undefined;
  effectiveContentType?: string | undefined;
  id: string;
  key: string;
  mimeMismatch: boolean;
  preview: ArtifactPreview;
  producerLabel: string;
  producerStepId: string;
  summary?: string | undefined;
};
