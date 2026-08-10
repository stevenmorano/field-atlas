import type { LocalSavedMap, SavedMapContent } from "@/features/maps/saved-map-types";

type ConsolidatedMaps = Readonly<{
  visibleMaps: readonly LocalSavedMap[];
  recordsToWrite: readonly LocalSavedMap[];
}>;

export function savedMapAssetSignature(
  content: Pick<SavedMapContent, "imageName" | "imageBlob" | "imageDimensions">,
) {
  return [
    content.imageName.normalize("NFC").trim().toLocaleLowerCase(),
    content.imageDimensions.width.toString() + "x" + content.imageDimensions.height.toString(),
    content.imageBlob.size.toString(),
    content.imageBlob.type,
  ].join("|");
}

function compareCanonicalCandidates(left: LocalSavedMap, right: LocalSavedMap) {
  const anchorDifference = right.anchors.length - left.anchors.length;
  return anchorDifference === 0 ? right.updatedAt - left.updatedAt : anchorDifference;
}

export function consolidateExactSourceMaps(maps: readonly LocalSavedMap[]): ConsolidatedMaps {
  const groups = new Map<string, LocalSavedMap[]>();
  for (const map of maps) {
    const signature = savedMapAssetSignature(map);
    const group = groups.get(signature) ?? [];
    group.push(map);
    groups.set(signature, group);
  }

  const visibleMaps: LocalSavedMap[] = [];
  const recordsToWrite: LocalSavedMap[] = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      const onlyMap = group[0];
      if (!onlyMap.supersededBy) {
        visibleMaps.push(onlyMap);
      }
      continue;
    }

    const activeCandidates = group.filter((map) => !map.supersededBy);
    const candidates = activeCandidates.length > 0 ? activeCandidates : group;
    const canonical = [...candidates].sort(compareCanonicalCandidates)[0];
    const seenAnchorIds = new Set(canonical.anchors.map((anchor) => anchor.id));
    const mergedAnchors = [...canonical.anchors];

    for (const map of [...group].sort((left, right) => right.updatedAt - left.updatedAt)) {
      for (const anchor of map.anchors) {
        if (!seenAnchorIds.has(anchor.id)) {
          seenAnchorIds.add(anchor.id);
          mergedAnchors.push(anchor);
        }
      }
    }

    const consolidatedCanonical: LocalSavedMap = {
      ...canonical,
      anchors: mergedAnchors,
      createdAt: Math.min(...group.map((map) => map.createdAt)),
      updatedAt: Math.max(...group.map((map) => map.updatedAt)),
      supersededBy: undefined,
    };
    visibleMaps.push(consolidatedCanonical);
    recordsToWrite.push(consolidatedCanonical);

    for (const map of group) {
      if (map.id !== canonical.id) {
        recordsToWrite.push({ ...map, supersededBy: canonical.id });
      }
    }
  }

  return {
    visibleMaps: visibleMaps.sort((left, right) => right.updatedAt - left.updatedAt),
    recordsToWrite,
  };
}
