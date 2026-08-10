import type { StyleSpecification } from "maplibre-gl";

export type DemoBasemapMode = "street" | "satellite" | "hybrid";

export const DEMO_BASEMAP_LAYER_IDS = {
  street: "openstreetmap",
  satellite: "world-imagery",
} as const;

export const DEMO_HYBRID_LAYER_IDS = [
  "hybrid-map-detail",
] as const;

export function createDemoBasemapStyle(mode: DemoBasemapMode = "street"): StyleSpecification {
  return {
    version: 8,
    sources: {
      openStreetMap: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 19,
        attribution: "© OpenStreetMap contributors",
      },
      worldImagery: {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 19,
        attribution: "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      },
    },
    layers: [
      {
        id: DEMO_BASEMAP_LAYER_IDS.street,
        type: "raster",
        source: "openStreetMap",
        layout: { visibility: mode === "street" ? "visible" : "none" },
        paint: { "raster-fade-duration": 120 },
      },
      {
        id: DEMO_BASEMAP_LAYER_IDS.satellite,
        type: "raster",
        source: "worldImagery",
        layout: { visibility: mode === "street" ? "none" : "visible" },
        paint: { "raster-fade-duration": 120 },
      },
      {
        id: DEMO_HYBRID_LAYER_IDS[0],
        type: "raster",
        source: "openStreetMap",
        layout: { visibility: mode === "hybrid" ? "visible" : "none" },
        paint: {
          "raster-fade-duration": 120,
          "raster-opacity": 0.42,
          "raster-saturation": -0.65,
          "raster-contrast": 0.5,
        },
      },
    ],
  };
}
