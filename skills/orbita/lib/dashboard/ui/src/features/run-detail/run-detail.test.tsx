import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeActivityPage, makeDetail, makeOutputs } from "@/test/fixtures";
import { AppProviders } from "@/app/AppProviders";
import { RunDetailSurface } from "./RunDetailSurface";

const renderDetail = (component: React.ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AppProviders>{component}</AppProviders>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/activity")) {
        return Response.json(makeActivityPage());
      }
      if (url.includes("/outputs")) {
        return Response.json(makeOutputs());
      }
      if (url.includes("/artifacts/")) {
        return new Response("# UI design\n\nReady for implementation.", {
          headers: { "content-type": "text/markdown" },
        });
      }
      return new Response(null, { status: 404 });
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("RunDetailSurface", () => {
  it("renders bounded detail facts and restores through explicit close", async () => {
    const close = vi.fn();
    renderDetail(
      <RunDetailSurface
        detail={makeDetail()}
        isError={false}
        isLoading={false}
        onClose={close}
        onReturnFocus={() => {}}
        selectedId="run-1"
        visibleInResults
      />,
    );
    expect(screen.getByRole("dialog", { name: "Run 1 needs attention" })).toHaveTextContent(
      "A bounded public summary",
    );
    expect(screen.getByRole("tab", { name: "Graph" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Activity" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Artifacts" })).toBeVisible();
    expect(vi.mocked(fetch)).not.toHaveBeenCalledWith(
      expect.stringContaining("/activity"),
      expect.anything(),
    );
    expect(vi.mocked(fetch)).not.toHaveBeenCalledWith(
      expect.stringContaining("/outputs"),
      expect.anything(),
    );
    expect(screen.getByRole("tab", { name: "Metadata" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Current run path" })).toBeVisible();
    expect(screen.queryByText("Current path")).not.toBeInTheDocument();
    const pathButtons = within(
      screen.getByRole("region", { name: "Current run path" }),
    ).getAllByRole("button");
    expect(pathButtons.at(-1)).toHaveAccessibleName("Filter by implementation, Fanout, Current");
    expect(await screen.findByRole("region", { name: "Workflow graph" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Clear selection" })).not.toBeInTheDocument();
    expect(screen.getByText("Step details")).toBeVisible();
    expect(screen.getByLabelText("implementation, Fanout, Current")).toBeInTheDocument();
    expect(screen.getByLabelText("done, Done, Terminal")).toBeInTheDocument();
    expect(screen.queryByLabelText("done, Done, Pending")).not.toBeInTheDocument();
    expect(screen.getByText("3 branches · max 2 parallel")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Filter by research, Worker, Completed"));
    expect(screen.getByLabelText("Filter by research, Worker, Completed")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Activity" }), { button: 0 });
    expect(await screen.findByRole("tab", { name: "Activity 1" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(await screen.findByText("Awaiting approval")).toBeVisible();
    expect(screen.queryByText("2026-07-12T12:00:00.000Z")).not.toBeInTheDocument();
    expect(screen.getByText("source")).toBeVisible();
    expect(screen.getByText("workflow-runner")).toBeVisible();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Artifacts" }), { button: 0 });
    expect(await screen.findByText("ui-design-proposal")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /ui-design-proposal/i }));
    expect(await screen.findByRole("dialog", { name: "ui-design-proposal" })).toBeVisible();
    expect(await screen.findByRole("heading", { name: "UI design" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close artifact" }));
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Metadata" }), { button: 0 });
    expect(
      within(screen.getByRole("tabpanel", { name: "Metadata" })).getByText("run-1"),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Copy run id" })).toHaveClass(
      "ui-button-ghost",
      "ui-button-icon",
    );
    expect(screen.getByRole("button", { name: "Close details" })).toHaveClass("ui-button-ghost");
    fireEvent.click(screen.getByRole("button", { name: "Close details" }));
    expect(close).toHaveBeenCalledOnce();
  });

  it("omits the filter when workflow topology is unavailable", async () => {
    renderDetail(
      <RunDetailSurface
        detail={{ ...makeDetail(), miniMap: { state: "unavailable" } }}
        isError={false}
        isLoading={false}
        onClose={() => {}}
        onReturnFocus={() => {}}
        selectedId="run-1"
        visibleInResults
      />,
    );
    expect(screen.queryByRole("region", { name: "Current run path" })).not.toBeInTheDocument();
  });

  it("preserves a missing selection instead of selecting a neighbor", () => {
    renderDetail(
      <RunDetailSurface
        isError={false}
        isLoading={false}
        onClose={() => {}}
        onReturnFocus={() => {}}
        selectedId="run-1"
        visibleInResults={false}
      />,
    );
    expect(screen.getByText("This run is no longer in the current results")).toBeVisible();
  });
});
