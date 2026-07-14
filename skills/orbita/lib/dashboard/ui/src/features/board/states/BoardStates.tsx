import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function BoardLoading() {
  return (
    <>
      <header aria-busy="true" aria-label="Loading dashboard controls" className="toolbar">
        <div className="brand">
          <span aria-hidden="true" className="orb" />
          <h1>Orbita runs</h1>
          <span className="read-only">Read only</span>
        </div>
        <div className="state-toolbar-controls">
          <Skeleton className="state-toolbar-search" />
          <Skeleton className="state-toolbar-action" />
          <Skeleton className="state-toolbar-status" />
        </div>
      </header>
      <section aria-busy="true" aria-label="Loading runs" className="state-board">
        {Array.from({ length: 5 }, (_, lane) => (
          <div className="state-lane" key={lane}>
            <Skeleton />
            <Skeleton />
          </div>
        ))}
      </section>
    </>
  );
}

export function SnapshotError({ onRetry }: Readonly<{ onRetry: () => void }>) {
  return (
    <main className="state-surface" role="alert">
      <CircleAlert aria-hidden="true" />
      <h2>Could not load runs</h2>
      <p>The observer did not return a usable snapshot.</p>
      <Button onClick={onRetry}>Try again</Button>
    </main>
  );
}

export function EmptyRoot({ onRetry }: Readonly<{ onRetry: () => void }>) {
  return (
    <main className="state-surface">
      <h2>Runs root is not configured</h2>
      <p>Configure the Orbita runs root on the server, then try again.</p>
      <Button onClick={onRetry}>Try again</Button>
    </main>
  );
}

export function EmptyBoard() {
  return (
    <main className="state-surface">
      <h2>No runs yet</h2>
      <p>Runs will appear here when the observer discovers them.</p>
    </main>
  );
}

export function NoMatches({ onClear }: Readonly<{ onClear: () => void }>) {
  return (
    <section className="no-matches" role="status">
      <div>
        <h2>No runs match these filters</h2>
        <p>Clear the filters to return to the full board.</p>
      </div>
      <Button onClick={onClear}>Clear filters</Button>
    </section>
  );
}
