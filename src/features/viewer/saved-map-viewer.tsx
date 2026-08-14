"use client";

import Image from "next/image";
import type { Route } from "next";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { readSavedMap, storeDownloadedCloudMap } from "@/features/maps/local-saved-map-store";
import type { LocalSavedMap } from "@/features/maps/saved-map-types";
import type { PublicMapDetail } from "@/features/community/community-contract";
import { CommunityReportDialog } from "@/features/community/community-report-dialog";
import { createLocalMapFromPublicDetail } from "@/features/community/public-map-local";
import { writeCurrentAnchorDraft } from "@/features/anchor/local-draft-store";
import { compareMapHref } from "@/features/viewer/map-links";
import {
  projectGpsReading,
  type ProjectedGpsReading,
} from "@/features/viewer/gps-projection";
import { createGeoreferenceModel } from "@/lib/georeferencing/create-georeference-model";
import type { ImagePoint } from "@/lib/georeferencing/types";

type ViewerLoadStatus = "loading" | "ready" | "missing" | "error";
type LocationStatus = "idle" | "requesting" | "tracking" | "error" | "unsupported";
type ViewTransform = Readonly<{ zoom: number; x: number; y: number }>;
type ViewportSize = Readonly<{ width: number; height: number }>;
type PanGesture = Readonly<{
  pointerId: number;
  startX: number;
  startY: number;
  startXOffset: number;
  startYOffset: number;
}>;
type PinchGesture = Readonly<{
  distance: number;
  startZoom: number;
  imagePoint: ImagePoint;
}>;

const MIN_ZOOM = 1;
const MAX_ZOOM = 32;
const ZOOM_BUTTON_FACTOR = 1.4;

function clampZoom(zoom: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

function pointerDistance(points: readonly Readonly<{ x: number; y: number }>[]) {
  return Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
}

function pointerMidpoint(points: readonly Readonly<{ x: number; y: number }>[]) {
  return {
    x: (points[0].x + points[1].x) / 2,
    y: (points[0].y + points[1].y) / 2,
  };
}

function locationErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "Location access is blocked. Allow it in your browser settings, then try again.";
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return "Your device could not determine a location. Move somewhere with a clearer signal and retry.";
  }
  if (error.code === error.TIMEOUT) {
    return "The location request timed out. Try again when your device has a stronger GPS signal.";
  }
  return "Your location could not be read. The map is still available without GPS.";
}

function locationSummary(
  status: LocationStatus,
  projected: ProjectedGpsReading | null,
  error: string | null,
) {
  if (status === "unsupported") {
    return "This browser does not provide location access.";
  }
  if (status === "error") {
    return error ?? "Location is unavailable.";
  }
  if (status === "requesting") {
    return "Waiting for a location fix…";
  }
  if (status !== "tracking") {
    return "Location is off. This map still works without it.";
  }
  if (!projected) {
    return "The saved anchors could not place this location reading.";
  }
  if (!projected.isOnImage) {
    return "You are not located on this map image. You can keep viewing it normally.";
  }
  if (!projected.estimate.insideAnchoredRegion) {
    return "Location is outside the anchored area, so this position is an estimate.";
  }
  return `Live position · accurate to about ±${Math.round(projected.reading.accuracy)} m`;
}

