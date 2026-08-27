import { describe, expect, it } from "vitest";

import {
  MAX_PUBLIC_IMAGE_EDGE,
  MAX_PUBLIC_IMAGE_INPUT_PIXELS,
  publicImageDimensions,
  scalePublicAnchors,
} from "@/lib/community/public-image-policy";

describe("public image policy", () => {
  it("reduces a large scan to a mobile-safe public derivative", () => {
    expect(publicImageDimensions(13_850, 9_786)).toEqual({ width: 6_000, height: 4_239 });
  });

  it("leaves images within the public edge limit at their original size", () => {
    expect(publicImageDimensions(2_550, 3_300)).toEqual({ width: 2_550, height: 3_300 });
    expect(MAX_PUBLIC_IMAGE_EDGE).toBe(6_000);
  });

  it("rejects sources above the bounded decoder limit", () => {
    expect(() => publicImageDimensions(20_001, 10_000)).toThrow("too large to publish");
    expect(MAX_PUBLIC_IMAGE_INPUT_PIXELS).toBe(200_000_000);
  });

  it("scales only image coordinates and keeps geographic anchors unchanged", () => {
    const anchors = [{
      id: "anchor-1",
      image: { x: 1_000, y: 2_000 },
      geographic: { latitude: 41.1, longitude: -73.6 },
    }] as const;

    expect(scalePublicAnchors(anchors, { width: 10_000, height: 8_000 }, { width: 5_000, height: 4_000 })).toEqual([{
      id: "anchor-1",
      image: { x: 500, y: 1_000 },
      geographic: { latitude: 41.1, longitude: -73.6 },
    }]);
  });
});
