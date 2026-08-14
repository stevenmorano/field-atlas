"use client";

import Image from "next/image";
import type { Route } from "next";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import type { PublicMapSummary } from "@/features/community/community-contract";
import { distanceBetweenMeters, formatDistance } from "@/features/discover/geo-distance";
import type { GeographicPoint } from "@/lib/georeferencing/types";

type LocationState =
  | Readonly<{ status: "idle" | "requesting" }>
  | Readonly<{ status: "ready"; point: GeographicPoint; accuracyMeters: number }>
  | Readonly<{ status: "error"; message: string }>;

type SubjectFilter = "all" | "historic" | "trail" | "park" | "venue";

type PublicMapWithDistance = Readonly<{
  map: PublicMapSummary;
  coverageDistanceMeters: number | null;
  isCoveringLocation: boolean;
}>;

const FILTERS: readonly Readonly<{ label: string; value: SubjectFilter }>[] = [
  { label: "All maps", value: "all" },
  { label: "Historic", value: "historic" },
  { label: "Trails", value: "trail" },
  { label: "Parks", value: "park" },
  { label: "Venues", value: "venue" },
];

function getLocationCopy(location: LocationState) {
  if (location.status === "requesting") {
    return "Finding your position…";
  }

  if (location.status === "ready") {
    return `Location ready · ±${Math.round(location.accuracyMeters)} m`;
  }

  if (location.status === "error") {
    return location.message;
  }

  return "See which maps cover you";
}

function publicDateLabel(map: PublicMapSummary) {
  if (map.mapDateKind === "current") return "Current";
  if (map.mapDateKind === "exact" && map.mapYear !== null) return String(map.mapYear);
  if (map.mapDateKind === "approximate" && map.mapYear !== null) return `About ${map.mapYear}`;
  return "Date unknown";
}

function publicSubjectMatches(map: PublicMapSummary, subject: SubjectFilter) {
  if (subject === "all") return true;
  const normalized = map.subject.toLocaleLowerCase();
  if (subject === "historic") return normalized.includes("historic");
  if (subject === "trail") return normalized.includes("trail");
  if (subject === "park") return normalized.includes("park") || normalized.includes("preserve");
  return normalized.includes("zoo") || normalized.includes("amusement") || normalized.includes("venue");
}

function PublicCatalogCard({ entry }: Readonly<{ entry: PublicMapWithDistance }>) {
  const { map } = entry;
  return (
    <article className="catalog-card catalog-card--public">
      <Link className="public-map-thumbnail" href={`/maps/${map.mapId}` as Route} aria-label={`Open ${map.title}`}>
        <Image
          src={`/api/community/assets/${map.publicAssetId}?variant=thumbnail`}
          alt=""
          fill
          unoptimized
          sizes="(min-width: 75rem) 25vw, (min-width: 48rem) 50vw, 100vw"
        />
        <span>{publicDateLabel(map)}</span>
      </Link>
      <div className="catalog-card__body">
        <div className="catalog-card__status-row">
          {entry.isCoveringLocation ? <span className="status-pill status-pill--here">You are on this map</span> : null}
          {map.adminChecked ? <span className="status-pill">Admin checked</span> : <span className="status-pill">Community map</span>}
        </div>
        <div>
          <p className="catalog-card__place">{map.placeName || map.subject}</p>
          <h3><Link href={`/maps/${map.mapId}` as Route}>{map.title}</Link></h3>
        </div>
        <dl className="catalog-card__facts">
          <div><dt>Map</dt><dd>{publicDateLabel(map)}</dd></div>
          <div><dt>Anchors</dt><dd>{map.anchorCount}</dd></div>
          <div><dt>By</dt><dd><Link href={`/profiles/${map.username}` as Route}>{map.username}</Link></dd></div>
        </dl>
        <div className="catalog-card__footer">
          <span>{entry.isCoveringLocation ? "Covers your position" : entry.coverageDistanceMeters === null ? map.visualStyle : `${formatDistance(entry.coverageDistanceMeters)} away`}</span>
          <Link className="text-button" href={`/maps/${map.mapId}` as Route}>Open map <span aria-hidden="true">→</span></Link>
        </div>
      </div>
    </article>
  );
}

