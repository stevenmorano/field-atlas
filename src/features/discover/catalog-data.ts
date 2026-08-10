import type { GeographicPoint } from "@/lib/georeferencing/types";

export type CatalogMap = Readonly<{
  id: string;
  title: string;
  place: string;
  subject: "historic" | "trail" | "venue" | "park";
  visualStyle: "conventional" | "illustrated" | "topographic";
  mapDateLabel: string;
  uploadedLabel: string;
  resolutionLabel: string;
  anchorCount: number;
  coverageCenter: GeographicPoint;
  coverageRadiusMeters: number;
  tone: "sepia" | "forest" | "playful" | "water";
  isDownloaded: boolean;
  qualityScore: number;
}>;

export const CATALOG_MAPS: readonly CatalogMap[] = [
  {
    id: "port-chester-1881",
    title: "Port Chester 1881",
    place: "Port Chester, New York",
    subject: "historic",
    visualStyle: "conventional",
    mapDateLabel: "1881",
    uploadedLabel: "Aug 2026",
    resolutionLabel: "9516 × 5884",
    anchorCount: 42,
    coverageCenter: { longitude: -73.6657, latitude: 41.0018 },
    coverageRadiusMeters: 4_800,
    tone: "sepia",
    isDownloaded: true,
    qualityScore: 96,
  },
  {
    id: "bronx-zoo-illustrated",
    title: "Bronx Zoo Illustrated",
    place: "Bronx, New York",
    subject: "venue",
    visualStyle: "illustrated",
    mapDateLabel: "Current",
    uploadedLabel: "Jul 2026",
    resolutionLabel: "6200 × 4100",
    anchorCount: 31,
    coverageCenter: { longitude: -73.877, latitude: 40.8506 },
    coverageRadiusMeters: 1_400,
    tone: "playful",
    isDownloaded: false,
    qualityScore: 94,
  },
  {
    id: "marshlands-conservancy",
    title: "Marshlands Conservancy",
    place: "Rye, New York",
    subject: "trail",
    visualStyle: "topographic",
    mapDateLabel: "2024",
    uploadedLabel: "Jun 2026",
    resolutionLabel: "4100 × 6400",
    anchorCount: 18,
    coverageCenter: { longitude: -73.6846, latitude: 40.9533 },
    coverageRadiusMeters: 2_000,
    tone: "forest",
    isDownloaded: false,
    qualityScore: 89,
  },
  {
    id: "yosemite-valley-trails",
    title: "Yosemite Valley Trails",
    place: "Yosemite National Park",
    subject: "park",
    visualStyle: "topographic",
    mapDateLabel: "2025",
    uploadedLabel: "May 2026",
    resolutionLabel: "7800 × 5200",
    anchorCount: 54,
    coverageCenter: { longitude: -119.573, latitude: 37.7456 },
    coverageRadiusMeters: 12_000,
    tone: "water",
    isDownloaded: true,
    qualityScore: 98,
  },
] as const;
