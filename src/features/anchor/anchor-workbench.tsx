"use client";

import Image from "next/image";
import Link from "next/link";
import type {
  ChangeEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";

import {
  createDemoBasemapStyle,
  DEMO_BASEMAP_LAYER_IDS,
  DEMO_HYBRID_LAYER_IDS,
  type DemoBasemapMode,
} from "@/features/anchor/demo-basemap-style";
import {
  readCurrentAnchorDraft,
  writeCurrentAnchorDraft,
} from "@/features/anchor/local-draft-store";
import {
  imagePointToRotatedPoint,
  normalizeTargetViewRotation,
  rotatedImageDimensions,
  rotatedPointToImagePoint,
  rotateTargetView,
  type TargetViewRotation,
} from "@/features/anchor/target-view-rotation";
import {
  readSavedMap,
  saveNamedMap,
  updateSavedMapContent,
} from "@/features/maps/local-saved-map-store";
import { syncLocalMapToCloud } from "@/features/cloud/cloud-map-service";
import { MapMetadataDialog } from "@/features/maps/map-metadata-dialog";
import {
  EMPTY_MAP_METADATA,
  type SavedMapMetadata,
} from "@/features/maps/saved-map-types";
import { createGeoreferenceModel } from "@/lib/georeferencing/create-georeference-model";
import type { AnchorPair, GeographicPoint, ImagePoint } from "@/lib/georeferencing/types";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type AnchorHistory = Readonly<{
  past: readonly (readonly AnchorPair[])[];
  present: readonly AnchorPair[];
  future: readonly (readonly AnchorPair[])[];
}>;

type AnchorAction =
  | Readonly<{ type: "add"; anchor: AnchorPair }>
  | Readonly<{ type: "delete"; anchorId: string }>
  | Readonly<{ type: "undo" }>
  | Readonly<{ type: "redo" }>
  | Readonly<{ type: "restore"; anchors: readonly AnchorPair[] }>
  | Readonly<{ type: "reset" }>;

type ImageDimensions = Readonly<{
  width: number;
  height: number;
}>;

type PanGesture = {
  pointerId: number;
  startX: number;
  startY: number;
  scrollLeft: number;
  scrollTop: number;
  moved: boolean;
};

type ZoomFocus = Readonly<{
  contentXAtZoomOne: number;
  contentYAtZoomOne: number;
  viewportX: number;
  viewportY: number;
}>;

type DraftStatus = "loading" | "idle" | "saving" | "saved" | "error";
type MapSaveStatus = "idle" | "saving" | "saved" | "error";

const DEFAULT_IMAGE = "/demo-park-map.svg";
const DEFAULT_IMAGE_DIMENSIONS: ImageDimensions = { width: 1_200, height: 800 };
const MIN_TARGET_ZOOM = 0.5;
const MAX_TARGET_ZOOM = 32;
const TARGET_ZOOM_BUTTON_FACTOR = 1.25;
const PAN_THRESHOLD_PX = 6;
const TARGET_EDGE_PADDING_PX = 64;
const AUTOSAVE_DELAY_MS = 700;

const INITIAL_HISTORY: AnchorHistory = {
  past: [],
  present: [],
  future: [],
};

function anchorReducer(history: AnchorHistory, action: AnchorAction): AnchorHistory {
  if (action.type === "restore") {
    return {
      past: [],
      present: action.anchors,
      future: [],
    };
  }

  if (action.type === "undo") {
    const previous = history.past.at(-1);
    if (!previous) {
      return history;
    }

    return {
      past: history.past.slice(0, -1),
      present: previous,
      future: [history.present, ...history.future],
    };
  }

  if (action.type === "redo") {
    const next = history.future[0];
    if (!next) {
      return history;
    }

    return {
      past: [...history.past, history.present],
      present: next,
      future: history.future.slice(1),
    };
  }

  if (action.type === "reset") {
    if (history.present.length === 0) {
      return history;
    }

    return {
      past: [...history.past, history.present],
      present: [],
      future: [],
    };
  }

  const nextAnchors =
    action.type === "add"
      ? [...history.present, action.anchor]
      : history.present.filter((anchor) => anchor.id !== action.anchorId);

  if (nextAnchors.length === history.present.length && action.type === "delete") {
    return history;
  }

  return {
    past: [...history.past, history.present],
    present: nextAnchors,
    future: [],
  };
}

function imagePointFromPointer(
  event: ReactPointerEvent<HTMLDivElement> | ReactMouseEvent<HTMLDivElement>,
  dimensions: ImageDimensions,
  rotation: TargetViewRotation,
  boundsElement: HTMLElement = event.currentTarget,
): ImagePoint {
  const bounds = boundsElement.getBoundingClientRect();
  const rotatedDimensions = rotatedImageDimensions(dimensions, rotation);
  const displayedPoint = {
    x:
      Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)) *
      rotatedDimensions.width,
    y:
      Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)) *
      rotatedDimensions.height,
  };

  return rotatedPointToImagePoint(displayedPoint, dimensions, rotation);
}

