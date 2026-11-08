import type { AccessibilityPreferences, RankMode } from '../domain/types';

const KEY = 'rr911.activeSearch';

export interface ActiveSearch {
  origin: {
    kind: 'geolocation' | 'demo-city' | 'manual-city';
    lat: number;
    lng: number;
    accuracyMeters: number | null;
    cityId: string | null;
    label: string;
  };
  mode: RankMode;
  preferences: AccessibilityPreferences;
  startedAt: string;
}

/** Replaces the single active search. This is not a location history. */
export function saveSearch(search: ActiveSearch): void {
  sessionStorage.setItem(KEY, JSON.stringify(search));
}

export function loadSearch(): ActiveSearch | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveSearch;
    if (!parsed?.origin || typeof parsed.origin.lat !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSearch(): void {
  sessionStorage.removeItem(KEY);
}
