import type { ImagePoint } from "@/lib/georeferencing/types";

export type TargetViewRotation = 0 | 90 | 180 | 270;

type ImageDimensions = Readonly<{ width: number; height: number }>;

export function normalizeTargetViewRotation(value: unknown): TargetViewRotation {
  return value === 90 || value === 180 || value === 270 ? value : 0;
}

export function rotateTargetView(
  rotation: TargetViewRotation,
  direction: "left" | "right",
): TargetViewRotation {
  const delta = direction === "right" ? 90 : 270;
  return normalizeTargetViewRotation((rotation + delta) % 360);
}

export function rotatedImageDimensions(
  dimensions: ImageDimensions,
  rotation: TargetViewRotation,
) {
  return rotation === 90 || rotation === 270
    ? { width: dimensions.height, height: dimensions.width }
    : dimensions;
}

export function imagePointToRotatedPoint(
  point: ImagePoint,
  dimensions: ImageDimensions,
  rotation: TargetViewRotation,
): ImagePoint {
  if (rotation === 90) {
    return { x: dimensions.height - point.y, y: point.x };
  }
  if (rotation === 180) {
    return {
      x: dimensions.width - point.x,
      y: dimensions.height - point.y,
    };
  }
  if (rotation === 270) {
    return { x: point.y, y: dimensions.width - point.x };
  }
  return point;
}

export function rotatedPointToImagePoint(
  point: ImagePoint,
  dimensions: ImageDimensions,
  rotation: TargetViewRotation,
): ImagePoint {
  if (rotation === 90) {
    return { x: point.y, y: dimensions.height - point.x };
  }
  if (rotation === 180) {
    return {
      x: dimensions.width - point.x,
      y: dimensions.height - point.y,
    };
  }
  if (rotation === 270) {
    return { x: dimensions.width - point.y, y: point.x };
  }
  return point;
}
