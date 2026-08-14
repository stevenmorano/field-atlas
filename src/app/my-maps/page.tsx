import { UnifiedMyMapsLibrary } from "@/features/maps/unified-my-maps-library";

export const metadata = {
  title: "My Maps",
  description: "Locally saved map images, details, and anchor data.",
};

export default function MyMapsPage() {
  return <UnifiedMyMapsLibrary />;
}
