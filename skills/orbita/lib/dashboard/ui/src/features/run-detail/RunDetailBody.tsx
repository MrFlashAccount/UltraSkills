import type { RunDetailDTO } from "@dashboard-contracts";
import { Clock3, Copy } from "lucide-react";
import { lazy, Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "@/components/ui/tabs";
import { TooltipLabel } from "@/components/ui/tooltip";
import { formatAge } from "@/lib/time";

const WorkflowGraph = lazy(() => import("./WorkflowGraph"));
const workflowFallback = (
  <section className="workflow-map workflow-map-loading">
    <p>Loading workflow visualization…</p>
  </section>
);

export function RunDetailBody({ detail }: Readonly<{ detail: RunDetailDTO }>) {
  return (
    <div className="detail-body">
      <div className="detail-overview">
        <div className="detail-overview-meta">
          <Badge className={`tone-${detail.laneId}`}>
            {detail.reason?.value ?? detail.status ?? detail.laneId}
          </Badge>
          <span>
            <Clock3 aria-hidden="true" size={14} />
            Updated {formatAge(detail.updatedAt ?? detail.createdAt)} ago
          </span>
        </div>
        <p>{detail.summary?.value ?? "No additional summary is available."}</p>
      </div>
      <TabsRoot className="detail-tabs" defaultValue="graph">
        <TabsList aria-label="Run detail sections" className="detail-tabs-list">
          <TabsTrigger value="graph">Graph</TabsTrigger>
          <TabsTrigger value="activity">
            Activity <span>{detail.history.length}</span>
          </TabsTrigger>
          <TabsTrigger value="artifacts">
            Artifacts <span>{detail.artifacts.length + detail.results.length}</span>
          </TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
        </TabsList>
        <TabsContent className="detail-tab-panel detail-graph-panel" value="graph">
          <Suspense fallback={workflowFallback}>
            <WorkflowGraph artifacts={detail.artifacts} miniMap={detail.miniMap} />
          </Suspense>
        </TabsContent>
        <TabsContent className="detail-tab-panel" value="activity">
          <DetailSection
            title={detail.historyTruncated ? "Bounded activity · truncated" : "Bounded activity"}
          >
            {detail.history.length ? (
              <ol className="history-list">
                {detail.history.map((entry, index) => (
                  <li key={`${index}:${entry.value}`}>{entry.value}</li>
                ))}
              </ol>
            ) : (
              <EmptyDetailState>No public activity is available for this run.</EmptyDetailState>
            )}
          </DetailSection>
        </TabsContent>
        <TabsContent className="detail-tab-panel" value="artifacts">
          <DetailSection title={`Artifacts · ${detail.artifacts.length}`}>
            {detail.artifacts.length ? (
              <ul className="bounded-list">
                {detail.artifacts.map((artifact) => (
                  <li key={`${artifact.producerStepId ?? ""}:${artifact.id}`}>
                    <code>{artifact.id}</code>
                    <span>{artifact.contentType ?? "Artifact"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyDetailState>No public artifacts are available for this run.</EmptyDetailState>
            )}
          </DetailSection>
          <DetailSection title={`Results · ${detail.results.length}`}>
            {detail.results.length ? (
              <ul className="bounded-list">
                {detail.results.map((result, index) => (
                  <li key={`${result.ref ?? result.type ?? "result"}:${index}`}>
                    <span>{result.outcome ?? result.type ?? "Result"}</span>
                    <span>{result.summary?.value ?? result.ref}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyDetailState>No public results are available for this run.</EmptyDetailState>
            )}
          </DetailSection>
        </TabsContent>
        <TabsContent className="detail-tab-panel" value="metadata">
          <DetailSection title="Run metadata">
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
                      variant="ghost"
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
                  <code>{cursorLabel(detail)}</code>
                </dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{formatAge(detail.updatedAt ?? detail.createdAt)} ago</dd>
              </div>
            </dl>
          </DetailSection>
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
        </TabsContent>
      </TabsRoot>
    </div>
  );
}

function cursorLabel(detail: RunDetailDTO): string {
  return detail.cursor.kind === "single"
    ? detail.cursor.step
    : detail.cursor.kind === "unsupported"
      ? "Unsupported cursor"
      : "None";
}

function EmptyDetailState({ children }: Readonly<{ children: React.ReactNode }>) {
  return <p className="detail-empty">{children}</p>;
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
