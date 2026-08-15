import { afterEach, describe, expect, it, vi } from "vitest";

import { loadCloudMapForViewing } from "@/features/cloud/cloud-map-service";

describe("cloud map viewing fallback", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([401, 403, 404, 500, 503])(
    "treats a %s private-cloud response as unavailable to public viewing",
    async (status) => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status }));
      vi.stubGlobal("fetch", fetchMock);

      await expect(loadCloudMapForViewing("public-map-id")).resolves.toBeNull();
      expect(fetchMock).toHaveBeenCalledWith("/api/cloud/maps/public-map-id", { cache: "no-store" });
    },
  );
});
