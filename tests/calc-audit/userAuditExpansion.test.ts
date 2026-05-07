/**
 * Phase 41i.3b expansion — Tests for the new property + tax adapters.
 *
 * - propertyLVRAdapter / propertyEquityAdapter / propertyRentalYieldAdapter:
 *   exercises the per-user-property fetch + the validateOutput physical
 *   invariants.
 * - masterTaxPositionAdapter: exercises the orchestrator path with a
 *   minimal entity + income fetch.
 *
 * Pure unit tests — Prisma is mocked with vi.mock; downstream calc
 * engines run for real (they're pure).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPropertyFindMany = vi.fn();
const mockLegalEntityFindMany = vi.fn();

vi.mock('@/lib/db', () => ({
  default: {
    property: {
      findMany: (...args: unknown[]) => mockPropertyFindMany(...args),
    },
    legalEntity: {
      findMany: (...args: unknown[]) => mockLegalEntityFindMany(...args),
    },
  },
}));

import {
  propertyLVRAdapter,
  propertyEquityAdapter,
  propertyRentalYieldAdapter,
} from '@/lib/calc-audit/userAudit/adapters/propertyAdapters';
import { masterTaxPositionAdapter } from '@/lib/calc-audit/userAudit/adapters/taxAdapters';

beforeEach(() => {
  mockPropertyFindMany.mockReset();
  mockLegalEntityFindMany.mockReset();
});

// =============================================================================
// property.LVR
// =============================================================================

describe('Phase 41i.3b expansion — propertyLVRAdapter', () => {
  it('engineName matches registered engine', () => {
    expect(propertyLVRAdapter.engineName).toBe('property.LVR');
  });

  it('returns null when user has no properties (NO_DATA)', async () => {
    mockPropertyFindMany.mockResolvedValue([]);
    const input = await propertyLVRAdapter.fetchInput('user-1');
    expect(input).toBeNull();
  });

  it('returns null when all properties have zero value', async () => {
    mockPropertyFindMany.mockResolvedValue([
      { id: 'p1', currentValue: 0, loans: [] },
    ]);
    const input = await propertyLVRAdapter.fetchInput('user-1');
    expect(input).toBeNull();
  });

  it('picks the most-leveraged property', async () => {
    mockPropertyFindMany.mockResolvedValue([
      { id: 'p1', currentValue: 800_000, loans: [{ principal: 200_000 }] }, // 25% LVR
      { id: 'p2', currentValue: 600_000, loans: [{ principal: 540_000 }] }, // 90% LVR
      { id: 'p3', currentValue: 1_000_000, loans: [{ principal: 100_000 }] }, // 10% LVR
    ]);
    const input = await propertyLVRAdapter.fetchInput('user-1');
    expect(input).toEqual({ propertyValue: 600_000, loanBalance: 540_000 });
  });

  it('validates LVR is finite + within practical range', () => {
    expect(propertyLVRAdapter.validateOutput?.(50)).toEqual({ ok: true });
    expect(propertyLVRAdapter.validateOutput?.(NaN).ok).toBe(false);
    expect(propertyLVRAdapter.validateOutput?.(-5).ok).toBe(false);
    expect(propertyLVRAdapter.validateOutput?.(600).ok).toBe(false);
  });
});

// =============================================================================
// property.equity
// =============================================================================

describe('Phase 41i.3b expansion — propertyEquityAdapter', () => {
  it('engineName matches registered engine', () => {
    expect(propertyEquityAdapter.engineName).toBe('property.equity');
  });

  it('NaN equity rejected', () => {
    expect(propertyEquityAdapter.validateOutput?.(NaN).ok).toBe(false);
  });

  it('negative equity allowed (owner is underwater)', () => {
    expect(propertyEquityAdapter.validateOutput?.(-100_000)).toEqual({ ok: true });
  });

  it('zero / positive equity is fine', () => {
    expect(propertyEquityAdapter.validateOutput?.(0)).toEqual({ ok: true });
    expect(propertyEquityAdapter.validateOutput?.(500_000)).toEqual({ ok: true });
  });
});

// =============================================================================
// property.rentalYield
// =============================================================================

describe('Phase 41i.3b expansion — propertyRentalYieldAdapter', () => {
  it('engineName matches registered engine', () => {
    expect(propertyRentalYieldAdapter.engineName).toBe('property.rentalYield');
  });

  it('returns null when user has no properties', async () => {
    mockPropertyFindMany.mockResolvedValue([]);
    const input = await propertyRentalYieldAdapter.fetchInput('user-1');
    expect(input).toBeNull();
  });

  it('annualises weekly rent correctly when picking the highest-yield property', async () => {
    mockPropertyFindMany.mockResolvedValue([
      {
        id: 'p1',
        currentValue: 800_000,
        income: [{ amount: 600, frequency: 'WEEKLY' }], // 600*52 = 31,200 → 3.9%
      },
      {
        id: 'p2',
        currentValue: 500_000,
        income: [{ amount: 2_500, frequency: 'MONTHLY' }], // 2500*12 = 30,000 → 6%
      },
    ]);
    const input = await propertyRentalYieldAdapter.fetchInput('user-1');
    expect(input?.propertyValue).toBe(500_000);
    expect(input?.annualRent).toBe(30_000);
  });

  it('rejects negative + over-100 yields, accepts in-range', () => {
    expect(propertyRentalYieldAdapter.validateOutput?.(5).ok).toBe(true);
    expect(propertyRentalYieldAdapter.validateOutput?.(-1).ok).toBe(false);
    expect(propertyRentalYieldAdapter.validateOutput?.(150).ok).toBe(false);
    expect(propertyRentalYieldAdapter.validateOutput?.(NaN).ok).toBe(false);
  });
});

// =============================================================================
// tax.masterTaxPosition
// =============================================================================

describe('Phase 41i.3b expansion — masterTaxPositionAdapter', () => {
  it('engineName matches registered engine', () => {
    expect(masterTaxPositionAdapter.engineName).toBe('tax.masterTaxPosition');
  });

  it('returns null when user has no LegalEntity rows (NO_DATA)', async () => {
    mockLegalEntityFindMany.mockResolvedValue([]);
    const input = await masterTaxPositionAdapter.fetchInput('user-1');
    expect(input).toBeNull();
  });

  it('builds a single-PERSONAL-NAME entity input from one entity row', async () => {
    mockLegalEntityFindMany.mockResolvedValue([
      {
        id: 'e1',
        type: 'PERSONAL_NAME',
        incomes: [
          {
            id: 'i1',
            type: 'SALARY',
            amount: 100_000,
            frequency: 'YEARLY',
            grossAmount: null,
            netAmount: null,
            paygWithholding: 22_000,
          },
        ],
      },
    ]);
    const input = await masterTaxPositionAdapter.fetchInput('user-1');
    expect(input?.userId).toBe('user-1');
    expect(input?.entities).toHaveLength(1);
    expect(input?.entities[0].entityId).toBe('e1');
    expect(input?.entities[0].entityType).toBe('PERSONAL_NAME');
    expect(input?.entities[0].incomes).toHaveLength(1);
  });

  it('skips entities with unknown type (defensive against schema drift)', async () => {
    mockLegalEntityFindMany.mockResolvedValue([
      { id: 'e1', type: 'PERSONAL_NAME', incomes: [] },
      { id: 'e2', type: 'UNKNOWN_FUTURE_TYPE', incomes: [] },
    ]);
    const input = await masterTaxPositionAdapter.fetchInput('user-1');
    expect(input?.entities).toHaveLength(1);
    expect(input?.entities[0].entityId).toBe('e1');
  });

  describe('validateOutput', () => {
    const baseGoodOutput = {
      userId: 'u1',
      fy: { financialYear: '2024-25', label: 'FY24-25' },
      entities: [],
      totals: {
        assessableIncome: 100_000,
        taxableIncome: 80_000,
        netTax: 20_000,
        paygWithheld: 22_000,
        estimatedRefund: 2_000,
      },
      authoritySources: [],
      uncomputed: [],
      computedAt: '2026-05-07T00:00:00Z',
      boundary: { boundary: 'AFSL boundary', citations: [], uncomputed: [] },
      modulesInvoked: ['entityTaxRouter'],
    };

    it('passes a sane output', () => {
      expect(masterTaxPositionAdapter.validateOutput?.(baseGoodOutput as never)).toEqual({
        ok: true,
      });
    });

    it('rejects missing modulesInvoked', () => {
      const out = { ...baseGoodOutput, modulesInvoked: [] };
      const r = masterTaxPositionAdapter.validateOutput?.(out as never);
      expect(r?.ok).toBe(false);
    });

    it('rejects taxableIncome > assessableIncome (deduction inversion)', () => {
      const out = {
        ...baseGoodOutput,
        totals: {
          ...baseGoodOutput.totals,
          assessableIncome: 100_000,
          taxableIncome: 110_000,
        },
      };
      const r = masterTaxPositionAdapter.validateOutput?.(out as never);
      expect(r?.ok).toBe(false);
      if (!r?.ok) expect(r?.severity).toBe('CRITICAL');
    });

    it('rejects estimatedRefund identity violation', () => {
      const out = {
        ...baseGoodOutput,
        totals: {
          ...baseGoodOutput.totals,
          estimatedRefund: 99_999, // != paygWithheld - netTax = 2000
        },
      };
      const r = masterTaxPositionAdapter.validateOutput?.(out as never);
      expect(r?.ok).toBe(false);
      if (!r?.ok) expect(r?.severity).toBe('CRITICAL');
    });

    it('rejects negative paygWithheld', () => {
      const out = {
        ...baseGoodOutput,
        totals: {
          ...baseGoodOutput.totals,
          paygWithheld: -100,
        },
      };
      const r = masterTaxPositionAdapter.validateOutput?.(out as never);
      expect(r?.ok).toBe(false);
    });

    it('allows negative netTax (refund > liability)', () => {
      const out = {
        ...baseGoodOutput,
        totals: {
          assessableIncome: 100_000,
          taxableIncome: 80_000,
          netTax: -2_000,
          paygWithheld: 22_000,
          estimatedRefund: 24_000, // 22000 - (-2000) = 24000
        },
      };
      expect(masterTaxPositionAdapter.validateOutput?.(out as never)).toEqual({
        ok: true,
      });
    });

    it('rejects NaN in totals', () => {
      const out = {
        ...baseGoodOutput,
        totals: {
          ...baseGoodOutput.totals,
          netTax: Number.NaN,
        },
      };
      const r = masterTaxPositionAdapter.validateOutput?.(out as never);
      expect(r?.ok).toBe(false);
    });
  });
});
