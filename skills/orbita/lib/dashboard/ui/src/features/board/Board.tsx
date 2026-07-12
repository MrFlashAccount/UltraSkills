import {
  DASHBOARD_LANE_ORDER,
  type DashboardLaneId,
  type RunSummaryDTO,
} from "@dashboard-contracts";
import { AttentionSummary } from "./AttentionSummary";
import type { RovingRunFocus } from "./hooks/use-roving-run-focus";
import { Lane } from "./Lane";

type BoardProps = {
  counts: Record<DashboardLaneId, number>;
  lanes: Record<DashboardLaneId, Array<RunSummaryDTO>>;
  onSelect: (runId: string, origin: HTMLButtonElement) => void;
  roving: RovingRunFocus;
  selectedId?: string | undefined;
};

export function Board({ counts, lanes, onSelect, roving, selectedId }: BoardProps) {
  return (
    <>
      <AttentionSummary counts={counts} />
      <section aria-label="Runs by attention state" className="board">
        {DASHBOARD_LANE_ORDER.map((lane) => (
          <Lane
            key={lane}
            lane={lane}
            onSelect={onSelect}
            roving={roving}
            runs={lanes[lane]}
            selectedId={selectedId}
          />
        ))}
      </section>
    </>
  );
}
