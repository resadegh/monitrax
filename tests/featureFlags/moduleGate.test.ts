/**
 * PROD Simplification P1.9 — module gate unit tests
 * (PROD_SIMPLIFICATION_PLAN.md §4.1, plan P1.9).
 *
 * Verifies: fail-closed semantics (row missing / enabled:false / DB
 * throw ⇒ hidden), the keyed 30s cache (per-key isolation + no repeat
 * DB hits inside TTL), invalidation (single key + clear-all), and the
 * preserved `isBasiqEnabled` alias delegating through the same keyed
 * cache.
 *
 * Coverage boundary: verifies the gate READER only. It does NOT verify
 * any route/layout enforcement (moduleGuards.test.ts) or nav filtering
 * (navFilter.test.ts), and touches no financial number.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock('@/lib/db', () => ({
  prisma: { globalFeatureFlag: { findUnique } },
  default: { globalFeatureFlag: { findUnique } },
}));

import {
  isFlagEnabled,
  isModuleEnabled,
  invalidateFlagCache,
} from '@/lib/featureFlags/moduleGate';
import { isBasiqEnabled, BASIQ_FLAG_KEY } from '@/lib/featureFlags/basiqGate';

beforeEach(() => {
  findUnique.mockReset();
  invalidateFlagCache(); // clear the module-level keyed cache between tests
});

describe('isModuleEnabled — fail-closed', () => {
  it('returns true only when the row exists with enabled=true', async () => {
    findUnique.mockResolvedValueOnce({ enabled: true });
    await expect(isModuleEnabled('MODULE_TAX')).resolves.toBe(true);
  });

  it('returns false when the row has enabled=false', async () => {
    findUnique.mockResolvedValueOnce({ enabled: false });
    await expect(isModuleEnabled('MODULE_TAX')).resolves.toBe(false);
  });

  it('returns false when the row is missing (fresh DB before seed)', async () => {
    findUnique.mockResolvedValueOnce(null);
    await expect(isModuleEnabled('MODULE_CFO')).resolves.toBe(false);
  });

  it('returns false when the DB is unreachable (hidden is the safe state)', async () => {
    findUnique.mockRejectedValueOnce(new Error('connection refused'));
    await expect(isModuleEnabled('MODULE_HOME')).resolves.toBe(false);
  });

  it('caches the failure so a DB outage is not hammered in a loop', async () => {
    findUnique.mockRejectedValueOnce(new Error('connection refused'));
    await isModuleEnabled('MODULE_HOME');
    await isModuleEnabled('MODULE_HOME');
    expect(findUnique).toHaveBeenCalledTimes(1);
  });
});

describe('keyed cache', () => {
  it('serves repeat reads of the same key from cache within the TTL', async () => {
    findUnique.mockResolvedValue({ enabled: true });
    await isModuleEnabled('MODULE_TAX');
    await isModuleEnabled('MODULE_TAX');
    await isModuleEnabled('MODULE_TAX');
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it('caches each key independently', async () => {
    findUnique
      .mockResolvedValueOnce({ enabled: true })
      .mockResolvedValueOnce({ enabled: false });
    await expect(isModuleEnabled('MODULE_TAX')).resolves.toBe(true);
    await expect(isModuleEnabled('MODULE_CFO')).resolves.toBe(false);
    // both cached now — no further DB hits
    await isModuleEnabled('MODULE_TAX');
    await isModuleEnabled('MODULE_CFO');
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('skipCache bypasses the cache', async () => {
    findUnique.mockResolvedValue({ enabled: true });
    await isModuleEnabled('MODULE_TAX');
    await isModuleEnabled('MODULE_TAX', { skipCache: true });
    expect(findUnique).toHaveBeenCalledTimes(2);
  });
});

describe('invalidation (the P1.6 unconditional PATCH hook contract)', () => {
  it('invalidateFlagCache(key) forces a fresh read for that key only', async () => {
    findUnique.mockResolvedValue({ enabled: false });
    await isModuleEnabled('MODULE_TAX');
    await isModuleEnabled('MODULE_CFO');
    expect(findUnique).toHaveBeenCalledTimes(2);

    invalidateFlagCache('MODULE_TAX');
    findUnique.mockResolvedValue({ enabled: true });
    await expect(isModuleEnabled('MODULE_TAX')).resolves.toBe(true); // re-read
    await expect(isModuleEnabled('MODULE_CFO')).resolves.toBe(false); // still cached
    expect(findUnique).toHaveBeenCalledTimes(3);
  });

  it('invalidateFlagCache() with no key clears every entry', async () => {
    findUnique.mockResolvedValue({ enabled: false });
    await isModuleEnabled('MODULE_TAX');
    await isModuleEnabled('MODULE_CFO');
    invalidateFlagCache();
    await isModuleEnabled('MODULE_TAX');
    await isModuleEnabled('MODULE_CFO');
    expect(findUnique).toHaveBeenCalledTimes(4);
  });
});

describe('isBasiqEnabled alias (call sites must not churn)', () => {
  it('reads the BASIQ_INTEGRATION key through the same keyed cache', async () => {
    findUnique.mockResolvedValueOnce({ enabled: true });
    await expect(isBasiqEnabled()).resolves.toBe(true);
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: BASIQ_FLAG_KEY } }),
    );
    // cached — a generic read of the same key needs no second DB hit
    await expect(isFlagEnabled(BASIQ_FLAG_KEY)).resolves.toBe(true);
    expect(findUnique).toHaveBeenCalledTimes(1);
  });
});
