import { describe, expect, it } from "vitest";

import { createGeoreferenceModel } from "@/lib/georeferencing/create-georeference-model";
import { geographicToWorld, worldToGeographic } from "@/lib/georeferencing/mercator";
import type { AnchorPair, ImagePoint, WorldPoint } from "@/lib/georeferencing/types";

function anchor(id: string, image: ImagePoint, world: WorldPoint): AnchorPair {
  return { id, image, geographic: worldToGeographic(world) };
}

function expectWorldClose(actual: WorldPoint, expected: WorldPoint) {
  expect(actual.x).toBeCloseTo(expected.x, 4);
  expect(actual.y).toBeCloseTo(expected.y, 4);
}

describe("progressive georeference model", () => {
  it("requires two anchors before it predicts positions", () => {
    const model = createGeoreferenceModel([
      anchor("one", { x: 20, y: 20 }, { x: 1_000, y: 2_000 }),
    ]);

    expect(model.mode).toBe("unavailable");
    expect(model.projectImagePoint({ x: 30, y: 30 })).toBeNull();
    expect(model.quality.isGpsReady).toBe(false);
  });

  it("uses two anchors to infer scale and a ninety-degree rotation", () => {
    const model = createGeoreferenceModel([
      anchor("one", { x: 0, y: 0 }, { x: 1_000, y: 2_000 }),
      anchor("two", { x: 100, y: 0 }, { x: 1_000, y: 2_100 }),
    ]);
    const estimate = model.projectImagePoint({ x: 0, y: 100 });

    expect(model.mode).toBe("similarity");
    expect(estimate?.mode).toBe("similarity");
    expectWorldClose(geographicToWorld(estimate!.point), { x: 900, y: 2_000 });
  });

  it("accepts a globally reversed orientation such as a north-up base and south-down image", () => {
    const imagePoints = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
      { x: 100, y: 100 },
    ];
    const anchors = imagePoints.map((image, index) =>
      anchor(String(index), image, {
        x: 1_000 + image.y * 2,
        y: 2_000 + image.x * 3,
      }),
    );
    const model = createGeoreferenceModel(anchors);
    const estimate = model.projectImagePoint({ x: 25, y: 75 });

    expect(model.mode).toBe("triangulated");
    expect(model.quality.foldedTriangleCount).toBe(0);
    expect(model.quality.isGpsReady).toBe(true);
    expectWorldClose(geographicToWorld(estimate!.point), { x: 1_150, y: 2_075 });
  });

  it("uses local triangles for a warped cartoon map and round-trips a point", () => {
    const anchors = [
      anchor("nw", { x: 0, y: 0 }, { x: 1_000, y: 1_000 }),
      anchor("ne", { x: 100, y: 0 }, { x: 1_100, y: 1_000 }),
      anchor("sw", { x: 0, y: 100 }, { x: 1_000, y: 1_100 }),
      anchor("se", { x: 100, y: 100 }, { x: 1_125, y: 1_120 }),
    ];
    const model = createGeoreferenceModel(anchors);
    const projected = model.projectImagePoint({ x: 72, y: 61 });
    const reversed = projected ? model.projectGeographicPoint(projected.point) : null;

    expect(projected?.mode).toBe("triangulated");
    expect(projected?.insideAnchoredRegion).toBe(true);
    expect(reversed?.point.x).toBeCloseTo(72, 5);
    expect(reversed?.point.y).toBeCloseTo(61, 5);
  });

  it("warns when one local triangle reverses against the global mesh orientation", () => {
    const anchors = [
      anchor("nw", { x: 0, y: 0 }, { x: 0, y: 0 }),
      anchor("ne", { x: 100, y: 0 }, { x: 100, y: 0 }),
      anchor("sw", { x: 0, y: 100 }, { x: 0, y: 100 }),
      anchor("se", { x: 100, y: 100 }, { x: 100, y: 100 }),
      anchor("center", { x: 50, y: 50 }, { x: 140, y: 50 }),
    ];
    const model = createGeoreferenceModel(anchors);

    expect(model.quality.foldedTriangleCount).toBeGreaterThan(0);
    expect(model.quality.isGpsReady).toBe(false);
    expect(model.quality.warnings.some((warning) => warning.code === "folded-triangle")).toBe(true);
  });
});
