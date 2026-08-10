import { describe, expect, it } from "vitest";

import { createCompareMesh } from "@/features/compare/create-compare-mesh";
import { createGeoreferenceModel } from "@/lib/georeferencing/create-georeference-model";
import { worldToGeographic } from "@/lib/georeferencing/mercator";
import type { AnchorPair, ImagePoint, WorldPoint } from "@/lib/georeferencing/types";

function anchor(id: string, image: ImagePoint, world: WorldPoint): AnchorPair {
  return { id, image, geographic: worldToGeographic(world) };
}

describe("compare mesh", () => {
  it("keeps saved anchors as exact vertices and fills the image with triangles", () => {
    const anchors = [
      anchor("nw", { x: 0, y: 0 }, { x: 1_000, y: 2_000 }),
      anchor("ne", { x: 100, y: 0 }, { x: 1_100, y: 2_000 }),
      anchor("sw", { x: 0, y: 100 }, { x: 1_000, y: 2_100 }),
      anchor("se", { x: 100, y: 100 }, { x: 1_115, y: 2_110 }),
    ];
    const mesh = createCompareMesh(
      { width: 100, height: 100 },
      createGeoreferenceModel(anchors),
      4,
    );

    expect(mesh).not.toBeNull();
    expect(mesh!.triangles.length).toBeGreaterThan(0);
    for (const savedAnchor of anchors) {
      const vertex = mesh!.vertices.find(
        (candidate) =>
          candidate.image.x === savedAnchor.image.x &&
          candidate.image.y === savedAnchor.image.y,
      );
      expect(vertex?.geographic.longitude).toBeCloseTo(
        savedAnchor.geographic.longitude,
        12,
      );
      expect(vertex?.geographic.latitude).toBeCloseTo(
        savedAnchor.geographic.latitude,
        12,
      );
    }
  });

  it("marks support vertices outside the anchor network as extrapolated", () => {
    const model = createGeoreferenceModel([
      anchor("one", { x: 25, y: 25 }, { x: 1_000, y: 2_000 }),
      anchor("two", { x: 75, y: 25 }, { x: 1_050, y: 2_000 }),
      anchor("three", { x: 50, y: 75 }, { x: 1_025, y: 2_050 }),
    ]);
    const mesh = createCompareMesh({ width: 100, height: 100 }, model, 4);

    expect(mesh?.extrapolatedVertexCount).toBeGreaterThan(0);
    expect(mesh?.bounds.east).toBeGreaterThan(mesh!.bounds.west);
    expect(mesh?.bounds.north).toBeGreaterThan(mesh!.bounds.south);
  });

  it("supports a similarity transform with only two anchors", () => {
    const model = createGeoreferenceModel([
      anchor("one", { x: 0, y: 0 }, { x: 1_000, y: 2_000 }),
      anchor("two", { x: 100, y: 0 }, { x: 1_000, y: 2_100 }),
    ]);

    expect(createCompareMesh({ width: 100, height: 150 }, model, 3)).not.toBeNull();
  });

  it("refuses an unavailable one-anchor transformation", () => {
    const model = createGeoreferenceModel([
      anchor("one", { x: 0, y: 0 }, { x: 1_000, y: 2_000 }),
    ]);

    expect(createCompareMesh({ width: 100, height: 100 }, model)).toBeNull();
  });
});
