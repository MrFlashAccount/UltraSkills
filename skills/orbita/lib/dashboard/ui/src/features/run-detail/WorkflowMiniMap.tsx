import type { RunDetailDTO } from "@dashboard-contracts";

type MiniMap = RunDetailDTO["miniMap"];

/** Bounded workflow orientation only; it never implies parallel execution or control. */
export function WorkflowMiniMap({ miniMap }: Readonly<{ miniMap: MiniMap }>) {
  if (miniMap.state === "unavailable") {
    return (
      <section aria-labelledby="workflow-progress-title" className="detail-section workflow-map">
        <h3 id="workflow-progress-title">Workflow progress</h3>
        <p>Workflow progress is unavailable.</p>
      </section>
    );
  }
  return (
    <section aria-labelledby="workflow-progress-title" className="detail-section workflow-map">
      <h3 id="workflow-progress-title">Workflow progress</h3>
      <ol aria-label={`${miniMap.totalSteps} workflow steps`}>
        {miniMap.steps.map((step) => (
          <li
            aria-current={step.state === "current" ? "step" : undefined}
            data-state={step.state}
            key={step.stepId}
          >
            <span aria-hidden="true" className="workflow-step-marker" />
            <span>{step.stepId}</span>
          </li>
        ))}
      </ol>
      {miniMap.truncated ? (
        <p>
          Showing {miniMap.steps.length} of {miniMap.totalSteps} steps.
        </p>
      ) : null}
    </section>
  );
}
