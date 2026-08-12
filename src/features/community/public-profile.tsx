"use client";

import Image from "next/image";
import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";

type ProfileMap = Readonly<{
  mapId: string;
  publicationId: string;
  publicAssetId: string;
  title: string;
  placeName: string;
  subject: string;
  mapYear: number | null;
  anchorCount: number;
  adminChecked: boolean;
  publishedAt: string;
}>;

type Profile = Readonly<{
  username: string;
  avatarSeed: string;
  bio: string;
  publicMapCount: number;
  adminCheckedCount: number;
  milestones: readonly string[];
  maps: readonly ProfileMap[];
}>;

export function PublicProfile({ username }: Readonly<{ username: string }>) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/community/profiles/${encodeURIComponent(username)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Profile not found");
        return response.json() as Promise<Profile>;
      })
      .then((body) => { if (!cancelled) setProfile(body); })
      .catch(() => { if (!cancelled) setMissing(true); });
    return () => { cancelled = true; };
  }, [username]);

  if (missing) return <main className="saved-map-viewer-state"><p className="eyebrow">Community profile</p><h1>That mapmaker was not found.</h1><Link className="button button--ink" href="/">Back to Discover</Link></main>;
  if (!profile) return <main className="saved-map-viewer-state"><div className="map-library-loading" /><h1>Opening profile...</h1></main>;

  return (
    <main className="page-frame public-profile-page" id="main-content">
      <section className="public-profile-hero">
        <div className="public-profile-avatar" style={{ "--avatar-hue": Number.parseInt(profile.avatarSeed.slice(0, 4), 16) % 360 } as React.CSSProperties} aria-hidden="true">{profile.username.slice(0, 2).toUpperCase()}</div>
        <div><p className="eyebrow">Community mapmaker</p><h1>{profile.username}</h1><p>{profile.bio || "Sharing maps for others to explore."}</p></div>
        <dl><div><dt>Public maps</dt><dd>{profile.publicMapCount}</dd></div><div><dt>Admin checked</dt><dd>{profile.adminCheckedCount}</dd></div></dl>
      </section>
      {profile.milestones.length > 0 ? <ul className="profile-milestones" aria-label="Milestones">{profile.milestones.map((item) => <li key={item}>{item === "first_public_map" ? "First public map" : "Five maps shared"}</li>)}</ul> : null}
      <section aria-labelledby="profile-maps-heading">
        <p className="eyebrow">Contributions</p><h2 id="profile-maps-heading">Maps shared by {profile.username}</h2>
        {profile.maps.length > 0 ? <div className="profile-map-grid">{profile.maps.map((map) => (
          <article key={map.publicationId}>
            <Link className="profile-map-preview" href={`/maps/${map.mapId}` as Route}><Image src={`/api/community/assets/${map.publicAssetId}?variant=thumbnail`} alt="" fill unoptimized sizes="(min-width: 60rem) 30vw, 100vw" /></Link>
            <div><p>{map.subject}{map.mapYear ? ` - ${map.mapYear}` : ""}</p><h3><Link href={`/maps/${map.mapId}` as Route}>{map.title}</Link></h3><span>{map.anchorCount} anchors {map.adminChecked ? "- Admin checked" : ""}</span></div>
          </article>
        ))}</div> : <p>No public maps yet.</p>}
      </section>
    </main>
  );
}
