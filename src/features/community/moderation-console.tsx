"use client";

import type { Route } from "next";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import type { ModerationAction } from "@/features/community/community-contract";

type Report = Readonly<{ id: string; category: string; note: string; createdAt: string }>;
type QueueItem = Readonly<{
  publicationId: string;
  mapId: string;
  title: string;
  username: string;
  moderationStatus: string;
  publishedAt: string;
  reportCount: number;
  reports: readonly Report[];
}>;

type PendingModeration = Readonly<{
  item: QueueItem;
  action: Exclude<ModerationAction, "admin_checked">;
}>;

function actionTitle(action: PendingModeration["action"]) {
  if (action === "changes_requested") return "Request changes";
  if (action === "hidden") return "Hide map and block new publishing";
  return "Restore map";
}

export function ModerationConsole() {
  const [items, setItems] = useState<readonly QueueItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "forbidden" | "error">("loading");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingModeration, setPendingModeration] = useState<PendingModeration | null>(null);
  const [reason, setReason] = useState("");

  async function loadQueue() {
    const response = await fetch("/api/community/moderation", { cache: "no-store" });
    if (response.status === 403) {
      setStatus("forbidden");
      return;
    }
    if (!response.ok) throw new Error("Moderation queue could not be loaded.");
    setItems(await response.json() as readonly QueueItem[]);
    setStatus("ready");
  }

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/community/moderation", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 403) return { forbidden: true, items: [] as readonly QueueItem[] };
        if (!response.ok) throw new Error("Moderation queue could not be loaded.");
        return { forbidden: false, items: await response.json() as readonly QueueItem[] };
      })
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setStatus(result.forbidden ? "forbidden" : "ready");
      })
      .catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; };
  }, []);

  async function moderate(item: QueueItem, action: ModerationAction, actionReason = "") {
    setBusyId(item.publicationId);
    setMessage(null);
    try {
      const response = await fetch("/api/community/moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicationId: item.publicationId, action, reason: actionReason }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Moderation action failed.");
      setMessage(action === "admin_checked" ? "Map marked as checked." : action === "restored" ? "Map restored to the review queue." : "Moderation action saved.");
      setPendingModeration(null);
      setReason("");
      await loadQueue();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Moderation action failed.");
    } finally {
      setBusyId(null);
    }
  }

  function beginModeration(item: QueueItem, action: PendingModeration["action"]) {
    setPendingModeration({ item, action });
    setReason("");
    setMessage(null);
  }

  function submitModeration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingModeration || !reason.trim()) return;
    void moderate(pendingModeration.item, pendingModeration.action, reason.trim());
  }

  if (status === "loading") return <main className="saved-map-viewer-state"><div className="map-library-loading" /><h1>Opening moderation...</h1></main>;
  if (status === "forbidden") return <main className="saved-map-viewer-state"><p className="eyebrow">Moderation</p><h1>Staff access is required.</h1><Link className="button button--ink" href="/account">Back to account</Link></main>;
  if (status === "error") return <main className="saved-map-viewer-state"><p className="eyebrow">Moderation</p><h1>The queue could not be loaded.</h1></main>;

  return (
    <main className="page-frame moderation-page" id="main-content">
      <section className="moderation-hero"><p className="eyebrow">Post-publication review</p><h1>Community map queue</h1><p>Maps are already live unless hidden. Check ordinary submissions, prioritize reports, and leave a reason for corrective actions.</p></section>
      {items.length === 0 ? <section className="map-library-empty"><h2>The queue is clear.</h2></section> : (
        <section className="moderation-list" aria-label="Maps awaiting review">{items.map((item) => (
          <article key={item.publicationId}>
            <div><p className="eyebrow">{item.reportCount > 0 ? `${item.reportCount} open ${item.reportCount === 1 ? "report" : "reports"}` : "Routine check"}</p><h2>{item.title}</h2><p>Shared by <Link href={`/profiles/${item.username}` as Route}>{item.username}</Link></p></div>
            <div className="moderation-list__actions">
              {item.moderationStatus !== "hidden" ? <Link className="button button--quiet" href={`/maps/${item.mapId}` as Route}>Open map</Link> : null}
              {item.moderationStatus === "hidden" ? (
                <button className="button button--signal" type="button" onClick={() => beginModeration(item, "restored")} disabled={busyId !== null}>Restore map</button>
              ) : (
                <>
                  <button className="button button--signal" type="button" onClick={() => void moderate(item, "admin_checked")} disabled={busyId !== null}>Mark checked</button>
                  <button className="button button--quiet" type="button" onClick={() => beginModeration(item, "changes_requested")} disabled={busyId !== null}>Request changes</button>
                  <button className="button button--ink" type="button" onClick={() => beginModeration(item, "hidden")} disabled={busyId !== null}>Hide map</button>
                </>
              )}
            </div>
            {item.reports.length > 0 ? <ul>{item.reports.map((report) => <li key={report.id}><strong>{report.category.replaceAll("_", " ")}</strong>{report.note ? <span>{report.note}</span> : null}</li>)}</ul> : null}
          </article>
        ))}</section>
      )}
      {message ? <p className="account-message" role="status">{message}</p> : null}
      {pendingModeration ? (
        <div className="community-dialog-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && busyId === null) setPendingModeration(null);
        }}>
          <section className="community-dialog" role="dialog" aria-modal="true" aria-labelledby="moderation-action-title">
            <header>
              <div>
                <p className="eyebrow">Administrator action</p>
                <h2 id="moderation-action-title">{actionTitle(pendingModeration.action)}</h2>
              </div>
              <button className="dialog-close" type="button" onClick={() => setPendingModeration(null)} disabled={busyId !== null} aria-label="Close">x</button>
            </header>
            <p>
              {pendingModeration.action === "hidden"
                ? "This removes anonymous access and places the whole map on hold until an administrator restores it."
                : pendingModeration.action === "restored"
                  ? "This clears the map-level hold, resumes anonymous access, and returns the publication to routine review."
                  : "The publication remains accessible while the owner sees that updates were requested."}
            </p>
            <form onSubmit={submitModeration}>
              <label className="community-field">
                <span>Reason for the owner</span>
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} rows={4} required autoFocus />
              </label>
              <div className="community-dialog__actions">
                <button className="button button--signal" type="submit" disabled={busyId !== null || !reason.trim()}>{busyId ? "Saving..." : actionTitle(pendingModeration.action)}</button>
                <button className="button button--quiet" type="button" onClick={() => setPendingModeration(null)} disabled={busyId !== null}>Cancel</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
