import { AlertTriangle, Inbox, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PanelLoading({ label }: Readonly<{ label: string }>) {
  return (
    <output aria-busy="true" className="panel-state">
      <LoaderCircle aria-hidden="true" className="panel-state-spinner" size={22} />
      <p>{label}</p>
    </output>
  );
}

export function PanelError({
  message,
  onRetry,
}: Readonly<{ message: string; onRetry?: (() => void) | undefined }>) {
  return (
    <div className="panel-state" role="alert">
      <AlertTriangle aria-hidden="true" size={22} />
      <p>{message}</p>
      {onRetry ? <Button onClick={onRetry}>Try again</Button> : null}
    </div>
  );
}

export function PanelEmpty({
  action,
  detail,
  title,
}: Readonly<{ action?: React.ReactNode; detail: string; title: string }>) {
  return (
    <div className="panel-state">
      <Inbox aria-hidden="true" size={22} />
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}

export function LegacyUnavailable({ stepLabel }: Readonly<{ stepLabel: string }>) {
  return (
    <PanelEmpty
      detail="This step is known from workflow history, but exact step evidence was not recorded for this run."
      title={`Evidence unavailable for ${stepLabel}`}
    />
  );
}

export function OccurrenceEvidenceUnavailable({
  state,
}: Readonly<{ state: "missing_selection" | "traversal_pending" }>) {
  return state === "traversal_pending" ? (
    <PanelLoading label="Waiting for workflow traversal before loading selected evidence…" />
  ) : (
    <PanelEmpty
      detail="The selected step is no longer present in the latest path. Choose another step above."
      title="Selected step unavailable"
    />
  );
}

export function PagingFailure({
  onRetry,
  resource,
  stale,
}: Readonly<{ onRetry: () => void; resource: string; stale?: boolean | undefined }>) {
  return (
    <div className="panel-paging-failure" role="alert">
      <p>
        {stale
          ? `${resource} changed while paging. Loaded evidence is preserved.`
          : `${resource} paging failed. Loaded evidence is preserved.`}
      </p>
      <Button onClick={onRetry} variant="quiet">
        {stale ? "Reload from latest" : "Try again"}
      </Button>
    </div>
  );
}
