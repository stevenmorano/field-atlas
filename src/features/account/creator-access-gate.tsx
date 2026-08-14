"use client";

import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type CreatorAccessStatus = "loading" | "signed-out" | "signed-in" | "unconfigured";

type CreatorAccessGateProps = Readonly<{
  children: ReactNode;
  returnTo: string;
}>;

function accountHref(returnTo: string) {
  return `/account?returnTo=${encodeURIComponent(returnTo)}` as Route;
}

export function CreatorAccessGate({ children, returnTo }: CreatorAccessGateProps) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [status, setStatus] = useState<CreatorAccessStatus>(supabase ? "loading" : "unconfigured");

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let cancelled = false;
    void supabase.auth.getUser()
      .then(({ data }) => {
        if (!cancelled) {
          setStatus(data.user ? "signed-in" : "signed-out");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("signed-out");
        }
      });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) {
        setStatus(session?.user ? "signed-in" : "signed-out");
      }
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  if (status === "signed-in") {
    return children;
  }

  if (status === "loading") {
    return (
      <section className="account-card creator-access-card" aria-live="polite">
        <p className="eyebrow">Creator access</p>
        <h1>Checking your account…</h1>
      </section>
    );
  }

  if (status === "unconfigured") {
    return (
      <section className="account-card creator-access-card">
        <p className="eyebrow">Creator access</p>
        <h1>Connect an account before creating a map.</h1>
        <p>
          Field Atlas requires an account before you upload an image or begin anchoring.
          Add the Supabase and R2 values from the cloud setup guide, then return here.
        </p>
        <div className="account-card__actions">
          <Link className="button button--signal" href={accountHref(returnTo)}>Open account</Link>
          <Link className="button button--quiet" href="/">Back to Discover</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="account-card creator-access-card">
      <p className="eyebrow">Creator access</p>
      <h1>Create your account before you start.</h1>
      <p>
        Uploading, anchoring, editing, and creating maps require an account. That way your work
        can be saved locally and backed up when you choose, without surprises at the end.
      </p>
      <div className="account-card__actions">
        <Link className="button button--signal" href={accountHref(returnTo)}>Sign in or create account</Link>
        <Link className="button button--quiet" href="/">Browse maps first</Link>
      </div>
    </section>
  );
}
