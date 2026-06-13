/**
 * Phase 47 Stage D (AD-2) — stake & beneficial attribution tests.
 *
 * Pins the pure decision core that splits co-owned income per legal
 * interest (TR 93/32) and redirects bare-trust / nominee income to the
 * beneficial owner. Binding: PHASE_44_PART_2 §14 AD-2 + PHASE_47 §4A.
 */

import { describe, it, expect } from 'vitest';
import {
  attributeAsset,
  isActiveInFy,
  type AssetOwnershipContext,
} from '@/lib/services/ownershipAttribution';
import {
  resolveIncomeAssetKey,
  resolveExpenseAssetKey,
} from '@/lib/services/entityTaxFactsAssembler';

const fyRange = {
  start: new Date(Date.UTC(2024, 6, 1)),
  end: new Date(Date.UTC(2025, 6, 1)),
};

describe('AD-2 — isActiveInFy', () => {
  it('active when it spans the FY', () => {
    expect(isActiveInFy(new Date('2020-01-01'), null, fyRange)).toBe(true);
  });
  it('inactive when it starts after the FY ends', () => {
    expect(isActiveInFy(new Date('2025-08-01'), null, fyRange)).toBe(false);
  });
  it('inactive when it ended before the FY starts', () => {
    expect(isActiveInFy(new Date('2019-01-01'), new Date('2023-01-01'), fyRange)).toBe(false);
  });
  it('active when it ends mid-FY', () => {
    expect(isActiveInFy(new Date('2020-01-01'), new Date('2024-12-01'), fyRange)).toBe(true);
  });
});

const E = 'reza';
const S = 'sarah';

describe('AD-2 — attributeAsset: flat (no group / override)', () => {
  it('legal owner takes 100%', () => {
    const ctx: AssetOwnershipContext = { legalOwnerEntityId: E };
    const out = attributeAsset(E, ctx);
    expect(out.weight).toBe(1);
    expect(out.splitApplied).toBe(false);
    expect(out.overrideApplied).toBe(false);
    expect(out.flag).toBeUndefined();
  });
  it('a non-owner takes 0', () => {
    expect(attributeAsset(S, { legalOwnerEntityId: E }).weight).toBe(0);
  });
  it('a SOLE group behaves like flat (no split flag)', () => {
    const ctx: AssetOwnershipContext = {
      legalOwnerEntityId: E,
      group: { tenancyType: 'SOLE', stakes: [{ entityId: E, sharePct: null }] },
    };
    const out = attributeAsset(E, ctx);
    expect(out.weight).toBe(1);
    expect(out.splitApplied).toBe(false);
    expect(out.flag).toBeUndefined();
  });
});

describe('AD-2 — attributeAsset: joint tenants (equal undivided shares)', () => {
  const ctx: AssetOwnershipContext = {
    legalOwnerEntityId: E,
    group: {
      tenancyType: 'JOINT_TENANTS',
      stakes: [
        { entityId: E, sharePct: null },
        { entityId: S, sharePct: null },
      ],
    },
  };
  it('splits 50/50 regardless of who is the stamped legal owner', () => {
    expect(attributeAsset(E, ctx).weight).toBeCloseTo(0.5);
    expect(attributeAsset(S, ctx).weight).toBeCloseTo(0.5);
  });
  it('co-owners weights sum to exactly 1 (additivity)', () => {
    expect(attributeAsset(E, ctx).weight + attributeAsset(S, ctx).weight).toBeCloseTo(1);
  });
  it('flags the split + marks splitApplied', () => {
    const out = attributeAsset(E, ctx);
    expect(out.splitApplied).toBe(true);
    expect(out.flag?.id).toBe('UC-OWNERSHIP-SPLIT');
  });
  it('three joint tenants split 1/3 each', () => {
    const three: AssetOwnershipContext = {
      legalOwnerEntityId: E,
      group: {
        tenancyType: 'JOINT_TENANTS',
        stakes: [
          { entityId: E, sharePct: null },
          { entityId: S, sharePct: null },
          { entityId: 'kim', sharePct: null },
        ],
      },
    };
    expect(attributeAsset(E, three).weight).toBeCloseTo(1 / 3);
  });
});

