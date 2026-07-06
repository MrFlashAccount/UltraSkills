import { Button } from 'react-aria-components';
import styles from '../DashboardApp.module.css';

export function LoadingState() {
  return (
    <main className={styles.dashboard} data-dashboard-runtime="tanstack-start" data-read-only="true" aria-busy="true">
      <section className={styles.statePanel} role="status">
        <h1>Orbita Dashboard</h1>
        <p>Loading runs...</p>
      </section>
    </main>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <main className={styles.dashboard} data-dashboard-runtime="tanstack-start" data-read-only="true">
      <section className={styles.statePanel}>
        <h1>Orbita Dashboard</h1>
        <p>{message}</p>
      </section>
    </main>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className={styles.dashboard} data-dashboard-runtime="tanstack-start" data-read-only="true">
      <section className={styles.statePanel} role="alert">
        <h1>Orbita Dashboard</h1>
        <p>{message}</p>
        <Button className={styles.retryButton} onPress={onRetry}>Refresh</Button>
      </section>
    </main>
  );
}

export function DegradedBanner({ message, onRefresh }: { message: string; onRefresh: () => void }) {
  return (
    <section className={styles.degradedBanner} role="alert">
      <p>{message}</p>
      <Button className={styles.retryButton} onPress={onRefresh}>Refresh</Button>
    </section>
  );
}
