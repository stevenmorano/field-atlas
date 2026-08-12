"use client";

import type { Route } from "next";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Profile = Readonly<{
  username: string;
  bio: string;
  avatarSeed: string;
  role: "admin" | "moderator" | null;
}>;

export function ProfileSettings() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/community/profile", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as Profile & { error?: string };
        if (!response.ok) throw new Error(body.error || "Profile could not be loaded.");
        return body;
      })
      .then((body) => {
        if (cancelled) return;
        setProfile(body);
        setUsername(body.username);
        setBio(body.bio);
      })
      .catch((error: unknown) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Profile could not be loaded.");
      });
    return () => { cancelled = true; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/community/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, bio }),
      });
      const body = await response.json() as { username?: string; bio?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "Profile could not be saved.");
      const next = { ...profile!, username: body.username ?? username, bio: body.bio ?? bio };
      setProfile(next);
      setUsername(next.username);
      setBio(next.bio);
      setMessage("Public profile saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Profile could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="profile-settings" aria-labelledby="profile-settings-title">
      <div>
        <p className="eyebrow">Community identity</p>
        <h2 id="profile-settings-title">Your public username</h2>
        <p>Your email is never shown publicly. A generated username is used until you choose one.</p>
      </div>
      {profile ? (
        <form onSubmit={save}>
          <label className="community-field">
            <span>Username</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={30} pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,29}" required />
          </label>
          <label className="community-field">
            <span>Short bio (optional)</span>
            <textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={280} rows={3} />
          </label>
          <div className="profile-settings__actions">
            <button className="button button--signal" type="submit" disabled={busy}>{busy ? "Saving..." : "Save profile"}</button>
            <Link className="button button--quiet" href={`/profiles/${profile.username}` as Route}>View public profile</Link>
            {profile.role ? <Link className="button button--ink" href={"/moderation" as Route}>Open moderation</Link> : null}
          </div>
        </form>
      ) : null}
      {message ? <p className="account-message" role="status">{message}</p> : null}
    </section>
  );
}
