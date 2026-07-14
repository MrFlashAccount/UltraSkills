import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "bun:test";
import { AppProviders } from "@/app/AppProviders";
import { stubGlobal } from "@/test/globals";
import { ActivityGroupView, ActivityPanel } from "./ActivityPanel";
import { ArtifactPreviewBody } from "./ArtifactPreviewBody";
import { ArtifactsPanel } from "./ArtifactsPanel";
import { LogsPanel } from "./LogsPanel";
import { StepPathSelector } from "./StepPathSelector";
import { WorkflowStepArtifacts } from "./WorkflowStepArtifacts";

const steps = [
  { state: "completed" as const, stepId: "research" },
  { state: "current" as const, stepId: "architecture" },
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
  it("shows unique path steps and supports arrow traversal", () => {
    const onSelect = vi.fn();
    renderFeature(
      <StepPathSelector
        onRetryPaging={() => {}}
        onSelect={onSelect}
        onShowEarlier={() => {}}
        pagination="more"
        selectedStepId="architecture"
        steps={steps}
      />,
    );
    const research = screen.getByRole("button", { name: /research/i });
    const architecture = screen.getByRole("button", { name: /architecture/i });
    expect(architecture).toHaveAttribute("aria-pressed", "true");
    research.focus();
    fireEvent.keyDown(research, { key: "ArrowRight" });
    expect(architecture).toHaveFocus();
    fireEvent.click(architecture);
    expect(onSelect).toHaveBeenCalledWith("architecture");
  });

  it("renders nested activity as a semantic table", () => {
    renderFeature(
      <ActivityGroupView
        group={{
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
        }}
        pagination="complete"
      />,
    );
    expect(screen.getByRole("table")).toHaveTextContent("spec_modeling");
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
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
        pagination="more"
        state="ready"
        stepLabel="architecture"
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

  it("preflights active content into an opaque allow-scripts sandbox", async () => {
    stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<!doctype html><p>Proof</p>")),
    );
    renderFeature(
      <ArtifactPreviewBody
        artifact={{
          artifactRef: "artifact-active",
          declaredContentType: "text/html",
          effectiveContentType: "text/html",
          id: "report.html",
          key: "artifact-active",
          mimeMismatch: false,
          preview: { kind: "active_frame", state: "available", url: "/preview/active" },
          producerLabel: "architecture",
          producerStepId: "architecture",
        }}
      />,
    );
    const frame = await screen.findByTitle("Preview of report.html");
    expect(frame).toHaveAttribute("sandbox", "allow-scripts");
  });

  it("renders Markdown artifacts through the shared safe renderer", async () => {
    stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            "# Report\n\n## Summary\n\n- Safe\n- Structured\n\n| Severity | Finding |\n| --- | --- |\n| High | Evidence |\n\n<script>unsafe()</script>",
          ),
      ),
    );
    const { container } = renderFeature(
      <ArtifactPreviewBody
        artifact={{
          artifactRef: "artifact-markdown",
          declaredContentType: "text/markdown",
          effectiveContentType: "text/markdown",
          id: "report.md",
          key: "artifact-markdown",
          mimeMismatch: false,
          preview: { kind: "markdown", state: "available", url: "/preview/markdown" },
          producerLabel: "architecture",
          producerStepId: "architecture",
        }}
      />,
    );
    expect(await screen.findByText("Safe")).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "Summary" })).toBeVisible();
    expect(screen.getByRole("list")).toHaveTextContent("Structured");
    expect(screen.getByRole("region", { name: "Scrollable Markdown table" })).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(screen.getByRole("table")).toHaveTextContent("Evidence");
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
            id: "report.txt",
            key: "report",
            mimeMismatch: false,
            preview: {
              reason: "Preview is unsupported for this file.",
              state: "unsupported",
            },
            producerLabel: "architecture",
            producerStepId: "architecture",
          },
        ]}
        onRetryPaging={retry}
        pagination="stale"
        runArtifactCount={3}
        state="ready"
        stepLabel="architecture"
      />,
    );
    expect(screen.getByText("report.txt")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reload from latest" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("distinguishes traversal-pending and vanished-selection evidence from successful emptiness", () => {
    renderFeature(
      <>
        <ActivityPanel
          groups={[]}
          runId="run-1"
          state="traversal_pending"
          step={undefined}
          stepId={undefined}
          stepLabel="step pending"
        />
        <LogsPanel
          entries={[]}
          pagination="complete"
          state="missing_selection"
          stepLabel="selection unavailable"
        />
        <ArtifactsPanel
          artifacts={[]}
          pagination="complete"
          runArtifactCount={4}
          state="missing_selection"
          stepLabel="selection unavailable"
        />
      </>,
    );
    expect(
      screen.getByText("Waiting for workflow traversal before loading selected evidence…"),
    ).toBeVisible();
    expect(screen.getAllByText("Selected step unavailable")).toHaveLength(2);
    expect(screen.queryByText("No logs")).not.toBeInTheDocument();
    expect(screen.queryByText("No artifacts for this step")).not.toBeInTheDocument();
  });

  it("renders workflow-step descriptors from the durable artifact record", async () => {
    stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              complete: true,
              items: [
                {
                  artifactRef: "artifact_ref_durable_01",
                  declaredContentType: "text/plain",
                  effectiveContentType: "text/plain",
                  id: "report.txt",
                  mimeMismatch: false,
                  previewState: "previewable",
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
    expect(await screen.findByText("report.txt")).toBeVisible();
    expect(screen.getByText("architecture")).toBeVisible();
    expect(screen.queryByText(/content unavailable/i)).not.toBeInTheDocument();
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
          producerLabel: "architecture",
          producerStepId: "architecture",
        }}
      />,
    );
    expect(screen.getByLabelText("Audio preview of evidence.mp3")).toHaveAttribute("controls");
  });

  it("preflights passive documents before rendering a sandboxed frame", async () => {
    stubGlobal(
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
          producerLabel: "architecture",
          producerStepId: "architecture",
        }}
      />,
    );
    expect(await screen.findByTitle("Preview of evidence.pdf")).toHaveAttribute("sandbox", "");
  });
});
