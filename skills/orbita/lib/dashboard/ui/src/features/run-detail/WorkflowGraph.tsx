import type { TraversalPageDTO, WorkflowPageDTO } from "@dashboard-contracts";
import { Background, BackgroundVariant, Controls, ReactFlow } from "@xyflow/react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type PagingState } from "./run-detail-view-model";
import { PagingFailure } from "./states/PanelStates";
import {
  graphElements,
  STEP_KIND_LABELS,
  STEP_LABELS,
  stepState,
  WorkflowStepNode,
} from "./workflow-graph-model";
import { WorkflowStepArtifacts } from "./WorkflowStepArtifacts";

const nodeTypes = { workflowStep: WorkflowStepNode };

type WorkflowGraphProps = {
  definitionComplete: boolean;
  edges: WorkflowPageDTO["edges"];
  executionComplete: boolean;
  isLoading: boolean;
  nodes: WorkflowPageDTO["nodes"];
  onLoadMore: () => void;
  pagination: PagingState;
  runId: string;
  traversedSteps: TraversalPageDTO["items"];
};

export default function WorkflowGraph(props: WorkflowGraphProps) {
  const currentStep = props.nodes.find(
    (step) => stepState(step.stepId, props.traversedSteps) === "current",
  );
  const [selectedStepId, setSelectedStepId] = useState(
    currentStep?.stepId ?? props.nodes[0]?.stepId,
  );
  const selectedStep =
    props.nodes.find((step) => step.stepId === selectedStepId) ?? currentStep ?? props.nodes[0];
  const { edges, nodes } = graphElements(
    props.nodes,
    props.edges,
    props.traversedSteps,
    selectedStep?.stepId,
  );
  if (!props.nodes.length && !props.isLoading) {
    return (
      <section className="workflow-map">
        <p className="detail-empty">Workflow definition is unavailable.</p>
        {props.pagination === "error" || props.pagination === "stale" ? (
          <PagingFailure
            onRetry={props.onLoadMore}
            resource="Workflow evidence"
            stale={props.pagination === "stale"}
          />
        ) : null}
      </section>
    );
  }

  return (
    <section
      aria-busy={props.pagination === "loading"}
      aria-labelledby="workflow-progress-title"
      className="workflow-map"
    >
      <div className="workflow-map-toolbar">
        <p id="workflow-progress-title">
          {workflowProgressLabel(props.definitionComplete, props.executionComplete)}
        </p>
        <Badge>
          {props.definitionComplete && props.executionComplete
            ? `${props.nodes.length} steps`
            : `${props.nodes.length} loaded · partial`}
        </Badge>
        {props.pagination === "error" || props.pagination === "stale" ? (
          <PagingFailure
            onRetry={props.onLoadMore}
            resource="Workflow evidence"
            stale={props.pagination === "stale"}
          />
        ) : props.pagination !== "complete" ? (
          <Button
            disabled={props.pagination === "loading"}
            onClick={props.onLoadMore}
            variant="quiet"
          >
            {props.pagination === "loading" ? "Loading…" : "Load complete workflow"}
          </Button>
        ) : null}
      </div>
      <section aria-label="Workflow graph" className="workflow-canvas">
        <ReactFlow
          edges={edges}
          elementsSelectable
          fitView
          fitViewOptions={{ maxZoom: 0.9, minZoom: 0.42, padding: 0.16 }}
          minZoom={0.3}
          nodes={nodes}
          nodesConnectable={false}
          nodesDraggable={false}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => setSelectedStepId(node.id)}
          panOnScroll
          proOptions={{ hideAttribution: true }}
        >
          <Background color="var(--border)" gap={18} size={1} variant={BackgroundVariant.Dots} />
          <Controls position="top-right" showInteractive={false} />
        </ReactFlow>
      </section>
      {selectedStep ? (
        <section aria-live="polite" className="workflow-step-detail">
          <div className="workflow-step-overview">
            <div className="workflow-step-detail-heading">
              <div>
                <span>Step details</span>
                <h4>{selectedStep.stepId}</h4>
              </div>
              <Badge>{STEP_LABELS[stepState(selectedStep.stepId, props.traversedSteps)]}</Badge>
            </div>
            <dl>
              <div>
                <dt>Position</dt>
                <dd>
                  {props.nodes.indexOf(selectedStep) + 1} of {props.nodes.length}
                </dd>
              </div>
              <div>
                <dt>State</dt>
                <dd>{STEP_LABELS[stepState(selectedStep.stepId, props.traversedSteps)]}</dd>
              </div>
              <div>
                <dt>Kind</dt>
                <dd>{STEP_KIND_LABELS[selectedStep.kind]}</dd>
              </div>
            </dl>
          </div>
          <WorkflowStepArtifacts runId={props.runId} stepId={selectedStep.stepId} />
        </section>
      ) : null}
    </section>
  );
}

function workflowProgressLabel(definitionComplete: boolean, executionComplete: boolean): string {
  if (!definitionComplete) {
    return "Loading complete workflow definition…";
  }
  if (!executionComplete) {
    return "Workflow definition complete · execution evidence partial";
  }
  return "Select a step to inspect it";
}
