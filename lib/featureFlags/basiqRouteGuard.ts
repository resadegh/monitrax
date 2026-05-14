/**
 * Server-side route guard helper for `/api/basiq/*` endpoints.
 *
 * Defense-in-depth: even though every UI affordance that triggers a
 * Basiq API call is gated client-side via `useBasiqEnabled()`, the
 * server must also refuse if someone hits the route directly (curl,
 * old browser tab, stale bookmark, a hostile probe). This helper
 * makes the server-side guard a single line at the top of each
 * Basiq route handler.
 *
 * Usage:
 *   ```ts
 *   import { basiqRouteGuard } from '@/lib/featureFlags/basiqRouteGuard';
 *
 *   export async function POST(request: Request) {
 *     const blocked = await basiqRouteGuard();
 *     if (blocked) return blocked;
 *     // … normal handler body …
 *   }
 *   ```
 *
 * Returns:
 *   - `null` when Basiq is enabled (handler proceeds normally)
 *   - A 503 `NextResponse` with `BASIQ_DISABLED` code when off
 */

import { NextResponse } from 'next/server';
import { isBasiqEnabled } from './basiqGate';

export async function basiqRouteGuard(): Promise<NextResponse | null> {
  const enabled = await isBasiqEnabled();
  if (enabled) return null;
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'BASIQ_DISABLED',
        message:
          'Bank connections are not currently available. The Basiq integration is disabled at the platform level.',
      },
    },
    { status: 503 },
  );
}
