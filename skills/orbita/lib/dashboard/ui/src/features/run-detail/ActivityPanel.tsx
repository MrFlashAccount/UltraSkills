import type { TraversalPageDTO } from "@dashboard-contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, isDateTime } from "@/lib/time";
import { useActivityPages } from "./hooks/use-run-inspection-queries";
import { usePagingRecovery } from "./hooks/use-paging-recovery";
import {
  type ActivityGroupDescriptor,
  type ActivityGroupItem,
  type PagingState,
  type StepEvidenceState,
} from "./run-detail-view-model";
import { toActivityGroup } from "./selectors/page-selectors";
import {
  PagingFailure,
  PanelEmpty,
  PanelError,
  PanelLoading,
  StepEvidenceUnavailable,
} from "./states/PanelStates";

type TraversalStep = TraversalPageDTO["items"][number];

type ActivityPanelProps = {
  groups: ReadonlyArray<ActivityGroupDescriptor>;
  runId: string;
  state: StepEvidenceState;
  step: TraversalStep | undefined;
  stepId: string | undefined;
  stepLabel: string;
};

type ActivityGroupViewProps = {
  group: ActivityGroupItem;
  onLoadMore?: () => void;
  onRetryPaging?: () => void;
  pagination: PagingState;
};

export function ActivityGroupView(props: ActivityGroupViewProps) {
  return (
    <section className="activity-group">
      <header>
        <span aria-hidden="true" className="activity-state-dot" />
        <h4>{props.group.label}</h4>
        <Badge>{props.group.state}</Badge>
      </header>
      {props.group.events.length ? (
        <div className="activity-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Source</th>
                <th scope="col">Status</th>
                <th scope="col">Event</th>
              </tr>
            </thead>
            <tbody>
              {props.group.events.map((event) => (
                <tr key={event.id}>
                  <td data-label="Time">
                    {isDateTime(event.time) ? (
                      <time dateTime={event.time} suppressHydrationWarning>
                        {formatDateTime(event.time)}
                      </time>
                    ) : (
                      event.time
                    )}
                  </td>
                  <td data-label="Source" title={event.source}>
                    {event.source}
                  </td>
                  <td data-label="Status">
                    <Badge>{event.state}</Badge>
                  </td>
                  <td data-label="Event">{event.event}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="activity-group-empty">No durable events in this section.</p>
      )}
      {props.pagination === "error" || props.pagination === "stale" ? (
        <PagingFailure
          onRetry={props.onRetryPaging ?? (() => {})}
          resource={props.group.label}
          stale={props.pagination === "stale"}
        />
      ) : props.pagination !== "complete" ? (
        <Button
          className="activity-group-load-more"
          disabled={props.pagination === "loading"}
          onClick={props.onLoadMore}
          variant="quiet"
        >
          {props.pagination === "loading" ? "Loading…" : "Load more"}
        </Button>
      ) : null}
    </section>
  );
}

function ActivityGroupSection(props: {
  descriptor: ActivityGroupDescriptor;
  runId: string;
  step: TraversalStep | undefined;
  stepId: string;
}) {
  const query = useActivityPages(props.runId, props.stepId, props.descriptor.id);
  const paging = usePagingRecovery();
  const key = `activity:${props.stepId}:${props.descriptor.id}`;
  const group = toActivityGroup(props.descriptor, query.data?.pages, props.step);

  if (query.isPending) {
    return <PanelLoading label={`Loading ${props.descriptor.label}…`} />;
  }
  if (query.isError && group.events.length === 0) {
    return (
      <PanelError
        message={`${props.descriptor.label} activity is unavailable.`}
        onRetry={() => paging.refetch(key, query)}
      />
    );
  }
  return (
    <ActivityGroupView
      group={group}
      onLoadMore={() => paging.loadNext(key, query)}
      onRetryPaging={() => paging.recover(key, query)}
      pagination={paging.state(key, query)}
    />
  );
}

export function ActivityPanel(props: ActivityPanelProps) {
  return (
    <section aria-labelledby="activity-title" className="step-panel">
      <header className="step-panel-heading">
        <div>
          <h3 id="activity-title">Activity · {props.stepLabel}</h3>
          <p>Selected-step lifecycle and nested work</p>
        </div>
      </header>
      {props.state === "loading" ? (
        <PanelLoading label={`Loading ${props.stepLabel} activity…`} />
      ) : props.state === "missing_selection" || props.state === "traversal_pending" ? (
        <StepEvidenceUnavailable state={props.state} />
      ) : props.state === "error" ? (
        <PanelError message="Selected step activity is unavailable." />
      ) : !props.stepId || props.groups.length === 0 ? (
        <PanelEmpty
          detail="No durable activity was recorded for this step."
          title="No step activity"
        />
      ) : (
        <div className="activity-groups">
          {props.groups.map((group) => (
            <ActivityGroupSection
              descriptor={group}
              key={group.id}
              runId={props.runId}
              step={props.step}
              stepId={props.stepId!}
            />
          ))}
        </div>
      )}
    </section>
  );
}
