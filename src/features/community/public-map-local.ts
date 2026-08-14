import type { PublicMapDetail } from "@/features/community/community-contract";
import type { LocalSavedMap } from "@/features/maps/saved-map-types";

export function createLocalMapFromPublicDetail(
  detail: PublicMapDetail,
  imageBlob: Blob,
): LocalSavedMap {
  const publishedAt = Date.parse(detail.publishedAt);
  const timestamp = Number.isFinite(publishedAt) ? publishedAt : Date.now();

  return {
    id: detail.mapId,
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata: {
      title: detail.title,
      description: detail.description,
      placeName: detail.placeName,
      subject: detail.subject,
      visualStyle: detail.visualStyle,
      mapDateKind: detail.mapDateKind,
      mapYear: detail.mapYear,
      activities: detail.activities,
      source: detail.sourceUrl,
      visibility: "public-ready",
    },
    imageName: `${detail.title}.webp`,
    imageBlob,
    imageDimensions: detail.image,
    anchors: detail.anchors,
    targetZoom: detail.targetZoom,
    basemapMode: detail.basemapMode,
  };
}
