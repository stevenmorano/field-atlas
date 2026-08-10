import type { DemoBasemapMode } from "@/features/anchor/demo-basemap-style";
import type { AnchorPair } from "@/lib/georeferencing/types";

export const MAP_SUBJECT_OPTIONS = [
  "Trail",
  "Park or preserve",
  "City or town",
  "Zoo or amusement venue",
  "Historic",
  "Ski or winter",
  "Nautical",
  "Campus",
  "Transit",
  "Property or parcel",
  "Event or course",
  "Other",
] as const;

export const MAP_STYLE_OPTIONS = [
  "Conventional",
  "Illustrated or cartoon",
  "Hand-drawn",
  "Aerial or photo",
  "Topographic",
  "Chart",
] as const;

export const MAP_ACTIVITY_OPTIONS = [
  "Hiking",
  "Biking",
  "History",
  "Sightseeing",
  "Skiing",
  "Boating",
] as const;

export type MapDateKind = "unknown" | "current" | "exact" | "approximate";
export type LocalMapVisibility = "private" | "public-ready";

export type SavedMapMetadata = Readonly<{
  title: string;
  description: string;
  placeName: string;
  subject: string;
  visualStyle: string;
  mapDateKind: MapDateKind;
  mapYear: number | null;
  activities: readonly string[];
  source: string;
  visibility: LocalMapVisibility;
}>;

export type SavedMapContent = Readonly<{
  imageName: string;
  imageBlob: Blob;
  imageDimensions: Readonly<{ width: number; height: number }>;
  anchors: readonly AnchorPair[];
  targetZoom: number;
  basemapMode: DemoBasemapMode;
}>;

export type LocalSavedMap = Readonly<{
  id: string;
  version: 1;
  createdAt: number;
  updatedAt: number;
  metadata: SavedMapMetadata;
  supersededBy?: string;
}> & SavedMapContent;

export const EMPTY_MAP_METADATA: SavedMapMetadata = {
  title: "",
  description: "",
  placeName: "",
  subject: MAP_SUBJECT_OPTIONS[0],
  visualStyle: MAP_STYLE_OPTIONS[0],
  mapDateKind: "unknown",
  mapYear: null,
  activities: [],
  source: "",
  visibility: "private",
};
