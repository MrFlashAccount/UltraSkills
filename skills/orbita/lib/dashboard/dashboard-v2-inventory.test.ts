import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dashboardRoot = import.meta.dir;
const routesRoot = join(dashboardRoot, "ui", "src", "routes");
const entrypointsRoot = join(dashboardRoot, "..", "entrypoints");

function sourceFiles(root: string): Array<string> {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const pathname = join(root, entry.name);
    if ([".output", "node_modules", "e2e"].includes(entry.name)) {
      return [];
    }
    if (entry.isDirectory()) {
      return sourceFiles(pathname);
    }
    return /\.(?:js|mjs|ts|tsx)$/u.test(entry.name) && !entry.name.includes(".test.")
      ? [pathname]
      : [];
  });
}

describe("atomic dashboard v2 inventory", () => {
  test("exposes exactly the nine approved Start data resources and no v1 route", () => {
    const apiRoutes = readdirSync(routesRoot)
      .filter((name) => name.startsWith("api.dashboard."))
      .sort();
    expect(apiRoutes).toEqual([
      "api.dashboard.v2.events.ts",
      "api.dashboard.v2.runs.$runId.activity.ts",
      "api.dashboard.v2.runs.$runId.artifacts.$artifactRef.ts",
      "api.dashboard.v2.runs.$runId.artifacts.ts",
      "api.dashboard.v2.runs.$runId.logs.ts",
      "api.dashboard.v2.runs.$runId.traversal.ts",
      "api.dashboard.v2.runs.$runId.ts",
      "api.dashboard.v2.runs.$runId.workflow.ts",
      "api.dashboard.v2.runs.ts",
    ]);
  });

  test("keeps production dashboard source and public entrypoints free of v1 and control residue", () => {
    const forbiddenV1 = ["api/dashboard/v", "1"].join("");
    const dashboardSource = ["contracts", "projection", "observer", join("ui", "src")]
      .flatMap((directory) => sourceFiles(join(dashboardRoot, directory)))
      .map((pathname) => readFileSync(pathname, "utf8"))
      .join("\n");
    expect(dashboardSource).not.toContain(forbiddenV1);
    expect(dashboardSource).not.toMatch(
      /from\s+["'][^"']*(?:entrypoints|use-cases|runner|runtime)\//u,
    );

    const entrypointSource = sourceFiles(entrypointsRoot)
      .map((pathname) => readFileSync(pathname, "utf8"))
      .join("\n");
    expect(entrypointSource).not.toMatch(
      /dashboard(?:-read-model|\/contracts|\/observer|\/projection)/u,
    );
  });
});
