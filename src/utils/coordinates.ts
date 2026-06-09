import type { RouteWaypoint } from '../services/routeService';

/** [longitude, latitude] */
export type LngLat = [number, number];

/** [latitude, longitude] */
export type LatLng = [number, number];

export function haversineKm(a: LngLat, b: LngLat): number {
  const R = 6371;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      sinDLng *
      sinDLng;

  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function haversineLatLngKm(a: LatLng, b: LatLng): number {
  return haversineKm(latLngToLngLat(a), latLngToLngLat(b));
}

export function lngLatToLatLng([lng, lat]: LngLat): LatLng {
  return [lat, lng];
}

export function latLngToLngLat([lat, lng]: LatLng): LngLat {
  return [lng, lat];
}

export function waypointToLngLat(wp: RouteWaypoint): LngLat {
  return latLngToLngLat(wp.location);
}

/** True when start and end are within ~50m (loop / exploration routes). */
export function isLoopRoute(start: LngLat, end: LngLat, thresholdKm = 0.05): boolean {
  return haversineKm(start, end) < thresholdKm;
}
