import { describe, expect, it } from "vitest";

import { fitAffineTransform, fitSimilarityTransform } from "@/lib/georeferencing/math";

describe("transformation fitting", () => {
  it("fits rotation, scale, and translation from two point pairs", () => {
    const transform = fitSimilarityTransform(
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 1_000, y: 2_000 },
      { x: 1_000, y: 2_200 },
    );

    expect(transform).not.toBeNull();
    expect(transform?.apply({ x: 0, y: 50 })).toEqual({ x: 900, y: 2000 });
    expect(transform?.inverse({ x: 900, y: 2000 })).toEqual({ x: 0, y: 50 });
  });

  it("fits a skewed affine transform and exposes its orientation", () => {
    const source = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
      { x: 100, y: 100 },
    ];
    const target = source.map((point) => ({
      x: 5_000 + point.x * 2 + point.y * 0.25,
      y: 8_000 - point.x * 0.5 + point.y * 3,
    }));
    const transform = fitAffineTransform(source, target);
    const result = transform?.apply({ x: 40, y: 70 });

    expect(result?.x).toBeCloseTo(5097.5, 6);
    expect(result?.y).toBeCloseTo(8190, 6);
    expect(transform?.determinant).toBeGreaterThan(0);
  });
});
