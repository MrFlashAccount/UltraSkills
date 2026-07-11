import { DASHBOARD_LANES } from '../contracts/dashboard-contracts.mjs';

const USER_WAITING_STEP = /(user|human|approval|approve|clarification|gate)/i;

function hasUnresolvedRecoverableBlocker(baton) {
  const blockers = baton?.recoverableWorkerBlockers;
  if (!blockers || typeof blockers !== 'object' || Array.isArray(blockers)) return false;
  return Object.values(blockers).some((blocker) => {
    if (!blocker || typeof blocker !== 'object' || Array.isArray(blocker)) return true;
    return !blocker.resolution;
  });
}

export function classifyDashboardLane({ run, baton, degraded } = {}) {
  if (degraded) return DASHBOARD_LANES.DEGRADED;
  if (baton?.status === 'done' || run?.status === 'done') return DASHBOARD_LANES.DONE;
  if (hasUnresolvedRecoverableBlocker(baton)) return DASHBOARD_LANES.BLOCKED;
  if (typeof baton?.cursor === 'string' && USER_WAITING_STEP.test(baton.cursor)) {
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
