/**
 * PROD Simplification P1.9 — server-enforcement guard tests
 * (plan §4.4, P1.4/P1.9).
 *
 * Verifies: `moduleApiGuard` 503s with a stable code when a module is
 * off and passes through when on; `moduleRouteGuard` renders notFound
 * when off; the MODULE_HOME root redirect contract; and the registry
 * invariants the P1.2 audit locked in (no kept-caller API prefix is
 * ever gated; keys unique; MODULE_HOME is the only redirect).
 *
 * Coverage boundary: exercises the guard helpers + registry data, NOT
 * every gated route handler (those share the two helpers verbatim) and
 * NOT the rendered 404 page. No financial number is touched.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findUnique, notFoundMock, redirectMock } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock('@/lib/db', () => ({
  prisma: { globalFeatureFlag: { findUnique } },
  default: { globalFeatureFlag: { findUnique } },
}));

vi.mock('next/navigation', () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
}));

import { moduleApiGuard, moduleRouteGuard } from '@/lib/featureFlags/moduleRouteGuard';
import { invalidateFlagCache } from '@/lib/featureFlags/moduleGate';
import {
  MODULE_REGISTRY,
  MODULE_KEYS,
  getModuleDef,
} from '@/lib/featureFlags/moduleRegistry';

beforeEach(() => {
  findUnique.mockReset();
  notFoundMock.mockClear();
  redirectMock.mockClear();
  invalidateFlagCache();
});

describe('moduleApiGuard', () => {
  it('returns a 503 MODULE_DISABLED response when the module is off', async () => {
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

  it('fails closed to 503 when the DB is unreachable', async () => {
    findUnique.mockRejectedValueOnce(new Error('down'));
    const blocked = await moduleApiGuard('MODULE_STRATEGY');
    expect(blocked!.status).toBe(503);
  });
});

describe('moduleRouteGuard', () => {
  it('renders notFound when the module is off (the v1 default)', async () => {
    findUnique.mockResolvedValueOnce(null); // row missing = off
    await expect(moduleRouteGuard('MODULE_TAX')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('passes through silently when the module is on', async () => {
    findUnique.mockResolvedValueOnce({ enabled: true });
    await expect(moduleRouteGuard('MODULE_TAX')).resolves.toBeUndefined();
    expect(notFoundMock).not.toHaveBeenCalled();
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
    // KEEP-OPEN verdicts from the audit — gating any of these breaks a
    // kept surface: tax (wizard superSync), investments (kept dialogs'
    // account pickers), portal (FeedbackChatDrawer in the shell),
    // household-* (wizard + OwnershipPicker), dashboard (balances
    // Hidden-Wealth), master-snapshot (sidebar TrailStagePill +
    // activity page), plus everything the kept table reaches.
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
  it('redirects to /dashboard/properties when MODULE_HOME is off', async () => {
    vi.doMock('@/app/dashboard/HomeClient', () => ({ default: () => null }));
    findUnique.mockResolvedValue({ enabled: false });
    const { default: DashboardRootPage } = await import('@/app/dashboard/page');
    await expect(DashboardRootPage()).rejects.toThrow(
      'NEXT_REDIRECT:/dashboard/properties',
    );
    expect(redirectMock).toHaveBeenCalledWith('/dashboard/properties');
    vi.doUnmock('@/app/dashboard/HomeClient');
  });
});
