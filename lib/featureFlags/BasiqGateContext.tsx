'use client';

/**
 * Client-side Basiq gate. Fetches the public flag value once on
 * mount + exposes `useBasiqEnabled()` to any descendant.
 *
 * Mount `<BasiqGateProvider>` at the top of the dashboard layout
 * (consumer side) so every component below it can call
 * `useBasiqEnabled()` to conditionally render Basiq UI.
 *
 * SSR note:
 *   The provider intentionally starts with `enabled: false` and
 *   updates after the public API call resolves. This means:
 *   - SSR + first paint hides Basiq UI (safe default)
 *   - The "Connect bank" button doesn't flash visible-then-hidden
 *     when the flag is OFF (the production case in 2026-05-14)
 *   - When the flag IS on, the button appears after the fetch
 *     resolves (one paint cycle of delay — acceptable)
 *
 * If a future use case needs instant SSR-correct visibility (e.g.
 * the marketing site landing page wants to show "bank-connect
 * enabled" copy), the server-side `isBasiqEnabled()` helper is
 * the right call — pass it into the page as a prop.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface BasiqGateValue {
  enabled: boolean;
  /** True until the initial fetch resolves. UI can show a skeleton
   *  if it cares; most call sites just treat `loading=true` as
   *  `enabled=false` and re-render on resolve. */
  loading: boolean;
}

const BasiqGateContext = createContext<BasiqGateValue>({ enabled: false, loading: true });

export function BasiqGateProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<BasiqGateValue>({ enabled: false, loading: true });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/feature-flags/basiq', { cache: 'no-store' });
        if (!res.ok) {
          if (!cancelled) setValue({ enabled: false, loading: false });
          return;
        }
        const json = (await res.json()) as { enabled?: boolean };
        if (!cancelled) {
          setValue({ enabled: json.enabled === true, loading: false });
        }
      } catch {
        if (!cancelled) setValue({ enabled: false, loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <BasiqGateContext.Provider value={value}>{children}</BasiqGateContext.Provider>;
}

/**
 * Returns `true` when the Basiq integration is enabled and the
 * initial flag fetch has resolved. Treats "still loading" as
 * "hidden" — the common case is `{enabled && <BasiqButton />}` and
 * a button that flickers in once a fetch completes is worse than
 * a button that appears slightly late.
 */
export function useBasiqEnabled(): boolean {
  const { enabled } = useContext(BasiqGateContext);
  return enabled;
}

/**
 * Full context value — useful when a component needs to show a
 * loading skeleton instead of just hiding.
 */
export function useBasiqGate(): BasiqGateValue {
  return useContext(BasiqGateContext);
}
