const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "medium",
});
const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
  style: "narrow",
});

export function formatDateTime(value?: string): string {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp)
    ? dateTimeFormatter.format(timestamp)
    : (value ?? "Unknown time");
}

export function isDateTime(value?: string): value is string {
  return value !== undefined && Number.isFinite(Date.parse(value));
}

export function formatRelativeTime(value?: string, now = Date.now()): string {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(timestamp)) {
    return "Unknown time";
  }
  const deltaSeconds = (timestamp - now) / 1000;
  const absoluteSeconds = Math.abs(deltaSeconds);
  const [divisor, unit]: [number, Intl.RelativeTimeFormatUnit] =
    absoluteSeconds < 60
      ? [1, "second"]
      : absoluteSeconds < 3600
        ? [60, "minute"]
        : absoluteSeconds < 172_800
          ? [3600, "hour"]
          : [86_400, "day"];
  return relativeTimeFormatter.format(Math.round(deltaSeconds / divisor), unit);
}

export function shortRunId(runId: string): string {
  return runId.length <= 18 ? runId : `${runId.slice(0, 10)}…${runId.slice(-5)}`;
}
