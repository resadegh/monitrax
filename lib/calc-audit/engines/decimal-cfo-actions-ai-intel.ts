/**
 * Q-DEC PR 2.E.4 — Shadow comparison adapters for `lib/cfo/intelligenceEngine`.
 *
 * **Scope discipline.** PR 2.E.4 is the final 2.E sub-PR. Of the three
 * files in scope:
 *
 *   - `actionEngine.ts` — categorical recommendation generator with
 *     hard-coded display amounts (`amount: 5000`, `amount: 200`, etc.)
 *     used as priority thresholds (`impact.amount > 500 / > 1000`).
 *     Threshold comparisons are float-stable; no compounding math. The
 *     numeric leaves are recommendation copy, not computed money.
 *     NO Decimal sibling — would be wasteful churn with zero precision
 *     benefit.
 *
 *   - `aiAdvisor.ts` — Gemini tool-call dispatcher + prompt construction.
 *     The 3 numeric helpers (`bucket`, `round`, `clamp`) are all
 *     display-side / range-guard utilities. The actual money math the
 *     advisor narrates over is the scenario engine output (PR 2.E.1)
 *     and the master tax position (PR 2.D.2b), both of which already
 *     ship Decimal siblings. NO Decimal sibling — presentation-side.
 *
 *   - `intelligenceEngine.ts` — async orchestrator wrapping all the
 *     other CFO components. The pure-math helpers worth a Decimal
 *     sibling are: (a) the projected-month-end-balance computation in
 *     `calculateQuickStats`, and (b) the net-worth aggregation in
 *     `calculateMonthlyProgress`. The rest of the math (net-worth /
 *     savings-rate / debt-reduction) is either covered by existing
 *     Decimal siblings (PR 2.A `netWorthCalculator`, PR 2.E.2
 *     `calculateSavingsRateDecimal`) or is a simulated placeholder
 *     (`lastMonthNetWorth = currentNetWorth × 0.98`,
 *     `debtReduction = totalDebt × 0.005`) that doesn't merit
 *     compounding-precision math.
 *
 * Shadow engines registered: 2 (both for intelligenceEngine).
 */

import {
  calculateProjectedMonthEndBalanceDecimal,
  calculateMonthlyProgressNetWorthDecimal,
} from '@/lib/cfo/intelligenceEngine';
import { Decimal } from '@/lib/decimal';
import type { ShadowEngine } from '@/lib/calc-audit/shadowComparison';

// ---------------------------------------------------------------------------
// projected month-end balance (source: intelligenceEngine.ts:240-265)
// ---------------------------------------------------------------------------

function projectedMonthEndBalanceFloat(
  liquidBalance: number,
  dailyBurn: number,
  daysRemaining: number,
): number {
  return liquidBalance - dailyBurn * daysRemaining;
}

interface ProjectedFixture {
  liquidBalance: number;
  dailyBurn: number;
  daysRemaining: number;
}

export const projectedMonthEndBalanceShadow: ShadowEngine<
  ProjectedFixture,
  number,
  Decimal
> = {
  name: 'cfo.intelligenceEngine.calculateProjectedMonthEndBalance.shadow',
  description: 'Shadow Float vs Decimal projected month-end balance (liquid − dailyBurn × days).',
  sourcePath: 'lib/cfo/intelligenceEngine.ts',
  floatExecute: ({ liquidBalance, dailyBurn, daysRemaining }) =>
    projectedMonthEndBalanceFloat(liquidBalance, dailyBurn, daysRemaining),
  decimalExecute: ({ liquidBalance, dailyBurn, daysRemaining }) =>
    calculateProjectedMonthEndBalanceDecimal(liquidBalance, dailyBurn, daysRemaining),
  fieldPolicy: {},
  fixtures: [
    {
      name: 'typical mid-month projection',
      description: '$5k liquid, $150/day burn, 12 days left → +$3,200.',
      input: { liquidBalance: 5_000, dailyBurn: 150, daysRemaining: 12 },
    },
    {
      name: 'burn exceeds liquid → negative projection',
      description: 'Going into overdraft if no income → caution case.',
      input: { liquidBalance: 1_000, dailyBurn: 200, daysRemaining: 10 },
    },
    {
      name: 'zero days remaining — end of month',
      description: 'projectedBalance = liquidBalance.',
      input: { liquidBalance: 5_000, dailyBurn: 150, daysRemaining: 0 },
    },
    {
      name: 'zero burn — break even',
      description: 'projectedBalance unchanged.',
      input: { liquidBalance: 5_000, dailyBurn: 0, daysRemaining: 15 },
    },
    {
      name: 'high-income family',
      description: '$50k liquid, $1k/day burn, 20 days.',
      input: { liquidBalance: 50_000, dailyBurn: 1_000, daysRemaining: 20 },
    },
  ],
};

