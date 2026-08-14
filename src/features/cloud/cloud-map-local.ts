import type { CloudMapDownload } from "@/features/cloud/cloud-map-contract";
import type { LocalSavedMap } from "@/features/maps/saved-map-types";

export function createLocalMapFromCloudDetail(
  detail: CloudMapDownload,
  imageBlob: Blob,
): LocalSavedMap {
  return {
    id: detail.id,
    version: 1,
    createdAt: detail.createdAt,
    updatedAt: detail.clientUpdatedAt,
    metadata: detail.metadata,
    imageName: detail.imageName,
    imageBlob,
    imageDimensions: detail.imageDimensions,
    anchors: detail.anchors,
    targetZoom: detail.targetZoom,
    basemapMode: detail.basemapMode,
  };
}
