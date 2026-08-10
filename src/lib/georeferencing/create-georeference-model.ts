import { Delaunay } from "d3-delaunay";

import {
  applyBarycentricWeights,
  barycentricWeights,
  distanceSquared,
  fitAffineTransform,
  fitSimilarityTransform,
  signedTriangleArea,
  weightsAreInsideTriangle,
} from "@/lib/georeferencing/math";
import { geographicToWorld, worldToGeographic } from "@/lib/georeferencing/mercator";
import type {
  AnchorPair,
  GeoreferenceModel,
  GeographicPoint,
  ImagePoint,
  QualityWarning,
  TransformEstimate,
  TransformMode,
  WorldPoint,
} from "@/lib/georeferencing/types";

type Triangle = Readonly<{
  indices: readonly [number, number, number];
  image: readonly [ImagePoint, ImagePoint, ImagePoint];
  world: readonly [WorldPoint, WorldPoint, WorldPoint];
  isDegenerate: boolean;
  isFolded: boolean;
}>;

const IMAGE_DUPLICATE_DISTANCE_SQUARED = 0.25;
const WORLD_DUPLICATE_DISTANCE_SQUARED = 0.25;
const MIN_IMAGE_TRIANGLE_AREA = 0.5;
const MIN_WORLD_TRIANGLE_AREA = 0.25;

function findFarthestAnchorPair(points: readonly ImagePoint[]) {
  let result: readonly [number, number] | null = null;
  let farthestDistance = -1;

  for (let first = 0; first < points.length; first += 1) {
    for (let second = first + 1; second < points.length; second += 1) {
      const candidateDistance = distanceSquared(points[first], points[second]);
      if (candidateDistance > farthestDistance) {
        farthestDistance = candidateDistance;
        result = [first, second];
      }
    }
  }

  return result;
}

function createTriangles(
  anchors: readonly AnchorPair[],
  worldPoints: readonly WorldPoint[],
  expectedOrientation: number | null,
) {
  if (anchors.length < 3) {
    return { triangles: [] as Triangle[], hull: [] as ImagePoint[] };
  }

  const delaunay = Delaunay.from(
    anchors,
    (anchor) => anchor.image.x,
    (anchor) => anchor.image.y,
  );
  const triangles: Triangle[] = [];

  for (let offset = 0; offset < delaunay.triangles.length; offset += 3) {
    const indices = [
      delaunay.triangles[offset],
      delaunay.triangles[offset + 1],
      delaunay.triangles[offset + 2],
    ] as const;
    const image = indices.map((index) => anchors[index].image) as unknown as Triangle["image"];
    const world = indices.map((index) => worldPoints[index]) as unknown as Triangle["world"];
    const imageArea = signedTriangleArea(image[0], image[1], image[2]);
    const worldArea = signedTriangleArea(world[0], world[1], world[2]);
    const isDegenerate =
      Math.abs(imageArea) < MIN_IMAGE_TRIANGLE_AREA || Math.abs(worldArea) < MIN_WORLD_TRIANGLE_AREA;
    const localOrientation = Math.sign(imageArea * worldArea);

    triangles.push({
      indices,
      image,
      world,
      isDegenerate,
      isFolded:
        !isDegenerate &&
        expectedOrientation !== null &&
        localOrientation !== Math.sign(expectedOrientation),
    });
  }

  return {
    triangles,
    hull: Array.from(delaunay.hull, (index) => anchors[index].image),
  };
}

function findContainingTriangle(
  point: ImagePoint | WorldPoint,
  triangles: readonly Triangle[],
  coordinate: "image" | "world",
) {
  for (let index = 0; index < triangles.length; index += 1) {
    const triangle = triangles[index];
    if (triangle.isDegenerate || triangle.isFolded) {
      continue;
    }

    const vertices = triangle[coordinate];
    const weights = barycentricWeights(point, vertices[0], vertices[1], vertices[2]);
    if (weights && weightsAreInsideTriangle(weights)) {
      return { index, triangle, weights };
    }
  }

  return null;
}

function findDuplicateWarnings(anchors: readonly AnchorPair[], worldPoints: readonly WorldPoint[]) {
  const warnings: QualityWarning[] = [];

  for (let first = 0; first < anchors.length; first += 1) {
    for (let second = first + 1; second < anchors.length; second += 1) {
      if (distanceSquared(anchors[first].image, anchors[second].image) < IMAGE_DUPLICATE_DISTANCE_SQUARED) {
        warnings.push({
          code: "duplicate-image-point",
          message: "Two anchors occupy almost the same point on the uploaded map.",
          anchorIds: [anchors[first].id, anchors[second].id],
        });
      }

      if (distanceSquared(worldPoints[first], worldPoints[second]) < WORLD_DUPLICATE_DISTANCE_SQUARED) {
        warnings.push({
          code: "duplicate-world-point",
          message: "Two anchors occupy almost the same geographic point.",
          anchorIds: [anchors[first].id, anchors[second].id],
        });
      }
    }
  }

  return warnings;
}

