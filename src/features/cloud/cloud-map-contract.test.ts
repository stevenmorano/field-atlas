import { describe, expect, it } from "vitest";

import {
  createCloudContentFingerprint,
  normalizeCloudImageMimeType,
  parseCloudAssetUploadRequest,
  parseCloudMapSyncRequest,
  stableJson,
} from "@/features/cloud/cloud-map-contract";
import type { LocalSavedMap } from "@/features/maps/saved-map-types";

const MAP: LocalSavedMap = {
  id: "5f1be13f-f63f-4a6d-8fad-c0c9a71c18c0",
  version: 1,
  createdAt: 1,
  updatedAt: 2,
  imageName: "park.png",
  imageBlob: new Blob(["map"], { type: "image/png" }),
  imageDimensions: { width: 100, height: 200 },
  anchors: [{
    id: "one",
    image: { x: 10, y: 20 },
    geographic: { longitude: -73, latitude: 41 },
  }],
  targetZoom: 1,
  basemapMode: "hybrid",
  metadata: {
    title: "Park",
    description: "",
    placeName: "Rye",
    subject: "Trail",
    visualStyle: "Conventional",
    mapDateKind: "exact",
    mapYear: 2023,
    activities: ["Hiking"],
    source: "",
    visibility: "private",
  },
};

describe("cloud map contract", () => {
  it("normalizes missing browser MIME values from the file extension", () => {
    expect(normalizeCloudImageMimeType("scan.JPEG", "")).toBe("image/jpeg");
  });

  it("rejects unsupported upload formats before signing", () => {
    expect(() => parseCloudAssetUploadRequest({
      fileName: "map.svg",
      mimeType: "image/svg+xml",
      byteSize: 10,
      sha256: "a".repeat(64),
      width: 10,
      height: 10,
    })).toThrow(/Only JPEG/);
  });

  it("serializes object keys deterministically", () => {
    expect(stableJson({ b: 2, a: { d: 4, c: 3 } })).toBe('{"a":{"c":3,"d":4},"b":2}');
  });

  it("changes the content fingerprint when anchor work changes", async () => {
    const first = await createCloudContentFingerprint(MAP, "b".repeat(64));
    const second = await createCloudContentFingerprint({
      ...MAP,
      anchors: [{ ...MAP.anchors[0], image: { x: 11, y: 20 } }],
    }, "b".repeat(64));
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).not.toBe(first);
  });

  it("rejects a sync payload whose base revision is not a UUID", () => {
    expect(() => parseCloudMapSyncRequest({
      mapId: MAP.id,
      assetId: "883168c5-b0dc-4046-b256-22a0422e5333",
      metadata: MAP.metadata,
      anchors: MAP.anchors,
      targetZoom: MAP.targetZoom,
      basemapMode: MAP.basemapMode,
      clientUpdatedAt: MAP.updatedAt,
      contentFingerprint: "c".repeat(64),
      baseRevisionId: "old",
    })).toThrow(/Base revision/);
  });
});
