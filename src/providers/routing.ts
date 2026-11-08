import type { AppEnv } from '../config/env';
import { type TravelFact } from '../domain/ranking';
import type { LatLng } from '../domain/types';

export interface RoutingEstimate {
  byId: Record<string, TravelFact>;
  fallbackReason: string | null;
}

export interface RoutingProvider {
  id: 'straight-line' | 'osrm';
  label: string;
  /** Host that would receive coordinates, or null when nothing is sent. */
  endpoint: string | null;
  estimate(origin: LatLng, points: { id: string; location: LatLng }[]): Promise<RoutingEstimate>;
}

export function createRoutingProvider(env: AppEnv): RoutingProvider {
  if (env.routing === 'osrm' && env.osrmBase) {
    return {
      id: 'osrm',
      label: 'Configured OSRM routing',
      endpoint: env.osrmBase,
      estimate: (origin, points) => osrmEstimate(env.osrmBase, origin, points),
    };
  }
  return {
    id: 'straight-line',
    label: 'Straight-line distance only',
    endpoint: null,
    async estimate() {
      return { byId: {}, fallbackReason: null };
    },
  };
}

async function osrmEstimate(
  base: string,
  origin: LatLng,
  points: { id: string; location: LatLng }[],
): Promise<RoutingEstimate> {
  const coords = [origin, ...points.map((point) => point.location)]
    .map((point) => `${point.lng},${point.lat}`)
    .join(';');
  const url = `${base}/table/v1/foot/${coords}?sources=0&annotations=duration,distance`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Routing server error');
    const body = (await response.json()) as {
      durations?: (number | null)[][];
      distances?: (number | null)[][];
    };
    const durations = body.durations?.[0] ?? [];
    const distances = body.distances?.[0] ?? [];
    const byId: Record<string, TravelFact> = {};
    points.forEach((point, index) => {
      const distance = distances[index + 1];
      const duration = durations[index + 1];
      if (typeof distance !== 'number' || !Number.isFinite(distance)) return;
      byId[point.id] = {
        distanceMeters: distance,
        travelTimeMinutes: typeof duration === 'number' && Number.isFinite(duration) ? duration / 60 : null,
        method: 'routed',
      };
    });
    return { byId, fallbackReason: null };
  } catch {
    return {
      byId: {},
      fallbackReason:
        'The routing server did not respond. Distances stay straight-line approximations, and no travel time is shown.',
    };
  }
}
