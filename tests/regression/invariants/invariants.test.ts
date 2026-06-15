/**
 * Phase 4 · Layer 3 — invariant / property checks.
 *
 * Properties that must hold for EVERY portfolio, checked over the six golden
 * archetypes plus a seeded pseudo-random sweep (deterministic — no new dep).
 * These are laws of the engines, not snapshots:
 *
 *   1. net worth == assets − liabilities, across ALL read-paths
 *      (canonical Float, canonical Decimal, buildEntityBreakdown, and the
 *       #1113 unified valuation helpers).
 *   2. per-entity ownership shares sum to 100%; per-entity value (legal title)
 *      reconciles to the household total.
 *   3. Float / Decimal siblings agree at the boundary.
 *   4. D6 CGT: each owner's share + discount matches attributeAsset +
 *      calculateCgtDiscountDecimal.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateNetWorth,
  calculateTotalAssets,
  calculateTotalLiabilities,
  calculateNetWorthDecimal,
  type PropertyInput,
  type AccountInput,
  type InvestmentInput,
  type SuperInput,
  type AssetInput,
  type LoanInput,
} from '@/lib/calculations/netWorthCalculator';
import { calculateCashflow, calculateCashflowDecimal } from '@/lib/calculations/cashflowOrchestrator';
import { buildEntityBreakdown } from '@/lib/calculations/entityBreakdown';
import {
  holdingMarketValue,
  sumHoldingsMarketValue,
  sumLoanBalances,
} from '@/lib/calculations/assetValuation';
import {
  attributeAsset,
  type AssetOwnershipContext,
} from '@/lib/services/ownershipAttribution';
import { computePropertyDisposalCgt } from '@/lib/cfo/scenarios/propertyDisposalCgt';
import { calculateCgtDiscountDecimal } from '@/lib/tax-engine/divisions/cgtDiscount';
import { getCurrentTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';
import { ARCHETYPES } from '../golden-master/archetypes';

const CONFIG = getCurrentTaxYearConfig();
const DISPOSAL_DATE = new Date('2026-06-15T00:00:00Z');

// ---- deterministic PRNG (mulberry32) → reproducible "property" inputs ----
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Portfolio {
  entityIds: string[];
  properties: Array<PropertyInput & { currentValue: number }>;
  accounts: Array<AccountInput & { currentBalance: number; type: string }>;
  investments: InvestmentInput[];
  superannuation: SuperInput[];
  personalAssets: AssetInput[];
  loans: Array<LoanInput & { principal: number }>;
}

function randomPortfolio(seed: number): Portfolio {
  const r = rng(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]!;
  const amt = (max: number) => Math.round(r() * max);
  const entityIds = ['you', 'spouse', 'trust', 'co', 'smsf'].slice(0, 1 + Math.floor(r() * 5));
  const owner = () => pick(entityIds);
  const loanTypes = ['HOME', 'INVESTMENT', 'PERSONAL', 'CREDIT_CARD'];
  const acctTypes = ['SAVINGS', 'OFFSET', 'TRANSACTION'];
  // RETAIL/INDUSTRY only (not SMSF) so the per-entity reconciliation isn't
  // perturbed by the global SMSF super-exclusion in a way the test must model.
  const superTypes = ['RETAIL', 'INDUSTRY'] as const;
  return {
    entityIds,
    properties: Array.from({ length: Math.floor(r() * 4) }, () => ({ currentValue: amt(1_500_000), type: 'HOME', ownerEntityId: owner() })),
    accounts: Array.from({ length: Math.floor(r() * 4) }, () => ({ currentBalance: amt(200_000), type: pick(acctTypes), ownerEntityId: owner() })),
    investments: Array.from({ length: Math.floor(r() * 4) }, () => ({ units: amt(5000), currentPrice: 1 + amt(80), averagePrice: 1 + amt(60), ownerEntityId: owner() })),
    superannuation: Array.from({ length: Math.floor(r() * 3) }, () => ({ balance: amt(600_000), fundType: pick(superTypes as unknown as string[]) as SuperInput['fundType'], ownerEntityId: owner() })),
    personalAssets: Array.from({ length: Math.floor(r() * 3) }, () => ({ currentValue: amt(100_000), ownerEntityId: owner() })),
    loans: Array.from({ length: Math.floor(r() * 4) }, () => ({ principal: amt(800_000), type: pick(loanTypes), propertyId: null, ownerEntityId: owner() })),
  };
}

const ARCHETYPE_PORTFOLIOS: Array<{ name: string; p: Portfolio }> = ARCHETYPES.map((a) => ({
  name: a.key,
  p: {
    entityIds: a.entities.map((e) => e.id),
    properties: a.properties,
    accounts: a.accounts,
    investments: a.investments,
    superannuation: a.superannuation,
    personalAssets: a.personalAssets,
    loans: a.loans,
  },
}));
const RANDOM_PORTFOLIOS = Array.from({ length: 40 }, (_, i) => ({ name: `seed-${i}`, p: randomPortfolio(i * 2654435761 + 1) }));
const ALL = [...ARCHETYPE_PORTFOLIOS, ...RANDOM_PORTFOLIOS];

describe('Invariant 1 — net worth == assets − liabilities across all read-paths', () => {
  it.each(ALL)('$name — canonical Float identity', ({ p }) => {
    const nw = calculateNetWorth(p.properties, p.accounts, p.investments, p.loans, p.superannuation, p.personalAssets);
    expect(nw.netWorth).toBeCloseTo(nw.assets.total - nw.liabilities.total, 6);
  });

  it.each(ALL)('$name — canonical Decimal identity + agrees with Float', ({ p }) => {
    const nw = calculateNetWorth(p.properties, p.accounts, p.investments, p.loans, p.superannuation, p.personalAssets);
    const d = calculateNetWorthDecimal(p.properties, p.accounts, p.investments, p.loans, p.superannuation, p.personalAssets);
    expect(d.netWorth.toNumber()).toBeCloseTo(d.assets.total.minus(d.liabilities.total).toNumber(), 6);
    expect(d.netWorth.toNumber()).toBeCloseTo(nw.netWorth, 4); // Float/Decimal agree at the boundary
  });

  it.each(ALL)('$name — #1113 valuation helpers agree with the canonical engine', ({ p }) => {
    // holdings: helper sum === canonical investments component
    const canonicalInvestments = calculateTotalAssets([], [], p.investments, [], []).investments;
    expect(sumHoldingsMarketValue(p.investments)).toBeCloseTo(canonicalInvestments, 6);
    expect(sumHoldingsMarketValue(p.investments)).toBeCloseTo(p.investments.reduce((s, h) => s + holdingMarketValue(h), 0), 6);
    // loans: helper sum === canonical liabilities total (Σ principal, regardless of type split)
    expect(sumLoanBalances(p.loans)).toBeCloseTo(calculateTotalLiabilities(p.loans).total, 6);
  });
});

describe('Invariant 2 — per-entity (legal title) reconciles to the household total', () => {
  it.each(ALL)('$name — Σ per-entity assets/liabilities/net worth == household', ({ p }) => {
    const whole = calculateNetWorth(p.properties, p.accounts, p.investments, p.loans, p.superannuation, p.personalAssets);
    let aSum = 0, lSum = 0, nSum = 0;
    for (const id of p.entityIds) {
      const a = calculateTotalAssets(p.properties, p.accounts, p.investments, p.superannuation, p.personalAssets, id);
      const l = calculateTotalLiabilities(p.loans, id);
      aSum += a.total; lSum += l.total; nSum += a.total - l.total;
    }
    expect(aSum).toBeCloseTo(whole.assets.total, 4);
    expect(lSum).toBeCloseTo(whole.liabilities.total, 4);
    expect(nSum).toBeCloseTo(whole.netWorth, 4);
  });

  it.each(ALL)('$name — buildEntityBreakdown sums to the household net worth', ({ p }) => {
    const whole = calculateNetWorth(p.properties, p.accounts, p.investments, p.loans, p.superannuation, p.personalAssets);
    const rows = buildEntityBreakdown({
      entities: p.entityIds.map((id) => ({ id, name: id, type: 'PERSONAL_NAME' })),
      properties: p.properties.map((x) => ({ currentValue: x.currentValue, ownerEntityId: x.ownerEntityId })),
      accounts: p.accounts.map((x) => ({ currentBalance: x.currentBalance, type: x.type, ownerEntityId: x.ownerEntityId })),
      investmentHoldings: p.investments.map((x) => ({ investmentAccount: { ownerEntityId: x.ownerEntityId ?? null }, units: x.units, currentPrice: x.currentPrice ?? null, averagePrice: x.averagePrice ?? 0 })),
      loans: p.loans.map((x) => ({ principal: x.principal, type: x.type ?? '', propertyId: x.propertyId ?? null, ownerEntityId: x.ownerEntityId })),
      superannuation: p.superannuation.map((x) => ({ currentBalance: x.balance, fundType: x.fundType ?? undefined, ownerEntityId: x.ownerEntityId })),
      assets: p.personalAssets.map((x) => ({ currentValue: x.currentValue, ownerEntityId: x.ownerEntityId })),
      income: [], expenses: [],
    });
    const sum = rows.reduce((s, row) => s + row.netWorth, 0);
    expect(sum).toBeCloseTo(whole.netWorth, 4);
  });
});

describe('Invariant 2b — ownership shares sum to 100% (attributeAsset)', () => {
  it('joint tenants split equally and sum to 1', () => {
    const members = ['you', 'spouse', 'child'];
    const ctx: AssetOwnershipContext = {
      legalOwnerEntityId: 'you',
      group: { tenancyType: 'JOINT_TENANTS', stakes: members.map((entityId) => ({ entityId, sharePct: null })) } as AssetOwnershipContext['group'],
    };
    const sum = members.reduce((s, m) => s + attributeAsset(m, ctx).weight, 0);
    expect(sum).toBeCloseTo(1, 9);
  });

  it('tenants-in-common follow sharePct and sum to 1', () => {
    const stakes = [{ entityId: 'you', sharePct: 60 }, { entityId: 'trust', sharePct: 40 }];
    const ctx: AssetOwnershipContext = {
      legalOwnerEntityId: 'you',
      group: { tenancyType: 'TENANTS_IN_COMMON', stakes } as AssetOwnershipContext['group'],
    };
    const sum = stakes.reduce((s, st) => s + attributeAsset(st.entityId, ctx).weight, 0);
    expect(sum).toBeCloseTo(1, 9);
    expect(attributeAsset('you', ctx).weight).toBeCloseTo(0.6, 9);
  });

  it('no group/override → legal owner holds 100%, others 0%', () => {
    const ctx: AssetOwnershipContext = { legalOwnerEntityId: 'you' };
    expect(attributeAsset('you', ctx).weight).toBe(1);
    expect(attributeAsset('spouse', ctx).weight).toBe(0);
  });

  it('beneficial override redirects the whole 100% to the beneficial owner', () => {
    const ctx: AssetOwnershipContext = {
      legalOwnerEntityId: 'you',
      override: { legalOwnerEntityId: 'you', beneficialOwnerEntityId: 'trust', basis: 'bare-trust' },
    };
    expect(attributeAsset('trust', ctx).weight).toBe(1);
    expect(attributeAsset('you', ctx).weight).toBe(0);
  });
});

describe('Invariant 3 — Float / Decimal cashflow agree at the boundary', () => {
  it.each(ARCHETYPES.map((a) => [a.key, a] as const))('%s — monthly figures agree', (_k, a) => {
    const input = { income: a.income, expenses: a.expenses, loans: a.cashflowLoans };
    const f = calculateCashflow(input);
    const d = calculateCashflowDecimal(input);
    // MONTHLY-frequency sums carry no division → exact agreement.
    expect(d.monthlyExpenses.toNumber()).toBeCloseTo(f.monthlyExpenses, 6);
    expect(d.monthlyLoanRepayments.toNumber()).toBeCloseTo(f.monthlyLoanRepayments, 6);
    expect(d.monthlyGrossIncome.toNumber()).toBeCloseTo(f.monthlyGrossIncome, 6);
    // Net / cashflow carry a PAYG estimate (÷) → agree within the Float 2dp rounding.
    expect(d.monthlyCashflow.toNumber()).toBeCloseTo(f.monthlyCashflow, 1);
    expect(d.annualCashflow.toNumber()).toBeCloseTo(f.annualCashflow, 0);
  });
});

describe('Invariant 4 — D6 CGT split matches attributeAsset + calculateCgtDiscountDecimal', () => {
  // strict whole-months elapsed — same convention as the engine (s115-25).
  function monthsHeldStrict(from: Date, to: Date): number {
    let m = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
    if (to.getUTCDate() <= from.getUTCDate()) m -= 1;
    return Math.max(0, m);
  }

  it.each(ARCHETYPES.map((a) => [a.key, a] as const))('%s — discount + share reconcile to the canonical engines', (_k, a) => {
    const d = a.disposal;
    const r = computePropertyDisposalCgt({
      proceeds: d.proceeds, sellingCosts: d.sellingCosts, costBase: d.costBase,
      acquisitionDate: d.acquisitionDate, disposalDate: DISPOSAL_DATE,
      disposalFy: CONFIG.financialYear, config: CONFIG, owners: d.owners, userMarginalRate: d.userMarginalRate,
    });
    const months = monthsHeldStrict(d.acquisitionDate, DISPOSAL_DATE);

    // shares sum to 1 and the nominal gain splits exactly
    const weightSum = d.owners.reduce((s, o) => s + o.weight, 0);
    expect(weightSum).toBeCloseTo(1, 9);
    const shareSum = r.owners.reduce((s, o) => s + o.nominalGainShare.toNumber(), 0);
    expect(shareSum).toBeCloseTo(r.totalNominalGain.toNumber(), 4);

    for (const owner of r.owners) {
      // the discount + discounted gain must equal the canonical Div 115 engine
      const expected = calculateCgtDiscountDecimal({
        entityType: owner.entityType,
        monthsHeld: months,
        nominalGain: owner.nominalGainShare,
        isComplying: true,
        isForeignResident: false,
        acquisitionContractDate: d.acquisitionDate,
        disposalFy: CONFIG.financialYear,
        config: CONFIG,
      });
      expect(owner.discountRate.toNumber()).toBeCloseTo(expected.discountRate.toNumber(), 9);
      expect(owner.taxableGain.toNumber()).toBeCloseTo(expected.discountedGain.toNumber(), 6);
      // taxable == nominal × (1 − discount)
      expect(owner.taxableGain.toNumber()).toBeCloseTo(owner.nominalGainShare.toNumber() * (1 - owner.discountRate.toNumber()), 4);
    }
  });
});
