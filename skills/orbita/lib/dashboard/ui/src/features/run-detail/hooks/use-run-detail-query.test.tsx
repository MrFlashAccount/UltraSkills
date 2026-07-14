import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makeDetail, makeRun } from "@/test/fixtures";
import { useRunDetailQuery } from "./use-run-detail-query";

describe("useRunDetailQuery", () => {
  it("never carries run A identity into a pending run B request", async () => {
    const detailA = makeDetail(makeRun(1));
    const detailB = makeDetail(makeRun(2));
    let resolveB: ((response: Response) => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((request: string | URL | Request) => {
        const url = String(typeof request === "object" && "url" in request ? request.url : request);
        if (url.endsWith("/run-1")) {
          return Promise.resolve(json(detailA));
        }
        return new Promise<Response>((resolve) => {
          resolveB = resolve;
        });
      }),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: Readonly<{ children: React.ReactNode }>) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { rerender, result } = renderHook(({ runId }) => useRunDetailQuery(runId), {
      initialProps: { runId: "run-1" },
      wrapper,
    });
    await waitFor(() => expect(result.current.data?.run.runId).toBe("run-1"));

    rerender({ runId: "run-2" });
    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    resolveB?.(json(detailB));
    await waitFor(() => expect(result.current.data?.run.runId).toBe("run-2"));
  });
});

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}
