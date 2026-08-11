import { describe, expect, it } from "vitest";

import type { LocalAnchorDraft } from "@/features/anchor/local-draft-store";
import {
  decodeFieldAtlasBackup,
  encodeFieldAtlasBackup,
  FieldAtlasBackupError,
} from "@/features/backup/field-atlas-package";
import { prepareDraftForFieldAtlasBackup } from "@/features/backup/local-backup-service";
import type { LocalSavedMap } from "@/features/maps/saved-map-types";

function sampleMap(imageBlob: Blob): LocalSavedMap {
  return {
    id: "map-one",
    version: 1,
    createdAt: 100,
    updatedAt: 200,
    metadata: {
      title: "Rye 🗺️ 1881",
      description: "A local historic map",
      placeName: "Rye, New York",
      subject: "Historic",
      visualStyle: "Conventional",
      mapDateKind: "exact",
      mapYear: 1881,
      activities: ["History"],
      source: "Town archive",
      visibility: "private",
    },
    imageName: "Rye–1881.png",
    imageBlob,
    imageDimensions: { width: 100, height: 80 },
    anchors: [
      {
        id: "anchor-1",
        image: { x: 10, y: 20 },
        geographic: { longitude: -73.7, latitude: 40.9 },
      },
      {
        id: "anchor-2",
        image: { x: 70, y: 60 },
        geographic: { longitude: -73.6, latitude: 41 },
      },
    ],
    targetZoom: 4,
    basemapMode: "hybrid",
  };
}

function sampleDraft(imageBlob: Blob): LocalAnchorDraft {
  const map = sampleMap(imageBlob);
  return {
    id: "current",
    version: 1,
    savedAt: 250,
    imageName: map.imageName,
    imageBlob,
    imageDimensions: map.imageDimensions,
    anchors: map.anchors,
    targetZoom: map.targetZoom,
    targetRotation: 90,
    basemapMode: map.basemapMode,
    savedMapId: map.id,
  };
}

describe("Field Atlas backup package", () => {
  it("round trips maps, Unicode metadata, and a linked active draft", async () => {
    const imageBlob = new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: "image/png" });
    const packageBlob = await encodeFieldAtlasBackup({
      maps: [sampleMap(imageBlob)],
      draft: sampleDraft(imageBlob),
      exportedAt: 300,
      appVersion: "test",
    });

    const decoded = await decodeFieldAtlasBackup(packageBlob);

    expect(decoded.exportedAt).toBe(300);
    expect(decoded.appVersion).toBe("test");
    expect(decoded.assetCount).toBe(1);
    expect(decoded.totalAssetBytes).toBe(5);
    expect(decoded.maps).toHaveLength(1);
    expect(decoded.maps[0].metadata.title).toBe("Rye 🗺️ 1881");
    expect(decoded.maps[0].imageName).toBe("Rye–1881.png");
    expect(new Uint8Array(await decoded.maps[0].imageBlob.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3, 4, 5]),
    );
    expect(decoded.draft?.targetRotation).toBe(90);
    expect(decoded.draft?.savedMapId).toBe("map-one");
  });

  it("rejects an unsupported file header", async () => {
    const encoded = await encodeFieldAtlasBackup({
      maps: [sampleMap(new Blob(["image"], { type: "image/png" }))],
      draft: null,
    });
    const bytes = new Uint8Array(await encoded.arrayBuffer());
    bytes[0] = 0;

    await expect(decodeFieldAtlasBackup(new Blob([bytes]))).rejects.toThrow(
      FieldAtlasBackupError,
    );
  });

  it("rejects truncated packages before import", async () => {
    const encoded = await encodeFieldAtlasBackup({
      maps: [sampleMap(new Blob(["image"], { type: "image/png" }))],
      draft: null,
    });

    await expect(decodeFieldAtlasBackup(encoded.slice(0, encoded.size - 2))).rejects.toThrow(
      /out-of-bounds|checksum|damaged/i,
    );
  });

  it("detects image payload corruption with SHA-256", async () => {
    const encoded = await encodeFieldAtlasBackup({
      maps: [sampleMap(new Blob(["image-data"], { type: "image/png" }))],
      draft: null,
    });
    const bytes = new Uint8Array(await encoded.arrayBuffer());
    bytes[bytes.length - 1] ^= 0xff;

    await expect(decodeFieldAtlasBackup(new Blob([bytes]))).rejects.toThrow(/checksum/i);
  });

  it("rejects a draft link to a saved map that is absent from the package", async () => {
    const imageBlob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
    const draft = { ...sampleDraft(imageBlob), savedMapId: "missing-map" };
    const encoded = await encodeFieldAtlasBackup({
      maps: [sampleMap(imageBlob)],
      draft,
    });

    await expect(decodeFieldAtlasBackup(encoded)).rejects.toThrow(/draft.*missing/i);
  });

  it("remaps a draft linked to a consolidated duplicate before export", () => {
    const imageBlob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
    const superseded = sampleMap(imageBlob);
    const canonical: LocalSavedMap = {
      ...superseded,
      id: "map-two",
      anchors: [
        ...superseded.anchors,
        {
          id: "anchor-3",
          image: { x: 50, y: 40 },
          geographic: { longitude: -73.65, latitude: 40.95 },
        },
      ],
    };

    const prepared = prepareDraftForFieldAtlasBackup(
      sampleDraft(imageBlob),
      [superseded, canonical],
      [canonical],
    );

    expect(prepared?.savedMapId).toBe(canonical.id);
  });
});
