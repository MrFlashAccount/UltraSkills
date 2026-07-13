import type { DashboardLaneId, RunSummaryDTO } from "@dashboard-contracts";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useId } from "react";
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { RovingRunFocus } from "./hooks/use-roving-run-focus";
import { LANE_LABELS } from "./selectors/board-selectors";
import { VirtualLane } from "./VirtualLane";
import { useMediaQuery } from "@/features/run-detail/use-media-query";
import { useLaneDisclosure } from "./hooks/use-lane-disclosure";

type LaneProps = {
  lane: DashboardLaneId;
  onSelect: (runId: string, origin: HTMLButtonElement) => void;
  roving: RovingRunFocus;
  runs: ReadonlyArray<RunSummaryDTO>;
  selectedId?: string | undefined;
};

export function Lane({ lane, onSelect, roving, runs, selectedId }: LaneProps) {
  const attention = lane === "waiting_for_user" || lane === "needs_help" || lane === "degraded";
  const headingId = useId();
  const listId = useId();
  const desktop = useMediaQuery("(min-width: 640px)");
  const disclosure = useLaneDisclosure(attention, runs.length, desktop);
  return (
    <CollapsibleRoot
      aria-labelledby={headingId}
      className="lane"
      data-lane={lane}
      onOpenChange={disclosure.setExpanded}
      open={disclosure.expanded}
      role="region"
    >
      <header className="lane-header">
        <h2
          className="lane-title"
          id={headingId}
          ref={(element) => roving.registerLaneHeader(lane, element)}
          tabIndex={-1}
        >
          {LANE_LABELS[lane]}
        </h2>
        <span aria-label={`${runs.length} runs`} className="lane-count">
          {runs.length}
        </span>
        <CollapsibleTrigger
          aria-controls={listId}
          aria-label={`${disclosure.expanded ? "Collapse" : "Expand"} ${LANE_LABELS[lane]}`}
          className="lane-toggle"
        >
          {disclosure.expanded ? (
            <ChevronUp aria-hidden="true" size={17} />
          ) : (
            <ChevronDown aria-hidden="true" size={17} />
          )}
        </CollapsibleTrigger>
      </header>
      <CollapsibleContent className="lane-body" id={listId}>
        <VirtualLane
          laneLabel={LANE_LABELS[lane]}
          onSelect={onSelect}
          roving={roving}
          runs={runs}
          selectedId={selectedId}
        />
      </CollapsibleContent>
    </CollapsibleRoot>
  );
}
