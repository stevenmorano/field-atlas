import { describe, expect, it } from "vitest";

import {
  decideCloudSave,
  isCloudVersionAcknowledged,
  type ExistingCloudRevision,
} from "@/features/cloud/cloud-save-guard";

const currentRevision: ExistingCloudRevision = {
  id: "revision-1",
  revisionNumber: 3,
  contentFingerprint: "a".repeat(64),
  createdAt: 1_000,
};

describe("decideCloudSave", () => {
  it("treats the same fingerprint as an idempotent no-op", () => {
    expect(decideCloudSave(currentRevision, currentRevision.contentFingerprint, 1_001)).toEqual({
      status: "unchanged",
      revision: currentRevision,
    });
  });

  it("rate-limits a different checkpoint during the cooldown", () => {
    expect(decideCloudSave(currentRevision, "b".repeat(64), 10_000)).toEqual({
      status: "rate-limited",
      waitMs: 21_000,
    });
  });

  it("allows a different checkpoint after the cooldown", () => {
    expect(decideCloudSave(currentRevision, "b".repeat(64), 31_000)).toEqual({ status: "allow" });
  });
});

describe("isCloudVersionAcknowledged", () => {
  const acknowledgement = {
    userId: "user-1",
    remoteRevisionId: "revision-3",
    localUpdatedAt: 42,
  } as const;

  it("recognizes the local version that produced the current cloud revision", () => {
    expect(isCloudVersionAcknowledged(acknowledgement, "user-1", "revision-3", 42)).toBe(true);
  });

  it("does not hide a real local edit or another account's checkpoint", () => {
    expect(isCloudVersionAcknowledged(acknowledgement, "user-1", "revision-3", 43)).toBe(false);
    expect(isCloudVersionAcknowledged(acknowledgement, "user-2", "revision-3", 42)).toBe(false);
    expect(isCloudVersionAcknowledged(acknowledgement, "user-1", "revision-4", 42)).toBe(false);
  });
});
