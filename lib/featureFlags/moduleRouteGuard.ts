/**
 * Server-side guards for hidden-module routes and APIs
 * (PROD_SIMPLIFICATION_PLAN.md §4.4 — "server enforcement is the real
 * control"; nav-only hiding is a compliance hazard).
 *
 * Two guards:
 *   - `moduleRouteGuard(key)` — call at the top of a hidden module's
 *     `layout.tsx` (server component). Renders `notFound()` when the
 *     module is off. MODULE_HOME never uses this — its root page
 *     redirects to /dashboard/properties instead (registry
 *     `behaviour: 'redirect'`).
 *   - `moduleApiGuard(key)` — call at the top of each gated API route
 *     handler (P1.2-audited prefixes only). Returns a 503 NextResponse
 *     when the module is off, `null` when the handler should proceed —
 *     same contract as `basiqRouteGuard`.
 *
 * `middleware.ts` explicitly CANNOT host these checks: it runs on the
 * Edge runtime with no Prisma (CLAUDE.md §13.6), so enforcement lives
 * in layouts + route handlers.
 */

import { notFound } from 'next/navigation';
import { NextResponse } from 'next/server';
import { isModuleEnabled } from './moduleGate';
import type { ModuleKey } from './moduleRegistry';

/** Layout-level guard: 404 the whole subtree when the module is hidden. */
export async function moduleRouteGuard(key: ModuleKey): Promise<void> {
  const enabled = await isModuleEnabled(key);
  if (!enabled) {
    notFound();
  }
}

/** API-level guard: 503 with a stable code when the module is hidden. */
export async function moduleApiGuard(key: ModuleKey): Promise<NextResponse | null> {
  const enabled = await isModuleEnabled(key);
  if (enabled) return null;
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'MODULE_DISABLED',
        message: 'This part of Monitrax is not currently available.',
        details: { module: key },
      },
    },
    { status: 503 },
  );
}