describe('AD-2 — attributeAsset: tenants in common (fractional)', () => {
  const ctx: AssetOwnershipContext = {
    legalOwnerEntityId: E,
    group: {
      tenancyType: 'TENANTS_IN_COMMON',
      stakes: [
        { entityId: E, sharePct: 70 },
        { entityId: S, sharePct: 30 },
      ],
    },
  };
  it('follows the recorded share percentages', () => {
    expect(attributeAsset(E, ctx).weight).toBeCloseTo(0.7);
    expect(attributeAsset(S, ctx).weight).toBeCloseTo(0.3);
  });
  it('shares sum to 1 (additivity)', () => {
    expect(attributeAsset(E, ctx).weight + attributeAsset(S, ctx).weight).toBeCloseTo(1);
  });
  it('falls back to flat + UNKNOWN flag when a share is missing', () => {
    const missing: AssetOwnershipContext = {
      legalOwnerEntityId: E,
      group: {
        tenancyType: 'TENANTS_IN_COMMON',
        stakes: [
          { entityId: E, sharePct: 70 },
          { entityId: S, sharePct: null },
        ],
      },
    };
    const outE = attributeAsset(E, missing);
    expect(outE.weight).toBe(1); // legal owner — flat fallback
    expect(outE.splitApplied).toBe(false);
    expect(outE.flag?.id).toBe('UC-OWNERSHIP-SPLIT-UNKNOWN');
    expect(attributeAsset(S, missing).weight).toBe(0);
  });
  it('falls back to flat when shares do not sum to 100%', () => {
    const bad: AssetOwnershipContext = {
      legalOwnerEntityId: E,
      group: {
        tenancyType: 'TENANTS_IN_COMMON',
        stakes: [
          { entityId: E, sharePct: 70 },
          { entityId: S, sharePct: 20 },
        ],
      },
    };
    expect(attributeAsset(E, bad).weight).toBe(1);
    expect(attributeAsset(E, bad).flag?.id).toBe('UC-OWNERSHIP-SPLIT-UNKNOWN');
  });
  it('tolerates Decimal rounding within 0.01 of 100', () => {
    const rounded: AssetOwnershipContext = {
      legalOwnerEntityId: E,
      group: {
        tenancyType: 'TENANTS_IN_COMMON',
        stakes: [
          { entityId: E, sharePct: 33.333333 },
          { entityId: S, sharePct: 66.666667 },
        ],
      },
    };
    expect(attributeAsset(E, rounded).splitApplied).toBe(true);
  });
});

describe('AD-2 — attributeAsset: beneficial ownership override (P8 / LRBA)', () => {
  const ctx: AssetOwnershipContext = {
    legalOwnerEntityId: 'bareTrustee',
    override: {
      legalOwnerEntityId: 'bareTrustee',
      beneficialOwnerEntityId: 'smsf',
      basis: 'BARE_TRUST',
    },
  };
  it('beneficial owner takes 100% (income follows beneficial ownership)', () => {
    const out = attributeAsset('smsf', ctx);
    expect(out.weight).toBe(1);
    expect(out.overrideApplied).toBe(true);
    expect(out.flag?.id).toBe('UC-BENEFICIAL-OWNED');
  });
  it('legal title holder takes 0, flagged as redirected (not silent)', () => {
    const out = attributeAsset('bareTrustee', ctx);
    expect(out.weight).toBe(0);
    expect(out.overrideApplied).toBe(true);
    expect(out.flag?.id).toBe('UC-BENEFICIAL-REDIRECTED');
  });
  it('an unrelated entity takes 0', () => {
    expect(attributeAsset('reza', ctx).weight).toBe(0);
  });
  it('override beats a co-existing group (beneficial supersedes legal title)', () => {
    const both: AssetOwnershipContext = {
      legalOwnerEntityId: 'bareTrustee',
      group: {
        tenancyType: 'JOINT_TENANTS',
        stakes: [
          { entityId: 'bareTrustee', sharePct: null },
          { entityId: 'reza', sharePct: null },
        ],
      },
      override: {
        legalOwnerEntityId: 'bareTrustee',
        beneficialOwnerEntityId: 'smsf',
        basis: 'BARE_TRUST',
      },
    };
    expect(attributeAsset('smsf', both).weight).toBe(1);
    expect(attributeAsset('reza', both).weight).toBe(0);
  });
});

describe('AD-2 — attributeAsset: defensive cases', () => {
  it('legal owner not in the group still keeps its income (flat fallback + flag)', () => {
    const ctx: AssetOwnershipContext = {
      legalOwnerEntityId: E,
      group: {
        tenancyType: 'JOINT_TENANTS',
        stakes: [
          { entityId: S, sharePct: null },
          { entityId: 'kim', sharePct: null },
        ],
      },
    };
    const out = attributeAsset(E, ctx);
    expect(out.weight).toBe(1);
    expect(out.flag?.id).toBe('UC-OWNERSHIP-SPLIT-UNKNOWN');
  });
});

describe('AD-2 — asset-key resolvers', () => {
  it('income: property wins over investment account', () => {
    expect(resolveIncomeAssetKey({ propertyId: 'p1', investmentAccountId: 'i1' })).toEqual({
      type: 'property',
      id: 'p1',
    });
    expect(resolveIncomeAssetKey({ propertyId: null, investmentAccountId: 'i1' })).toEqual({
      type: 'investmentAccount',
      id: 'i1',
    });
    expect(resolveIncomeAssetKey({ propertyId: null, investmentAccountId: null })).toBeNull();
  });
  it('expense: property > investmentAccount > asset > loan', () => {
    expect(
      resolveExpenseAssetKey({ propertyId: 'p1', loanId: 'l1', investmentAccountId: 'i1', assetId: 'a1' }),
    ).toEqual({ type: 'property', id: 'p1' });
    expect(
      resolveExpenseAssetKey({ propertyId: null, loanId: 'l1', investmentAccountId: null, assetId: 'a1' }),
    ).toEqual({ type: 'asset', id: 'a1' });
    expect(
      resolveExpenseAssetKey({ propertyId: null, loanId: 'l1', investmentAccountId: null, assetId: null }),
    ).toEqual({ type: 'loan', id: 'l1' });
    expect(
      resolveExpenseAssetKey({ propertyId: null, loanId: null, investmentAccountId: null, assetId: null }),
    ).toBeNull();
  });
});
