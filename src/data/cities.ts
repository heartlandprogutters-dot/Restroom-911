import type { LatLng } from '../domain/types';

export interface PilotCity {
  id: string;
  name: string;
  region: string;
  timeZone: 'America/Chicago';
  /** Public city-center coordinate used only as a demo search origin. */
  center: LatLng;
}

export const PILOT_CITIES: readonly PilotCity[] = [
  {
    id: 'mayfield',
    name: 'Mayfield',
    region: 'Kentucky',
    timeZone: 'America/Chicago',
    center: { lat: 36.7417, lng: -88.6367 },
  },
  {
    id: 'paducah',
    name: 'Paducah',
    region: 'Kentucky',
    timeZone: 'America/Chicago',
    center: { lat: 37.0834, lng: -88.6 },
  },
  {
    id: 'benton',
    name: 'Benton',
    region: 'Kentucky',
    timeZone: 'America/Chicago',
    center: { lat: 36.8578, lng: -88.3503 },
  },
  {
    id: 'murray',
    name: 'Murray',
    region: 'Kentucky',
    timeZone: 'America/Chicago',
    center: { lat: 36.6103, lng: -88.3148 },
  },
  {
    id: 'grand-rivers',
    name: 'Grand Rivers',
    region: 'Kentucky',
    timeZone: 'America/Chicago',
    center: { lat: 37.002, lng: -88.232 },
  },
];

export const PILOT_CITY_IDS = PILOT_CITIES.map((city) => city.id);

export function cityById(id: string | null | undefined): PilotCity | undefined {
  return PILOT_CITIES.find((city) => city.id === id);
}

/** Demo mode matches pilot-city text only. It does not geocode street addresses. */
export function matchPilotCity(query: string): PilotCity | null {
  const normalized = query.trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');
  if (normalized.length < 3) return null;
  const hits = PILOT_CITIES.filter((city) => normalized.includes(city.name.toLowerCase()));
  return hits.length === 1 ? hits[0] : null;
}
