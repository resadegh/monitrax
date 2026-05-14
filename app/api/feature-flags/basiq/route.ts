/**
 * GET /api/feature-flags/basiq
 *
 * Public read of the BASIQ_INTEGRATION feature flag. Unauthenticated
 * by design — the value itself isn't sensitive (every consumer of
 * this endpoint immediately renders or hides Basiq UI based on the
 * response, so the boolean is "public" in the same way the Connect-
 * Bank button being visible is public).
 *
 * Why a dedicated endpoint instead of reading the admin
 * `/api/admin/feature-flags/[key]` route from the client:
 *   - The admin route requires admin auth; consumer pages can't call it.
 *   - We don't want the entire flag table exposed to the client.
 *   - A targeted endpoint lets us cache aggressively in the future
 *     (Cloud CDN + short TTL) without touching admin surfaces.
 *
 * Response: `{ enabled: boolean }`. Defaults to `false` on any error
 * (DB unreachable, flag row missing) — fail closed.
 */

import { NextResponse } from 'next/server';
import { isBasiqEnabled } from '@/lib/featureFlags/basiqGate';

export const dynamic = 'force-dynamic';

export async function GET() {
  const enabled = await isBasiqEnabled();
  return NextResponse.json({ enabled });
}
