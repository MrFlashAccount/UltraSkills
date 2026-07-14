import { Download, Eye, File, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TooltipLabel } from "@/components/ui/tooltip";
import { ArtifactPreviewDialog } from "./ArtifactPreviewDialog";
import {
  type OccurrenceEvidenceState,
  type PagingState,
  type RunArtifactItem,
} from "./run-detail-view-model";
import {
  LegacyUnavailable,
  OccurrenceEvidenceUnavailable,
  PagingFailure,
  PanelEmpty,
  PanelError,
  PanelLoading,
} from "./states/PanelStates";

type ArtifactsPanelProps = {
  artifacts: ReadonlyArray<RunArtifactItem>;
  occurrenceLabel: string;
  onLoadMore?: () => void;
  onRetry?: () => void;
  onRetryPaging?: () => void;
  pagination: PagingState;
  runArtifactCount: number;
  state: OccurrenceEvidenceState;
};

export function ArtifactsPanel(props: ArtifactsPanelProps) {
  const [previewArtifact, setPreviewArtifact] = useState<RunArtifactItem>();
  const [previewOpeners] = useState(() => new Map<string, HTMLButtonElement>());
  const lastPreviewKey = useRef<string | undefined>(undefined);
  return (
    <section aria-labelledby="artifacts-title" className="occurrence-panel">
      <header className="occurrence-panel-heading">
        <div>
          <h3 id="artifacts-title">Artifacts · {props.occurrenceLabel}</h3>
          <p>
            Showing {props.artifacts.length} of {props.runArtifactCount} run artifacts
          </p>
        </div>
        <Badge>
          {props.state === "legacy_unavailable"
            ? "Legacy provenance unavailable"
            : "Produced by selected occurrence"}
        </Badge>
      </header>
      {props.state === "loading" ? (
        <PanelLoading label={`Loading ${props.occurrenceLabel} artifacts…`} />
      ) : props.state === "missing_selection" || props.state === "traversal_pending" ? (
        <OccurrenceEvidenceUnavailable state={props.state} />
      ) : props.state === "error" ? (
        <PanelError
          message="Selected occurrence artifacts are unavailable."
          onRetry={props.onRetry}
        />
      ) : props.state === "legacy_unavailable" ? (
        <LegacyUnavailable occurrenceLabel={props.occurrenceLabel} />
      ) : props.artifacts.length === 0 ? (
        <PanelEmpty
          detail="The run may still have artifacts produced by other occurrences."
          title="No artifacts for this occurrence"
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
                <div className="artifact-trust">
                  <ShieldCheck aria-hidden="true" size={15} />
                  {previewLabel(artifact)}
                </div>
                <div className="artifact-actions">
                  <Button
                    onClick={() => {
                      lastPreviewKey.current = artifact.key;
                      setPreviewArtifact(artifact);
                    }}
                    ref={(node) => {
                      if (node) {
                        previewOpeners.set(artifact.key, node);
                      }
                    }}
                    variant="quiet"
                  >
                    <Eye aria-hidden="true" size={15} />
                    Preview
                  </Button>
                  {artifact.downloadUrl ? (
                    <Button asChild variant="ghost">
                      <a download href={artifact.downloadUrl}>
                        <Download aria-hidden="true" size={15} />
                        Download
                      </a>
                    </Button>
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
