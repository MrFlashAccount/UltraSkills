import { expect, type Locator, test } from "@playwright/test";
import { mockDashboard } from "./dashboard-mock";
import { detailFor, resourcesFor } from "./fixtures";

const proofDir = "skills/orbita/lib/dashboard/ui/e2e/proof";

test("Direction A preserves Workflow and scopes selected-step evidence", async ({
  page,
}, testInfo) => {
  await mockDashboard(page);
  await page.goto("/");
  const boardRegion = page.locator(".board-region");
  const boardBefore = await boardRegion.boundingBox();
  const origin = page.locator(".run-card").first();
  await origin.click();
  const dialog = page.getByRole("complementary", { name: "Run detail inspection" });
  await expect(dialog).toBeVisible();
  await expectOverlayPlacement(dialog, testInfo.project.name);
  await expectUnshifted(boardRegion, boardBefore);
  const tabs = dialog.getByRole("tab");
  await expect(tabs).toHaveCount(4);
  expect(await tabs.allTextContents()).toEqual(["Workflow", "Activity", "Logs", "Artifacts"]);
  const selector = dialog.getByRole("region", { name: "Current workflow path" });
  await expect(selector.locator("button[data-step]")).toHaveCount(3);
  await expectEdgePaddingOnItems(selector);
  const selectedStep = selector.getByRole("button", { name: /architecture.*current/i });
  await expect(selectedStep).toHaveAttribute("aria-pressed", "true");
  await expectContained(selectedStep, selector);
  await expectUniformBorder(selectedStep);
  const tabList = dialog.getByRole("tablist");
  expect((await selector.boundingBox())!.y).toBeLessThan((await tabList.boundingBox())!.y);
  const workflowGraph = dialog.getByRole("region", { name: "Workflow graph" });
  const selectedWorkflowStep = workflowGraph.locator(".react-flow__node.selected");
  await expect(selectedWorkflowStep).toHaveAttribute("data-id", "architecture");
  await expect(dialog.getByLabel("Artifacts produced by architecture")).toContainText(
    "workflow-trail.png",
  );
  await page.screenshot({ path: `${proofDir}/v2-direction-a-${testInfo.project.name}.png` });
  const researchStep = dialog.getByRole("button", { name: /research.*completed/i });
  await researchStep.click();
  await expectContained(researchStep, selector);
  await expect(selectedWorkflowStep).toHaveAttribute("data-id", "architecture");
  await dialog.getByRole("tab", { name: "Activity" }).click();
  await expect(dialog.getByRole("heading", { name: "Activity · research" })).toBeVisible();
  await dialog.getByRole("button", { name: /architecture.*current/i }).click();
  await expect(dialog.getByRole("heading", { name: "Activity · architecture" })).toBeVisible();
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
  await expect(page.getByRole("complementary", { name: "Run detail inspection" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(origin).toBeFocused();
  await expect(page.getByRole("complementary", { name: "Run detail inspection" })).toBeHidden();
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
  const dialog = page.getByRole("complementary", { name: "Run detail inspection" });
  const bounds = await dialog.boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(575);
  expect(bounds!.y).toBe(0);
  expect(bounds!.height).toBe(768);
  await expect(dialog).toHaveCSS("position", "fixed");
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
  await expect(page.getByRole("complementary", { name: "Run detail inspection" })).toBeVisible();
  await page.getByRole("button", { name: "Close details" }).click();

  await page.locator(`.run-card[data-run-id="${nextRun.runId}"]`).click();
  const pendingDialog = page.getByRole("complementary");
  await expect(pendingDialog).not.toContainText("Run detail inspection");
  await expect(page.getByRole("complementary", { name: nextRun.title.value })).toBeVisible();
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
  await expectContained(page.getByText(/loaded · partial/u), page.getByRole("complementary"));
  await page.getByRole("tab", { name: "Activity" }).click();
  await expect(page.getByRole("heading", { name: "Activity · architecture" })).toBeVisible();
  await page.getByRole("button", { name: "Show earlier" }).click();
  await expect(page.getByText(/Workflow path changed while paging/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /architecture.*current/i })).toBeVisible();
  await page.screenshot({ path: `${proofDir}/v2-stale-paging-${testInfo.project.name}.png` });
  await page
    .getByRole("region", { name: "Current workflow path" })
    .getByRole("button", { name: "Reload from latest" })
    .click();
  await replacementRequested;
  await expect(page.getByRole("heading", { name: "Activity · architecture" })).toBeVisible();
  await expect(page.getByText("Fanout activation 1 started")).toBeVisible();
  releaseReplacement?.();
  await expect(page.getByRole("button", { name: /architecture.*current/i })).toBeVisible();
  await page.screenshot({ path: `${proofDir}/v2-vanished-selection-${testInfo.project.name}.png` });
});

test("step panels show traversal pending instead of successful emptiness", async ({
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
    page.getByText("Waiting for workflow traversal before loading selected evidence…"),
  ).toBeVisible();
  await page.screenshot({ path: `${proofDir}/v2-traversal-pending-${testInfo.project.name}.png` });
  releaseTraversal?.();
  await expect(page.getByRole("heading", { name: "Activity · architecture" })).toBeVisible();
});

test("workflow renders durable artifact descriptors with content authority", async ({
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
            artifactRef: "artifact_ref_evidence_01",
            declaredContentType: "text/plain",
            effectiveContentType: "text/plain",
            id: "evidence.txt",
            mimeMismatch: false,
            previewState: "previewable",
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
  await expect(page.getByText("evidence.txt")).toBeVisible();
  await expect(page.getByText(/content unavailable/u)).toBeHidden();
  await page.screenshot({ path: `${proofDir}/v2-artifact-${testInfo.project.name}.png` });
});

test("artifact continuation reaches an explicit end state", async ({ page }, testInfo) => {
  const snapshot = await mockDashboard(page);
  const run = snapshot.runs[0]!;
  const resources = resourcesFor(run);
  await page.route("**/api/dashboard/v2/runs/*/artifacts?*", async (route) => {
    const url = new URL(route.request().url());
    const cursor = url.searchParams.get("cursor");
    await route.fulfill({
      json: {
        ...resources.artifacts,
        complete: Boolean(cursor),
        items: cursor ? [resources.artifacts.items[1]] : [resources.artifacts.items[0]],
        scope: { kind: "workflow_step", stepId: url.searchParams.get("stepId")! },
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

async function expectUnshifted(
  region: Locator,
  before: Awaited<ReturnType<Locator["boundingBox"]>>,
) {
  const after = await region.boundingBox();
  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  expect(after!.x).toBeCloseTo(before!.x, 0);
  expect(after!.width).toBeCloseTo(before!.width, 0);
}

async function expectUniformBorder(element: Locator) {
  const style = await element.evaluate((node) => {
    const computed = getComputedStyle(node);
    return {
      bottom: computed.borderBottomWidth,
      boxShadow: computed.boxShadow,
      left: computed.borderLeftWidth,
      right: computed.borderRightWidth,
      top: computed.borderTopWidth,
    };
  });
  expect(new Set([style.top, style.right, style.bottom, style.left]).size).toBe(1);
  expect(style.boxShadow).toBe("none");
}

async function expectEdgePaddingOnItems(selector: Locator) {
  const spacing = await selector.evaluate((node) => {
    const items = node.querySelectorAll("li");
    const outer = getComputedStyle(node);
    return {
      first: getComputedStyle(items.item(0)).paddingLeft,
      last: getComputedStyle(items.item(items.length - 1)).paddingRight,
      outerLeft: outer.paddingLeft,
      outerRight: outer.paddingRight,
    };
  });
  expect(spacing.outerLeft).toBe("0px");
  expect(spacing.outerRight).toBe("0px");
  expect(Number.parseFloat(spacing.first)).toBeGreaterThan(0);
  expect(Number.parseFloat(spacing.last)).toBeGreaterThan(0);
}

async function expectOverlayPlacement(dialog: Locator, project: string) {
  await expect(dialog).toHaveCSS("position", "fixed");
  const bounds = await dialog.boundingBox();
  const viewport = dialog.page().viewportSize();
  expect(bounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (project === "mobile") {
    expect(bounds!.x).toBe(0);
    expect(bounds!.width).toBeCloseTo(viewport!.width, 0);
  } else {
    expect(bounds!.x + bounds!.width).toBeCloseTo(viewport!.width, 0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport!.height);
  }
}
