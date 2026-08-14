import { NewAnchorSession } from "@/features/anchor/new-anchor-session";
import { CreatorAccessGate } from "@/features/account/creator-access-gate";

export const metadata = {
  title: "Start a new map",
  description: "Begin a fresh local map upload and anchoring session.",
};

export default function NewAnchorPage() {
  return (
    <main id="main-content">
      <CreatorAccessGate returnTo="/anchor/new">
        <NewAnchorSession />
      </CreatorAccessGate>
    </main>
  );
}
