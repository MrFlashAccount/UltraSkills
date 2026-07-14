import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, isDateTime } from "@/lib/time";
import {
  type ActivityGroupItem,
  type StepEvidenceState,
  type PagingState,
} from "./run-detail-view-model";
import {
  StepEvidenceUnavailable,
  PagingFailure,
  PanelEmpty,
  PanelError,
  PanelLoading,
} from "./states/PanelStates";

type ActivityPanelProps = {
  groups: ReadonlyArray<ActivityGroupItem>;
  onLoadMore?: () => void;
  onRetry?: () => void;
  onRetryPaging?: () => void;
  pagination: PagingState;
  state: StepEvidenceState;
  stepLabel: string;
};

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
        <PanelError message="Selected step activity is unavailable." onRetry={props.onRetry} />
      ) : props.groups.length === 0 ? (
        <PanelEmpty
          detail="No durable activity was recorded for this step."
          title="No step activity"
        />
      ) : (
        <div className="activity-groups">
          {props.groups.map((group) => (
            <section className="activity-group" key={group.id}>
              <header>
                <span aria-hidden="true" className="activity-state-dot" />
                <h4>{group.label}</h4>
                <Badge>{group.state}</Badge>
              </header>
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
                    {group.events.map((event) => (
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
            </section>
          ))}
          {props.pagination === "error" || props.pagination === "stale" ? (
            <PagingFailure
              onRetry={props.onRetryPaging ?? props.onRetry ?? (() => {})}
              resource="Activity"
              stale={props.pagination === "stale"}
            />
          ) : props.pagination !== "complete" ? (
            <Button
              disabled={props.pagination === "loading"}
              onClick={props.onLoadMore}
              variant="quiet"
            >
              {props.pagination === "loading" ? "Loading…" : "Load more"}
            </Button>
          ) : (
            <p className="panel-end">End of activity</p>
          )}
        </div>
      )}
    </section>
  );
}
