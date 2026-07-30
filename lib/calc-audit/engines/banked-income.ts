/**
 * MON-131 Tranche 1 (MON-128) — calc-audit registrations for the BANKED
 * INCOME engine stack (D17/D20) + the new withholding engines (D35/D42).
 *
 * Part 22 (Neo Inventory): `calcEngineRegistry` is the SINGLE inventory —
 * no engine without a fixture. Every fixture value below is a §19.2
 * hand-computed worked example (the same examples locked in
 * tests/tax/mon128T1WithholdingConfig.test.ts + tests/income/bankedIncome.test.ts).
 */

import { calcEngineRegistry } from '../registry';
import { calculatePAYG } from '@/lib/tax-engine/core/paygCalculator';
import { calculateHelpRepayment } from '@/lib/tax-engine/core/helpRepaymentCalculator';
import {
  computeRepaymentIncome,
  type RepaymentIncomeComponents,
} from '@/lib/tax-engine/position/repaymentIncome';
import { TAX_YEAR_2026_27 } from '@/lib/tax-engine/config/taxYearConfig';
import { computeSalaryBanked } from '@/lib/income/banked/salaryBanked';
import { buildBankedIncome, type BankedIncomeInput } from '@/lib/income/banked/aggregator';
import type { BankedIncomeRow, BankedContext } from '@/lib/income/banked/types';

const CTX_2026_27: BankedContext = { config: TAX_YEAR_2026_27, repaymentIncome: null };

// ============================================================
// PAYG Schedule 1 — FY2026-27 coefficients (config home, D35/X1)
// ============================================================

calcEngineRegistry.register({
  name: 'tax.paygScheduleWithholding.fy2026_27',
  description:
    'PAYG Schedule 1 withholding under the FY2026-27 coefficient set (15% first rate) — coefficients live in TaxYearConfig.paygSchedule (D35), formula y = a·x − b with x = floor(weekly) + 0.99, whole-dollar ATO rounding.',
  category: 'TAX',
  sourcePath: 'lib/tax-engine/core/paygCalculator.ts',
  execute: (input: { grossIncome: number; frequency: 'WEEKLY' | 'ANNUALLY'; hasTaxFreeThreshold?: boolean }) =>
    calculatePAYG(input, TAX_YEAR_2026_27),
  fixtures: [
    {
      name: 'Weekly $1,000, scale 2 (FY26-27)',
      description: 'x = 1000.99, band $865–$1,281 (a 0.3227, b 185.1935) → 137.825973 → $138/wk.',
      input: { grossIncome: 1_000, frequency: 'WEEKLY', hasTaxFreeThreshold: true },
      assertions: [
        { description: 'Weekly withholding = $138', check: (r) => r.weeklyWithholding === 138 },
        { description: 'Annual = $7,176 (weekly × 52)', check: (r) => r.annualWithholding === 7_176 },
      ],
      authoritySource:
        'ATO Schedule 1 coefficients effective 1 Jul 2026 (published 17 Jun 2026), verified 2026-07-30: ato.gov.au/tax-rates-and-codes/payg-withholding-schedule-1-statement-of-formulas-for-calculating-amounts-to-be-withheld/coefficients-to-use-in-formulas-for-withholding-from-weekly-payments; cross-checked byte-identical against pay-calculator.au/payg-withholding-tax-tables. Hand-calc: 0.3227 × 1000.99 − 185.1935 = 137.825973 → 138.',
    },
    {
      name: 'Weekly $500, scale 2 — the 15% band the reform changed',
      description: 'x = 500.99, band $362–$537 (a 0.15, b 54.3462) → 20.80235 → $21/wk (FY24-26 coefficients gave $22 here via a 0.16).',
      input: { grossIncome: 500, frequency: 'WEEKLY', hasTaxFreeThreshold: true },
      assertions: [{ description: 'Weekly withholding = $21', check: (r) => r.weeklyWithholding === 21 }],
      authoritySource: 'Same ATO publication. Hand-calc: 0.15 × 500.99 − 54.3462 = 20.80235 → 21.',
    },
  ],
});

// ============================================================
// HELP/STSL compulsory repayment — FY2026-27 marginal system (D42 C2/C3)
// ============================================================

