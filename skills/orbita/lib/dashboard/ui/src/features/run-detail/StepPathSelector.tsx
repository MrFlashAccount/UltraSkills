import { ChevronLeft, ChevronRight, CircleCheck, Layers3 } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { TooltipLabel } from "@/components/ui/tooltip";
import { type PagingState, type StepPathItem } from "./run-detail-view-model";
import { PagingFailure } from "./states/PanelStates";

type StepPathSelectorProps = {
  onRetryPaging: () => void;
  onSelect: (stepId: string) => void;
  onShowEarlier: () => void;
  pagination: PagingState;
  selectedStepId?: string | undefined;
  steps: ReadonlyArray<StepPathItem>;
};

/** Unique current workflow path. Occurrence identity remains an internal evidence locator. */
export function StepPathSelector({
  onRetryPaging,
  onSelect,
  onShowEarlier,
  pagination,
  selectedStepId,
  steps,
}: StepPathSelectorProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const selectedIndex = steps.findIndex((step) => step.stepId === selectedStepId);
  const focusAt = (index: number) => {
    const controls = listRef.current?.querySelectorAll<HTMLButtonElement>("button[data-step]");
    controls?.item(Math.max(0, Math.min(index, controls.length - 1))).focus();
  };

  useEffect(() => {
    if (selectedIndex < 0) {
      return;
    }
    listRef.current
      ?.querySelectorAll<HTMLButtonElement>("button[data-step]")
      .item(selectedIndex)
      .scrollIntoView?.({ behavior: "auto", block: "nearest", inline: "nearest" });
  }, [selectedIndex]);

  return (
    <section aria-label="Current workflow path" className="occurrence-selector">
      <div className="occurrence-scroll">
        {pagination === "more" || pagination === "loading" ? (
          <Button
            className="occurrence-earlier"
            disabled={pagination === "loading"}
            onClick={onShowEarlier}
            variant="quiet"
          >
            <ChevronLeft aria-hidden="true" size={15} />
            {pagination === "loading" ? "Loading…" : "Show earlier steps"}
          </Button>
        ) : null}
        <ul ref={listRef}>
          {steps.map((step, index) => {
            const selected = step.stepId === selectedStepId;
            const StatusIcon = step.state === "current" ? Layers3 : CircleCheck;
            const status = step.state === "current" ? "Current" : "Completed";
            return (
              <li key={step.stepId}>
                <TooltipLabel label={`${step.stepId} — ${status}`}>
                  <button
                    aria-current={step.state === "current" ? "step" : undefined}
                    aria-pressed={selected}
                    className="occurrence-item"
                    data-selected={selected}
                    data-state={step.state}
                    data-step=""
                    onClick={() => onSelect(step.stepId)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowLeft") {
                        event.preventDefault();
                        focusAt(index - 1);
                      } else if (event.key === "ArrowRight") {
                        event.preventDefault();
                        focusAt(index + 1);
                      } else if (event.key === "Home") {
                        event.preventDefault();
                        focusAt(0);
                      } else if (event.key === "End") {
                        event.preventDefault();
                        focusAt(steps.length - 1);
                      }
                    }}
                    type="button"
                  >
                    <StatusIcon aria-hidden="true" size={18} />
                    <span className="occurrence-copy">
                      <strong>{step.stepId}</strong>
                      <span>{status}</span>
                    </span>
                    <ChevronRight aria-hidden="true" className="occurrence-edge" size={14} />
                  </button>
                </TooltipLabel>
              </li>
            );
          })}
        </ul>
      </div>
      {pagination === "error" || pagination === "stale" ? (
        <PagingFailure
          onRetry={onRetryPaging}
          resource="Workflow path"
          stale={pagination === "stale"}
        />
      ) : null}
    </section>
  );
}
