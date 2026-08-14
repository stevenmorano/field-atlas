import { describe, expect, it } from "vitest";

import { compareMapHref } from "@/features/viewer/map-links";

describe("map links", () => {
  it("preserves an unlisted share token when opening Compare", () => {
    expect(compareMapHref("map-123", "token with spaces")).toBe(
      "/maps/map-123/compare?share=token%20with%20spaces",
    );
  });

  it("opens listed maps without a share query", () => {
    expect(compareMapHref("map-123")).toBe("/maps/map-123/compare");
  });
});
