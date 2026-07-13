import type { RunActivityPageDTO, RunDetailDTO, RunOutputsDTO } from "@dashboard-contracts";
import { Clock3, Copy, LoaderCircle } from "lucide-react";
import { Children, isValidElement, lazy, Suspense, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "@/components/ui/tabs";
import { TooltipLabel } from "@/components/ui/tooltip";
import { formatAge } from "@/lib/time";
import { ArtifactCollection } from "./ArtifactCollection";
import { CurrentRunPath } from "./CurrentRunPath";
import { useRunActivityQuery } from "./hooks/use-run-activity-query";
import { useRunOutputsQuery } from "./hooks/use-run-outputs-query";

const WorkflowGraph = lazy(() => import("./WorkflowGraph"));
const UNASSIGNED_STEP = "__unassigned";
const ACTIVITY_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

type Activity = RunActivityPageDTO["activities"][number];
type Artifact = RunOutputsDTO["artifacts"][number];
type DetailTab = "graph" | "activity" | "artifacts" | "metadata";
type Result = RunOutputsDTO["results"][number];
type StepGroup = {
  activities: Array<Activity>;
  artifacts: Array<Artifact>;
  results: Array<Result>;
  stepId: string;
};

export function RunDetailBody({ detail }: Readonly<{ detail: RunDetailDTO }>) {
  const [activeTab, setActiveTab] = useState<DetailTab>("graph");
  const [selectedStepId, setSelectedStepId] = useState<string>();
  const activityQuery = useRunActivityQuery(detail.runId, activeTab === "activity", selectedStepId);
  const outputsQuery = useRunOutputsQuery(detail.runId, activeTab === "artifacts", selectedStepId);
  const activities = activityQuery.data?.pages.flatMap((page) => page.activities) ?? [];
  const artifacts = outputsQuery.data?.artifacts ?? [];
  const results = outputsQuery.data?.results ?? [];
  const groups = detailGroups(detail, activities, artifacts, results, selectedStepId);
  const visibleActivities = groups.reduce((count, group) => count + group.activities.length, 0);
  const visibleOutputs = groups.reduce(
    (count, group) => count + group.artifacts.length + group.results.length,
    0,
  );

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
      <CurrentRunPath
        miniMap={detail.miniMap}
        onSelectedStepChange={setSelectedStepId}
        selectedStepId={selectedStepId}
      />
      <TabsRoot
        className="detail-tabs"
        onValueChange={(value) => setActiveTab(value as DetailTab)}
        value={activeTab}
      >
        <TabsList aria-label="Run detail sections" className="detail-tabs-list">
          <TabsTrigger value="graph">Graph</TabsTrigger>
          <TabsTrigger value="activity">
            Activity {activityQuery.data ? <span>{visibleActivities}</span> : null}
          </TabsTrigger>
          <TabsTrigger value="artifacts">
            Artifacts {outputsQuery.data ? <span>{visibleOutputs}</span> : null}
          </TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
        </TabsList>
        <TabsContent className="detail-tab-panel detail-graph-panel" value="graph">
          <Suspense fallback={<div className="workflow-map-loading">Loading workflow…</div>}>
            <WorkflowGraph
              miniMap={detail.miniMap}
              onSelectedStepChange={setSelectedStepId}
              selectedStepId={selectedStepId}
            />
          </Suspense>
        </TabsContent>
        <TabsContent className="detail-tab-panel" value="activity">
          {activityQuery.isPending ? (
            <TabLoading>Loading activity…</TabLoading>
          ) : activityQuery.isError ? (
            <TabError onRetry={() => void activityQuery.refetch()}>
              Activity could not be loaded.
            </TabError>
          ) : groups.some((group) => group.activities.length) ? (
            <div className="step-groups">
              {groups.map((group) =>
                group.activities.length ? (
                  <DetailSection key={`activity:${group.stepId}`} title={stepTitle(group.stepId)}>
                    <ol className="activity-list">
                      {group.activities.map((entry) => (
                        <li className="activity-entry" key={entry.id}>
                          {entry.occurredAt ? (
                            <div className="activity-entry-meta">
                              <time dateTime={entry.occurredAt}>
                                {formatActivityTime(entry.occurredAt)}
                              </time>
                            </div>
                          ) : null}
                          <div className="activity-markdown">
                            <ReactMarkdown
                              components={{ li: ActivityListItem }}
                              remarkPlugins={[remarkGfm]}
                              skipHtml
                            >
                              {activityMarkdownBody(entry)}
                            </ReactMarkdown>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </DetailSection>
                ) : null,
              )}
              {activityQuery.hasNextPage ? (
                <Button
                  className="detail-load-more"
                  disabled={activityQuery.isFetchingNextPage}
                  onClick={() => void activityQuery.fetchNextPage()}
                  variant="quiet"
                >
                  {activityQuery.isFetchingNextPage ? (
                    <LoaderCircle aria-hidden="true" className="ui-spinner" size={15} />
                  ) : null}
                  Load more
                </Button>
              ) : null}
            </div>
          ) : (
            <EmptyDetailState>No public activity is available for this selection.</EmptyDetailState>
          )}
        </TabsContent>
        <TabsContent className="detail-tab-panel" value="artifacts">
          {outputsQuery.isPending ? (
            <TabLoading>Loading outputs…</TabLoading>
          ) : outputsQuery.isError ? (
            <TabError onRetry={() => void outputsQuery.refetch()}>
              Outputs could not be loaded.
            </TabError>
          ) : groups.some((group) => group.artifacts.length || group.results.length) ? (
            <div className="step-groups">
              {groups.map((group) =>
                group.artifacts.length || group.results.length ? (
                  <DetailSection key={`outputs:${group.stepId}`} title={stepTitle(group.stepId)}>
                    {group.artifacts.length ? (
                      <div className="output-group">
                        <h4>Artifacts</h4>
                        <ArtifactCollection artifacts={group.artifacts} runId={detail.runId} />
                      </div>
                    ) : null}
                    {group.results.length ? (
                      <OutputList title="Results">
                        {group.results.map((result, index) => (
                          <li key={`${result.ref ?? result.type ?? "result"}:${index}`}>
                            <strong>{result.outcome ?? result.type ?? "Result"}</strong>
                            <span>{result.summary?.value ?? result.ref}</span>
                          </li>
                        ))}
                      </OutputList>
                    ) : null}
                  </DetailSection>
                ) : null,
              )}
            </div>
          ) : (
            <EmptyDetailState>No public outputs are available for this selection.</EmptyDetailState>
          )}
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

function detailGroups(
  detail: RunDetailDTO,
  activities: Array<Activity>,
  artifacts: Array<Artifact>,
  results: Array<Result>,
  selectedStepId?: string,
): Array<StepGroup> {
  const allStepIds = new Set<string>();
  for (const entry of activities) {
    for (const stepId of entry.stepIds) {
      allStepIds.add(stepId);
    }
  }
  for (const item of [...artifacts, ...results]) {
    if (item.producerStepId) {
      allStepIds.add(item.producerStepId);
    }
  }
  const workflowOrder =
    detail.miniMap.state === "available" ? detail.miniMap.steps.map((step) => step.stepId) : [];
  const orderedStepIds = [
    ...workflowOrder.filter((stepId) => allStepIds.has(stepId)),
    ...[...allStepIds].filter((stepId) => !workflowOrder.includes(stepId)),
  ];
  if (
    activities.some((entry) => !entry.stepIds.length) ||
    artifacts.some((item) => !item.producerStepId) ||
    results.some((item) => !item.producerStepId)
  ) {
    orderedStepIds.push(UNASSIGNED_STEP);
  }
  const visibleStepIds = selectedStepId ? [selectedStepId] : orderedStepIds;
  return visibleStepIds.map((stepId) => ({
    activities: activities.filter((entry) =>
      stepId === UNASSIGNED_STEP
        ? !entry.stepIds.length
        : selectedStepId
          ? entry.stepIds.includes(stepId)
          : entry.stepIds[0] === stepId,
    ),
    artifacts: artifacts.filter((artifact) =>
      stepId === UNASSIGNED_STEP ? !artifact.producerStepId : artifact.producerStepId === stepId,
    ),
    results: results.filter((result) =>
      stepId === UNASSIGNED_STEP ? !result.producerStepId : result.producerStepId === stepId,
    ),
    stepId,
  }));
}

function stepTitle(stepId: string): string {
  return stepId === UNASSIGNED_STEP ? "Run-level" : stepId;
}

function cursorLabel(detail: RunDetailDTO): string {
  return detail.cursor.kind === "single"
    ? detail.cursor.step
    : detail.cursor.kind === "unsupported"
      ? "Unsupported cursor"
      : "None";
}

function formatActivityTime(value: string): string {
  return ACTIVITY_DATE_FORMATTER.format(new Date(value));
}

function activityMarkdownBody(entry: Activity): string {
  if (!entry.occurredAt) {
    return entry.markdown.value;
  }
  const lines = entry.markdown.value.split("\n");
  if (/^#{1,6}\s+\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/u.test(lines[0] ?? "")) {
    lines.shift();
    if (!lines[0]?.trim()) {
      lines.shift();
    }
  }
  return lines.join("\n");
}

function activityPropertyText(children: React.ReactNode): string | undefined {
  const parts = Children.toArray(children);
  if (parts.every((part) => typeof part === "string")) {
    return parts.join("");
  }
  if (parts.length !== 1 || !isValidElement<{ children?: React.ReactNode }>(parts[0])) {
    return undefined;
  }
  const nested = Children.toArray(parts[0].props.children);
  return nested.every((part) => typeof part === "string") ? nested.join("") : undefined;
}

function ActivityListItem({ children, ...props }: React.ComponentProps<"li">) {
  const match = activityPropertyText(children)?.match(/^([^:]{1,32}):\s*(.+)$/u);
  return match ? (
    <li {...props} className="activity-property">
      <strong>{match[1]}</strong>
      <span>{match[2]}</span>
    </li>
  ) : (
    <li {...props}>{children}</li>
  );
}

function OutputList({ children, title }: Readonly<{ children: React.ReactNode; title: string }>) {
  return (
    <div className="output-group">
      <h4>{title}</h4>
      <ul className="bounded-list">{children}</ul>
    </div>
  );
}

function TabLoading({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <output className="detail-tab-state">
      <LoaderCircle aria-hidden="true" className="ui-spinner" size={18} />
      <span>{children}</span>
    </output>
  );
}

function TabError({
  children,
  onRetry,
}: Readonly<{ children: React.ReactNode; onRetry: () => void }>) {
  return (
    <div className="detail-tab-state" role="alert">
      <span>{children}</span>
      <Button onClick={onRetry} variant="quiet">
        Try again
      </Button>
    </div>
  );
}

function EmptyDetailState({ children }: Readonly<{ children: React.ReactNode }>) {
  return <p className="detail-empty">{children}</p>;
}

function DetailSection({
  children,
  title,
}: Readonly<{ children: React.ReactNode; title: string }>) {
  return (
    <section className="detail-section step-group">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
