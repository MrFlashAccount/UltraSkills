import type { RunDetailDTO } from "@dashboard-contracts";
import { BadgeCheck, Bot, Check, GitFork, Layers3 } from "lucide-react";

type AvailableMiniMap = Extract<RunDetailDTO["miniMap"], { state: "available" }>;
type WorkflowStep = AvailableMiniMap["steps"][number];

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

export function CurrentRunPath({
  miniMap,
  onSelectedStepChange,
  selectedStepId,
}: Readonly<{
  miniMap: RunDetailDTO["miniMap"];
  onSelectedStepChange: (stepId: string | undefined) => void;
  selectedStepId: string | undefined;
}>) {
  if (miniMap.state === "unavailable") {
    return null;
  }
  const visitedSteps = miniMap.steps
    .filter((step) => step.state !== "pending")
    .sort((left, right) => Number(left.state === "current") - Number(right.state === "current"));
  if (!visitedSteps.length) {
    return null;
  }

  return (
    <section aria-label="Current run path" className="current-run-path">
      <div className="current-run-path-scroll">
        <ol>
          {visitedSteps.map((step) => {
            const KindIcon = STEP_KIND_ICONS[step.kind];
            const stateLabel = step.state === "current" ? "Current" : "Completed";
            return (
              <li key={step.stepId}>
                <button
                  aria-label={`Filter by ${step.stepId}, ${STEP_KIND_LABELS[step.kind]}, ${stateLabel}`}
                  aria-pressed={selectedStepId === step.stepId}
                  data-state={step.state}
                  onClick={() =>
                    onSelectedStepChange(selectedStepId === step.stepId ? undefined : step.stepId)
                  }
                  type="button"
                >
                  <KindIcon aria-hidden="true" size={13} strokeWidth={1.8} />
                  <span>{step.stepId}</span>
                  <i aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
