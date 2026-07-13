import { useEffect, useState } from "react";

/** Keeps stale-window truth moving even when an HTTP refresh hangs indefinitely. */
export function useFreshnessNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
