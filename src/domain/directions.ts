import type { LatLng } from './types';

export interface MapLinks {
  geo: string;
  google: string;
  apple: string;
}

/** External map links. These do not claim a fastest route. */
export function externalMapLinks(location: LatLng, name: string): MapLinks {
  const lat = location.lat.toFixed(6);
  const lng = location.lng.toFixed(6);
  const query = encodeURIComponent(`${lat},${lng}`);
  const label = encodeURIComponent(name);
  return {
    geo: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${query}`,
    apple: `https://maps.apple.com/?daddr=${query}&q=${label}`,
  };
}
