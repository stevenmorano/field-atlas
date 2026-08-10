import { AnchorWorkbench } from "@/features/anchor/anchor-workbench";

export const metadata = {
  title: "Anchor lab",
  description: "Match landmarks between an uploaded map and a geographic basemap.",
};

export default function AnchorPage() {
  return (
    <main id="main-content">
      <AnchorWorkbench />
    </main>
  );
}
