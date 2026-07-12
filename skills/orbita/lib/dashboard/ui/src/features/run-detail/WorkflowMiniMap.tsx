import type { RunDetailDTO } from '@dashboard-contracts';

type MiniMap = RunDetailDTO['miniMap'];

/** Bounded workflow orientation only; it never implies parallel execution or control. */
export function WorkflowMiniMap({ miniMap }: Readonly<{ miniMap: MiniMap }>) {
  if (miniMap.state === 'unavailable') {
    return (
      <section className="detail-section workflow-map" aria-labelledby="workflow-progress-title">
        <h3 id="workflow-progress-title">Workflow progress</h3>
        <p>Workflow progress is unavailable.</p>
      </section>
    );
  }
  return (
    <section className="detail-section workflow-map" aria-labelledby="workflow-progress-title">
      <h3 id="workflow-progress-title">Workflow progress</h3>
      <ol aria-label={`${miniMap.totalSteps} workflow steps`}>
        {miniMap.steps.map((step) => (
          <li
            key={step.stepId}
            data-state={step.state}
            aria-current={step.state === 'current' ? 'step' : undefined}
          >
            <span className="workflow-step-marker" aria-hidden="true" />
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
