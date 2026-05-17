/**
 * Conversational Onboarding Gate — single source of truth for "is
 * the chat-mode onboarding surface enabled?"
 *
 * Why this exists:
 *   Phase 12 Track E (per `docs/blueprint/PHASE_12_CONVERSATIONAL_ONBOARDING.md`)
 *   ships a parallel conversational input modality on `/onboarding`
 *   alongside the existing form-based wizard. The mode toggle and
 *   the chat surface stay hidden until this flag flips ON. With the
 *   flag OFF (the default), `/onboarding` is byte-for-byte the
 *   existing form-wizard experience — Track B unchanged.
 *
 * Backed by:
 *   `GlobalFeatureFlag` Prisma model. Key = `CONVERSATIONAL_ONBOARDING`.
 *   Seeded with `enabled: false` by `prisma/seed-feature-flags.ts`;
 *   operator flips via `/admin/feature-flags`.
 *
 * Read paths:
 *   - Server: `isConversationalOnboardingEnabled()`
 *   - Client: `useConversationalOnboardingEnabled()` via the provider
 *     mounted in `/app/onboarding/layout.tsx`
 *   - Public API endpoint: `GET /api/feature-flags/conversational-onboarding`
 *     returns `{ enabled: boolean }` — no auth required, mirrors the
 *     Basiq gate's public-read posture (the boolean isn't sensitive).
 *
 * Default:
 *   `false`. Fails closed when the DB is unreachable or the row is
 *   missing — better to hide a real feature than to expose a missing
 *   one.
 *
 * Caching:
 *   In-memory, 30s TTL, mirrors `basiqGate.ts`. Admin toggle propagates
 *   within ≤30s; instant propagation on the toggling instance via
 *   `invalidateConversationalOnboardingGateCache()` called from the
 *   admin PATCH handler.
 */

import { prisma } from '@/lib/db';

export const CONVERSATIONAL_ONBOARDING_FLAG_KEY = 'CONVERSATIONAL_ONBOARDING';

interface CacheEntry {
  enabled: boolean;
  capturedAt: number;
}

const CACHE_TTL_MS = 30_000;
let cache: CacheEntry | null = null;

export async function isConversationalOnboardingEnabled(
  options: { skipCache?: boolean } = {},
): Promise<boolean> {
  if (!options.skipCache && cache && Date.now() - cache.capturedAt < CACHE_TTL_MS) {
    return cache.enabled;
  }

  try {
    const row = await prisma.globalFeatureFlag.findUnique({
      where: { key: CONVERSATIONAL_ONBOARDING_FLAG_KEY },
      select: { enabled: true },
    });
    const enabled = row?.enabled === true;
    cache = { enabled, capturedAt: Date.now() };
    return enabled;
  } catch {
    cache = { enabled: false, capturedAt: Date.now() };
    return false;
  }
}

export function invalidateConversationalOnboardingGateCache(): void {
  cache = null;
}
