import { describe, expect, test } from "bun:test";
import { OpaqueLocatorCodec } from "./opaque-locator.server";

describe("opaque dashboard locators", () => {
  test("keeps refs confidential and revalidates their kind and run", () => {
    const codec = new OpaqueLocatorCodec(Buffer.alloc(32, 7));
    const ref = codec.ref("step", { runId: "run-a", stepId: "secret-step" });
    expect(ref).not.toContain("secret-step");
    expect(codec.resolveRef(ref, { kind: "step", runId: "run-a" })).toEqual({
      runId: "run-a",
      stepId: "secret-step",
    });
    expect(() => codec.resolveRef(ref, { kind: "artifact", runId: "run-a" })).toThrow(
      "stale_locator",
    );
    expect(() => codec.resolveRef(ref, { kind: "step", runId: "run-b" })).toThrow("stale_locator");
  });

  test("survives codec restart without registry eviction semantics", () => {
    const secret = Buffer.alloc(32, 11);
    const first = new OpaqueLocatorCodec(secret);
    const ref = first.ref("step", { runId: "run-a", stepId: "planning" });
    const cursor = first.cursor({
      identity: "snapshot-a",
      offset: 64,
      resource: "logs",
      runId: "run-a",
      scope: ref,
    });

    for (let index = 0; index < 5000; index += 1) {
      first.ref("step", { runId: "run-a", stepId: `planning-${index}` });
    }

    const restarted = new OpaqueLocatorCodec(secret);
    expect(restarted.resolveRef(ref, { kind: "step", runId: "run-a" })).toEqual({
      runId: "run-a",
      stepId: "planning",
    });
    expect(restarted.parseCursor(cursor, { resource: "logs", runId: "run-a", scope: ref })).toEqual(
      {
        identity: "snapshot-a",
        offset: 64,
        resource: "logs",
        runId: "run-a",
        scope: ref,
      },
    );
  });

  test("binds cursors to run, route resource, and step scope", () => {
    const codec = new OpaqueLocatorCodec(Buffer.alloc(32, 9));
    const cursor = codec.cursor({
      identity: "file-snapshot",
      offset: 1024,
      resource: "logs",
      runId: "run-a",
      scope: "step-a",
    });
    expect(cursor).not.toMatch(/file-snapshot|run-a|logs|step-a/u);
    expect(
      codec.parseCursor(cursor, {
        resource: "logs",
        runId: "run-a",
        scope: "step-a",
      }).offset,
    ).toBe(1024);
    expect(() =>
      codec.parseCursor(cursor, {
        resource: "activity",
        runId: "run-a",
        scope: "step-a",
      }),
    ).toThrow("stale_locator");
    expect(() =>
      codec.parseCursor(cursor, {
        resource: "logs",
        runId: "run-a",
        scope: "step-b",
      }),
    ).toThrow("stale_locator");
  });
});
