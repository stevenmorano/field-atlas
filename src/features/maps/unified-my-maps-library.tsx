"use client";

import Image from "next/image";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { readCurrentAnchorDraft, type LocalAnchorDraft } from "@/features/anchor/local-draft-store";
import { MapBackupControls } from "@/features/backup/map-backup-controls";
import {
  downloadCloudMapToDevice,
  listCloudMaps,
  syncLocalMapToCloud,
} from "@/features/cloud/cloud-map-service";
import type { CloudMapSummary } from "@/features/cloud/cloud-map-contract";
import { formatCloudUpdatedAt } from "@/features/cloud/cloud-date";
import { CommunityPublicationDialog } from "@/features/community/community-publication-dialog";
import {
  deleteSavedMap,
  listSavedMaps,
} from "@/features/maps/local-saved-map-store";
import type { LocalSavedMap } from "@/features/maps/saved-map-types";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type LibraryStatus = "loading" | "ready" | "error";
type CloudStatus = "unconfigured" | "checking" | "signed-out" | "ready" | "error";

type LocalEntry = Readonly<{
  kind: "local";
  map: LocalSavedMap;
  remote: CloudMapSummary | null;
}>;

type CloudEntry = Readonly<{
  kind: "cloud";
  map: CloudMapSummary;
}>;

type LibraryEntry = LocalEntry | CloudEntry;

function currentTimestamp() {
  return Date.now();
}

function formatMapDate(map: Pick<LocalSavedMap, "metadata"> | Pick<CloudMapSummary, "metadata">) {
  if (map.metadata.mapDateKind === "current") {
    return "Current map";
  }
  if (map.metadata.mapDateKind === "exact" && map.metadata.mapYear !== null) {
    return map.metadata.mapYear.toString();
  }
  if (map.metadata.mapDateKind === "approximate" && map.metadata.mapYear !== null) {
    return "About " + map.metadata.mapYear.toString();
  }
  return "Date unknown";
}

function formatUpdatedAt(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(timestamp);
}

function visibilityLabel(entry: LibraryEntry) {
  if (entry.kind === "cloud") {
    if (entry.map.publicationStatus === "published") return "Public";
    if (entry.map.publicationStatus === "pending_review") return "Pending review";
    if (entry.map.publicationStatus === "rejected") return "Private";
  }

  return entry.map.metadata.visibility === "private" ? "Private" : "Ready to share";
}

function entryUpdatedAt(entry: LibraryEntry) {
  return entry.kind === "local" ? entry.map.updatedAt : entry.map.clientUpdatedAt;
}

function entrySearchValues(entry: LibraryEntry) {
  const map = entry.map;
  return [
    map.metadata.title,
    map.metadata.placeName,
    map.metadata.subject,
    map.metadata.visualStyle,
    map.metadata.description,
    formatMapDate(map),
    ...map.metadata.activities,
  ];
}

