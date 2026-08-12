"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  downloadCloudMapToDevice,
  listCloudMaps,
  syncLocalMapToCloud,
} from "@/features/cloud/cloud-map-service";
import type { CloudMapSummary } from "@/features/cloud/cloud-map-contract";
import { CommunityPublicationDialog } from "@/features/community/community-publication-dialog";
import type { LocalSavedMap } from "@/features/maps/saved-map-types";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type CloudPanelStatus = "unconfigured" | "checking" | "signed-out" | "ready" | "error";

type CloudMapSyncPanelProps = Readonly<{
  localMaps: readonly LocalSavedMap[];
  onLocalLibraryChanged: () => void;
}>;

function cloudDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(timestamp);
}

export function CloudMapSyncPanel({ localMaps, onLocalLibraryChanged }: CloudMapSyncPanelProps) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [status, setStatus] = useState<CloudPanelStatus>(supabase ? "checking" : "unconfigured");
  const [user, setUser] = useState<User | null>(null);
  const [cloudMaps, setCloudMaps] = useState<readonly CloudMapSummary[]>([]);
  const [busyMapId, setBusyMapId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sharingMapId, setSharingMapId] = useState<string | null>(null);

  async function refreshCloudMaps() {
    try {
      setCloudMaps(await listCloudMaps());
      setStatus("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cloud maps could not be loaded.");
      setStatus("error");
    }
  }

  useEffect(() => {
    if (!supabase) {
      return;
    }
    let cancelled = false;
    void supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setUser(data.user);
      if (data.user) {
        void refreshCloudMaps();
      } else {
        setStatus("signed-out");
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        void refreshCloudMaps();
      } else {
        setCloudMaps([]);
        setStatus("signed-out");
      }
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  async function syncMap(map: LocalSavedMap) {
    if (!user) return;
    setBusyMapId(map.id);
    setMessage(`Uploading ${map.metadata.title}…`);
    try {
      const result = await syncLocalMapToCloud(map, user.id);
      if (result.status === "conflict") {
        setMessage(`${map.metadata.title} was preserved as a conflict revision because another device changed it first.`);
      } else if (result.status === "unchanged") {
        setMessage(`${map.metadata.title} is already current in the cloud.`);
      } else {
        setMessage(`${map.metadata.title} is now privately synced.`);
      }
      await refreshCloudMaps();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cloud sync failed.");
    } finally {
      setBusyMapId(null);
    }
  }

  async function syncAllMaps() {
    if (!user || localMaps.length === 0) return;
    setSyncingAll(true);
    try {
      for (const map of localMaps) {
        setBusyMapId(map.id);
        setMessage(`Uploading ${map.metadata.title}…`);
        const result = await syncLocalMapToCloud(map, user.id);
        if (result.status === "conflict") {
          setMessage(`${map.metadata.title} needs conflict review; no remote work was overwritten.`);
        }
      }
      setMessage(`${localMaps.length} ${localMaps.length === 1 ? "map is" : "maps are"} safely represented in the cloud.`);
      await refreshCloudMaps();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cloud sync stopped before every map finished.");
    } finally {
      setBusyMapId(null);
      setSyncingAll(false);
    }
  }

  async function downloadMap(map: CloudMapSummary) {
    if (!user) return;
    setBusyMapId(map.id);
    setMessage(`Downloading ${map.metadata.title}…`);
    try {
      const result = await downloadCloudMapToDevice(map, user.id);
      setMessage(result.added
        ? `${map.metadata.title} is now available on this device.`
        : `${map.metadata.title} is already on this device.`);
      if (result.added) onLocalLibraryChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cloud map download failed.");
    } finally {
      setBusyMapId(null);
    }
  }

  const localIds = new Set(localMaps.map((map) => map.id));
  const cloudOnlyMaps = cloudMaps.filter((map) => !localIds.has(map.id));

  return (
    <section className="cloud-sync-panel" aria-labelledby="cloud-sync-heading">
      <div className="cloud-sync-panel__heading">
        <div>
          <p className="eyebrow">Private cloud</p>
          <h2 id="cloud-sync-heading">Keep the local copy. Add an account copy.</h2>
          <p>Sync is manual, revisioned, and private by default. Live GPS is never included.</p>
        </div>
        {status === "ready" && localMaps.length > 0 ? (
          <button className="button button--signal" type="button" onClick={() => void syncAllMaps()} disabled={syncingAll || busyMapId !== null}>
            {syncingAll ? "Syncing…" : "Sync all local maps"}
          </button>
        ) : null}
      </div>

      {status === "unconfigured" ? (
        <p className="cloud-sync-notice">Cloud code is installed but needs the Supabase and R2 environment values from the setup guide.</p>
      ) : null}
      {status === "checking" ? <p className="cloud-sync-notice">Checking cloud account…</p> : null}
      {status === "signed-out" ? (
        <p className="cloud-sync-notice"><Link href="/account">Sign in</Link> to copy maps privately to your account.</p>
      ) : null}
      {status === "error" ? (
        <p className="cloud-sync-notice cloud-sync-notice--error">Cloud setup is reachable, but its database or image storage is not ready yet.</p>
      ) : null}

      {status === "ready" ? (
        <>
          <div className="cloud-sync-facts">
            <span><strong>{localMaps.length}</strong> on this device</span>
            <span><strong>{cloudMaps.length}</strong> in your account</span>
            <span><strong>{cloudOnlyMaps.length}</strong> available to download</span>
          </div>
          {localMaps.length > 0 ? (
            <ul className="cloud-map-list" aria-label="Local maps available to sync">
              {localMaps.map((map) => {
                const remote = cloudMaps.find((candidate) => candidate.id === map.id);
                return (
                  <li key={map.id}>
                    <div>
                      <strong>{map.metadata.title}</strong>
                      <span>{remote ? `Cloud copy updated ${cloudDate(remote.updatedAt)}` : "Not in your cloud account yet"}</span>
                    </div>
                    <div className="cloud-map-list__actions">
                      <button className="button button--quiet" type="button" onClick={() => void syncMap(map)} disabled={busyMapId !== null || syncingAll}>
                        {busyMapId === map.id ? "Working…" : remote ? "Sync changes" : "Sync privately"}
                      </button>
                      {remote ? (
                        <button className="button button--ink" type="button" onClick={() => setSharingMapId(map.id)} disabled={busyMapId !== null || syncingAll}>
                          Share
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {cloudOnlyMaps.length > 0 ? (
            <div className="cloud-downloads">
              <h3>On your account, not this device</h3>
              <ul className="cloud-map-list">
                {cloudOnlyMaps.map((map) => (
                  <li key={map.id}>
                    <div>
                      <strong>{map.metadata.title}</strong>
                      <span>{map.anchorCount} anchors · {map.imageDimensions.width} × {map.imageDimensions.height}</span>
                    </div>
                    <button className="button button--quiet" type="button" onClick={() => void downloadMap(map)} disabled={busyMapId !== null || syncingAll}>
                      {busyMapId === map.id ? "Downloading…" : "Download to device"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}

      {message ? <p className="cloud-sync-message" role="status">{message}</p> : null}
      <small>Private sync never publishes a map. Sharing is a separate explicit action, and public maps are checked after they go live.</small>

      {sharingMapId ? (() => {
        const map = localMaps.find((candidate) => candidate.id === sharingMapId);
        const remote = cloudMaps.find((candidate) => candidate.id === sharingMapId);
        return map && remote ? <CommunityPublicationDialog map={map} remote={remote} onClose={() => setSharingMapId(null)} /> : null;
      })() : null}
    </section>
  );
}
