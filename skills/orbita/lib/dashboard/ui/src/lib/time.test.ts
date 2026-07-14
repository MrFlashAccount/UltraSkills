import { describe, expect, test } from "bun:test";
import { formatDateTime, formatRelativeTime } from "./time";

const timestamp = "2026-07-14T11:10:13.727Z";
const expectedDateTime = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "medium",
}).format(Date.parse(timestamp));
const expectedRelativeTime = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
  style: "narrow",
}).format(-3, "hour");

describe("localized dashboard time", () => {
  test("formats absolute time with the runtime locale", () => {
    expect(formatDateTime(timestamp)).toBe(expectedDateTime);
    expect(formatDateTime(timestamp)).not.toContain("T");
  });

  test("formats relative time with the runtime locale", () => {
    const now = Date.parse("2026-07-14T14:10:13.727Z");
    expect(formatRelativeTime(timestamp, now)).toBe(expectedRelativeTime);
  });

  test("preserves an explicit unavailable-time label", () => {
    expect(formatDateTime("Time unavailable")).toBe("Time unavailable");
  });
});
