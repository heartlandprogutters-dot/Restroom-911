import type { LatLng } from './types';

const EARTH_METERS = 6_371_000;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(meters: number): string {
  const miles = meters / 1609.344;
  if (miles < 0.1) {
    const feet = Math.max(50, Math.round((meters * 3.28084) / 10) * 10);
    return `${feet} ft`;
  }
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

export function approximateDistancePhrase(meters: number): string {
  const miles = meters / 1609.344;
  if (miles < 0.1) {
    const feet = Math.max(50, Math.round((meters * 3.28084) / 10) * 10);
    return `About ${feet} feet away (approximate distance)`;
  }
  const shown = miles < 10 ? miles.toFixed(1) : String(Math.round(miles));
  return `About ${shown} miles away (approximate distance)`;
}
