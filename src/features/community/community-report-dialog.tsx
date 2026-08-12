"use client";

import { FormEvent, useState } from "react";

import type { ReportCategory } from "@/features/community/community-contract";

type Props = Readonly<{
  mapId: string;
  publicationId: string;
  shareToken: string;
  onClose: () => void;
}>;

export function CommunityReportDialog({ mapId, publicationId, shareToken, onClose }: Props) {
  const [category, setCategory] = useState<ReportCategory>("gps_inaccurate");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/community/maps/${mapId}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicationId, category, note, shareToken, website: form.get("website") ?? "" }),
      });
      const body = await response.json() as { error?: unknown };
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Report could not be sent.");
      setMessage("Thanks. The report is in the review queue.");
      setNote("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Report could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="community-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <section className="community-dialog community-report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-map-title">
        <header>
          <div>
            <p className="eyebrow">Anonymous reports welcome</p>
            <h2 id="report-map-title">Report a map problem</h2>
          </div>
          <button className="dialog-close" type="button" onClick={onClose} disabled={busy} aria-label="Close">x</button>
        </header>
        <p>You do not need an account. Reports help the uploader and administrator fix inaccurate or unsuitable maps.</p>
        <form onSubmit={submit}>
          <label className="community-field">
            <span>Problem</span>
            <select value={category} onChange={(event) => setCategory(event.target.value as ReportCategory)}>
              <option value="gps_inaccurate">GPS or anchors are inaccurate</option>
              <option value="bad_quality">Image quality is poor</option>
              <option value="wrong_details">Title, year, place, or details are wrong</option>
              <option value="duplicate">This duplicates another map</option>
              <option value="copyright">Copyright or permission concern</option>
              <option value="unsafe_or_abusive">Unsafe, abusive, or inappropriate</option>
              <option value="other">Something else</option>
            </select>
          </label>
          <label className="community-field">
            <span>Helpful details (optional)</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={4} placeholder="Where did you notice the problem?" />
          </label>
          <label className="report-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
          <div className="community-dialog__actions">
            <button className="button button--signal" type="submit" disabled={busy}>{busy ? "Sending..." : "Send report"}</button>
            <button className="button button--quiet" type="button" onClick={onClose} disabled={busy}>Cancel</button>
          </div>
        </form>
        {message ? <p className="community-dialog__message" role="status">{message}</p> : null}
      </section>
    </div>
  );
}
