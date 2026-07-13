import type { RunDetailDTO } from "@dashboard-contracts";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { BadgeCheck, Bot, Check, GitFork, Layers3 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

type AvailableMiniMap = Extract<RunDetailDTO["miniMap"], { state: "available" }>;
type WorkflowStep = AvailableMiniMap["steps"][number];
type WorkflowNodeData = {
  kind: WorkflowStep["kind"];
  label: string;
  parallelism?: WorkflowStep["parallelism"];
  sourcePosition: Position;
  state: WorkflowStep["state"];
  targetPosition: Position;
};
type WorkflowNode = Node<WorkflowNodeData, "workflowStep">;

const STEP_LABELS: Record<WorkflowStep["state"], string> = {
  completed: "Completed",
  current: "Current",
  pending: "Pending",
};
const STEP_KIND_LABELS: Record<WorkflowStep["kind"], string> = {
  approval: "Approval",
  done: "Done",
  fanout: "Fanout",
  shard: "Shard",
  worker: "Worker",
};
const STEP_KIND_ICONS = {
  approval: BadgeCheck,
  done: Check,
  fanout: GitFork,
  shard: Layers3,
  worker: Bot,
} satisfies Record<WorkflowStep["kind"], typeof Bot>;

const nodeTypes = { workflowStep: WorkflowStepNode };

function WorkflowStepNode({ data, selected }: NodeProps<WorkflowNode>) {
  const KindIcon = STEP_KIND_ICONS[data.kind];
  return (
    <div
      className="workflow-node"
      data-kind={data.kind}
      data-parallel={data.parallelism ? "true" : undefined}
      data-selected={selected}
      data-state={data.state}
    >
      <Handle isConnectable={false} position={data.targetPosition} type="target" />
      <span aria-hidden="true" className="workflow-node-kind">
        <KindIcon size={15} strokeWidth={1.8} />
      </span>
      <span className="workflow-node-label">{data.label}</span>
      <span className="workflow-node-state">
        <i aria-hidden="true" />
        {STEP_LABELS[data.state]}
      </span>
      {data.parallelism ? (
        <span className="workflow-node-parallelism">
          {data.parallelism.count ?? "Dynamic"} {data.parallelism.mode}
          {data.parallelism.maxParallel ? ` · max ${data.parallelism.maxParallel} parallel` : ""}
        </span>
      ) : null}
      <Handle isConnectable={false} position={data.sourcePosition} type="source" />
    </div>
  );
}

function graphElements(
  steps: AvailableMiniMap["steps"],
  selectedStepId?: string,
): {
  edges: Array<Edge>;
  nodes: Array<WorkflowNode>;
} {
  const visibleStepIds = new Set(steps.map((step) => step.stepId));
  return {
    edges: steps.flatMap((step) =>
      step.nextStepIds.flatMap((target) =>
        visibleStepIds.has(target)
          ? [
              {
                id: `${step.stepId}->${target}`,
                source: step.stepId,
                target,
                type: "smoothstep",
              },
            ]
          : [],
      ),
    ),
    nodes: steps.map((step, index) => {
      const columns = Math.min(3, Math.max(1, steps.length));
      const row = Math.floor(index / columns);
      const offset = index % columns;
      const column = row % 2 === 0 ? offset : columns - offset - 1;
      const rowEnd = (index + 1) % columns === 0 && index < steps.length - 1;
      const rowStart = index % columns === 0 && index > 0;
      const rowDirection = row % 2 === 0 ? Position.Right : Position.Left;
      return {
        ariaLabel: `${step.stepId}, ${STEP_KIND_LABELS[step.kind]}, ${STEP_LABELS[step.state]}`,
        data: {
          kind: step.kind,
          label: step.stepId,
          parallelism: step.parallelism,
          sourcePosition: rowEnd ? Position.Bottom : rowDirection,
          state: step.state,
          targetPosition: rowStart
            ? Position.Top
            : rowDirection === Position.Right
              ? Position.Left
              : Position.Right,
        },
        id: step.stepId,
        position: { x: column * 240, y: row * 120 },
        selected: step.stepId === selectedStepId,
        type: "workflowStep",
      };
    }),
  };
}

export default function WorkflowGraph({
  artifacts,
  miniMap,
}: Readonly<{
  artifacts: RunDetailDTO["artifacts"];
  miniMap: RunDetailDTO["miniMap"];
}>) {
  if (miniMap.state === "unavailable") {
    return (
      <div className="workflow-map">
        <p>Workflow visualization is unavailable.</p>
      </div>
    );
  }
  return <AvailableWorkflowGraph artifacts={artifacts} miniMap={miniMap} />;
}

function AvailableWorkflowGraph({
  artifacts,
  miniMap,
}: Readonly<{
  artifacts: RunDetailDTO["artifacts"];
  miniMap: AvailableMiniMap;
}>) {
  const initialStep = miniMap.steps.find((step) => step.state === "current") ?? miniMap.steps[0];
  const [selectedStepId, setSelectedStepId] = useState(initialStep?.stepId);
  const selectedStep = miniMap.steps.find((step) => step.stepId === selectedStepId) ?? initialStep;
  const { edges, nodes } = graphElements(miniMap.steps, selectedStepId);
  const selectedArtifacts = selectedStep
    ? artifacts.filter((artifact) => artifact.producerStepId === selectedStep.stepId)
    : [];

  return (
    <section aria-labelledby="workflow-progress-title" className="workflow-map">
      <div className="workflow-map-toolbar">
        <p id="workflow-progress-title">Select a step to inspect it</p>
        <Badge>{miniMap.totalSteps} steps</Badge>
      </div>
      {miniMap.steps.length ? (
        <>
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
              <Background
                color="var(--border)"
                gap={18}
                size={1}
                variant={BackgroundVariant.Dots}
              />
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
                  <Badge className={`workflow-state-${selectedStep.state}`}>
                    {STEP_LABELS[selectedStep.state]}
                  </Badge>
                </div>
                <dl>
                  <div>
                    <dt>Position</dt>
                    <dd>
                      {miniMap.steps.indexOf(selectedStep) + 1} of {miniMap.totalSteps}
                    </dd>
                  </div>
                  <div>
                    <dt>State</dt>
                    <dd>{STEP_LABELS[selectedStep.state]}</dd>
                  </div>
                  <div>
                    <dt>Kind</dt>
                    <dd>{STEP_KIND_LABELS[selectedStep.kind]}</dd>
                  </div>
                  {selectedStep.parallelism ? (
                    <div>
                      <dt>Parallel work</dt>
                      <dd>
                        {selectedStep.parallelism.count ?? "Dynamic"}{" "}
                        {selectedStep.parallelism.mode}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>
              <div className="workflow-step-artifacts">
                <div className="workflow-step-artifacts-heading">
                  <h5>Artifacts</h5>
                  <span>{selectedArtifacts.length}</span>
                </div>
                {selectedArtifacts.length ? (
                  <ul aria-label={`Artifacts produced by ${selectedStep.stepId}`}>
                    {selectedArtifacts.map((artifact) => (
                      <li key={artifact.id}>
                        <code>{artifact.id}</code>
                        <span>{artifact.contentType ?? "Artifact"}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No public artifacts are associated with this step.</p>
                )}
              </div>
            </section>
          ) : null}
          {miniMap.truncated ? (
            <p>
              Showing {miniMap.steps.length} of {miniMap.totalSteps} steps.
            </p>
          ) : null}
        </>
      ) : (
        <p>This workflow has no visible steps.</p>
      )}
    </section>
  );
}
