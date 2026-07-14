import { useQueryClient } from "@tanstack/react-query";
import { InvalidationEventSchema } from "@dashboard-contracts";
import { useEffect, useRef, useState } from "react";
import { snapshotQueryKey } from "@/features/board/hooks/use-snapshot-query";

export type TransportState = "connecting" | "connected" | "disconnected";
const detailQueryPrefix = ["dashboard", "2"] as const;

/** One EventSource owns invalidation; events are data-free and refetches coalesce to 100ms. */
export function useDashboardEvents(
  authoritative?: { changeId: string; state: "fresh" | "stale" },
  activeRunId?: string,
) {
  const queryClient = useQueryClient();
  const [transport, setTransport] = useState<TransportState>("connecting");
  const [staleHintChangeId, setStaleHintChangeId] = useState<bigint | undefined>(undefined);
  const [reconciliation, setReconciliation] = useState(0);
  const lastChangeId = useRef(0n);
  const activeRunIdRef = useRef(activeRunId);
  const transportRef = useRef<TransportState>("connecting");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const authoritativeChangeId = authoritative ? parseChangeId(authoritative.changeId) : undefined;
  const observerStale =
    authoritative?.state === "stale" ||
    (staleHintChangeId !== undefined &&
      (authoritativeChangeId === undefined || staleHintChangeId > authoritativeChangeId));

  useEffect(() => {
    activeRunIdRef.current = activeRunId;
  }, [activeRunId]);

  useEffect(() => {
    if (authoritativeChangeId !== undefined && authoritativeChangeId > lastChangeId.current) {
      lastChangeId.current = authoritativeChangeId;
    }
  }, [authoritativeChangeId]);

  useEffect(() => {
    const source = new EventSource("/api/dashboard/v2/events");
    const invalidate = () => {
      if (timer.current) {
        return;
      }
      timer.current = setTimeout(() => {
        timer.current = undefined;
        const selectedRunId = activeRunIdRef.current;
        void queryClient.invalidateQueries({
          predicate: ({ queryKey }) =>
            sameQueryKey(queryKey, snapshotQueryKey) ||
            Boolean(
              selectedRunId &&
              queryKey[0] === detailQueryPrefix[0] &&
              queryKey[1] === detailQueryPrefix[1] &&
              queryKey[2] === selectedRunId,
            ),
        });
      }, 100);
    };
    source.onopen = () => {
      if (transportRef.current === "disconnected") {
        setReconciliation((value) => value + 1);
      }
      transportRef.current = "connected";
      setTransport("connected");
      invalidate();
    };
    source.onerror = () => {
      transportRef.current = "disconnected";
      setTransport("disconnected");
    };
    const receive = (message: MessageEvent) => {
      const parsed = InvalidationEventSchema.safeParse(parseEventData(message.data));
      if (!parsed.success) {
        return;
      }
      const changeId = parseChangeId(parsed.data.changeId);
      if (changeId === undefined || changeId <= lastChangeId.current) {
        return;
      }
      lastChangeId.current = changeId;
      if (parsed.data.reason === "observer_stale" || parsed.data.reason === "observer_recovered") {
        setStaleHintChangeId(changeId);
      }
      invalidate();
    };
    source.addEventListener("invalidation", receive);
    return () => {
      source.close();
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [queryClient]);

  return { observerStale, reconciliation, transport };
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

function sameQueryKey(actual: ReadonlyArray<unknown>, expected: ReadonlyArray<unknown>) {
  return (
    actual.length === expected.length && actual.every((value, index) => value === expected[index])
  );
}
