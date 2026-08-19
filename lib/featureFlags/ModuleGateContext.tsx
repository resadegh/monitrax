'use client';

/**
 * Client-side module gate (PROD_SIMPLIFICATION_PLAN.md §4.3 — the
 * Basiq client-context pattern).
 *
 * Fetches `/api/feature-flags/modules` once on mount and exposes
 * `useModuleEnabled(key)` to any descendant. Mounted in
 * `DashboardLayout` next to `BasiqGateProvider`.
 *
 * SSR note: every module starts `false` (hidden) and lights up after
 * the fetch resolves. This means SSR + first paint never shows a
 * hidden module's nav/affordance — the correct v1 ship state, where
 * all keys are off, renders with zero flicker. When Reza enables a
 * module, its surfaces appear one paint cycle after load (acceptable —
 * same trade the Basiq gate made).
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import type { ModuleKey } from './moduleRegistry';

interface ModuleGateValue {
  modules: Partial<Record<ModuleKey, boolean>>;
  /** True until the initial fetch resolves. */
  loading: boolean;
}

const ModuleGateContext = createContext<ModuleGateValue>({ modules: {}, loading: true });

export function ModuleGateProvider({ children }: { children: ReactNode }) {
  // R0: send the Firebase token when present so the map is the session
  // user's EFFECTIVE map (global ∥ active override) — this is what makes
  // an override holder's nav show the hidden module. Refetches when the
  // token resolves/changes; unauthenticated fetches get the global map.
  const { token, isLoading: authLoading } = useAuth();
  const [value, setValue] = useState<ModuleGateValue>({ modules: {}, loading: true });

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/feature-flags/modules', {
          cache: 'no-store',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) {
          if (!cancelled) setValue({ modules: {}, loading: false });
          return;
        }
        const json = (await res.json()) as { modules?: Partial<Record<ModuleKey, boolean>> };
        if (!cancelled) {
          setValue({ modules: json.modules ?? {}, loading: false });
        }
      } catch {
        if (!cancelled) setValue({ modules: {}, loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, authLoading]);

  return <ModuleGateContext.Provider value={value}>{children}</ModuleGateContext.Provider>;
}

/**
 * True only when the module's flag is confirmed ON. "Still loading"
 * reads as hidden — surfaces appear when confirmed, never flash away.
 */
export function useModuleEnabled(key: ModuleKey): boolean {
  const { modules } = useContext(ModuleGateContext);
  return modules[key] === true;
}

/** Full map — for components that filter lists (nav) in one pass. */
export function useEnabledModules(): Partial<Record<ModuleKey, boolean>> {
  return useContext(ModuleGateContext).modules;
}
