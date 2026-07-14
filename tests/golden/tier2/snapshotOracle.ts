/**
 * NEOAUDIT §2 TIER 2 — the INDEPENDENT snapshot oracle (a second derivation).
 *
 * A from-scratch Decimal re-derivation of the master snapshot's HEADLINE numbers
 * from golden-shaped rows. It shares NO code with `masterFinancialService` — it
 * re-encodes the documented rules directly (net worth = Σassets − Σliabilities
 * with the SMSF/SOLD exclusions; recurring-only monthly expenses; frequency
 * factors hardcoded from the ATO/periods-per-year convention). So comparing the
 * production snapshot against this oracle across many mutated fixtures catches
 * COMBINATION / composition / mapping drift — the engine is never checked against
 * itself (§2 Tier 2). Decimal arithmetic makes it a genuinely distinct path.
 *
 * ANCHORING: `tier2Oracle.test.ts` first asserts this oracle reproduces the
 * hand-computed golden manifest (`EXPECTED`), so the oracle is tied to the §19.2
 * hand computation BEFORE it is trusted to judge the engine on mutations — it is
 * NOT a "hidden mini-engine that produces a false green" (§22).
 *
 * HONEST SCOPE (the assumptions that keep the oracle simple + faithful — the
 * mutation generator respects them so oracle and engine agree by construction on
 * a CORRECT engine):
 *  - Income net == gross (no PAYG): the golden book uses NET salary + non-PAYG
 *    income, and mutations only add non-PAYG income. GROSS-salary PAYG math is
 *    Ring-0's job, not this oracle's.
 *  - ≤ 1 rental row per property: so the MON-009 rental dedup is the identity and
 *    monthly income is a plain frequency-summed total. (Rental fragmentation has
 *    its own dedicated tests.)
 *  - Declared basis (no transactions): actuals resolution is Ring-0/Tier-3.
 */
import { toDecimalRequired, type Decimal } from '@/lib/decimal';

const D = (n: unknown): Decimal => toDecimalRequired((n as number) ?? 0);

// Periods-per-year — re-derived here (NOT imported from lib/utils/frequencies, so
// the oracle stays an independent path). Matches lib/utils/frequencies.ts.
const PERIODS_PER_YEAR: Record<string, number> = {
  WEEKLY: 52, FORTNIGHTLY: 26, MONTHLY: 12, QUARTERLY: 4, HALF_YEARLY: 2, ANNUAL: 1,
};
const monthly = (amount: unknown, freq: string): Decimal =>
  D(amount).mul(PERIODS_PER_YEAR[freq] ?? 12).div(12);

export interface OracleSnapshot {
  assets: { properties: number; accounts: number; investments: number; superannuation: number; personalAssets: number; total: number };
  liabilities: { mortgages: number; personalLoans: number; creditCards: number; total: number };
  netWorth: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyRepayments: number;
  monthlyCashflow: number;
  savingsRate: number;
}

type Rows = Record<string, Record<string, unknown>[]>;
const round2 = (d: Decimal) => d.toDecimalPlaces(2).toNumber();

/** Re-derive the snapshot headline numbers from golden-shaped rows (Decimal). */
export function deriveOracle(rows: Rows): OracleSnapshot {
  const sum = (arr: Record<string, unknown>[] | undefined, f: (r: Record<string, unknown>) => Decimal) =>
    (arr ?? []).reduce((acc, r) => acc.add(f(r)), D(0));

  // ── Assets ──
  const properties = sum(rows.property, (p) => D(p.currentValue));
  const accounts = sum(rows.account, (a) => D(a.currentBalance));
  const holdings = sum(rows.investmentHolding, (h) =>
    D(h.units).mul(D((h.currentPrice as number) || (h.averagePrice as number) || 0)));
  const invCash = sum(rows.investmentAccount, (ia) => D(ia.cashBalance));
  const investments = holdings.add(invCash);
  const superannuation = sum((rows.superannuationAccount ?? []).filter((s) => s.fundType !== 'SMSF'), (s) => D(s.currentBalance));
  const personalAssets = sum((rows.asset ?? []).filter((a) => a.status !== 'SOLD'), (a) => D(a.currentValue));
  const assetsTotal = properties.add(accounts).add(investments).add(superannuation).add(personalAssets);

  // ── Liabilities — from LOANS, classified exactly like netWorthCalculator.ts:216-221
  //    (mortgage if HOME/INVESTMENT type OR has a propertyId; creditCard if
  //    CREDIT_CARD type; else personal). A CREDIT_CARD *account* is an ASSET
  //    (counted in `accounts` above, like the engine) — credit-card DEBT is a
  //    CREDIT_CARD *loan*.
  const classify = (l: Record<string, unknown>): 'mortgage' | 'creditCard' | 'personal' => {
    const t = String(l.type ?? '').toUpperCase();
    if (t === 'HOME' || t === 'INVESTMENT' || l.propertyId) return 'mortgage';
    if (t === 'CREDIT_CARD') return 'creditCard';
    return 'personal';
  };
  const mortgages = sum((rows.loan ?? []).filter((l) => classify(l) === 'mortgage'), (l) => D(l.principal));
  const personalLoans = sum((rows.loan ?? []).filter((l) => classify(l) === 'personal'), (l) => D(l.principal));
  const creditCards = sum((rows.loan ?? []).filter((l) => classify(l) === 'creditCard'), (l) => D(l.principal));
  const liabilitiesTotal = mortgages.add(personalLoans).add(creditCards);

  const netWorth = assetsTotal.sub(liabilitiesTotal);

  // ── Flows (monthly) ──
  const monthlyIncome = sum(rows.income, (i) => monthly(i.amount, i.frequency as string));
  const monthlyExpenses = sum((rows.expense ?? []).filter((e) => e.isRecurring !== false), (e) => monthly(e.amount, e.frequency as string));
  const monthlyRepayments = sum(rows.loan, (l) => monthly(l.minRepayment, l.repaymentFrequency as string));
  const monthlyCashflow = monthlyIncome.sub(monthlyExpenses).sub(monthlyRepayments);
  const savingsRate = monthlyIncome.gt(0) ? monthlyCashflow.div(monthlyIncome).mul(100) : D(0);

  return {
    assets: {
      properties: properties.toNumber(), accounts: accounts.toNumber(), investments: investments.toNumber(),
      superannuation: superannuation.toNumber(), personalAssets: personalAssets.toNumber(), total: assetsTotal.toNumber(),
    },
    liabilities: {
      mortgages: mortgages.toNumber(), personalLoans: personalLoans.toNumber(),
      creditCards: creditCards.toNumber(), total: liabilitiesTotal.toNumber(),
    },
    netWorth: netWorth.toNumber(),
    monthlyIncome: round2(monthlyIncome),
    monthlyExpenses: round2(monthlyExpenses),
    monthlyRepayments: round2(monthlyRepayments),
    monthlyCashflow: round2(monthlyCashflow),
    savingsRate: round2(savingsRate),
  };
}
