export function formatAge(value?: string, now = Date.now()): string {
  if (!value) {
    return "unknown";
  }
  const elapsed = Math.max(0, now - Date.parse(value));
  if (!Number.isFinite(elapsed)) {
    return "unknown";
  }
  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 10) {
    return "now";
  }
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  return hours < 48 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

export function shortRunId(runId: string): string {
  return runId.length <= 18 ? runId : `${runId.slice(0, 10)}…${runId.slice(-5)}`;
}
