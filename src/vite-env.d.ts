/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE?: string;
  readonly VITE_ROUTING_PROVIDER?: string;
  readonly VITE_OSRM_BASE_URL?: string;
  readonly VITE_API_BASE?: string;
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
