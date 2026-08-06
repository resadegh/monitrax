/**
 * Module Gate — server-side "is this module enabled?" reader for the
 * PROD-Simplification module keys (PROD_SIMPLIFICATION_PLAN.md §4.1).
 *
 * Generalises the Basiq gate's cached fail-closed reader to ANY
 * `GlobalFeatureFlag` key via a keyed Map cache (30s TTL). ONE
 * implementation (§12.2.1): `lib/featureFlags/basiqGate.ts` now
 * delegates here, so its 10 existing call sites keep their imports
 * unchanged while the read path is single-sourced.
 *
 * Fail-closed semantics for module keys: flag off, row missing, or DB
 * unreachable ⇒ module HIDDEN — which is the safe v1 ship state by
 * construction (every key seeds `enabled: false`).
 */

import { prisma } from '@/lib/db';
import type { ModuleKey } from './moduleRegistry';

interface CacheEntry {
  enabled: boolean;
  capturedAt: number;
}

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();

/**
 * Generic cached flag read. Fail-closed: any error caches + returns
 * `false` so a DB blip hides gated surfaces rather than exposing them,
 * and we don't hammer Prisma in a loop.
 */
export async function isFlagEnabled(
  key: string,
  options: { skipCache?: boolean } = {},
): Promise<boolean> {
  const hit = cache.get(key);
  if (!options.skipCache && hit && Date.now() - hit.capturedAt < CACHE_TTL_MS) {
    return hit.enabled;
  }

  try {
    const row = await prisma.globalFeatureFlag.findUnique({
      where: { key },
      select: { enabled: true },
    });
    const enabled = row?.enabled === true;
    cache.set(key, { enabled, capturedAt: Date.now() });
    return enabled;
  } catch {
    cache.set(key, { enabled: false, capturedAt: Date.now() });
    return false;
  }
}

/**
 * Server-side module check. Cached for 30s within the process — safe
 * to call many times per request.
 */
export async function isModuleEnabled(
  key: ModuleKey,
  options: { skipCache?: boolean } = {},
): Promise<boolean> {
  return isFlagEnabled(key, options);
}

/**
 * Invalidate the in-process cache for one key, or all keys when no key
 * is given. Called unconditionally from the admin PATCH handler so an
 * operator flip propagates immediately on THIS Vercel instance
 * (warm peers clear within 30s via the TTL).
 */
export function invalidateFlagCache(key?: string): void {
  if (key === undefined) {
    cache.clear();
  } else {
    cache.delete(key);
  }
}
