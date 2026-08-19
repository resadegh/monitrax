'use client';

/**
 * ModuleOverrideGate — the client half of `ModuleGateBoundary` during
 * an R0 override window (global flag OFF, ≥1 active per-user override).
 *
 * Fetches the session user's EFFECTIVE module map (global ∥ override)
 * from `/api/feature-flags/modules` with the Firebase Bearer token and:
 *   - override holder → renders the module
 *   - everyone else   → `notFound()` (the app's not-found page), or a
 *     client redirect when `fallbackHref` is set (MODULE_HOME — the
 *     root must never 404, D-4)
 *   - while resolving → renders nothing (no flash of a hidden module)
 *
 * Fail-closed: fetch error, missing token, or an absent key all read
 * as "not enabled for this user".
 */

import { useEffect, useState } from 'react';
import { notFound, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import type { ModuleKey } from '@/lib/featureFlags/moduleRegistry';

export function ModuleOverrideGate({
  moduleKey,
  fallbackHref,
  children,
}: {
  moduleKey: ModuleKey;
  fallbackHref?: string;
  children: React.ReactNode;
}) {
  const { token, isLoading } = useAuth();
  const router = useRouter();
  const [verdict, setVerdict] = useState<'pending' | 'enabled' | 'disabled'>('pending');

  useEffect(() => {
    if (isLoading) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/feature-flags/modules', {
          cache: 'no-store',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) {
          if (!cancelled) setVerdict('disabled');
          return;
        }
        const json = (await res.json()) as { modules?: Partial<Record<ModuleKey, boolean>> };
        if (!cancelled) {
          setVerdict(json.modules?.[moduleKey] === true ? 'enabled' : 'disabled');
        }
      } catch {
        if (!cancelled) setVerdict('disabled');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, isLoading, moduleKey]);

  useEffect(() => {
    if (verdict === 'disabled' && fallbackHref) {
      router.replace(fallbackHref);
    }
  }, [verdict, fallbackHref, router]);

  if (verdict === 'pending') return null;
  if (verdict === 'disabled') {
    if (fallbackHref) return null; // redirect in flight
    notFound();
  }
  return <>{children}</>;
}
