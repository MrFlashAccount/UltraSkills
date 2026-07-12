import { useQueryClient } from '@tanstack/react-query';
import { InvalidationEventSchema } from '@dashboard-contracts';
import { useEffect, useRef, useState } from 'react';
import { snapshotQueryKey } from '@/features/board/hooks/use-snapshot-query';

export type TransportState = 'connecting' | 'connected' | 'disconnected';
const detailQueryPrefix = ['dashboard', 'run-detail'] as const;

/** One EventSource owns invalidation; events are data-free and refetches coalesce to 100ms. */
export function useDashboardEvents(
  authoritative?: { changeId: string; state: 'fresh' | 'stale' },
  activeRunId?: string,
) {
  const queryClient = useQueryClient();
  const [transport, setTransport] = useState<TransportState>('connecting');
  const [observerStale, setObserverStale] = useState(false);
  const [reconciliation, setReconciliation] = useState(0);
  const lastChangeId = useRef(0n);
  const staleChangeId = useRef<bigint | undefined>(undefined);
  const activeRunIdRef = useRef(activeRunId);
  const transportRef = useRef<TransportState>('connecting');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  activeRunIdRef.current = activeRunId;

  useEffect(() => {
    if (!authoritative) return;
    const changeId = parseChangeId(authoritative.changeId);
    if (changeId === undefined) return;
    if (changeId > lastChangeId.current) lastChangeId.current = changeId;
    if (authoritative.state === 'stale') {
      staleChangeId.current = changeId;
      setObserverStale(true);
    } else if (staleChangeId.current === undefined || changeId >= staleChangeId.current) {
      staleChangeId.current = undefined;
      setObserverStale(false);
    }
  }, [authoritative?.changeId, authoritative?.state]);

  useEffect(() => {
    const source = new EventSource('/api/dashboard/v1/events');
    const invalidate = () => {
      if (timer.current) return;
      timer.current = setTimeout(() => {
        timer.current = undefined;
        const selectedRunId = activeRunIdRef.current;
        void queryClient.invalidateQueries({
          predicate: ({ queryKey }) =>
            sameQueryKey(queryKey, snapshotQueryKey) ||
            Boolean(selectedRunId && sameQueryKey(queryKey, [...detailQueryPrefix, selectedRunId])),
        });
      }, 100);
    };
    source.onopen = () => {
      if (transportRef.current === 'disconnected') {
        setReconciliation((value) => value + 1);
      }
      transportRef.current = 'connected';
      setTransport('connected');
      invalidate();
    };
    source.onerror = () => {
      transportRef.current = 'disconnected';
      setTransport('disconnected');
    };
    const receive = (message: MessageEvent) => {
      const parsed = InvalidationEventSchema.safeParse(parseEventData(message.data));
      if (!parsed.success) return;
      const changeId = parseChangeId(parsed.data.changeId);
      if (changeId === undefined || changeId <= lastChangeId.current) return;
      lastChangeId.current = changeId;
      if (parsed.data.reason === 'observer_stale') {
        staleChangeId.current = changeId;
        setObserverStale(true);
      }
      if (parsed.data.reason === 'observer_recovered') {
        staleChangeId.current = changeId;
        setObserverStale(true);
      }
      invalidate();
    };
    source.addEventListener('invalidation', receive);
    return () => {
      source.close();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [queryClient]);

  return { transport, observerStale, reconciliation };
}

function parseChangeId(value: string) {
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

function parseEventData(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function sameQueryKey(actual: readonly unknown[], expected: readonly unknown[]) {
  return (
    actual.length === expected.length && actual.every((value, index) => value === expected[index])
  );
}
