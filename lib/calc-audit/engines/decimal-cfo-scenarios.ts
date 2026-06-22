/**
 * Q-DEC PR 2.E.1 — Shadow comparison adapters for `lib/cfo/scenarios/*`.
 *
 * Six pure-function "what-if" scenarios that take a snapshot + per-scenario
 * params and return a structured `ScenarioResult` (impacts + warnings +
 * assumptions). The Float path is the canonical implementation already
 * consumed by `/api/cfo/scenarios/run` + the AI advisor's tool dispatcher;
 * the Decimal sibling produces the same numeric results but in `Decimal`.
 *
 * Synthetic snapshot helper. The harness only consumes the fields each
 * scenario reads — not the entire `MasterFinancialSnapshot` shape — so
 * the fixtures construct minimal snapshots that satisfy the consumed
 * field set. This keeps the fixtures readable and the diff surface
 * exactly the engine's math (no irrelevant snapshot churn).
 *
 * The five Float-side string fields per `ScenarioResult` (title /
 * summary / warnings[] / assumptions[] / computedAt) are non-numeric
 * leaves and skipped by the harness — only numeric leaves on
 * `impacts[*].{before, after, delta}` are compared.
 */

import {
  refinanceLoanScenario,
  refinanceLoanScenarioDecimal,
  type RefinanceLoanParams,
} from '@/lib/cfo/scenarios/refinanceLoan';
import {
  payDownLoanScenario,
  payDownLoanScenarioDecimal,
  type PayDownLoanParams,
} from '@/lib/cfo/scenarios/payDownLoan';
import {
  redirectToOffsetScenario,
  redirectToOffsetScenarioDecimal,
  type RedirectToOffsetParams,
} from '@/lib/cfo/scenarios/redirectToOffset';
import {
  sellPropertyScenario,
  sellPropertyScenarioDecimal,
  type SellPropertyParams,
} from '@/lib/cfo/scenarios/sellProperty';
import {
  cutSpendCategoryScenario,
  cutSpendCategoryScenarioDecimal,
  type CutSpendCategoryParams,
} from '@/lib/cfo/scenarios/cutSpendCategory';
import {
  addInvestmentScenario,
  addInvestmentScenarioDecimal,
  type AddInvestmentParams,
} from '@/lib/cfo/scenarios/addInvestment';
import type {
  ScenarioContext,
  LoanView,
} from '@/lib/cfo/scenarios/types';
import type { MasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import type { ShadowEngine } from '@/lib/calc-audit/shadowComparison';

// ---------------------------------------------------------------------------
// Synthetic snapshot + loan factories
// ---------------------------------------------------------------------------

interface MinimalSnapshotInput {
  monthlyCashflow?: number;
  monthlyIncome?: number;
  monthlyExpenses?: number;
  monthlyLoanRepayments?: number;
  savingsRate?: number;
  liquidCash?: number;
  netWorth?: number;
  propertyPortfolioValue?: number;
  investmentsTotal?: number;
  emergencyMonthsCovered?: number;
  expenseCategories?: Array<{ category: string; amount: number }>;
  properties?: Array<{
    id: string;
    name: string;
    currentValue: number;
    loanBalance: number;
    equity: number;
    monthlyCashflow: number;
  }>;
}

function makeSnapshot(input: MinimalSnapshotInput = {}): MasterFinancialSnapshot {
  // Cast at the boundary — we only populate the fields the 6 scenarios
  // read; everything else is irrelevant to PR 2.E.1's math.
  const liquidCash = input.liquidCash ?? 0;
  const monthlyExpenses = input.monthlyExpenses ?? 0;
  return {
    quickMetrics: {
      monthlyIncome: input.monthlyIncome ?? 0,
      monthlyGrossIncome: 0,
      monthlyExpenses,
      monthlyCashflow: input.monthlyCashflow ?? 0,
      monthlyLoanRepayments: input.monthlyLoanRepayments ?? 0,
      totalAssets: 0,
      totalLiabilities: 0,
      netWorthValue: input.netWorth ?? 0,
      savingsRate: input.savingsRate ?? 0,
      liquidCash,
      keptAfterEssentials: 0,
      keptMargin: 0,
      freeCashDays: 0,
      // Phase 1 (cashflow-actuals) — not exercised by these scenarios; zeroed.
      actualMonthlyOutflow: 0,
      actualMonthlyInflow: 0,
      actualNetCashflow: 0,
      actualAvgMonthlyOutflow: 0,
      actualOutflowByCategory: {},
      hasActualData: false,
    },
    netWorth: { netWorth: input.netWorth ?? 0 } as MasterFinancialSnapshot['netWorth'],
    propertyPortfolioValue: input.propertyPortfolioValue ?? 0,
    properties: (input.properties ?? []).map(
      (p) =>
        ({
          ...p,
          purchasePrice: 0,
          lvr: 0,
          annualRentalIncome: 0,
          rentalYield: 0,
          monthlyExpenses: 0,
          capitalGrowth: 0,
          capitalGrowthPercent: 0,
        }) as MasterFinancialSnapshot['properties'][number],
    ),
    investments: {
      totalValue: input.investmentsTotal ?? 0,
      totalCostBase: 0,
      unrealisedGain: 0,
      unrealisedGainPercent: 0,
      holdingsCount: 0,
      byType: {},
    },
    emergencyFund: {
      liquidCash,
      monthlyExpenses,
      monthsCovered: input.emergencyMonthsCovered ?? 0,
      targetMonths: 3,
      gap: 0,
      status: 'good',
    },
    expenses: {
      monthly: {
        total: monthlyExpenses,
        byCategory: input.expenseCategories ?? [],
      } as unknown as MasterFinancialSnapshot['expenses']['monthly'],
      annual: {
        total: 0,
        byCategory: [],
      } as unknown as MasterFinancialSnapshot['expenses']['annual'],
    },
  } as MasterFinancialSnapshot;
}

function makeLoan(overrides: Partial<LoanView> = {}): LoanView {
  return {
    id: 'loan-1',
    name: 'Primary Home Loan',
    principal: 500_000,
    interestRate: 0.065,
    termMonths: 360,
    remainingMonths: 300,
    monthlyRepayment: 3_400,
    loanType: 'VARIABLE_PI',
    offsetBalance: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// refinanceLoan
// ---------------------------------------------------------------------------

interface RefinanceFixtureInput {
  loan: LoanView;
  monthlyCashflow: number;
  params: RefinanceLoanParams;
}

export const refinanceLoanShadow: ShadowEngine<
  RefinanceFixtureInput,
  ReturnType<typeof refinanceLoanScenario>,
  ReturnType<typeof refinanceLoanScenarioDecimal>
> = {
  name: 'cfo.scenarios.refinanceLoan.shadow',
  description: 'Shadow Float vs Decimal `refinanceLoanScenario` (PI repayment + lifetime savings + break-even).',
  sourcePath: 'lib/cfo/scenarios/refinanceLoan.ts',
  floatExecute: ({ loan, monthlyCashflow, params }) =>
    refinanceLoanScenario({ snapshot: makeSnapshot({ monthlyCashflow }), loans: [loan] }, params),
  decimalExecute: ({ loan, monthlyCashflow, params }) =>
    refinanceLoanScenarioDecimal({ snapshot: makeSnapshot({ monthlyCashflow }), loans: [loan] }, params),
  fieldPolicy: {},
  fixtures: [
    {
      name: 'small rate drop saves ~$200/mo',
      description: '$500k @ 6.5% → 5.5%, 300 months remaining.',
      input: {
        loan: makeLoan(),
        monthlyCashflow: 1_500,
        params: { loanId: 'loan-1', newRate: 0.055 },
      },
    },
    {
      name: 'rate increase — no savings',
      description: 'New rate > current → critical warning, negative savings.',
      input: {
        loan: makeLoan({ monthlyRepayment: 3_100, interestRate: 0.055 }),
        monthlyCashflow: 1_500,
        params: { loanId: 'loan-1', newRate: 0.075 },
      },
    },
    {
      name: 'fixed loan caution surfaced',
      description: 'Fixed loan type → caution about break costs.',
      input: {
        loan: makeLoan({ loanType: 'FIXED_3YR', monthlyRepayment: 3_400 }),
        monthlyCashflow: 1_500,
        params: { loanId: 'loan-1', newRate: 0.055 },
      },
    },
    {
      name: 'custom switching costs',
      description: 'Override default $1,500 to $4,000 — break-even shifts.',
      input: {
        loan: makeLoan(),
        monthlyCashflow: 1_500,
        params: { loanId: 'loan-1', newRate: 0.055, switchingCosts: 4_000 },
      },
    },
    {
      name: 'loan not found',
      description: 'Missing loanId returns empty impacts list + critical warning.',
      input: {
        loan: makeLoan(),
        monthlyCashflow: 1_500,
        params: { loanId: 'nonexistent', newRate: 0.055 },
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// payDownLoan
// ---------------------------------------------------------------------------

interface PayDownFixtureInput {
  loan: LoanView;
  monthlyCashflow: number;
  params: PayDownLoanParams;
}

export const payDownLoanShadow: ShadowEngine<
  PayDownFixtureInput,
  ReturnType<typeof payDownLoanScenario>,
  ReturnType<typeof payDownLoanScenarioDecimal>
> = {
  name: 'cfo.scenarios.payDownLoan.shadow',
  description: 'Shadow Float vs Decimal `payDownLoanScenario` (amortisation walk + interest saved + months reduced).',
  sourcePath: 'lib/cfo/scenarios/payDownLoan.ts',
  floatExecute: ({ loan, monthlyCashflow, params }) =>
    payDownLoanScenario({ snapshot: makeSnapshot({ monthlyCashflow }), loans: [loan] }, params),
  decimalExecute: ({ loan, monthlyCashflow, params }) =>
    payDownLoanScenarioDecimal({ snapshot: makeSnapshot({ monthlyCashflow }), loans: [loan] }, params),
  fieldPolicy: {},
  fixtures: [
    {
      name: '$200/mo extra on $500k loan',
      description: 'Standard $500k @ 6.5%, $3,400/mo P&I, extra $200/mo.',
      input: {
        loan: makeLoan(),
        monthlyCashflow: 1_500,
        params: { loanId: 'loan-1', extraMonthly: 200 },
      },
    },
    {
      name: '$500/mo extra accelerates payoff',
      description: 'Larger extra payment → more interest saved + bigger month reduction.',
      input: {
        loan: makeLoan(),
        monthlyCashflow: 1_500,
        params: { loanId: 'loan-1', extraMonthly: 500 },
      },
    },
    {
      name: 'extra payment pushes cashflow negative',
      description: '$2,000 extra/mo when cashflow is only $1,500 → caution.',
      input: {
        loan: makeLoan(),
        monthlyCashflow: 1_500,
        params: { loanId: 'loan-1', extraMonthly: 2_000 },
      },
    },
    {
      name: 'fixed loan caution surfaced',
      description: 'Fixed loan type → caution about extra-payment caps.',
      input: {
        loan: makeLoan({ loanType: 'FIXED_2YR' }),
        monthlyCashflow: 1_500,
        params: { loanId: 'loan-1', extraMonthly: 200 },
      },
    },
    {
      name: 'loan not found',
      description: 'Missing loanId returns empty impacts list + critical warning.',
      input: {
        loan: makeLoan(),
        monthlyCashflow: 1_500,
        params: { loanId: 'nonexistent', extraMonthly: 200 },
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// redirectToOffset
// ---------------------------------------------------------------------------

interface OffsetFixtureInput {
  loan: LoanView;
  liquidCash: number;
  params: RedirectToOffsetParams;
}

export const redirectToOffsetShadow: ShadowEngine<
  OffsetFixtureInput,
  ReturnType<typeof redirectToOffsetScenario>,
  ReturnType<typeof redirectToOffsetScenarioDecimal>
> = {
  name: 'cfo.scenarios.redirectToOffset.shadow',
  description: 'Shadow Float vs Decimal `redirectToOffsetScenario` (effective principal × rate / 12).',
  sourcePath: 'lib/cfo/scenarios/redirectToOffset.ts',
  floatExecute: ({ loan, liquidCash, params }) =>
    redirectToOffsetScenario({ snapshot: makeSnapshot({ liquidCash }), loans: [loan] }, params),
  decimalExecute: ({ loan, liquidCash, params }) =>
    redirectToOffsetScenarioDecimal({ snapshot: makeSnapshot({ liquidCash }), loans: [loan] }, params),
  fieldPolicy: {},
  fixtures: [
    {
      name: 'park $50k in offset',
      description: '$500k @ 6.5% with $0 offset, add $50k.',
      input: {
        loan: makeLoan(),
        liquidCash: 100_000,
        params: { loanId: 'loan-1', amount: 50_000 },
      },
    },
    {
      name: 'park $10k in partially-offset loan',
      description: 'Existing $20k offset, add $10k → marginal saving on $470k effective principal.',
      input: {
        loan: makeLoan({ offsetBalance: 20_000 }),
        liquidCash: 100_000,
        params: { loanId: 'loan-1', amount: 10_000 },
      },
    },
    {
      name: 'amount exceeds liquid cash → caution',
      description: 'Liquid cash $30k, parking $50k → caution.',
      input: {
        loan: makeLoan(),
        liquidCash: 30_000,
        params: { loanId: 'loan-1', amount: 50_000 },
      },
    },
    {
      name: 'fully offset loan → no benefit',
      description: 'Offset balance == principal, more cash adds nothing.',
      input: {
        loan: makeLoan({ offsetBalance: 500_000 }),
        liquidCash: 100_000,
        params: { loanId: 'loan-1', amount: 10_000 },
      },
    },
    {
      name: 'loan not found',
      description: 'Missing loanId returns empty impacts list + critical warning.',
      input: {
        loan: makeLoan(),
        liquidCash: 100_000,
        params: { loanId: 'nonexistent', amount: 50_000 },
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// sellProperty
// ---------------------------------------------------------------------------

interface SellFixtureInput {
  snapshot: MinimalSnapshotInput;
  params: SellPropertyParams;
}

export const sellPropertyShadow: ShadowEngine<
  SellFixtureInput,
  ReturnType<typeof sellPropertyScenario>,
  ReturnType<typeof sellPropertyScenarioDecimal>
> = {
  name: 'cfo.scenarios.sellProperty.shadow',
  description: 'Shadow Float vs Decimal `sellPropertyScenario` (net cash freed + portfolio delta).',
  sourcePath: 'lib/cfo/scenarios/sellProperty.ts',
  floatExecute: ({ snapshot, params }) =>
    sellPropertyScenario({ snapshot: makeSnapshot(snapshot) }, params),
  decimalExecute: ({ snapshot, params }) =>
    sellPropertyScenarioDecimal({ snapshot: makeSnapshot(snapshot) }, params),
  fieldPolicy: {},
  fixtures: [
    {
      name: 'positive-equity neutral-cashflow IP',
      description: '$800k value, $500k loan, $0 monthly cashflow.',
      input: {
        snapshot: {
          monthlyCashflow: 1_500,
          liquidCash: 50_000,
          netWorth: 400_000,
          propertyPortfolioValue: 800_000,
          properties: [
            {
              id: 'prop-1',
              name: 'Brisbane IP',
              currentValue: 800_000,
              loanBalance: 500_000,
              equity: 300_000,
              monthlyCashflow: 0,
            },
          ],
        },
        params: { propertyId: 'prop-1' },
      },
    },
    {
      name: 'negative-geared IP — removes drag',
      description: '$800k value, $700k loan, −$500/mo cashflow.',
      input: {
        snapshot: {
          monthlyCashflow: 1_500,
          liquidCash: 50_000,
          netWorth: 200_000,
          propertyPortfolioValue: 800_000,
          properties: [
            {
              id: 'prop-1',
              name: 'Negative IP',
              currentValue: 800_000,
              loanBalance: 700_000,
              equity: 100_000,
              monthlyCashflow: -500,
            },
          ],
        },
        params: { propertyId: 'prop-1' },
      },
    },
    {
      name: 'positively-geared IP — loses income stream',
      description: '$800k value, $400k loan, +$300/mo cashflow.',
      input: {
        snapshot: {
          monthlyCashflow: 2_000,
          liquidCash: 50_000,
          netWorth: 500_000,
          propertyPortfolioValue: 800_000,
          properties: [
            {
              id: 'prop-1',
              name: 'Positive IP',
              currentValue: 800_000,
              loanBalance: 400_000,
              equity: 400_000,
              monthlyCashflow: 300,
            },
          ],
        },
        params: { propertyId: 'prop-1' },
      },
    },
    {
      name: 'negative-equity → critical warning',
      description: 'Loan exceeds value.',
      input: {
        snapshot: {
          monthlyCashflow: 1_000,
          liquidCash: 20_000,
          netWorth: 50_000,
          propertyPortfolioValue: 600_000,
          properties: [
            {
              id: 'prop-1',
              name: 'Underwater IP',
              currentValue: 600_000,
              loanBalance: 700_000,
              equity: -100_000,
              monthlyCashflow: -200,
            },
          ],
        },
        params: { propertyId: 'prop-1' },
      },
    },
    {
      name: 'custom selling-costs override',
      description: 'Override 2.5% default to 4% (rural/regional with higher legals).',
      input: {
        snapshot: {
          monthlyCashflow: 1_500,
          liquidCash: 50_000,
          netWorth: 400_000,
          propertyPortfolioValue: 800_000,
          properties: [
            {
              id: 'prop-1',
              name: 'Regional IP',
              currentValue: 800_000,
              loanBalance: 500_000,
              equity: 300_000,
              monthlyCashflow: 0,
            },
          ],
        },
        params: { propertyId: 'prop-1', sellingCostsPercent: 0.04 },
      },
    },
    {
      name: 'property not found',
      description: 'Missing propertyId returns empty impacts list.',
      input: {
        snapshot: {
          monthlyCashflow: 1_500,
          liquidCash: 50_000,
          netWorth: 400_000,
          propertyPortfolioValue: 800_000,
          properties: [],
        },
        params: { propertyId: 'nonexistent' },
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// cutSpendCategory
// ---------------------------------------------------------------------------

interface CutFixtureInput {
  snapshot: MinimalSnapshotInput;
  params: CutSpendCategoryParams;
}

export const cutSpendCategoryShadow: ShadowEngine<
  CutFixtureInput,
  ReturnType<typeof cutSpendCategoryScenario>,
  ReturnType<typeof cutSpendCategoryScenarioDecimal>
> = {
  name: 'cfo.scenarios.cutSpendCategory.shadow',
  description: 'Shadow Float vs Decimal `cutSpendCategoryScenario` (savings rate + emergency months recompute).',
  sourcePath: 'lib/cfo/scenarios/cutSpendCategory.ts',
  floatExecute: ({ snapshot, params }) =>
    cutSpendCategoryScenario({ snapshot: makeSnapshot(snapshot) }, params),
  decimalExecute: ({ snapshot, params }) =>
    cutSpendCategoryScenarioDecimal({ snapshot: makeSnapshot(snapshot) }, params),
  fieldPolicy: {
    // Savings rate field uses % not currency; Float doesn't pre-round either side.
    'impacts[2].before': 'percentage',
    'impacts[2].after': 'percentage',
    'impacts[2].delta': 'percentage',
  },
  fixtures: [
    {
      name: 'cut $200/mo dining',
      description: 'Standard reduction within category spend.',
      input: {
        snapshot: {
          monthlyIncome: 7_000,
          monthlyExpenses: 4_500,
          monthlyCashflow: 1_000,
          monthlyLoanRepayments: 1_500,
          savingsRate: 14.3,
          liquidCash: 15_000,
          emergencyMonthsCovered: 3.3,
          expenseCategories: [
            { category: 'Dining', amount: 400 },
            { category: 'Groceries', amount: 1_200 },
          ],
        },
        params: { category: 'Dining', monthlyReduction: 200 },
      },
    },
    {
      name: 'cut exceeds spend → capped',
      description: '$500 requested but only $400 spend → capped at $400.',
      input: {
        snapshot: {
          monthlyIncome: 7_000,
          monthlyExpenses: 4_500,
          monthlyCashflow: 1_000,
          monthlyLoanRepayments: 1_500,
          savingsRate: 14.3,
          liquidCash: 15_000,
          emergencyMonthsCovered: 3.3,
          expenseCategories: [{ category: 'Dining', amount: 400 }],
        },
        params: { category: 'Dining', monthlyReduction: 500 },
      },
    },
    {
      name: 'category not found',
      description: 'No matching category → caution + zero impact.',
      input: {
        snapshot: {
          monthlyIncome: 7_000,
          monthlyExpenses: 4_500,
          monthlyCashflow: 1_000,
          monthlyLoanRepayments: 1_500,
          savingsRate: 14.3,
          liquidCash: 15_000,
          emergencyMonthsCovered: 3.3,
          expenseCategories: [{ category: 'Dining', amount: 400 }],
        },
        params: { category: 'Crypto', monthlyReduction: 200 },
      },
    },
    {
      name: 'zero income guards savings rate division',
      description: 'No income → savings rate stays 0 (no divide-by-zero).',
      input: {
        snapshot: {
          monthlyIncome: 0,
          monthlyExpenses: 2_000,
          monthlyCashflow: -2_000,
          monthlyLoanRepayments: 0,
          savingsRate: 0,
          liquidCash: 5_000,
          emergencyMonthsCovered: 2.5,
          expenseCategories: [{ category: 'Groceries', amount: 800 }],
        },
        params: { category: 'Groceries', monthlyReduction: 100 },
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// addInvestment
// ---------------------------------------------------------------------------

interface AddInvestmentFixtureInput {
  snapshot: MinimalSnapshotInput;
  params: AddInvestmentParams;
}

export const addInvestmentShadow: ShadowEngine<
  AddInvestmentFixtureInput,
  ReturnType<typeof addInvestmentScenario>,
  ReturnType<typeof addInvestmentScenarioDecimal>
> = {
  name: 'cfo.scenarios.addInvestment.shadow',
  description: 'Shadow Float vs Decimal `addInvestmentScenario` (monthly-annuity future value).',
  sourcePath: 'lib/cfo/scenarios/addInvestment.ts',
  floatExecute: ({ snapshot, params }) =>
    addInvestmentScenario({ snapshot: makeSnapshot(snapshot) }, params),
  decimalExecute: ({ snapshot, params }) =>
    addInvestmentScenarioDecimal({ snapshot: makeSnapshot(snapshot) }, params),
  fieldPolicy: {},
  fixtures: [
    {
      name: '$500/mo for 10 years @ 7% default',
      description: 'Default return + horizon.',
      input: {
        snapshot: {
          monthlyCashflow: 1_500,
          investmentsTotal: 0,
          emergencyMonthsCovered: 3,
        },
        params: { monthlyAmount: 500 },
      },
    },
    {
      name: '$1000/mo for 20 years @ 8%',
      description: 'Custom return + longer horizon.',
      input: {
        snapshot: {
          monthlyCashflow: 2_500,
          investmentsTotal: 50_000,
          emergencyMonthsCovered: 5,
        },
        params: { monthlyAmount: 1_000, expectedAnnualReturn: 0.08, years: 20 },
      },
    },
    {
      name: 'zero return → straight contribution sum',
      description: 'Degenerate case — monthlyReturn 0 falls back to amount × months.',
      input: {
        snapshot: {
          monthlyCashflow: 1_500,
          investmentsTotal: 0,
          emergencyMonthsCovered: 3,
        },
        params: { monthlyAmount: 500, expectedAnnualReturn: 0, years: 5 },
      },
    },
    {
      name: 'contribution pushes cashflow negative',
      description: '$2000/mo when cashflow is only $1500 → caution.',
      input: {
        snapshot: {
          monthlyCashflow: 1_500,
          investmentsTotal: 0,
          emergencyMonthsCovered: 3,
        },
        params: { monthlyAmount: 2_000 },
      },
    },
    {
      name: 'low emergency fund → TRAIL Anchor caution',
      description: 'Emergency months < 3 → caution about TRAIL prioritisation.',
      input: {
        snapshot: {
          monthlyCashflow: 1_500,
          investmentsTotal: 0,
          emergencyMonthsCovered: 1.5,
        },
        params: { monthlyAmount: 500 },
      },
    },
  ],
};

export const cfoScenarioShadowEngines = [
  refinanceLoanShadow,
  payDownLoanShadow,
  redirectToOffsetShadow,
  sellPropertyShadow,
  cutSpendCategoryShadow,
  addInvestmentShadow,
] as const;
