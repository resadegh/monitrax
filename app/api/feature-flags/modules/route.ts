/**
 * GET /api/feature-flags/modules
 *
 * Public read of every PROD-Simplification module flag in one call —
 * the client-side counterpart of `isModuleEnabled()` (the Basiq
 * public-endpoint pattern, PROD_SIMPLIFICATION_PLAN.md §4.3).
 *
 * Unauthenticated by design: each boolean is "public" in the same way
 * a nav item being visible is public. Only registry module keys are
 * exposed — never the whole flag table.
 *
 * Response: `{ modules: Record<ModuleKey, boolean> }`. Any error or
 * missing row reads as `false` (fail closed = hidden), via the same
 * cached server helper the route guards use.
 */

import { NextResponse } from 'next/server';
import { isModuleEnabled } from '@/lib/featureFlags/moduleGate';
import { MODULE_KEYS, type ModuleKey } from '@/lib/featureFlags/moduleRegistry';

export const dynamic = 'force-dynamic';

export async function GET() {
  const entries = await Promise.all(
    MODULE_KEYS.map(async (key) => [key, await isModuleEnabled(key)] as const),
  );
  const modules = Object.fromEntries(entries) as Record<ModuleKey, boolean>;
  return NextResponse.json({ modules });
}
