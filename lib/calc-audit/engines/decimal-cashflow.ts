/**
 * Q-DEC PR 2.C — Shadow comparison adapters for `lib/cashflow/*`.
 *
 * Scope: `incomeNormalizer.ts` only. The 4 larger files in
 * `lib/cashflow/` (forecasting / optimisation / stressTesting /
 * insightGenerator) are higher-level decision-support layers that
 * CONSUME cashflow output rather than produce it — they'll adopt the
 * Decimal path automatically in PR 3 when route handlers swap.
 *
 * Engines registered here:
 *   - `incomeNormalizer.calculateTakeHomePay` — the unblocker.
 *     Composes TaxEngine PAYG / Medicare / LITO; result is the
 *     primary consumer for `cashflowOrchestrator`'s Decimal path.
 *   - `incomeNormalizer.normalizeAllIncome` — used by the cashflow
 *     summary API routes. Larger surface, multiple salary cases.
 *
 * Note: shadow comparisons for `normalizeIncomeStream` flatten its
 * spreaded `IncomeStream` fields (name, frequency, etc.) into the
 * output. The shadow harness already handles string/object fields by
 * coercing them to 0 on comparison — they won't fail, but they're
 * noise. The fixtures keep the input IncomeStream minimal so the
 * meaningful fields (`grossMonthlyAmount`, `netMonthlyAmount`,
 * `monthlyPaygWithholding`) dominate the diff report.
 */

import {
  calculateTakeHomePay,
  calculateTakeHomePayDecimal,
  normalizeAllIncome,
  normalizeAllIncomeDecimal,
} from '@/lib/cashflow/incomeNormalizer';
import type { IncomeStream } from '@/lib/cashflow/types';
import type { ShadowEngine } from '@/lib/calc-audit/shadowComparison';

// ---------------------------------------------------------------------------
// calculateTakeHomePay
// ---------------------------------------------------------------------------

export const calculateTakeHomePayShadow: ShadowEngine<
  { grossAmount: number; frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' },
  ReturnType<typeof calculateTakeHomePay>,
  ReturnType<typeof calculateTakeHomePayDecimal>
> = {
  name: 'cashflow.calculateTakeHomePay.shadow',
  description: 'Shadow Float vs Decimal `calculateTakeHomePay` — PR 2.B Float-bridge unblocker.',
  sourcePath: 'lib/cashflow/incomeNormalizer.ts',
  floatExecute: ({ grossAmount, frequency }) => calculateTakeHomePay(grossAmount, frequency),
  decimalExecute: ({ grossAmount, frequency }) => calculateTakeHomePayDecimal(grossAmount, frequency),
  // `effectiveTaxRate` is a percentage; the Float path doesn't pre-round
  // it (no `Math.round`), so 'percentage' tolerance fits. All currency
  // fields use default 'currency'.
  fieldPolicy: {
    effectiveTaxRate: 'percentage',
  },
  fixtures: [
    {
      name: 'low income — below tax-free threshold',
      description: '$15k annual gross. PAYG=0, Medicare=0, net=gross.',
      input: { grossAmount: 15000, frequency: 'ANNUAL' },
    },
    {
      name: 'median full-time salary annual',
      description: '$90k annual gross — middle bracket.',
      input: { grossAmount: 90000, frequency: 'ANNUAL' },
    },
    {
      name: 'median salary monthly',
      description: '$7,500/month gross ($90k annual) — division round-trip.',
      input: { grossAmount: 7500, frequency: 'MONTHLY' },
    },
    {
      name: 'high earner — Div 293 territory',
      description: '$250k annual gross — top marginal bracket.',
      input: { grossAmount: 250000, frequency: 'ANNUAL' },
    },
    {
      name: 'weekly low income',
      description: '$1,200/week × 52 = $62,400 annual.',
      input: { grossAmount: 1200, frequency: 'WEEKLY' },
    },
    {
      name: 'fortnightly average wage',
      description: '$3,200/fortnight × 26 = $83,200 annual.',
      input: { grossAmount: 3200, frequency: 'FORTNIGHTLY' },
    },
  ],
};

// ---------------------------------------------------------------------------
// normalizeAllIncome
// ---------------------------------------------------------------------------

// Build minimal IncomeStream items — only the fields normalizeIncomeStream
// actually reads. Real IncomeStream has many more fields (name, frequency,
// id, etc.) but they aren't touched by the math.
function mkIncome(overrides: Partial<IncomeStream>): IncomeStream {
  return {
    id: 'fixture',
    userId: 'fixture-user',
    name: 'fixture income',
    type: 'OTHER',
    frequency: 'MONTHLY',
    monthlyAmount: 0,
    annualAmount: 0,
    nextPaymentDate: new Date('2026-06-01'),
    isActive: true,
    ...overrides,
  } as IncomeStream;
}

export const normalizeAllIncomeShadow: ShadowEngine<
  { streams: IncomeStream[] },
  ReturnType<typeof normalizeAllIncome>,
  ReturnType<typeof normalizeAllIncomeDecimal>
> = {
  name: 'cashflow.normalizeAllIncome.shadow',
  description: 'Shadow Float vs Decimal `normalizeAllIncome` — covers salary GROSS/NET + non-salary.',
  sourcePath: 'lib/cashflow/incomeNormalizer.ts',
  floatExecute: ({ streams }) => normalizeAllIncome(streams),
  decimalExecute: ({ streams }) => normalizeAllIncomeDecimal(streams),
  fieldPolicy: {},
  fixtures: [
    { name: 'empty', description: 'No income streams.', input: { streams: [] } },
    {
      name: 'mixed salary + rental + investment',
      description: 'Each branch of normalizeIncomeStream exercised at once.',
      input: {
        streams: [
          mkIncome({
            type: 'SALARY',
            salaryType: 'GROSS',
            monthlyAmount: 7500,
            netAmount: 67200,
            paygWithholding: 22800,
          }),
          mkIncome({
            type: 'SALARY',
            salaryType: 'NET',
            monthlyAmount: 5600,
            netAmount: 67200,
            grossAmount: 90000,
            paygWithholding: 22800,
          }),
          mkIncome({ type: 'RENTAL', monthlyAmount: 850 }),
          mkIncome({ type: 'INVESTMENT', monthlyAmount: 420 }),
        ],
      },
    },
    {
      name: 'legacy salary fallback — calculateNetSalary path',
      description: 'SALARY without netAmount/grossAmount triggers the TaxEngine PAYG calc.',
      input: {
        streams: [
          mkIncome({ type: 'SALARY', salaryType: 'GROSS', monthlyAmount: 9000 }),
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Convenience: full set for the PR 2.C aggregate report
// ---------------------------------------------------------------------------

export const cashflowShadowEngines = [
  calculateTakeHomePayShadow,
  normalizeAllIncomeShadow,
] as const;