export function UnifiedMyMapsLibrary() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [maps, setMaps] = useState<readonly LocalSavedMap[]>([]);
  const [draft, setDraft] = useState<LocalAnchorDraft | null>(null);
  const [previewUrls, setPreviewUrls] = useState<ReadonlyMap<string, string>>(new Map());
  const [draftPreviewUrl, setDraftPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<LibraryStatus>("loading");
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>(supabase ? "checking" : "unconfigured");
  const [cloudMaps, setCloudMaps] = useState<readonly CloudMapSummary[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openingMapId, setOpeningMapId] = useState<string | null>(null);
  const [busyMapId, setBusyMapId] = useState<string | null>(null);
  const [libraryMessage, setLibraryMessage] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [sharingMapId, setSharingMapId] = useState<string | null>(null);
  const [libraryVersion, setLibraryVersion] = useState(0);
  const lastCloudSaveAtRef = useRef<ReadonlyMap<string, number>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const createdUrls: string[] = [];
    let createdDraftUrl: string | null = null;

    void Promise.all([listSavedMaps(), readCurrentAnchorDraft()])
      .then(([savedMaps, currentDraft]) => {
        if (cancelled) {
          return;
        }

        const nextPreviewUrls = new Map<string, string>();
        for (const map of savedMaps) {
          const url = URL.createObjectURL(map.imageBlob);
          createdUrls.push(url);
          nextPreviewUrls.set(map.id, url);
        }
        if (currentDraft) {
          createdDraftUrl = URL.createObjectURL(currentDraft.imageBlob);
        }

        setMaps(savedMaps);
        setDraft(currentDraft);
        setPreviewUrls(nextPreviewUrls);
        setDraftPreviewUrl(createdDraftUrl);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
      for (const url of createdUrls) {
        URL.revokeObjectURL(url);
      }
      if (createdDraftUrl) {
        URL.revokeObjectURL(createdDraftUrl);
      }
    };
  }, [libraryVersion]);

  const refreshCloudMaps = useCallback(async (requestedUserId?: string | null) => {
    const activeUserId = requestedUserId === undefined ? userId : requestedUserId;
    if (!supabase || !activeUserId) {
      return;
    }

    setCloudStatus("checking");
    try {
      setCloudMaps(await listCloudMaps());
      setCloudStatus("ready");
    } catch (error) {
      setCloudStatus("error");
      setLibraryMessage(error instanceof Error ? error.message : "Your account maps could not be refreshed.");
    }
  }, [supabase, userId]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let cancelled = false;
    void supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setUserId(data.user?.id ?? null);
      if (data.user) {
        void refreshCloudMaps(data.user.id);
      } else {
        setCloudMaps([]);
        setCloudStatus("signed-out");
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      const nextUserId = session?.user?.id ?? null;
      setUserId(nextUserId);
      if (nextUserId) {
        void refreshCloudMaps(nextUserId);
      } else {
        setCloudMaps([]);
        setCloudStatus("signed-out");
      }
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [refreshCloudMaps, supabase]);

  const cloudById = useMemo(() => new Map(cloudMaps.map((map) => [map.id, map])), [cloudMaps]);
  const entries = useMemo<readonly LibraryEntry[]>(() => [
    ...maps.map((map) => ({ kind: "local" as const, map, remote: cloudById.get(map.id) ?? null })),
    ...cloudMaps
      .filter((map) => !maps.some((localMap) => localMap.id === map.id))
      .map((map) => ({ kind: "cloud" as const, map })),
  ], [cloudById, cloudMaps, maps]);

  const visibleEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filtered = normalizedQuery
      ? entries.filter((entry) => entrySearchValues(entry).some((value) => value.toLocaleLowerCase().includes(normalizedQuery)))
      : entries;
    return [...filtered].sort((left, right) => entryUpdatedAt(right) - entryUpdatedAt(left));
  }, [entries, query]);

  function reloadLocalLibrary() {
    setLibraryVersion((version) => version + 1);
  }

  async function openForEditing(map: LocalSavedMap) {
    setOpeningMapId(map.id);
    setOpenError(null);

    try {
      const { writeCurrentAnchorDraft } = await import("@/features/anchor/local-draft-store");
      await writeCurrentAnchorDraft({
        savedAt: map.updatedAt,
        imageName: map.imageName,
        imageBlob: map.imageBlob,
        imageDimensions: map.imageDimensions,
        anchors: map.anchors,
        targetZoom: map.targetZoom,
        basemapMode: map.basemapMode,
        savedMapId: map.id,
      });
      router.push("/anchor");
    } catch {
      setOpeningMapId(null);
      setOpenError("That map could not be opened, but its saved record is still safe.");
    }
  }

  async function saveToCloud(map: LocalSavedMap) {
    if (!userId) {
      setLibraryMessage("Sign in to back up this map to your account.");
      return;
    }

    const now = currentTimestamp();
    const lastSavedAt = lastCloudSaveAtRef.current.get(map.id) ?? 0;
    if (now - lastSavedAt < 30_000) {
      setLibraryMessage("This map was just backed up. Please wait a moment before saving again.");
      return;
    }

    setBusyMapId(map.id);
    setLibraryMessage(null);
    try {
      const result = await syncLocalMapToCloud(map, userId);
      lastCloudSaveAtRef.current = new Map(lastCloudSaveAtRef.current).set(map.id, currentTimestamp());
      setLibraryMessage(result.status === "conflict"
        ? `${map.metadata.title} was saved as a separate cloud revision because another device changed it first.`
        : result.status === "unchanged"
          ? `${map.metadata.title} is already backed up.`
          : `${map.metadata.title} is backed up to your account.`);
      await refreshCloudMaps();
    } catch (error) {
      setLibraryMessage(error instanceof Error ? error.message : "This map could not be backed up.");
    } finally {
      setBusyMapId(null);
    }
  }

  async function downloadForOffline(
    map: CloudMapSummary,
    options: Readonly<{ replaceExisting?: boolean }> = {},
  ) {
    if (!userId) return;
    setBusyMapId(map.id);
    setLibraryMessage(null);
    try {
      const result = await downloadCloudMapToDevice(map, userId, options);
      setLibraryMessage(result.updated
        ? `${map.metadata.title} was updated on this device.`
        : result.added
          ? `${map.metadata.title} is now available offline.`
          : `${map.metadata.title} is already available offline.`);
      if (result.added || result.updated) reloadLocalLibrary();
    } catch (error) {
      setLibraryMessage(error instanceof Error ? error.message : "This map could not be downloaded.");
    } finally {
      setBusyMapId(null);
    }
  }

  async function removeFromDevice(map: LocalSavedMap, remote: CloudMapSummary) {
    if (map.updatedAt > remote.clientUpdatedAt) {
      setLibraryMessage("Save this map to the cloud before removing its offline copy.");
      return;
    }

    setBusyMapId(map.id);
    try {
      await deleteSavedMap(map.id);
      setLibraryMessage(`${map.metadata.title} was removed from this device. Your account copy is safe.`);
      reloadLocalLibrary();
    } catch (error) {
      setLibraryMessage(error instanceof Error ? error.message : "The offline copy could not be removed.");
    } finally {
      setBusyMapId(null);
    }
  }

  const sharingEntry = sharingMapId
    ? entries.find((entry): entry is LocalEntry => entry.kind === "local" && entry.map.id === sharingMapId)
    : undefined;

  if (status === "loading") {
    return (
      <main className="page-frame my-maps-page" id="main-content">
        <section className="my-maps-hero">
          <p className="eyebrow">My maps</p>
          <h1>Loading your maps…</h1>
        </section>
        <div className="map-library-loading" aria-label="Loading saved maps" />
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="page-frame my-maps-page" id="main-content">
        <section className="my-maps-hero">
          <p className="eyebrow">My maps</p>
          <h1>Your map library could not be opened.</h1>
          <p>Your draft and saved maps have not been changed. Refresh this page to try again.</p>
          <button className="button button--signal" type="button" onClick={reloadLocalLibrary}>Refresh maps</button>
        </section>
      </main>
    );
  }

  const draftBelongsToSavedMap = draft?.savedMapId ? maps.some((map) => map.id === draft.savedMapId) : false;
  const draftsVisible = draft && !draftBelongsToSavedMap && (!query.trim() || draft.imageName.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  return (
    <main className="page-frame my-maps-page" id="main-content">
      <section className="my-maps-hero">
        <div>
          <p className="eyebrow">My maps</p>
          <h1>Your maps, ready when you need them.</h1>
          <p>Drafts stay at the top. Finished maps live together below, with a simple offline indicator.</p>
        </div>
        <div className="my-maps-hero__actions">
          <button className="button button--quiet" type="button" onClick={() => { reloadLocalLibrary(); void refreshCloudMaps(); }}>
            Refresh maps
          </button>
          <Link className="button button--signal" href={"/anchor/new" as Route}>Start a map</Link>
        </div>
      </section>

      {draftsVisible ? (
        <section className="my-maps-section" aria-labelledby="drafts-heading">
          <div className="my-maps-section__heading">
            <div>
              <p className="eyebrow">Work in progress</p>
              <h2 id="drafts-heading">Drafts</h2>
            </div>
            <span>Continue where you left off</span>
          </div>
          <article className="my-map-card my-map-card--draft">
            <div className="my-map-card__preview">
              {draftPreviewUrl ? <Image src={draftPreviewUrl} alt="" fill sizes="(min-width: 48rem) 50vw, 100vw" unoptimized /> : null}
              <span>{draft.anchors.length} {draft.anchors.length === 1 ? "anchor" : "anchors"}</span>
            </div>
            <div className="my-map-card__body">
              <div className="my-map-card__heading">
                <div>
                  <p>Draft · not finished</p>
                  <h2>{draft.imageName}</h2>
                </div>
                <span>Draft</span>
              </div>
              <p className="my-map-card__description">Saved locally {formatUpdatedAt(draft.savedAt)}. Finish the map when you are ready to add it to My Maps.</p>
              <div className="my-map-card__actions">
                <div>
                  <Link className="button button--signal" href="/anchor">Continue editing</Link>
                </div>
                <small>Local draft</small>
              </div>
            </div>
          </article>
        </section>
      ) : null}

      <section className="my-maps-section" aria-labelledby="completed-heading">
        <div className="my-maps-section__heading">
          <div>
            <p className="eyebrow">Created by you</p>
            <h2 id="completed-heading">My Maps</h2>
          </div>
          <span>{visibleEntries.length} {visibleEntries.length === 1 ? "map" : "maps"}</span>
        </div>

        <section className="map-library-toolbar" aria-label="My Maps search and refresh">
          <label>
            <span>Search My Maps</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Title, place, type, year, or activity"
            />
          </label>
          <p>{cloudStatus === "checking" ? "Refreshing your account maps…" : cloudStatus === "error" ? "Account maps need attention" : cloudStatus === "signed-out" ? "Sign in to see cloud copies" : ""}</p>
        </section>

        {openError ? <p className="map-library-error" role="alert">{openError}</p> : null}
        {libraryMessage ? <p className="cloud-sync-message" role="status">{libraryMessage}</p> : null}

        {visibleEntries.length === 0 ? (
          <section className="map-library-empty">
            <span aria-hidden="true">⌖</span>
            <h2>{query ? "No maps match that search" : "No finished maps yet"}</h2>
            <p>{query ? "Try a different title, place, year, or activity." : "Anchor an image, then choose Finish map when it is ready."}</p>
            {query ? <button className="text-button" type="button" onClick={() => setQuery("")}>Clear search</button> : <Link className="button button--ink" href="/anchor">Open Anchor Lab</Link>}
          </section>
        ) : (
          <section className="my-map-grid" aria-label="My Maps">
            {visibleEntries.map((entry) => {
              const isLocal = entry.kind === "local";
              const map = entry.map;
              const localMap = entry.kind === "local" ? entry.map : null;
              const cloudMap = entry.kind === "cloud" ? entry.map : null;
              const remote = entry.kind === "local" ? entry.remote : null;
              const isBusy = busyMapId === map.id;
              const cloudHasMoreAnchors = localMap && remote ? remote.anchorCount > localMap.anchors.length : false;
              const hasUnsyncedChanges = localMap && remote
                ? localMap.updatedAt > remote.clientUpdatedAt && !cloudHasMoreAnchors
                : false;
              const hasCloudUpdates = localMap && remote
                ? remote.clientUpdatedAt > localMap.updatedAt || cloudHasMoreAnchors
                : false;
              const canSaveCloud = isLocal && Boolean(userId) && (!remote || hasUnsyncedChanges);
              const previewUrl = isLocal ? previewUrls.get(map.id) : undefined;
              const anchorCount = localMap ? localMap.anchors.length : cloudMap?.anchorCount ?? 0;

              return (
                <article className="my-map-card" key={map.id}>
                  <div className={`my-map-card__preview${isLocal ? "" : " my-map-card__preview--cloud"}`}>
                    {previewUrl ? <Image src={previewUrl} alt="" fill sizes="(min-width: 80rem) 25vw, (min-width: 48rem) 50vw, 100vw" unoptimized /> : null}
                    {!isLocal ? <strong>Stored in your account</strong> : null}
                    <span>{formatMapDate(map)}</span>
                  </div>
                  <div className="my-map-card__body">
                    <div className="my-map-card__heading">
                      <div>
                        <p>{map.metadata.subject} · {map.metadata.visualStyle}</p>
                        <h2>{map.metadata.title}</h2>
                      </div>
                      <span data-visibility={map.metadata.visibility}>{visibilityLabel(entry)}</span>
                    </div>
                    {map.metadata.placeName ? <p className="my-map-card__place">{map.metadata.placeName}</p> : null}
                    {map.metadata.description ? <p className="my-map-card__description">{map.metadata.description}</p> : null}
                    <dl className="my-map-card__facts">
                      <div><dt>Anchors</dt><dd>{anchorCount}</dd></div>
                      <div><dt>Resolution</dt><dd>{map.imageDimensions.width} × {map.imageDimensions.height}</dd></div>
                      <div><dt>Updated</dt><dd>{formatUpdatedAt(entryUpdatedAt(entry))}</dd></div>
                    </dl>
                    {isLocal && entry.remote ? (
                      <p className="my-map-card__sync" data-state={hasUnsyncedChanges ? "dirty" : hasCloudUpdates ? "cloud-newer" : "backed-up"}>
                        {hasUnsyncedChanges
                          ? "Changes ready to back up"
                          : hasCloudUpdates && cloudHasMoreAnchors
                            ? `Cloud copy has ${entry.remote.anchorCount} anchors · download latest`
                            : hasCloudUpdates
                              ? "A newer cloud copy is available"
                            : `Backed up ${formatCloudUpdatedAt(entry.remote.updatedAt)}`}
                      </p>
                    ) : isLocal ? (
                      <p className="my-map-card__sync">{userId ? "Not backed up to your account yet" : "Saved on this device"}</p>
                    ) : (
                      <p className="my-map-card__sync">Available online now · save a copy only for offline use.</p>
                    )}
                    {map.metadata.activities.length > 0 ? (
                      <ul className="my-map-card__tags" aria-label="Activities">
                        {map.metadata.activities.map((activity) => <li key={activity}>{activity}</li>)}
                      </ul>
                    ) : null}
                    <div className="my-map-card__actions">
                      <div>
                        {isLocal ? (
                          <>
                            <Link className="button button--signal" href={`/maps/${map.id}` as Route}>Open map</Link>
                            <Link className="button button--quiet" href={`/maps/${map.id}/compare` as Route}>Compare</Link>
                            <button className="button button--quiet" type="button" onClick={() => void openForEditing(localMap!)} disabled={openingMapId !== null}>
                              {openingMapId === map.id ? "Opening…" : "Edit anchors"}
                            </button>
                          </>
                        ) : (
                          <>
                            <Link className="button button--signal" href={`/maps/${map.id}` as Route}>Open map</Link>
                            <Link className="button button--quiet" href={`/maps/${map.id}/compare` as Route}>Compare</Link>
                            <button className="button button--quiet" type="button" onClick={() => void downloadForOffline(cloudMap!)} disabled={isBusy || !userId}>
                              {isBusy ? "Saving…" : "Save for offline"}
                            </button>
                          </>
                        )}
                      </div>
                      {isLocal ? (
                        <div>
                          {canSaveCloud ? <button className="button button--quiet" type="button" onClick={() => void saveToCloud(localMap!)} disabled={isBusy}>{isBusy ? "Saving…" : "Save progress to cloud"}</button> : null}
                          {hasCloudUpdates && remote ? <button className="button button--quiet" type="button" onClick={() => void downloadForOffline(remote, { replaceExisting: true })} disabled={isBusy}>{isBusy ? "Updating..." : "Download latest"}</button> : null}
                          {remote && !hasUnsyncedChanges && !hasCloudUpdates ? <button className="button button--ink" type="button" onClick={() => setSharingMapId(map.id)} disabled={isBusy}>Share</button> : null}
                          {remote && !hasUnsyncedChanges && !hasCloudUpdates ? <button className="button button--quiet" type="button" onClick={() => void removeFromDevice(localMap!, remote)} disabled={isBusy}>{isBusy ? "Removing…" : "Remove from this device"}</button> : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </section>

      <MapBackupControls onImportComplete={reloadLocalLibrary} />

      <aside className="local-storage-note">
        <strong>Local copies are optional offline copies</strong>
        <span>Cloud backups stay in your account. Remove an offline copy anytime without deleting the map.</span>
      </aside>

      {sharingEntry?.remote ? (
        <CommunityPublicationDialog map={sharingEntry.map} remote={sharingEntry.remote} onClose={() => setSharingMapId(null)} />
      ) : null}
    </main>
  );
}
