/**
 * MON-131 Tranche 1 — L2 BANKED-INCOME AGGREGATOR (D17 / D20).
 *
 * PURE SUMMATION over the L1 source engines — no arithmetic of its own
 * beyond addition and /12. This is the only component that sees every
 * source, so its load-bearing invariant is:
 *
 *     Σ bySource.banked ≡ banked   (sources sum to the total — permanent test)
 *
 * plus the identity set the tranche restores (build brief §3, amended):
 *     banked ≤ gross                         (Float and Decimal)
 *     gross − banked ≡ payg + help + salarySacrifice   (exact, by construction)
 *     annual ≡ monthly × 12                  (each field)
 *
 * `projectAggregation` is the COMPATIBILITY PROJECTION onto the legacy
 * `IncomeAggregation` shape (grossTotal / netTotal / paygWithholding /
 * byType / taxableIncome / nonTaxableIncome) used at the T1-B flip so the
 * master snapshot's serialized paths stay stable while the PRODUCER changes.
 * In that projection `netTotal` CARRIES THE BANKED QUANTITY — the field name
 * survives one tranche for baseline path-continuity (expected-moves file
 * declares moves per existing path); the rename to `banked*` on the wire is
 * queued in the coverage boundary, and every engine-level name here is
 * already D17-compliant ("banked", never "net income").
 */

import type { IncomeAggregation } from '@/lib/calculations/incomeAggregator';
import { Decimal, toDecimal } from '@/lib/decimal';
import type { CashflowExpense, CashflowTransaction } from '@/lib/calculations/propertyCashflow';
import type { BankedIncomeRow, BankedContext, BankedRowResult } from './types';
import { computeSalaryBanked, computeSalaryBankedDecimal, type SalaryBankedResult } from './salaryBanked';
import {
  computeRentalBanked,
  computeRentalBankedDecimal,
  type RentalBankedInput,
  type RentalBankedProperty,
  type RentalBankedResult,
} from './rentalBanked';
import { computeReceivedBanked, computeReceivedBankedDecimal } from './receivedBanked';

const RENT_TYPES = new Set(['RENT', 'RENTAL']);

export interface BankedIncomeInput {
  income: BankedIncomeRow[];
  properties: RentalBankedProperty[];
  derivedAgentExpenses: CashflowExpense[];
  transactions: CashflowTransaction[];
  ctx: BankedContext;
}

export interface BankedSourceTotals {
  banked: number;
  gross: number;
}

export interface BankedIncomeResult {
  /** All figures ANNUAL; monthly = annual / 12 (the identity is definitional). */
  annual: {
    banked: number;
    /** Gross where establishable; rows with undetermined gross contribute
     *  their banked value (floor, flagged) so gross ≥ banked always holds. */
    gross: number;
    /** Gross over rows with `isTaxable !== false` — the LEGACY semantic of
     *  `cashflow.taxableIncome` only (a gross-basis run-rate, NOT the tax
     *  engine's taxable income; the T4 reconciliation renames it). */
    grossTaxable: number;
    withholding: { payg: number; help: number; salarySacrifice: number; total: number };
    bySource: {
      salary: BankedSourceTotals;
      rental: BankedSourceTotals;
      investment: BankedSourceTotals;
      other: BankedSourceTotals;
    };
  };
  /** One-off receipts counted ONCE (never in any run-rate above). */
  oneOff: { total: number; count: number };
  salaryRows: SalaryBankedResult[];
  rental: RentalBankedResult;
  otherRows: BankedRowResult[];
  undetermined: string[];
  flags: string[];
}

