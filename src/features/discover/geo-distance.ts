import type { GeographicPoint } from "@/lib/georeferencing/types";

const EARTH_RADIUS_METERS = 6_371_008.8;

function radians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function distanceBetweenMeters(first: GeographicPoint, second: GeographicPoint) {
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const firstLatitude = radians(first.latitude);
  const secondLatitude = radians(second.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
}

export function formatDistance(meters: number) {
  const miles = meters / 1_609.344;

  if (miles < 0.1) {
    return "here";
  }

  if (miles < 10) {
    return `${miles.toFixed(1)} mi`;
  }

  return `${Math.round(miles)} mi`;
}
