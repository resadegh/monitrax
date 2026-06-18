/**
 * Phase 4 · Layer 2 — golden-master regression.
 *
 * For each of the six canonical ownership archetypes, run the canonical
 * engines and snapshot their output. The committed snapshots are captured
 * FROM the engines (vitest `toMatchSnapshot` serializes the actual return) —
 * NO number in the expectation is hand-authored (CLAUDE.md §2 / §12.3, and
 * the Phase-4 directive: "Snapshots come FROM the engine"). An unexpected
 * snapshot change is a regression signal; an intended engine change updates
 * the snapshot in the same PR (and should be explained in review).
 *
 * Engines covered (the four the directive names):
 *   - net worth   → calculateNetWorth  (+ per-entity via ownerEntityId filter)
 *   - cashflow    → calculateCashflow
 *   - per-entity  → buildEntityBreakdown (net worth + cashflow per entity)
 *   - CGT split   → computePropertyDisposalCgt (per-owner discount + share)
 */

import { describe, it, expect } from 'vitest';
import {
  calculateNetWorth,
  calculateTotalAssets,
  calculateTotalLiabilities,
} from '@/lib/calculations/netWorthCalculator';
import { calculateCashflow } from '@/lib/calculations/cashflowOrchestrator';
import { buildEntityBreakdown } from '@/lib/calculations/entityBreakdown';
import {
  computePropertyDisposalCgt,
  type PropertyDisposalCgtResult,
} from '@/lib/cfo/scenarios/propertyDisposalCgt';
import { getCurrentTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';
import { ARCHETYPES, type Archetype } from './archetypes';

const CONFIG = getCurrentTaxYearConfig();
const DISPOSAL_DATE = new Date('2026-06-15T00:00:00Z'); // fixed → deterministic monthsHeld

/** Net worth for the whole household + each entity (via the canonical filter). */
function netWorthSnapshot(a: Archetype) {
  const whole = calculateNetWorth(
    a.properties, a.accounts, a.investments, a.loans, a.superannuation, a.personalAssets,
  );
  const perEntity = a.entities.map((e) => {
    const assets = calculateTotalAssets(
      a.properties, a.accounts, a.investments, a.superannuation, a.personalAssets, e.id,
    );
    const liabilities = calculateTotalLiabilities(a.loans, e.id);
    return { entityId: e.id, assets, liabilities, netWorth: assets.total - liabilities.total };
  });
  return { whole, perEntity };
}

/** Map the archetype rows into the buildEntityBreakdown input contract. */
function entityBreakdownSnapshot(a: Archetype) {
  return buildEntityBreakdown({
    entities: a.entities,
    properties: a.properties.map((p) => ({ currentValue: p.currentValue, ownerEntityId: p.ownerEntityId })),
    accounts: a.accounts.map((ac) => ({ currentBalance: ac.currentBalance, type: ac.type, ownerEntityId: ac.ownerEntityId })),
    investmentHoldings: a.investments.map((inv) => ({
      investmentAccount: { ownerEntityId: inv.ownerEntityId ?? null },
      units: inv.units,
      currentPrice: inv.currentPrice ?? null,
      averagePrice: inv.averagePrice ?? 0,
    })),
    loans: a.loans.map((l) => ({ principal: l.principal, type: l.type ?? '', propertyId: l.propertyId ?? null, ownerEntityId: l.ownerEntityId })),
    superannuation: a.superannuation.map((s) => ({ currentBalance: s.balance, fundType: s.fundType ?? undefined, ownerEntityId: s.ownerEntityId })),
    assets: a.personalAssets.map((as) => ({ currentValue: as.currentValue, ownerEntityId: as.ownerEntityId })),
    income: a.income.map((i) => ({ amount: i.amount, frequency: i.frequency, ownerEntityId: i.ownerEntityId })),
    expenses: a.expenses.map((e) => ({ amount: e.amount, frequency: e.frequency, ownerEntityId: e.ownerEntityId })),
  });
}

/** Project the CGT result's Decimals to plain numbers — still engine output. */
function projectCgt(r: PropertyDisposalCgtResult) {
  const n = (d: { toNumber: () => number } | null) => (d == null ? null : d.toNumber());
  return {
    costBase: r.costBase.toNumber(),
    totalNominalGain: r.totalNominalGain.toNumber(),
    totalTaxableGain: r.totalTaxableGain.toNumber(),
    isCapitalLoss: r.isCapitalLoss,
    yourEstimatedTax: r.yourEstimatedTax.toNumber(),
    owners: r.owners.map((o) => ({
      entityId: o.entityId,
      name: o.name,
      entityType: o.entityType,
      isYou: o.isYou,
      weight: o.weight,
      nominalGainShare: o.nominalGainShare.toNumber(),
      discountRate: o.discountRate.toNumber(),
      taxableGain: o.taxableGain.toNumber(),
      metHoldingPeriod: o.metHoldingPeriod,
      estimatedTax: n(o.estimatedTax),
      reason: o.reason,
    })),
    flags: r.flags.map((f) => f.id),
  };
}

function cgtSnapshot(a: Archetype) {
  const d = a.disposal;
  return projectCgt(
    computePropertyDisposalCgt({
      proceeds: d.proceeds,
      sellingCosts: d.sellingCosts,
      costBase: d.costBase,
      acquisitionDate: d.acquisitionDate,
      disposalDate: DISPOSAL_DATE,
      disposalFy: CONFIG.financialYear,
      config: CONFIG,
      owners: d.owners,
      userMarginalRate: d.userMarginalRate,
    }),
  );
}

describe('golden-master regression — canonical engine outputs per archetype', () => {
  for (const a of ARCHETYPES) {
    describe(`${a.key} — ${a.label}`, () => {
      it('net worth (household + per-entity) matches the golden master', () => {
        expect(netWorthSnapshot(a)).toMatchSnapshot();
      });
      it('cashflow matches the golden master', () => {
        expect(calculateCashflow({ income: a.income, expenses: a.expenses, loans: a.cashflowLoans }))
          .toMatchSnapshot();
      });
      it('per-entity breakdown matches the golden master', () => {
        expect(entityBreakdownSnapshot(a)).toMatchSnapshot();
      });
      it('per-entity CGT split matches the golden master', () => {
        expect(cgtSnapshot(a)).toMatchSnapshot();
      });
    });
  }
});
