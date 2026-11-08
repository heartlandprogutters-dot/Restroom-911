import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { readEnv, type AppEnv } from '../config/env';
import { SEED_PACKAGED_ON } from '../data/seed';
import { PREFERENCES_OFF, type AccessibilityPreferences, type PreferenceLevel, type TesterPlan } from '../domain/types';
import { createApiProvider } from '../providers/apiProvider';
import { createDemoProvider } from '../providers/demoProvider';
import { createRoutingProvider, type RoutingProvider } from '../providers/routing';
import type { RestroomDataProvider } from '../providers/types';
import { createBrowserStore } from '../storage/browserStore';
import type { KeyValueStore } from '../storage/types';

interface AppContextValue {
  env: AppEnv;
  provider: RestroomDataProvider;
  routing: RoutingProvider;
  mode: 'demo' | 'server';
  setMode: (mode: 'demo' | 'server') => void;
  plan: TesterPlan;
  setPlan: (plan: TesterPlan) => void;
  preferences: AccessibilityPreferences;
  setPreference: (key: keyof AccessibilityPreferences, level: PreferenceLevel) => void;
  demoAdmin: boolean;
  setDemoAdmin: (on: boolean) => void;
  online: boolean;
  packagedOn: string;
}

const AppContext = createContext<AppContextValue | null>(null);

function readPlan(): TesterPlan {
  try {
    const saved = localStorage.getItem('rr911.plan');
    if (saved === 'free' || saved === 'paid-simulated') return saved;
  } catch {
    /* private mode */
  }
  return 'paid-simulated';
}

function readPreferences(): AccessibilityPreferences {
  try {
    const raw = localStorage.getItem('rr911.preferences');
    if (!raw) return PREFERENCES_OFF;
    const parsed = JSON.parse(raw) as Partial<AccessibilityPreferences>;
    const level = (value: unknown): PreferenceLevel =>
      value === 'required' || value === 'preferred' ? value : 'off';
    return {
      wheelchair: level(parsed.wheelchair),
      singleUser: level(parsed.singleUser),
      changingTable: level(parsed.changingTable),
      genderNeutral: level(parsed.genderNeutral),
    };
  } catch {
    return PREFERENCES_OFF;
  }
}

function readMode(fallback: 'demo' | 'server'): 'demo' | 'server' {
  try {
    const saved = sessionStorage.getItem('rr911.dataMode');
    if (saved === 'demo' || saved === 'server') return saved;
  } catch {
    /* ignore */
  }
  return fallback;
}

function readDemoAdmin(): boolean {
  try {
    return sessionStorage.getItem('rr911.demoAdmin') === '1';
  } catch {
    return false;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const env = useMemo(() => readEnv(), []);
  const store = useMemo<KeyValueStore>(() => createBrowserStore(), []);
  const routing = useMemo(() => createRoutingProvider(env), [env]);
  const [mode, setModeState] = useState<'demo' | 'server'>(() => readMode(env.dataSource));
  const [plan, setPlanState] = useState<TesterPlan>(readPlan);
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(readPreferences);
  const [demoAdmin, setDemoAdminState] = useState(readDemoAdmin);
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const provider = useMemo<RestroomDataProvider>(() => {
    if (mode === 'server') return createApiProvider(env.apiBase);
    return createDemoProvider(store, {
      isAdmin: () => {
        try {
          return sessionStorage.getItem('rr911.demoAdmin') === '1';
        } catch {
          return false;
        }
      },
    });
  }, [mode, env.apiBase, store]);

  const value = useMemo<AppContextValue>(
    () => ({
      env,
      provider,
      routing,
      mode,
      setMode: (next) => {
        setModeState(next);
        try {
          sessionStorage.setItem('rr911.dataMode', next);
        } catch {
          /* ignore */
        }
      },
      plan,
      setPlan: (next) => {
        setPlanState(next);
        try {
          localStorage.setItem('rr911.plan', next);
        } catch {
          /* ignore */
        }
      },
      preferences,
      setPreference: (key, level) => {
        setPreferences((current) => {
          const next = { ...current, [key]: level };
          try {
            localStorage.setItem('rr911.preferences', JSON.stringify(next));
          } catch {
            /* ignore */
          }
          return next;
        });
      },
      demoAdmin,
      setDemoAdmin: (on) => {
        try {
          if (on) sessionStorage.setItem('rr911.demoAdmin', '1');
          else sessionStorage.removeItem('rr911.demoAdmin');
        } catch {
          /* ignore */
        }
        setDemoAdminState(on);
      },
      online,
      packagedOn: SEED_PACKAGED_ON,
    }),
    [env, provider, routing, mode, plan, preferences, demoAdmin, online],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}
