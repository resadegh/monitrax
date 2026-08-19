/**
 * MON-161 — gated-route responses must be uncacheable (M2 §C;
 * MONITRAX_V1_MASTER_PLAN.md §5).
 *
 * Observed on PROD 2026-08-19: after flipping MODULE_HOUSEKEEPING ON,
 * the route's bare URL kept serving a cached 404 for ~2 minutes while a
 * cache-busted request rendered immediately — request-time gating
 * (MON-160) was sound; the 404 RESPONSE was cached for that URL.
 *
 * The fix lives at ONE chokepoint (middleware.ts, registry-derived —
 * no second route list): every module-gated path gets
 * `Cache-Control: no-store, must-revalidate`, so the flip verdict is
 * re-evaluated on every request at every cache layer.
 *
 * Coverage boundary: exercises the middleware function directly with
 * real NextRequest objects — verifies the header contract, NOT the CDN's
 * obedience to it on a deployment. Re-run of the live flip check
 * (admin panel → flip ON → bare URL renders within ~30s → flip OFF →
 * bare URL 404s) is described in the PR and remains the Ring-3 proof.
 */
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { MODULE_REGISTRY } from '@/lib/featureFlags/moduleRegistry';

const req = (path: string) => new NextRequest(`https://monitrax.test${path}`);

describe('MON-161 — gated routes are no-store at the middleware chokepoint', () => {
  it('every hidden-module routePrefix gets Cache-Control: no-store', () => {
    for (const m of MODULE_REGISTRY.filter((x) => x.behaviour !== 'redirect')) {
      for (const prefix of m.routePrefixes) {
        const concrete = prefix.replace(/\[[^\]]+\]/g, 'abc123'); // [id] → a segment
        const res = middleware(req(concrete));
        expect(res.headers.get('cache-control'), `${m.key} ${concrete}`).toBe(
          'no-store, must-revalidate',
        );
        // …and one level deeper (the guard covers whole trees).
        const deeper = middleware(req(`${concrete}/sub-page`));
        expect(deeper.headers.get('cache-control'), `${m.key} ${concrete}/sub-page`).toBe(
          'no-store, must-revalidate',
        );
      }
    }
  });

  it('MODULE_HOME matches /dashboard exactly (redirect flip), never the kept /dashboard/* routes', () => {
    expect(middleware(req('/dashboard')).headers.get('cache-control')).toBe(
      'no-store, must-revalidate',
    );
    for (const kept of ['/dashboard/properties', '/dashboard/balances', '/dashboard/reports']) {
      expect(middleware(req(kept)).headers.get('cache-control'), kept).toBeNull();
    }
  });

  it('kept routes and unrelated paths are untouched', () => {
    for (const p of ['/', '/help', '/dashboard/properties/xyz', '/api/master-snapshot']) {
      expect(middleware(req(p)).headers.get('cache-control'), p).toBeNull();
    }
  });

  it('prefix matching is segment-safe (no false hit on lookalike kept routes)', () => {
    // '/dashboard/taxonomy' must NOT be treated as '/dashboard/tax'.
    expect(middleware(req('/dashboard/taxonomy')).headers.get('cache-control')).toBeNull();
  });
});
