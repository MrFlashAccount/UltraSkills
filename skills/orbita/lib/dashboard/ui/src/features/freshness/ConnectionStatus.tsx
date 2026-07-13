import { Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { FreshnessView } from "./freshness-selector";

export function ConnectionStatus({ freshness }: Readonly<{ freshness: FreshnessView }>) {
  const Icon = freshness.unhealthy ? WifiOff : Wifi;
  return (
    <Badge
      aria-live="polite"
      className={freshness.unhealthy ? "connection-status unhealthy" : "connection-status"}
      role="status"
      title={freshness.detail}
    >
      <Icon aria-hidden="true" size={13} />
      {freshness.label}
    </Badge>
  );
}