// ---------------------------------------------------------------------------
// monthly-progress net worth (source: intelligenceEngine.ts:165-172)
// ---------------------------------------------------------------------------

interface NWFixture {
  accountBalances: { currentBalance: number }[];
  propertyValues: { currentValue: number }[];
  investmentHoldings: { units: number; averagePrice: number }[];
  totalDebt: number;
}

function monthlyProgressNetWorthFloat(input: NWFixture): number {
  const accounts = input.accountBalances.reduce((s, a) => s + a.currentBalance, 0);
  const properties = input.propertyValues.reduce((s, p) => s + p.currentValue, 0);
  const investments = input.investmentHoldings.reduce(
    (s, h) => s + h.units * h.averagePrice,
    0,
  );
  return accounts + properties + investments - input.totalDebt;
}

export const monthlyProgressNetWorthShadow: ShadowEngine<NWFixture, number, Decimal> = {
  name: 'cfo.intelligenceEngine.calculateMonthlyProgressNetWorth.shadow',
  description: 'Shadow Float vs Decimal intelligence-engine net-worth aggregation.',
  sourcePath: 'lib/cfo/intelligenceEngine.ts',
  floatExecute: (input) => monthlyProgressNetWorthFloat(input),
  decimalExecute: (input) => calculateMonthlyProgressNetWorthDecimal(input),
  fieldPolicy: {},
  fixtures: [
    {
      name: 'empty portfolio → −debt',
      description: 'Pure debt position.',
      input: {
        accountBalances: [],
        propertyValues: [],
        investmentHoldings: [],
        totalDebt: 50_000,
      },
    },
    {
      name: 'mixed asset / debt',
      description: 'Realistic household: cash + super + property + loan.',
      input: {
        accountBalances: [
          { currentBalance: 25_000 },
          { currentBalance: 5_000 },
        ],
        propertyValues: [{ currentValue: 800_000 }],
        investmentHoldings: [{ units: 200, averagePrice: 150 }],
        totalDebt: 500_000,
      },
    },
    {
      name: 'multi-property no debt',
      description: 'Three properties fully paid.',
      input: {
        accountBalances: [{ currentBalance: 100_000 }],
        propertyValues: [
          { currentValue: 800_000 },
          { currentValue: 1_200_000 },
          { currentValue: 600_000 },
        ],
        investmentHoldings: [],
        totalDebt: 0,
      },
    },
    {
      name: 'underwater — debt exceeds assets',
      description: 'Net negative position.',
      input: {
        accountBalances: [{ currentBalance: 2_000 }],
        propertyValues: [{ currentValue: 600_000 }],
        investmentHoldings: [],
        totalDebt: 700_000,
      },
    },
    {
      name: 'micro-fractional holdings — accumulator precision',
      description: '20 holdings at 0.1234 units × $123.45 each.',
      input: {
        accountBalances: [],
        propertyValues: [],
        investmentHoldings: Array.from({ length: 20 }, () => ({
          units: 0.1234,
          averagePrice: 123.45,
        })),
        totalDebt: 0,
      },
    },
  ],
};

export const cfoActionsAiIntelShadowEngines = [
  projectedMonthEndBalanceShadow,
  monthlyProgressNetWorthShadow,
] as const;
