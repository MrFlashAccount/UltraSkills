import { ChevronLeft, ChevronRight, CircleAlert, CircleCheck, Layers3 } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { TooltipLabel } from "@/components/ui/tooltip";
import {
  occurrenceLabel,
  type OccurrenceItem,
  type OccurrenceStatus,
  type PagingState,
} from "./run-detail-view-model";
import { PagingFailure } from "./states/PanelStates";

const STATUS_LABELS: Record<OccurrenceStatus, string> = {
  completed: "Completed",
  current: "Current",
  failed: "Failed",
  pending: "Pending",
  unavailable: "Unavailable",
};

type OccurrenceSelectorProps = {
  occurrences: ReadonlyArray<OccurrenceItem>;
  onRetryPaging: () => void;
  onSelect: (occurrenceRef: string) => void;
  onShowEarlier: () => void;
  pagination: PagingState;
  selectedRef?: string | undefined;
};

/** Ordered owner-occurrence selector; it never receives or mutates Workflow state. */
export function OccurrenceSelector({
  occurrences,
  onRetryPaging,
  onSelect,
  onShowEarlier,
  pagination,
  selectedRef,
}: OccurrenceSelectorProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const selectedIndex = occurrences.findIndex(
    (occurrence) => occurrence.occurrenceRef === selectedRef,
  );
  const focusAt = (index: number) => {
    const controls =
      listRef.current?.querySelectorAll<HTMLButtonElement>("button[data-occurrence]");
    controls?.item(Math.max(0, Math.min(index, controls.length - 1))).focus();
  };

  useEffect(() => {
    if (selectedIndex < 0) {
      return;
    }
    listRef.current
      ?.querySelectorAll<HTMLButtonElement>("button[data-occurrence]")
      .item(selectedIndex)
      .scrollIntoView?.({ behavior: "auto", block: "nearest", inline: "nearest" });
  }, [selectedIndex]);

  return (
    <section aria-label="Step occurrences" className="occurrence-selector">
      <div className="occurrence-scroll">
        {pagination === "more" || pagination === "loading" ? (
          <Button
            className="occurrence-earlier"
            disabled={pagination === "loading"}
            onClick={onShowEarlier}
            variant="quiet"
          >
            <ChevronLeft aria-hidden="true" size={15} />
            {pagination === "loading" ? "Loading…" : "Show earlier"}
          </Button>
        ) : null}
        <ul ref={listRef}>
          {occurrences.map((occurrence, index) => {
            const label = occurrenceLabel(occurrence);
            const selected = occurrence.occurrenceRef === selectedRef;
            const StatusIcon =
              occurrence.state === "completed"
                ? CircleCheck
                : occurrence.state === "failed"
                  ? CircleAlert
                  : Layers3;
            return (
              <li key={occurrence.occurrenceRef}>
                <TooltipLabel label={`${label} — ${STATUS_LABELS[occurrence.state]}`}>
                  <button
                    aria-current={occurrence.state === "current" ? "step" : undefined}
                    aria-pressed={selected}
                    className="occurrence-item"
                    data-occurrence=""
                    data-selected={selected}
                    data-state={occurrence.state}
                    onClick={() => onSelect(occurrence.occurrenceRef)}
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
                        focusAt(occurrences.length - 1);
                      }
                    }}
                    type="button"
                  >
                    <StatusIcon aria-hidden="true" size={18} />
                    <span className="occurrence-copy">
                      <strong>{label}</strong>
                      <span>{STATUS_LABELS[occurrence.state]}</span>
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
          resource="Occurrences"
          stale={pagination === "stale"}
        />
      ) : null}
    </section>
  );
}
