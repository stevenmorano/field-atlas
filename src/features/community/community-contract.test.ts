import { describe, expect, it } from "vitest";

import {
  parseProfileUpdate,
  parseModerationRequest,
  parsePublishMapRequest,
  parseReportRequest,
  publicationModerationLabel,
  publicationMatchesSettings,
  type OwnerPublication,
} from "@/features/community/community-contract";

const requestId = "9d1196b7-5477-4a86-8f85-a51d2989659f";
const shareToken = "a".repeat(43);
const publication: OwnerPublication = {
  id: "809bbe8d-336d-43a6-a829-750a572389c9",
  revisionId: "2f3b6e83-4d53-4320-9c6e-50a386104f36",
  visibility: "public",
  moderationStatus: "needs_review",
  publishedAt: "2026-08-11T12:00:00.000Z",
  rightsBasis: "public_domain",
  sourceUrl: "https://example.com/map",
  licenseName: "",
  attribution: "Town archive",
};

describe("community contracts", () => {
  it("accepts an unlisted publication request", () => {
    expect(parsePublishMapRequest({
      visibility: "unlisted",
      rightsBasis: "own_or_authorized",
      sourceUrl: "",
      licenseName: "",
      attribution: "",
      shareToken,
      idempotencyKey: requestId,
      expectedPublicationId: null,
    }).visibility).toBe("unlisted");
  });

  it("requires a name for an open license", () => {
    expect(() => parsePublishMapRequest({
      visibility: "public",
      rightsBasis: "open_license",
      sourceUrl: "https://example.com/map",
      licenseName: "",
      attribution: "",
      shareToken: null,
      idempotencyKey: requestId,
      expectedPublicationId: null,
    })).toThrow("Name the open license");
  });

  it("allows a public-domain claim without an online source", () => {
    expect(parsePublishMapRequest({
      visibility: "public",
      rightsBasis: "public_domain",
      sourceUrl: "",
      licenseName: "",
      attribution: "Town archive",
      shareToken: null,
      idempotencyKey: requestId,
      expectedPublicationId: null,
    }).sourceUrl).toBe("");
  });

  it("requires a high-entropy-shaped token for an unlisted publication", () => {
    expect(() => parsePublishMapRequest({
      visibility: "unlisted",
      rightsBasis: "own_or_authorized",
      sourceUrl: "",
      licenseName: "",
      attribution: "",
      shareToken: "too-short",
      idempotencyKey: requestId,
      expectedPublicationId: null,
    })).toThrow("share token");
  });

  it("bounds anonymous report notes", () => {
    expect(() => parseReportRequest({
      publicationId: requestId,
      category: "other",
      note: "x".repeat(2001),
    })).toThrow("Report note");
  });

  it("normalizes a profile username", () => {
    expect(parseProfileUpdate({ username: " TrailMapper ", bio: "Historic maps" })).toEqual({
      username: "trailmapper",
      bio: "Historic maps",
    });
  });

  it("recognizes an unchanged publication revision and sharing settings", () => {
    expect(publicationMatchesSettings(publication, publication.revisionId, {
      visibility: "public",
      rightsBasis: "public_domain",
      sourceUrl: " https://example.com/map ",
      licenseName: "",
      attribution: "Town archive",
    })).toBe(true);
  });

  it("allows a changed revision or visibility to be published", () => {
    const settings = {
      visibility: "public" as const,
      rightsBasis: "public_domain" as const,
      sourceUrl: "https://example.com/map",
      licenseName: "",
      attribution: "Town archive",
    };
    expect(publicationMatchesSettings(publication, requestId, settings)).toBe(false);
    expect(publicationMatchesSettings(publication, publication.revisionId, {
      ...settings,
      visibility: "unlisted",
    })).toBe(false);
  });

  it("requires reasons for corrective moderation actions", () => {
    expect(() => parseModerationRequest({
      publicationId: publication.id,
      action: "hidden",
      reason: "   ",
    })).toThrow("Add a reason");
    expect(parseModerationRequest({
      publicationId: publication.id,
      action: "admin_checked",
      reason: "",
    }).action).toBe("admin_checked");
  });

  it("describes effective owner-facing moderation states precisely", () => {
    expect(publicationModerationLabel("public", "changes_requested"))
      .toBe("Listed publicly · updates requested · still visible");
    expect(publicationModerationLabel("unlisted", "needs_review"))
      .toBe("Shared by link · awaiting admin check");
    expect(publicationModerationLabel("public", "hidden"))
      .toBe("Temporarily hidden by administrator");
  });
});
