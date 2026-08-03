import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "bun:test";
import { fileURLToPath } from "node:url";
import { readWorkflowDocument } from "../persistence/workflow-resources/workflow-document-reader.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const workflow = readWorkflowDocument(path.join(REPO_ROOT, "workflows/spdd/workflow.toml"));
const schema = JSON.parse(
  readFileSync(
    path.join(REPO_ROOT, "workflows/spdd/schemas/ui-intent-draft-output.json"),
    "utf8",
  ),
);
const template = readFileSync(
  path.join(REPO_ROOT, "workflows/spdd/templates/ui-design-proposal-html-template.html"),
  "utf8",
);

const viewIds = [
  "requirements",
  "entities",
  "approach",
  "structure",
  "operations",
  "norms",
  "safeguards",
];
const captureSpecs = viewIds.map((viewId) => ({
  selector: `[data-ui-proposal-capture="${viewId}"]`,
  url_hash: viewId,
  output_path: `<artifact-output-directory>/ui-design-proposal-${viewId}.png`,
}));

function promptText(step) {
  const prompt = step.input?.prompt ?? "";
  return Array.isArray(prompt) ? prompt.join("\n") : prompt;
}

test("spdd derives stable PNG references from the final HTML proposal", () => {
  const draftPrompt = promptText(workflow.steps.ui_intent_draft);
  const attackPrompt = promptText(workflow.steps.ui_intent_attack);
  const implementationPrompt = promptText(
    workflow.steps.implementation.branches.frontend_implementation,
  );
  const reviewPrompt = promptText(workflow.steps.review.branches.frontend_taste_review);

  assert.match(
    draftPrompt,
    /derive the seven required PNG reference captures from that final HTML/,
  );
  assert.match(draftPrompt, /render-html-selector-captures\.mjs/);
  assert.match(
    draftPrompt,
    /does not import Playwright or Orbita `lib`, read the workflow document/,
  );
  assert.match(draftPrompt, /--html <absolute-ui-design-proposal-path>/);
  assert.match(draftPrompt, /--chrome-path <absolute-chrome-or-chromium-executable-path>/);
  for (const capture of captureSpecs) {
    assert.match(
      draftPrompt,
      new RegExp(
        `--capture \\{[^}]*"selector":"[^}]*"url_hash":"${capture.url_hash}"[^}]*"output_path":"${capture.output_path}"`,
      ),
    );
  }
  assert.match(draftPrompt, /writes each PNG to the exact path you supplied/);
  assert.match(draftPrompt, /call the validating write-output command/);
  assert.match(draftPrompt, /do not operate the browser or create screenshots manually/);
  assert.match(attackPrompt, /inspect every PNG visually/);
  assert.match(implementationPrompt, /PNG captures as the portable visual references/);
  assert.match(reviewPrompt, /compare rendered implementation proof against those references/);
});

test("ui proposal output requires one HTML source and seven PNG captures", () => {
  assert.equal(schema.properties.artifacts.minItems, 8);
  assert.equal(schema.properties.artifacts.maxItems, 8);

  const artifactContracts = schema.properties.artifacts.prefixItems.map((contract) => ({
    id: contract.properties.id.const,
    contentType: contract.properties.content_type.const,
  }));

  assert.deepEqual(artifactContracts, [
    { id: "ui-design-proposal", contentType: "text/html" },
    ...viewIds.map((viewId) => ({
      id: `ui-design-proposal-${viewId}`,
      contentType: "image/png",
    })),
  ]);
  assert.equal(schema.properties.artifacts.items, false);
});

test("ui proposal template exposes deterministic hash capture hooks", () => {
  for (const viewId of viewIds) {
    assert.match(
      template,
      new RegExp(
        `<section class="view(?: active)?" id="${viewId}" data-ui-proposal-capture="${viewId}">`,
      ),
    );
  }

  assert.match(template, /activateProposalView\(location\.hash\.slice\(1\)\)/);
  assert.match(template, /document\.documentElement\.dataset\.uiProposalView = viewName/);
  assert.match(template, /document\.documentElement\.dataset\.uiProposalReady = 'true'/);
});
