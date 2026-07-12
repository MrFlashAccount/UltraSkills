import { Tooltip } from 'radix-ui';
import type { ReactNode } from 'react';

/** Global accessible-overlay providers. Query is installed by the router SSR integration. */
export function AppProviders({ children }: Readonly<{ children: ReactNode }>) {
  return <Tooltip.Provider delayDuration={350}>{children}</Tooltip.Provider>;
}
