import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "bun:test";
import { renderHtmlSelectorCaptures } from "./render-html-selector-captures.mjs";

test("renderer writes caller-selected HTML selectors to caller-selected paths", async () => {
  const workingDir = mkdtempSync(path.join(tmpdir(), "html-selector-captures-"));
  const htmlPath = path.join(workingDir, "proposal.html");
  writeFileSync(htmlPath, "<!doctype html><html><body></body></html>");

  const viewIds = ["requirements", "entities"];
  const captures = viewIds.map((viewId) => ({
    selector: `[data-capture="${viewId}"]`,
    url_hash: viewId,
    output_path: path.join(workingDir, `${viewId}.png`),
  }));
  const navigatedViews = [];
  const screenshots = [];
  let activeView = "";
  let viewClosed = false;
  const view = {
    async navigate(url) {
      assert.equal(new URL(url).hash, "");
    },
    async evaluate(script) {
      const hashPrefix = "(() => { location.hash = ";
      const hashSuffix = "; return true; })()";
      if (script.startsWith(hashPrefix)) {
        activeView = JSON.parse(script.slice(hashPrefix.length, -hashSuffix.length)).slice(1);
        navigatedViews.push(activeView);
        return true;
      }
      if (script.includes("document.fonts")) return true;
      assert.match(script, new RegExp(`data-capture=\\\\?"${activeView}\\\\?"`));
      return {
        count: 1,
        visible: true,
        x: 10,
        y: 20,
        width: 200,
        height: 100,
      };
    },
    async cdp(method, params) {
      assert.equal(method, "Page.captureScreenshot");
      assert.deepEqual(params.clip, { x: 10, y: 20, width: 200, height: 100, scale: 1 });
      screenshots.push(activeView);
      return { data: Buffer.from("fake-png").toString("base64") };
    },
    close() {
      viewClosed = true;
    },
  };

  try {
    const result = await renderHtmlSelectorCaptures({
      htmlPath,
      captures,
      viewportWidth: 1440,
      viewportHeight: 1000,
      timeoutMs: 30000,
      chromePath: "/chrome",
      createView(options) {
        assert.deepEqual(options, {
          width: 1440,
          height: 1000,
          backend: { type: "chrome", path: "/chrome" },
        });
        return view;
      },
    });

    assert.deepEqual(navigatedViews, viewIds);
    assert.equal(screenshots.length, captures.length);
    assert.equal(viewClosed, true);
    assert.equal(result.html_path, realpathSync(htmlPath));
    assert.deepEqual(
      result.output_paths,
      captures.map(({ output_path }) => output_path),
    );
    for (const outputPath of result.output_paths)
      assert.equal(readFileSync(outputPath).toString(), "fake-png");
  } finally {
    rmSync(workingDir, { recursive: true, force: true });
  }
});
