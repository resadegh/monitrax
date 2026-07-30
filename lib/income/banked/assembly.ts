/**
 * MON-131 Tranche 1 — banked-income ASSEMBLY (data-access service).
 *
 * The ONE wiring layer between the database / canonical tax position and the
 * pure banked engines (CLAUDE.md §6.4: engines pure; assemblers fetch). Both
 * callers use THESE functions so the relay compare exercises the REAL future
 * path (the MON-035 parity lesson — never a shadow resolver that can mask
 * divergence):
 *
 *   1. T1-A: `/api/admin/matrix/golden-baseline/t1-income` (the old-vs-new
 *      compare the Matrix runs on live data to fill the PENDING_RELAY
 *      entries in `.audit/expected-moves-t1.json` BEFORE the flip merges).
 *   2. T1-B: `masterFinancialService` / `buildHealthInput` / `getMoneyFlow`
 *      income legs (the flip — same functions, wired as the default).
 */

import prisma from '@/lib/db';
import { monthlyRunRate } from '@/lib/utils/frequencies';
import { propertyActualsWindowStart } from '@/lib/calculations/propertyActualsWindow';
import { getCurrentTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';
import { getUserTaxPosition } from '@/lib/tax-engine/position/userTaxPosition';
import {
  computeRepaymentIncome,
  type RepaymentIncomeResult,
} from '@/lib/tax-engine/position/repaymentIncome';
import type { TaxYearConfig, TaxPositionResult } from '@/lib/tax-engine/types';
import type { CashflowExpense, CashflowTransaction } from '@/lib/calculations/propertyCashflow';
import type { BankedIncomeRow, BankedContext } from './types';
import {
  buildBankedIncome,
  buildBankedIncomeDecimal,
  type BankedIncomeResult,
  type BankedIncomeResultDecimal,
} from './aggregator';
import type { RentalBankedProperty } from './rentalBanked';

const RENT_TYPES = new Set(['RENT', 'RENTAL']);

export interface BankedRawData {
  income: BankedIncomeRow[];
  properties: RentalBankedProperty[];
  derivedAgentExpenses: CashflowExpense[];
  transactions: CashflowTransaction[];
}

/**
 * D42 C3 — assemble repayment income from the CANONICAL tax position.
 * Derivations (each labelled in componentBasis by `computeRepaymentIncome`):
 *   - taxableIncome           ← taxPosition.tax.taxableIncome
 *   - totalNetInvestmentLoss  ← net rental loss (property + depreciation
 *     deductions over rental income) + net financial-investment loss
 *     (investment deductions over dividends + interest), each floored at 0 —
 *     the ATO IT7/IT8 add-back classes, derived from the position breakdown.
 *   - reportableSuperContributions ← Σ Income.salarySacrifice (salary
 *     sacrifice is reportable; SG is NOT and is never included; personal
 *     deductible contributions are not separable from the position and are
 *     therefore OMITTED — an under-estimate, not a guess).
 *   - FHSS / reportable fringe benefits / exempt foreign employment income —
 *     not modelled → DEFAULT_ZERO, carried in componentBasis (the result is
 *     an estimate and says so; D42 C3: Reza's own figure comes from the
 *     notice of assessment, never this derivation).
 */
export function assembleRepaymentIncome(
  taxPosition: TaxPositionResult,
  incomeRows: Array<{ type: string; salarySacrifice?: number | null }>,
): RepaymentIncomeResult {
  const netRentalLoss = Math.max(
    0,
    taxPosition.deductions.property +
      taxPosition.deductions.depreciation -
      taxPosition.income.rental,
  );
  const netFinancialInvestmentLoss = Math.max(
    0,
    taxPosition.deductions.investment -
      (taxPosition.income.dividends + taxPosition.income.interest),
  );
  const reportableSuper = incomeRows
    .filter((r) => r.type === 'SALARY')
    .reduce((sum, r) => sum + (r.salarySacrifice ?? 0), 0);

  return computeRepaymentIncome({
    taxableIncome: taxPosition.tax.taxableIncome,
    totalNetInvestmentLoss: netRentalLoss + netFinancialInvestmentLoss,
    reportableSuperContributions: reportableSuper,
    // FHSS / RFB / exempt foreign employment — unmodelled, DEFAULT_ZERO.
  });
}

/** Fetch the full row set the banked engines require (every field — an
 *  input-feed omission is the MON-137 defect class). */
export async function fetchBankedRawData(userId: string): Promise<BankedRawData> {
  const [income, properties, derivedExpenses, linkedTransactions] = await Promise.all([
    prisma.income.findMany({ where: { userId } }),
    prisma.property.findMany({ where: { userId }, select: { id: true, type: true } }),
    prisma.expense.findMany({
      where: { userId, derivedFromIncomeId: { not: null } },
      select: {
        id: true,
        amount: true,
        frequency: true,
        isRecurring: true,
        derivedFromIncomeId: true,
      },
    }),
    // SAME query shape + SAME canonical actuals window as the master
    // snapshot's linked-transaction fetch (masterFinancialService
    // fetchAllUserData) — a different window here would make the compare
    // route resolve different rent actuals than the flip will (§19.4).
    prisma.unifiedTransaction.findMany({
      where: {
        userId,
        date: { gte: propertyActualsWindowStart() },
        incomeId: { not: null },
      },
      select: { incomeId: true, expenseId: true, loanId: true, date: true, amount: true },
    }),
  ]);

  return {
    income: income as unknown as BankedIncomeRow[],
    properties: properties as RentalBankedProperty[],
    derivedAgentExpenses: derivedExpenses as unknown as CashflowExpense[],
    transactions: linkedTransactions.map((t) => ({
      incomeId: t.incomeId,
      expenseId: t.expenseId,
      loanId: t.loanId,
      date: t.date,
      amount: Number(t.amount), // Prisma Decimal → number at the boundary
    })) as unknown as CashflowTransaction[],
  };
}

export interface AssembledBankedIncome {
  banked: BankedIncomeResult;
  bankedDecimal: BankedIncomeResultDecimal;
  repaymentIncome: RepaymentIncomeResult;
  config: TaxYearConfig;
}

/** Build the banked result from prefetched data + the canonical tax position
 *  (the T1-B master-snapshot call shape — master passes its own fetch). */
export function buildBankedIncomeFromData(
  data: BankedRawData,
  taxPosition: TaxPositionResult,
  config: TaxYearConfig = getCurrentTaxYearConfig(),
): Omit<AssembledBankedIncome, 'bankedDecimal'> & { bankedDecimal: BankedIncomeResultDecimal } {
  const repaymentIncome = assembleRepaymentIncome(taxPosition, data.income);
  const ctx: BankedContext = { config, repaymentIncome: repaymentIncome.repaymentIncome };
  const input = {
    income: data.income,
    properties: data.properties,
    derivedAgentExpenses: data.derivedAgentExpenses,
    transactions: data.transactions,
    ctx,
  };
  return {
    banked: buildBankedIncome(input),
    bankedDecimal: buildBankedIncomeDecimal(input),
    repaymentIncome,
    config,
  };
}

/** Fetch + assemble for a user (the compare-route call shape). */
export async function assembleBankedIncomeForUser(userId: string): Promise<AssembledBankedIncome> {
  const [data, taxBundle] = await Promise.all([
    fetchBankedRawData(userId),
    getUserTaxPosition(userId),
  ]);
  return buildBankedIncomeFromData(data, taxBundle.taxPosition);
}

/**
 * Per-row banked MONTHLY values — the row-level feed for consumers that carry
 * per-row income (health input rows, money-flow per-entity splits).
 *
 * Rental streams are pooled at the property level (the canonical engine), so
 * per-row attribution redistributes the property's banked monthly across its
 * rows proportionally to their declared run-rates (equal split when the
 * declared total is 0). The SUM per property equals the pooled banked value
 * by construction — attribution is presentational, the total is the quantity.
 */
export function bankedMonthlyPerRow(
  banked: BankedIncomeResult,
  rows: BankedIncomeRow[],
): Map<string, number> {
  const out = new Map<string, number>();

  for (const r of banked.salaryRows) {
    if (r.id) out.set(r.id, r.bankedAnnual / 12);
  }
  for (const r of banked.otherRows) {
    if (r.id) out.set(r.id, r.bankedAnnual / 12);
  }

  const misattached = new Set(banked.rental.misattachedRows.map((m) => m.incomeId));
  for (const pp of banked.rental.perProperty) {
    const propertyRows = rows.filter(
      (r) => r.propertyId === pp.propertyId && RENT_TYPES.has(r.type) && !misattached.has(r.id),
    );
    const declaredTotal = propertyRows.reduce(
      (sum, r) =>
        sum + (r.isRecurring === false ? 0 : Math.max(0, r.amount)),
      0,
    );
    for (const r of propertyRows) {
      if (!r.id) continue;
      const share =
        declaredTotal > 0
          ? (r.isRecurring === false ? 0 : Math.max(0, r.amount)) / declaredTotal
          : 1 / propertyRows.length;
      out.set(r.id, pp.bankedMonthly * share);
    }
  }

  // Non-property rental rows: their own gated run-rate (same canonical
  // converter the rental engine used to build nonPropertyBankedAnnual).
  for (const r of rows) {
    if (!r.id || out.has(r.id)) continue;
    if (RENT_TYPES.has(r.type) && !r.propertyId) {
      out.set(r.id, monthlyRunRate({ amount: r.amount, frequency: r.frequency, isRecurring: r.isRecurring }));
    }
  }

  // Misattached tenanted-residence rows and anything unresolved: 0, flagged
  // upstream — never silently counted.
  for (const r of rows) {
    if (r.id && !out.has(r.id)) out.set(r.id, 0);
  }

  return out;
}
