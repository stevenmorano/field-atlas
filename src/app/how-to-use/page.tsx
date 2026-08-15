import type { Metadata } from "next";

import { HowToUseFieldAtlas } from "@/components/public-info/public-information-pages";

export const metadata: Metadata = {
  title: "How to use Field Atlas",
  description: "A beginner-friendly guide to browsing, locating, comparing, anchoring, saving, and sharing maps in Field Atlas.",
};

export default function HowToUsePage() {
  return <HowToUseFieldAtlas />;
}
