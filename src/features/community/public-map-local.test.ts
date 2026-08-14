import { describe, expect, it } from "vitest";

import type { PublicMapDetail } from "@/features/community/community-contract";
import { createLocalMapFromPublicDetail } from "@/features/community/public-map-local";

const detail: PublicMapDetail = {
  mapId: "29f03e43-b7d2-4e19-a72c-b2e747c2079f",
  publicationId: "168166ef-9deb-4126-92ff-be5c1d35de49",
  publicAssetId: "d7a8abf0-034a-48d8-9b97-d6e590f4e9fc",
  title: "Historic map",
  description: "A public map",
  placeName: "Rye Brook, NY",
  subject: "Historic",
  visualStyle: "Aerial or photo",
  mapDateKind: "exact",
  mapYear: 1925,
  activities: ["History"],
  anchorCount: 2,
  publishedAt: "2026-08-13T12:00:00.000Z",
  username: "atlas",
  adminChecked: true,
  coverage: { latitude: 41, longitude: -73, radiusMeters: 500 },
  schemaVersion: 1,
  visibility: "public",
  moderationStatus: "admin_checked",
  sourceUrl: "",
  licenseName: "",
  attribution: "",
  author: { username: "atlas", avatarSeed: "atlas" },
  image: { width: 1200, height: 800, mimeType: "image/webp" },
  anchors: [
    { id: "anchor-1", image: { x: 100, y: 100 }, geographic: { latitude: 41, longitude: -73 } },
    { id: "anchor-2", image: { x: 1000, y: 700 }, geographic: { latitude: 41.01, longitude: -73.01 } },
  ],
  targetZoom: 1,
  basemapMode: "street",
};

describe("public map local adapter", () => {
  it("preserves the published image, anchors, and viewer metadata", () => {
    const imageBlob = new Blob(["image"], { type: "image/webp" });
    const map = createLocalMapFromPublicDetail(detail, imageBlob);

    expect(map.id).toBe(detail.mapId);
    expect(map.imageBlob).toBe(imageBlob);
    expect(map.anchors).toEqual(detail.anchors);
    expect(map.metadata.title).toBe(detail.title);
    expect(map.metadata.visibility).toBe("public-ready");
    expect(map.updatedAt).toBe(Date.parse(detail.publishedAt));
  });
});
