import type { Metadata } from "next";

import { AboutFieldAtlas } from "@/components/public-info/public-information-pages";

export const metadata: Metadata = {
  title: "About Field Atlas",
  description: "Why Field Atlas connects historic, trail, illustrated, and personal maps with live browser location.",
};

export default function AboutPage() {
  return <AboutFieldAtlas />;
}
