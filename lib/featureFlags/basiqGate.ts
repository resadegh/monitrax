/**
 * Basiq Gate — single source of truth for "is Basiq enabled?"
 *
 * Why this exists:
 *   Reza directive 2026-05-14: while Basiq accreditation is in flight,
 *   every Basiq-related UI affordance must be hidden (not deleted) so
 *   users don't see Connect-Bank buttons that lead nowhere. When the
 *   accreditation lands, a single Admin Portal toggle flips and the
 *   surfaces light up — no deploy required.
 *
 * Backed by:
 *   `GlobalFeatureFlag` Prisma model (Phase 33 admin feature-flag
 *   infrastructure already shipped). Key = `BASIQ_INTEGRATION`.
 *
 * Read paths:
 *   - Server (route handlers, RSC, services): `isBasiqEnabled()`
 *   - Client (`'use client'` components): `useBasiqEnabled()` via
 *     `BasiqGateProvider` mounted in the dashboard layout
 *   - Public API endpoint: `GET /api/feature-flags/basiq` returns
 *     `{ enabled: boolean }` — no auth required because the flag
 *     value itself isn't sensitive (everyone sees the consequence
 *     immediately via the rendered UI)
 *
 * Default:
 *   `false`. If the flag row doesn't exist in the DB (e.g. fresh
 *   migration before the seed has run), the helper falls back to
 *   `false`. Better to hide a real feature than to expose a missing
 *   one.
 *
 * Caching:
 *   The server helper uses an in-memory cache with a 30-second TTL.
 *   The admin toggle propagates within at most 30s — fine for a
 *   manual operator action. If a future use case needs instant
 *   propagation, pass `{ skipCache: true }` to read fresh from DB.
 */

import { isFlagEnabled, invalidateFlagCache } from './moduleGate';

export const BASIQ_FLAG_KEY = 'BASIQ_INTEGRATION';

/**
 * Server-side check. Cached for 30s within the process. Safe to call
 * many times per request — the cache makes repeat hits free.
 *
 * PROD Simplification P1 (2026-08-04): the cached fail-closed read now
 * lives in `moduleGate.ts` (keyed Map — ONE implementation for Basiq +
 * all module keys, §12.2.1). This alias is preserved so the 10 existing
 * call sites don't churn.
 */
export async function isBasiqEnabled(options: { skipCache?: boolean } = {}): Promise<boolean> {
  return isFlagEnabled(BASIQ_FLAG_KEY, options);
}

/**
 * Invalidate the in-process cache. Call from the admin toggle handler
 * so an operator flipping the flag sees the change immediately on
 * THIS Vercel function instance. Other warm instances clear within
 * 30s via the TTL.
 */
export function invalidateBasiqGateCache(): void {
  invalidateFlagCache(BASIQ_FLAG_KEY);
}
