import type { Metadata } from "next";

import { PublicChangelog } from "@/components/public-info/public-information-pages";

export const metadata: Metadata = {
  title: "Changelog",
  description: "A plain-language record of Field Atlas features and improvements.",
};

export default function ChangelogPage() {
  return <PublicChangelog />;
}
