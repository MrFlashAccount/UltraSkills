import type { RunSummaryDTO } from "@dashboard-contracts";
import { CircleAlert, CircleCheck, Clock3, LoaderCircle } from "lucide-react";
import { formatAge, shortRunId } from "@/lib/time";
import type { RovingRunFocus } from "./hooks/use-roving-run-focus";

const laneIcon = {
  degraded: CircleAlert,
  done: CircleCheck,
  needs_help: CircleAlert,
  waiting_for_user: Clock3,
  worker_running: LoaderCircle,
};

type RunCardProps = {
  ensureVisible: () => void;
  onSelect: (runId: string, origin: HTMLButtonElement) => void;
  roving: RovingRunFocus;
  run: RunSummaryDTO;
  selected: boolean;
};

export function RunCard({ ensureVisible, onSelect, roving, run, selected }: RunCardProps) {
  const Icon = laneIcon[run.laneId];
  const unsupported = run.cursor.kind === "unsupported";
  return (
    <button
      aria-label={`${run.title.value}, ${run.reason?.value ?? run.status ?? run.laneId}`}
      aria-pressed={selected}
      className="run-card"
      data-lane={run.laneId}
      data-run-id={run.runId}
      data-selected={selected || undefined}
      onClick={(event) => onSelect(run.runId, event.currentTarget)}
      onFocus={() => {
        roving.setCurrent(run.runId);
      }}
      onKeyDown={(event) => roving.onCardKeyDown(event, run.runId)}
      ref={(element) => roving.registerCard(run.runId, element, ensureVisible)}
      type="button"
    >
      <span className="card-top">
        <span className="status-reason">
          <Icon aria-hidden="true" size={13} />
          <span>
            {unsupported
              ? "Unsupported cursor"
              : (run.reason?.value ?? run.status ?? "Status update")}
          </span>
        </span>
        <time dateTime={run.updatedAt}>{formatAge(run.updatedAt ?? run.createdAt)}</time>
      </span>
      <strong className="card-title">{run.title.value}</strong>
      <span className="card-fact">
        <span>Workflow</span>
        <b>{run.workflow}</b>
      </span>
      <span className="card-fact">
        <span>Current step</span>
        <code>{unsupported ? "unsupported" : (run.currentStep ?? "None")}</code>
      </span>
      {!run.title.value.includes(run.runId) ? (
        <code className="card-id">{shortRunId(run.runId)}</code>
      ) : null}
    </button>
  );
}