export function createGeoreferenceModel(inputAnchors: readonly AnchorPair[]): GeoreferenceModel {
  const anchors = inputAnchors.map((anchor) => ({
    ...anchor,
    image: { ...anchor.image },
    geographic: { ...anchor.geographic },
  }));
  const imagePoints = anchors.map((anchor) => anchor.image);
  const worldPoints = anchors.map((anchor) => geographicToWorld(anchor.geographic));
  const forwardAffine = fitAffineTransform(imagePoints, worldPoints);
  const { triangles, hull } = createTriangles(
    anchors,
    worldPoints,
    forwardAffine?.determinant ?? null,
  );
  const reliableTriangles = triangles.filter((triangle) => !triangle.isDegenerate && !triangle.isFolded);
  const foldedTriangles = triangles.filter((triangle) => triangle.isFolded);
  const degenerateTriangles = triangles.filter((triangle) => triangle.isDegenerate);
  const warnings = findDuplicateWarnings(anchors, worldPoints);
  const inverseAffine = fitAffineTransform(worldPoints, imagePoints);
  const farthestPair = findFarthestAnchorPair(imagePoints);
  const similarity = farthestPair
    ? fitSimilarityTransform(
        imagePoints[farthestPair[0]],
        imagePoints[farthestPair[1]],
        worldPoints[farthestPair[0]],
        worldPoints[farthestPair[1]],
      )
    : null;

  for (const triangle of degenerateTriangles) {
    warnings.push({
      code: "degenerate-triangle",
      message: "Three anchors are too close together or nearly form a straight line.",
      anchorIds: triangle.indices.map((index) => anchors[index].id),
    });
  }

  for (const triangle of foldedTriangles) {
    warnings.push({
      code: "folded-triangle",
      message: "These anchors fold the map mesh and need correction.",
      anchorIds: triangle.indices.map((index) => anchors[index].id),
    });
  }

  let mode: TransformMode = "unavailable";
  if (reliableTriangles.length > 0 && forwardAffine && inverseAffine) {
    mode = "triangulated";
  } else if (forwardAffine && inverseAffine) {
    mode = "affine";
  } else if (similarity) {
    mode = "similarity";
  }

  if (anchors.length < 2) {
    warnings.push({
      code: "insufficient-anchors",
      message: "At least two anchors are required before GPS positioning can begin.",
      anchorIds: anchors.map((anchor) => anchor.id),
    });
  } else if (mode === "unavailable") {
    warnings.push({
      code: "no-stable-transform",
      message: "The current anchors cannot produce a stable transformation.",
      anchorIds: anchors.map((anchor) => anchor.id),
    });
  }

  function projectImagePoint(point: ImagePoint): TransformEstimate<GeographicPoint> | null {
    const containing = findContainingTriangle(point, triangles, "image");

    if (containing) {
      const world = applyBarycentricWeights(
        containing.weights,
        containing.triangle.world[0],
        containing.triangle.world[1],
        containing.triangle.world[2],
      );

      return {
        point: worldToGeographic(world),
        mode: "triangulated",
        confidence: "high",
        insideAnchoredRegion: true,
        triangleIndex: containing.index,
      };
    }

    if (forwardAffine) {
      return {
        point: worldToGeographic(forwardAffine.apply(point)),
        mode: "affine",
        confidence: triangles.length > 0 ? "low" : "medium",
        insideAnchoredRegion: false,
        triangleIndex: null,
      };
    }

    if (similarity) {
      return {
        point: worldToGeographic(similarity.apply(point)),
        mode: "similarity",
        confidence: "low",
        insideAnchoredRegion: false,
        triangleIndex: null,
      };
    }

    return null;
  }

  function projectGeographicPoint(point: GeographicPoint): TransformEstimate<ImagePoint> | null {
    const worldPoint = geographicToWorld(point);
    const containing = findContainingTriangle(worldPoint, triangles, "world");

    if (containing) {
      return {
        point: applyBarycentricWeights(
          containing.weights,
          containing.triangle.image[0],
          containing.triangle.image[1],
          containing.triangle.image[2],
        ),
        mode: "triangulated",
        confidence: "high",
        insideAnchoredRegion: true,
        triangleIndex: containing.index,
      };
    }

    if (inverseAffine) {
      return {
        point: inverseAffine.apply(worldPoint),
        mode: "affine",
        confidence: triangles.length > 0 ? "low" : "medium",
        insideAnchoredRegion: false,
        triangleIndex: null,
      };
    }

    if (similarity) {
      return {
        point: similarity.inverse(worldPoint),
        mode: "similarity",
        confidence: "low",
        insideAnchoredRegion: false,
        triangleIndex: null,
      };
    }

    return null;
  }

  return {
    anchors,
    mode,
    quality: {
      anchorCount: anchors.length,
      mode,
      triangleCount: triangles.length,
      reliableTriangleCount: reliableTriangles.length,
      foldedTriangleCount: foldedTriangles.length,
      degenerateTriangleCount: degenerateTriangles.length,
      isGpsReady: anchors.length >= 2 && mode !== "unavailable" && foldedTriangles.length === 0,
      warnings,
    },
    imageCoverageHull: hull,
    projectImagePoint,
    projectGeographicPoint,
  };
}
