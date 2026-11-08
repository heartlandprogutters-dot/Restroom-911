import { Component, useEffect, useRef, type ReactNode } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LatLng } from '../domain/types';

interface MapPoint {
  id: string;
  name: string;
  location: LatLng;
}

interface ResultsMapProps {
  origin: LatLng;
  originLabel: string;
  points: MapPoint[];
}

function LeafletMap({ origin, originLabel, points }: ResultsMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const signature = `${origin.lat}|${origin.lng}|${originLabel}|${points
    .map((point) => `${point.id},${point.location.lat},${point.location.lng}`)
    .join(';')}`;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const map = L.map(element, { scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    const originMarker = L.circleMarker([origin.lat, origin.lng], {
      radius: 8,
      color: '#1d4ed8',
      weight: 2,
      fillOpacity: 0.9,
    }).addTo(map);
    originMarker.bindTooltip(originLabel);
    const bounds = L.latLngBounds([[origin.lat, origin.lng]]);
    points.forEach((point, index) => {
      bounds.extend([point.location.lat, point.location.lng]);
      L.circleMarker([point.location.lat, point.location.lng], {
        radius: index === 0 ? 10 : 7,
        color: '#7f2d12',
        weight: 2,
        fillColor: '#fffdf8',
        fillOpacity: 1,
      })
        .addTo(map)
        .bindTooltip(point.name);
    });
    if (points.length === 0) map.setView([origin.lat, origin.lng], 14);
    else map.fitBounds(bounds.pad(0.25));
    requestAnimationFrame(() => map.invalidateSize());
    return () => {
      map.remove();
    };
  }, [signature, origin.lat, origin.lng, originLabel]);

  return <div ref={ref} className="map" role="img" aria-label="Map of the search spot and sample restrooms" />;
}

class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <p>Map unavailable. The list above still works.</p>;
    }
    return this.props.children;
  }
}

export function ResultsMap(props: ResultsMapProps) {
  const key = `${props.origin.lat},${props.origin.lng}:${props.points.map((point) => point.id).join(',')}`;
  return (
    <MapBoundary>
      <LeafletMap key={key} {...props} />
    </MapBoundary>
  );
}
