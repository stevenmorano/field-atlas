import type { Metadata } from "next";

import { SavedMapCompare } from "@/features/compare/saved-map-compare";

export const metadata: Metadata = {
  title: "Compare map",
};

export default async function MapComparePage({
  params,
}: Readonly<{
  params: Promise<{ mapId: string }>;
}>) {
  const { mapId } = await params;
  return <SavedMapCompare mapId={mapId} />;
}
