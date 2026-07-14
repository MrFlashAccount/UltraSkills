import { expect, type Locator, test } from "@playwright/test";
import { mockDashboard } from "./dashboard-mock";
import { detailFor, resourcesFor } from "./fixtures";

const proofDir = "skills/orbita/lib/dashboard/ui/e2e/proof";

test("Direction A preserves Workflow and scopes selected-occurrence evidence", async ({
  page,
}, testInfo) => {
  await mockDashboard(page);
  await page.goto("/");
  const origin = page.locator(".run-card").first();
  await origin.click();
  const dialog = page.getByRole("dialog", { name: "Run detail inspection" });
  await expect(dialog).toBeVisible();
  await expectOverlayPlacement(dialog, testInfo.project.name);
  const tabs = dialog.getByRole("tab");
  await expect(tabs).toHaveCount(4);
  expect(await tabs.allTextContents()).toEqual(["Workflow", "Activity", "Logs", "Artifacts"]);
  const selector = dialog.getByRole("region", { name: "Step occurrences" });
  await expect(selector.getByRole("button")).toHaveCount(5);
  const selectedOccurrence = selector.getByRole("button", { name: /architecture · 2/i });
  await expect(selectedOccurrence).toHaveAttribute("aria-pressed", "true");
  await expectContained(selectedOccurrence, selector);
  const tabList = dialog.getByRole("tablist");
  expect((await selector.boundingBox())!.y).toBeLessThan((await tabList.boundingBox())!.y);
  const workflowGraph = dialog.getByRole("region", { name: "Workflow graph" });
  const selectedWorkflowStep = workflowGraph.locator(".react-flow__node.selected");
  await expect(selectedWorkflowStep).toHaveAttribute("data-id", "architecture");
  await expect(dialog.getByLabel("Artifacts produced by architecture")).toContainText(
    "workflow-trail.png",
  );
  await page.screenshot({ path: `${proofDir}/v2-direction-a-${testInfo.project.name}.png` });
  const researchOccurrence = dialog.getByRole("button", { name: /research · 1/i });
  await researchOccurrence.click();
  await expectContained(researchOccurrence, selector);
  await expect(selectedWorkflowStep).toHaveAttribute("data-id", "architecture");
  await dialog.getByRole("tab", { name: "Activity" }).click();
  await expect(dialog.getByRole("heading", { name: "Activity · research · 1" })).toBeVisible();
  await dialog.getByRole("button", { name: /architecture · 2/i }).click();
  await expect(dialog.getByRole("heading", { name: "Activity · architecture · 2" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Fanout activation 1" })).toBeVisible();
  if (testInfo.project.name === "mobile") {
    await expectContained(
      dialog.locator(".activity-group tr").first(),
      dialog.locator(".activity-group"),
    );
  }
  await page.screenshot({ path: `${proofDir}/v2-activity-${testInfo.project.name}.png` });
  await dialog.getByRole("tab", { name: "Logs" }).click();
  await expect(dialog.getByRole("heading", { name: "Managed evidence" })).toBeVisible();
  await page.screenshot({ path: `${proofDir}/v2-logs-${testInfo.project.name}.png` });
  await dialog.getByRole("tab", { name: "Artifacts" }).click();
  await expect(dialog.getByText(/Showing 2 of 3 run artifacts/)).toBeVisible();
  await page.screenshot({ path: `${proofDir}/v2-artifacts-${testInfo.project.name}.png` });
});

test("preview and drawer restore independent focus origins", async ({ page }, testInfo) => {
  await mockDashboard(page);
  await page.goto("/");
  const origin = page.locator(".run-card").first();
  await origin.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("tab", { name: "Artifacts" }).click();
  const previewOpener = page.getByRole("button", { name: "Preview" }).first();
  await previewOpener.click();
  await expect(page.getByRole("dialog", { name: "workflow-trail.png" })).toBeVisible();
  await page.screenshot({ path: `${proofDir}/v2-preview-${testInfo.project.name}.png` });
  await page.keyboard.press("Escape");
  await expect(previewOpener).toBeFocused();
  await expect(page.getByRole("dialog", { name: "Run detail inspection" })).toBeVisible();
  await page.evaluate(() => {
    const sheet = document.querySelector<HTMLElement>(".sheet-content");
    if (!sheet) {
      return;
    }
    const observer = new MutationObserver(() => {
      if (sheet.dataset.state === "closed") {
        (window as typeof window & { closingSheetText?: string }).closingSheetText =
          sheet.textContent ?? "";
        observer.disconnect();
      }
    });
    observer.observe(sheet, { attributes: true, attributeFilter: ["data-state"] });
  });
  await page.keyboard.press("Escape");
  await expect(origin).toBeFocused();
  expect(
    await page.evaluate(
      () => (window as typeof window & { closingSheetText?: string }).closingSheetText,
    ),
  ).toContain("Run detail inspection");
  await page.screenshot({ path: `${proofDir}/v2-focus-return-${testInfo.project.name}.png` });
});

test("long artifact ids remain contained and preview failure keeps recovery", async ({
  page,
}, testInfo) => {
  await mockDashboard(page);
  await page.route(/\/artifacts\/[^?]+\?mode=preview$/u, (route) =>
    route.fulfill({ body: "Preview unavailable", status: 503 }),
  );
  await page.goto("/");
  await page.locator(".run-card").first().click();
  await page.getByRole("tab", { name: "Artifacts" }).click();
  await expect(
    page.getByText(
      "architecture-review-evidence-with-an-intentionally-long-identifier-for-contained-layout.json",
    ),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: `${proofDir}/v2-artifacts-long-id-${testInfo.project.name}.png` });
  await page.getByRole("button", { name: "Preview" }).first().click();
  await expect(page.getByRole("alert")).toContainText("image response could not be rendered");
  await expect(page.getByRole("link", { name: "Download" })).toBeVisible();
  await page.screenshot({ path: `${proofDir}/v2-artifact-recovery-${testInfo.project.name}.png` });
});

test("tablet containment and reduced motion match the approved contract", async ({ page }) => {
  await mockDashboard(page);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator(".run-card").first().click();
  const dialog = page.getByRole("dialog", { name: "Run detail inspection" });
  const bounds = await dialog.boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(976);
  expect(bounds!.height).toBeLessThanOrEqual(704);
  await expect(dialog).toHaveCSS("animation-duration", "0s");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: `${proofDir}/v2-direction-a-tablet.png` });
});

