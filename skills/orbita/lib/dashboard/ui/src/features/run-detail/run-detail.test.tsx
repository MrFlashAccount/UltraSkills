import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "bun:test";
import { AppProviders } from "@/app/AppProviders";
import { makeDetail } from "@/test/fixtures";
import { stubGlobal } from "@/test/globals";
import { RunDetailSurface } from "./RunDetailSurface";

const occurrenceRef = "occurrence_ref_01";
const artifactRef = "artifact_ref_0001";

const renderDetail = (component: React.ReactNode) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AppProviders>{component}</AppProviders>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  stubGlobal(
    "fetch",
    vi.fn(async (request: string | URL | Request) => {
      const url = String(typeof request === "object" && "url" in request ? request.url : request);
      if (url.includes("/workflow")) {
        return json({
          complete: true,
          edges: [{ from: "research", to: "step-1" }],
          nodes: [
            { kind: "worker", stepId: "research" },
            {
              kind: "fanout",
              parallelism: { count: 3, maxParallel: 2, mode: "branches" },
              stepId: "step-1",
            },
          ],
          runId: "run-1",
          schemaVersion: "2",
          workflowFingerprint: "workflow_fingerprint_01",
        });
      }
      if (url.includes("/traversal")) {
        return json({
          availability: "available",
          complete: true,
          items: [
            {
              occurrenceRef: "occurrence_ref_00",
              ordinal: 1,
              peers: [],
              state: "completed",
              stepId: "research",
            },
            { occurrenceRef, ordinal: 1, peers: [], state: "current", stepId: "step-1" },
          ],
          runId: "run-1",
          schemaVersion: "2",
          transitions: [{ from: "research", to: "step-1" }],
        });
      }
      if (url.includes("/activity")) {
        return json({
          complete: true,
          items: [
            {
              event: publicText("Fanout activation started", "activity_label"),
              source: "route",
              state: "completed",
            },
          ],
          occurrenceRef,
          runId: "run-1",
          schemaVersion: "2",
        });
      }
      if (url.includes("/logs")) {
        return json({
          complete: true,
          entries: [
            {
              markdown: publicText("**Managed evidence**", "managed_markdown"),
              source: "workflow-runner",
            },
          ],
          occurrenceRef,
          runId: "run-1",
          schemaVersion: "2",
        });
      }
      if (url.includes("/artifacts")) {
        const occurrenceScoped = url.includes("occurrenceRef=");
        const stepId = new URL(url, "http://dashboard.test").searchParams.get("stepId");
        return json({
          complete: true,
          items: [
            {
              artifactRef,
              declaredContentType: "image/png",
              effectiveContentType: "image/png",
              id: "workflow-trail.png",
              mimeMismatch: false,
              previewState: "previewable",
              producerOccurrence: 1,
              producerRequestId: "request-01",
              producerStepId: occurrenceScoped ? "step-1" : (stepId ?? "research"),
            },
          ],
          runAggregateCount: 1,
          runId: "run-1",
          schemaVersion: "2",
          scope: occurrenceScoped
            ? { kind: "occurrence", occurrenceRef }
            : { kind: "workflow_step", stepId: stepId ?? "research" },
        });
      }
      return json({}, 404);
    }),
  );
});

describe("RunDetailSurface", () => {
  it("renders Direction A and scopes occurrence detail without recomposing Workflow", async () => {
    const close = vi.fn();
    renderDetail(
      <RunDetailSurface
        detail={makeDetail()}
        isError={false}
        isLoading={false}
        onClose={close}
        onReturnFocus={() => {}}
        selectedId="run-1"
        visibleInResults
      />,
    );
    expect(screen.getByRole("dialog", { name: "Run 1 needs attention" })).toHaveTextContent(
      "A bounded public summary",
    );
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Workflow",
      "Activity",
      "Logs",
      "Artifacts",
    ]);
    expect(await screen.findByRole("region", { name: "Workflow graph" })).toBeVisible();
    expect(screen.getByLabelText("step-1, Fanout, Current")).toBeInTheDocument();
    const graphBefore = screen.getByRole("region", { name: "Workflow graph" }).innerHTML;
    fireEvent.click(screen.getByRole("button", { name: /research/i }));
    expect(screen.getByRole("region", { name: "Workflow graph" }).innerHTML).toBe(graphBefore);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Activity" }), { button: 0 });
    expect(await screen.findByText("Fanout activation started")).toBeVisible();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Logs" }), { button: 0 });
    expect(await screen.findByText("Managed evidence")).toBeVisible();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Artifacts" }), { button: 0 });
    expect(await screen.findByText("workflow-trail.png")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close details" }));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("keeps Workflow available when legacy occurrence evidence is unavailable", async () => {
    renderDetail(
      <RunDetailSurface
        detail={{
          ...makeDetail(),
          currentOccurrence: null,
          occurrenceAvailability: "legacy_unavailable",
        }}
        isError={false}
        isLoading={false}
        onClose={() => {}}
        onReturnFocus={() => {}}
        selectedId="run-1"
        visibleInResults
      />,
    );
    expect(await screen.findByRole("region", { name: "Workflow graph" })).toBeVisible();
    expect(screen.getByRole("button", { name: /step-1.*current/i })).toBeVisible();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Activity" }), { button: 0 });
    expect(screen.getByText(/step is known from workflow history/i)).toBeVisible();
  });

  it("preserves a missing selection instead of selecting a neighbor", () => {
    renderDetail(
      <RunDetailSurface
        isError={false}
        isLoading={false}
        onClose={() => {}}
        onReturnFocus={() => {}}
        selectedId="run-1"
        visibleInResults={false}
      />,
    );
    expect(screen.getByText("This run is no longer in the current results")).toBeVisible();
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

function publicText(value: string, sourceClass: "activity_label" | "managed_markdown") {
  return { policyVersion: "2", sourceClass, value };
}
