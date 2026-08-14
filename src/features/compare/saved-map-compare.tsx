"use client";

import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Map as MapLibreMap } from "maplibre-gl";

import {
  DEMO_BASEMAP_LAYER_IDS,
  DEMO_HYBRID_LAYER_IDS,
  createDemoBasemapStyle,
  type DemoBasemapMode,
} from "@/features/anchor/demo-basemap-style";
import {
  createCompareMesh,
  type CompareMesh,
} from "@/features/compare/create-compare-mesh";
import { drawWarpedMap } from "@/features/compare/draw-warped-map";
import { readSavedMap } from "@/features/maps/local-saved-map-store";
import type { LocalSavedMap } from "@/features/maps/saved-map-types";
import { createGeoreferenceModel } from "@/lib/georeferencing/create-georeference-model";
import type { PublicMapDetail } from "@/features/community/community-contract";
import { createLocalMapFromPublicDetail } from "@/features/community/public-map-local";

type CompareLoadStatus = "loading" | "ready" | "missing" | "error";

const DEFAULT_OPACITY = 55;
const MAX_CANVAS_PIXEL_RATIO = 2;

function fitOverlay(map: MapLibreMap, mesh: CompareMesh) {
  map.fitBounds(
    [
      [mesh.bounds.west, mesh.bounds.south],
      [mesh.bounds.east, mesh.bounds.north],
    ],
    { padding: 64, duration: 0, maxZoom: 18 },
  );
}

function applyBasemapMode(map: MapLibreMap, mode: DemoBasemapMode) {
  if (map.getLayer(DEMO_BASEMAP_LAYER_IDS.street)) {
    map.setLayoutProperty(
      DEMO_BASEMAP_LAYER_IDS.street,
      "visibility",
      mode === "street" ? "visible" : "none",
    );
  }
  if (map.getLayer(DEMO_BASEMAP_LAYER_IDS.satellite)) {
    map.setLayoutProperty(
      DEMO_BASEMAP_LAYER_IDS.satellite,
      "visibility",
      mode === "street" ? "none" : "visible",
    );
  }
  for (const layerId of DEMO_HYBRID_LAYER_IDS) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(
        layerId,
        "visibility",
        mode === "hybrid" ? "visible" : "none",
      );
    }
  }
}