test("run transitions never reuse the previous identity while the next detail is pending", async ({
  page,
}) => {
  const snapshot = await mockDashboard(page);
  const nextRun = snapshot.runs[5]!;
  await page.route(`**/api/dashboard/v2/runs/${nextRun.runId}`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 120));
    await route.fulfill({ json: detailFor(nextRun) });
  });
  await page.goto("/");
  const first = page.locator('.run-card[data-run-id="run-proof-0000"]');
  await first.click();
  await expect(page.getByRole("dialog", { name: "Run detail inspection" })).toBeVisible();
  await page.getByRole("button", { name: "Close details" }).click();

  await page.locator(`.run-card[data-run-id="${nextRun.runId}"]`).click();
  const pendingDialog = page.getByRole("dialog");
  await expect(pendingDialog).not.toContainText("Run detail inspection");
  await expect(page.getByRole("dialog", { name: nextRun.title.value })).toBeVisible();
  await expect(pendingDialog).toContainText(nextRun.runId);
});

test("stale traversal paging preserves evidence and restarts from the latest page", async ({
  page,
}, testInfo) => {
  const snapshot = await mockDashboard(page);
  const run = snapshot.runs[0]!;
  const traversal = resourcesFor(run).traversal;
  let staleSeen = false;
  let releaseReplacement: (() => void) | undefined;
  let markReplacementRequested: (() => void) | undefined;
  const replacementGate = new Promise<void>((resolve) => {
    releaseReplacement = resolve;
  });
  const replacementRequested = new Promise<void>((resolve) => {
    markReplacementRequested = resolve;
  });
  await page.route("**/api/dashboard/v2/runs/*/traversal*", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.has("cursor")) {
      staleSeen = true;
      await route.fulfill({
        json: { error: { code: "stale_locator", message: "Resource locator is stale" } },
        status: 409,
      });
      return;
    }
    if (staleSeen) {
      markReplacementRequested?.();
      await replacementGate;
      await route.fulfill({
        json: { ...traversal, complete: true, items: [traversal.items[0]] },
      });
      return;
    }
    await route.fulfill({
      json: { ...traversal, complete: false, nextCursor: "cursor_stale_proof_01", truncated: true },
    });
  });
  await page.goto("/");
  await page.locator('.run-card[data-run-id="run-proof-0000"]').click();
  await expect(
    page.getByText("Workflow definition complete · execution evidence partial"),
  ).toBeVisible();
  await expectContained(page.getByText(/loaded · partial/u), page.getByRole("dialog"));
  await page.getByRole("tab", { name: "Activity" }).click();
  await expect(page.getByRole("heading", { name: "Activity · architecture · 2" })).toBeVisible();
  await page.getByRole("button", { name: "Show earlier" }).click();
  await expect(page.getByText(/Occurrences changed while paging/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /architecture · 2/i })).toBeVisible();
  await page.screenshot({ path: `${proofDir}/v2-stale-paging-${testInfo.project.name}.png` });
  await page
    .getByRole("region", { name: "Step occurrences" })
    .getByRole("button", { name: "Reload from latest" })
    .click();
  await replacementRequested;
  await expect(page.getByRole("heading", { name: "Activity · architecture · 2" })).toBeVisible();
  await expect(page.getByText("Fanout activation 1 started")).toBeVisible();
  releaseReplacement?.();
  await expect(page.getByText("Selected occurrence unavailable")).toBeVisible();
  await page.screenshot({ path: `${proofDir}/v2-vanished-selection-${testInfo.project.name}.png` });
});

