import type { DashboardLaneId } from '@dashboard-contracts';
import { Badge } from '@/components/ui/badge';

export function AttentionSummary({ counts }: Readonly<{ counts: Record<DashboardLaneId, number> }>) {
  const total = counts.waiting_for_user + counts.needs_help + counts.degraded;
  return <section className="attention-summary" aria-label="Attention summary"><strong>Needs attention · {total}</strong><Badge className="tone-waiting">Waiting {counts.waiting_for_user}</Badge><Badge className="tone-needs-help">Needs help {counts.needs_help}</Badge><Badge className="tone-degraded">Degraded {counts.degraded}</Badge></section>;
}
