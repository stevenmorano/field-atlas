import { describe, expect, it } from "vitest";

import type { LocalAnchorDraft } from "@/features/anchor/local-draft-store";
import type { DecodedFieldAtlasBackup } from "@/features/backup/field-atlas-package";
import {
  prepareFieldAtlasImport,
  savedMapFingerprint,
} from "@/features/backup/plan-field-atlas-import";
import type { LocalSavedMap } from "@/features/maps/saved-map-types";

function map(id = "map-one", title = "Town map", anchorCount = 2): LocalSavedMap {
  return {
    id,
    version: 1,
    createdAt: 100,
    updatedAt: 200,
    metadata: {
      title,
      description: "",
      placeName: "Town",
      subject: "Historic",
      visualStyle: "Conventional",
      mapDateKind: "unknown",
      mapYear: null,
      activities: [],
      source: "",
      visibility: "private",
    },
    imageName: "town.png",
    imageBlob: new Blob(["same image"], { type: "image/png" }),
    imageDimensions: { width: 100, height: 100 },
    anchors: Array.from({ length: anchorCount }, (_, index) => ({
      id: `anchor-${index}`,
      image: { x: index * 10, y: index * 10 },
      geographic: { longitude: -73 + index * 0.01, latitude: 41 + index * 0.01 },
    })),
    targetZoom: 2,
    basemapMode: "street",
  };
}

function draft(savedMapId = "map-one"): LocalAnchorDraft {
  const source = map(savedMapId);
  return {
    id: "current",
    version: 1,
    savedAt: 300,
    imageName: source.imageName,
    imageBlob: source.imageBlob,
    imageDimensions: source.imageDimensions,
    anchors: source.anchors,
    targetZoom: source.targetZoom,
    basemapMode: source.basemapMode,
    savedMapId,
  };
}

function backup(maps: readonly LocalSavedMap[], activeDraft: LocalAnchorDraft | null = null): DecodedFieldAtlasBackup {
  return {
    exportedAt: 400,
    appVersion: "test",
    maps,
    draft: activeDraft,
    assetCount: 1,
    totalAssetBytes: 10,
  };
}

describe("prepareFieldAtlasImport", () => {
  it("preserves unused map IDs and restores linked draft IDs", async () => {
    const prepared = await prepareFieldAtlasImport({
      backup: backup([map()], draft()),
      existingMaps: [],
      existingDraft: null,
    });

    expect(prepared.mapsToAdd[0].id).toBe("map-one");
    expect(prepared.decisions[0].status).toBe("new");
    expect(prepared.incomingDraft?.savedMapId).toBe("map-one");
  });

  it("skips an identical record with the same ID", async () => {
    const existing = map();
    const prepared = await prepareFieldAtlasImport({
      backup: backup([map()]),
      existingMaps: [existing],
      existingDraft: null,
    });

    expect(prepared.mapsToAdd).toHaveLength(0);
    expect(prepared.summary.duplicateMapCount).toBe(1);
    expect(prepared.decisions[0].targetId).toBe(existing.id);
  });

  it("preserves a divergent same-ID record as a visible imported copy", async () => {
    const prepared = await prepareFieldAtlasImport({
      backup: backup([map("map-one", "Older town map", 4)], draft()),
      existingMaps: [map("map-one", "Current town map", 2)],
      existingDraft: null,
      createId: () => "imported-copy-id",
      importedAt: 500,
    });

    expect(prepared.summary.conflictMapCount).toBe(1);
    expect(prepared.mapsToAdd[0]).toMatchObject({
      id: "imported-copy-id",
      preserveAsVariant: true,
      metadata: { title: "Older town map (Imported copy)" },
      importLineage: { sourceMapId: "map-one", importedAt: 500 },
    });
    expect(prepared.incomingDraft?.savedMapId).toBe("imported-copy-id");
  });

  it("recognizes a repeated conflict import by its lineage fingerprint", async () => {
    const incoming = map("map-one", "Older town map", 4);
    const fingerprint = await savedMapFingerprint(incoming);
    const importedCopy: LocalSavedMap = {
      ...incoming,
      id: "copy-id",
      metadata: { ...incoming.metadata, title: "Older town map (Imported copy)" },
      preserveAsVariant: true,
      importLineage: {
        sourceMapId: incoming.id,
        sourceFingerprint: fingerprint,
        importedAt: 500,
      },
    };
    const prepared = await prepareFieldAtlasImport({
      backup: backup([incoming]),
      existingMaps: [map("map-one", "Current town map"), importedCopy],
      existingDraft: null,
    });

    expect(prepared.mapsToAdd).toHaveLength(0);
    expect(prepared.decisions[0]).toMatchObject({
      status: "duplicate",
      targetId: "copy-id",
    });
  });

  it("keeps both incoming and existing draft information for explicit UI choice", async () => {
    const existingDraft = draft("existing-map");
    const prepared = await prepareFieldAtlasImport({
      backup: backup([], draft("incoming-map")),
      existingMaps: [],
      existingDraft,
    });

    expect(prepared.existingDraft).toBe(existingDraft);
    expect(prepared.incomingDraft?.savedMapId).toBe("incoming-map");
  });
});
