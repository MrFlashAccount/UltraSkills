#!/usr/bin/env bun

import { realpath, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0)
    throw new Error(`--${name} must be a positive integer`);
  return parsed;
}

function normalizeCapture(spec, index) {
  if (!spec || typeof spec !== "object" || Array.isArray(spec))
    throw new Error(`capture[${index}] must be an object`);
  const keys = Object.keys(spec).sort();
  if (keys.join(",") !== "output_path,selector,url_hash") {
    throw new Error(`capture[${index}] must contain only output_path, selector, and url_hash`);
  }
  if (typeof spec.selector !== "string" || spec.selector.trim() === "")
    throw new Error(`capture[${index}].selector must be non-empty`);
  if (typeof spec.url_hash !== "string" || spec.url_hash.trim() === "")
    throw new Error(`capture[${index}].url_hash must be non-empty`);
  if (typeof spec.output_path !== "string" || spec.output_path.trim() === "")
    throw new Error(`capture[${index}].output_path must be non-empty`);
  return {
    selector: spec.selector,
    urlHash: spec.url_hash.startsWith("#") ? spec.url_hash : `#${spec.url_hash}`,
    outputPath: path.resolve(spec.output_path),
  };
}

async function requireFile(filePath) {
  const fileStat = await stat(filePath).catch(() => undefined);
  if (!fileStat?.isFile()) throw new Error(`--html must point to an existing file: ${filePath}`);
}

function captureStateScript(selector) {
  return `(() => {
    const matches = document.querySelectorAll(${JSON.stringify(selector)});
    if (matches.length !== 1) return { count: matches.length };
    const element = matches[0];
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      count: 1,
      visible: style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0,
      x: rect.x + scrollX,
      y: rect.y + scrollY,
      width: rect.width,
      height: rect.height,
    };
  })()`;
}

async function waitForCapture(view, capture, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    const state = await view.evaluate(captureStateScript(capture.selector));
    if (state?.count === 1 && state.visible) return state;
    if (Date.now() >= deadline) {
      if (state?.count !== 1)
        throw new Error(`selector must resolve to exactly one element: ${capture.selector}`);
      throw new Error(`selector did not become visible: ${capture.selector}`);
    }
    await Bun.sleep(50);
  }
}

async function withTimeout(operation, timeoutMs, label) {
  let timeout;
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

export async function renderHtmlSelectorCaptures({
  htmlPath,
  captures,
  viewportWidth,
  viewportHeight,
  timeoutMs,
  chromePath = process.env.BUN_CHROME_PATH,
  createView = (options) => new Bun.WebView(options),
}) {
  if (typeof htmlPath !== "string" || htmlPath.trim() === "") throw new Error("--html is required");
  if (!Array.isArray(captures) || captures.length === 0)
    throw new Error("at least one capture is required");
  if (!Number.isSafeInteger(viewportWidth) || viewportWidth <= 0)
    throw new Error("viewportWidth must be a positive integer");
  if (!Number.isSafeInteger(viewportHeight) || viewportHeight <= 0)
    throw new Error("viewportHeight must be a positive integer");
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0)
    throw new Error("timeoutMs must be a positive integer");

  const absoluteHtmlPath = path.resolve(htmlPath);
  await requireFile(absoluteHtmlPath);
  const canonicalHtmlPath = await realpath(absoluteHtmlPath);
  const normalizedCaptures = captures.map(normalizeCapture);
  const outputPaths = normalizedCaptures.map(({ outputPath }) => outputPath);
  if (new Set(outputPaths).size !== outputPaths.length)
    throw new Error("capture output_path values must be unique");
  for (const outputPath of outputPaths) {
    const parent = await stat(path.dirname(outputPath)).catch(() => undefined);
    if (!parent?.isDirectory())
      throw new Error(`capture output directory must already exist: ${path.dirname(outputPath)}`);
  }

  const nonce = `${process.pid}-${Date.now()}`;
  const pendingCaptures = normalizedCaptures.map((capture) => ({
    capture,
    tempPath: path.join(
      path.dirname(capture.outputPath),
      `.${path.basename(capture.outputPath)}.${nonce}.tmp`,
    ),
  }));

  let view;
  try {
    view = createView({
      width: viewportWidth,
      height: viewportHeight,
      backend: chromePath ? { type: "chrome", path: chromePath } : "chrome",
    });
    const sourceUrl = pathToFileURL(canonicalHtmlPath).href;
    await withTimeout(view.navigate(sourceUrl), timeoutMs, "HTML navigation");

    for (const { capture, tempPath } of pendingCaptures) {
      await view.evaluate(
        `(() => { location.hash = ${JSON.stringify(capture.urlHash)}; return true; })()`,
      );
      await waitForCapture(view, capture, timeoutMs);
      await view.evaluate(`(async () => {
        await document.fonts?.ready;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return true;
      })()`);
      const rect = await waitForCapture(view, capture, timeoutMs);
      const screenshot = await view.cdp("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
        fromSurface: true,
        clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: 1 },
      });
      if (typeof screenshot?.data !== "string" || screenshot.data.length === 0)
        throw new Error(`Bun.WebView returned an empty screenshot: ${capture.selector}`);
      await Bun.write(tempPath, Buffer.from(screenshot.data, "base64"));
    }

    for (const { capture, tempPath } of pendingCaptures) await rename(tempPath, capture.outputPath);
  } finally {
    view?.close();
    await Promise.all(
      pendingCaptures.map(({ tempPath }) => rm(tempPath, { force: true }).catch(() => undefined)),
    );
  }

  return {
    html_path: canonicalHtmlPath,
    output_paths: normalizedCaptures.map(({ outputPath }) => outputPath),
  };
}

function captureSpecs(values) {
  const specs = values.capture ?? [];
  if (specs.length === 0) throw new Error("at least one --capture JSON object is required");
  return specs.map((value, index) => {
    try {
      return JSON.parse(value);
    } catch (error) {
      throw new Error(`--capture[${index}] must be valid JSON: ${error.message}`);
    }
  });
}

function usage() {
  return "Usage: bun scripts/render-html-selector-captures.mjs --html <path> [--chrome-path <path>] --viewport-width <px> --viewport-height <px> --timeout-ms <ms> --capture <json> [--capture <json> ...]\nEach --capture JSON object must contain selector, url_hash, and output_path.";
}

async function main() {
  const { values } = parseArgs({
    options: {
      html: { type: "string" },
      "chrome-path": { type: "string" },
      "viewport-width": { type: "string" },
      "viewport-height": { type: "string" },
      "timeout-ms": { type: "string" },
      capture: { type: "string", multiple: true },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: false,
    strict: true,
  });

  if (values.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const result = await renderHtmlSelectorCaptures({
    htmlPath: values.html,
    captures: captureSpecs(values),
    viewportWidth: positiveInteger(values["viewport-width"], "viewport-width"),
    viewportHeight: positiveInteger(values["viewport-height"], "viewport-height"),
    timeoutMs: positiveInteger(values["timeout-ms"], "timeout-ms"),
    chromePath: values["chrome-path"] ?? process.env.BUN_CHROME_PATH,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.main) {
  main().catch((error) => {
    process.stderr.write(`render-html-selector-captures: ${error.message}\n`);
    process.exitCode = 1;
  });
}
