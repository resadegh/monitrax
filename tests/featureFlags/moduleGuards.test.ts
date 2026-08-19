/**
 * PROD Simplification P1.9 + R0 — server-enforcement guard tests
 * (plan §4.4, §5 R0).
 *
 * Verifies: `resolveModuleRouting`'s three modes (enabled /
 * override-window / hidden) with the MON-160 dynamic-rendering
 * opt-out ordered BEFORE any flag read; `moduleApiGuard`'s 503
 * contract in both global-only and user-aware forms (R0 override
 * precedence); the MODULE_HOME root redirect contract; and the
 * registry invariants the P1.2 audit locked in.
 *
 * Coverage boundary: exercises the guard/resolver helpers + registry
 * data, NOT every gated route handler (they share the helpers
 * verbatim), NOT the rendered 404 page, and NOT the client half of an
 * override window (ModuleOverrideGate — locked by source-scan in
 * r0Overrides.test.ts). No financial number is touched.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findUnique, overrideFindFirst, notFoundMock, redirectMock, connectionMock } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  overrideFindFirst: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  connectionMock: vi.fn(async () => {}),
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

vi.mock('next/navigation', () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
}));

// Partial mock: keep the real NextResponse (moduleApiGuard builds real 503s),
// stub only `connection` — outside a request scope the real one throws.
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, connection: connectionMock };
});

import { moduleApiGuard, resolveModuleRouting } from '@/lib/featureFlags/moduleRouteGuard';
import { invalidateFlagCache } from '@/lib/featureFlags/moduleGate';
import {
  MODULE_REGISTRY,
  MODULE_KEYS,
  getModuleDef,
} from '@/lib/featureFlags/moduleRegistry';

beforeEach(() => {
  findUnique.mockReset();
  overrideFindFirst.mockReset();
  overrideFindFirst.mockResolvedValue(null); // default: no overrides anywhere
  notFoundMock.mockClear();
  redirectMock.mockClear();
  connectionMock.mockClear();
  invalidateFlagCache();
});

describe('resolveModuleRouting (layout routing)', () => {
  it("returns 'enabled' when the global flag is on (no override lookup needed)", async () => {
    findUnique.mockResolvedValueOnce({ enabled: true });
    await expect(resolveModuleRouting('MODULE_TAX')).resolves.toBe('enabled');
    expect(overrideFindFirst).not.toHaveBeenCalled();
  });

  it("returns 'hidden' when the flag is off and no active override exists (the v1 default)", async () => {
    findUnique.mockResolvedValueOnce(null);
    await expect(resolveModuleRouting('MODULE_TAX')).resolves.toBe('hidden');
  });

  it("returns 'override-window' when the flag is off but an active override exists (R0)", async () => {
    findUnique.mockResolvedValueOnce({ enabled: false });
    overrideFindFirst.mockResolvedValueOnce({ id: 'ov-1' });
    await expect(resolveModuleRouting('MODULE_TAX')).resolves.toBe('override-window');
  });

  it("fails closed to 'hidden' when the DB is unreachable", async () => {
    findUnique.mockRejectedValueOnce(new Error('down'));
    overrideFindFirst.mockRejectedValueOnce(new Error('down'));
    await expect(resolveModuleRouting('MODULE_STRATEGY')).resolves.toBe('hidden');
  });

  it('MON-160: forces dynamic rendering (connection()) BEFORE reading the flag — build-time flag state must never bake the verdict', async () => {
    findUnique.mockResolvedValueOnce({ enabled: true });
    await resolveModuleRouting('MODULE_TAX');
    expect(connectionMock).toHaveBeenCalledTimes(1);
    // Order matters: the dynamic opt-out must precede the flag read, so a
    // statically-attempted render bails out before any verdict is computed.
    expect(connectionMock.mock.invocationCallOrder[0]).toBeLessThan(
      findUnique.mock.invocationCallOrder[0],
    );
  });
});

describe('moduleApiGuard', () => {
  it('returns a 503 MODULE_DISABLED response when the module is off (global-only form)', async () => {
    findUnique.mockResolvedValueOnce({ enabled: false });
    const blocked = await moduleApiGuard('MODULE_CFO');
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(503);
    const body = await blocked!.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('MODULE_DISABLED');
    expect(body.error.details.module).toBe('MODULE_CFO');
  });

  it('returns null (handler proceeds) when the module is on', async () => {
    findUnique.mockResolvedValueOnce({ enabled: true });
    await expect(moduleApiGuard('MODULE_CFO')).resolves.toBeNull();
  });

  it('R0 precedence: global OFF + active override for THIS user ⇒ proceeds; another user ⇒ 503', async () => {
    findUnique.mockResolvedValue({ enabled: false });
    overrideFindFirst.mockImplementation(async ({ where }: { where: { targetId?: string } }) =>
      where.targetId === 'user-reza' ? { id: 'ov-1' } : null,
    );
    await expect(moduleApiGuard('MODULE_TAX', 'user-reza')).resolves.toBeNull();
    const blocked = await moduleApiGuard('MODULE_TAX', 'user-other');
    expect(blocked!.status).toBe(503);
  });

  it('fails closed to 503 when the DB is unreachable', async () => {
    findUnique.mockRejectedValueOnce(new Error('down'));
    overrideFindFirst.mockRejectedValueOnce(new Error('down'));
    const blocked = await moduleApiGuard('MODULE_STRATEGY', 'user-reza');
    expect(blocked!.status).toBe(503);
  });
});

describe('registry invariants (the P1.2 audit, locked)', () => {
  it('has 13 unique keys', () => {
    expect(MODULE_KEYS).toHaveLength(13);
    expect(new Set(MODULE_KEYS).size).toBe(13);
  });

  it('MODULE_HOME is the ONLY redirect-behaviour module (root never 404s)', () => {
    const redirects = MODULE_REGISTRY.filter((m) => m.behaviour === 'redirect');
    expect(redirects.map((m) => m.key)).toEqual(['MODULE_HOME']);
  });

  it('never gates an API prefix with kept-surface callers (P1.2 verdicts)', () => {
    const keepOpen = [
      'tax',
      'investments',
      'portal',
      'household-profile',
      'household-members',
      'household-pets',
      'dashboard',
      'master-snapshot',
      'expenses',
      'income',
      'loans',
      'ownership',
      'transactions',
      'documents',
      'properties',
      'reports',
      'portfolio',
      'auth',
      'admin',
      'feature-flags',
    ];
    const gated = MODULE_REGISTRY.flatMap((m) => m.apiPrefixes);
    for (const prefix of keepOpen) {
      expect(gated, `"${prefix}" must never be gated`).not.toContain(prefix);
    }
  });

  it('gates each API prefix under exactly one module key', () => {
    const gated = MODULE_REGISTRY.flatMap((m) => m.apiPrefixes);
    expect(new Set(gated).size).toBe(gated.length);
  });

  it('every module resolves through getModuleDef', () => {
    for (const key of MODULE_KEYS) {
      expect(getModuleDef(key).key).toBe(key);
    }
  });
});

describe('MODULE_HOME root redirect (app/dashboard/page.tsx contract)', () => {
  it('redirects to /dashboard/properties when MODULE_HOME is fully hidden', async () => {
    vi.doMock('@/app/dashboard/HomeClient', () => ({ default: () => null }));
    findUnique.mockResolvedValue({ enabled: false });
    overrideFindFirst.mockResolvedValue(null);
    const { default: DashboardRootPage } = await import('@/app/dashboard/page');
    await expect(DashboardRootPage()).rejects.toThrow(
      'NEXT_REDIRECT:/dashboard/properties',
    );
    expect(redirectMock).toHaveBeenCalledWith('/dashboard/properties');
    vi.doUnmock('@/app/dashboard/HomeClient');
  });
});