export function buildBankedIncome(input: BankedIncomeInput): BankedIncomeResult {
  const salaryInputRows = input.income.filter((r) => r.type === 'SALARY');
  const salaryRows = salaryInputRows.map((r) => computeSalaryBanked(r, input.ctx));

  const rentalInput: RentalBankedInput = {
    properties: input.properties,
    income: input.income,
    derivedAgentExpenses: input.derivedAgentExpenses,
    transactions: input.transactions,
  };
  const rental = computeRentalBanked(rentalInput);

  const otherInputRows = input.income.filter((r) => r.type !== 'SALARY' && !RENT_TYPES.has(r.type));
  const otherRows = otherInputRows.map((r) =>
    computeReceivedBanked(r, r.type === 'INVESTMENT' ? 'investment' : 'other'),
  );

  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const salaryBanked = sum(salaryRows.map((r) => r.bankedAnnual));
  // Undetermined gross contributes banked as the floor — flagged, never
  // fabricated upward, and keeps gross ≥ banked structurally true.
  const salaryGross = sum(salaryRows.map((r) => r.grossAnnual ?? r.bankedAnnual));
  const investmentRows = otherRows.filter((r) => r.source === 'investment');
  const plainOtherRows = otherRows.filter((r) => r.source === 'other');

  const bySource = {
    salary: { banked: salaryBanked, gross: salaryGross },
    rental: { banked: rental.bankedAnnual, gross: rental.bankedAnnual },
    investment: {
      banked: sum(investmentRows.map((r) => r.bankedAnnual)),
      gross: sum(investmentRows.map((r) => r.grossAnnual ?? r.bankedAnnual)),
    },
    other: {
      banked: sum(plainOtherRows.map((r) => r.bankedAnnual)),
      gross: sum(plainOtherRows.map((r) => r.grossAnnual ?? r.bankedAnnual)),
    },
  };

  const payg = sum(salaryRows.map((r) => r.components.payg ?? 0));
  const help = sum(salaryRows.map((r) => r.components.help ?? 0));
  const salarySacrifice = sum(salaryRows.map((r) => r.components.salarySacrifice));

  const banked =
    bySource.salary.banked + bySource.rental.banked + bySource.investment.banked + bySource.other.banked;
  const gross =
    bySource.salary.gross + bySource.rental.gross + bySource.investment.gross + bySource.other.gross;

  // Legacy `cashflow.taxableIncome` semantic (gross-basis run-rate over
  // isTaxable !== false rows). Rental streams count as taxable — the tax
  // engine, not this field, owns the real base.
  const grossTaxable =
    sum(
      salaryRows.map((r, i) =>
        salaryInputRows[i].isTaxable !== false ? (r.grossAnnual ?? r.bankedAnnual) : 0,
      ),
    ) +
    bySource.rental.gross +
    sum(
      otherRows.map((r, i) =>
        otherInputRows[i].isTaxable !== false ? (r.grossAnnual ?? r.bankedAnnual) : 0,
      ),
    );

  const oneOffValues = [
    ...salaryRows.map((r) => r.oneOffAmount),
    rental.oneOffAmount,
    ...otherRows.map((r) => r.oneOffAmount),
  ].filter((v) => v > 0);

  const undetermined = [
    ...new Set([...salaryRows.flatMap((r) => r.undetermined), ...otherRows.flatMap((r) => r.undetermined)]),
  ];
  const flags = [
    ...new Set([
      ...salaryRows.flatMap((r) => r.flags),
      ...rental.flags,
      ...otherRows.flatMap((r) => r.flags),
    ]),
  ];

  return {
    annual: {
      banked,
      gross,
      grossTaxable,
      withholding: { payg, help, salarySacrifice, total: payg + help + salarySacrifice },
      bySource,
    },
    oneOff: { total: sum(oneOffValues), count: oneOffValues.length },
    salaryRows,
    rental,
    otherRows,
    undetermined,
    flags,
  };
}

// =============================================================================
// Legacy-shape projection (used at the T1-B flip)
// =============================================================================

export type AggregationSubset = 'all' | 'primary' | 'secondary' | 'passive';

/**
 * Project the banked result onto the legacy `IncomeAggregation` shape.
 * `netTotal` carries BANKED (see file header); `paygWithholding` carries the
 * withholding-proper wedge (payg + help — salary sacrifice is not
 * withholding); `byType` keys match the historical type names.
 * `taxableIncome`/`nonTaxableIncome` keep the legacy isTaxable!==false gross
 * semantics at the subset level — the real taxable basis is Layer 3's.
 */
export function projectAggregation(
  result: BankedIncomeResult,
  subset: AggregationSubset,
  targetFrequency: 'monthly' | 'annual',
): IncomeAggregation {
  const div = targetFrequency === 'monthly' ? 12 : 1;
  const s = result.annual.bySource;

  const include = {
    salary: subset === 'all' || subset === 'primary',
    rental: subset === 'all' || subset === 'secondary' || subset === 'passive',
    investment: subset === 'all' || subset === 'secondary' || subset === 'passive',
    other: subset === 'all' || subset === 'secondary',
  };

  const byType: IncomeAggregation['byType'] = {};
  if (include.salary && (s.salary.banked !== 0 || s.salary.gross !== 0)) {
    byType.SALARY = { gross: s.salary.gross / div, net: s.salary.banked / div };
  }
  if (include.rental && result.rental.bankedAnnual !== 0) {
    byType.RENTAL = { gross: s.rental.gross / div, net: s.rental.banked / div };
  }
  if (include.investment && (s.investment.banked !== 0 || s.investment.gross !== 0)) {
    byType.INVESTMENT = { gross: s.investment.gross / div, net: s.investment.banked / div };
  }
  if (include.other && (s.other.banked !== 0 || s.other.gross !== 0)) {
    byType.OTHER = { gross: s.other.gross / div, net: s.other.banked / div };
  }

  const gross = Object.values(byType).reduce((a, t) => a + t.gross, 0);
  const banked = Object.values(byType).reduce((a, t) => a + t.net, 0);
  const withholding = include.salary
    ? (result.annual.withholding.payg + result.annual.withholding.help) / div
    : 0;

  return {
    grossTotal: gross,
    netTotal: banked,
    paygWithholding: withholding,
    byType,
    taxableIncome: gross, // legacy-compat subset semantics; Layer 3 owns the real base
    nonTaxableIncome: 0,
  };
}

