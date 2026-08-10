import type { GeographicPoint, WorldPoint } from "@/lib/georeferencing/types";

const EARTH_RADIUS_METERS = 6_378_137;
const MAX_MERCATOR_LATITUDE = 85.05112878;

function degreesToRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function radiansToDegrees(radians: number) {
  return (radians * 180) / Math.PI;
}

export function geographicToWorld(point: GeographicPoint): WorldPoint {
  const latitude = Math.min(MAX_MERCATOR_LATITUDE, Math.max(-MAX_MERCATOR_LATITUDE, point.latitude));
  const longitudeRadians = degreesToRadians(point.longitude);
  const latitudeRadians = degreesToRadians(latitude);

  return {
    x: EARTH_RADIUS_METERS * longitudeRadians,
    y: EARTH_RADIUS_METERS * Math.log(Math.tan(Math.PI / 4 + latitudeRadians / 2)),
  };
}

export function worldToGeographic(point: WorldPoint): GeographicPoint {
  return {
    longitude: radiansToDegrees(point.x / EARTH_RADIUS_METERS),
    latitude: radiansToDegrees(2 * Math.atan(Math.exp(point.y / EARTH_RADIUS_METERS)) - Math.PI / 2),
  };
}
