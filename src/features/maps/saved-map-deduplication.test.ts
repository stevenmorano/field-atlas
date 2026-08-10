import { describe, expect, it } from "vitest";

import {
  consolidateExactSourceMaps,
  savedMapAssetSignature,
} from "@/features/maps/saved-map-deduplication";
import type { LocalSavedMap } from "@/features/maps/saved-map-types";

function makeMap(id: string, anchorIds: readonly string[], updatedAt: number): LocalSavedMap {
  return {
    id,
    version: 1,
    createdAt: updatedAt - 100,
    updatedAt,
    metadata: {
      title: id,
      description: "",
      placeName: "",
      subject: "Trail",
      visualStyle: "Conventional",
      mapDateKind: "unknown",
      mapYear: null,
      activities: [],
      source: "",
      visibility: "private",
    },
    imageName: "same-map.jpg",
    imageBlob: new Blob(["same image"], { type: "image/jpeg" }),
    imageDimensions: { width: 3300, height: 5100 },
    anchors: anchorIds.map((anchorId, index) => ({
      id: anchorId,
      image: { x: index, y: index },
      geographic: { latitude: 40 + index, longitude: -73 - index },
    })),
    targetZoom: 1,
    basemapMode: "street",
  };
}

describe("saved-map exact-source consolidation", () => {
  it("uses stable image properties for the asset signature", () => {
    const first = makeMap("first", ["a"], 1);
    const second = makeMap("second", ["a"], 2);

    expect(savedMapAssetSignature(first)).toBe(savedMapAssetSignature(second));
  });

  it("keeps the record with more anchors and retains the other as superseded", () => {
    const older = makeMap("older", ["a", "b"], 10);
    const newer = makeMap("newer", ["a", "b", "c"], 20);
    const result = consolidateExactSourceMaps([older, newer]);

    expect(result.visibleMaps).toHaveLength(1);
    expect(result.visibleMaps[0].id).toBe("newer");
    expect(result.visibleMaps[0].anchors.map((anchor) => anchor.id)).toEqual(["a", "b", "c"]);
    expect(result.recordsToWrite.find((map) => map.id === "older")?.supersededBy).toBe("newer");
  });

  it("merges unique anchor work before hiding an accidental duplicate", () => {
    const first = makeMap("first", ["a", "b"], 10);
    const second = makeMap("second", ["a", "c", "d"], 20);
    const result = consolidateExactSourceMaps([first, second]);

    expect(result.visibleMaps[0].anchors.map((anchor) => anchor.id)).toEqual(["a", "c", "d", "b"]);
  });
});
