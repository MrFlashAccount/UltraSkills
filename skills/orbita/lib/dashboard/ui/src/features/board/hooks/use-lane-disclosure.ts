import { useEffect, useRef, useState } from 'react';

/** Reveals the first attention arrival, then preserves explicit mobile disclosure choices. */
export function useLaneDisclosure(attention: boolean, runCount: number, desktop: boolean | undefined) {
  const [open, setOpen] = useState(attention && runCount > 0);
  const userControlled = useRef(false);
  const previousCount = useRef(runCount);
  useEffect(() => {
    if (attention && previousCount.current === 0 && runCount > 0 && !userControlled.current) setOpen(true);
    previousCount.current = runCount;
  }, [attention, runCount]);
  return {
    expanded: desktop !== false || open,
    setExpanded(next: boolean) {
      if (desktop === false) {
        userControlled.current = true;
        setOpen(next);
      }
    },
  };
}