calcEngineRegistry.register({
  name: 'tax.helpRepayment.fy2026_27',
  description:
    'HELP/STSL compulsory repayment, FY26-27 marginal system: nil ≤ $69,528; 15c/$1 to $129,717; $9,028 + 17c/$1 to $186,050; ABOVE $186,050 a CLIFF — 10% of TOTAL repayment income. Parameters in TaxYearConfig.helpRepayment.',
  category: 'TAX',
  sourcePath: 'lib/tax-engine/core/helpRepaymentCalculator.ts',
  execute: (input: { repaymentIncome: number }) =>
    calculateHelpRepayment(input.repaymentIncome, TAX_YEAR_2026_27),
  fixtures: [
    {
      name: 'The cliff, both directions ($186,050 vs $186,051)',
      description: 'At the boundary the marginal formula gives $18,604.61; one dollar over, 10% of the WHOLE gives $18,605.10 (TOTAL_INCOME basis, not the excess).',
      input: { repaymentIncome: 186_051 },
      assertions: [
        { description: 'Status COMPUTED', check: (r) => r.status === 'COMPUTED' },
        { description: 'Amount = 10% of the WHOLE = $18,605.10', check: (r) => r.status === 'COMPUTED' && Math.abs(r.amount - 18_605.1) < 1e-6 },
        { description: 'Band = TOP_CLIFF, basis TOTAL_INCOME', check: (r) => r.status === 'COMPUTED' && r.band === 'TOP_CLIFF' && r.basis === 'TOTAL_INCOME' },
      ],
      authoritySource:
        'ATO study-and-training-support-loans rates page, verified 2026-07-30: "$186,051 and over — 10% of your total repayment income". Hand-calc: 0.10 × 186,051 = 18,605.10; marginal at 186,050 = 9,028 + 0.17 × 56,333 = 18,604.61.',
    },
    {
      name: 'Band 1 marginal ($100,000 → $4,570.80)',
      description: '15c per $1 over $69,528: 0.15 × 30,472 = 4,570.80.',
      input: { repaymentIncome: 100_000 },
      assertions: [
        { description: 'Amount = $4,570.80', check: (r) => r.status === 'COMPUTED' && Math.abs(r.amount - 4_570.8) < 1e-6 },
        { description: 'Marginal basis', check: (r) => r.status === 'COMPUTED' && r.basis === 'MARGINAL' },
      ],
      authoritySource: 'Same ATO publication; hand-calc 0.15 × (100,000 − 69,528).',
    },
  ],
});

// ============================================================
// Repayment income — the D42 C3 add-backs
// ============================================================

calcEngineRegistry.register({
  name: 'tax.repaymentIncome',
  description:
    'Study-loan repayment income: taxable income (excl. FHSS released) + reportable fringe benefits + total net investment loss + reportable super + exempt foreign employment income. Omitted components labelled DEFAULT_ZERO (never silently complete).',
  category: 'TAX',
  sourcePath: 'lib/tax-engine/position/repaymentIncome.ts',
  execute: (input: RepaymentIncomeComponents) => computeRepaymentIncome(input),
  fixtures: [
    {
      name: 'Net-investment-loss add-back crosses the cliff',
      description: 'Taxable $170,000 (< $186,050) + $20,000 net investment loss → repayment income $190,000 (the D42 C3 material consequence: negative gearing RAISES repayment income).',
      input: { taxableIncome: 170_000, totalNetInvestmentLoss: 20_000 },
      assertions: [
        { description: 'Repayment income = $190,000', check: (r) => r.repaymentIncome === 190_000 },
        { description: 'Unprovided components labelled DEFAULT_ZERO, complete = false', check: (r) => r.complete === false && r.componentBasis.reportableFringeBenefits === 'DEFAULT_ZERO' },
      ],
      authoritySource: 'ATO repayment-income definition (verified 2026-07-30); hand-calc 170,000 + 20,000.',
    },
  ],
});

// ============================================================
// Banked salary (L1) — the FACT hierarchy
// ============================================================

