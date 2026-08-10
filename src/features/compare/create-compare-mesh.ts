import { Delaunay } from "d3-delaunay";

import type {
  GeoreferenceModel,
  GeographicPoint,
  ImagePoint,
} from "@/lib/georeferencing/types";

export type CompareMeshVertex = Readonly<{
  image: ImagePoint;
  geographic: GeographicPoint;
  insideAnchoredRegion: boolean;
}>;

export type CompareMeshTriangle = readonly [number, number, number];

export type CompareMesh = Readonly<{
  vertices: readonly CompareMeshVertex[];
  triangles: readonly CompareMeshTriangle[];
  bounds: Readonly<{
    west: number;
    south: number;
    east: number;
    north: number;
  }>;
  extrapolatedVertexCount: number;
}>;

const DEFAULT_GRID_DIVISIONS = 10;
const POINT_KEY_PRECISION = 4;

function pointKey(point: ImagePoint) {
  return `${point.x.toFixed(POINT_KEY_PRECISION)}:${point.y.toFixed(POINT_KEY_PRECISION)}`;
}

function finitePoint(point: ImagePoint) {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

export function createCompareMesh(
  dimensions: Readonly<{ width: number; height: number }>,
  model: GeoreferenceModel,
  gridDivisions = DEFAULT_GRID_DIVISIONS,
): CompareMesh | null {
  if (
    dimensions.width <= 0 ||
    dimensions.height <= 0 ||
    model.mode === "unavailable"
  ) {
    return null;
  }

  const divisions = Math.max(1, Math.floor(gridDivisions));
  const sourcePoints: ImagePoint[] = [];
  const pointKeys = new Set<string>();

  function addPoint(point: ImagePoint) {
    if (!finitePoint(point)) {
      return;
    }
    const key = pointKey(point);
    if (pointKeys.has(key)) {
      return;
    }
    pointKeys.add(key);
    sourcePoints.push(point);
  }

  for (const anchor of model.anchors) {
    addPoint(anchor.image);
  }

  for (let row = 0; row <= divisions; row += 1) {
    for (let column = 0; column <= divisions; column += 1) {
      addPoint({
        x: (dimensions.width * column) / divisions,
        y: (dimensions.height * row) / divisions,
      });
    }
  }

  const vertices: CompareMeshVertex[] = [];
  for (const image of sourcePoints) {
    const estimate = model.projectImagePoint(image);
    if (!estimate) {
      return null;
    }
    vertices.push({
      image,
      geographic: estimate.point,
      insideAnchoredRegion: estimate.insideAnchoredRegion,
    });
  }

  if (vertices.length < 3) {
    return null;
  }

  const delaunay = Delaunay.from(
    vertices,
    (vertex) => vertex.image.x,
    (vertex) => vertex.image.y,
  );
  const triangles: CompareMeshTriangle[] = [];
  for (let offset = 0; offset < delaunay.triangles.length; offset += 3) {
    triangles.push([
      delaunay.triangles[offset],
      delaunay.triangles[offset + 1],
      delaunay.triangles[offset + 2],
    ]);
  }

  if (triangles.length === 0) {
    return null;
  }

  const longitudes = vertices.map((vertex) => vertex.geographic.longitude);
  const latitudes = vertices.map((vertex) => vertex.geographic.latitude);

  return {
    vertices,
    triangles,
    bounds: {
      west: Math.min(...longitudes),
      south: Math.min(...latitudes),
      east: Math.max(...longitudes),
      north: Math.max(...latitudes),
    },
    extrapolatedVertexCount: vertices.filter(
      (vertex) => !vertex.insideAnchoredRegion,
    ).length,
  };
}
