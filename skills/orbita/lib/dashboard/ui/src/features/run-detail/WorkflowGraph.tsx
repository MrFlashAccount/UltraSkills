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

function stepStateLabel(step: Pick<WorkflowStep, "kind" | "state">): string {
  return step.kind === "done" && step.state === "pending" ? "Terminal" : STEP_LABELS[step.state];
}

function stepDataState(step: Pick<WorkflowStep, "kind" | "state">): string {
  return step.kind === "done" && step.state === "pending" ? "terminal" : step.state;
}

function WorkflowStepNode({ data, selected }: NodeProps<WorkflowNode>) {
  const KindIcon = STEP_KIND_ICONS[data.kind];
  return (
    <div
      className="workflow-node"
      data-kind={data.kind}
      data-parallel={data.parallelism ? "true" : undefined}
      data-selected={selected}
      data-state={stepDataState(data)}
    >
      <Handle isConnectable={false} position={data.targetPosition} type="target" />
      <span aria-hidden="true" className="workflow-node-kind">
        <KindIcon size={15} strokeWidth={1.8} />
      </span>
      <span className="workflow-node-label">{data.label}</span>
      <span className="workflow-node-state">
        <i aria-hidden="true" />
        {stepStateLabel(data)}
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
  selectedStepId: string | undefined,
): { edges: Array<Edge>; nodes: Array<WorkflowNode> } {
  const visibleStepIds = new Set(steps.map((step) => step.stepId));
  const columns = Math.min(4, Math.max(1, steps.length));
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
      const row = Math.floor(index / columns);
      const offset = index % columns;
      const column = row % 2 === 0 ? offset : columns - offset - 1;
      const rowEnd = (index + 1) % columns === 0 && index < steps.length - 1;
      const rowStart = index % columns === 0 && index > 0;
      const rowDirection = row % 2 === 0 ? Position.Right : Position.Left;
      return {
        ariaLabel: `${step.stepId}, ${STEP_KIND_LABELS[step.kind]}, ${stepStateLabel(step)}`,
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
        position: { x: column * 224, y: row * 92 },
        selected: step.stepId === selectedStepId,
        type: "workflowStep",
      };
    }),
  };
}

export default function WorkflowGraph({
  miniMap,
  onSelectedStepChange,
  selectedStepId,
}: Readonly<{
  miniMap: RunDetailDTO["miniMap"];
  onSelectedStepChange: (stepId: string | undefined) => void;
  selectedStepId: string | undefined;
}>) {
  if (miniMap.state === "unavailable") {
    return <p className="workflow-unavailable">Workflow topology is unavailable.</p>;
  }
  if (!miniMap.steps.length) {
    return null;
  }
  const selectedStep =
    miniMap.steps.find((step) => step.stepId === selectedStepId) ??
    miniMap.steps.find((step) => step.state === "current") ??
    miniMap.steps[0];
  const { edges, nodes } = graphElements(miniMap.steps, selectedStep?.stepId);

  return (
    <section aria-label="Workflow graph" className="workflow-map">
      <div className="workflow-map-toolbar">
        <p>
          Full workflow · {miniMap.steps.length}
          {miniMap.truncated ? ` of ${miniMap.totalSteps}` : " steps"}
        </p>
      </div>
      <div className="workflow-canvas">
        <ReactFlow
          edges={edges}
          elementsSelectable
          fitView
          fitViewOptions={{ maxZoom: 0.9, minZoom: 0.25, padding: 0.14 }}
          minZoom={0.2}
          nodes={nodes}
          nodesConnectable={false}
          nodesDraggable={false}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) =>
            onSelectedStepChange(node.id === selectedStepId ? undefined : node.id)
          }
          panOnScroll
          proOptions={{ hideAttribution: true }}
        >
          <Background color="var(--border)" gap={18} size={1} variant={BackgroundVariant.Dots} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      {selectedStep ? (
        <section aria-live="polite" className="workflow-step-detail">
          <div className="workflow-step-overview">
            <div className="workflow-step-detail-heading">
              <div>
                <span>Step details</span>
                <h4>{selectedStep.stepId}</h4>
              </div>
              <Badge className={`workflow-state-${stepDataState(selectedStep)}`}>
                {stepStateLabel(selectedStep)}
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
                <dd>{stepStateLabel(selectedStep)}</dd>
              </div>
              <div>
                <dt>Kind</dt>
                <dd>{STEP_KIND_LABELS[selectedStep.kind]}</dd>
              </div>
              {selectedStep.nextStepIds.length ? (
                <div>
                  <dt>Next</dt>
                  <dd>{selectedStep.nextStepIds.join(", ")}</dd>
                </div>
              ) : null}
              {selectedStep.parallelism ? (
                <div>
                  <dt>Parallel work</dt>
                  <dd>
                    {selectedStep.parallelism.count ?? "Dynamic"} {selectedStep.parallelism.mode}
                    {selectedStep.parallelism.maxParallel
                      ? ` · max ${selectedStep.parallelism.maxParallel}`
                      : ""}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </section>
      ) : null}
    </section>
  );
}
