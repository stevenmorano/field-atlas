import type { CompareMesh } from "@/features/compare/create-compare-mesh";
import type { GeographicPoint, ImagePoint } from "@/lib/georeferencing/types";

export type CanvasAffineTransform = Readonly<{
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}>;

type ScreenPoint = Readonly<{ x: number; y: number }>;

const MIN_TRIANGLE_DETERMINANT = 1e-8;
const OFFSCREEN_MARGIN = 32;

export function affineTransformFromTriangles(
  source: readonly [ImagePoint, ImagePoint, ImagePoint],
  destination: readonly [ScreenPoint, ScreenPoint, ScreenPoint],
): CanvasAffineTransform | null {
  const [sourceA, sourceB, sourceC] = source;
  const denominator =
    sourceA.x * (sourceB.y - sourceC.y) +
    sourceB.x * (sourceC.y - sourceA.y) +
    sourceC.x * (sourceA.y - sourceB.y);

  if (Math.abs(denominator) < MIN_TRIANGLE_DETERMINANT) {
    return null;
  }

  function coefficients(
    first: number,
    second: number,
    third: number,
  ): readonly [number, number, number] {
    return [
      (first * (sourceB.y - sourceC.y) +
        second * (sourceC.y - sourceA.y) +
        third * (sourceA.y - sourceB.y)) /
        denominator,
      (first * (sourceC.x - sourceB.x) +
        second * (sourceA.x - sourceC.x) +
        third * (sourceB.x - sourceA.x)) /
        denominator,
      (first * (sourceB.x * sourceC.y - sourceC.x * sourceB.y) +
        second * (sourceC.x * sourceA.y - sourceA.x * sourceC.y) +
        third * (sourceA.x * sourceB.y - sourceB.x * sourceA.y)) /
        denominator,
    ];
  }

  const x = coefficients(destination[0].x, destination[1].x, destination[2].x);
  const y = coefficients(destination[0].y, destination[1].y, destination[2].y);

  return { a: x[0], b: y[0], c: x[1], d: y[1], e: x[2], f: y[2] };
}

function triangleIsOffscreen(
  triangle: readonly [ScreenPoint, ScreenPoint, ScreenPoint],
  width: number,
  height: number,
) {
  return (
    triangle.every((point) => point.x < -OFFSCREEN_MARGIN) ||
    triangle.every((point) => point.y < -OFFSCREEN_MARGIN) ||
    triangle.every((point) => point.x > width + OFFSCREEN_MARGIN) ||
    triangle.every((point) => point.y > height + OFFSCREEN_MARGIN)
  );
}

export function drawWarpedMap(input: Readonly<{
  context: CanvasRenderingContext2D;
  image: CanvasImageSource;
  mesh: CompareMesh;
  project: (point: GeographicPoint) => ScreenPoint;
  opacity: number;
  width: number;
  height: number;
  devicePixelRatio: number;
}>) {
  const {
    context,
    image,
    mesh,
    project,
    width,
    height,
    devicePixelRatio,
  } = input;

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  context.globalAlpha = Math.min(1, Math.max(0, input.opacity));
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  for (const indices of mesh.triangles) {
    const source = indices.map(
      (index) => mesh.vertices[index].image,
    ) as unknown as readonly [ImagePoint, ImagePoint, ImagePoint];
    const destination = indices.map((index) =>
      project(mesh.vertices[index].geographic),
    ) as unknown as readonly [ScreenPoint, ScreenPoint, ScreenPoint];

    if (triangleIsOffscreen(destination, width, height)) {
      continue;
    }

    const transform = affineTransformFromTriangles(source, destination);
    if (!transform) {
      continue;
    }

    const sourceX = Math.max(0, Math.floor(Math.min(...source.map((point) => point.x))));
    const sourceY = Math.max(0, Math.floor(Math.min(...source.map((point) => point.y))));
    const sourceRight = Math.ceil(Math.max(...source.map((point) => point.x)));
    const sourceBottom = Math.ceil(Math.max(...source.map((point) => point.y)));
    const sourceWidth = sourceRight - sourceX;
    const sourceHeight = sourceBottom - sourceY;
    if (sourceWidth <= 0 || sourceHeight <= 0) {
      continue;
    }

    context.save();
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    context.beginPath();
    context.moveTo(destination[0].x, destination[0].y);
    context.lineTo(destination[1].x, destination[1].y);
    context.lineTo(destination[2].x, destination[2].y);
    context.closePath();
    context.clip();
    context.setTransform(
      devicePixelRatio * transform.a,
      devicePixelRatio * transform.b,
      devicePixelRatio * transform.c,
      devicePixelRatio * transform.d,
      devicePixelRatio * transform.e,
      devicePixelRatio * transform.f,
    );
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
    );
    context.restore();
  }

  context.globalAlpha = 1;
}
