import { Download, Eye, File, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TooltipLabel } from "@/components/ui/tooltip";
import { ArtifactPreviewDialog } from "./ArtifactPreviewDialog";
import {
  type StepEvidenceState,
  type PagingState,
  type RunArtifactItem,
} from "./run-detail-view-model";
import {
  StepEvidenceUnavailable,
  PagingFailure,
  PanelEmpty,
  PanelError,
  PanelLoading,
} from "./states/PanelStates";

type ArtifactsPanelProps = {
  artifacts: ReadonlyArray<RunArtifactItem>;
  onLoadMore?: () => void;
  onRetry?: () => void;
  onRetryPaging?: () => void;
  pagination: PagingState;
  runArtifactCount: number;
  state: StepEvidenceState;
  stepLabel: string;
};

export function ArtifactsPanel(props: ArtifactsPanelProps) {
  const [previewArtifact, setPreviewArtifact] = useState<RunArtifactItem>();
  const [previewOpeners] = useState(() => new Map<string, HTMLButtonElement>());
  const lastPreviewKey = useRef<string | undefined>(undefined);
  return (
    <section aria-labelledby="artifacts-title" className="step-panel">
      <header className="step-panel-heading">
        <div>
          <h3 id="artifacts-title">Artifacts · {props.stepLabel}</h3>
          <p>{artifactScopeSummary(props)}</p>
        </div>
        <Badge>Produced by selected step</Badge>
      </header>
      {props.state === "loading" ? (
        <PanelLoading label={`Loading ${props.stepLabel} artifacts…`} />
      ) : props.state === "missing_selection" || props.state === "traversal_pending" ? (
        <StepEvidenceUnavailable state={props.state} />
      ) : props.state === "error" ? (
        <PanelError message="Selected step artifacts are unavailable." onRetry={props.onRetry} />
      ) : props.artifacts.length === 0 ? (
        <PanelEmpty
          detail="The run may still have artifacts produced by other steps."
          title="No artifacts for this step"
        />
      ) : (
        <>
          <ul className="artifact-list">
            {props.artifacts.map((artifact) => (
              <li key={artifact.key}>
                <File aria-hidden="true" className="artifact-icon" size={26} />
                <div className="artifact-copy">
                  <TooltipLabel label={artifact.id}>
                    <strong title={artifact.id}>{artifact.id}</strong>
                  </TooltipLabel>
                  <span>
                    Producer <Badge>{artifact.producerLabel}</Badge>
                  </span>
                  <span>
                    {artifact.declaredContentType}
                    {artifact.effectiveContentType
                      ? ` · verified ${artifact.effectiveContentType}`
                      : ""}
                  </span>
                  {artifact.mimeMismatch ? (
                    <strong className="artifact-warning">MIME mismatch · download only</strong>
                  ) : null}
                </div>
                {artifact.preview.state === "available" ? null : (
                  <div className="artifact-trust">
                    <ShieldCheck aria-hidden="true" size={15} />
                    {previewLabel(artifact)}
                  </div>
                )}
                <div className="artifact-actions">
                  <TooltipLabel label="Preview">
                    <Button
                      aria-label="Preview"
                      onClick={() => {
                        lastPreviewKey.current = artifact.key;
                        setPreviewArtifact(artifact);
                      }}
                      ref={(node) => {
                        if (node) {
                          previewOpeners.set(artifact.key, node);
                        }
                      }}
                      size="icon"
                      variant="quiet"
                    >
                      <Eye aria-hidden="true" size={15} />
                    </Button>
                  </TooltipLabel>
                  {artifact.downloadUrl ? (
                    <TooltipLabel label="Download">
                      <Button asChild size="icon" variant="ghost">
                        <a aria-label="Download" download href={artifact.downloadUrl}>
                          <Download aria-hidden="true" size={15} />
                        </a>
                      </Button>
                    </TooltipLabel>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {props.pagination === "error" || props.pagination === "stale" ? (
            <PagingFailure
              onRetry={props.onRetryPaging ?? props.onRetry ?? (() => {})}
              resource="Artifacts"
              stale={props.pagination === "stale"}
            />
          ) : props.pagination === "more" || props.pagination === "loading" ? (
            <Button
              disabled={props.pagination === "loading"}
              onClick={props.onLoadMore}
              variant="quiet"
            >
              {props.pagination === "loading" ? "Loading…" : "Load more artifacts"}
            </Button>
          ) : (
            <p className="panel-end">End of artifacts</p>
          )}
        </>
      )}
      <ArtifactPreviewDialog
        artifact={previewArtifact}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewArtifact(undefined);
          }
        }}
        onReturnFocus={() => {
          if (lastPreviewKey.current) {
            previewOpeners.get(lastPreviewKey.current)?.focus();
          }
        }}
      />
    </section>
  );
}

function artifactScopeSummary(props: ArtifactsPanelProps): string {
  if (props.pagination === "complete") {
    return `${props.artifacts.length} for this step · ${Math.max(0, props.runArtifactCount - props.artifacts.length)} on other steps`;
  }
  return `${props.artifacts.length} loaded for this step · ${props.runArtifactCount} total in run`;
}

function previewLabel(artifact: RunArtifactItem) {
  const state = artifact.preview.state;
  return state === "available"
    ? "Preview available"
    : state === "download_only"
      ? "Download only"
      : state === "oversized"
        ? "Oversized preview"
        : state === "unsupported"
          ? "Unsupported preview"
          : "Preview failed";
}
