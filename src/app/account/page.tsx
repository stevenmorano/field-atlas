import { AccountPanel } from "@/features/account/account-panel";

export const metadata = {
  title: "Account",
  description: "Sign in to privately synchronize Field Atlas maps across devices.",
};

export default function AccountPage() {
  return (
    <main className="page-frame account-page" id="main-content">
      <AccountPanel />
    </main>
  );
}
