import type { RunOutputsDTO } from "@dashboard-contracts";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, FileText, LoaderCircle, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";

type Artifact = RunOutputsDTO["artifacts"][number];

function artifactUrl(runId: string, artifact: Artifact): string | undefined {
  if (!artifact.producerStepId || !artifact.previewKind) {
    return undefined;
  }
  const search = new URLSearchParams({ step: artifact.producerStepId });
  return `/api/dashboard/v1/runs/${encodeURIComponent(runId)}/artifacts/${encodeURIComponent(artifact.id)}?${search.toString()}`;
}

async function fetchMarkdown(runId: string, artifact: Artifact): Promise<string> {
  const url = artifactUrl(runId, artifact);
  if (!url) {
    throw new Error("artifact_unavailable");
  }
  const response = await fetch(url, { headers: { Accept: "text/markdown" } });
  if (!response.ok) {
    throw new Error("artifact_unavailable");
  }
  return response.text();
}

export function ArtifactCollection({
  artifacts,
  runId,
}: Readonly<{ artifacts: Array<Artifact>; runId: string }>) {
  const images = artifacts.filter((artifact) => artifact.previewKind === "image");
  const markdown = artifacts.filter((artifact) => artifact.previewKind === "markdown");
  const other = artifacts.filter((artifact) => !artifact.previewKind);
  const [imageIndex, setImageIndex] = useState(0);
  const [openedArtifact, setOpenedArtifact] = useState<Artifact>();
  const normalizedImageIndex = images.length ? imageIndex % images.length : 0;
  const activeImage = images[normalizedImageIndex];

  return (
    <div className="artifact-collection">
      {activeImage ? (
        <div className="artifact-carousel">
          <div className="artifact-carousel-stage">
            <img
              alt={activeImage.summary?.value ?? activeImage.id}
              loading="lazy"
              src={artifactUrl(runId, activeImage)}
            />
            {images.length > 1 ? (
              <>
                <Button
                  aria-label="Previous image"
                  className="artifact-carousel-previous"
                  onClick={() =>
                    setImageIndex((normalizedImageIndex - 1 + images.length) % images.length)
                  }
                  size="icon"
                  variant="ghost"
                >
                  <ChevronLeft aria-hidden="true" size={17} />
                </Button>
                <Button
                  aria-label="Next image"
                  className="artifact-carousel-next"
                  onClick={() => setImageIndex((normalizedImageIndex + 1) % images.length)}
                  size="icon"
                  variant="ghost"
                >
                  <ChevronRight aria-hidden="true" size={17} />
                </Button>
              </>
            ) : null}
          </div>
          <div className="artifact-carousel-caption">
            <div>
              <strong>{activeImage.id}</strong>
              {activeImage.summary ? <span>{activeImage.summary.value}</span> : null}
            </div>
            <span>
              {normalizedImageIndex + 1}/{images.length}
            </span>
          </div>
        </div>
      ) : null}
      {markdown.length ? (
        <div className="artifact-document-list">
          {markdown.map((artifact) => (
            <button
              className="artifact-document"
              key={`${artifact.producerStepId}:${artifact.id}`}
              onClick={() => setOpenedArtifact(artifact)}
              type="button"
            >
              <FileText aria-hidden="true" size={18} />
              <span>
                <strong>{artifact.id}</strong>
                <small>{artifact.summary?.value ?? "Markdown document"}</small>
              </span>
              <span>Open</span>
            </button>
          ))}
        </div>
      ) : null}
      {other.length ? (
        <ul className="bounded-list artifact-metadata-list">
          {other.map((artifact) => (
            <li key={`${artifact.producerStepId ?? ""}:${artifact.id}`}>
              <code>{artifact.id}</code>
              <span>{artifact.summary?.value ?? artifact.contentType ?? "Artifact"}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <ArtifactMarkdownDialog
        artifact={openedArtifact}
        onOpenChange={(open) => {
          if (!open) {
            setOpenedArtifact(undefined);
          }
        }}
        open={Boolean(openedArtifact)}
        runId={runId}
      />
    </div>
  );
}

function ArtifactMarkdownDialog({
  artifact,
  onOpenChange,
  open,
  runId,
}: Readonly<{
  artifact: Artifact | undefined;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  runId: string;
}>) {
  const query = useQuery({
    enabled: typeof window !== "undefined" && open && artifact?.previewKind === "markdown",
    queryFn: () => fetchMarkdown(runId, artifact!),
    queryKey: ["dashboard", "run", runId, "artifact", artifact?.producerStepId, artifact?.id],
    retry: 1,
  });

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="artifact-dialog-overlay" />
        <Dialog.Content className="artifact-dialog-content">
          <header className="artifact-dialog-header">
            <div>
              <span>Artifact</span>
              <Dialog.Title>{artifact?.id ?? "Document"}</Dialog.Title>
              {artifact?.summary ? (
                <Dialog.Description>{artifact.summary.value}</Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close asChild>
              <Button aria-label="Close artifact" size="icon" variant="ghost">
                <X aria-hidden="true" size={18} />
              </Button>
            </Dialog.Close>
          </header>
          <div className="artifact-dialog-body">
            {query.isPending ? (
              <output className="detail-tab-state">
                <LoaderCircle aria-hidden="true" className="ui-spinner" size={18} />
                <span>Loading document…</span>
              </output>
            ) : query.isError ? (
              <div className="detail-tab-state" role="alert">
                <span>Document could not be loaded.</span>
                <Button onClick={() => void query.refetch()} variant="quiet">
                  Try again
                </Button>
              </div>
            ) : (
              <article className="artifact-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
                  {query.data}
                </ReactMarkdown>
              </article>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