function imagePointIsWithinBounds(point: ImagePoint, dimensions: ImageDimensions) {
  return point.x >= 0 && point.x <= dimensions.width && point.y >= 0 && point.y <= dimensions.height;
}

function markerElement(className: string, label: string) {
  const element = document.createElement("button");
  element.className = className;
  element.type = "button";
  element.textContent = label;
  element.setAttribute("aria-label", label === "" ? "Predicted anchor" : "Anchor " + label);
  return element;
}

function formatCoordinate(point: GeographicPoint | null) {
  if (!point) {
    return "Choose or drag the matching point";
  }

  return point.latitude.toFixed(5) + ", " + point.longitude.toFixed(5);
}

function titleFromImageName(imageName: string) {
  return imageName
    .replace(/\.[^.]+$/u, "")
    .replace(/[_-]+/gu, " ")
    .replace(/\s+page\s+\d+$/iu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

export function AnchorWorkbench({ startFresh = false }: Readonly<{ startFresh?: boolean }>) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [history, dispatch] = useReducer(anchorReducer, INITIAL_HISTORY);
  const [imageSource, setImageSource] = useState(DEFAULT_IMAGE);
  const [imageName, setImageName] = useState("Demo illustrated park map");
  const [imageDimensions, setImageDimensions] = useState<ImageDimensions>(DEFAULT_IMAGE_DIMENSIONS);
  const [targetZoom, setTargetZoom] = useState(1);
  const [targetRotation, setTargetRotation] = useState<TargetViewRotation>(0);
  const [hoverImagePoint, setHoverImagePoint] = useState<ImagePoint | null>(null);
  const [hoverGeographicPoint, setHoverGeographicPoint] = useState<GeographicPoint | null>(null);
  const [pendingImagePoint, setPendingImagePoint] = useState<ImagePoint | null>(null);
  const [pendingGeographicPoint, setPendingGeographicPoint] = useState<GeographicPoint | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [basemapMode, setBasemapMode] = useState<DemoBasemapMode>("street");
  const [draftHydrated, setDraftHydrated] = useState(startFresh);
  const [draftStatus, setDraftStatus] = useState<DraftStatus>(startFresh ? "idle" : "loading");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [savedMapId, setSavedMapId] = useState<string | null>(null);
  const [savedMapMetadata, setSavedMapMetadata] = useState<SavedMapMetadata | null>(null);
  const [metadataDialogOpen, setMetadataDialogOpen] = useState(false);
  const [mapSaveStatus, setMapSaveStatus] = useState<MapSaveStatus>("idle");
  const [mapSaveError, setMapSaveError] = useState<string | null>(null);
  const targetScrollRef = useRef<HTMLDivElement>(null);
  const targetImageFrameRef = useRef<HTMLDivElement>(null);
  const targetZoomRef = useRef(1);
  const targetZoomFocusRef = useRef<ZoomFocus | null>(null);
  const targetPanRef = useRef<PanGesture | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const pendingImagePointRef = useRef<ImagePoint | null>(null);
  const pendingGeographicPointRef = useRef<GeographicPoint | null>(null);
  const pendingMarkerRef = useRef<MapLibreMarker | null>(null);
  const predictionMarkerRef = useRef<MapLibreMarker | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftSaveSequenceRef = useRef(0);
  const centerAfterRotationRef = useRef(false);
  const anchors = history.present;
  const model = useMemo(() => createGeoreferenceModel(anchors), [anchors]);
  const modelRef = useRef(model);
  const imageDimensionsRef = useRef(imageDimensions);
  const targetDisplayDimensions = useMemo(
    () => rotatedImageDimensions(imageDimensions, targetRotation),
    [imageDimensions, targetRotation],
  );
  const hoverEstimate = hoverImagePoint ? model.projectImagePoint(hoverImagePoint) : null;
  const pendingEstimate = pendingImagePoint ? model.projectImagePoint(pendingImagePoint) : null;
  const initialMapMetadata = useMemo<SavedMapMetadata>(() => (
    savedMapMetadata ?? {
      ...EMPTY_MAP_METADATA,
      title: imageSource === DEFAULT_IMAGE ? "" : titleFromImageName(imageName),
    }
  ), [imageName, imageSource, savedMapMetadata]);

  useEffect(() => {
    modelRef.current = model;
  }, [model]);

  useEffect(() => {
    imageDimensionsRef.current = imageDimensions;
  }, [imageDimensions]);

  useEffect(() => {
    pendingImagePointRef.current = pendingImagePoint;
  }, [pendingImagePoint]);

  useEffect(() => {
    pendingGeographicPointRef.current = pendingGeographicPoint;
  }, [pendingGeographicPoint]);

  useEffect(() => {
    targetZoomRef.current = targetZoom;
  }, [targetZoom]);

  useEffect(() => {
    if (startFresh) {
      return;
    }

    let cancelled = false;

    void readCurrentAnchorDraft()
      .then((draft) => {
        if (cancelled) {
          return;
        }

        if (draft) {
          if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
          }

          const objectUrl = URL.createObjectURL(draft.imageBlob);
          objectUrlRef.current = objectUrl;
          setImageSource(objectUrl);
          setImageName(draft.imageName);
          setImageDimensions(draft.imageDimensions);
          setTargetZoom(draft.targetZoom);
          setTargetRotation(normalizeTargetViewRotation(draft.targetRotation));
          setBasemapMode(draft.basemapMode);
          setSavedMapId(draft.savedMapId ?? null);
          dispatch({ type: "restore", anchors: draft.anchors });
          setLastSavedAt(draft.savedAt);
          setDraftStatus("saved");

          if (draft.savedMapId) {
            void readSavedMap(draft.savedMapId).then((map) => {
              if (!cancelled && map) {
                setSavedMapMetadata(map.metadata);
                setMapSaveStatus("saved");
              }
            });
          }
        } else {
          setDraftStatus("idle");
        }

        setDraftHydrated(true);
      })
      .catch(() => {
        if (!cancelled) {
          setDraftHydrated(true);
          setDraftStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [startFresh]);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) {
      return;
    }

    let disposed = false;

    void import("maplibre-gl").then((maplibre) => {
      if (disposed) {
        return;
      }

      const map = new maplibre.Map({
        container,
        style: process.env.NEXT_PUBLIC_BASEMAP_STYLE_URL ?? createDemoBasemapStyle(),
        center: [-73.67, 40.98],
        zoom: 11,
      });
      map.addControl(new maplibre.NavigationControl({ showCompass: true }), "bottom-right");
      map.addControl(
        new maplibre.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: false,
          showAccuracyCircle: true,
        }),
        "bottom-right",
      );
      map.on("load", () => setMapReady(true));
      map.on("click", (event) => {
        if (!pendingImagePointRef.current) {
          return;
        }

        setPendingGeographicPoint({ longitude: event.lngLat.lng, latitude: event.lngLat.lat });
      });
      map.on("mousemove", (event) => {
        const geographicPoint = { longitude: event.lngLat.lng, latitude: event.lngLat.lat };
        const estimate = modelRef.current.projectGeographicPoint({
          longitude: geographicPoint.longitude,
          latitude: geographicPoint.latitude,
        });

        if (!estimate) {
          setHoverImagePoint(null);
          setHoverGeographicPoint(null);
          return;
        }

        setHoverImagePoint(imagePointIsWithinBounds(estimate.point, imageDimensionsRef.current) ? estimate.point : null);
        setHoverGeographicPoint(geographicPoint);
      });
      map.on("mouseout", () => {
        setHoverImagePoint(null);
        setHoverGeographicPoint(null);
      });
      mapRef.current = map;
    });

    return () => {
      disposed = true;
      setMapReady(false);
      pendingMarkerRef.current?.remove();
      pendingMarkerRef.current = null;
      predictionMarkerRef.current?.remove();
      predictionMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || process.env.NEXT_PUBLIC_BASEMAP_STYLE_URL) {
      return;
    }

    map.setLayoutProperty(
      DEMO_BASEMAP_LAYER_IDS.street,
      "visibility",
      basemapMode === "street" ? "visible" : "none",
    );
    map.setLayoutProperty(
      DEMO_BASEMAP_LAYER_IDS.satellite,
      "visibility",
      basemapMode === "street" ? "none" : "visible",
    );
    for (const layerId of DEMO_HYBRID_LAYER_IDS) {
      map.setLayoutProperty(
        layerId,
        "visibility",
        basemapMode === "hybrid" ? "visible" : "none",
      );
    }
  }, [basemapMode, mapReady]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) {
      return;
    }

    const map = mapRef.current;
    const markers: MapLibreMarker[] = [];
    let cancelled = false;

    void import("maplibre-gl").then((maplibre) => {
      if (cancelled) {
        return;
      }

      for (let index = 0; index < anchors.length; index += 1) {
        const anchor = anchors[index];
        const marker = new maplibre.Marker({ element: markerElement("anchor-map-marker", String(index + 1)) })
          .setLngLat([anchor.geographic.longitude, anchor.geographic.latitude])
          .addTo(map);
        markers.push(marker);
      }
    });

    return () => {
      cancelled = true;
      for (const marker of markers) {
        marker.remove();
      }
    };
  }, [anchors, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) {
      return;
    }

    if (!pendingImagePoint) {
      pendingMarkerRef.current?.remove();
      pendingMarkerRef.current = null;
      return;
    }

    let cancelled = false;
    const startPoint = pendingGeographicPointRef.current ?? {
      longitude: map.getCenter().lng,
      latitude: map.getCenter().lat,
    };

    void import("maplibre-gl").then((maplibre) => {
      if (cancelled) {
        return;
      }

      pendingMarkerRef.current?.remove();
      const marker = new maplibre.Marker({
        element: markerElement("pending-map-marker", "+"),
        draggable: true,
      })
        .setLngLat([startPoint.longitude, startPoint.latitude])
        .addTo(map);
      marker.on("dragend", () => {
        const position = marker.getLngLat();
        setPendingGeographicPoint({ longitude: position.lng, latitude: position.lat });
      });
      pendingMarkerRef.current = marker;
    });

    return () => {
      cancelled = true;
      pendingMarkerRef.current?.remove();
      pendingMarkerRef.current = null;
    };
  }, [mapReady, pendingImagePoint]);

  useEffect(() => {
    if (!pendingGeographicPoint || !pendingMarkerRef.current) {
      return;
    }

    pendingMarkerRef.current.setLngLat([pendingGeographicPoint.longitude, pendingGeographicPoint.latitude]);
  }, [pendingGeographicPoint]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || (!hoverEstimate && !hoverGeographicPoint) || pendingImagePoint) {
      predictionMarkerRef.current?.remove();
      predictionMarkerRef.current = null;
      return;
    }

    let cancelled = false;
    void import("maplibre-gl").then((maplibre) => {
      if (cancelled) {
        return;
      }

      const geographicPoint = hoverGeographicPoint ?? hoverEstimate?.point;
      if (!geographicPoint) {
        return;
      }

      const coordinates: [number, number] = [geographicPoint.longitude, geographicPoint.latitude];

      if (!predictionMarkerRef.current) {
        predictionMarkerRef.current = new maplibre.Marker({
          element: markerElement("prediction-map-marker", ""),
        })
          .setLngLat(coordinates)
          .addTo(map);
      } else {
        predictionMarkerRef.current.setLngLat(coordinates);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [hoverEstimate, hoverGeographicPoint, mapReady, pendingImagePoint]);

  useEffect(() => {
    return () => {
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current);
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const persistDraft = useCallback(async () => {
    if (!draftHydrated || imageSource === DEFAULT_IMAGE) {
      return;
    }

    const saveSequence = draftSaveSequenceRef.current + 1;
    draftSaveSequenceRef.current = saveSequence;
    setDraftStatus("saving");

    try {
      const response = await fetch(imageSource);
      if (!response.ok) {
        throw new Error("The uploaded image is no longer available.");
      }
      const imageBlob = await response.blob();

      if (saveSequence !== draftSaveSequenceRef.current) {
        return;
      }

      const savedAt = Date.now();
      await writeCurrentAnchorDraft({
        savedAt,
        imageName,
        imageBlob,
        imageDimensions,
        anchors,
        targetZoom,
        targetRotation,
        basemapMode,
        savedMapId: savedMapId ?? undefined,
      });

      if (savedMapId) {
        await updateSavedMapContent(savedMapId, {
          imageName,
          imageBlob,
          imageDimensions,
          anchors,
          targetZoom,
          basemapMode,
        });
      }

      if (saveSequence === draftSaveSequenceRef.current) {
        setLastSavedAt(savedAt);
        setDraftStatus("saved");
      }
    } catch {
      if (saveSequence === draftSaveSequenceRef.current) {
        setDraftStatus("error");
      }
    }
  }, [anchors, basemapMode, draftHydrated, imageDimensions, imageName, imageSource, savedMapId, targetRotation, targetZoom]);

  useEffect(() => {
    if (!draftHydrated || imageSource === DEFAULT_IMAGE) {
      return;
    }

    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
    }

    draftSaveTimerRef.current = setTimeout(() => {
      void persistDraft();
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current);
      }
    };
  }, [draftHydrated, imageSource, persistDraft]);

  function draftStatusText() {
    if (draftStatus === "loading") {
      return "Restoring draft…";
    }
    if (draftStatus === "saving") {
      return "Saving…";
    }
    if (draftStatus === "error") {
      return "Save failed · try again";
    }
    if (draftStatus === "saved" && lastSavedAt) {
      return "Saved " + new Date(lastSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    return imageSource === DEFAULT_IMAGE ? "Choose an image to save" : "Not saved yet";
  }

  function beginAnchor(point: ImagePoint) {
    const estimate = model.projectImagePoint(point);
    const mapCenter = mapRef.current?.getCenter();
    setPendingImagePoint(point);
    setPendingGeographicPoint(
      estimate?.point ??
        (mapCenter ? { longitude: mapCenter.lng, latitude: mapCenter.lat } : null),
    );
  }

  function savePendingAnchor() {
    if (!pendingImagePoint || !pendingGeographicPoint) {
      return;
    }

    dispatch({
      type: "add",
      anchor: {
        id: "anchor-" + Date.now().toString(36),
        image: pendingImagePoint,
        geographic: pendingGeographicPoint,
      },
    });
    setPendingImagePoint(null);
    setPendingGeographicPoint(null);
  }

  function cancelPendingAnchor() {
    setPendingImagePoint(null);
    setPendingGeographicPoint(null);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      return;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    setImageSource(objectUrl);
    setImageName(file.name);
    setPendingImagePoint(null);
    setPendingGeographicPoint(null);
    setTargetZoom(1);
    setTargetRotation(0);
    setSavedMapId(null);
    setSavedMapMetadata(null);
    setMapSaveStatus("idle");
    setMapSaveError(null);
    setLastSavedAt(null);
    setDraftStatus("idle");
    dispatch({ type: "reset" });
  }

  async function saveFinishedMap(metadata: SavedMapMetadata) {
    if (imageSource === DEFAULT_IMAGE || anchors.length < 2) {
      return;
    }

    setMapSaveStatus("saving");
    setMapSaveError(null);

    try {
      const response = await fetch(imageSource);
      if (!response.ok) {
        throw new Error("The uploaded image is no longer available.");
      }
      const imageBlob = await response.blob();
      const map = await saveNamedMap({
        mapId: savedMapId,
        metadata,
        content: {
          imageName,
          imageBlob,
          imageDimensions,
          anchors,
          targetZoom,
          basemapMode,
        },
      });
      let cloudBackupError: string | null = null;
      if (supabase) {
        try {
          const { data } = await supabase.auth.getUser();
          if (!data.user) {
            throw new Error("Sign in to back up this map to your account.");
          }
          await syncLocalMapToCloud(map, data.user.id);
        } catch {
          cloudBackupError = "Saved locally. Cloud backup is still pending; you can retry it from My Maps.";
        }
      } else {
        cloudBackupError = "Saved locally. Cloud backup is unavailable until account setup is complete.";
      }
      const savedAt = Date.now();
      await writeCurrentAnchorDraft({
        savedAt,
        imageName,
        imageBlob,
        imageDimensions,
        anchors,
        targetZoom,
        targetRotation,
        basemapMode,
        savedMapId: map.id,
      });

      setSavedMapId(map.id);
      setSavedMapMetadata(map.metadata);
      setLastSavedAt(savedAt);
      setDraftStatus("saved");
      setMapSaveStatus("saved");
      setMapSaveError(cloudBackupError);
      setMetadataDialogOpen(false);
    } catch {
      setMapSaveStatus("error");
      setMapSaveError("The map could not be saved. Your anchor draft is still safe.");
    }
  }

  const zoomTargetAt = useCallback((nextZoom: number, clientX?: number, clientY?: number) => {
    const container = targetScrollRef.current;
    const boundedZoom = Math.min(MAX_TARGET_ZOOM, Math.max(MIN_TARGET_ZOOM, nextZoom));
    const currentZoom = targetZoomRef.current;

    if (!container || Math.abs(boundedZoom - currentZoom) < 0.001) {
      return;
    }

    const bounds = container.getBoundingClientRect();
    const viewportX = Math.min(
      container.clientWidth,
      Math.max(0, clientX === undefined ? container.clientWidth / 2 : clientX - bounds.left),
    );
    const viewportY = Math.min(
      container.clientHeight,
      Math.max(0, clientY === undefined ? container.clientHeight / 2 : clientY - bounds.top),
    );

    const currentEdgePadding = currentZoom !== 1 ? TARGET_EDGE_PADDING_PX : 0;
    targetZoomFocusRef.current = {
      contentXAtZoomOne: (container.scrollLeft + viewportX) / currentZoom,
      contentYAtZoomOne: (container.scrollTop - currentEdgePadding + viewportY) / currentZoom,
      viewportX,
      viewportY,
    };

    targetZoomRef.current = boundedZoom;
    setTargetZoom(boundedZoom);
  }, []);

  useLayoutEffect(() => {
    const container = targetScrollRef.current;
    const focus = targetZoomFocusRef.current;

    if (!container || !focus) {
      return;
    }

    const nextEdgePadding = targetZoom !== 1 ? TARGET_EDGE_PADDING_PX : 0;
    container.scrollLeft = focus.contentXAtZoomOne * targetZoom - focus.viewportX;
    container.scrollTop = focus.contentYAtZoomOne * targetZoom + nextEdgePadding - focus.viewportY;
    targetZoomFocusRef.current = null;
  }, [targetZoom]);

  useLayoutEffect(() => {
    const container = targetScrollRef.current;
    if (!container || !centerAfterRotationRef.current) {
      return;
    }

    centerAfterRotationRef.current = false;
    container.scrollLeft = Math.max(
      0,
      (container.scrollWidth - container.clientWidth) / 2,
    );
    container.scrollTop = Math.max(
      0,
      (container.scrollHeight - container.clientHeight) / 2,
    );
  }, [targetRotation]);

  function rotateUploadedMap(direction: "left" | "right") {
    centerAfterRotationRef.current = true;
    setTargetRotation((rotation) => rotateTargetView(rotation, direction));
    setHoverImagePoint(null);
  }

  useEffect(() => {
    const container = targetScrollRef.current;
    if (!container) {
      return;
    }

    let accumulatedDelta = 0;
    let latestClientX = 0;
    let latestClientY = 0;
    let animationFrame: number | null = null;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();

      const deltaMultiplier = event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? container.clientHeight
          : 1;
      accumulatedDelta += event.deltaY * deltaMultiplier;
      latestClientX = event.clientX;
      latestClientY = event.clientY;

      if (animationFrame !== null) {
        return;
      }

      animationFrame = requestAnimationFrame(() => {
        const zoomFactor = Math.exp(-accumulatedDelta * 0.002);
        accumulatedDelta = 0;
        animationFrame = null;
        zoomTargetAt(
          targetZoomRef.current * zoomFactor,
          latestClientX,
          latestClientY,
        );
      });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheel);
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [zoomTargetAt]);

  function handleTargetPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.pointerType === "mouse" && event.button !== 0) || (event.target as HTMLElement).closest("button")) {
      return;
    }

    const container = targetScrollRef.current;
    if (!container) {
      return;
    }

    targetPanRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
      moved: false,
    };
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleTargetPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = targetPanRef.current;
    const container = targetScrollRef.current;

    if (gesture?.pointerId === event.pointerId && container) {
      event.preventDefault();
      const deltaX = event.clientX - gesture.startX;
      const deltaY = event.clientY - gesture.startY;

      if (!gesture.moved && Math.hypot(deltaX, deltaY) >= PAN_THRESHOLD_PX) {
        gesture.moved = true;
        targetImageFrameRef.current?.setAttribute("data-panning", "true");
      }

      if (gesture.moved) {
        container.scrollLeft = gesture.scrollLeft - deltaX;
        container.scrollTop = gesture.scrollTop - deltaY;
        setHoverImagePoint(null);
        setHoverGeographicPoint(null);
        return;
      }
    }

    const frame = targetImageFrameRef.current;
    if (frame) {
      setHoverImagePoint(imagePointFromPointer(event, imageDimensions, targetRotation, frame));
      setHoverGeographicPoint(null);
    }
  }

  function finishTargetPointer(event: ReactPointerEvent<HTMLDivElement>, cancelled = false) {
    const gesture = targetPanRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    targetImageFrameRef.current?.removeAttribute("data-panning");
    targetPanRef.current = null;

    if (!cancelled && !gesture.moved && !(event.target as HTMLElement).closest("button")) {
      const frame = targetImageFrameRef.current;
      if (frame) {
        beginAnchor(imagePointFromPointer(event, imageDimensions, targetRotation, frame));
      }
    }
  }

  function handleTargetLostPointerCapture() {
    targetImageFrameRef.current?.removeAttribute("data-panning");
    targetPanRef.current = null;
  }

  return (
    <div className="anchor-page">
      <header className="anchor-intro">
        <div>
          <p className="eyebrow">Anchor lab · local prototype</p>
          <h1>Match the landmark. Correct the guess.</h1>
          <p>
            Choose a point on your map, then drag or click its real position below. Every saved pair sharpens the next estimate.
          </p>
        </div>
        <div className="anchor-health" data-ready={model.quality.isGpsReady}>
          <span>{anchors.length}</span>
          <div>
            <strong>{anchors.length === 1 ? "anchor" : "anchors"}</strong>
            <small>{model.mode === "unavailable" ? "Not GPS-ready" : model.mode}</small>
          </div>
        </div>
      </header>

      <div className="anchor-toolbar" aria-label="Anchor editor controls">
        <label className="button button--ink file-button">
          Choose map image
          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={handleFileChange} />
        </label>
        <button className="button button--quiet" type="button" onClick={() => dispatch({ type: "undo" })} disabled={history.past.length === 0}>
          Undo
        </button>
        <button className="button button--quiet" type="button" onClick={() => dispatch({ type: "redo" })} disabled={history.future.length === 0}>
          Redo
        </button>
        <button
          className="button button--signal"
          type="button"
          onClick={() => void persistDraft()}
          disabled={!draftHydrated || draftStatus === "saving" || imageSource === DEFAULT_IMAGE}
        >
          Save draft
        </button>
        <button
          className="button button--ink"
          type="button"
          onClick={() => {
            setMapSaveError(null);
            setMetadataDialogOpen(true);
          }}
          disabled={imageSource === DEFAULT_IMAGE || anchors.length < 2 || mapSaveStatus === "saving"}
          title={anchors.length < 2 ? "Add at least two anchors before finishing this map" : undefined}
        >
          {savedMapId ? "Map details" : "Finish map"}
        </button>
        {savedMapId ? (
          <Link className="button button--quiet" href="/my-maps">Open My Maps</Link>
        ) : null}
        <span className="draft-status" data-state={draftStatus} role="status" aria-live="polite">
          {draftStatusText()}
        </span>
        {mapSaveStatus === "saved" ? <span className="map-save-status">{mapSaveError ? "Saved locally · cloud backup pending" : "Saved to My Maps · backed up"}</span> : null}
        <div className="anchor-toolbar__spacer" />
        <span className="anchor-toolbar__filename" title={imageName}>{imageName}</span>
      </div>

      <div className="anchor-layout">
        <section className="anchor-split" aria-label="Split map anchor editor">
          <div className="anchor-pane anchor-pane--target">
            <div className="pane-label">
              <span>01</span>
              <div>
                <strong>Your map</strong>
                <small>Drag to pan · scroll to zoom · click to anchor</small>
              </div>
              <div className="target-view-controls">
                <div className="rotation-controls" role="group" aria-label="Uploaded map rotation">
                  <button
                    type="button"
                    onClick={() => rotateUploadedMap("left")}
                    aria-label="Rotate uploaded map 90 degrees left"
                    title="Rotate 90° left"
                  >
                    ↶
                  </button>
                  <button
                    type="button"
                    onClick={() => rotateUploadedMap("right")}
                    aria-label="Rotate uploaded map 90 degrees right"
                    title="Rotate 90° right"
                  >
                    ↷
                  </button>
                </div>
                <div className="zoom-controls" aria-label="Uploaded map zoom">
                  <button
                    type="button"
                    onClick={() => zoomTargetAt(targetZoom / TARGET_ZOOM_BUTTON_FACTOR)}
                    aria-label="Zoom uploaded map out"
                    disabled={targetZoom <= MIN_TARGET_ZOOM}
                  >
                    −
                  </button>
                  <span>{Math.round(targetZoom * 100)}%</span>
                  <button
                    type="button"
                    onClick={() => zoomTargetAt(targetZoom * TARGET_ZOOM_BUTTON_FACTOR)}
                    aria-label="Zoom uploaded map in"
                    disabled={targetZoom >= MAX_TARGET_ZOOM}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
            <div
              className="target-scroll"
              ref={targetScrollRef}
              data-zoomed={targetZoom !== 1 ? "true" : "false"}
              data-zoomed-out={targetZoom < 1 ? "true" : "false"}
              onPointerDown={handleTargetPointerDown}
              onPointerMove={handleTargetPointerMove}
              onPointerUp={(event) => finishTargetPointer(event)}
              onPointerCancel={(event) => finishTargetPointer(event, true)}
              onLostPointerCapture={handleTargetLostPointerCapture}
              onDragStart={(event) => event.preventDefault()}
              onPointerLeave={() => {
                if (!targetPanRef.current) {
                  setHoverImagePoint(null);
                  setHoverGeographicPoint(null);
                }
              }}
            >
              <div
                className="target-image-frame"
                ref={targetImageFrameRef}
                style={{
                  aspectRatio: targetDisplayDimensions.width.toString() + " / " + targetDisplayDimensions.height.toString(),
                  width: (targetZoom * 100).toString() + "%",
                }}
                onDragStart={(event) => event.preventDefault()}
              >
                <div
                  className="target-image-rotation-layer"
                  style={{
                    width: ((imageDimensions.width / targetDisplayDimensions.width) * 100).toString() + "%",
                    height: ((imageDimensions.height / targetDisplayDimensions.height) * 100).toString() + "%",
                    transform: `translate(-50%, -50%) rotate(${targetRotation}deg)`,
                  }}
                >
                  <Image
                    className="target-image"
                    src={imageSource}
                    alt={imageName}
                    width={imageDimensions.width}
                    height={imageDimensions.height}
                    unoptimized
                    priority
                    draggable={false}
                    onLoad={(event) => {
                      const image = event.currentTarget;
                      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
                        setImageDimensions({ width: image.naturalWidth, height: image.naturalHeight });
                      }
                    }}
                  />
                </div>
                {anchors.map((anchor, index) => {
                  const displayedPoint = imagePointToRotatedPoint(
                    anchor.image,
                    imageDimensions,
                    targetRotation,
                  );
                  return (
                    <button
                      className="target-anchor-marker"
                      type="button"
                      style={{
                        left: ((displayedPoint.x / targetDisplayDimensions.width) * 100).toString() + "%",
                        top: ((displayedPoint.y / targetDisplayDimensions.height) * 100).toString() + "%",
                      }}
                      aria-label={"Delete anchor " + (index + 1).toString()}
                      onClick={(event) => {
                        event.stopPropagation();
                        dispatch({ type: "delete", anchorId: anchor.id });
                      }}
                      key={anchor.id}
                    >
                      {index + 1}
                    </button>
                  );
                })}
                {pendingImagePoint ? (
                  <span
                    className="target-pending-marker"
                    style={(() => {
                      const displayedPoint = imagePointToRotatedPoint(
                        pendingImagePoint,
                        imageDimensions,
                        targetRotation,
                      );
                      return {
                        left: ((displayedPoint.x / targetDisplayDimensions.width) * 100).toString() + "%",
                        top: ((displayedPoint.y / targetDisplayDimensions.height) * 100).toString() + "%",
                      };
                    })()}
                    aria-hidden="true"
                  />
                ) : null}
                {hoverImagePoint && !pendingImagePoint ? (
                  <span
                    className="target-hover-marker"
                    style={(() => {
                      const displayedPoint = imagePointToRotatedPoint(
                        hoverImagePoint,
                        imageDimensions,
                        targetRotation,
                      );
                      return {
                        left: ((displayedPoint.x / targetDisplayDimensions.width) * 100).toString() + "%",
                        top: ((displayedPoint.y / targetDisplayDimensions.height) * 100).toString() + "%",
                      };
                    })()}
                    aria-hidden="true"
                  />
                ) : null}
              </div>
            </div>
          </div>

          <div className="split-seam" aria-hidden="true">
            <span />
          </div>

          <div className="anchor-pane anchor-pane--base">
            <div className="pane-label pane-label--dark">
              <span>02</span>
              <div>
                <strong>Base map</strong>
                <small>
                  {pendingEstimate
                    ? pendingEstimate.confidence + " estimate"
                    : anchors.length < 2
                      ? "Add two anchors"
                      : "Move over your map"}
                </small>
              </div>
              {!process.env.NEXT_PUBLIC_BASEMAP_STYLE_URL ? (
                <div className="basemap-switch" role="group" aria-label="Base map style">
                  <button
                    type="button"
                    aria-pressed={basemapMode === "street"}
                    onClick={() => setBasemapMode("street")}
                  >
                    Street
                  </button>
                  <button
                    type="button"
                    aria-pressed={basemapMode === "satellite"}
                    onClick={() => setBasemapMode("satellite")}
                  >
                    Satellite
                  </button>
                  <button
                    type="button"
                    aria-pressed={basemapMode === "hybrid"}
                    onClick={() => setBasemapMode("hybrid")}
                  >
                    Hybrid
                  </button>
                </div>
              ) : null}
            </div>
            <div className="base-map" ref={mapContainerRef} aria-label="Interactive geographic basemap" />
            {!process.env.NEXT_PUBLIC_BASEMAP_STYLE_URL ? (
              <div className="demo-basemap-label">
                <strong>
                  {basemapMode === "street"
                    ? "Live street preview"
                    : basemapMode === "hybrid"
                      ? "Live hybrid preview"
                      : "Live satellite preview"}
                </strong>
                <span>Drag and scroll to find the matching landmark.</span>
              </div>
            ) : null}
            {pendingImagePoint ? (
              <div className="pending-anchor-tray">
                <div>
                  <span>Matching position</span>
                  <strong>{formatCoordinate(pendingGeographicPoint)}</strong>
                </div>
                <button className="button button--quiet" type="button" onClick={cancelPendingAnchor}>Cancel</button>
                <button className="button button--signal" type="button" onClick={savePendingAnchor} disabled={!pendingGeographicPoint}>Save pair</button>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="anchor-sidebar">
          <div className="anchor-sidebar__header">
            <div>
              <p className="eyebrow">Anchor pairs</p>
              <h2>{anchors.length === 0 ? "Start with a landmark" : "Correction history"}</h2>
            </div>
            {anchors.length > 0 ? (
              <button className="text-button" type="button" onClick={() => dispatch({ type: "reset" })}>Clear</button>
            ) : null}
          </div>

          {model.quality.warnings.length > 0 ? (
            <div className="quality-note" data-severity={model.quality.foldedTriangleCount > 0 ? "warning" : "info"}>
              <strong>{model.quality.warnings[0].message}</strong>
              <span>{model.quality.foldedTriangleCount > 0 ? "Correct the highlighted area before publishing." : "Spread anchors across the map for better local accuracy."}</span>
            </div>
          ) : (
            <div className="quality-note" data-severity="good">
              <strong>The current mesh is healthy.</strong>
              <span>{model.quality.reliableTriangleCount} reliable map triangles.</span>
            </div>
          )}

          <ol className="anchor-list">
            {anchors.map((anchor, index) => (
              <li key={anchor.id}>
                <span>{index + 1}</span>
                <div>
                  <strong>{anchor.geographic.latitude.toFixed(5)}, {anchor.geographic.longitude.toFixed(5)}</strong>
                  <small>Image {Math.round(anchor.image.x)}, {Math.round(anchor.image.y)}</small>
                </div>
                <button type="button" onClick={() => dispatch({ type: "delete", anchorId: anchor.id })} aria-label={"Delete anchor " + (index + 1).toString()}>×</button>
              </li>
            ))}
          </ol>

          {anchors.length === 0 ? (
            <div className="anchor-empty-guide">
              <span>1</span>
              <p>Tap a landmark on the illustrated map.</p>
              <span>2</span>
              <p>Find the same place on the basemap.</p>
              <span>3</span>
              <p>Save the pair and repeat across the map.</p>
            </div>
          ) : null}
        </aside>
      </div>

      <MapMetadataDialog
        open={metadataDialogOpen}
        initialMetadata={initialMapMetadata}
        anchorCount={anchors.length}
        imageName={imageName}
        saving={mapSaveStatus === "saving"}
        saveError={mapSaveError}
        onDismiss={() => setMetadataDialogOpen(false)}
        onSave={saveFinishedMap}
      />
    </div>
  );
}
