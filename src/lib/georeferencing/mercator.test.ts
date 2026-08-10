import { describe, expect, it } from "vitest";

import { geographicToWorld, worldToGeographic } from "@/lib/georeferencing/mercator";

describe("Web Mercator conversion", () => {
  it("round-trips a geographic point", () => {
    const geographic = { longitude: -73.6832, latitude: 40.9876 };
    const result = worldToGeographic(geographicToWorld(geographic));

    expect(result.longitude).toBeCloseTo(geographic.longitude, 9);
    expect(result.latitude).toBeCloseTo(geographic.latitude, 9);
  });

  it("clamps locations beyond the projection's usable latitude", () => {
    const result = worldToGeographic(geographicToWorld({ longitude: 0, latitude: 90 }));

    expect(result.latitude).toBeLessThan(86);
    expect(result.latitude).toBeGreaterThan(85);
  });
});
