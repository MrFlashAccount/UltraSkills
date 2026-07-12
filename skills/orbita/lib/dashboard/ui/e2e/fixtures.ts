import type {
  DashboardLaneId,
  RunDetailDTO,
  RunSummaryDTO,
  SnapshotEnvelope,
} from '../../contracts/browser';

const lanes: DashboardLaneId[] = [
  'waiting_for_user',
  'worker_running',
  'needs_help',
  'degraded',
  'done',
];
const nonWaiting: DashboardLaneId[] = ['worker_running', 'needs_help', 'degraded', 'done'];
const nonDone: DashboardLaneId[] = ['waiting_for_user', 'worker_running', 'needs_help', 'degraded'];

export function buildSnapshot(
  count = 1_000,
  distribution: 'balanced' | 'waiting' | 'done' = 'balanced',
): SnapshotEnvelope {
  const now = new Date().toISOString();
  const runs = Array.from({ length: count }, (_, index): RunSummaryDTO => {
    const laneId =
      distribution === 'waiting'
        ? index < 900
          ? 'waiting_for_user'
          : nonWaiting[index % nonWaiting.length]
        : distribution === 'done'
          ? index < 900
            ? 'done'
            : nonDone[index % nonDone.length]
          : lanes[index % lanes.length];
    return {
      runId: `run-proof-${index.toString().padStart(4, '0')}`,
      title: {
        sourceClass: 'run_title',
        value:
          index === 0
            ? 'A deliberately extremely long policy-approved title that remains bounded to two lines without forcing card growth'
            : `Observe workflow run ${index}`,
        policyVersion: '1',
      },
      reason: {
        sourceClass: 'public_diagnostic',
        value:
          laneId === 'waiting_for_user'
            ? 'Approval needed'
            : laneId === 'needs_help'
              ? 'Decision missing'
              : laneId === 'degraded'
                ? 'Read health'
                : 'Status update',
        policyVersion: '1',
      },
      workflow: index % 2 ? 'dev-harness' : 'research-critic',
      laneId,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      currentStep: `step_${index}_with_a_bounded_identifier`,
      cursor: { kind: 'single', step: `step-${index}` },
      occupancy: { state: 'unclaimed' },
    };
  });
  return {
    schemaVersion: '1',
    snapshotVersion: '12',
    generatedAt: now,
    freshness: {
      state: 'fresh',
      observerRevision: '12',
      lastRefreshAttemptAt: now,
      lastSuccessfulRefreshAt: now,
      staleSince: null,
      staleAfterMs: 600_000,
      retryAt: null,
    },
    runs,
  };
}

export function detailFor(run: RunSummaryDTO): RunDetailDTO {
  return {
    ...run,
    schemaVersion: '1',
    summary: {
      sourceClass: 'run_summary',
      value: 'Policy-approved summary for rendered proof.',
      policyVersion: '1',
    },
    facts: [{ label: 'Workflow', value: run.workflow }],
    history: [
      { sourceClass: 'history_line', value: 'Snapshot projected', policyVersion: '1' },
      { sourceClass: 'history_line', value: 'Awaiting inspection', policyVersion: '1' },
    ],
    historyTruncated: false,
    artifacts: [{ id: 'implementation-plan', contentType: 'text/markdown' }],
    results: [],
    miniMap: {
      state: 'available',
      steps: [
        { stepId: 'research', state: 'completed' },
        { stepId: 'implementation', state: 'current' },
        { stepId: 'review', state: 'pending' },
      ],
      truncated: false,
      totalSteps: 3,
    },
  };
}
