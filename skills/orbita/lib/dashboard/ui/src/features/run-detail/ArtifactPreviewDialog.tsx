import { Download, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { ArtifactPreviewBody } from "./ArtifactPreviewBody";
import { type RunArtifactItem } from "./run-detail-view-model";

type ArtifactPreviewDialogProps = {
  artifact?: RunArtifactItem | undefined;
  onOpenChange: (open: boolean) => void;
  onReturnFocus: () => void;
};

/** Trusted preview chrome. Active artifact bytes only render in a sandboxed nested frame. */
export function ArtifactPreviewDialog({
  artifact,
  onOpenChange,
  onReturnFocus,
}: ArtifactPreviewDialogProps) {
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={Boolean(artifact)}>
      <Dialog.Portal>
        <Dialog.Overlay className="artifact-preview-overlay" />
        <Dialog.Content
          className="artifact-preview-dialog"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onReturnFocus();
          }}
        >
          {artifact ? <ArtifactPreviewContent artifact={artifact} /> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ArtifactPreviewContent({ artifact }: Readonly<{ artifact: RunArtifactItem }>) {
  return (
    <>
      <header className="artifact-preview-heading">
        <div>
          <span>{artifact.producerLabel}</span>
          <Dialog.Title title={artifact.id}>{artifact.id}</Dialog.Title>
          <Dialog.Description>
            Declared {artifact.declaredContentType}
            {artifact.effectiveContentType
              ? ` · verified ${artifact.effectiveContentType}`
              : " · effective type unavailable"}
          </Dialog.Description>
        </div>
        <Dialog.Close asChild>
          <Button aria-label="Close artifact preview" size="icon" variant="quiet">
            <X aria-hidden="true" size={18} />
          </Button>
        </Dialog.Close>
      </header>
      <div className="artifact-preview-body">
        <ArtifactPreviewBody artifact={artifact} />
      </div>
      <footer className="artifact-preview-footer">
        <p>{previewDisclosure(artifact)}</p>
        {artifact.downloadUrl ? (
          <Button asChild variant="default">
            <a download href={artifact.downloadUrl}>
              <Download aria-hidden="true" size={15} />
              Download
            </a>
          </Button>
        ) : null}
      </footer>
    </>
  );
}

function previewDisclosure(artifact: RunArtifactItem): string {
  const fallback = artifact.downloadUrl
    ? " Download remains available."
    : " No content locator is available.";
  return artifact.preview.state === "available" && artifact.preview.kind === "active_frame"
    ? `Active preview may run scripts and contact network services inside an opaque sandbox. It cannot access private dashboard data.${fallback}`
    : `Preview is isolated from private dashboard data.${fallback}`;
}
