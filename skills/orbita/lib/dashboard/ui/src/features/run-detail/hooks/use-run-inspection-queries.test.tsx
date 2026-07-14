import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { describe, expect, it, vi } from "bun:test";
import { stubGlobal } from "@/test/globals";
import { usePagingRecovery } from "./use-paging-recovery";
import {
  useActivityPages,
  useLogPages,
  useTraversalPages,
  useWorkflowStepArtifactPages,
} from "./use-run-inspection-queries";

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function QueryWrapper({ children }: Readonly<{ children: ReactNode }>) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("run inspection query lifecycle", () => {
  it("restarts a stale cursor from page one while retaining last-good traversal", async () => {
    let firstPageRequests = 0;
    let cursorRequests = 0;
    let releaseReplacement: (() => void) | undefined;
    const replacementGate = new Promise<void>((resolve) => {
      releaseReplacement = resolve;
    });
    stubGlobal(
      "fetch",
      vi.fn(async (request: string | URL | Request) => {
        const url = new URL(
          String(typeof request === "object" && "url" in request ? request.url : request),
          "http://dashboard.test",
        );
        if (url.searchParams.has("cursor")) {
          cursorRequests += 1;
          return json(
            { error: { code: "stale_locator", message: "Resource locator is stale" } },
            409,
          );
        }
        firstPageRequests += 1;
        if (firstPageRequests > 1) {
          await replacementGate;
          return json(traversalPage("replacement", true));
        }
        return json(traversalPage("last-good", false));
      }),
    );
    const { result } = renderHook(
      () => {
        const query = useTraversalPages("run-1");
        const paging = usePagingRecovery();
        return {
          loadNext: () => paging.loadNext("traversal", query),
          query,
          recover: () => paging.recover("traversal", query),
          state: paging.state("traversal", query),
        };
      },
      { wrapper: wrapper() },
    );
    await waitFor(() =>
      expect(result.current.query.data?.pages[0]?.items[0]?.stepId).toBe("last-good"),
    );
    await waitFor(() => expect(result.current.query.hasNextPage).toBe(true));

    act(() => result.current.loadNext());
    await waitFor(() => expect(result.current.state).toBe("stale"));
    expect(cursorRequests).toBe(1);
    expect(result.current.query.data?.pages[0]?.items[0]?.stepId).toBe("last-good");

    act(() => result.current.recover());
    await waitFor(() => expect(firstPageRequests).toBe(2));
    expect(result.current.query.data?.pages[0]?.items[0]?.stepId).toBe("last-good");
    releaseReplacement?.();
    await waitFor(() =>
      expect(result.current.query.data?.pages[0]?.items[0]?.stepId).toBe("replacement"),
    );
    expect(result.current.state).toBe("complete");
    expect(firstPageRequests).toBe(2);
  });

  it("uses the selected workflow step as the artifact scope", async () => {
    const urls: Array<string> = [];
    stubGlobal(
      "fetch",
      vi.fn(async (request: string | URL | Request) => {
        const url = String(typeof request === "object" && "url" in request ? request.url : request);
        urls.push(url);
        const parsed = new URL(url, "http://dashboard.test");
        const stepId = parsed.searchParams.get("stepId");
        return json({
          complete: true,
          items: [],
          runAggregateCount: 0,
          runId: "run-1",
          schemaVersion: "2",
          scope: { kind: "workflow_step", stepId },
        });
      }),
    );
    const workflow = renderHook(() => useWorkflowStepArtifactPages("run-1", "architecture"), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(workflow.result.current.isSuccess).toBe(true));
    expect(urls).toEqual(expect.arrayContaining([expect.stringContaining("stepId=architecture")]));
    expect(urls.every((url) => /[?&]stepId=/u.test(url))).toBe(true);
  });

  it("does not request scoped resources without a locator", () => {
    const fetch = vi.fn();
    stubGlobal("fetch", fetch);
    const { result } = renderHook(
      () => ({
        activity: useActivityPages("run-1"),
        logs: useLogPages("run-1"),
        workflowStepArtifacts: useWorkflowStepArtifactPages("run-1"),
      }),
      { wrapper: wrapper() },
    );

    expect(result.current.activity.fetchStatus).toBe("idle");
    expect(result.current.logs.fetchStatus).toBe("idle");
    expect(result.current.workflowStepArtifacts.fetchStatus).toBe("idle");
    expect(fetch).not.toHaveBeenCalled();
  });
});

function traversalPage(stepId: string, complete: boolean) {
  return {
    complete,
    items: [
      {
        peers: [],
        state: "current",
        stepId,
      },
    ],
    ...(complete ? {} : { nextCursor: "stale_cursor_0001" }),
    runId: "run-1",
    schemaVersion: "2",
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}
