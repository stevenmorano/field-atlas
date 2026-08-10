import type { Metadata } from "next";

import { SavedMapViewer } from "@/features/viewer/saved-map-viewer";

export const metadata: Metadata = {
  title: "Map viewer",
};

export default async function MapViewerPage({
  params,
}: Readonly<{
  params: Promise<{ mapId: string }>;
}>) {
  const { mapId } = await params;
  return <SavedMapViewer mapId={mapId} />;
}