test("occurrence panels show traversal pending instead of successful emptiness", async ({
  page,
}, testInfo) => {
  const snapshot = await mockDashboard(page);
  const traversal = resourcesFor(snapshot.runs[0]!).traversal;
  let releaseTraversal: (() => void) | undefined;
  const traversalGate = new Promise<void>((resolve) => {
    releaseTraversal = resolve;
  });
  await page.route("**/api/dashboard/v2/runs/*/traversal*", async (route) => {
    await traversalGate;
    await route.fulfill({ json: traversal });
  });
  await page.goto("/");
  await page.locator(".run-card").first().click();
  await page.getByRole("tab", { name: "Activity" }).click();
  await expect(
    page.getByText("Waiting for occurrence traversal before loading selected evidence…"),
  ).toBeVisible();
  await page.screenshot({ path: `${proofDir}/v2-traversal-pending-${testInfo.project.name}.png` });
  releaseTraversal?.();
  await expect(page.getByRole("heading", { name: "Activity · architecture · 2" })).toBeVisible();
});

test("workflow renders legacy descriptors without occurrence or content authority", async ({
  page,
}, testInfo) => {
  await mockDashboard(page);
  await page.route("**/api/dashboard/v2/runs/*/artifacts?stepId=*", async (route) => {
    const url = new URL(route.request().url());
    const runId = url.pathname.split("/")[5]!;
    const stepId = url.searchParams.get("stepId")!;
    await route.fulfill({
      json: {
        complete: true,
        items: [
          {
            declaredContentType: "text/plain",
            effectiveContentType: "text/plain",
            id: "legacy-evidence.txt",
            mimeMismatch: false,
            previewState: "legacy_unavailable",
            producerStepId: stepId,
          },
        ],
        runAggregateCount: 4,
        runId,
        schemaVersion: "2",
        scope: { kind: "workflow_step", stepId },
      },
    });
  });
  await page.goto("/");
  await page.locator(".run-card").first().click();
  await expect(page.getByText("legacy-evidence.txt")).toBeVisible();
  await expect(page.getByText(/content unavailable/u)).toBeVisible();
  await expect(page.getByText(/provenance unavailable/u)).toBeVisible();
  await page.screenshot({ path: `${proofDir}/v2-legacy-artifact-${testInfo.project.name}.png` });
});

test("artifact continuation reaches an explicit end state", async ({ page }, testInfo) => {
  const snapshot = await mockDashboard(page);
  const run = snapshot.runs[0]!;
  const resources = resourcesFor(run);
  await page.route("**/api/dashboard/v2/runs/*/artifacts?*", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.has("stepId")) {
      await route.fulfill({ json: resources.workflowArtifacts });
      return;
    }
    const cursor = url.searchParams.get("cursor");
    await route.fulfill({
      json: {
        ...resources.artifacts,
        complete: Boolean(cursor),
        items: cursor ? [resources.artifacts.items[1]] : [resources.artifacts.items[0]],
        ...(cursor ? {} : { nextCursor: "artifact_cursor_proof_01" }),
      },
    });
  });
  await page.goto("/");
  await page.locator('.run-card[data-run-id="run-proof-0000"]').click();
  await page.getByRole("tab", { name: "Artifacts" }).click();
  await expect(page.getByText("Showing 1 of 3 run artifacts")).toBeVisible();
  await page.getByRole("button", { name: "Load more artifacts" }).click();
  await expect(page.getByText("End of artifacts")).toBeVisible();
  await expect(page.getByText("Showing 2 of 3 run artifacts")).toBeVisible();
  await page.screenshot({ path: `${proofDir}/v2-artifact-paging-${testInfo.project.name}.png` });
});

async function expectContained(inner: Locator, outer: Locator) {
  const innerBounds = await inner.boundingBox();
  const outerBounds = await outer.boundingBox();
  expect(innerBounds).not.toBeNull();
  expect(outerBounds).not.toBeNull();
  expect(innerBounds!.x).toBeGreaterThanOrEqual(outerBounds!.x - 1);
  expect(innerBounds!.x + innerBounds!.width).toBeLessThanOrEqual(
    outerBounds!.x + outerBounds!.width + 1,
  );
}

async function expectOverlayPlacement(dialog: Locator, project: string) {
  const bounds = await dialog.boundingBox();
  const viewport = dialog.page().viewportSize();
  expect(bounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (project === "mobile") {
    expect(bounds!.x).toBeGreaterThanOrEqual(7);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport!.width - 7);
    expect(bounds!.y + bounds!.height).toBeCloseTo(viewport!.height, 0);
  } else {
    expect(bounds!.x + bounds!.width).toBeCloseTo(viewport!.width, 0);
    expect(bounds!.y).toBe(0);
  }
}
