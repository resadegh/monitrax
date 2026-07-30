/**
 * Phase 47 Stage C1 — entity breakdown additivity invariant.
 *
 * THE non-breaking contract of the Entity Ownership Fabric: the
 * per-entity view must SUM to exactly what the canonical engines
 * produce over the same un-partitioned rows. If this ever fails, the
 * dashboard's flat household totals and the entity lens disagree —
 * reject the change.
 */

import { describe, it, expect } from 'vitest';
import {
  buildEntityBreakdown,
  UNATTRIBUTED_ENTITY_ID,
  type EntityBreakdownInput,
} from '@/lib/calculations/entityBreakdown';
import { calculateNetWorth } from '@/lib/calculations/netWorthCalculator';
import { buildBankedIncome } from '@/lib/income/banked/aggregator';
import { bankedMonthlyPerRow } from '@/lib/income/banked/assembly';
import { getCurrentTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';

// MON-131 T1-B: per-entity income reads the banked per-row attribution (the
// ONE producer). The fixture runs the REAL banked engine to build the map —
// OTHER-type rows bank at their declared run-rate, so the arithmetic the
// tests assert is unchanged.
const INCOME_ROWS = [
  { id: 'inc-you', type: 'OTHER', amount: 5_000, frequency: 'MONTHLY', isTaxable: true, ownerEntityId: 'you' },
  { id: 'inc-trust', type: 'OTHER', amount: 600, frequency: 'WEEKLY', isTaxable: true, ownerEntityId: 'trust' },
];
const bankedMap = () => {
  const banked = buildBankedIncome({
    income: INCOME_ROWS,
    properties: [],
    derivedAgentExpenses: [],
    transactions: [],
    ctx: { config: getCurrentTaxYearConfig(), repaymentIncome: null },
  });
  return bankedMonthlyPerRow(banked, INCOME_ROWS);
};

const input = (): EntityBreakdownInput => ({
  entities: [
    { id: 'you', name: 'Reza', type: 'PERSONAL_NAME' },
    { id: 'trust', name: 'Family Trust', type: 'DISCRETIONARY_TRUST' },
  ],
  properties: [
    { ownerEntityId: 'you', currentValue: 750_000 },
    { ownerEntityId: 'trust', currentValue: 1_650_000 },
  ],
  accounts: [
    { ownerEntityId: 'you', currentBalance: 40_000, type: 'SAVINGS' },
    { ownerEntityId: 'trust', currentBalance: 12_000, type: 'OFFSET' },
  ],
  investmentHoldings: [
    { investmentAccount: { ownerEntityId: 'you' }, units: 100, currentPrice: 50, averagePrice: 40 },
  ],
  loans: [
    { ownerEntityId: 'trust', principal: 1_400_000, type: 'MORTGAGE', propertyId: 'p2' },
  ],
  superannuation: [
    { ownerEntityId: 'you', currentBalance: 200_000, fundType: 'INDUSTRY' },
  ],
  assets: [{ ownerEntityId: 'you', currentValue: 35_000 }],
  income: INCOME_ROWS.map(r => ({ id: r.id, amount: r.amount, frequency: r.frequency, ownerEntityId: r.ownerEntityId })),
  bankedPerRowMonthly: bankedMap(),
  expenses: [
    { ownerEntityId: 'you', amount: 3_000, frequency: 'MONTHLY' },
    { ownerEntityId: 'trust', amount: 200, frequency: 'WEEKLY' },
  ],
});

describe('Phase 47 C1 — buildEntityBreakdown', () => {
  it('per-entity positions sum to the household engine result (additivity)', () => {
    const data = input();
    const positions = buildEntityBreakdown(data);
    const household = calculateNetWorth(
      data.properties.map(p => ({ currentValue: p.currentValue })),
      data.accounts.map(a => ({ currentBalance: a.currentBalance, type: a.type })),
      data.investmentHoldings.map(h => ({
        units: h.units,
        currentPrice: h.currentPrice || undefined,
        averagePrice: h.averagePrice,
      })),
      data.loans.map(l => ({ principal: l.principal, type: l.type, propertyId: l.propertyId })),
      data.superannuation.map(s => ({
        balance: s.currentBalance,
        fundType: s.fundType as 'INDUSTRY',
      })),
      data.assets.map(a => ({ currentValue: a.currentValue })),
    );
    const sum = (k: 'netWorth' | 'assets' | 'liabilities') =>
      positions.reduce((s, p) => s + p[k], 0);
    expect(sum('netWorth')).toBeCloseTo(household.netWorth, 6);
    expect(sum('assets')).toBeCloseTo(household.assets.total, 6);
    expect(sum('liabilities')).toBeCloseTo(household.liabilities.total, 6);
  });

  it('partitions by legal-title holder (no stake splitting at Stage C)', () => {
    const positions = buildEntityBreakdown(input());
    const trust = positions.find(p => p.entityId === 'trust')!;
    expect(trust.assets).toBeCloseTo(1_650_000 + 12_000, 6);
    expect(trust.liabilities).toBeCloseTo(1_400_000, 6);
    expect(trust.counts.holdings).toBe(3);
  });

  it('income via the banked per-row map; expenses via the canonical toMonthly', () => {
    const positions = buildEntityBreakdown(input());
    const trust = positions.find(p => p.entityId === 'trust')!;
    // Income: OTHER 600/wk banks at its declared run-rate (600×52/12) via the
    // banked engine's per-row attribution. Expenses: 200/wk via toMonthly.
    expect(trust.monthlyIncome).toBeCloseTo((600 * 52) / 12, 6);
    expect(trust.monthlyCashflow).toBeCloseTo(((600 - 200) * 52) / 12, 6);
  });

  it('routes null owners to the Unattributed bucket — sums still reconcile', () => {
    const data = input();
    data.superannuation.push({ ownerEntityId: null, currentBalance: 50_000, fundType: 'RETAIL' });
    const positions = buildEntityBreakdown(data);
    const un = positions.find(p => p.entityId === UNATTRIBUTED_ENTITY_ID)!;
    expect(un.entityName).toBe('Unattributed');
    expect(un.assets).toBeCloseTo(50_000, 6);
    // Unattributed sorts last.
    expect(positions[positions.length - 1].entityId).toBe(UNATTRIBUTED_ENTITY_ID);
  });

  it('omits entities with no holdings', () => {
    const data = input();
    data.entities.push({ id: 'empty-co', name: 'Empty Co', type: 'COMPANY' });
    const positions = buildEntityBreakdown(data);
    expect(positions.find(p => p.entityId === 'empty-co')).toBeUndefined();
  });
});
