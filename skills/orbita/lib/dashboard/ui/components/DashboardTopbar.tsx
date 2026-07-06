import { Input, Label, SearchField } from 'react-aria-components';
import styles from '../DashboardApp.module.css';

type DashboardTopbarProps = {
  rootLabel: string;
  freshnessLabel: string;
  runCount: number;
  query: string;
  onQueryChange: (query: string) => void;
};

export function DashboardTopbar({
  rootLabel,
  freshnessLabel,
  runCount,
  query,
  onQueryChange,
}: DashboardTopbarProps) {
  return (
    <header className={styles.topbar} aria-label="Dashboard status">
      <div>
        <p className={styles.eyebrow}>Orbita runs</p>
        <h1>Read-only workflow board</h1>
      </div>
      <div className={styles.topbarMeta}>
        <span className={styles.sourcePill} title={rootLabel}>{rootLabel}</span>
        <SearchField className={styles.searchField} value={query} onChange={onQueryChange}>
          <Label>Search</Label>
          <Input placeholder="Filter runs" />
        </SearchField>
        <span className={styles.freshness} role="status">{freshnessLabel}</span>
        <span className={styles.runCount}>{runCount} runs</span>
      </div>
    </header>
  );
}
