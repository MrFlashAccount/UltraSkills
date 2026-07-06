export function relativeTimeLabel(value: string | undefined): string {
  if (!value) return 'freshness unknown';
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

export function shortRunId(runId: string): string {
  return runId.length > 18 ? `${runId.slice(0, 10)}...${runId.slice(-6)}` : runId;
}

export function redactControlText(value: string): string {
  return value;
}
