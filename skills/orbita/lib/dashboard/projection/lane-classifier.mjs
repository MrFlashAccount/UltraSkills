import { DASHBOARD_LANES } from '../contracts/dashboard-contracts.mjs';

const USER_WAITING_STEP = /(user|human|approval|approve|clarification|gate)/i;

function hasUnresolvedNonBlockingStop(baton) {
  const stops = baton?.nonBlockingStops;
  if (!stops || typeof stops !== 'object' || Array.isArray(stops)) return false;
  return Object.values(stops).some((stop) => {
    if (!stop || typeof stop !== 'object' || Array.isArray(stop)) return true;
    return !stop.resolution;
  });
}

export function classifyDashboardLane({ run, baton, degraded } = {}) {
  if (degraded) return DASHBOARD_LANES.DEGRADED;
  if (baton?.status === 'done' || run?.status === 'done') return DASHBOARD_LANES.DONE;
  if (hasUnresolvedNonBlockingStop(baton)) return DASHBOARD_LANES.NEEDS_HELP;
  if (typeof baton?.cursor === 'string' && USER_WAITING_STEP.test(baton.cursor)) {
    return DASHBOARD_LANES.WAITING_FOR_USER;
  }
  return DASHBOARD_LANES.WORKER_RUNNING;
}

export function dashboardLaneLabel(lane) {
  return {
    [DASHBOARD_LANES.WAITING_FOR_USER]: 'Waiting for user',
    [DASHBOARD_LANES.WORKER_RUNNING]: 'Worker running',
    [DASHBOARD_LANES.NEEDS_HELP]: 'Needs help',
    [DASHBOARD_LANES.DEGRADED]: 'Degraded',
    [DASHBOARD_LANES.DONE]: 'Done',
  }[lane] ?? 'Worker running';
}
