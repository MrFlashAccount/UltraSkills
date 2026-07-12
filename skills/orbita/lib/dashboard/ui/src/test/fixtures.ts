import type { DashboardLaneId, RunDetailDTO, RunSummaryDTO, SnapshotEnvelope } from '@dashboard-contracts';

const timestamp = '2026-07-12T12:00:00.000Z';

export function makeRun(index = 1, laneId: DashboardLaneId = 'waiting_for_user'): RunSummaryDTO {
  return {
    runId: `run-${index}`,
    title: { sourceClass: 'run_title', value: `Run ${index} needs attention`, policyVersion: '1' },
    reason: { sourceClass: 'public_diagnostic', value: laneId === 'waiting_for_user' ? 'Approval needed' : 'Status update', policyVersion: '1' },
    workflow: index % 2 ? 'dev-harness' : 'research',
    laneId,
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp,
    currentStep: `step-${index}`,
    cursor: { kind: 'single', step: `step-${index}` },
    occupancy: { state: 'unclaimed' },
  };
}

export function makeSnapshot(runs: RunSummaryDTO[]): SnapshotEnvelope {
  return { schemaVersion: '1', snapshotVersion: '1', generatedAt: timestamp, freshness: { state: 'fresh', observerRevision: '1', lastRefreshAttemptAt: timestamp, lastSuccessfulRefreshAt: timestamp, staleSince: null, staleAfterMs: 10_000, retryAt: null }, runs };
}

export function makeDetail(run = makeRun()): RunDetailDTO {
  return { ...run, schemaVersion: '1', summary: { sourceClass: 'run_summary', value: 'A bounded public summary.', policyVersion: '1' }, facts: [{ label: 'Workflow', value: 'dev-harness' }], history: [{ sourceClass: 'history_line', value: 'Awaiting approval', policyVersion: '1' }], historyTruncated: false, artifacts: [{ id: 'ui-design-proposal', contentType: 'text/html' }], results: [], miniMap: { state: 'available', steps: [{ stepId: 'research', state: 'completed' }, { stepId: 'implementation', state: 'current' }], truncated: false, totalSteps: 2 } };
}
