import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error Durable persistence is implemented in legacy MJS.
import { parseWorkflowDocument } from "../../../../persistence/workflow-resources/workflow-document-reader.mjs";

afterEach(() => vi.unstubAllGlobals());

describe("workflow document reader", () => {
  it("parses TOML when the Bun parser is unavailable", () => {
    vi.stubGlobal("Bun", undefined);

    expect(
      parseWorkflowDocument(
        ['name = "portable"', "", "[steps.done]", 'kind = "done"'].join("\n"),
        "workflow.toml",
      ),
    ).toEqual({
      name: "portable",
      steps: { done: { kind: "done" } },
    });
  });
});
