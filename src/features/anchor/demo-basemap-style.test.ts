import { describe, expect, it } from "vitest";

import {
  createDemoBasemapStyle,
  DEMO_BASEMAP_LAYER_IDS,
  DEMO_HYBRID_LAYER_IDS,
} from "@/features/anchor/demo-basemap-style";

describe("createDemoBasemapStyle", () => {
  it.each([
    ["street", "visible", "none", "none"],
    ["satellite", "none", "visible", "none"],
    ["hybrid", "none", "visible", "visible"],
  ] as const)("shows the %s layer without rebuilding the map", (mode, streetVisibility, satelliteVisibility, labelVisibility) => {
    const style = createDemoBasemapStyle(mode);
    const streetLayer = style.layers.find((layer) => layer.id === DEMO_BASEMAP_LAYER_IDS.street);
    const satelliteLayer = style.layers.find((layer) => layer.id === DEMO_BASEMAP_LAYER_IDS.satellite);
    const hybridLayers = style.layers.filter((layer) => DEMO_HYBRID_LAYER_IDS.includes(layer.id as (typeof DEMO_HYBRID_LAYER_IDS)[number]));

    expect(streetLayer?.layout?.visibility).toBe(streetVisibility);
    expect(satelliteLayer?.layout?.visibility).toBe(satelliteVisibility);
    expect(hybridLayers).toHaveLength(DEMO_HYBRID_LAYER_IDS.length);
    expect(hybridLayers.every((layer) => layer.layout?.visibility === labelVisibility)).toBe(true);
  });

  it("includes source attribution for both public previews", () => {
    const style = createDemoBasemapStyle();

    expect(style.sources.openStreetMap).toMatchObject({
      attribution: "© OpenStreetMap contributors",
    });
    expect(style.sources.worldImagery).toMatchObject({
      attribution: expect.stringContaining("© Esri"),
    });
    const hybridLayer = style.layers.find((layer) => layer.id === DEMO_HYBRID_LAYER_IDS[0]);
    expect(hybridLayer).toMatchObject({
      source: "openStreetMap",
      paint: { "raster-opacity": 0.42 },
    });
  });
});
