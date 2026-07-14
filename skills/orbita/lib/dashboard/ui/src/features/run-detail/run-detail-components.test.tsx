import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { AppProviders } from "@/app/AppProviders";
import { ActivityPanel } from "./ActivityPanel";
import { ArtifactPreviewBody } from "./ArtifactPreviewBody";
import { ArtifactsPanel } from "./ArtifactsPanel";
import { LogsPanel } from "./LogsPanel";
import { OccurrenceSelector } from "./OccurrenceSelector";
import { WorkflowStepArtifacts } from "./WorkflowStepArtifacts";

const occurrences = [
  { occurrenceRef: "research:1", ordinal: 1, state: "completed" as const, stepId: "research" },
  {
    occurrenceRef: "architecture:1",
    ordinal: 1,
    state: "current" as const,
    stepId: "architecture",
  },
];

const renderFeature = (component: React.ReactNode) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AppProviders>{component}</AppProviders>
    </QueryClientProvider>,
  );
};

describe("run detail Direction A components", () => {
  it("preserves explicit occurrence identity and supports arrow traversal", () => {
    const onSelect = vi.fn();
    renderFeature(
      <OccurrenceSelector
        occurrences={occurrences}
        onRetryPaging={() => {}}
        onSelect={onSelect}
        onShowEarlier={() => {}}
        pagination="more"
        selectedRef="architecture:1"
      />,
    );
    const research = screen.getByRole("button", { name: /research · 1/i });
    const architecture = screen.getByRole("button", { name: /architecture · 1/i });
    expect(architecture).toHaveAttribute("aria-pressed", "true");
    research.focus();
    fireEvent.keyDown(research, { key: "ArrowRight" });
    expect(architecture).toHaveFocus();
    fireEvent.click(architecture);
    expect(onSelect).toHaveBeenCalledWith("architecture:1");
  });

  it("renders nested activity as a semantic table", () => {
    renderFeature(
      <ActivityPanel
        groups={[
          {
            events: [
              {
                event: "Branch started",
                id: "event-1",
                source: "spec_modeling",
                state: "current",
                time: "2m ago",
              },
            ],
            id: "activation-1",
            label: "Fanout activation 1 · fanout · branches phase",
            state: "current",
          },
        ]}
        occurrenceLabel="architecture · 1"
        pagination="complete"
        state="ready"
      />,
    );
    expect(screen.getByRole("heading", { name: "Activity · architecture · 1" })).toBeVisible();
    expect(screen.getByRole("table")).toHaveTextContent("spec_modeling");
    expect(screen.getByText("End of activity")).toBeVisible();
  });

  it("renders managed Markdown without raw HTML and discloses external links", () => {
    const { container } = renderFeature(
      <LogsPanel
        entries={[
          {
            id: "log-1",
            markdown: "**Done** <script>alert(1)</script> [evidence](https://example.com)",
            redacted: true,
            truncated: true,
          },
        ]}
        occurrenceLabel="architecture · 1"
        pagination="more"
        state="ready"
      />,
    );
    expect(screen.getByText("Done").tagName).toBe("STRONG");
    expect(container.querySelector("script")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /evidence.*opens an external site/i })).toHaveAttribute(
      "rel",
      "noreferrer",
    );
    expect(screen.getByText("Redacted to public facts")).toBeVisible();
    expect(screen.getByText("Entry truncated")).toBeVisible();
  });

  it("restores focus to the exact artifact preview opener", async () => {
    renderFeature(
      <ArtifactsPanel
        artifacts={[
          {
            artifactRef: "artifact-1",
            declaredContentType: "image/png",
            downloadUrl: "/download/artifact-1",
            effectiveContentType: "image/png",
            id: "workflow-trail.png",
            key: "artifact-1",
            mimeMismatch: false,
            preview: { kind: "image", state: "available", url: "/preview/artifact-1" },
            producerLabel: "architecture · 1",
            producerStepId: "architecture",
          },
        ]}
        occurrenceLabel="architecture · 1"
        pagination="complete"
        runArtifactCount={4}
        state="ready"
      />,
    );
    const row = screen.getByRole("listitem");
    const opener = within(row).getByRole("button", { name: "Preview" });
    fireEvent.click(opener);
    expect(screen.getByRole("dialog", { name: "workflow-trail.png" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close artifact preview" }));
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("preflights active content and discloses its opaque allow-scripts sandbox", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<!doctype html><p>Proof</p>")),
    );
    renderFeature(
      <ArtifactsPanel
        artifacts={[
          {
            artifactRef: "artifact-active",
            declaredContentType: "text/html",
            downloadUrl: "/download/artifact-active",
            effectiveContentType: "text/html",
            id: "report.html",
            key: "artifact-active",
            mimeMismatch: false,
            preview: { kind: "active_frame", state: "available", url: "/preview/active" },
            producerLabel: "architecture · 1",
            producerStepId: "architecture",
          },
        ]}
        occurrenceLabel="architecture · 1"
        pagination="complete"
        runArtifactCount={1}
        state="ready"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    const frame = await screen.findByTitle("Preview of report.html");
    expect(frame).toHaveAttribute("sandbox", "allow-scripts");
    expect(screen.getByText(/may run scripts and contact network services/i)).toBeVisible();
  });

  it("renders Markdown artifacts through the shared safe renderer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("**Safe** <script>unsafe()</script>")),
    );
    const { container } = renderFeature(
      <ArtifactsPanel
        artifacts={[
          {
            artifactRef: "artifact-markdown",
            declaredContentType: "text/markdown",
            effectiveContentType: "text/markdown",
            id: "report.md",
            key: "artifact-markdown",
            mimeMismatch: false,
            preview: { kind: "markdown", state: "available", url: "/preview/markdown" },
            producerLabel: "architecture · 1",
            producerStepId: "architecture",
          },
        ]}
        occurrenceLabel="architecture · 1"
        pagination="complete"
        runArtifactCount={1}
        state="ready"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(await screen.findByText("Safe")).toBeVisible();
    expect(container.querySelector("script")).not.toBeInTheDocument();
  });

  it("preserves loaded artifacts across stale continuation recovery", () => {
    const retry = vi.fn();
    renderFeature(
      <ArtifactsPanel
        artifacts={[
          {
            declaredContentType: "text/plain",
            effectiveContentType: "text/plain",
            id: "legacy.txt",
            key: "legacy",
            mimeMismatch: false,
            preview: {
              reason: "This legacy artifact has no verified content locator.",
              state: "legacy_unavailable",
            },
            producerLabel: "legacy-owner · provenance unavailable",
            producerStepId: "legacy-owner",
          },
        ]}
        occurrenceLabel="architecture · 1"
        onRetryPaging={retry}
        pagination="stale"
        runArtifactCount={3}
        state="ready"
      />,
    );
    expect(screen.getByText("legacy.txt")).toBeVisible();
    expect(screen.getByText(/provenance unavailable/i)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reload from latest" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("distinguishes traversal-pending and vanished-selection evidence from successful emptiness", () => {
    renderFeature(
      <>
        <ActivityPanel
          groups={[]}
          occurrenceLabel="occurrence pending"
          pagination="complete"
          state="traversal_pending"
        />
        <LogsPanel
          entries={[]}
          occurrenceLabel="selection unavailable"
          pagination="complete"
          state="missing_selection"
        />
        <ArtifactsPanel
          artifacts={[]}
          occurrenceLabel="selection unavailable"
          pagination="complete"
          runArtifactCount={4}
          state="missing_selection"
        />
      </>,
    );
    expect(
      screen.getByText("Waiting for occurrence traversal before loading selected evidence…"),
    ).toBeVisible();
    expect(screen.getAllByText("Selected occurrence unavailable")).toHaveLength(2);
    expect(screen.queryByText("No logs")).not.toBeInTheDocument();
    expect(screen.queryByText("No artifacts for this occurrence")).not.toBeInTheDocument();
  });

  it("renders workflow-step legacy descriptors without inventing content authority", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              complete: true,
              items: [
                {
                  declaredContentType: "text/plain",
                  effectiveContentType: "text/plain",
                  id: "legacy.txt",
                  mimeMismatch: false,
                  previewState: "legacy_unavailable",
                  producerStepId: "architecture",
                },
              ],
              runAggregateCount: 4,
              runId: "run-1",
              schemaVersion: "2",
              scope: { kind: "workflow_step", stepId: "architecture" },
            }),
            { headers: { "content-type": "application/json" } },
          ),
      ),
    );
    renderFeature(<WorkflowStepArtifacts runId="run-1" stepId="architecture" />);
    expect(await screen.findByText("legacy.txt")).toBeVisible();
    expect(screen.getByText(/provenance unavailable/i)).toBeVisible();
    expect(screen.getByText(/content unavailable/i)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Preview" })).not.toBeInTheDocument();
  });

  it("uses accessible native media controls for typed media previews", () => {
    renderFeature(
      <ArtifactPreviewBody
        artifact={{
          declaredContentType: "audio/mpeg",
          effectiveContentType: "audio/mpeg",
          id: "evidence.mp3",
          key: "audio",
          mimeMismatch: false,
          preview: { kind: "media", media: "audio", state: "available", url: "/audio" },
          producerLabel: "architecture · 1",
          producerStepId: "architecture",
        }}
      />,
    );
    expect(screen.getByLabelText("Audio preview of evidence.mp3")).toHaveAttribute("controls");
  });

  it("preflights passive documents before rendering a sandboxed frame", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("document")),
    );
    renderFeature(
      <ArtifactPreviewBody
        artifact={{
          declaredContentType: "application/pdf",
          effectiveContentType: "application/pdf",
          id: "evidence.pdf",
          key: "pdf",
          mimeMismatch: false,
          preview: { kind: "document", state: "available", url: "/document" },
          producerLabel: "architecture · 1",
          producerStepId: "architecture",
        }}
      />,
    );
    expect(await screen.findByTitle("Preview of evidence.pdf")).toHaveAttribute("sandbox", "");
  });
});
