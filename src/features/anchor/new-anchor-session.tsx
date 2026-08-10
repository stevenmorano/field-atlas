"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AnchorWorkbench } from "@/features/anchor/anchor-workbench";
import {
  deleteCurrentAnchorDraft,
  readCurrentAnchorDraft,
  type LocalAnchorDraft,
} from "@/features/anchor/local-draft-store";

type NewSessionStatus = "loading" | "confirm" | "starting" | "fresh" | "error";

export function NewAnchorSession() {
  const [status, setStatus] = useState<NewSessionStatus>("loading");
  const [currentDraft, setCurrentDraft] = useState<LocalAnchorDraft | null>(null);

  useEffect(() => {
    let cancelled = false;

    void readCurrentAnchorDraft()
      .then((draft) => {
        if (cancelled) {
          return;
        }
        setCurrentDraft(draft);
        setStatus(draft ? "confirm" : "fresh");
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function startFreshMap() {
    setStatus("starting");
    try {
      await deleteCurrentAnchorDraft();
      setCurrentDraft(null);
      setStatus("fresh");
    } catch {
      setStatus("error");
    }
  }

  if (status === "fresh") {
    return <AnchorWorkbench startFresh />;
  }

  if (status === "loading" || status === "starting") {
    return (
      <section className="new-map-gate" aria-live="polite">
        <p className="eyebrow">New map</p>
        <h1>{status === "starting" ? "Preparing a fresh workspace…" : "Checking your current draft…"}</h1>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="new-map-gate" role="alert">
        <p className="eyebrow">New map</p>
        <h1>Your current draft could not be checked safely.</h1>
        <p>Nothing was removed. Return to Anchor Lab to make sure your work is still available.</p>
        <Link className="button button--ink" href="/anchor">Return to Anchor Lab</Link>
      </section>
    );
  }

  return (
    <section className="new-map-gate">
      <p className="eyebrow">New map</p>
      <h1>Start a fresh map?</h1>
      <p>
        <strong>{currentDraft?.imageName}</strong> is still the active Anchor Lab draft.
        {currentDraft?.savedMapId
          ? " Its finished copy and anchors are safe in My Maps."
          : " It has not been finished to My Maps, so starting fresh will replace this draft."}
      </p>
      <div className="new-map-gate__actions">
        <button className="button button--signal" type="button" onClick={() => void startFreshMap()}>
          Start fresh map
        </button>
        <Link className="button button--quiet" href="/anchor">Continue current map</Link>
        <Link className="text-button" href="/my-maps">Open My Maps</Link>
      </div>
    </section>
  );
}

