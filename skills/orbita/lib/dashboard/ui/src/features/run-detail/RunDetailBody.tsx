import type { RunLightDetailDTO } from "@dashboard-contracts";
import { lazy, Suspense } from "react";
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "@/components/ui/tabs";
import { ActivityPanel } from "./ActivityPanel";
import { ArtifactsPanel } from "./ArtifactsPanel";
import { useRunDetailModel } from "./hooks/use-run-detail-model";
import { LogsPanel } from "./LogsPanel";
import { RunDetailOverview } from "./RunDetailOverview";
import { StepPathSelector } from "./StepPathSelector";
import { PanelEmpty, PanelError, PanelLoading } from "./states/PanelStates";

const WorkflowGraph = lazy(() => import("./WorkflowGraph"));

/** Run-detail orchestration shell. Step-path selection never enters Workflow query state. */
export function RunDetailBody({ detail }: Readonly<{ detail: RunLightDetailDTO }>) {
  const model = useRunDetailModel(detail);

  return (
    <div className="detail-body">
      <RunDetailOverview detail={detail} />
      {model.selector.isPending && !model.selector.steps.length ? (
        <PanelLoading label="Loading workflow path…" />
      ) : model.selector.isError ? (
        <PanelError message="Workflow path is unavailable." onRetry={model.selector.onRetry} />
      ) : model.selector.steps.length ? (
        <StepPathSelector
          onRetryPaging={model.selector.onRetryPaging}
          onSelect={model.selector.onSelect}
          onShowEarlier={model.selector.onShowEarlier}
          pagination={model.selector.pagination}
          selectedStepId={model.selector.selectedStepId}
          steps={model.selector.steps}
        />
      ) : (
        <PanelEmpty
          detail="No current or previous workflow step is available."
          title="Workflow path unavailable"
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
          <ActivityPanel stepLabel={model.stepLabel} {...model.activity} />
        </TabsContent>
        <TabsContent className="detail-tab-panel" value="logs">
          <LogsPanel stepLabel={model.stepLabel} {...model.logs} />
        </TabsContent>
        <TabsContent className="detail-tab-panel" value="artifacts">
          <ArtifactsPanel stepLabel={model.stepLabel} {...model.artifacts} />
        </TabsContent>
      </TabsRoot>
    </div>
  );
}
