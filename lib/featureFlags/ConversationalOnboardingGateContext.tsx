'use client';

/**
 * Client-side conversational-onboarding gate. Fetches the public flag
 * value once on mount + exposes `useConversationalOnboardingEnabled()`
 * to any descendant.
 *
 * Mount `<ConversationalOnboardingGateProvider>` in the `/onboarding`
 * layout so the toggle + the chat surface can render conditionally.
 * The provider starts with `enabled: false` and updates after the
 * public API resolves — same posture as `BasiqGateContext`, so the
 * toggle never flashes visible-then-hidden when the flag is OFF.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface ConversationalOnboardingGateValue {
  enabled: boolean;
  loading: boolean;
}

const ConversationalOnboardingGateContext = createContext<ConversationalOnboardingGateValue>({
  enabled: false,
  loading: true,
});

export function ConversationalOnboardingGateProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<ConversationalOnboardingGateValue>({
    enabled: false,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/feature-flags/conversational-onboarding', {
          cache: 'no-store',
        });
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

  return (
    <ConversationalOnboardingGateContext.Provider value={value}>
      {children}
    </ConversationalOnboardingGateContext.Provider>
  );
}

export function useConversationalOnboardingEnabled(): boolean {
  const { enabled } = useContext(ConversationalOnboardingGateContext);
  return enabled;
}

export function useConversationalOnboardingGate(): ConversationalOnboardingGateValue {
  return useContext(ConversationalOnboardingGateContext);
}
