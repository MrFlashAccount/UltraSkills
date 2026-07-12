import { DASHBOARD_LANE_ORDER, type DashboardLaneId, type RunSummaryDTO } from '@dashboard-contracts';
import { AttentionSummary } from './AttentionSummary';
import type { RovingRunFocus } from './hooks/use-roving-run-focus';
import { Lane } from './Lane';

type BoardProps = {
  lanes: Record<DashboardLaneId, RunSummaryDTO[]>;
  counts: Record<DashboardLaneId, number>;
  selectedId?: string;
  onSelect: (runId: string, origin: HTMLButtonElement) => void;
  roving: RovingRunFocus;
};

export function Board({ lanes, counts, selectedId, onSelect, roving }: BoardProps) {
  return <><AttentionSummary counts={counts} /><section className="board" aria-label="Runs by attention state">
    {DASHBOARD_LANE_ORDER.map((lane) => <Lane key={lane} lane={lane} runs={lanes[lane]} selectedId={selectedId} onSelect={onSelect} roving={roving} />)}
  </section></>;
}
