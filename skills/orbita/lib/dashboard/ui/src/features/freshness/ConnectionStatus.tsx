import { Wifi, WifiOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { FreshnessView } from './freshness-selector';

export function ConnectionStatus({ freshness }: Readonly<{ freshness: FreshnessView }>) {
  const Icon = freshness.unhealthy ? WifiOff : Wifi;
  return <Badge className={freshness.unhealthy ? 'connection-status unhealthy' : 'connection-status'} title={freshness.detail} role="status" aria-live="polite"><Icon aria-hidden="true" size={13} />{freshness.label}</Badge>;
}
