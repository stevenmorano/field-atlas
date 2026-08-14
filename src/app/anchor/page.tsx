import { AnchorWorkbench } from "@/features/anchor/anchor-workbench";
import { CreatorAccessGate } from "@/features/account/creator-access-gate";

export const metadata = {
  title: "Anchor lab",
  description: "Match landmarks between an uploaded map and a geographic basemap.",
};

export default function AnchorPage() {
  return (
    <main id="main-content">
      <CreatorAccessGate returnTo="/anchor">
        <AnchorWorkbench />
      </CreatorAccessGate>
    </main>
  );
}
