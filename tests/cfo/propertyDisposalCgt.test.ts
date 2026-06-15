/**
 * Phase 47 Stage D · D6 — per-entity CGT on a property disposal.
 *
 * Verifies the What-If `sellProperty` lever now splits the capital gain across
 * the property's legal owners (TR 93/32) and applies each owner's entity CGT
 * discount (Div 115) — instead of the prior single-taxpayer "CGT may apply"
 * flag — while keeping the honesty boundary: only the user's own share is
 * estimated to a tax dollar; co-owners show their taxable gain only.
 */

import { describe, it, expect } from 'vitest';
import {
  computePropertyDisposalCgt,
  resolvePropertyOwners,
  toCgtEntityType,
  type PropertyOwner,
} from '@/lib/cfo/scenarios/propertyDisposalCgt';
import { getCurrentTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';
import { sellPropertyScenarioDecimal } from '@/lib/cfo/scenarios/sellProperty';
import type { ScenarioContext } from '@/lib/cfo/scenarios/types';
import type { MasterFinancialSnapshot } from '@/lib/services/masterFinancialService';

const CONFIG = getCurrentTaxYearConfig();
const FY = CONFIG.financialYear;
const NOW = new Date('2026-06-15T00:00:00Z');
const THREE_YEARS_AGO = new Date('2023-06-01T00:00:00Z'); // > 12 months
const TWO_MONTHS_AGO = new Date('2026-04-15T00:00:00Z'); // < 12 months

function owner(over: Partial<PropertyOwner> & Pick<PropertyOwner, 'entityId' | 'entityType'>): PropertyOwner {
  return {
    name: over.name ?? over.entityId,
    isYou: over.isYou ?? false,
    isComplying: over.isComplying ?? true,
    isForeignResident: over.isForeignResident ?? false,
    ...over,
  };
}

describe('computePropertyDisposalCgt — per-entity discount + split', () => {
  it('sole individual, held > 12 months → 50% discount + marginal-rate estimate for you', () => {
    const r = computePropertyDisposalCgt({
      proceeds: 1_000_000,
      sellingCosts: 0,
      costBase: 700_000,
      acquisitionDate: THREE_YEARS_AGO,
      disposalDate: NOW,
      disposalFy: FY,
      config: CONFIG,
      owners: [{ ...owner({ entityId: 'you', entityType: 'PERSONAL_NAME', isYou: true, name: 'You' }), weight: 1 }],
      userMarginalRate: 0.39,
    });
    expect(r.totalNominalGain.toNumber()).toBe(300_000);
    expect(r.isCapitalLoss).toBe(false);
    const you = r.owners[0]!;
    expect(you.discountRate.toNumber()).toBeCloseTo(0.5, 6);
    expect(you.taxableGain.toNumber()).toBe(150_000);
    // est tax = taxable 150k × 0.39
    expect(you.estimatedTax!.toNumber()).toBeCloseTo(58_500, 2);
    expect(r.yourEstimatedTax.toNumber()).toBeCloseTo(58_500, 2);
  });

  it('joint tenants (you + spouse) → 50/50 split; only your share gets a tax estimate', () => {
    const r = computePropertyDisposalCgt({
      proceeds: 1_000_000,
      sellingCosts: 0,
      costBase: 600_000,
      acquisitionDate: THREE_YEARS_AGO,
      disposalDate: NOW,
      disposalFy: FY,
      config: CONFIG,
      owners: [
        { ...owner({ entityId: 'you', entityType: 'PERSONAL_NAME', isYou: true, name: 'You' }), weight: 0.5 },
        { ...owner({ entityId: 'spouse', entityType: 'PERSONAL_NAME', name: 'Sarah' }), weight: 0.5 },
      ],
      userMarginalRate: 0.37,
    });
    expect(r.owners).toHaveLength(2);
    const you = r.owners.find((o) => o.isYou)!;
    const spouse = r.owners.find((o) => !o.isYou)!;
    // each share of the 400k gain = 200k nominal → 100k taxable after 50%
    expect(you.nominalGainShare.toNumber()).toBe(200_000);
    expect(you.taxableGain.toNumber()).toBe(100_000);
    expect(spouse.taxableGain.toNumber()).toBe(100_000);
    // your tax estimated; spouse's is NOT fabricated
    expect(you.estimatedTax!.toNumber()).toBeCloseTo(37_000, 2);
    expect(spouse.estimatedTax).toBeNull();
    expect(spouse.estimatedTaxBasis).toMatch(/own return/i);
    // total "your tax" only counts your share
    expect(r.yourEstimatedTax.toNumber()).toBeCloseTo(37_000, 2);
  });

  it('tenants in common 70/30 follows the recorded shares', () => {
    const r = computePropertyDisposalCgt({
      proceeds: 1_000_000,
      sellingCosts: 0,
      costBase: 800_000,
      acquisitionDate: THREE_YEARS_AGO,
      disposalDate: NOW,
      disposalFy: FY,
      config: CONFIG,
      owners: [
        { ...owner({ entityId: 'you', entityType: 'PERSONAL_NAME', isYou: true }), weight: 0.7 },
        { ...owner({ entityId: 'sib', entityType: 'PERSONAL_NAME' }), weight: 0.3 },
      ],
      userMarginalRate: 0.45,
    });
    // 200k gain → your 70% = 140k nominal, 70k taxable
    expect(r.owners.find((o) => o.isYou)!.taxableGain.toNumber()).toBe(70_000);
    expect(r.owners.find((o) => !o.isYou)!.nominalGainShare.toNumber()).toBe(60_000);
  });

  it('SMSF owner → 33⅓% discount, no fabricated tax (fund-rate basis note)', () => {
    const r = computePropertyDisposalCgt({
      proceeds: 1_000_000,
      sellingCosts: 0,
      costBase: 700_000,
      acquisitionDate: THREE_YEARS_AGO,
      disposalDate: NOW,
      disposalFy: FY,
      config: CONFIG,
      owners: [{ ...owner({ entityId: 'smsf', entityType: 'SMSF', name: 'My SMSF' }), weight: 1 }],
      userMarginalRate: 0.39,
    });
    const o = r.owners[0]!;
    expect(o.discountRate.toNumber()).toBeCloseTo(1 / 3, 4);
    expect(o.taxableGain.toNumber()).toBeCloseTo(200_000, 2); // 300k × (1 − 1/3)
    expect(o.estimatedTax).toBeNull();
    expect(o.estimatedTaxBasis).toMatch(/15%/);
    expect(r.yourEstimatedTax.toNumber()).toBe(0);
  });

  it('company owner → 0% discount, full nominal gain taxable, company-rate basis', () => {
    const r = computePropertyDisposalCgt({
      proceeds: 1_000_000,
      sellingCosts: 0,
      costBase: 700_000,
      acquisitionDate: THREE_YEARS_AGO,
      disposalDate: NOW,
      disposalFy: FY,
      config: CONFIG,
      owners: [{ ...owner({ entityId: 'co', entityType: 'COMPANY', name: 'Bucket Co' }), weight: 1 }],
      userMarginalRate: 0.39,
    });
    const o = r.owners[0]!;
    expect(o.discountRate.toNumber()).toBe(0);
    expect(o.taxableGain.toNumber()).toBe(300_000);
    expect(o.estimatedTaxBasis).toMatch(/company rate/i);
  });

  it('held < 12 months → no discount for any entity', () => {
    const r = computePropertyDisposalCgt({
      proceeds: 1_000_000,
      sellingCosts: 0,
      costBase: 700_000,
      acquisitionDate: TWO_MONTHS_AGO,
      disposalDate: NOW,
      disposalFy: FY,
      config: CONFIG,
      owners: [{ ...owner({ entityId: 'you', entityType: 'PERSONAL_NAME', isYou: true }), weight: 1 }],
      userMarginalRate: 0.39,
    });
    const o = r.owners[0]!;
    expect(o.metHoldingPeriod).toBe(false);
    expect(o.discountRate.toNumber()).toBe(0);
    expect(o.taxableGain.toNumber()).toBe(300_000);
  });

  it('capital loss → no CGT, flagged as a loss', () => {
    const r = computePropertyDisposalCgt({
      proceeds: 600_000,
      sellingCosts: 15_000,
      costBase: 700_000,
      acquisitionDate: THREE_YEARS_AGO,
      disposalDate: NOW,
      disposalFy: FY,
      config: CONFIG,
      owners: [{ ...owner({ entityId: 'you', entityType: 'PERSONAL_NAME', isYou: true }), weight: 1 }],
      userMarginalRate: 0.39,
    });
    expect(r.isCapitalLoss).toBe(true);
    expect(r.yourEstimatedTax.toNumber()).toBe(0);
    expect(r.owners[0]!.reason).toMatch(/capital loss/i);
  });

  it('§12.14 FW-2 — post-reform acquisition surfaces UNCOMPUTED, never a silent discount', () => {
    const reformConfig = { ...CONFIG, cgtIndexationCommencementVerified: true };
    const r = computePropertyDisposalCgt({
      proceeds: 1_000_000,
      sellingCosts: 0,
      costBase: 700_000,
      acquisitionDate: new Date('2026-06-01T00:00:00Z'), // after the 12 May 2026 cut-over
      disposalDate: new Date('2027-09-01T00:00:00Z'),
      disposalFy: '2027-28',
      config: reformConfig,
      owners: [{ ...owner({ entityId: 'you', entityType: 'PERSONAL_NAME', isYou: true }), weight: 1 }],
      userMarginalRate: 0.39,
    });
    expect(r.flags.some((f) => f.id === 'UC-CGT-POST-REFORM')).toBe(true);
    // no fabricated post-reform tax dollar
    expect(r.owners[0]!.estimatedTax).toBeNull();
  });
});

describe('resolvePropertyOwners — AD-2 attribution reuse', () => {
  it('joint tenants split equally', () => {
    const { owners } = resolvePropertyOwners({
      ownershipContext: {
        legalOwnerEntityId: 'you',
        group: {
          tenancyType: 'JOINT_TENANTS',
          stakes: [
            { entityId: 'you', sharePct: null },
            { entityId: 'spouse', sharePct: null },
          ],
        },
      },
      candidates: [
        owner({ entityId: 'you', entityType: 'PERSONAL_NAME', isYou: true }),
        owner({ entityId: 'spouse', entityType: 'PERSONAL_NAME' }),
      ],
    });
    expect(owners).toHaveLength(2);
    expect(owners.every((o) => Math.abs(o.weight - 0.5) < 1e-9)).toBe(true);
  });

  it('beneficial override redirects the whole gain to the beneficial owner', () => {
    const { owners } = resolvePropertyOwners({
      ownershipContext: {
        legalOwnerEntityId: 'baretrustee',
        override: {
          legalOwnerEntityId: 'baretrustee',
          beneficialOwnerEntityId: 'smsf',
          basis: 'BARE_TRUST',
        },
      },
      candidates: [
        owner({ entityId: 'baretrustee', entityType: 'DISCRETIONARY_TRUST' }),
        owner({ entityId: 'smsf', entityType: 'SMSF' }),
      ],
    });
    // legal owner drops to 0; beneficial owner takes 100%
    expect(owners).toHaveLength(1);
    expect(owners[0]!.entityId).toBe('smsf');
    expect(owners[0]!.weight).toBe(1);
  });

  it('no group/override → legal owner keeps 100%', () => {
    const { owners } = resolvePropertyOwners({
      ownershipContext: { legalOwnerEntityId: 'you' },
      candidates: [owner({ entityId: 'you', entityType: 'PERSONAL_NAME', isYou: true })],
    });
    expect(owners).toHaveLength(1);
    expect(owners[0]!.weight).toBe(1);
  });
});

describe('toCgtEntityType — LegalEntityType → discount domain', () => {
  it('maps individuals, trusts, companies, SMSF correctly', () => {
    expect(toCgtEntityType('PERSONAL_NAME')).toEqual({ type: 'PERSONAL_NAME', approximated: false });
    expect(toCgtEntityType('INDIVIDUAL')).toEqual({ type: 'PERSONAL_NAME', approximated: false });
    expect(toCgtEntityType('DISCRETIONARY_TRUST')).toEqual({ type: 'DISCRETIONARY_TRUST', approximated: false });
    expect(toCgtEntityType('SMSF')).toEqual({ type: 'SMSF', approximated: false });
    expect(toCgtEntityType('COMPANY')).toEqual({ type: 'COMPANY', approximated: false });
  });

  it('maps extended trust-family types to the trust 50% domain (approximated)', () => {
    expect(toCgtEntityType('BARE_TRUST')).toEqual({ type: 'DISCRETIONARY_TRUST', approximated: true });
    expect(toCgtEntityType('FIXED_TRUST')).toEqual({ type: 'DISCRETIONARY_TRUST', approximated: true });
  });
});

describe('sellPropertyScenarioDecimal — D6 end-to-end CGT wiring', () => {
  function snapshotWith(): MasterFinancialSnapshot {
    return {
      properties: [
        {
          id: 'prop-1',
          name: 'Smith St IP',
          currentValue: 1_000_000,
          purchasePrice: 700_000,
          loanBalance: 400_000,
          equity: 600_000,
          lvr: 40,
          annualRentalIncome: 0,
          rentalYield: 0,
          monthlyExpenses: 0,
          monthlyCashflow: 0,
          capitalGrowth: 0,
          capitalGrowthPercent: 0,
        },
      ],
      quickMetrics: { monthlyCashflow: 2_000, liquidCash: 50_000 },
      netWorth: { netWorth: 1_200_000 },
      propertyPortfolioValue: 1_000_000,
    } as unknown as MasterFinancialSnapshot;
  }

  function contextFor(): ScenarioContext {
    return {
      snapshot: snapshotWith(),
      taxConfig: CONFIG,
      currentFy: FY,
      userMarginalRate: 0.39,
      propertyTaxContexts: [
        {
          propertyId: 'prop-1',
          costBase: 700_000,
          acquisitionDate: THREE_YEARS_AGO.toISOString(),
          legalOwnerEntityId: 'you',
          owners: [owner({ entityId: 'you', entityType: 'PERSONAL_NAME', isYou: true, name: 'You' })],
        },
      ],
    };
  }

  it('surfaces an "Estimated CGT (your share)" impact + after-CGT net worth', () => {
    const r = sellPropertyScenarioDecimal(contextFor(), { propertyId: 'prop-1' });
    const cgtImpact = r.impacts.find((i) => i.label === 'Estimated CGT (your share)');
    expect(cgtImpact).toBeDefined();
    // 1M − 25k selling costs − 700k = 275k gain → 137.5k taxable → ×0.39 ≈ 53,625
    expect(cgtImpact!.delta.toNumber()).toBeCloseTo(-53_625, 0);
    expect(r.impacts.some((i) => i.label === 'Net worth (after est. CGT)')).toBe(true);
  });

  it('replaces the generic CGT flag with a real per-owner breakdown', () => {
    const r = sellPropertyScenarioDecimal(contextFor(), { propertyId: 'prop-1' });
    // the old single-line "Capital Gains Tax may apply" flag is gone
    expect(r.warnings.some((w) => /Capital Gains Tax may apply/.test(w.message))).toBe(false);
    // replaced with the estimated-on-your-share line + a per-owner assumption
    expect(r.warnings.some((w) => /Estimated CGT on your share/.test(w.message))).toBe(true);
    expect(r.assumptions.some((a) => /taxable after 50% discount/.test(a))).toBe(true);
  });

  it('falls back to the prior CGT flag when no context is supplied', () => {
    const r = sellPropertyScenarioDecimal({ snapshot: snapshotWith() }, { propertyId: 'prop-1' });
    expect(r.warnings.some((w) => /Capital Gains Tax may apply/.test(w.message))).toBe(true);
    expect(r.impacts.some((i) => i.label === 'Estimated CGT (your share)')).toBe(false);
  });
});
