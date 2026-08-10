import { describe, expect, it } from "vitest";

import {
  imagePointToRotatedPoint,
  normalizeTargetViewRotation,
  rotatedImageDimensions,
  rotatedPointToImagePoint,
  rotateTargetView,
  type TargetViewRotation,
} from "@/features/anchor/target-view-rotation";

const dimensions = { width: 400, height: 200 };

describe("uploaded-map view rotation", () => {
  it.each([
    [0, { x: 50, y: 25 }],
    [90, { x: 175, y: 50 }],
    [180, { x: 350, y: 175 }],
    [270, { x: 25, y: 350 }],
  ] as const)("maps an original point into the %i-degree view", (rotation, expected) => {
    expect(
      imagePointToRotatedPoint(
        { x: 50, y: 25 },
        dimensions,
        rotation,
      ),
    ).toEqual(expected);
  });

  it.each([0, 90, 180, 270] as const)(
    "round-trips coordinates through the %i-degree view",
    (rotation) => {
      const original = { x: 137.5, y: 82.25 };
      const displayed = imagePointToRotatedPoint(original, dimensions, rotation);

      expect(
        rotatedPointToImagePoint(displayed, dimensions, rotation),
      ).toEqual(original);
    },
  );

  it("swaps the displayed dimensions for quarter turns", () => {
    expect(rotatedImageDimensions(dimensions, 0)).toEqual(dimensions);
    expect(rotatedImageDimensions(dimensions, 90)).toEqual({ width: 200, height: 400 });
    expect(rotatedImageDimensions(dimensions, 270)).toEqual({ width: 200, height: 400 });
  });

  it("cycles left and right without producing unsupported angles", () => {
    expect(rotateTargetView(0, "left")).toBe(270);
    expect(rotateTargetView(270, "right")).toBe(0);
    expect(rotateTargetView(90, "right")).toBe(180);
  });

  it.each([
    [undefined, 0],
    [null, 0],
    [45, 0],
    [90, 90],
    [270, 270],
  ])("normalizes %s to %i degrees", (value, expected) => {
    expect(normalizeTargetViewRotation(value)).toBe(
      expected as TargetViewRotation,
    );
  });
});
