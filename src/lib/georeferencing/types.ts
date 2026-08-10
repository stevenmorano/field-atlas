export type ImagePoint = Readonly<{
  x: number;
  y: number;
}>;

export type GeographicPoint = Readonly<{
  longitude: number;
  latitude: number;
}>;

export type WorldPoint = Readonly<{
  x: number;
  y: number;
}>;

export type AnchorPair = Readonly<{
  id: string;
  image: ImagePoint;
  geographic: GeographicPoint;
}>;

export type TransformMode = "unavailable" | "similarity" | "affine" | "triangulated";

export type EstimateConfidence = "none" | "low" | "medium" | "high";

export type TransformEstimate<TPoint> = Readonly<{
  point: TPoint;
  mode: Exclude<TransformMode, "unavailable">;
  confidence: Exclude<EstimateConfidence, "none">;
  insideAnchoredRegion: boolean;
  triangleIndex: number | null;
}>;

export type QualityWarningCode =
  | "insufficient-anchors"
  | "duplicate-image-point"
  | "duplicate-world-point"
  | "degenerate-triangle"
  | "folded-triangle"
  | "no-stable-transform";

export type QualityWarning = Readonly<{
  code: QualityWarningCode;
  message: string;
  anchorIds: readonly string[];
}>;

export type TransformQuality = Readonly<{
  anchorCount: number;
  mode: TransformMode;
  triangleCount: number;
  reliableTriangleCount: number;
  foldedTriangleCount: number;
  degenerateTriangleCount: number;
  isGpsReady: boolean;
  warnings: readonly QualityWarning[];
}>;

export type GeoreferenceModel = Readonly<{
  anchors: readonly AnchorPair[];
  mode: TransformMode;
  quality: TransformQuality;
  imageCoverageHull: readonly ImagePoint[];
  projectImagePoint: (point: ImagePoint) => TransformEstimate<GeographicPoint> | null;
  projectGeographicPoint: (point: GeographicPoint) => TransformEstimate<ImagePoint> | null;
}>;
