import styles from '../DashboardApp.module.css';

export function CursorChips({ cursorBranches, scope }: { cursorBranches: string[]; scope: string }) {
  if (cursorBranches.length === 0) return null;
  return (
    <div className={styles.cursorChips} aria-label={`Active cursor branches ${scope}`}>
      {cursorBranches.map((branch) => (
        <span className={styles.cursorChip} key={branch}><code>{branch}</code></span>
      ))}
    </div>
  );
}
