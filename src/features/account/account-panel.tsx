"use client";

import type { User } from "@supabase/supabase-js";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { ProfileSettings } from "@/features/community/profile-settings";

type AccountStatus = "loading" | "signed-out" | "signed-in" | "unconfigured";
type AccountMode = "sign-in" | "sign-up";

function requestedReturnPath() {
  const candidate = new URL(window.location.href).searchParams.get("returnTo");
  return candidate?.startsWith("/") && !candidate.startsWith("//") ? candidate : "/my-maps";
}

export function AccountPanel() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [status, setStatus] = useState<AccountStatus>(supabase ? "loading" : "unconfigured");
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<AccountMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let cancelled = false;
    void supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) {
        setUser(data.user);
        setStatus(data.user ? "signed-in" : "signed-out");
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setStatus(session?.user ? "signed-in" : "signed-out");
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  async function submitCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const emailAddress = email.trim();
    if (!supabase || !emailAddress || !password) {
      return;
    }

    if (mode === "sign-up" && password !== confirmPassword) {
      setMessage("Those passwords do not match.");
      return;
    }

    setBusy(true);
    setMessage(null);
    const returnTo = requestedReturnPath();

    if (mode === "sign-in") {
      const { error } = await supabase.auth.signInWithPassword({
        email: emailAddress,
        password,
      });
      setBusy(false);
      if (error) {
        setMessage(error.message);
        return;
      }
      router.push(returnTo as Route);
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: emailAddress,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}` },
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (data.session) {
      router.push(returnTo as Route);
      router.refresh();
      return;
    }
    setMessage("Account created. Check your email once to confirm it, then sign in with your password.");
  }

  async function signOut() {
    if (!supabase) {
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    setBusy(false);
    setMessage(error ? error.message : "Signed out. Your local maps are still on this device.");
  }

  if (status === "unconfigured") {
    return (
      <section className="account-card account-card--setup">
        <p className="eyebrow">Cloud setup</p>
        <h1>Accounts are ready to connect.</h1>
        <p>
          Local maps continue to work normally. Add the Supabase and R2 environment values described
          in the setup guide to enable sign-in and private cloud syncing.
        </p>
        <Link className="button button--ink" href="/my-maps">Keep using local maps</Link>
      </section>
    );
  }

  if (status === "loading") {
    return (
      <section className="account-card" aria-live="polite">
        <p className="eyebrow">Account</p>
        <h1>Checking your account...</h1>
      </section>
    );
  }

  if (status === "signed-in" && user) {
    return (
      <section className="account-card">
        <p className="eyebrow">Signed in</p>
        <h1>Your maps can travel with you.</h1>
        <p className="account-card__identity">{user.email ?? "Field Atlas account"}</p>
        <p>
          Drafts save automatically on this device. Finishing a map backs it up to your account, and
          you can save another checkpoint from My Maps whenever you are ready.
        </p>
        <div className="account-card__actions">
          <Link className="button button--signal" href="/my-maps">Open My Maps</Link>
          <button className="button button--quiet" type="button" onClick={() => void signOut()} disabled={busy}>
            {busy ? "Signing out..." : "Sign out"}
          </button>
        </div>
        <ProfileSettings />
        {message ? <p className="account-message" role="status">{message}</p> : null}
      </section>
    );
  }

  return (
    <section className="account-card">
      <p className="eyebrow">Private cloud account</p>
      <h1>{mode === "sign-in" ? "Welcome back." : "Create your account."}</h1>
      <p>
        Use your email and password. Browsing public maps remains account-free.
      </p>
      <div className="account-mode-switch" role="group" aria-label="Account action">
        <button
          type="button"
          aria-pressed={mode === "sign-in"}
          onClick={() => {
            setMode("sign-in");
            setMessage(null);
          }}
          disabled={busy}
        >
          Sign in
        </button>
        <button
          type="button"
          aria-pressed={mode === "sign-up"}
          onClick={() => {
            setMode("sign-up");
            setMessage(null);
          }}
          disabled={busy}
        >
          Create account
        </button>
      </div>
      <form className="account-form" onSubmit={submitCredentials}>
        <label htmlFor="account-email">
          <span>Email address</span>
          <input
            id="account-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
        </label>
        <label htmlFor="account-password">
          <span>Password</span>
          <input
            id="account-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            minLength={mode === "sign-up" ? 8 : undefined}
            required
          />
        </label>
        {mode === "sign-up" ? (
          <label htmlFor="account-confirm-password">
            <span>Confirm password</span>
            <input
              id="account-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
        ) : null}
        <div className="account-form__actions">
          <button className="button button--signal" type="submit" disabled={busy}>
            {busy ? "Please wait..." : mode === "sign-in" ? "Sign in" : "Create account"}
          </button>
          {mode === "sign-up" ? <span>Use at least 8 characters.</span> : null}
        </div>
      </form>
      {message ? <p className="account-message" role="status">{message}</p> : null}
      <p className="account-card__privacy">Field Atlas never uploads or stores your live GPS position.</p>
    </section>
  );
}
