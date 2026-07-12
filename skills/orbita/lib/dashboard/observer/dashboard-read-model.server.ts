/** Immutable last-good dashboard read model with truthful freshness and lossy invalidation. */
import { watch, type FSWatcher } from 'node:fs';
import {
  InvalidationEventSchema,
  SnapshotEnvelopeSchema,
  type InvalidationEvent,
  type ObserverFreshnessDTO,
  type RunDetailDTO,
  type SnapshotEnvelope,
} from '../contracts/browser';

export class ObserverUnavailableError extends Error {
  constructor() { super('Dashboard observer is unavailable'); }
}

type Reader = {
  listRuns(signal?: AbortSignal): Promise<SnapshotEnvelope['runs']>;
  getRun(runId: string, signal?: AbortSignal): Promise<RunDetailDTO | undefined>;
};
type Subscriber = (event: InvalidationEvent) => void;
type Options = {
  runsRoot?: string;
  pollMs?: number;
  staleAfterMs?: number;
  now?: () => Date;
  watchEnabled?: boolean;
  watchCoalesceMs?: number;
  invalidationCoalesceMs?: number;
};

function freezeSnapshot(snapshot: SnapshotEnvelope): SnapshotEnvelope {
  Object.freeze(snapshot.runs);
  Object.freeze(snapshot.freshness);
  return Object.freeze(snapshot);
}

function sameRuns(left: SnapshotEnvelope['runs'] | undefined, right: SnapshotEnvelope['runs']): boolean {
  return left !== undefined && JSON.stringify(left) === JSON.stringify(right);
}

function after(iso: string, delayMs: number): string {
  return new Date(Date.parse(iso) + delayMs).toISOString();
}

export class DashboardReadModel {
  private snapshot?: SnapshotEnvelope;
  private snapshotVersion = 0;
  private observerRevision = 0;
  private activeRefresh?: Promise<void>;
  private refreshAbort?: AbortController;
  private queuedRefresh = false;
  private closed = false;
  private timer?: ReturnType<typeof setInterval>;
  private watcher?: FSWatcher;
  private watchTimer?: ReturnType<typeof setTimeout>;
  private invalidationTimer?: ReturnType<typeof setTimeout>;
  private staleDeadlineTimer?: ReturnType<typeof setTimeout>;
  private lastSnapshotInvalidationAt = 0;
  private pendingSnapshotInvalidation = false;
  private readonly subscribers = new Set<Subscriber>();

  constructor(private readonly reader: Reader, private readonly options: Options = {}) {}

  private get now(): () => Date { return this.options.now ?? (() => new Date()); }
  private get pollMs(): number { return this.options.pollMs ?? 2_000; }
  private get staleAfterMs(): number { return this.options.staleAfterMs ?? 10_000; }

  start(): void {
    if (this.closed || this.timer) return;
    this.timer = setInterval(() => void this.refresh().catch(() => {}), this.pollMs);
    this.timer.unref?.();
    if (this.options.runsRoot && this.options.watchEnabled !== false) {
      try {
        this.watcher = watch(this.options.runsRoot, { persistent: false }, () => {
          if (this.watchTimer) clearTimeout(this.watchTimer);
          this.watchTimer = setTimeout(() => void this.refresh().catch(() => {}), this.options.watchCoalesceMs ?? 100);
          this.watchTimer.unref?.();
        });
      } catch { this.watcher = undefined; }
    }
  }