export function DiscoverExperience() {
  const [location, setLocation] = useState<LocationState>({ status: "idle" });
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState<SubjectFilter>("all");
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const [publicMaps, setPublicMaps] = useState<readonly PublicMapSummary[] | null>(null);
  const [communityCatalogStatus, setCommunityCatalogStatus] = useState<"loading" | "ready" | "error">("loading");
  const [catalogRequestVersion, setCatalogRequestVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/community/maps", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Community catalog is not ready.");
        return response.json() as Promise<readonly PublicMapSummary[]>;
      })
      .then((maps) => {
        if (!cancelled) {
          setPublicMaps(maps);
          setCommunityCatalogStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPublicMaps(null);
          setCommunityCatalogStatus("error");
        }
      });
    return () => { cancelled = true; };
  }, [catalogRequestVersion]);

  const publicCatalog = useMemo(() => {
    if (publicMaps === null) return [];
    const currentPoint = location.status === "ready" ? location.point : null;
    return publicMaps
      .filter((map) => publicSubjectMatches(map, subject))
      .filter((map) => deferredQuery.length === 0 || `${map.title} ${map.placeName} ${map.mapYear ?? ""} ${map.subject}`.toLocaleLowerCase().includes(deferredQuery))
      .map((map): PublicMapWithDistance => {
        if (
          !currentPoint || map.coverage.latitude === null || map.coverage.longitude === null ||
          map.coverage.radiusMeters === null
        ) {
          return { map, coverageDistanceMeters: null, isCoveringLocation: false };
        }
        const centerDistance = distanceBetweenMeters(currentPoint, {
          latitude: map.coverage.latitude,
          longitude: map.coverage.longitude,
        });
        return {
          map,
          coverageDistanceMeters: Math.max(0, centerDistance - map.coverage.radiusMeters),
          isCoveringLocation: centerDistance <= map.coverage.radiusMeters,
        };
      })
      .toSorted((first, second) => {
        if (first.isCoveringLocation !== second.isCoveringLocation) return first.isCoveringLocation ? -1 : 1;
        if (first.coverageDistanceMeters !== null && second.coverageDistanceMeters !== null) return first.coverageDistanceMeters - second.coverageDistanceMeters;
        return Date.parse(second.map.publishedAt) - Date.parse(first.map.publishedAt);
      });
  }, [deferredQuery, location, publicMaps, subject]);

  const usingCommunityCatalog = communityCatalogStatus === "ready";
  const coveringCount = usingCommunityCatalog
    ? publicCatalog.filter((entry) => entry.isCoveringLocation).length
    : 0;

  function retryCommunityCatalog() {
    setPublicMaps(null);
    setCommunityCatalogStatus("loading");
    setCatalogRequestVersion((version) => version + 1);
  }

  function requestLocation() {
    if (!("geolocation" in navigator)) {
      setLocation({ status: "error", message: "Location is unavailable in this browser" });
      return;
    }

    setLocation({ status: "requesting" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          status: "ready",
          point: {
            longitude: position.coords.longitude,
            latitude: position.coords.latitude,
          },
          accuracyMeters: position.coords.accuracy,
        });
      },
      (error) => {
        setLocation({
          status: "error",
          message: error.code === error.PERMISSION_DENIED ? "Location permission was not granted" : "Location could not be determined",
        });
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 12_000 },
    );
  }

  return (
    <div className="discover-page">
      <section className="discover-hero">
        <div className="discover-hero__copy">
          <p className="eyebrow">Community georeferenced maps</p>
          <h1>
            Any map.
            <span>Your blue dot.</span>
          </h1>
          <p className="discover-hero__lede">
            Open trail signs, historic atlases, and illustrated park maps with your real position—online or off.
          </p>
          <div className="discover-hero__actions">
            <Link className="button button--signal" href="/anchor">
              Anchor a map
            </Link>
            <button
              className="button button--quiet"
              type="button"
              onClick={requestLocation}
              disabled={location.status === "requesting"}
            >
              <span className="location-pulse" aria-hidden="true" />
              {getLocationCopy(location)}
            </button>
          </div>
        </div>

        <div className="catalog-map" aria-label="Illustrative community map catalog preview">
          <div className="catalog-map__label">
            <span>Catalog view</span>
            <strong>
              {location.status === "ready"
                ? `${coveringCount} covering you`
                : communityCatalogStatus === "loading"
                  ? "Loading shared maps…"
                  : usingCommunityCatalog
                    ? `${publicMaps?.length ?? 0} shared maps`
                    : "Shared maps unavailable"}
            </strong>
          </div>
          <span className="catalog-map__water" />
          <span className="catalog-map__road catalog-map__road--one" />
          <span className="catalog-map__road catalog-map__road--two" />
          <span className="catalog-map__road catalog-map__road--three" />
          <span className="catalog-map__marker catalog-map__marker--one">2</span>
          <span className="catalog-map__marker catalog-map__marker--two">1</span>
          <span className="catalog-map__marker catalog-map__marker--three">1</span>
          {location.status === "ready" ? <span className="catalog-map__you" title="Your current position" /> : null}
          <div className="catalog-map__scale">5 mi</div>
        </div>
      </section>

      <section className="catalog-section" aria-labelledby="catalog-heading">
        <div className="catalog-section__heading">
          <div>
            <p className="eyebrow">Explore the shelf</p>
            <h2 id="catalog-heading">
              {coveringCount > 0 ? `${coveringCount} maps cover your position` : "Maps worth unfolding"}
            </h2>
          </div>
          <label className="search-field">
            <span className="sr-only">Search maps</span>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="m15.5 15.5 5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search place, year, or map" />
          </label>
        </div>

        <div className="filter-row" role="group" aria-label="Filter maps by subject">
          {FILTERS.map((filter) => (
            <button
              className="filter-chip"
              data-active={subject === filter.value}
              type="button"
              onClick={() => setSubject(filter.value)}
              key={filter.value}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {communityCatalogStatus === "loading" ? (
          <div className="empty-state" aria-live="polite">
            <p className="eyebrow">Community shelf</p>
            <h3>Loading shared maps…</h3>
          </div>
        ) : communityCatalogStatus === "error" ? (
          <div className="empty-state" role="alert">
            <p className="eyebrow">Community shelf</p>
            <h3>Shared maps could not be loaded.</h3>
            <p>Your maps are safe. Check the connection and try again.</p>
            <button className="button button--quiet" type="button" onClick={retryCommunityCatalog}>Retry</button>
          </div>
        ) : usingCommunityCatalog && publicCatalog.length > 0 ? (
          <div className="catalog-grid">
            {publicCatalog.map((entry) => <PublicCatalogCard entry={entry} key={entry.map.publicationId} />)}
          </div>
        ) : (
          <div className="empty-state">
            <p className="eyebrow">No match</p>
            <h3>Try another place, year, or map type.</h3>
          </div>
        )}
      </section>
    </div>
  );
}
