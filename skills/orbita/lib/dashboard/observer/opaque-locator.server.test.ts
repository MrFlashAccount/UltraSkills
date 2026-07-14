import { describe, expect, test } from "bun:test";
import { OpaqueLocatorCodec } from "./opaque-locator.server";

describe("opaque dashboard locators", () => {
  test("keeps refs confidential and revalidates their kind and run", () => {
    const codec = new OpaqueLocatorCodec(Buffer.alloc(32, 7));
    const ref = codec.ref("occurrence", { runId: "run-a", stepId: "secret-step", ordinal: 4 });
    expect(ref).not.toContain("secret-step");
    expect(codec.resolveRef(ref, { kind: "occurrence", runId: "run-a" })).toEqual({
      runId: "run-a",
      stepId: "secret-step",
      ordinal: 4,
    });
    expect(() => codec.resolveRef(ref, { kind: "artifact", runId: "run-a" })).toThrow(
      "stale_locator",
    );
    expect(() => codec.resolveRef(ref, { kind: "occurrence", runId: "run-b" })).toThrow(
      "stale_locator",
    );
  });

  test("survives codec restart without registry eviction semantics", () => {
    const secret = Buffer.alloc(32, 11);
    const first = new OpaqueLocatorCodec(secret);
    const ref = first.ref("occurrence", { runId: "run-a", stepId: "planning", ordinal: 1 });
    const cursor = first.cursor({
      identity: "snapshot-a",
      offset: 64,
      resource: "logs",
      runId: "run-a",
      scope: ref,
    });

    for (let index = 0; index < 5000; index += 1) {
      first.ref("occurrence", { runId: "run-a", stepId: "planning", ordinal: index + 2 });
    }

    const restarted = new OpaqueLocatorCodec(secret);
    expect(restarted.resolveRef(ref, { kind: "occurrence", runId: "run-a" })).toEqual({
      runId: "run-a",
      stepId: "planning",
      ordinal: 1,
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

  test("binds cursors to run, route resource, and occurrence scope", () => {
    const codec = new OpaqueLocatorCodec(Buffer.alloc(32, 9));
    const cursor = codec.cursor({
      identity: "file-snapshot",
      offset: 1024,
      resource: "logs",
      runId: "run-a",
      scope: "occurrence-a",
    });
    expect(cursor).not.toMatch(/file-snapshot|run-a|logs|occurrence-a/u);
    expect(
      codec.parseCursor(cursor, {
        resource: "logs",
        runId: "run-a",
        scope: "occurrence-a",
      }).offset,
    ).toBe(1024);
    expect(() =>
      codec.parseCursor(cursor, {
        resource: "activity",
        runId: "run-a",
        scope: "occurrence-a",
      }),
    ).toThrow("stale_locator");
    expect(() =>
      codec.parseCursor(cursor, {
        resource: "logs",
        runId: "run-a",
        scope: "occurrence-b",
      }),
    ).toThrow("stale_locator");
  });
});
