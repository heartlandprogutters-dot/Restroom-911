export type GeoFailure = 'denied' | 'unavailable' | 'timeout';

export interface GeoFix {
  lat: number;
  lng: number;
  accuracyMeters: number | null;
}

export function requestPosition(): Promise<GeoFix> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(Object.assign(new Error('Location is unavailable'), { code: 2 }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyMeters: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        });
      },
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );
  });
}

export function classifyGeoError(error: unknown): GeoFailure {
  const code = typeof error === 'object' && error && 'code' in error ? Number((error as { code: number }).code) : 0;
  if (code === 1) return 'denied';
  if (code === 3) return 'timeout';
  return 'unavailable';
}

export function formatAccuracy(meters: number): string {
  return `${Math.round(meters).toLocaleString('en-US')} meters`;
}
