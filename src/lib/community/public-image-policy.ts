import type { AnchorPair } from "@/lib/georeferencing/types";

// These limits apply only to the public derivative. The private source stays original.
export const MAX_PUBLIC_IMAGE_EDGE = 6_000;
export const MAX_PUBLIC_IMAGE_INPUT_PIXELS = 200_000_000;

export type ImageDimensions = Readonly<{
  width: number;
  height: number;
}>;

export function publicImageDimensions(width: number, height: number): ImageDimensions {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error("The map image dimensions could not be verified.");
  }
  if (width * height > MAX_PUBLIC_IMAGE_INPUT_PIXELS) {
    throw new Error("This image is too large to publish.");
  }

  const scale = Math.min(1, MAX_PUBLIC_IMAGE_EDGE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function scalePublicAnchors(
  anchors: readonly AnchorPair[],
  source: ImageDimensions,
  target: ImageDimensions,
): readonly AnchorPair[] {
  const scaleX = target.width / source.width;
  const scaleY = target.height / source.height;
  return anchors.map((anchor) => ({
    ...anchor,
    image: {
      x: anchor.image.x * scaleX,
      y: anchor.image.y * scaleY,
    },
  }));
}
