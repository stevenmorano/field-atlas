"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";

import { CATALOG_MAPS, type CatalogMap } from "@/features/discover/catalog-data";
import { distanceBetweenMeters, formatDistance } from "@/features/discover/geo-distance";
import type { GeographicPoint } from "@/lib/georeferencing/types";

type LocationState =
  | Readonly<{ status: "idle" | "requesting" }>
  | Readonly<{ status: "ready"; point: GeographicPoint; accuracyMeters: number }>
  | Readonly<{ status: "error"; message: string }>;

type SubjectFilter = "all" | CatalogMap["subject"];

type MapWithDistance = Readonly<{
  map: CatalogMap;
  centerDistanceMeters: number | null;
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

function MapThumbnail({ map }: Readonly<{ map: CatalogMap }>) {
  return (
    <div className="map-thumbnail" data-tone={map.tone} aria-hidden="true">
      <span className="map-thumbnail__route map-thumbnail__route--one" />
      <span className="map-thumbnail__route map-thumbnail__route--two" />
      <span className="map-thumbnail__pin" />
      <span className="map-thumbnail__year">{map.mapDateLabel}</span>
    </div>
  );
}

function CatalogCard({ entry }: Readonly<{ entry: MapWithDistance }>) {
  const { map } = entry;

  return (
    <article className="catalog-card">
      <MapThumbnail map={map} />
      <div className="catalog-card__body">
        <div className="catalog-card__status-row">
          {entry.isCoveringLocation ? <span className="status-pill status-pill--here">You are on this map</span> : null}
          {map.isDownloaded ? <span className="status-pill">Offline</span> : null}
        </div>
        <div>
          <p className="catalog-card__place">{map.place}</p>
          <h3>{map.title}</h3>
        </div>
        <dl className="catalog-card__facts">
          <div>
            <dt>Map</dt>
            <dd>{map.mapDateLabel}</dd>
          </div>
          <div>
            <dt>Anchors</dt>
            <dd>{map.anchorCount}</dd>
          </div>
          <div>
            <dt>Quality</dt>
            <dd>{map.qualityScore}%</dd>
          </div>
        </dl>
        <div className="catalog-card__footer">
          <span>
            {entry.coverageDistanceMeters === null
              ? map.resolutionLabel
              : entry.isCoveringLocation
                ? "Covers your position"
                : `${formatDistance(entry.coverageDistanceMeters)} away`}
          </span>
          <button className="text-button" type="button" aria-label={`View details for ${map.title}`}>
            Details <span aria-hidden="true">↗</span>
          </button>
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

  const catalog = useMemo(() => {
    const currentPoint = location.status === "ready" ? location.point : null;

    return CATALOG_MAPS.reduce<MapWithDistance[]>((results, map) => {
      const matchesSubject = subject === "all" || map.subject === subject;
      const matchesQuery =
        deferredQuery.length === 0 ||
        `${map.title} ${map.place} ${map.mapDateLabel}`.toLocaleLowerCase().includes(deferredQuery);

      if (!matchesSubject || !matchesQuery) {
        return results;
      }

      const centerDistanceMeters = currentPoint ? distanceBetweenMeters(currentPoint, map.coverageCenter) : null;
      const coverageDistanceMeters =
        centerDistanceMeters === null ? null : Math.max(0, centerDistanceMeters - map.coverageRadiusMeters);

      results.push({
        map,
        centerDistanceMeters,
        coverageDistanceMeters,
        isCoveringLocation: centerDistanceMeters !== null && centerDistanceMeters <= map.coverageRadiusMeters,
      });
      return results;
    }, []).toSorted((first, second) => {
      if (first.isCoveringLocation !== second.isCoveringLocation) {
        return first.isCoveringLocation ? -1 : 1;
      }

      if (first.coverageDistanceMeters !== null && second.coverageDistanceMeters !== null) {
        return first.coverageDistanceMeters - second.coverageDistanceMeters;
      }

      return second.map.qualityScore - first.map.qualityScore;
    });
  }, [deferredQuery, location, subject]);

  const coveringCount = catalog.filter((entry) => entry.isCoveringLocation).length;

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
            <strong>{location.status === "ready" ? `${coveringCount} covering you` : "4 sample maps"}</strong>
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

        {catalog.length > 0 ? (
          <div className="catalog-grid">
            {catalog.map((entry) => (
              <CatalogCard entry={entry} key={entry.map.id} />
            ))}
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
