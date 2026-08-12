"use client";

import Image from "next/image";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { writeCurrentAnchorDraft } from "@/features/anchor/local-draft-store";
import { MapBackupControls } from "@/features/backup/map-backup-controls";
import { CloudMapSyncPanel } from "@/features/cloud/cloud-map-sync-panel";
import { listSavedMaps } from "@/features/maps/local-saved-map-store";
import type { LocalSavedMap } from "@/features/maps/saved-map-types";

type LibraryStatus = "loading" | "ready" | "error";

function formatMapDate(map: LocalSavedMap) {
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

export function MyMapsLibrary() {
  const router = useRouter();
  const [maps, setMaps] = useState<readonly LocalSavedMap[]>([]);
  const [previewUrls, setPreviewUrls] = useState<ReadonlyMap<string, string>>(new Map());
  const [status, setStatus] = useState<LibraryStatus>("loading");
  const [query, setQuery] = useState("");
  const [openingMapId, setOpeningMapId] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [libraryVersion, setLibraryVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const createdUrls: string[] = [];

    void listSavedMaps()
      .then((savedMaps) => {
        if (cancelled) {
          return;
        }

        const nextPreviewUrls = new Map<string, string>();
        for (const map of savedMaps) {
          const url = URL.createObjectURL(map.imageBlob);
          createdUrls.push(url);
          nextPreviewUrls.set(map.id, url);
        }

        setMaps(savedMaps);
        setPreviewUrls(nextPreviewUrls);
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
    };
  }, [libraryVersion]);

  const visibleMaps = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) {
      return maps;
    }

    return maps.filter((map) => [
      map.metadata.title,
      map.metadata.placeName,
      map.metadata.subject,
      map.metadata.visualStyle,
      map.metadata.description,
      formatMapDate(map),
      ...map.metadata.activities,
    ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)));
  }, [maps, query]);

  async function openForEditing(map: LocalSavedMap) {
    setOpeningMapId(map.id);
    setOpenError(null);

    try {
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

  if (status === "loading") {
    return (
      <main className="page-frame my-maps-page" id="main-content">
        <section className="my-maps-hero">
          <p className="eyebrow">My maps</p>
          <h1>Loading your local maps…</h1>
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
          <p>Your anchor draft has not been changed. Reload this page to try again.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page-frame my-maps-page" id="main-content">
      <section className="my-maps-hero">
        <div>
          <p className="eyebrow">My maps · stored locally</p>
          <h1>Your maps, ready when the signal is not.</h1>
          <p>
            Original images, details, and anchors are stored together in this browser.
            No account or internet connection is required.
          </p>
        </div>
        <Link className="button button--signal" href={"/anchor/new" as Route}>Start another map</Link>
      </section>

      {maps.length === 0 ? (
        <section className="map-library-empty">
          <span aria-hidden="true">⌖</span>
          <h2>No finished maps yet</h2>
          <p>Anchor an image, choose Finish map, and it will appear here.</p>
          <Link className="button button--ink" href="/anchor">Open Anchor Lab</Link>
        </section>
      ) : (
        <>
          <section className="map-library-toolbar" aria-label="Saved map filters">
            <label>
              <span>Search My Maps</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Title, place, type, year, or activity"
              />
            </label>
            <p>{visibleMaps.length} of {maps.length} {maps.length === 1 ? "map" : "maps"}</p>
          </section>

          {openError ? <p className="map-library-error" role="alert">{openError}</p> : null}

          {visibleMaps.length === 0 ? (
            <section className="map-library-empty map-library-empty--compact">
              <h2>No maps match that search</h2>
              <button className="text-button" type="button" onClick={() => setQuery("")}>Clear search</button>
            </section>
          ) : (
            <section className="my-map-grid" aria-label="Saved maps">
              {visibleMaps.map((map) => {
                const previewUrl = previewUrls.get(map.id);
                return (
                  <article className="my-map-card" key={map.id}>
                    <div className="my-map-card__preview">
                      {previewUrl ? (
                        <Image
                          src={previewUrl}
                          alt=""
                          fill
                          sizes="(min-width: 80rem) 25vw, (min-width: 48rem) 50vw, 100vw"
                          unoptimized
                        />
                      ) : null}
                      <span>{formatMapDate(map)}</span>
                    </div>

                    <div className="my-map-card__body">
                      <div className="my-map-card__heading">
                        <div>
                          <p>{map.metadata.subject} · {map.metadata.visualStyle}</p>
                          <h2>{map.metadata.title}</h2>
                        </div>
                        <span data-visibility={map.metadata.visibility}>
                          {map.metadata.visibility === "private" ? "Private" : "Public-ready"}
                        </span>
                      </div>

                      {map.metadata.placeName ? <p className="my-map-card__place">{map.metadata.placeName}</p> : null}
                      {map.metadata.description ? <p className="my-map-card__description">{map.metadata.description}</p> : null}

                      <dl className="my-map-card__facts">
                        <div><dt>Anchors</dt><dd>{map.anchors.length}</dd></div>
                        <div><dt>Resolution</dt><dd>{map.imageDimensions.width} × {map.imageDimensions.height}</dd></div>
                        <div><dt>Updated</dt><dd>{formatUpdatedAt(map.updatedAt)}</dd></div>
                      </dl>

                      {map.metadata.activities.length > 0 ? (
                        <ul className="my-map-card__tags" aria-label="Activities">
                          {map.metadata.activities.map((activity) => <li key={activity}>{activity}</li>)}
                        </ul>
                      ) : null}

                      <div className="my-map-card__actions">
                        <div>
                          <Link className="button button--signal" href={`/maps/${map.id}` as Route}>Open map</Link>
                          <Link className="button button--quiet" href={`/maps/${map.id}/compare` as Route}>Compare</Link>
                          <button
                            className="button button--quiet"
                            type="button"
                            onClick={() => void openForEditing(map)}
                            disabled={openingMapId !== null}
                          >
                            {openingMapId === map.id ? "Opening…" : "Edit anchors"}
                          </button>
                        </div>
                        <small>{map.imageName}</small>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </>
      )}

      <CloudMapSyncPanel
        localMaps={maps}
        onLocalLibraryChanged={() => setLibraryVersion((version) => version + 1)}
      />

      <MapBackupControls onImportComplete={() => setLibraryVersion((version) => version + 1)} />

      <aside className="local-storage-note">
        <strong>Local copies stay local</strong>
        <span>Cloud sync adds a separate account copy. Keep a .fieldatlas backup before clearing browser data.</span>
      </aside>
    </main>
  );
}
