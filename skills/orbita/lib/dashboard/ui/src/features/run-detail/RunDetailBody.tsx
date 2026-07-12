import type { RunDetailDTO } from "@dashboard-contracts";
import { Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TooltipLabel } from "@/components/ui/tooltip";
import { formatAge } from "@/lib/time";
import { WorkflowMiniMap } from "./WorkflowMiniMap";

export function RunDetailBody({ detail }: Readonly<{ detail: RunDetailDTO }>) {
  return (
    <div className="detail-body">
      <div className="detail-summary">
        <Badge className={`tone-${detail.laneId}`}>
          {detail.reason?.value ?? detail.status ?? detail.laneId}
        </Badge>
        <p>{detail.summary?.value ?? "No additional summary is available."}</p>
      </div>
      <dl className="detail-facts">
        <div>
          <dt>Run id</dt>
          <dd>
            <code>{detail.runId}</code>
            <TooltipLabel label="Copy run id">
              <Button
                aria-label="Copy run id"
                onClick={() => void navigator.clipboard?.writeText(detail.runId)}
                size="icon"
                variant="quiet"
              >
                <Copy aria-hidden="true" size={15} />
              </Button>
            </TooltipLabel>
          </dd>
        </div>
        <div>
          <dt>Workflow</dt>
          <dd>{detail.workflow}</dd>
        </div>
        <div>
          <dt>Current step</dt>
          <dd>
            <code>
              {detail.cursor.kind === "single"
                ? detail.cursor.step
                : detail.cursor.kind === "unsupported"
                  ? "Unsupported cursor"
                  : "None"}
            </code>
          </dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{formatAge(detail.updatedAt ?? detail.createdAt)} ago</dd>
        </div>
      </dl>
      <WorkflowMiniMap miniMap={detail.miniMap} />
      {detail.facts.length ? (
        <DetailSection title="Facts">
          <dl className="bounded-list">
            {detail.facts.map((fact) => (
              <div key={`${fact.label}:${fact.value}`}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </DetailSection>
      ) : null}
      {detail.artifacts.length ? (
        <DetailSection title={`Artifacts · ${detail.artifacts.length}`}>
          <ul className="bounded-list">
            {detail.artifacts.map((artifact) => (
              <li key={`${artifact.producerStepId ?? ""}:${artifact.id}`}>
                <code>{artifact.id}</code>
                <span>{artifact.contentType ?? "Artifact"}</span>
              </li>
            ))}
          </ul>
        </DetailSection>
      ) : null}
      {detail.results.length ? (
        <DetailSection title={`Results · ${detail.results.length}`}>
          <ul className="bounded-list">
            {detail.results.map((result, index) => (
              <li key={`${result.ref ?? result.type ?? "result"}:${index}`}>
                <span>{result.outcome ?? result.type ?? "Result"}</span>
                <span>{result.summary?.value ?? result.ref}</span>
              </li>
            ))}
          </ul>
        </DetailSection>
      ) : null}
      {detail.history.length ? (
        <DetailSection
          title={detail.historyTruncated ? "Bounded history · truncated" : "Bounded history"}
        >
          <ol className="history-list">
            {detail.history.map((entry, index) => (
              <li key={`${index}:${entry.value}`}>{entry.value}</li>
            ))}
          </ol>
        </DetailSection>
      ) : null}
    </div>
  );
}

function DetailSection({
  children,
  title,
}: Readonly<{ children: React.ReactNode; title: string }>) {
  return (
    <section className="detail-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
