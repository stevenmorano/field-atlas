"use client";

import Link from "next/link";
import type { Route } from "next";
import { FormEvent, useEffect, useState } from "react";

import type { CloudMapSummary } from "@/features/cloud/cloud-map-contract";
import {
  publicationMatchesSettings,
  publicationModerationLabel,
  type OwnerPublicationStatus,
  type PublicationVisibility,
  type RightsBasis,
} from "@/features/community/community-contract";
import type { LocalSavedMap } from "@/features/maps/saved-map-types";

type Props = Readonly<{
  map: LocalSavedMap;
  remote: CloudMapSummary;
  onClose: () => void;
}>;

async function responseBody(response: Response) {
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Community request failed.");
  return body;
}

function createShareToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function CommunityPublicationDialog({ map, remote, onClose }: Props) {
  const [status, setStatus] = useState<OwnerPublicationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [visibility, setVisibility] = useState<PublicationVisibility>("public");
  const [rightsBasis, setRightsBasis] = useState<RightsBasis>("own_or_authorized");
  const [sourceUrl, setSourceUrl] = useState(map.metadata.source);
  const [licenseName, setLicenseName] = useState("");
  const [attribution, setAttribution] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sharePath, setSharePath] = useState<string | null>(null);
  const [publishedVisibility, setPublishedVisibility] = useState<PublicationVisibility | null>(null);
  const [publicationRequestId, setPublicationRequestId] = useState<string | null>(null);
  const [unlistedShareToken, setUnlistedShareToken] = useState<string | null>(null);

  async function refreshStatus() {
    setLoading(true);
    try {
      const body = await responseBody(await fetch(`/api/community/maps/${map.id}/status`, { cache: "no-store" }));
      const nextStatus = body as unknown as OwnerPublicationStatus;
      setStatus(nextStatus);
      if (nextStatus.publication) {
        setVisibility(nextStatus.publication.visibility);
        setRightsBasis(nextStatus.publication.rightsBasis);
        setSourceUrl(nextStatus.publication.sourceUrl);
        setLicenseName(nextStatus.publication.licenseName);
        setAttribution(nextStatus.publication.attribution);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sharing status could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/community/maps/${map.id}/status`, { cache: "no-store" })
      .then(responseBody)
      .then((body) => {
        if (cancelled) return;
        const nextStatus = body as unknown as OwnerPublicationStatus;
        setStatus(nextStatus);
        if (nextStatus.publication) {
          setVisibility(nextStatus.publication.visibility);
          setRightsBasis(nextStatus.publication.rightsBasis);
          setSourceUrl(nextStatus.publication.sourceUrl);
          setLicenseName(nextStatus.publication.licenseName);
          setAttribution(nextStatus.publication.attribution);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Sharing status could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [map.id]);

  const cloudIsCurrent = remote.clientUpdatedAt >= map.updatedAt;
  const publicationUnchanged = publicationMatchesSettings(status?.publication ?? null, status?.currentRevisionId ?? null, {
    visibility,
    rightsBasis,
    sourceUrl,
    licenseName,
    attribution,
  });

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed || !status || !cloudIsCurrent) return;
    setBusy(true);
    setMessage("Preparing a safe public image copy. Large maps can take a moment...");
    setSharePath(null);
    setPublishedVisibility(null);
    const requestId = publicationRequestId ?? crypto.randomUUID();
    const shareToken = visibility === "unlisted" ? unlistedShareToken ?? createShareToken() : null;
    setPublicationRequestId(requestId);
    if (shareToken) setUnlistedShareToken(shareToken);
    try {
      const body = await responseBody(await fetch(`/api/community/maps/${map.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visibility,
          rightsBasis,
          sourceUrl,
          licenseName,
          attribution,
          shareToken,
          idempotencyKey: requestId,
          expectedPublicationId: status.currentPublicationId,
        }),
      }));
      const path = typeof body.sharePath === "string" ? body.sharePath : `/maps/${map.id}`;
      setSharePath(path);
      setPublishedVisibility(visibility);
      setMessage(null);
      await refreshStatus();
      setPublicationRequestId(null);
      setUnlistedShareToken(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Map could not be published.");
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    if (!status?.currentPublicationId) return;
    setBusy(true);
    setMessage(null);
    try {
      await responseBody(await fetch(`/api/community/maps/${map.id}/unpublish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedPublicationId: status.currentPublicationId }),
      }));
      setSharePath(null);
      setPublishedVisibility(null);
      setMessage("The shared copy is private again. Your private cloud and local copies were not changed.");
      await refreshStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Map could not be made private.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!sharePath) return;
    await navigator.clipboard.writeText(`${window.location.origin}${sharePath}`);
    setMessage("Share link copied.");
  }

  function changeSharingSettings() {
    setSharePath(null);
    setPublishedVisibility(null);
    setMessage(null);
    setConfirmed(false);
  }

  return (
    <div className="community-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <section className="community-dialog" role="dialog" aria-modal="true" aria-labelledby="community-dialog-title">
        <header>
          <div>
            <p className="eyebrow">{sharePath ? "Sharing complete" : "Community sharing"}</p>
            <h2 id="community-dialog-title">
              {sharePath
                ? `${map.metadata.title} is now ${publishedVisibility === "public" ? "public" : "shared"}`
                : `Share ${map.metadata.title}`}
            </h2>
          </div>
          <button className="dialog-close" type="button" onClick={onClose} disabled={busy} aria-label="Close">x</button>
        </header>

        {sharePath && publishedVisibility ? (
          <section className="community-publish-success" aria-labelledby="community-publish-success-title">
            <span className="community-publish-success__mark" aria-hidden="true">✓</span>
            <div>
              <p className="eyebrow">{publishedVisibility === "public" ? "Live in Discover" : "Unlisted link ready"}</p>
              <h3 id="community-publish-success-title">
                {publishedVisibility === "public" ? "Anyone can find and open it now." : "Anyone with the link can open it now."}
              </h3>
              <p>
                {publishedVisibility === "public"
                  ? "The map is also in the routine review queue."
                  : "It will not appear in Discover unless you make it public later."} Your local map and private cloud copy are unchanged.
              </p>
            </div>
            <div className="community-publish-success__actions">
              <Link className="button button--signal" href={sharePath as Route}>Open shared map</Link>
              <button className="button button--ink" type="button" onClick={() => void copyLink()}>Copy link</button>
              {publishedVisibility === "public" ? <Link className="button button--quiet" href="/">See it in Discover</Link> : null}
              <button className="button button--quiet" type="button" onClick={onClose}>Done</button>
            </div>
            <button className="community-publish-success__change" type="button" onClick={changeSharingSettings}>Change sharing settings</button>
            {message ? <p className="community-dialog__message" role="status">{message}</p> : null}
          </section>
        ) : (
          <>
            {loading ? <p className="community-dialog__notice">Checking the current shared version...</p> : null}
            {!cloudIsCurrent ? (
              <p className="community-dialog__notice community-dialog__notice--warning">Sync changes first. The private cloud revision is older than this device copy.</p>
            ) : null}
            {status?.publicationHold ? (
              <p className="community-dialog__notice community-dialog__notice--warning">This map is hidden by moderation: {status.publicationHoldReason || "contact the site administrator."}</p>
            ) : null}
            {status?.publication ? (
              <div className="community-dialog__current">
                <span>Currently {status.publication.visibility}</span>
                <strong>{publicationModerationLabel(status.publication.visibility, status.publication.moderationStatus)}</strong>
                {status.publicationHold || status.publication.moderationStatus === "hidden"
                  ? <span>Anonymous access is suspended until an administrator restores the map.</span>
                  : status.publication.visibility === "public"
                    ? <Link href={`/maps/${map.id}`}>Open shared map</Link>
                    : <span>The existing private link remains active.</span>}
              </div>
            ) : null}
            {publicationUnchanged ? (
              <p className="community-dialog__notice community-dialog__notice--complete">
                <strong>Already published.</strong> Nothing has changed, so no duplicate public copy will be created. Change a sharing choice here, or sync updated anchors, details, or imagery first.
              </p>
            ) : null}

            <form onSubmit={publish}>
          <fieldset>
            <legend>Who can open it?</legend>
            <label className="community-choice">
              <input type="radio" name="visibility" value="public" checked={visibility === "public"} onChange={() => setVisibility("public")} />
              <span><strong>Public</strong> Listed in Discover and open without an account.</span>
            </label>
            <label className="community-choice">
              <input type="radio" name="visibility" value="unlisted" checked={visibility === "unlisted"} onChange={() => setVisibility("unlisted")} />
              <span><strong>Unlisted</strong> Open immediately to anyone with its private link.</span>
            </label>
          </fieldset>

          <label className="community-field">
            <span>Why can you share it?</span>
            <select value={rightsBasis} onChange={(event) => setRightsBasis(event.target.value as RightsBasis)}>
              <option value="own_or_authorized">I made it or am authorized to share it</option>
              <option value="permission">I have permission</option>
              <option value="public_domain">It is public domain</option>
              <option value="open_license">It has an open license</option>
            </select>
          </label>
          {rightsBasis === "open_license" ? (
            <label className="community-field">
              <span>License name</span>
              <input value={licenseName} onChange={(event) => setLicenseName(event.target.value)} required maxLength={500} placeholder="Example: CC BY 4.0" />
            </label>
          ) : null}
          <label className="community-field">
            <span>Source link {rightsBasis === "public_domain" || rightsBasis === "open_license" ? "(required)" : "(recommended)"}</span>
            <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} maxLength={2000} required={rightsBasis === "public_domain" || rightsBasis === "open_license"} placeholder="https://..." />
          </label>
          <label className="community-field">
            <span>Credit or attribution (optional)</span>
            <textarea value={attribution} onChange={(event) => setAttribution(event.target.value)} maxLength={2000} rows={2} />
          </label>
          <label className="community-confirmation">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
            <span>I understand this creates a separate shared copy that other people can open now. My original stays private.</span>
          </label>

          <div className="community-dialog__actions">
            <button className="button button--signal" type="submit" disabled={busy || loading || !confirmed || !cloudIsCurrent || status?.publicationHold === true || publicationUnchanged}>
              {busy ? "Preparing..." : publicationUnchanged ? "Already published" : visibility === "public" ? "Publish publicly now" : "Create unlisted link now"}
            </button>
            {status?.currentPublicationId ? <button className="button button--quiet" type="button" onClick={() => void unpublish()} disabled={busy || status.publicationHold} title={status.publicationHold ? "An administrator must restore this map before sharing can change." : undefined}>Make private</button> : null}
            <button className="button button--quiet" type="button" onClick={onClose} disabled={busy}>Cancel</button>
          </div>
            </form>
            {message ? <p className="community-dialog__message" role="status">{message}</p> : null}
          </>
        )}
      </section>
    </div>
  );
}
