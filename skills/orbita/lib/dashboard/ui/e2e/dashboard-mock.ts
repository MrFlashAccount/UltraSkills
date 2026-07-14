import type { Page, Route } from "@playwright/test";
import { buildSnapshot, detailFor, resourcesFor } from "./fixtures";

export async function mockDashboard(page: Page, count = 80) {
  const snapshot = buildSnapshot(count);
  await page.addInitScript(() => {
    class StableEventSource extends EventTarget {
      static readonly OPEN = 1;
      readonly OPEN = 1;
      readonly CONNECTING = 0;
      readonly CLOSED = 2;
      readyState = 1;
      withCredentials = false;
      onopen: ((event: Event) => void) | null = null;
      onerror = null;
      onmessage = null;
      url: string;
      constructor(url: string | URL) {
        super();
        this.url = String(url);
        setTimeout(() => this.onopen?.(new Event("open")), 0);
      }
      close() {
        this.readyState = 2;
      }
    }
    Object.defineProperty(window, "EventSource", { value: StableEventSource });
  });
  await page.route("**/api/dashboard/v2/runs", (route) => route.fulfill({ json: snapshot }));
  await page.route("**/api/dashboard/v2/runs/**", (route) => fulfillRunResource(route, snapshot));
  return snapshot;
}

async function fulfillRunResource(route: Route, snapshot: ReturnType<typeof buildSnapshot>) {
  const url = new URL(route.request().url());
  const segments = url.pathname.split("/").filter(Boolean);
  const runId = segments[4];
  const run = snapshot.runs.find((candidate) => candidate.runId === runId);
  if (!run) {
    await route.fulfill({
      json: { error: { code: "not_found", message: "Run not found" } },
      status: 404,
    });
    return;
  }
  const resource = segments[5];
  const resources = resourcesFor(run);
  if (!resource) {
    await route.fulfill({ json: detailFor(run) });
  } else if (
    resource === "workflow" ||
    resource === "traversal" ||
    resource === "activity" ||
    resource === "logs"
  ) {
    await route.fulfill({ json: resources[resource] });
  } else if (resource === "artifacts" && segments.length === 6) {
    const requestedStep = url.searchParams.get("stepId");
    const selectedArtifacts =
      requestedStep === "research"
        ? {
            ...resources.artifacts,
            items: [
              {
                ...resources.artifacts.items[0],
                artifactRef: "artifact_ref_research",
                id: "reasons-canvas-research.png",
                producerStepId: "research",
              },
            ],
            scope: { kind: "workflow_step" as const, stepId: requestedStep },
          }
        : resources.artifacts;
    await route.fulfill({
      json: {
        ...selectedArtifacts,
        items: selectedArtifacts.items.filter(
          (artifact) => artifact.producerStepId === requestedStep,
        ),
        scope: { kind: "workflow_step" as const, stepId: requestedStep },
      },
    });
  } else if (resource === "artifacts") {
    await route.fulfill({
      contentType: "image/png",
      path: "skills/orbita/lib/dashboard/ui/e2e/proof/desktop-1440x900-open.png",
    });
  } else {
    await route.fulfill({
      json: { error: { code: "not_found", message: "Resource not found" } },
      status: 404,
    });
  }
}
