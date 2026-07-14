import type { RunLightDetailDTO } from "@dashboard-contracts";
import { lazy, Suspense } from "react";
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "@/components/ui/tabs";
import { ActivityPanel } from "./ActivityPanel";
import { ArtifactsPanel } from "./ArtifactsPanel";
import { useRunDetailModel } from "./hooks/use-run-detail-model";
import { LogsPanel } from "./LogsPanel";
import { OccurrenceSelector } from "./OccurrenceSelector";
import { RunDetailOverview } from "./RunDetailOverview";
import { PanelEmpty, PanelError, PanelLoading } from "./states/PanelStates";

const WorkflowGraph = lazy(() => import("./WorkflowGraph"));

/** Run-detail orchestration shell. Occurrence selection never enters Workflow query state. */
export function RunDetailBody({ detail }: Readonly<{ detail: RunLightDetailDTO }>) {
  const model = useRunDetailModel(detail);

  return (
    <div className="detail-body">
      <RunDetailOverview detail={detail} />
      {model.selector.isPending && !model.legacyUnavailable ? (
        <PanelLoading label="Loading occurrences…" />
      ) : model.selector.isError ? (
        <PanelError message="Occurrences are unavailable." onRetry={model.selector.onRetry} />
      ) : model.selector.occurrences.length ? (
        <OccurrenceSelector
          occurrences={model.selector.occurrences}
          onRetryPaging={model.selector.onRetryPaging}
          onSelect={model.selector.onSelect}
          onShowEarlier={model.selector.onShowEarlier}
          pagination={model.selector.pagination}
          selectedRef={model.selector.selectedRef}
        />
      ) : (
        <PanelEmpty
          detail={
            model.legacyUnavailable
              ? "Occurrence identity is unavailable for this legacy run. Workflow remains inspectable."
              : "No owner occurrence is currently available."
          }
          title={
            model.legacyUnavailable ? "Legacy occurrence unavailable" : "No occurrence selected"
          }
        />
      )}
      <TabsRoot className="detail-tabs" defaultValue="workflow">
        <TabsList aria-label="Run detail sections" className="detail-tabs-list">
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
        </TabsList>
        <TabsContent className="detail-tab-panel detail-graph-panel" value="workflow">
          <Suspense fallback={<PanelLoading label="Loading workflow visualization…" />}>
            <WorkflowGraph {...model.workflow} />
          </Suspense>
        </TabsContent>
        <TabsContent className="detail-tab-panel" value="activity">
          <ActivityPanel occurrenceLabel={model.occurrenceLabel} {...model.activity} />
        </TabsContent>
        <TabsContent className="detail-tab-panel" value="logs">
          <LogsPanel occurrenceLabel={model.occurrenceLabel} {...model.logs} />
        </TabsContent>
        <TabsContent className="detail-tab-panel" value="artifacts">
          <ArtifactsPanel occurrenceLabel={model.occurrenceLabel} {...model.artifacts} />
        </TabsContent>
      </TabsRoot>
    </div>
  );
}
