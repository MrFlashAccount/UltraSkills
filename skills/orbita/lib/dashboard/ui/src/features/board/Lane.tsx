import type { DashboardLaneId, RunSummaryDTO } from '@dashboard-contracts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { memo, useId } from 'react';
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { RovingRunFocus } from './hooks/use-roving-run-focus';
import { LANE_LABELS } from './selectors/board-selectors';
import { VirtualLane } from './VirtualLane';
import { useMediaQuery } from '@/features/run-detail/use-media-query';
import { useLaneDisclosure } from './hooks/use-lane-disclosure';

type LaneProps = {
  lane: DashboardLaneId;
  runs: readonly RunSummaryDTO[];
  selectedId?: string;
  onSelect: (runId: string, origin: HTMLButtonElement) => void;
  roving: RovingRunFocus;
};

export const Lane = memo(function Lane({ lane, runs, selectedId, onSelect, roving }: LaneProps) {
  const attention = lane === 'waiting_for_user' || lane === 'needs_help' || lane === 'degraded';
  const headingId = useId();
  const listId = useId();
  const desktop = useMediaQuery('(min-width: 760px)');
  const disclosure = useLaneDisclosure(attention, runs.length, desktop);
  return (
    <CollapsibleRoot
      open={disclosure.expanded}
      onOpenChange={disclosure.setExpanded}
      className="lane"
      data-lane={lane}
      role="region"
      aria-labelledby={headingId}
    >
      <header className="lane-header">
        <h2
          ref={(element) => roving.registerLaneHeader(lane, element)}
          tabIndex={-1}
          id={headingId}
          className="lane-title"
        >
          {LANE_LABELS[lane]}
        </h2>
        <span className="lane-count" aria-label={`${runs.length} runs`}>
          {runs.length}
        </span>
        <CollapsibleTrigger
          className="lane-toggle"
          aria-label={`${disclosure.expanded ? 'Collapse' : 'Expand'} ${LANE_LABELS[lane]}`}
          aria-controls={listId}
        >
          {disclosure.expanded ? (
            <ChevronUp aria-hidden="true" size={17} />
          ) : (
            <ChevronDown aria-hidden="true" size={17} />
          )}
        </CollapsibleTrigger>
      </header>
      <CollapsibleContent id={listId} className="lane-body">
        <VirtualLane
          laneLabel={LANE_LABELS[lane]}
          runs={runs}
          selectedId={selectedId}
          onSelect={onSelect}
          roving={roving}
        />
      </CollapsibleContent>
    </CollapsibleRoot>
  );
});
