import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDashboardEvents } from './use-dashboard-events';

class EventSourceStub extends EventTarget {
  static instances: EventSourceStub[] = [];
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor() {
    super();
    EventSourceStub.instances.push(this);
  }

  close() {}

  emit(reason: 'snapshot_changed' | 'observer_stale' | 'observer_recovered', changeId: number) {
    const payload = { schemaVersion: '1', type: 'invalidation', reason, changeId: String(changeId), emittedAt: '2026-07-12T12:00:00.000Z' };
    this.dispatchEvent(new MessageEvent('invalidation', { data: JSON.stringify(payload), lastEventId: String(changeId) }));
  }
}

function withClient(client: QueryClient) {
  return function Wrapper({ children }: Readonly<{ children: ReactNode }>) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

afterEach(() => {
  EventSourceStub.instances = [];
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useDashboardEvents', () => {
  it('seeds ordering from authoritative freshness and ignores delayed or duplicate events', () => {
    vi.stubGlobal('EventSource', EventSourceStub);
    const client = new QueryClient();
    const { result, rerender } = renderHook(
      ({ changeId, state }) => useDashboardEvents({ changeId, state }),
      { initialProps: { changeId: '5', state: 'fresh' as const }, wrapper: withClient(client) },
    );
    const source = EventSourceStub.instances[0];
    act(() => source.emit('observer_stale', 4));
    expect(result.current.observerStale).toBe(false);
    act(() => source.emit('observer_stale', 6));
    expect(result.current.observerStale).toBe(true);
    act(() => source.emit('observer_recovered', 7));
    expect(result.current.observerStale).toBe(true);
    rerender({ changeId: '8', state: 'fresh' as const });
    expect(result.current.observerStale).toBe(false);
  });

  it('coalesces a burst into one snapshot-and-active-detail invalidation per 100ms', () => {
    vi.useFakeTimers();
    vi.stubGlobal('EventSource', EventSourceStub);
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    renderHook(() => useDashboardEvents({ changeId: '1', state: 'fresh' }, 'run-1'), { wrapper: withClient(client) });
    const source = EventSourceStub.instances[0];
    act(() => {
      for (let changeId = 2; changeId <= 101; changeId += 1) source.emit('snapshot_changed', changeId);
      vi.advanceTimersByTime(100);
    });
    expect(invalidate).toHaveBeenCalledTimes(1);
    const predicate = invalidate.mock.calls[0][0]?.predicate;
    expect(predicate?.({ queryKey: ['dashboard', 'snapshot', 'v1'] } as never)).toBe(true);
    expect(predicate?.({ queryKey: ['dashboard', 'run-detail', 'run-1'] } as never)).toBe(true);
    expect(predicate?.({ queryKey: ['dashboard', 'run-detail', 'run-2'] } as never)).toBe(false);
  });
});
