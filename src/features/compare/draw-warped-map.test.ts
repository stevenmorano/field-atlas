import { describe, expect, it } from "vitest";

import { affineTransformFromTriangles } from "@/features/compare/draw-warped-map";

function apply(
  transform: NonNullable<ReturnType<typeof affineTransformFromTriangles>>,
  point: Readonly<{ x: number; y: number }>,
) {
  return {
    x: transform.a * point.x + transform.c * point.y + transform.e,
    y: transform.b * point.x + transform.d * point.y + transform.f,
  };
}

describe("canvas triangle transform", () => {
  it("maps each source vertex to its rotated and skewed destination", () => {
    const source = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
    ] as const;
    const destination = [
      { x: 20, y: 30 },
      { x: 40, y: 150 },
      { x: -70, y: 80 },
    ] as const;
    const transform = affineTransformFromTriangles(source, destination);

    expect(transform).not.toBeNull();
    source.forEach((point, index) => {
      expect(apply(transform!, point).x).toBeCloseTo(destination[index].x, 8);
      expect(apply(transform!, point).y).toBeCloseTo(destination[index].y, 8);
    });
  });

  it("rejects a source triangle with no area", () => {
    expect(
      affineTransformFromTriangles(
        [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }],
        [{ x: 0, y: 0 }, { x: 50, y: 10 }, { x: 100, y: 20 }],
      ),
    ).toBeNull();
  });
});
