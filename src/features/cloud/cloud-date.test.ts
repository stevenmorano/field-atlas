import { describe, expect, it } from "vitest";

import { formatCloudRelativeTime, formatCloudUpdatedAt } from "@/features/cloud/cloud-date";

const NOW = Date.parse("2026-08-14T16:00:00.000Z");

describe("cloud date formatting", () => {
  it("formats recent cloud updates as minutes ago", () => {
    expect(formatCloudRelativeTime(NOW - 10 * 60 * 1_000, NOW, "en-US")).toBe("10 minutes ago");
  });

  it("formats older cloud updates as hours ago", () => {
    expect(formatCloudRelativeTime(NOW - 5 * 60 * 60 * 1_000, NOW, "en-US")).toBe("5 hours ago");
  });

  it("includes the exact local timestamp with the relative label", () => {
    expect(formatCloudUpdatedAt(NOW - 10 * 60 * 1_000, NOW, "en-US")).toMatch(/Aug 14, 2026.* · 10 minutes ago/);
  });
});
