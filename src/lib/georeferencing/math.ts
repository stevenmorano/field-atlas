import type { ImagePoint, WorldPoint } from "@/lib/georeferencing/types";

export type Point2D = ImagePoint | WorldPoint;

type Vector3 = [number, number, number];
type Matrix3 = [Vector3, Vector3, Vector3];

export type AffineTransform = Readonly<{
  apply: (point: Point2D) => Point2D;
  determinant: number;
}>;

export type SimilarityTransform = Readonly<{
  apply: (point: Point2D) => Point2D;
  inverse: (point: Point2D) => Point2D;
}>;

export type BarycentricWeights = Readonly<{
  a: number;
  b: number;
  c: number;
}>;

const EPSILON = 1e-10;

export function distanceSquared(a: Point2D, b: Point2D) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function signedTriangleArea(a: Point2D, b: Point2D, c: Point2D) {
  return ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
}

export function barycentricWeights(
  point: Point2D,
  a: Point2D,
  b: Point2D,
  c: Point2D,
): BarycentricWeights | null {
  const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);

  if (Math.abs(denominator) < EPSILON) {
    return null;
  }

  const weightA = ((b.y - c.y) * (point.x - c.x) + (c.x - b.x) * (point.y - c.y)) / denominator;
  const weightB = ((c.y - a.y) * (point.x - c.x) + (a.x - c.x) * (point.y - c.y)) / denominator;

  return {
    a: weightA,
    b: weightB,
    c: 1 - weightA - weightB,
  };
}

export function weightsAreInsideTriangle(weights: BarycentricWeights, tolerance = 1e-8) {
  return (
    weights.a >= -tolerance &&
    weights.b >= -tolerance &&
    weights.c >= -tolerance &&
    weights.a <= 1 + tolerance &&
    weights.b <= 1 + tolerance &&
    weights.c <= 1 + tolerance
  );
}

export function applyBarycentricWeights(
  weights: BarycentricWeights,
  a: Point2D,
  b: Point2D,
  c: Point2D,
): Point2D {
  return {
    x: weights.a * a.x + weights.b * b.x + weights.c * c.x,
    y: weights.a * a.y + weights.b * b.y + weights.c * c.y,
  };
}

export function fitSimilarityTransform(
  sourceA: Point2D,
  sourceB: Point2D,
  targetA: Point2D,
  targetB: Point2D,
): SimilarityTransform | null {
  const sourceDx = sourceB.x - sourceA.x;
  const sourceDy = sourceB.y - sourceA.y;
  const targetDx = targetB.x - targetA.x;
  const targetDy = targetB.y - targetA.y;
  const sourceLengthSquared = sourceDx * sourceDx + sourceDy * sourceDy;

  if (sourceLengthSquared < EPSILON) {
    return null;
  }

  const scaleCos = (targetDx * sourceDx + targetDy * sourceDy) / sourceLengthSquared;
  const scaleSin = (targetDy * sourceDx - targetDx * sourceDy) / sourceLengthSquared;
  const translateX = targetA.x - (scaleCos * sourceA.x - scaleSin * sourceA.y);
  const translateY = targetA.y - (scaleSin * sourceA.x + scaleCos * sourceA.y);
  const determinant = scaleCos * scaleCos + scaleSin * scaleSin;

  if (determinant < EPSILON) {
    return null;
  }

  return {
    apply(point) {
      return {
        x: scaleCos * point.x - scaleSin * point.y + translateX,
        y: scaleSin * point.x + scaleCos * point.y + translateY,
      };
    },
    inverse(point) {
      const shiftedX = point.x - translateX;
      const shiftedY = point.y - translateY;

      return {
        x: (scaleCos * shiftedX + scaleSin * shiftedY) / determinant,
        y: (-scaleSin * shiftedX + scaleCos * shiftedY) / determinant,
      };
    },
  };
}

function solveMatrix3(matrix: Matrix3, values: Vector3): Vector3 | null {
  const augmented = matrix.map((row, index) => [...row, values[index]]) as [number[], number[], number[]];

  for (let column = 0; column < 3; column += 1) {
    let pivotRow = column;

    for (let row = column + 1; row < 3; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivotRow][column])) {
        pivotRow = row;
      }
    }

    if (Math.abs(augmented[pivotRow][column]) < EPSILON) {
      return null;
    }

    if (pivotRow !== column) {
      const current = augmented[column];
      augmented[column] = augmented[pivotRow];
      augmented[pivotRow] = current;
    }

    const pivot = augmented[column][column];
    for (let entry = column; entry < 4; entry += 1) {
      augmented[column][entry] /= pivot;
    }

    for (let row = 0; row < 3; row += 1) {
      if (row === column) {
        continue;
      }

      const factor = augmented[row][column];
      for (let entry = column; entry < 4; entry += 1) {
        augmented[row][entry] -= factor * augmented[column][entry];
      }
    }
  }

  return [augmented[0][3], augmented[1][3], augmented[2][3]];
}

export function fitAffineTransform(source: readonly Point2D[], target: readonly Point2D[]): AffineTransform | null {
  if (source.length < 3 || source.length !== target.length) {
    return null;
  }

  const center = source.reduce(
    (total, point) => ({ x: total.x + point.x / source.length, y: total.y + point.y / source.length }),
    { x: 0, y: 0 },
  );
  const scale = Math.sqrt(
    source.reduce((total, point) => total + distanceSquared(point, center), 0) / source.length,
  );

  if (scale < EPSILON) {
    return null;
  }

  const normalMatrix: Matrix3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const targetX: Vector3 = [0, 0, 0];
  const targetY: Vector3 = [0, 0, 0];

  for (let index = 0; index < source.length; index += 1) {
    const normalizedX = (source[index].x - center.x) / scale;
    const normalizedY = (source[index].y - center.y) / scale;
    const row: Vector3 = [normalizedX, normalizedY, 1];

    for (let matrixRow = 0; matrixRow < 3; matrixRow += 1) {
      targetX[matrixRow] += row[matrixRow] * target[index].x;
      targetY[matrixRow] += row[matrixRow] * target[index].y;

      for (let matrixColumn = 0; matrixColumn < 3; matrixColumn += 1) {
        normalMatrix[matrixRow][matrixColumn] += row[matrixRow] * row[matrixColumn];
      }
    }
  }

  const coefficientsX = solveMatrix3(normalMatrix, targetX);
  const coefficientsY = solveMatrix3(normalMatrix, targetY);

  if (!coefficientsX || !coefficientsY) {
    return null;
  }

  return {
    determinant:
      (coefficientsX[0] * coefficientsY[1] - coefficientsX[1] * coefficientsY[0]) /
      (scale * scale),
    apply(point) {
      const normalizedX = (point.x - center.x) / scale;
      const normalizedY = (point.y - center.y) / scale;

      return {
        x: coefficientsX[0] * normalizedX + coefficientsX[1] * normalizedY + coefficientsX[2],
        y: coefficientsY[0] * normalizedX + coefficientsY[1] * normalizedY + coefficientsY[2],
      };
    },
  };
}
