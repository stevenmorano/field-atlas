import { NewAnchorSession } from "@/features/anchor/new-anchor-session";

export const metadata = {
  title: "Start a new map",
  description: "Begin a fresh local map upload and anchoring session.",
};

export default function NewAnchorPage() {
  return (
    <main id="main-content">
      <NewAnchorSession />
    </main>
  );
}

