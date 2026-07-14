import { describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bindDashboardLifecycle, createDashboardComposition } from "./dashboard-composition.server";

describe("dashboard production lifecycle binding", () => {
  test("Nitro close clears watcher, timers, subscriptions, and active plus queued refresh", async () => {
    const runsRoot = await mkdtemp(join(tmpdir(), "orbita-dashboard-lifecycle-"));
    let calls = 0;
    let aborted = false;
    const reader = {
      getRunLight: async () => undefined,
      listRuns: async (signal?: AbortSignal) => {
        calls++;
        await new Promise<void>((_resolve, reject) =>
          signal?.addEventListener(
            "abort",
            () => {
              aborted = true;
              reject(signal.reason);
            },
            { once: true },
          ),
        );
        return [];
      },
    };
    const composition = createDashboardComposition(
      {
        coalesceMs: 100,
        heartbeatMs: 60_000,
        host: "127.0.0.1",
        pollMs: 60_000,
        port: 3000,
        runsRoot,
        staleMs: 60_000,
      },
      reader,
    );
    const model = composition.readModel;
    model.subscribe(() => {});
    void model.refresh();
    model.refresh();

    const processLifecycle = new EventEmitter();
    let closeHook!: () => Promise<void>;
    const nitroHooks = {
      hook: (_name: "close", callback: () => Promise<void>) => {
        closeHook = callback;
        return () => {};
      },
    };
    const unbind = bindDashboardLifecycle(
      processLifecycle as any,
      nitroHooks,
      () => {},
      () => composition.close(),
    );
    await closeHook();

    expect(aborted).toBe(true);
    expect(calls).toBe(1);
    expect((model as any).watcher).toBeUndefined();
    expect((model as any).timer).toBeUndefined();
    expect((model as any).staleDeadlineTimer).toBeUndefined();
    expect((model as any).invalidationTimer).toBeUndefined();
    expect((model as any).subscribers.size).toBe(0);
    unbind();
    await rm(runsRoot, { force: true, recursive: true });
  });

  test("binds Bun termination signals as lifecycle stops", () => {
    const processLifecycle = new EventEmitter();
    const unbind = bindDashboardLifecycle(
      processLifecycle as any,
      undefined,
      () => {},
      async () => {},
    );
    expect(processLifecycle.listenerCount("SIGINT")).toBe(1);
    expect(processLifecycle.listenerCount("SIGTERM")).toBe(1);
    expect(processLifecycle.listenerCount("beforeExit")).toBe(1);
    unbind();
    expect(processLifecycle.listenerCount("SIGINT")).toBe(0);
    expect(processLifecycle.listenerCount("SIGTERM")).toBe(0);
  });
});
