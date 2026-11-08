export interface AppEnv {
  dataSource: 'demo' | 'server';
  /** Empty string means same-origin `/api` (the Vite proxy or the host that serves the app). */
  apiBase: string;
  routing: 'straight-line' | 'osrm';
  osrmBase: string;
}

export function readEnv(): AppEnv {
  const dataSource = import.meta.env.VITE_DATA_SOURCE === 'server' ? 'server' : 'demo';
  const routing = import.meta.env.VITE_ROUTING_PROVIDER === 'osrm' ? 'osrm' : 'straight-line';
  const osrmBase = (import.meta.env.VITE_OSRM_BASE_URL ?? '').replace(/\/$/, '');
  const apiBase = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
  return { dataSource, apiBase, routing, osrmBase };
}
