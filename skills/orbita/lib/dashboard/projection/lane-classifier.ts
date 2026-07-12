/** Closed lane classification over durable workflow facts plus observer degradation. */
import type { DashboardLaneId } from '../contracts/browser';

const USER_WAITING_STEP = /(user|human|approval|approve|clarification|gate)/iu;

function hasUnresolvedNonBlockingStop(baton: any): boolean {
  const stops = baton?.nonBlockingStops;
  if (!stops || typeof stops !== 'object' || Array.isArray(stops)) return false;
  return Object.values(stops).some((stop: any) => !stop || typeof stop !== 'object' || Array.isArray(stop) || !stop.resolution);
}

export function classifyDashboardLane({ run, baton, degraded = false, unsupportedCursor = false }: any): DashboardLaneId {
  if (degraded || unsupportedCursor) return 'degraded';
  if (baton?.status === 'done' || run?.status === 'done') return 'done';
  if (hasUnresolvedNonBlockingStop(baton)) return 'needs_help';
  if (typeof baton?.cursor === 'string' && USER_WAITING_STEP.test(baton.cursor)) return 'waiting_for_user';
  return 'worker_running';
}