export function SavedMapViewer({ mapId }: Readonly<{ mapId: string }>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shareToken = searchParams.get("share") ?? "";
  const [map, setMap] = useState<LocalSavedMap | null>(null);
  const [publicMap, setPublicMap] = useState<PublicMapDetail | null>(null);
  const [imageSource, setImageSource] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<ViewerLoadStatus>("loading");
  const [viewportSize, setViewportSize] = useState<ViewportSize>({ width: 0, height: 0 });
  const [transform, setTransform] = useState<ViewTransform>({ zoom: 1, x: 0, y: 0 });
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [projectedLocation, setProjectedLocation] = useState<ProjectedGpsReading | null>(null);
  const [following, setFollowing] = useState(false);
  const [openingEditor, setOpeningEditor] = useState(false);
  const [savingOnDevice, setSavingOnDevice] = useState(false);
  const [offlineMessage, setOfflineMessage] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const transformRef = useRef(transform);
  const fitScaleRef = useRef(1);
  const previousViewportRef = useRef<ViewportSize>({ width: 0, height: 0 });
  const viewInitializedRef = useRef(false);
  const panGestureRef = useRef<PanGesture | null>(null);
  const pinchGestureRef = useRef<PinchGesture | null>(null);
  const activePointersRef = useRef(new Map<number, { x: number; y: number }>());
  const geolocationWatchRef = useRef<number | null>(null);
  const locationWantedRef = useRef(false);
  const followingRef = useRef(false);
  const hasLocationFixRef = useRef(false);

  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  useEffect(() => {
    followingRef.current = following;
  }, [following]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    void (async () => {
      try {
        const savedMap = await readSavedMap(mapId);
        if (cancelled) return;
        if (savedMap) {
          objectUrl = URL.createObjectURL(savedMap.imageBlob);
          setMap(savedMap);
          setImageSource(objectUrl);
          setLoadStatus("ready");
          return;
        }

        const shareQuery = shareToken ? `?share=${encodeURIComponent(shareToken)}` : "";
        const detailResponse = await fetch(`/api/community/maps/${mapId}${shareQuery}`, { cache: "no-store" });
        if (!detailResponse.ok) {
          if (!cancelled) setLoadStatus(detailResponse.status === 404 ? "missing" : "error");
          return;
        }
        const detail = await detailResponse.json() as PublicMapDetail;
        const imageResponse = await fetch(
          `/api/community/assets/${detail.publicAssetId}?variant=map${shareToken ? `&share=${encodeURIComponent(shareToken)}` : ""}`,
          { cache: "no-store" },
        );
        if (!imageResponse.ok) throw new Error("Public image could not be loaded.");
        const imageBlob = await imageResponse.blob();
        if (cancelled) return;
        const publicSavedMap = createLocalMapFromPublicDetail(detail, imageBlob);
        objectUrl = URL.createObjectURL(imageBlob);
        setPublicMap(detail);
        setMap(publicSavedMap);
        setImageSource(objectUrl);
        setLoadStatus("ready");
      } catch {
        if (!cancelled) setLoadStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [mapId, shareToken]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker.ready.then((registration) => {
      registration.active?.postMessage({
        type: "CACHE_ROUTE",
        path: window.location.pathname,
      });
    });
  }, []);

  const model = useMemo(
    () => (map ? createGeoreferenceModel(map.anchors) : null),
    [map],
  );

  const fitScale = useMemo(() => {
    if (!map || viewportSize.width <= 0 || viewportSize.height <= 0) {
      return 1;
    }
    return Math.min(
      viewportSize.width / map.imageDimensions.width,
      viewportSize.height / map.imageDimensions.height,
    );
  }, [map, viewportSize]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      setViewportSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [loadStatus]);

  useLayoutEffect(() => {
    if (!map || viewportSize.width <= 0 || viewportSize.height <= 0) {
      return;
    }

    const previousScale = fitScaleRef.current * transformRef.current.zoom;
    const nextScale = fitScale * transformRef.current.zoom;
    const previousViewport = previousViewportRef.current;

    if (!viewInitializedRef.current || previousViewport.width <= 0 || previousViewport.height <= 0) {
      const initial = {
        zoom: 1,
        x: (viewportSize.width - map.imageDimensions.width * fitScale) / 2,
        y: (viewportSize.height - map.imageDimensions.height * fitScale) / 2,
      };
      viewInitializedRef.current = true;
      fitScaleRef.current = fitScale;
      previousViewportRef.current = viewportSize;
      transformRef.current = initial;
      setTransform(initial);
      return;
    }

    const centerImagePoint = {
      x: (previousViewport.width / 2 - transformRef.current.x) / previousScale,
      y: (previousViewport.height / 2 - transformRef.current.y) / previousScale,
    };
    const resized = {
      ...transformRef.current,
      x: viewportSize.width / 2 - centerImagePoint.x * nextScale,
      y: viewportSize.height / 2 - centerImagePoint.y * nextScale,
    };
    fitScaleRef.current = fitScale;
    previousViewportRef.current = viewportSize;
    transformRef.current = resized;
    setTransform(resized);
  }, [fitScale, map, viewportSize]);

  const centerOnImagePoint = useCallback((point: ImagePoint, minimumZoom = 2) => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const nextZoom = Math.max(transformRef.current.zoom, minimumZoom);
    const scale = fitScaleRef.current * nextZoom;
    const nextTransform = {
      zoom: nextZoom,
      x: viewport.clientWidth / 2 - point.x * scale,
      y: viewport.clientHeight / 2 - point.y * scale,
    };
    transformRef.current = nextTransform;
    setTransform(nextTransform);
  }, []);

  const disableFollowing = useCallback(() => {
    followingRef.current = false;
    setFollowing(false);
  }, []);

  const zoomAt = useCallback((requestedZoom: number, viewportX?: number, viewportY?: number) => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const current = transformRef.current;
    const nextZoom = clampZoom(requestedZoom);
    if (Math.abs(nextZoom - current.zoom) < 0.001) {
      return;
    }

    const focusX = viewportX ?? viewport.clientWidth / 2;
    const focusY = viewportY ?? viewport.clientHeight / 2;
    const currentScale = fitScaleRef.current * current.zoom;
    const nextScale = fitScaleRef.current * nextZoom;
    const imagePoint = {
      x: (focusX - current.x) / currentScale,
      y: (focusY - current.y) / currentScale,
    };
    const nextTransform = {
      zoom: nextZoom,
      x: focusX - imagePoint.x * nextScale,
      y: focusY - imagePoint.y * nextScale,
    };
    transformRef.current = nextTransform;
    setTransform(nextTransform);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || loadStatus !== "ready") {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const bounds = viewport.getBoundingClientRect();
      const factor = Math.exp(-event.deltaY * 0.002);
      zoomAt(
        transformRef.current.zoom * factor,
        event.clientX - bounds.left,
        event.clientY - bounds.top,
      );
      disableFollowing();
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [disableFollowing, loadStatus, zoomAt]);

  function beginPointerGesture(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target;
    const isControl = target instanceof Element && Boolean(target.closest(
      "button, a, input, select, textarea, label, [role='button'], [data-map-gesture-ignore]",
    ));
    if ((event.button !== 0 && event.pointerType === "mouse") || isControl) {
      return;
    }

    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const bounds = viewport.getBoundingClientRect();
    activePointersRef.current.set(event.pointerId, {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });
    event.currentTarget.setPointerCapture(event.pointerId);

    const points = Array.from(activePointersRef.current.values());
    if (points.length === 1) {
      panGestureRef.current = {
        pointerId: event.pointerId,
        startX: points[0].x,
        startY: points[0].y,
        startXOffset: transformRef.current.x,
        startYOffset: transformRef.current.y,
      };
    } else if (points.length === 2) {
      const midpoint = pointerMidpoint(points);
      const scale = fitScaleRef.current * transformRef.current.zoom;
      pinchGestureRef.current = {
        distance: Math.max(pointerDistance(points), 1),
        startZoom: transformRef.current.zoom,
        imagePoint: {
          x: (midpoint.x - transformRef.current.x) / scale,
          y: (midpoint.y - transformRef.current.y) / scale,
        },
      };
      panGestureRef.current = null;
    }
  }

  function movePointerGesture(event: ReactPointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    if (!viewport || !activePointersRef.current.has(event.pointerId)) {
      return;
    }

    const bounds = viewport.getBoundingClientRect();
    activePointersRef.current.set(event.pointerId, {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });
    const points = Array.from(activePointersRef.current.values());

    if (points.length === 2 && pinchGestureRef.current) {
      const pinch = pinchGestureRef.current;
      const midpoint = pointerMidpoint(points);
      const nextZoom = clampZoom(
        pinch.startZoom * (pointerDistance(points) / pinch.distance),
      );
      const nextScale = fitScaleRef.current * nextZoom;
      const nextTransform = {
        zoom: nextZoom,
        x: midpoint.x - pinch.imagePoint.x * nextScale,
        y: midpoint.y - pinch.imagePoint.y * nextScale,
      };
      transformRef.current = nextTransform;
      setTransform(nextTransform);
      disableFollowing();
      event.preventDefault();
      return;
    }

    const pan = panGestureRef.current;
    if (points.length === 1 && pan?.pointerId === event.pointerId) {
      const nextTransform = {
        ...transformRef.current,
        x: pan.startXOffset + points[0].x - pan.startX,
        y: pan.startYOffset + points[0].y - pan.startY,
      };
      transformRef.current = nextTransform;
      setTransform(nextTransform);
      disableFollowing();
      event.preventDefault();
    }
  }

  function endPointerGesture(event: ReactPointerEvent<HTMLDivElement>) {
    activePointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    panGestureRef.current = null;
    pinchGestureRef.current = null;

    const remaining = Array.from(activePointersRef.current.entries());
    if (remaining.length === 1) {
      const [pointerId, point] = remaining[0];
      panGestureRef.current = {
        pointerId,
        startX: point.x,
        startY: point.y,
        startXOffset: transformRef.current.x,
        startYOffset: transformRef.current.y,
      };
    }
  }

  const stopLocationWatch = useCallback((resetWanted = true) => {
    if (geolocationWatchRef.current !== null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(geolocationWatchRef.current);
      geolocationWatchRef.current = null;
    }
    if (resetWanted) {
      locationWantedRef.current = false;
      hasLocationFixRef.current = false;
      setLocationStatus("idle");
      setProjectedLocation(null);
      setFollowing(false);
    }
  }, []);

  const beginLocationWatch = useCallback(() => {
    if (!model || !map) {
      return;
    }
    if (!("geolocation" in navigator) || !window.isSecureContext) {
      setLocationStatus("unsupported");
      setLocationError(
        window.isSecureContext
          ? "This browser does not provide location access."
          : "Location requires a secure HTTPS connection.",
      );
      return;
    }

    if (geolocationWatchRef.current !== null) {
      navigator.geolocation.clearWatch(geolocationWatchRef.current);
    }
    locationWantedRef.current = true;
    setLocationStatus("requesting");
    setLocationError(null);

    geolocationWatchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const projected = projectGpsReading(model, map.imageDimensions, {
          longitude: position.coords.longitude,
          latitude: position.coords.latitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
        setProjectedLocation(projected);
        setLocationStatus("tracking");

        const shouldAutoFollow = !hasLocationFixRef.current;
        hasLocationFixRef.current = true;
        if (shouldAutoFollow) {
          followingRef.current = true;
          setFollowing(true);
        }
        if (projected?.isOnImage && (followingRef.current || shouldAutoFollow)) {
          centerOnImagePoint(projected.estimate.point);
        }
      },
      (error) => {
        setLocationError(locationErrorMessage(error));
        setLocationStatus("error");
        setFollowing(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5_000,
        timeout: 15_000,
      },
    );
  }, [centerOnImagePoint, map, model]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopLocationWatch(false);
      } else if (locationWantedRef.current) {
        beginLocationWatch();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopLocationWatch(false);
    };
  }, [beginLocationWatch, stopLocationWatch]);

  function recenterLocation() {
    if (!projectedLocation?.isOnImage) {
      return;
    }
    followingRef.current = true;
    setFollowing(true);
    centerOnImagePoint(projectedLocation.estimate.point);
  }

  function resetView() {
    if (!map) {
      return;
    }
    const nextTransform = {
      zoom: 1,
      x: (viewportSize.width - map.imageDimensions.width * fitScaleRef.current) / 2,
      y: (viewportSize.height - map.imageDimensions.height * fitScaleRef.current) / 2,
    };
    transformRef.current = nextTransform;
    setTransform(nextTransform);
    disableFollowing();
  }

  async function openAnchorEditor() {
    if (!map || openingEditor) {
      return;
    }

    setOpeningEditor(true);
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
      setOpeningEditor(false);
    }
  }

  async function saveOnDevice() {
    if (!map || !publicMap) return;
    setSavingOnDevice(true);
    setOfflineMessage(null);
    try {
      const result = await storeDownloadedCloudMap(map);
      setOfflineMessage(result.added ? "Saved to My Maps on this device." : "This map is already saved on this device.");
    } catch {
      setOfflineMessage("This map could not be saved on this device.");
    } finally {
      setSavingOnDevice(false);
    }
  }

  if (loadStatus === "loading") {
    return (
      <main className="saved-map-viewer-state" id="main-content">
        <div className="map-library-loading" />
        <h1>Opening your map…</h1>
      </main>
    );
  }

  if (loadStatus === "missing" || loadStatus === "error" || !map || !imageSource || !model) {
    return (
      <main className="saved-map-viewer-state" id="main-content">
        <p className="eyebrow">Map viewer</p>
        <h1>{loadStatus === "missing" ? "That saved map was not found." : "That map could not be opened."}</h1>
        <p>The rest of your local map library has not been changed.</p>
        <Link className="button button--ink" href="/my-maps">Back to My Maps</Link>
      </main>
    );
  }

  const actualScale = fitScale * transform.zoom;
  const markerScreenPosition = projectedLocation?.isOnImage
    ? {
        x: transform.x + projectedLocation.estimate.point.x * actualScale,
        y: transform.y + projectedLocation.estimate.point.y * actualScale,
      }
    : null;
  const accuracyWidth = projectedLocation?.accuracyRadius
    ? Math.max(28, projectedLocation.accuracyRadius.x * actualScale * 2)
    : 28;
  const accuracyHeight = projectedLocation?.accuracyRadius
    ? Math.max(28, projectedLocation.accuracyRadius.y * actualScale * 2)
    : 28;
  const gpsReady = model.quality.isGpsReady;
  const statusMessage = gpsReady
    ? locationSummary(locationStatus, projectedLocation, locationError)
    : "This map needs at least two stable anchors before GPS can be shown.";

  return (
    <main className="saved-map-viewer-page" id="main-content">
      <section className="saved-map-viewer" aria-label={`${map.metadata.title} map viewer`}>
        <header className="saved-map-viewer__header">
          <div className="saved-map-viewer__identity">
            <Link href={publicMap ? "/" : "/my-maps"} aria-label={publicMap ? "Back to Discover" : "Back to My Maps"}>←</Link>
            <div>
              <p>{map.metadata.placeName || "Saved map"}</p>
              <h1>{map.metadata.title}</h1>
            </div>
          </div>
          <div className="saved-map-viewer__header-actions">
            <span>{map.anchors.length} anchors</span>
            {publicMap ? (
              <>
                <Link className="button button--quiet saved-map-viewer__compare-action" href={compareMapHref(map.id, shareToken) as Route}>Compare with today</Link>
                <Link className="button button--quiet saved-map-viewer__profile-action" href={`/profiles/${publicMap.author.username}` as Route}>By {publicMap.author.username}</Link>
                <button className="button button--quiet saved-map-viewer__save-action" type="button" onClick={() => void saveOnDevice()} disabled={savingOnDevice}>{savingOnDevice ? "Saving…" : "Save on this device"}</button>
                <button className="button button--quiet saved-map-viewer__report-action" type="button" onClick={() => setReporting(true)}>Report</button>
              </>
            ) : (
              <>
                <Link className="button button--quiet saved-map-viewer__compare-action" href={compareMapHref(map.id) as Route}>Compare</Link>
                <button className="button button--quiet saved-map-viewer__edit-action" type="button" onClick={() => void openAnchorEditor()} disabled={openingEditor}>
                  {openingEditor ? "Opening…" : "Edit anchors"}
                </button>
              </>
            )}
          </div>
        </header>

        <div className="saved-map-viewer__toolbar">
          <div className="saved-map-viewer__zoom" aria-label="Map zoom controls">
            <button type="button" onClick={() => zoomAt(transform.zoom / ZOOM_BUTTON_FACTOR)} disabled={transform.zoom <= MIN_ZOOM} aria-label="Zoom out">−</button>
            <button type="button" onClick={resetView}>Fit</button>
            <button type="button" onClick={() => zoomAt(transform.zoom * ZOOM_BUTTON_FACTOR)} disabled={transform.zoom >= MAX_ZOOM} aria-label="Zoom in">+</button>
            <span>{Math.round(transform.zoom * 100)}%</span>
          </div>
        </div>

        <div
          className="saved-map-viewport"
          ref={viewportRef}
          onPointerDown={beginPointerGesture}
          onPointerMove={movePointerGesture}
          onPointerUp={endPointerGesture}
          onPointerCancel={endPointerGesture}
          aria-label="Pan and zoom saved map"
        >
          <div
            className="saved-map-image-frame"
            style={{
              width: map.imageDimensions.width,
              height: map.imageDimensions.height,
              transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${actualScale})`,
            }}
          >
            <Image
              src={imageSource}
              alt={map.metadata.title}
              width={map.imageDimensions.width}
              height={map.imageDimensions.height}
              sizes="100vw"
              unoptimized
              priority
              draggable={false}
            />
          </div>

          {markerScreenPosition ? (
            <div
              className="gps-position-layer"
              data-confidence={projectedLocation?.estimate.insideAnchoredRegion ? "anchored" : "estimated"}
              style={{
                left: markerScreenPosition.x,
                top: markerScreenPosition.y,
              }}
              aria-label="Your current position"
            >
              <span
                className="gps-accuracy-area"
                style={{ width: accuracyWidth, height: accuracyHeight }}
              />
              <span className="gps-position-dot" />
            </div>
          ) : null}

          <section
            className="gps-control-card"
            data-status={locationStatus}
            data-gps-ready={gpsReady ? "yes" : "no"}
            aria-live="polite"
          >
            <div>
              <span className="gps-control-card__pulse" aria-hidden="true" />
              <div>
                <strong>{locationStatus === "tracking" ? (following ? "Following you" : "Location on") : "Live position"}</strong>
                <p className="gps-control-card__summary">{statusMessage}</p>
              </div>
            </div>
            <div className="gps-control-card__actions">
              {locationStatus === "tracking" ? (
                <>
                  <button type="button" className="button button--signal" onClick={recenterLocation} disabled={!projectedLocation?.isOnImage}>Recenter</button>
                  <button type="button" className="button button--quiet" onClick={() => stopLocationWatch()}>Stop</button>
                </>
              ) : (
                <button type="button" className="button button--signal" onClick={beginLocationWatch} disabled={!gpsReady || locationStatus === "requesting"}>
                  {locationStatus === "requesting" ? "Finding you…" : "Find me"}
                </button>
              )}
            </div>
            <p className="saved-map-viewer__privacy">Location stays on this device and is never saved.</p>
            {offlineMessage ? <p className="saved-map-viewer__privacy" role="status">{offlineMessage}</p> : null}
          </section>
        </div>
      </section>
      {reporting && publicMap ? (
        <CommunityReportDialog
          mapId={publicMap.mapId}
          publicationId={publicMap.publicationId}
          shareToken={shareToken}
          onClose={() => setReporting(false)}
        />
      ) : null}
    </main>
  );
}