calcEngineRegistry.register({
  name: 'income.salaryBanked',
  description:
    'L1 banked salary (D17): actual-net-pay FACT wins > NET-entered FACT (withholding ≡ gross − banked by construction; stored paygWithholding column retired as a read source) > derived FY-schedule withholding (Scale 2 embeds Medicare/offsets — no separate LITO arithmetic).',
  category: 'CORE',
  sourcePath: 'lib/income/banked/salaryBanked.ts',
  execute: (input: { row: BankedIncomeRow }) => computeSalaryBanked(input.row, CTX_2026_27),
  fixtures: [
    {
      name: 'NET-entered: identity wedge restored (the VR-042 V3 defect class)',
      description: 'Gross $227,519.50 (stored annual) − banked $217,587.50 = wedge $9,932.00 exactly, regardless of the inconsistent stored paygWithholding ($11,128.70). The implausible wedge is FLAGGED, never adjusted.',
      input: {
        row: {
          type: 'SALARY', amount: 217_587.5, frequency: 'ANNUAL', salaryType: 'NET',
          grossAmount: 227_519.5, netAmount: 217_587.5, paygWithholding: 11_128.7, isRecurring: true,
        },
      },
      assertions: [
        { description: 'Banked = $217,587.50 (the FACT)', check: (r) => r.bankedAnnual === 217_587.5 },
        { description: 'Withholding wedge = $9,932.00 (gross − banked, by construction)', check: (r) => Math.abs((r.components.payg ?? 0) - 9_932) < 1e-6 },
        { description: 'Implausibility flagged (wedge far below schedule), FACT unchanged', check: (r) => r.flags.includes('WITHHOLDING_IMPLAUSIBLE') },
      ],
      authoritySource: 'D17 (a payslip/entered net is a FACT and wins) + VR-042 V3 measured values; identity gross − banked ≡ withholding restored by construction.',
    },
    {
      name: 'One-off salary row contributes 0 to the run-rate',
      description: 'isRecurring === false → bankedAnnual 0, value counted once in oneOffAmount (MON-128 root-defect gate).',
      input: {
        row: { type: 'SALARY', amount: 10_000, frequency: 'MONTHLY', salaryType: 'NET', isRecurring: false },
      },
      assertions: [
        { description: 'Run-rate contribution = 0', check: (r) => r.bankedAnnual === 0 },
        { description: 'One-off amount counted once = $10,000', check: (r) => r.oneOffAmount === 10_000 },
      ],
      authoritySource: 'MON-053/MON-128 one-off semantics (Calc-SSOT Wall B2).',
    },
  ],
});

// ============================================================
// Banked income aggregator (L2) — pure summation + invariants
// ============================================================

calcEngineRegistry.register({
  name: 'income.bankedAggregator',
  description:
    'L2 banked-income aggregator (D20): pure summation over the L1 source engines. Invariants: sources sum to banked; banked ≤ gross; gross − banked ≡ payg + help + salarySacrifice; one-offs never in run-rates.',
  category: 'CORE',
  sourcePath: 'lib/income/banked/aggregator.ts',
  execute: (input: Omit<BankedIncomeInput, 'ctx'>) => buildBankedIncome({ ...input, ctx: CTX_2026_27 }),
  fixtures: [
    {
      name: 'Mixed household: salary + rental + dividend + one-off',
      description:
        'NET salary ($217,587.50 banked / $227,519.50 gross) + $2k/mo declared rental + $1.3k/quarter dividends + a $9k one-off. Banked = 217,587.50 + 24,000 + 5,200 = 246,787.50; the one-off is excluded from every run-rate.',
      input: {
        income: [
          { id: 's', type: 'SALARY', amount: 217_587.5, frequency: 'ANNUAL', salaryType: 'NET', grossAmount: 227_519.5, isRecurring: true },
          { id: 'r', type: 'RENTAL', amount: 2_000, frequency: 'MONTHLY', propertyId: 'p-1', isRecurring: true },
          { id: 'd', type: 'INVESTMENT', amount: 1_300, frequency: 'QUARTERLY', isRecurring: true },
          { id: 'o', type: 'OTHER', amount: 9_000, frequency: 'MONTHLY', isRecurring: false },
        ],
        properties: [{ id: 'p-1', type: 'INVESTMENT' }],
        derivedAgentExpenses: [],
        transactions: [],
      },
      assertions: [
        { description: 'Banked = $246,787.50 (one-off excluded)', check: (r) => Math.abs(r.annual.banked - 246_787.5) < 1e-6 },
        { description: 'Sources sum to banked', check: (r) => Math.abs(r.annual.bySource.salary.banked + r.annual.bySource.rental.banked + r.annual.bySource.investment.banked + r.annual.bySource.other.banked - r.annual.banked) < 1e-8 },
        { description: 'banked ≤ gross', check: (r) => r.annual.banked <= r.annual.gross },
        { description: 'gross − banked ≡ withholding total (exact)', check: (r) => Math.abs(r.annual.gross - r.annual.banked - r.annual.withholding.total) < 1e-8 },
        { description: 'One-off counted once: $9,000', check: (r) => r.oneOff.total === 9_000 && r.oneOff.count === 1 },
      ],
      authoritySource: 'Hand-calc: 217,587.50 + 2,000×12 + 1,300×4 = 246,787.50; invariants per MON-131_BUILD_SPECIFICATION §4 T1 / build brief §3 (amended).',
    },
  ],
});
