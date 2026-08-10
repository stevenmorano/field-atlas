import type {
  GeoreferenceModel,
  GeographicPoint,
  ImagePoint,
  TransformEstimate,
} from "@/lib/georeferencing/types";

const METERS_PER_DEGREE_LATITUDE = 111_320;
const MIN_LONGITUDE_SCALE = 0.01;

export type GpsReading = Readonly<{
  longitude: number;
  latitude: number;
  accuracy: number;
  timestamp: number;
}>;

export type ImageAccuracyRadius = Readonly<{
  x: number;
  y: number;
}>;

export type ProjectedGpsReading = Readonly<{
  reading: GpsReading;
  estimate: TransformEstimate<ImagePoint>;
  isOnImage: boolean;
  accuracyRadius: ImageAccuracyRadius | null;
}>;

function projectOffset(
  model: GeoreferenceModel,
  point: GeographicPoint,
  latitudeOffset: number,
  longitudeOffset: number,
) {
  return model.projectGeographicPoint({
    latitude: point.latitude + latitudeOffset,
    longitude: point.longitude + longitudeOffset,
  })?.point ?? null;
}

function calculateAccuracyRadius(
  model: GeoreferenceModel,
  point: GeographicPoint,
  center: ImagePoint,
  accuracy: number,
): ImageAccuracyRadius | null {
  if (!Number.isFinite(accuracy) || accuracy <= 0) {
    return null;
  }

  const latitudeOffset = accuracy / METERS_PER_DEGREE_LATITUDE;
  const longitudeScale = Math.max(
    Math.abs(Math.cos((point.latitude * Math.PI) / 180)),
    MIN_LONGITUDE_SCALE,
  );
  const longitudeOffset = accuracy / (METERS_PER_DEGREE_LATITUDE * longitudeScale);
  const edgePoints = [
    projectOffset(model, point, latitudeOffset, 0),
    projectOffset(model, point, -latitudeOffset, 0),
    projectOffset(model, point, 0, longitudeOffset),
    projectOffset(model, point, 0, -longitudeOffset),
  ].filter((candidate): candidate is ImagePoint => candidate !== null);

  if (edgePoints.length === 0) {
    return null;
  }

  return edgePoints.reduce<ImageAccuracyRadius>(
    (radius, edge) => ({
      x: Math.max(radius.x, Math.abs(edge.x - center.x)),
      y: Math.max(radius.y, Math.abs(edge.y - center.y)),
    }),
    { x: 0, y: 0 },
  );
}

export function projectGpsReading(
  model: GeoreferenceModel,
  imageDimensions: Readonly<{ width: number; height: number }>,
  reading: GpsReading,
): ProjectedGpsReading | null {
  const geographicPoint = {
    longitude: reading.longitude,
    latitude: reading.latitude,
  };
  const estimate = model.projectGeographicPoint(geographicPoint);

  if (!estimate) {
    return null;
  }

  return {
    reading,
    estimate,
    isOnImage:
      estimate.point.x >= 0 &&
      estimate.point.x <= imageDimensions.width &&
      estimate.point.y >= 0 &&
      estimate.point.y <= imageDimensions.height,
    accuracyRadius: calculateAccuracyRadius(
      model,
      geographicPoint,
      estimate.point,
      reading.accuracy,
    ),
  };
}