export function SavedMapCompare({ mapId }: Readonly<{ mapId: string }>) {
  const searchParams = useSearchParams();
  const shareToken = searchParams.get("share") ?? "";
  const [savedMap, setSavedMap] = useState<LocalSavedMap | null>(null);
  const [imageSource, setImageSource] = useState<string | null>(null);
  const [overlayImage, setOverlayImage] = useState<HTMLImageElement | null>(null);
  const [imageError, setImageError] = useState(false);
  const [loadStatus, setLoadStatus] = useState<CompareLoadStatus>("loading");
  const [mapReady, setMapReady] = useState(false);
  const [opacity, setOpacity] = useState(DEFAULT_OPACITY);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [basemapMode, setBasemapMode] = useState<DemoBasemapMode>("street");
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const drawFrameRef = useRef<number | null>(null);
  const drawOverlayRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    void (async () => {
      try {
        const map = await readSavedMap(mapId);
        if (cancelled) {
          return;
        }
        if (map) {
          objectUrl = URL.createObjectURL(map.imageBlob);
          setSavedMap(map);
          setBasemapMode(map.basemapMode);
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
        const publicMap = createLocalMapFromPublicDetail(detail, imageBlob);
        objectUrl = URL.createObjectURL(imageBlob);
        setSavedMap(publicMap);
        setBasemapMode(publicMap.basemapMode);
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
    if (!imageSource) {
      return;
    }

    let cancelled = false;
    const image = new window.Image();
    image.decoding = "async";
    image.onload = () => {
      if (!cancelled) {
        setOverlayImage(image);
        setImageError(false);
      }
    };
    image.onerror = () => {
      if (!cancelled) {
        setImageError(true);
      }
    };
    image.src = imageSource;

    return () => {
      cancelled = true;
    };
  }, [imageSource]);

  const model = useMemo(
    () => (savedMap ? createGeoreferenceModel(savedMap.anchors) : null),
    [savedMap],
  );
  const mesh = useMemo(
    () =>
      savedMap && model
        ? createCompareMesh(savedMap.imageDimensions, model)
        : null,
    [model, savedMap],
  );
  const meshIsFolded = (model?.quality.foldedTriangleCount ?? 0) > 0;

  const drawOverlay = useCallback(() => {
    const map = mapRef.current;
    const canvas = overlayCanvasRef.current;
    if (!map || !canvas) {
      return;
    }

    const mapCanvas = map.getCanvas();
    const width = mapCanvas.clientWidth;
    const height = mapCanvas.clientHeight;
    const pixelRatio = Math.min(
      window.devicePixelRatio || 1,
      MAX_CANVAS_PIXEL_RATIO,
    );
    const pixelWidth = Math.max(1, Math.round(width * pixelRatio));
    const pixelHeight = Math.max(1, Math.round(height * pixelRatio));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    if (!overlayVisible || !overlayImage || !mesh || meshIsFolded) {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    drawWarpedMap({
      context,
      image: overlayImage,
      mesh,
      project: (point) => map.project([point.longitude, point.latitude]),
      opacity: opacity / 100,
      width,
      height,
      devicePixelRatio: pixelRatio,
    });
  }, [mesh, meshIsFolded, opacity, overlayImage, overlayVisible]);

  useEffect(() => {
    drawOverlayRef.current = drawOverlay;
    if (mapReady) {
      drawOverlay();
    }
  }, [drawOverlay, mapReady]);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (loadStatus !== "ready" || !container || !mesh || meshIsFolded) {
      return;
    }

    let disposed = false;
    let localMap: MapLibreMap | null = null;

    void import("maplibre-gl").then((maplibre) => {
      if (disposed) {
        return;
      }

      const map = new maplibre.Map({
        container,
        style: createDemoBasemapStyle(),
        center: [
          (mesh.bounds.west + mesh.bounds.east) / 2,
          (mesh.bounds.south + mesh.bounds.north) / 2,
        ],
        zoom: 11,
        pitchWithRotate: false,
        dragRotate: false,
      });
      localMap = map;
      mapRef.current = map;
      map.addControl(
        new maplibre.NavigationControl({ showCompass: false }),
        "bottom-right",
      );

      const scheduleDraw = () => {
        if (drawFrameRef.current !== null) {
          cancelAnimationFrame(drawFrameRef.current);
        }
        drawFrameRef.current = requestAnimationFrame(() => {
          drawFrameRef.current = null;
          drawOverlayRef.current();
        });
      };

      map.on("render", scheduleDraw);
      map.on("resize", scheduleDraw);
      map.on("load", () => {
        if (disposed) {
          return;
        }
        fitOverlay(map, mesh);
        setMapReady(true);
        scheduleDraw();
      });
    });

    return () => {
      disposed = true;
      setMapReady(false);
      if (drawFrameRef.current !== null) {
        cancelAnimationFrame(drawFrameRef.current);
        drawFrameRef.current = null;
      }
      localMap?.remove();
      if (mapRef.current === localMap) {
        mapRef.current = null;
      }
    };
  }, [loadStatus, mesh, meshIsFolded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) {
      return;
    }
    applyBasemapMode(map, basemapMode);
  }, [basemapMode, mapReady]);

  if (loadStatus === "loading") {
    return (
      <main className="saved-map-viewer-state" id="main-content">
        <div className="map-library-loading" />
        <h1>Preparing Compare…</h1>
      </main>
    );
  }

  if (loadStatus === "missing" || loadStatus === "error" || !savedMap) {
    return (
      <main className="saved-map-viewer-state" id="main-content">
        <p className="eyebrow">Compare</p>
        <h1>
          {loadStatus === "missing"
            ? "That saved map was not found."
            : "That map could not be opened."}
        </h1>
        <p>The rest of your local map library has not been changed.</p>
        <Link className="button button--ink" href="/my-maps">
          Back to My Maps
        </Link>
      </main>
    );
  }

  if (!mesh || meshIsFolded) {
    return (
      <main className="saved-map-viewer-state" id="main-content">
        <p className="eyebrow">Compare unavailable</p>
        <h1>
          {meshIsFolded
            ? "A few anchors fold this map over itself."
            : "This map needs at least two stable anchors."}
        </h1>
        <p>
          Edit the anchors first so Compare can place the image without showing a
          misleading overlay.
        </p>
        <div className="compare-state-actions">
          <Link className="button button--ink" href="/my-maps">
            Back to My Maps
          </Link>
          <Link
            className="button button--signal"
            href={shareToken ? `/maps/${savedMap.id}?share=${encodeURIComponent(shareToken)}` : `/maps/${savedMap.id}` as Route}
          >
            Open map
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="compare-page" id="main-content">
      <section className="compare-shell" aria-label={`${savedMap.metadata.title} comparison`}>
        <header className="compare-header">
          <div className="compare-header__identity">
            <Link href={shareToken ? `/maps/${mapId}?share=${encodeURIComponent(shareToken)}` : `/maps/${mapId}`} aria-label="Back to map">←</Link>
            <div>
              <p>{savedMap.metadata.placeName || "Saved map"}</p>
              <h1>{savedMap.metadata.title}</h1>
            </div>
          </div>
          <div className="compare-header__actions">
            <span>{savedMap.anchors.length} anchors · {model?.mode}</span>
            <Link
              className="button button--quiet"
              href={shareToken ? `/maps/${savedMap.id}?share=${encodeURIComponent(shareToken)}` : `/maps/${savedMap.id}` as Route}
            >
              GPS map
            </Link>
          </div>
        </header>

        <div className="compare-stage">
          <div className="compare-basemap" ref={mapContainerRef} />
          <canvas
            className="compare-overlay-canvas"
            ref={overlayCanvasRef}
            aria-hidden="true"
          />

          <section className="compare-controls" aria-label="Comparison controls">
            <div className="compare-controls__topline">
              <strong>Historic overlay</strong>
              <button
                className="text-button"
                type="button"
                onClick={() => setOverlayVisible((visible) => !visible)}
                aria-pressed={overlayVisible}
              >
                {overlayVisible ? "Hide" : "Show"}
              </button>
            </div>

            <label className="compare-opacity">
              <span>Opacity</span>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={opacity}
                onChange={(event) => setOpacity(Number(event.target.value))}
                disabled={!overlayVisible}
              />
              <output>{opacity}%</output>
            </label>

            <div className="compare-basemap-picker" aria-label="Base map style">
              {(["street", "satellite", "hybrid"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setBasemapMode(mode)}
                  aria-pressed={basemapMode === mode}
                >
                  {mode[0].toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>

            <button
              className="button button--ink compare-fit-button"
              type="button"
              onClick={() => {
                if (mapRef.current && mesh) {
                  fitOverlay(mapRef.current, mesh);
                }
              }}
            >
              Fit overlay
            </button>
          </section>

          <aside className="compare-status" aria-live="polite">
            <strong>
              {!mapReady || !overlayImage ? "Building overlay…" : "Triangulated warp"}
            </strong>
            <span>
              {imageError
                ? "The original image could not be decoded."
                : mesh.extrapolatedVertexCount > 0
                  ? "Outside the anchor network, edges use a best-fit estimate."
                  : "The complete image is inside the anchor network."}
            </span>
          </aside>
        </div>
      </section>
    </main>
  );
}
