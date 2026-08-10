import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Field Atlas",
    short_name: "Field Atlas",
    description: "Put live GPS on any map you can find.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3efe4",
    theme_color: "#f3efe4",
    orientation: "any",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
