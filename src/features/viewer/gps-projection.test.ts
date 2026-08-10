import { describe, expect, it } from "vitest";

import { projectGpsReading } from "@/features/viewer/gps-projection";
import type { GeoreferenceModel } from "@/lib/georeferencing/types";

function linearModel(): GeoreferenceModel {
  return {
    anchors: [],
    mode: "affine",
    quality: {
      anchorCount: 3,
      mode: "affine",
      triangleCount: 0,
      reliableTriangleCount: 0,
      foldedTriangleCount: 0,
      degenerateTriangleCount: 0,
      isGpsReady: true,
      warnings: [],
    },
    imageCoverageHull: [],
    projectImagePoint: () => null,
    projectGeographicPoint: (point) => ({
      point: {
        x: (point.longitude + 74) * 100_000,
        y: (41 - point.latitude) * 100_000,
      },
      mode: "affine",
      confidence: "medium",
      insideAnchoredRegion: point.longitude < -73.99,
      triangleIndex: null,
    }),
  };
}

describe("GPS projection", () => {
  it("projects a browser reading onto the saved image without changing its values", () => {
    const reading = {
      longitude: -73.995,
      latitude: 40.995,
      accuracy: 12,
      timestamp: 123,
    };
    const result = projectGpsReading(linearModel(), { width: 1_000, height: 1_000 }, reading);

    expect(result?.estimate.point.x).toBeCloseTo(500, 6);
    expect(result?.estimate.point.y).toBeCloseTo(500, 6);
    expect(result?.estimate.insideAnchoredRegion).toBe(true);
    expect(result?.isOnImage).toBe(true);
    expect(result?.reading).toEqual(reading);
  });

  it("marks an extrapolated point outside the image and still returns its estimate", () => {
    const result = projectGpsReading(
      linearModel(),
      { width: 1_000, height: 1_000 },
      { longitude: -73.98, latitude: 40.995, accuracy: 8, timestamp: 456 },
    );

    expect(result?.estimate.insideAnchoredRegion).toBe(false);
    expect(result?.isOnImage).toBe(false);
    expect(result?.estimate.point.x).toBeGreaterThan(1_000);
  });

  it("converts reported meter accuracy into a nonzero image-space radius", () => {
    const result = projectGpsReading(
      linearModel(),
      { width: 1_000, height: 1_000 },
      { longitude: -73.995, latitude: 40.995, accuracy: 25, timestamp: 789 },
    );

    expect(result?.accuracyRadius?.x).toBeGreaterThan(0);
    expect(result?.accuracyRadius?.y).toBeGreaterThan(0);
  });
});
