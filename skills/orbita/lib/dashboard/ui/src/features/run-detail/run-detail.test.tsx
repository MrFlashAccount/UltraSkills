import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makeDetail } from "@/test/fixtures";
import { AppProviders } from "@/app/AppProviders";
import { RunDetailSurface } from "./RunDetailSurface";

const renderDetail = (component: React.ReactNode) =>
  render(<AppProviders>{component}</AppProviders>);

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
    expect(screen.getByRole("tab", { name: "Activity 1" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Artifacts 1" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Metadata" })).toBeVisible();
    expect(await screen.findByRole("region", { name: "Workflow graph" })).toBeVisible();
    expect(screen.getByLabelText("implementation, Fanout, Current")).toBeInTheDocument();
    expect(screen.getByText("3 branches · max 2 parallel")).toBeInTheDocument();
    const stepDetails = screen.getByText("Step details").closest("section");
    expect(stepDetails).not.toBeNull();
    expect(within(stepDetails!).getByRole("heading", { name: "implementation" })).toBeVisible();
    fireEvent.click(screen.getByLabelText("research, Worker, Completed"));
    expect(within(stepDetails!).getByRole("heading", { name: "research" })).toBeVisible();
    expect(
      within(stepDetails!).getByRole("list", { name: "Artifacts produced by research" }),
    ).toHaveTextContent("ui-design-proposal");
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Activity 1" }), { button: 0 });
    expect(screen.getByText("Awaiting approval")).toBeVisible();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Artifacts 1" }), { button: 0 });
    expect(screen.getByText("ui-design-proposal")).toBeVisible();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Metadata" }), { button: 0 });
    expect(
      within(screen.getByRole("tabpanel", { name: "Metadata" })).getByText("run-1"),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Copy run id" })).toHaveClass(
      "ui-button-ghost",
      "ui-button-icon",
    );
    fireEvent.click(screen.getByRole("button", { name: "Close details" }));
    expect(close).toHaveBeenCalledOnce();
  });

  it("renders unavailable workflow state without an empty graph", async () => {
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
    expect(await screen.findByText("Workflow visualization is unavailable.")).toBeVisible();
    expect(screen.queryByRole("region", { name: "Workflow graph" })).not.toBeInTheDocument();
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
