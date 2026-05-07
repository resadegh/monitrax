/**
 * Phase 41i.6a — Surface descriptor registry tests.
 *
 * Locks in the structural defence:
 *   - Bootstrap registers exactly 10 descriptors (the v1 top-10).
 *   - Registry rejects duplicate surfaceIds.
 *   - assertDescriptor enforces every invariant on registration.
 *   - exceedsTolerance correctly applies AUD / SCORE / PERCENT defaults.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  surfaceRegistry,
  bootstrapSurfaceRegistry,
  assertDescriptor,
  exceedsTolerance,
  DEFAULT_TOLERANCE_BY_KIND,
  netWorthTile,
  healthScoreTile,
  emergencyFundTile,
  investmentTotalTile,
  propertyEquityTile,
  taxEstimatedRefundTile,
  cashflowMonthlyTile,
  incomeMonthlyTile,
  expenseMonthlyTile,
  debtTotalTile,
} from '@/lib/calc-audit/surfaces';
import type { SurfaceDescriptor } from '@/lib/calc-audit/surfaces';

beforeEach(() => {
  surfaceRegistry.__testOnlyClear();
  bootstrapSurfaceRegistry();
});

describe('Phase 41i.6a — surface registry bootstrap', () => {
  it('registers exactly 10 canonical descriptors at bootstrap (top-10 v1 coverage)', () => {
    expect(surfaceRegistry.size()).toBe(10);
  });

  it('lists descriptors alphabetically by surfaceId', () => {
    const ids = surfaceRegistry.list().map((d) => d.surfaceId);
    expect(ids).toEqual([
      'tile.cashflow.monthly',
      'tile.debt.total',
      'tile.emergencyfund.monthsCovered',
      'tile.expense.monthly',
      'tile.health.score',
      'tile.income.monthly',
      'tile.investments.totalValue',
      'tile.networth.total',
      'tile.property.portfolioEquity',
      'tile.tax.estimatedRefund',
    ]);
  });

  it('groups descriptors by canonical service (all v1 descriptors point at master)', () => {
    const grouped = surfaceRegistry.byCanonicalService();
    expect(Object.keys(grouped)).toEqual(['lib/services/masterFinancialService.ts']);
    expect(grouped['lib/services/masterFinancialService.ts']).toHaveLength(10);
  });

  it('groups descriptors by route (admin UI uses this for filtering)', () => {
    const grouped = surfaceRegistry.byRoute();
    expect(Object.keys(grouped).sort()).toEqual([
      '/dashboard',
      '/dashboard/cfo',
      '/dashboard/debt-planner',
      '/dashboard/investments/accounts',
      '/dashboard/properties',
      '/dashboard/safety-net',
      '/dashboard/tax',
    ]);
  });

  it('throws on duplicate surfaceId registration', () => {
    expect(() => surfaceRegistry.register(netWorthTile)).toThrow(/already registered/i);
  });

  it('returns undefined for unknown surfaceId', () => {
    expect(surfaceRegistry.get('tile.nonexistent.foo')).toBeUndefined();
  });
});

describe('Phase 41i.6a — assertDescriptor invariants', () => {
  it('rejects empty surfaceId', () => {
    expect(() =>
      assertDescriptor({
        ...netWorthTile,
        surfaceId: '',
      } as SurfaceDescriptor),
    ).toThrow(/surfaceId/);
  });

  it('rejects surfaceId with invalid characters', () => {
    expect(() =>
      assertDescriptor({
        ...netWorthTile,
        surfaceId: 'tile with spaces',
      } as SurfaceDescriptor),
    ).toThrow(/invalid characters/);
  });

  it('accepts surfaceId with dots, underscores, hyphens, alphanumerics', () => {
    expect(() =>
      assertDescriptor({
        ...netWorthTile,
        surfaceId: 'tile.foo.bar_baz-1',
      } as SurfaceDescriptor),
    ).not.toThrow();
  });

  it('rejects empty description', () => {
    expect(() =>
      assertDescriptor({
        ...netWorthTile,
        description: '',
      } as SurfaceDescriptor),
    ).toThrow(/description/);
  });

  it('rejects route not starting with "/"', () => {
    expect(() =>
      assertDescriptor({
        ...netWorthTile,
        route: 'dashboard/cfo',
      } as SurfaceDescriptor),
    ).toThrow(/start with "\/"/);
  });

  it('rejects missing canonicalSource fields', () => {
    expect(() =>
      assertDescriptor({
        ...netWorthTile,
        canonicalSource: {
          service: '',
          method: 'foo',
          fieldPath: 'bar',
        },
      } as SurfaceDescriptor),
    ).toThrow(/non-empty service/);
  });

  it('rejects canonicalSource.service that is neither .ts nor /api/', () => {
    expect(() =>
      assertDescriptor({
        ...netWorthTile,
        canonicalSource: {
          service: 'lib/services/some-module', // missing .ts
          method: 'foo',
          fieldPath: 'bar',
        },
      } as SurfaceDescriptor),
    ).toThrow(/end with "\.ts"/);
  });

  it('accepts canonicalSource.service starting with /api/', () => {
    expect(() =>
      assertDescriptor({
        ...netWorthTile,
        canonicalSource: {
          service: '/api/cfo',
          method: 'GET',
          fieldPath: 'someField',
        },
      } as SurfaceDescriptor),
    ).not.toThrow();
  });

  it('rejects non-function invokeCanonicalSource', () => {
    expect(() =>
      assertDescriptor({
        ...netWorthTile,
        invokeCanonicalSource: 'not a function' as unknown as SurfaceDescriptor['invokeCanonicalSource'],
      }),
    ).toThrow(/invokeCanonicalSource must be a function/);
  });

  it('rejects non-function extractRenderedValue', () => {
    expect(() =>
      assertDescriptor({
        ...netWorthTile,
        extractRenderedValue: 'not a function' as unknown as SurfaceDescriptor['extractRenderedValue'],
      }),
    ).toThrow(/extractRenderedValue must be a function/);
  });
});

describe('Phase 41i.6a — descriptor invariants for the v1 top-10', () => {
  const allDescriptors = [
    netWorthTile,
    healthScoreTile,
    emergencyFundTile,
    investmentTotalTile,
    propertyEquityTile,
    taxEstimatedRefundTile,
    cashflowMonthlyTile,
    incomeMonthlyTile,
    expenseMonthlyTile,
    debtTotalTile,
  ];

  it('every descriptor passes assertDescriptor', () => {
    for (const d of allDescriptors) {
      expect(() => assertDescriptor(d)).not.toThrow();
    }
  });

  it('every surfaceId follows the dotted "tile.*" convention', () => {
    for (const d of allDescriptors) {
      expect(d.surfaceId).toMatch(/^tile\.[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*$/);
    }
  });

  it('every descriptor has a description ≥ 20 chars (audit-UI quality)', () => {
    for (const d of allDescriptors) {
      expect(d.description.length).toBeGreaterThanOrEqual(20);
    }
  });

  it('every descriptor has a kind defined for default tolerance lookup', () => {
    for (const d of allDescriptors) {
      expect(d.kind).toBeTruthy();
      expect(DEFAULT_TOLERANCE_BY_KIND[d.kind]).toBeDefined();
    }
  });

  it('extractRenderedValue returns null for malformed input (defensive)', () => {
    for (const d of allDescriptors) {
      expect(d.extractRenderedValue(null)).toBeNull();
      expect(d.extractRenderedValue({})).toBeNull();
      expect(d.extractRenderedValue(undefined)).toBeNull();
    }
  });
});

describe('Phase 41i.6a — exceedsTolerance', () => {
  describe('AUD (zero cents tolerance by default)', () => {
    it('returns false when canonical equals rendered', () => {
      expect(exceedsTolerance(netWorthTile, 1_000_000, 1_000_000)).toBe(false);
    });

    it('returns true for ANY divergence on AUD (zero tolerance)', () => {
      expect(exceedsTolerance(netWorthTile, 1_000_000, 999_999.99)).toBe(true);
      expect(exceedsTolerance(netWorthTile, 1_000_000, 1_000_000.01)).toBe(true);
    });
  });

  describe('SCORE (0.5pt tolerance by default)', () => {
    it('returns false within 0.5pt', () => {
      expect(exceedsTolerance(healthScoreTile, 75, 75.4)).toBe(false);
      expect(exceedsTolerance(healthScoreTile, 75, 74.6)).toBe(false);
    });

    it('returns true beyond 0.5pt', () => {
      expect(exceedsTolerance(healthScoreTile, 75, 75.6)).toBe(true);
      expect(exceedsTolerance(healthScoreTile, 75, 74.4)).toBe(true);
    });
  });

  describe('MONTHS (zero tolerance)', () => {
    it('returns false when canonical equals rendered', () => {
      expect(exceedsTolerance(emergencyFundTile, 6, 6)).toBe(false);
    });

    it('returns true for any divergence', () => {
      expect(exceedsTolerance(emergencyFundTile, 6, 5.5)).toBe(true);
    });
  });

  describe('descriptor-level tolerance override', () => {
    it('honours an explicit tolerance over the kind default', () => {
      const customDescriptor: SurfaceDescriptor = {
        ...netWorthTile,
        surfaceId: 'tile.test.custom-tolerance',
        tolerance: { absolute: 100 },
      };
      expect(exceedsTolerance(customDescriptor, 1_000_000, 1_000_050)).toBe(false);
      expect(exceedsTolerance(customDescriptor, 1_000_000, 1_000_101)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles canonical = 0 without divide-by-zero (relative tolerance skipped)', () => {
      // Rendered $0.01 vs canonical $0 — exceeds AUD tolerance (zero absolute)
      expect(exceedsTolerance(netWorthTile, 0, 0.01)).toBe(true);
      // Rendered $0 vs canonical $0 — perfect match
      expect(exceedsTolerance(netWorthTile, 0, 0)).toBe(false);
    });

    it('handles negative canonical values (cashflow can be negative)', () => {
      expect(exceedsTolerance(cashflowMonthlyTile, -5_000, -5_000)).toBe(false);
      expect(exceedsTolerance(cashflowMonthlyTile, -5_000, -5_000.01)).toBe(true);
    });
  });
});
