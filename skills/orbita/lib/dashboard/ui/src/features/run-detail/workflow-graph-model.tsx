import type { TraversalPageDTO, WorkflowPageDTO } from "@dashboard-contracts";
import { Handle, Position, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { BadgeCheck, Bot, Check, GitFork, Layers3 } from "lucide-react";

type WorkflowStep = WorkflowPageDTO["nodes"][number];
export type WorkflowStepState = "completed" | "current" | "pending";
type WorkflowNodeData = {
  kind: WorkflowStep["kind"];
  label: string;
  parallelism?: WorkflowStep["parallelism"];
  sourcePosition: Position;
  state: WorkflowStepState;
  targetPosition: Position;
};
export type WorkflowNode = Node<WorkflowNodeData, "workflowStep">;

export const STEP_LABELS: Record<WorkflowStepState, string> = {
  completed: "Completed",
  current: "Current",
  pending: "Pending",
};
export const STEP_KIND_LABELS: Record<WorkflowStep["kind"], string> = {
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

export function WorkflowStepNode({ data, selected }: NodeProps<WorkflowNode>) {
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

export function graphElements(
  steps: WorkflowPageDTO["nodes"],
  declaredEdges: WorkflowPageDTO["edges"],
  occurrences: TraversalPageDTO["items"],
  selectedStepId?: string,
): { edges: Array<Edge>; nodes: Array<WorkflowNode> } {
  const visibleStepIds = new Set(steps.map((step) => step.stepId));
  return {
    edges: declaredEdges.flatMap((edge) =>
      visibleStepIds.has(edge.from) && visibleStepIds.has(edge.to)
        ? [
            {
              id: `${edge.from}->${edge.to}`,
              source: edge.from,
              target: edge.to,
              type: "smoothstep",
            },
          ]
        : [],
    ),
    nodes: steps.map((step, index) => {
      const columns = Math.min(3, Math.max(1, steps.length));
      const row = Math.floor(index / columns);
      const offset = index % columns;
      const column = row % 2 === 0 ? offset : columns - offset - 1;
      const rowEnd = (index + 1) % columns === 0 && index < steps.length - 1;
      const rowStart = index % columns === 0 && index > 0;
      const rowDirection = row % 2 === 0 ? Position.Right : Position.Left;
      const state = stepState(step.stepId, occurrences);
      return {
        ariaLabel: `${step.stepId}, ${STEP_KIND_LABELS[step.kind]}, ${STEP_LABELS[state]}`,
        data: {
          kind: step.kind,
          label: step.stepId,
          parallelism: step.parallelism,
          sourcePosition: rowEnd ? Position.Bottom : rowDirection,
          state,
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

export function stepState(
  stepId: string,
  occurrences: TraversalPageDTO["items"],
): WorkflowStepState {
  const matches = occurrences.filter((occurrence) => occurrence.stepId === stepId);
  return matches.some((occurrence) => occurrence.state === "current")
    ? "current"
    : matches.length
      ? "completed"
      : "pending";
}
