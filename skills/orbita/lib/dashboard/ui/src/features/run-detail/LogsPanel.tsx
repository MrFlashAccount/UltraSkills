import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "./MarkdownContent";
import {
  type ManagedLogEntry,
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

type LogsPanelProps = {
  entries: ReadonlyArray<ManagedLogEntry>;
  onLoadOlder?: () => void;
  onRetry?: () => void;
  onRetryPaging?: () => void;
  pagination: PagingState;
  state: StepEvidenceState;
  stepLabel: string;
};

export function LogsPanel(props: LogsPanelProps) {
  const truncated =
    props.pagination !== "complete" || props.entries.some((entry) => entry.truncated);
  return (
    <section aria-labelledby="logs-title" className="step-panel">
      <header className="step-panel-heading">
        <div>
          <h3 id="logs-title">Logs · {props.stepLabel}</h3>
          <p>Bounded managed Markdown</p>
        </div>
        {truncated ? <strong className="panel-truncated">Truncated</strong> : null}
      </header>
      {props.state === "loading" ? (
        <PanelLoading label={`Loading ${props.stepLabel} logs…`} />
      ) : props.state === "missing_selection" || props.state === "traversal_pending" ? (
        <StepEvidenceUnavailable state={props.state} />
      ) : props.state === "error" ? (
        <PanelError message="Selected step logs are unavailable." onRetry={props.onRetry} />
      ) : props.entries.length === 0 ? (
        <PanelEmpty detail="No managed log entries exist for this step." title="No logs" />
      ) : (
        <div className="managed-logs">
          {props.pagination === "error" || props.pagination === "stale" ? (
            <PagingFailure
              onRetry={props.onRetryPaging ?? props.onRetry ?? (() => {})}
              resource="Logs"
              stale={props.pagination === "stale"}
            />
          ) : props.pagination !== "complete" ? (
            <Button
              disabled={props.pagination === "loading"}
              onClick={props.onLoadOlder}
              variant="quiet"
            >
              {props.pagination === "loading" ? "Loading…" : "Load older"}
            </Button>
          ) : (
            <p className="panel-end">Start of logs</p>
          )}
          <ol>
            {props.entries.map((entry) => (
              <li key={entry.id}>
                {entry.timestamp || entry.source || entry.redacted || entry.truncated ? (
                  <header>
                    {entry.timestamp ? <time>{entry.timestamp}</time> : null}
                    {entry.source ? <span>{entry.source}</span> : null}
                    {entry.redacted ? <Badge>Redacted to public facts</Badge> : null}
                    {entry.truncated ? <Badge>Entry truncated</Badge> : null}
                  </header>
                ) : null}
                <MarkdownContent>{entry.markdown}</MarkdownContent>
              </li>
            ))}
          </ol>
          <p className="panel-end">End of loaded logs</p>
        </div>
      )}
    </section>
  );
}
