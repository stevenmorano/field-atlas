import Link from "next/link";

export const metadata = { title: "Sign-in problem" };

export default function AuthErrorPage() {
  return (
    <main className="page-frame account-page" id="main-content">
      <section className="account-card">
        <p className="eyebrow">Sign-in problem</p>
        <h1>Sign-in could not be completed.</h1>
        <p>Return to your account and try again. If the problem continues, check the provider setup.</p>
        <Link className="button button--signal" href="/account">Return to account</Link>
      </section>
    </main>
  );
}