  subscribe(subscriber: Subscriber): () => void {
    if (this.closed) return () => {};
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  private nextObserverRevision(): string {
    this.observerRevision += 1;
    return String(this.observerRevision);
  }

  private publishNow(reason: InvalidationEvent['reason']): void {
    const event = InvalidationEventSchema.parse({
      schemaVersion: '1',
      type: 'invalidation',
      reason,
      changeId: String(this.observerRevision),
      emittedAt: this.now().toISOString(),
    });
    for (const subscriber of this.subscribers) {
      try { subscriber(event); } catch { /* observers cannot affect refresh */ }
    }
  }

  private publish(reason: InvalidationEvent['reason']): void {
    if (reason !== 'snapshot_changed') {
      if (this.invalidationTimer) clearTimeout(this.invalidationTimer);
      this.invalidationTimer = undefined;
      this.pendingSnapshotInvalidation = false;
      this.publishNow(reason);
      return;
    }
    const coalesceMs = this.options.invalidationCoalesceMs ?? 100;
    const elapsed = Date.now() - this.lastSnapshotInvalidationAt;
    if (elapsed >= coalesceMs && !this.invalidationTimer) {
      this.lastSnapshotInvalidationAt = Date.now();
      this.publishNow(reason);
      return;
    }
    this.pendingSnapshotInvalidation = true;
    if (this.invalidationTimer) return;
    this.invalidationTimer = setTimeout(() => {
      this.invalidationTimer = undefined;
      if (!this.pendingSnapshotInvalidation || this.closed) return;
      this.pendingSnapshotInvalidation = false;
      this.lastSnapshotInvalidationAt = Date.now();
      this.publishNow('snapshot_changed');
    }, Math.max(0, coalesceMs - elapsed));
    this.invalidationTimer.unref?.();
  }

  private scheduleStaleDeadline(): void {
    if (this.staleDeadlineTimer) clearTimeout(this.staleDeadlineTimer);
    this.staleDeadlineTimer = setTimeout(() => this.expireFreshness(), this.staleAfterMs);
    this.staleDeadlineTimer.unref?.();
  }

  private expireFreshness(): void {
    this.staleDeadlineTimer = undefined;
    if (this.closed || !this.snapshot || this.snapshot.freshness.state === 'stale') return;
    const expiredAt = this.now().toISOString();
    const observerRevision = this.nextObserverRevision();
    this.snapshot = freezeSnapshot(SnapshotEnvelopeSchema.parse({
      ...this.snapshot,
      generatedAt: expiredAt,
      freshness: {
        ...this.snapshot.freshness,
        state: 'stale',
        observerRevision,
        staleSince: expiredAt,
        failureCode: 'observer_refresh_timeout',
        retryAt: after(expiredAt, this.pollMs),
      },
    }));
    this.publish('observer_stale');
  }

  async ensureSnapshot(): Promise<SnapshotEnvelope> {
    if (!this.snapshot) await this.refresh();
    if (!this.snapshot) throw new ObserverUnavailableError();
    return this.snapshot;
  }

  async getDetail(runId: string): Promise<RunDetailDTO | undefined> {
    await this.ensureSnapshot();
    return this.reader.getRun(runId);
  }

  refresh(): Promise<void> {
    if (this.closed) return Promise.resolve();
    if (this.activeRefresh) {
      this.queuedRefresh = true;
      return this.activeRefresh;
    }
    this.activeRefresh = this.runRefreshLoop().finally(() => {
      this.activeRefresh = undefined;
      this.refreshAbort = undefined;
    });
    return this.activeRefresh;
  }

  private async runRefreshLoop(): Promise<void> {
    do {
      this.queuedRefresh = false;
      await this.refreshOnce();
    } while (this.queuedRefresh && !this.closed);
  }

  private async refreshOnce(): Promise<void> {
    const attemptedAt = this.now().toISOString();
    this.refreshAbort = new AbortController();
    try {
      const runs = await this.reader.listRuns(this.refreshAbort.signal);
      if (this.closed) return;
      const wasStale = this.snapshot?.freshness.state === 'stale';
      const changed = !sameRuns(this.snapshot?.runs, runs);
      if (changed) this.snapshotVersion += 1;
      const observerRevision = this.nextObserverRevision();
      const freshness: ObserverFreshnessDTO = {
        state: 'fresh',
        observerRevision,
        lastRefreshAttemptAt: attemptedAt,
        lastSuccessfulRefreshAt: attemptedAt,
        staleSince: null,
        staleAfterMs: this.staleAfterMs,
        retryAt: null,
      };
      this.snapshot = freezeSnapshot(SnapshotEnvelopeSchema.parse({
        schemaVersion: '1',
        snapshotVersion: String(this.snapshotVersion || 1),
        generatedAt: attemptedAt,
        freshness,
        runs,
      }));
      this.scheduleStaleDeadline();
      this.publish(wasStale ? 'observer_recovered' : 'snapshot_changed');
    } catch {
      if (this.closed) return;
      if (!this.snapshot) throw new ObserverUnavailableError();
      const previous = this.snapshot.freshness;
      const observerRevision = this.nextObserverRevision();
      this.snapshot = freezeSnapshot(SnapshotEnvelopeSchema.parse({
        ...this.snapshot,
        generatedAt: attemptedAt,
        freshness: {
          state: 'stale',
          observerRevision,
          lastRefreshAttemptAt: attemptedAt,
          lastSuccessfulRefreshAt: previous.lastSuccessfulRefreshAt,
          staleSince: previous.staleSince ?? attemptedAt,
          staleAfterMs: this.staleAfterMs,
          failureCode: 'observer_refresh_failed',
          retryAt: after(attemptedAt, this.pollMs),
        },
      }));
      if (this.staleDeadlineTimer) clearTimeout(this.staleDeadlineTimer);
      this.staleDeadlineTimer = undefined;
      this.publish('observer_stale');
    }
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.queuedRefresh = false;
    this.refreshAbort?.abort();
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.watcher?.close();
    this.watcher = undefined;
    if (this.watchTimer) clearTimeout(this.watchTimer);
    this.watchTimer = undefined;
    if (this.invalidationTimer) clearTimeout(this.invalidationTimer);
    this.invalidationTimer = undefined;
    if (this.staleDeadlineTimer) clearTimeout(this.staleDeadlineTimer);
    this.staleDeadlineTimer = undefined;
    this.pendingSnapshotInvalidation = false;
    this.subscribers.clear();
    await this.activeRefresh?.catch(() => {});
  }
}
