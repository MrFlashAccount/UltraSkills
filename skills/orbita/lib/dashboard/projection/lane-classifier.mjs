import { DASHBOARD_LANES } from '../contracts/dashboard-contracts.mjs';

function hasUnresolvedRecoverableBlocker(baton) {
  const blockers = baton?.recoverableWorkerBlockers;
  if (!blockers || typeof blockers !== 'object' || Array.isArray(blockers)) return false;
  return Object.values(blockers).some((blocker) => {
    if (!blocker || typeof blocker !== 'object' || Array.isArray(blocker)) return true;
    return !blocker.resolution;
  });
}

export function classifyDashboardLane({ run, baton, degraded, currentRequests } = {}) {
  if (degraded) return DASHBOARD_LANES.DEGRADED;
  if (run?.status === 'done') return DASHBOARD_LANES.DONE;
  if (run?.status === 'failed') return DASHBOARD_LANES.BLOCKED;
  if (hasUnresolvedRecoverableBlocker(baton)) return DASHBOARD_LANES.BLOCKED;
  if (Array.isArray(currentRequests) && currentRequests.some((request) => request?.action === 'wait_for_approval')) {
    return DASHBOARD_LANES.WAITING_FOR_USER;
  }
  return DASHBOARD_LANES.WORKER_RUNNING;
}

export function dashboardLaneLabel(lane) {
  return {
    [DASHBOARD_LANES.WAITING_FOR_USER]: 'Waiting for user',
    [DASHBOARD_LANES.WORKER_RUNNING]: 'Worker running',
    [DASHBOARD_LANES.BLOCKED]: 'Blocked',
    [DASHBOARD_LANES.DEGRADED]: 'Degraded',
    [DASHBOARD_LANES.DONE]: 'Done',
  }[lane] ?? 'Worker running';
}
