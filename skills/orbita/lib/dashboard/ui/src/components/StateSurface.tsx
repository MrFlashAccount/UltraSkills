import type { DashboardLaneId } from '../types/dashboard';
import { dashboardCopy, fallbackLaneId } from '../constants/dashboard';
import styles from './dashboard.module.css';

type StateSurfaceProps = {
  empty: boolean;
  error?: string;
  loading: boolean;
};

export function StateSurface({ empty, error, loading }: StateSurfaceProps) {
  if (loading) return <p className={styles.stateBanner} role="status">Loading dashboard runs</p>;
  if (error) return <p className={`${styles.stateBanner} ${styles.stateBannerWarning}`} role="status">{error}</p>;
  if (empty) return <p className={styles.stateBanner} role="status">{dashboardCopy.emptyResults}</p>;
  return null;
}

export function EmptyLane({ laneId }: { laneId: DashboardLaneId }) {
  const message = laneId === fallbackLaneId ? 'No degraded reads' : dashboardCopy.emptyResults;
  return <p className={styles.laneEmpty}>{message}</p>;
}