// =============================================================================
// Decimal sibling — same summation, Decimal arithmetic.
// =============================================================================

export interface BankedIncomeResultDecimal {
  annual: {
    banked: Decimal;
    gross: Decimal;
    withholding: { payg: Decimal; help: Decimal; salarySacrifice: Decimal; total: Decimal };
    bySource: Record<'salary' | 'rental' | 'investment' | 'other', { banked: Decimal; gross: Decimal }>;
  };
  oneOff: { total: Decimal; count: number };
  undetermined: string[];
  flags: string[];
}

export function buildBankedIncomeDecimal(input: BankedIncomeInput): BankedIncomeResultDecimal {
  const ZERO = new Decimal(0);
  const dsum = (xs: Decimal[]) => xs.reduce((a, b) => a.plus(b), ZERO);

  const salaryRows = input.income
    .filter((r) => r.type === 'SALARY')
    .map((r) => computeSalaryBankedDecimal(r, input.ctx));
  const rental = computeRentalBankedDecimal({
    properties: input.properties,
    income: input.income,
    derivedAgentExpenses: input.derivedAgentExpenses,
    transactions: input.transactions,
  });
  const otherRows = input.income
    .filter((r) => r.type !== 'SALARY' && !RENT_TYPES.has(r.type))
    .map((r) => computeReceivedBankedDecimal(r, r.type === 'INVESTMENT' ? 'investment' : 'other'));

  const salaryBanked = dsum(salaryRows.map((r) => r.bankedAnnual));
  const salaryGross = dsum(salaryRows.map((r) => r.grossAnnual ?? r.bankedAnnual));
  const investmentRows = otherRows.filter((r) => r.source === 'investment');
  const plainOtherRows = otherRows.filter((r) => r.source === 'other');

  const bySource = {
    salary: { banked: salaryBanked, gross: salaryGross },
    rental: { banked: rental.bankedAnnual, gross: rental.bankedAnnual },
    investment: {
      banked: dsum(investmentRows.map((r) => r.bankedAnnual)),
      gross: dsum(investmentRows.map((r) => r.grossAnnual)),
    },
    other: {
      banked: dsum(plainOtherRows.map((r) => r.bankedAnnual)),
      gross: dsum(plainOtherRows.map((r) => r.grossAnnual)),
    },
  };

  const payg = dsum(salaryRows.map((r) => r.components.payg ?? ZERO));
  const help = dsum(salaryRows.map((r) => r.components.help ?? ZERO));
  const salarySacrifice = dsum(salaryRows.map((r) => r.components.salarySacrifice));

  const banked = bySource.salary.banked
    .plus(bySource.rental.banked)
    .plus(bySource.investment.banked)
    .plus(bySource.other.banked);
  const gross = bySource.salary.gross
    .plus(bySource.rental.gross)
    .plus(bySource.investment.gross)
    .plus(bySource.other.gross);

  const oneOffValues = [
    ...salaryRows.map((r) => r.oneOffAmount),
    rental.oneOffAmount,
    ...otherRows.map((r) => r.oneOffAmount),
  ].filter((v) => v.gt(0));

  return {
    annual: {
      banked,
      gross,
      withholding: { payg, help, salarySacrifice, total: payg.plus(help).plus(salarySacrifice) },
      bySource,
    },
    oneOff: { total: dsum(oneOffValues), count: oneOffValues.length },
    undetermined: [
      ...new Set([...salaryRows.flatMap((r) => r.undetermined)]),
    ],
    flags: [
      ...new Set([...salaryRows.flatMap((r) => r.flags), ...rental.flags]),
    ],
  };
}
