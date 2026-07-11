import { DASHBOARD_LANES } from '../contracts/dashboard-contracts.mjs';
import { buildHistoryExcerpt } from './history-excerpt-policy.mjs';
import { classifyDashboardLane, dashboardLaneLabel } from './lane-classifier.mjs';
import { safeDashboardScalar } from './safe-dashboard-scalar.mjs';

function pruneUndefined(value) {
  for (const key of Object.keys(value)) if (value[key] === undefined) delete value[key];
  return value;
}

function cursorProjection(cursor) {
  const steps = typeof cursor === 'string' ? [safeDashboardScalar(cursor)] : [];
  return {
    kind: 'single',
    steps,
    display: steps.join(''),
  };
}

function occupancyProjection(workerLease, now) {
  if (!workerLease?.leaseExpiresAt) return { state: 'unclaimed' };
  const leaseExpiresAt = workerLease.leaseExpiresAt;
  return {
    state: Date.parse(leaseExpiresAt) > now.getTime() ? 'occupied' : 'stale',
    leaseExpiresAt: safeDashboardScalar(leaseExpiresAt),
  };
}

function artifactProjection(entry) {
  const artifact = entry?.artifact ?? entry;
  return pruneUndefined({
    producerStepId: entry?.producerStepId === undefined ? undefined : safeDashboardScalar(entry.producerStepId),
    id: artifact?.id === undefined ? undefined : safeDashboardScalar(artifact.id),
    contentType: artifact?.content_type === undefined ? undefined : safeDashboardScalar(artifact.content_type),
    summary: artifact?.summary === undefined ? undefined : safeDashboardScalar(artifact.summary),
  });
}

function resultProjection(result) {
  return pruneUndefined({
    type: result?.type === undefined ? undefined : safeDashboardScalar(result.type),
    cursor: result?.cursor === undefined ? undefined : safeDashboardScalar(result.cursor),
    outcome: result?.outcome === undefined ? undefined : safeDashboardScalar(result.outcome),
    summary: result?.summary === undefined ? undefined : safeDashboardScalar(result.summary),
    ref: result?.ref === undefined ? undefined : safeDashboardScalar(result.ref),
  });
}

function stateStepKeys(state) {
  if (!state || typeof state !== 'object') return [];
  return Object.keys(state)
    .filter((key) => !['artifacts', 'results', 'attempts', '$loopProgress', 'shards', 'fanouts'].includes(key))
    .map((key) => safeDashboardScalar(key))
    .sort();
}

function miniMapProjection({ state, cursor }) {
  return {
    currentSteps: cursorProjection(cursor).steps,
    completedSteps: stateStepKeys(state),
    provenance: 'baton.state step outputs and baton.cursor',
  };
}

function baseRunProjection(run, { now = new Date() } = {}) {
  return pruneUndefined({
    runId: safeDashboardScalar(run.runId),
    title: run.title === undefined ? undefined : safeDashboardScalar(run.title),
    summary: run.summary === undefined ? undefined : safeDashboardScalar(run.summary),
    workflow: pruneUndefined({ identity: run.workflow?.identity === undefined ? undefined : safeDashboardScalar(run.workflow.identity) }),
    status: safeDashboardScalar(run.status),
    occupancy: occupancyProjection(run.workerLease, now),
    createdAt: run.createdAt === undefined ? undefined : safeDashboardScalar(run.createdAt),
    updatedAt: run.updatedAt === undefined ? undefined : safeDashboardScalar(run.updatedAt),
  });
}

export function projectDashboardRun({ run, persistedState, degraded }, { now = new Date(), includeDetail = false } = {}) {
  const baton = persistedState?.baton;
  const lane = classifyDashboardLane({ run, baton, degraded, currentRequests: persistedState?.currentRequests });
  const state = baton?.state ?? {};
  const projection = {
    ...baseRunProjection(run, { now }),
    status: safeDashboardScalar(run.status),
    lane: { id: lane, label: dashboardLaneLabel(lane) },
    cursor: cursorProjection(baton?.cursor),
    artifacts: Array.isArray(state.artifacts) ? state.artifacts.map(artifactProjection) : [],
    results: Array.isArray(state.results) ? state.results.map(resultProjection) : [],
    miniMap: miniMapProjection({ state, cursor: baton?.cursor }),
  };
  if (includeDetail) projection.historyExcerpt = buildHistoryExcerpt(persistedState?.history);
  if (degraded) {
    projection.degraded = {
      reason: safeDashboardScalar(degraded.reason),
      message: safeDashboardScalar(degraded.message),
    };
    projection.lane = { id: DASHBOARD_LANES.DEGRADED, label: dashboardLaneLabel(DASHBOARD_LANES.DEGRADED) };
  }
  return projection;
}
