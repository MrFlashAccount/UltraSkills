import { Button } from "@/components/ui/button";
import { useWorkflowStepArtifactPages } from "./hooks/use-run-inspection-queries";
import { toRunArtifactItems } from "./selectors/artifact-selectors";
import { PagingFailure } from "./states/PanelStates";
import { isStaleLocatorError } from "./hooks/query-client";

type WorkflowStepArtifactsProps = {
  runId: string;
  stepId: string;
};

/** Independently paged workflow-step descriptors; occurrence selection never enters this query. */
export function WorkflowStepArtifacts({ runId, stepId }: WorkflowStepArtifactsProps) {
  const query = useWorkflowStepArtifactPages(runId, stepId);
  const artifacts = toRunArtifactItems(runId, query.data?.pages);
  const stale = isStaleLocatorError(query.error);
  const aggregateCount = query.data?.pages[0]?.runAggregateCount ?? 0;

  return (
    <div className="workflow-step-artifacts">
      <div className="workflow-step-artifacts-heading">
        <h5>Artifacts</h5>
        <span>
          {artifacts.length} of {aggregateCount} run artifacts
        </span>
      </div>
      {query.isPending ? (
        <p aria-busy="true">Loading workflow-step artifacts…</p>
      ) : query.isError && artifacts.length === 0 ? (
        <PagingFailure
          onRetry={() => void query.refetch()}
          resource="Workflow-step artifacts"
          stale={stale}
        />
      ) : artifacts.length ? (
        <>
          <ul aria-label={`Artifacts produced by ${stepId}`}>
            {artifacts.map((artifact) => (
              <li key={artifact.key}>
                <span>
                  <code>{artifact.id}</code>
                  <small>{artifact.producerLabel}</small>
                </span>
                <span>
                  {artifact.effectiveContentType}
                  {!artifact.artifactRef ? " · content unavailable" : ""}
                </span>
              </li>
            ))}
          </ul>
          {query.isError ? (
            <PagingFailure
              onRetry={() => void query.refetch()}
              resource="Workflow-step artifacts"
              stale={stale}
            />
          ) : query.hasNextPage || query.isFetchingNextPage ? (
            <Button
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
              variant="quiet"
            >
              {query.isFetchingNextPage ? "Loading…" : "Load more artifacts"}
            </Button>
          ) : (
            <p className="panel-end">End of workflow-step artifacts</p>
          )}
        </>
      ) : (
        <p>No public artifacts are associated with this step.</p>
      )}
    </div>
  );
}
