import { expect, test } from "@playwright/test";
import { mockDashboard } from "./dashboard-mock";

test("board remains dense, keyboard reachable, and contained", async ({ page }, testInfo) => {
  await mockDashboard(page, 1000);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Orbita runs" })).toBeVisible();
  expect(await page.locator(".run-card").count()).toBeLessThanOrEqual(150);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  const first = page.locator(".run-card").first();
  await first.focus();
  await expect(first).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Run detail inspection" })).toBeVisible();
  await page.getByRole("button", { name: "Close details" }).click();
  await expect(first).toBeFocused();
  await page.screenshot({
    path: `skills/orbita/lib/dashboard/ui/e2e/proof/v2-board-${testInfo.project.name}.png`,
  });
});

test("snapshot failure stays explicit", async ({ page }) => {
  await page.route("**/api/dashboard/v2/runs", (route) =>
    route.fulfill({
      json: {
        error: {
          code: "observer_unavailable",
          message: "Dashboard data is temporarily unavailable",
        },
      },
      status: 503,
    }),
  );
  await page.goto("/");
  await expect(page.getByText("Could not load runs")).toBeVisible();
});

test("empty and stale board states do not masquerade as success", async ({ page }) => {
  const snapshot = await mockDashboard(page, 0);
  await page.goto("/");
  await expect(page.getByText("No runs yet")).toBeVisible();
  await page.unroute("**/api/dashboard/v2/runs");
  snapshot.freshness = {
    ...snapshot.freshness,
    failureCode: "observer_refresh_failed",
    retryAt: snapshot.generatedAt,
    staleSince: snapshot.generatedAt,
    state: "stale",
  };
  snapshot.runs = (await import("./fixtures")).buildSnapshot(5).runs;
  await page.route("**/api/dashboard/v2/runs", (route) => route.fulfill({ json: snapshot }));
  await page.reload();
  await expect(page.getByText(/Existing runs remain visible/)).toBeVisible();
});
