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
  assembleRepaymentIncome,
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

// D42 C3 — `assembleRepaymentIncome` moved to its pure home,
// `lib/tax-engine/position/repaymentIncome.ts` (T1-B §1.1: the two-pass in
// `getUserTaxPosition` needs it without a module cycle through this
// prisma-coupled assembler). Re-exported so this module remains the wiring
// surface for banked-income callers — still ONE producer (§12.2.1).
export { assembleRepaymentIncome };

/**
 * MON-140 — THE income-row select for every banked-engine feed (§12.2.1
 * applied to the INPUT, not just the producer).
 *
 * VR-044 proved the producer being canonical is not sufficient: at the T1-B
 * flip `masterFinancialService` fed the ONE engine a `select`-narrowed row
 * that omitted `isRecurring`, so the one-off gate (`row.isRecurring === false`
 * in salaryBanked/receivedBanked/rentalBanked) never fired and 10 one-off rows
 * annualised ×12 — $158,401.44/yr of income that was never received, on the
 * Home tile, while `moneyFlowService` (fed by `fetchBankedRawData`, which
 * selects nothing and therefore selects everything) returned the correct
 * total. Same engine, two feeds, two answers: the MON-028 class.
 *
 * Any caller that hands rows to the banked engines uses THIS constant. A
 * consumer needing extra columns spreads it and adds its own — it must never
 * hand-roll the banked subset. Ratcheted by
 * `tests/income/bankedInputFeed.test.ts`.
 */
export const BANKED_INCOME_SELECT = {
  id: true,
  type: true,
  name: true,
  amount: true,
  frequency: true,
  // The one-off gate. Omitting this silently annualises one-offs (VR-044).
  isRecurring: true,
  salaryType: true,
  grossAmount: true,
  netAmount: true,
  paygWithholding: true,
  // T1 FACT fields — omitting these silently downgrades the basis hierarchy
  // from FACT to DERIVED without any flag (D33).
  actualNetPay: true,
  salarySacrifice: true,
  helpLoanDeclared: true,
  isTaxable: true,
  propertyId: true,
  investmentAccountId: true,
  ownerEntityId: true,
  rentalMode: true,
} as const;

/** Fetch the full row set the banked engines require (every field — an
 *  input-feed omission is the MON-137/MON-140 defect class). */
export async function fetchBankedRawData(userId: string): Promise<BankedRawData> {
  const [income, properties, derivedExpenses, linkedTransactions] = await Promise.all([
    prisma.income.findMany({ where: { userId }, select: BANKED_INCOME_SELECT }),
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
  /** The raw fetched rows the result was built from — for consumers that
   *  need per-row attribution (`bankedMonthlyPerRow`) or row metadata
   *  (ownerEntityId / sourceType classification). Same objects, one fetch. */
  raw: BankedRawData;
}

/** Build the banked result from prefetched data + the canonical tax position
 *  (the T1-B master-snapshot call shape — master passes its own fetch). */
export function buildBankedIncomeFromData(
  data: BankedRawData,
  taxPosition: TaxPositionResult,
  config: TaxYearConfig = getCurrentTaxYearConfig(),
): Omit<AssembledBankedIncome, 'raw'> {
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
  return { ...buildBankedIncomeFromData(data, taxBundle.taxPosition), raw: data };
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
