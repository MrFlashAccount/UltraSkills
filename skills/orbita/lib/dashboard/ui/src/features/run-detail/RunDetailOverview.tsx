import type { RunLightDetailDTO } from "@dashboard-contracts";
import { Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatRelativeTime } from "@/lib/time";

export function RunDetailOverview({ detail }: Readonly<{ detail: RunLightDetailDTO }>) {
  const run = detail.run;
  const updatedAt = run.updatedAt ?? run.createdAt;
  return (
    <section aria-label="Run summary" className="detail-overview">
      <dl className="detail-overview-facts">
        <div>
          <dt>Workflow</dt>
          <dd>{run.workflow}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <Badge className={`tone-${run.laneId}`}>
              {run.reason?.value ?? run.status ?? run.laneId}
            </Badge>
          </dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>
            <Clock3 aria-hidden="true" size={14} />
            <time dateTime={updatedAt} suppressHydrationWarning title={formatDateTime(updatedAt)}>
              {formatRelativeTime(updatedAt)}
            </time>
          </dd>
        </div>
      </dl>
      <p>{detail.summary?.value ?? "No additional summary is available."}</p>
    </section>
  );
}
