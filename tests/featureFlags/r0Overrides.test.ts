/**
 * R0 — per-user override wiring tests (plan §5 R0; BRIEF_SIMP_P2R_R0 §C.5).
 *
 * Verifies the user-aware reader's precedence + expiry + caching +
 * invalidation semantics, and source-scans the enforcement wiring
 * (every gated layout renders through ModuleGateBoundary; the
 * effective-map endpoint overlays auth; the admin CRUD invalidates).
 *
 * Coverage boundary: no schema change is verified because none exists
 * (the FeatureFlagOverride table pre-dates R0). Does NOT verify the
 * rendered override window end-to-end on a deployment — that is the
 * R0 acceptance run (MODULE_TAX override on PROD, captured on the PR).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const { findUnique, overrideFindFirst } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  overrideFindFirst: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    globalFeatureFlag: { findUnique },
    featureFlagOverride: { findFirst: overrideFindFirst },
  },
  default: {
    globalFeatureFlag: { findUnique },
    featureFlagOverride: { findFirst: overrideFindFirst },
  },
}));

import {
  isModuleEnabledForUser,
  moduleHasActiveOverride,
  invalidateFlagCache,
} from '@/lib/featureFlags/moduleGate';

beforeEach(() => {
  findUnique.mockReset();
  overrideFindFirst.mockReset();
  invalidateFlagCache();
});

describe('isModuleEnabledForUser — R0 precedence', () => {
  it('global ON ⇒ enabled for every user, override never consulted', async () => {
    findUnique.mockResolvedValue({ enabled: true });
    await expect(isModuleEnabledForUser('MODULE_TAX', 'anyone')).resolves.toBe(true);
    expect(overrideFindFirst).not.toHaveBeenCalled();
  });

  it('global OFF + active override ⇒ enabled for THAT user, hidden for others', async () => {
    findUnique.mockResolvedValue({ enabled: false });
    overrideFindFirst.mockImplementation(async ({ where }: { where: { targetId?: string } }) =>
      where.targetId === 'user-reza' ? { id: 'ov-1' } : null,
    );
    await expect(isModuleEnabledForUser('MODULE_TAX', 'user-reza')).resolves.toBe(true);
    await expect(isModuleEnabledForUser('MODULE_TAX', 'user-other')).resolves.toBe(false);
  });

  it('the override query itself excludes disabled and expired rows (WHERE contract)', async () => {
    findUnique.mockResolvedValue({ enabled: false });
    overrideFindFirst.mockResolvedValue(null);
    await isModuleEnabledForUser('MODULE_TAX', 'user-reza');
    const where = overrideFindFirst.mock.calls[0][0].where;
    expect(where.enabled).toBe(true);
    expect(where.targetType).toBe('USER');
    expect(where.flag).toEqual({ key: 'MODULE_TAX' });
    // active = never-expiring OR expiring in the future
    expect(where.OR).toEqual([
      { expiresAt: null },
      { expiresAt: { gt: expect.any(Date) } },
    ]);
  });

  it('fails closed on DB error (no override assumed)', async () => {
    findUnique.mockResolvedValue({ enabled: false });
    overrideFindFirst.mockRejectedValueOnce(new Error('down'));
    await expect(isModuleEnabledForUser('MODULE_TAX', 'user-reza')).resolves.toBe(false);
  });

  it('caches per (key, user) and invalidateFlagCache(key) clears the derived entries', async () => {
    findUnique.mockResolvedValue({ enabled: false });
    overrideFindFirst.mockResolvedValue({ id: 'ov-1' });
    await isModuleEnabledForUser('MODULE_TAX', 'user-reza');
    await isModuleEnabledForUser('MODULE_TAX', 'user-reza');
    expect(overrideFindFirst).toHaveBeenCalledTimes(1); // second read cached

    invalidateFlagCache('MODULE_TAX'); // the override CRUD calls this
    overrideFindFirst.mockResolvedValue(null); // override removed
    await expect(isModuleEnabledForUser('MODULE_TAX', 'user-reza')).resolves.toBe(false);
    expect(overrideFindFirst).toHaveBeenCalledTimes(2); // re-read after invalidation
  });
});

describe('moduleHasActiveOverride (the layout override-window check)', () => {
  it('true when ANY user holds an active override; cached per key', async () => {
    overrideFindFirst.mockResolvedValue({ id: 'ov-1' });
    await expect(moduleHasActiveOverride('MODULE_TAX')).resolves.toBe(true);
    await moduleHasActiveOverride('MODULE_TAX');
    expect(overrideFindFirst).toHaveBeenCalledTimes(1);
  });

  it('false + fail-closed on DB error', async () => {
    overrideFindFirst.mockRejectedValueOnce(new Error('down'));
    await expect(moduleHasActiveOverride('MODULE_CFO')).resolves.toBe(false);
  });
});

describe('R0 wiring — source-scan locks', () => {
  const read = (p: string) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8');

  it('every module-gated layout renders through ModuleGateBoundary', () => {
    const layouts = [
      'app/dashboard/household-profile/layout.tsx',
      'app/(dashboard)/cashflow/layout.tsx',
      'app/dashboard/plan/layout.tsx',
      'app/dashboard/budget-analysis/layout.tsx',
      'app/dashboard/income/layout.tsx',
      'app/dashboard/expenses/layout.tsx',
      'app/dashboard/debt-planner/layout.tsx',
      'app/dashboard/safety-net/layout.tsx',
      'app/dashboard/entities/layout.tsx',
      'app/dashboard/investments/layout.tsx',
      'app/dashboard/tax/layout.tsx',
      'app/dashboard/cfo/layout.tsx',
      'app/(dashboard)/strategy/layout.tsx',
      'app/dashboard/properties/[id]/strategy/layout.tsx',
      'app/dashboard/loans/[id]/strategy/layout.tsx',
      'app/dashboard/housekeeping/layout.tsx',
      'app/dashboard/conversations/layout.tsx',
      'app/dashboard/requests/layout.tsx',
      'app/dashboard/labs/layout.tsx',
      'app/marketplace/layout.tsx',
      'app/portal/layout.tsx',
    ];
    for (const layout of layouts) {
      const src = read(layout);
      expect(src, layout).toContain('ModuleGateBoundary');
      expect(src, layout).toMatch(/moduleKey="MODULE_[A-Z_]+"/);
    }
  });

  it('the effective-map endpoint overlays auth (optional Bearer → per-user map)', () => {
    const src = read('app/api/feature-flags/modules/route.ts');
    expect(src).toContain('isModuleEnabledForUser');
    expect(src).toContain("request.headers.get('authorization')");
    expect(src).toContain('withAuth');
  });

  it('the override CRUD routes invalidate the gate cache on every change', () => {
    for (const p of [
      'app/api/admin/feature-flags/[key]/overrides/route.ts',
      'app/api/admin/feature-flags/[key]/overrides/[overrideId]/route.ts',
    ]) {
      expect(read(p), p).toContain('invalidateFlagCache(key)');
    }
  });

  it('the client boundary fails closed and honours the MODULE_HOME fallback', () => {
    const src = read('components/featureFlags/ModuleOverrideGate.tsx');
    expect(src).toContain("setVerdict('disabled')"); // error path
    expect(src).toContain('notFound()');
    expect(src).toContain('fallbackHref');
  });
});
