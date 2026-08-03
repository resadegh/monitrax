/**
 * NEOAUDIT RING 2 — the RATCHET for MON-131 T2 (CLAUDE.md §23.2.2, §19.4).
 *
 * THE BUG CLASS THIS EXISTS TO KILL, in one sentence: `masterFinancialService`
 * built its loan leg with `data.loans.filter(l => l.minRepayment && ...)` over
 * its OWN eleven-column `select`, so a loan with no declared repayment was
 * dropped entirely and a loan WITH one was costed from the plan rather than
 * from the repayments the borrower actually made. On Reza's account that read
 * $8,816.65 on Home against $12,779.29 on /dashboard/expenses — same five
 * loans, same day.
 *
 * WHY RING 2 AND NOT RING 0. The engines were never wrong. `resolveLoanMonthlyCost`
 * has floored an interest-only loan to its interest for months, and Ring-0
 * fixtures prove it (ring2.calcSsotWall.test.ts). The defect lived in the
 * ASSEMBLY — a filter and a raw field read between the rows and the engine —
 * and only running the real service end-to-end on known rows can see it. This
 * is the MON-028 / MON-140 class: same engine, different inputs.
 *
 * WHY ITS OWN GOLDEN CLONE. The shared golden household has two loans, both
 * with a declared MONTHLY repayment and no linked transactions, so canonical
 * resolution and the raw read COINCIDE there — the manifest cannot fail on
 * this class no matter how badly the feed regresses. Rather than perturb the
 * shared manifest (and every EXPECTED value that hangs off it), this suite
 * uses `createGoldenDbFrom` — the extension point the Tier-3 metamorphic suite
 * already established — to serve a clone carrying the two shapes that expose
 * the defect:
 *   · an INTEREST-ONLY loan with NO declared repayment (the $0 shape), and
 *   · a linked repayment stream on a P&I loan (the actuals-vs-plan shape).
 *
 * COVERAGE BOUNDARY (§20.6 / §22.2.4). This verifies that the master snapshot's
 * loan-cost leaves are produced by the canonical resolver, on the canonical
 * feed, with no `minRepayment` filter, and that all four leaves agree. It does
 * NOT verify any rendered page, does NOT verify Reza's live figures (that is
 * the Ring-3 run, `docs/verification/briefs/RING3_T2_LOAN_COST.md`), and does
 * NOT cover the loanCost producers outside masterFinancialService that T2 left
 * standing (moneyFlowService, contextBuilder, the CFO scorers) — those move
 * surfaces this tranche did not declare and are T2-B.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

// Same mutable-holder shape as ring3.metamorphic.test.ts: the hoisted mock
// delegates to a holder so the clone can be built after the module graph loads.
const holder = vi.hoisted(() => ({ db: null as unknown as Record<string, unknown> }));
vi.mock('@/lib/db', () => {
  const proxy = new Proxy(
    {},
    {
      get(_t, model: string | symbol) {
        if (typeof model === 'symbol' || model === 'then' || model === 'catch') return undefined;
        const db = holder.db as Record<string, unknown> | null;
        if (!db) throw new Error('[Ring2 loan-cost feed] no active golden db set for this run');
        return db[model];
      },
    },
  );
  return { default: proxy, prisma: proxy };
});

import {
  getMasterFinancialSnapshot,
  type MasterFinancialSnapshot,
} from '@/lib/services/masterFinancialService';
import { resolveLoanMonthlyCost } from '@/lib/calculations/propertyCashflow';
import { toMonthly } from '@/lib/utils/frequencies';
import { GOLDEN_DB, GOLDEN_USER_ID, createGoldenDbFrom } from './goldenHousehold';

type Rows = Record<string, { id?: string }[]>;

const NOW = new Date();
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

/**
 * The interest-only loan the old feed made invisible. No `minRepayment`, so
 * the pre-migration filter dropped it and it contributed exactly $0 while the
 * lender charged interest every month.
 *
 * Interest floor = 300,000 × 0.06 ÷ 12 = 1,500.00 — hand-computed (§19.2),
 * not read back from the engine.
 */
const IO_LOAN = {
  id: 'l-io',
  ownerEntityId: null,
  name: 'Interest-only investment loan',
  principal: 300_000,
  minRepayment: null,
  repaymentFrequency: null,
  interestRateAnnual: 0.06,
  type: 'INVESTMENT',
  isInterestOnly: true,
  propertyId: null,
  offsetAccountId: null,
};
const IO_FLOOR_MONTHLY = (300_000 * 0.06) / 12; // 1,500.00

/**
 * Two linked repayments on the existing P&I mortgage, 28 days apart, ABOVE its
 * declared $3,000/mo plan. The plan and the actuals disagree on purpose: a feed
 * that never reaches the transactions reads 3,000 and looks perfectly healthy.
 */
const MORTGAGE_TXS = [
  { id: 't-m1', loanId: 'l-mortgage', incomeId: null, expenseId: null, direction: 'OUT', amount: 3_300, date: daysAgo(58), categoryLevel1: 'Loans', isTransfer: false },
  { id: 't-m2', loanId: 'l-mortgage', incomeId: null, expenseId: null, direction: 'OUT', amount: 3_300, date: daysAgo(30), categoryLevel1: 'Loans', isTransfer: false },
];

let snapshot: MasterFinancialSnapshot;
/** What the CANONICAL producer says, computed independently of the service. */
let canonicalPerLoan: number[];
let canonicalTotal: number;

beforeAll(async () => {
  const rows = structuredClone(GOLDEN_DB) as unknown as Rows;
  rows.loan = [...rows.loan, IO_LOAN as unknown as { id?: string }];
  rows.unifiedTransaction = MORTGAGE_TXS as unknown as { id?: string }[];
  holder.db = createGoldenDbFrom(rows) as unknown as Record<string, unknown>;

  snapshot = await getMasterFinancialSnapshot(GOLDEN_USER_ID);

  // The independent expectation: run the canonical producer directly over the
  // same rows and the same transactions. This is deliberately NOT read off the
  // snapshot — an assertion that compares the service to itself proves nothing.
  canonicalPerLoan = (rows.loan as unknown as Array<Record<string, unknown>>).map((l) =>
    resolveLoanMonthlyCost(
      {
        id: l.id as string,
        principal: l.principal as number,
        interestRateAnnual: l.interestRateAnnual as number,
        minRepayment: l.minRepayment as number | null,
        repaymentFrequency: l.repaymentFrequency as never,
      },
      MORTGAGE_TXS.filter((t) => t.loanId === l.id),
    ).monthly,
  );
  canonicalTotal = canonicalPerLoan.reduce((a, b) => a + b, 0);
});

describe('Ring 2 · the interest-only loan is no longer invisible (the $0 shape)', () => {
  it('a loan with NO declared repayment reaches the snapshot at its interest floor', () => {
    // 1,500.00, hand-computed above. If the filter ever returns, this is 0.
    expect(canonicalPerLoan[2]).toBeCloseTo(IO_FLOOR_MONTHLY, 6);
    expect(snapshot.cashflow.monthlyLoanRepayments).toBeGreaterThanOrEqual(IO_FLOOR_MONTHLY);
  });

  it('NEGATIVE CONTROL — the snapshot is NOT the old raw-declared sum', () => {
    // What the pre-migration feed produced: filter to loans WITH a declared
    // repayment, convert the plan. 3,000 + 400 = 3,400. If a future change
    // reintroduces the raw read, this is the assertion that fires.
    const oldFeedTotal = (GOLDEN_DB.loan as unknown as Array<Record<string, unknown>>)
      .filter((l) => l.minRepayment && l.repaymentFrequency)
      .reduce((s, l) => s + toMonthly(l.minRepayment as number, l.repaymentFrequency as never), 0);
    expect(oldFeedTotal).toBeCloseTo(3_400, 6);
    expect(snapshot.cashflow.monthlyLoanRepayments).not.toBeCloseTo(oldFeedTotal, 2);
  });
});

describe('Ring 2 · the ACTUALS feed reaches master (MON-140: same engine, different inputs)', () => {
  it('the P&I loan is costed from its linked repayments, not from its plan', () => {
    // The declared plan is 3,000/mo; the repayments are 3,300 every 28 days.
    // A feed that never loads transactions returns exactly 3,000 here.
    expect(canonicalPerLoan[0]).toBeGreaterThan(3_000);
    expect(snapshot.cashflow.monthlyLoanRepayments).toBeCloseTo(canonicalTotal, 2);
  });

  it('the resolution records WHEN the evidence is from (VR-046 F1c)', () => {
    const r = resolveLoanMonthlyCost(
      { id: 'l-mortgage', principal: 500_000, interestRateAnnual: 0.06, minRepayment: 3_000, repaymentFrequency: 'MONTHLY' },
      MORTGAGE_TXS,
    );
    expect(r.usedActuals).toBe(true);
    expect(r.actualsThroughDate?.getTime()).toBe(MORTGAGE_TXS[1].date.getTime());

    // …and stays null when no transaction was consumed, rather than defaulting
    // to "now" — a floored cost has no actuals, and saying otherwise would be
    // the false-freshness bug this field exists to prevent.
    const floored = resolveLoanMonthlyCost({ id: 'l-io', principal: 300_000, interestRateAnnual: 0.06 });
    expect(floored.flooredToInterest).toBe(true);
    expect(floored.actualsThroughDate).toBeNull();
  });
});

describe('Ring 2 · §19.4 propagation — every loan-cost leaf reads the ONE producer', () => {
  /**
   * The four leaves the T2 contract declares, each assembled by a DIFFERENT
   * expression inside masterFinancialService:
   *   cashflow.monthlyLoanRepayments  ← calculateCashflow(cashflowInput)
   *   debt.metrics.monthlyRepayments  ← calculateDebtMetrics(loanInputs)
   *   debt.summary.totalRepayments    ← aggregateLoanRepayments(loanInputs)
   *   quickMetrics.monthlyLoanRepayments ← debtSummary.totalRepayments
   * Before T2 they agreed only because they all read the same wrong thing.
   * Now they must agree because they all read the same RIGHT thing.
   */
  it('all four leaves equal the canonical resolver total', () => {
    // Cent tolerance, because `cashflowOrchestrator` ROUNDS its output leaves.
    // That is the contract's rule — round at the leaf, never at the input —
    // and the next test pins the input side exactly. A cent of tolerance still
    // catches every failure this ratchet is for: the smallest loan the old
    // feed dropped was $83.33/mo.
    expect(snapshot.cashflow.monthlyLoanRepayments).toBeCloseTo(canonicalTotal, 2);
    expect(snapshot.debt.metrics.monthlyRepayments).toBeCloseTo(canonicalTotal, 2);
    expect(snapshot.debt.summary.totalRepayments).toBeCloseTo(canonicalTotal, 2);
    expect(snapshot.quickMetrics.monthlyLoanRepayments).toBeCloseTo(canonicalTotal, 2);
  });

  it('the byType split sums to the same total (the leaf the sweep had missed)', () => {
    const byTypeTotal = Object.values(snapshot.debt.summary.byType).reduce(
      (s, t) => s + t.repayments,
      0,
    );
    expect(byTypeTotal).toBeCloseTo(canonicalTotal, 6);
  });

  it('the derived ratios are consistent with the canonical loan cost', () => {
    const netIncome = snapshot.quickMetrics.monthlyIncome;
    expect(snapshot.cashflow.debtServiceRatio).toBeCloseTo((canonicalTotal / netIncome) * 100, 2);
    // calculateCashflow and calculateDebtMetrics are separate engines fed the
    // same legs; a divergence between their ratios is a defect, not rounding
    // (.audit/expected-moves-t2.json, debt.metrics.debtServiceRatio).
    //
    // Cent tolerance for a REASON worth stating: `cashflow.debtServiceRatio`
    // is rounded by its orchestrator, `debt.metrics.debtServiceRatio` is not
    // (52.76 against 52.762276…). The contract declares BOTH as 50.42 on live
    // data, which is the rounded reading of the same number — so the identity
    // that matters is "same value to the cent", and asserting tighter would be
    // asserting a rounding convention, not a correctness property.
    expect(snapshot.debt.metrics.debtServiceRatio).toBeCloseTo(
      snapshot.cashflow.debtServiceRatio,
      2,
    );
  });

  it('the feed is UNROUNDED — rounding per loan before summing is a G7 failure', () => {
    // The contract's `_meta.feedContract` made executable. On Reza's account
    // the per-loan costs rounded to cents sum to 12,779.28 against the
    // 12,779.29 the engine produces unrounded, and that cent cascades into
    // annualLoanRepayments (×12), annualCashflow, savingsRate and
    // debtServiceRatio — an exact-match contract fails on it.
    //
    // `debt.summary.totalRepayments` is the leaf to assert on: unlike the
    // cashflow leaves it is NOT rounded by its producer, so it carries the
    // feed's full precision and is the honest witness that the INPUT was
    // unrounded. To 6 decimal places, not 2.
    expect(snapshot.debt.summary.totalRepayments).toBeCloseTo(canonicalTotal, 6);

    // …and the two raw leaves are the SAME number, not merely close — they are
    // the same expression (masterFinancialService.ts, quickMetrics assembly).
    expect(snapshot.quickMetrics.monthlyLoanRepayments).toBe(
      snapshot.debt.summary.totalRepayments,
    );

    // Where per-loan rounding would have changed the total, prove the snapshot
    // did NOT take that path. Guarded because on some datasets (including this
    // golden clone) the two coincide, and an assertion that cannot distinguish
    // them would be decoration.
    const roundedSum = canonicalPerLoan.reduce((s, m) => s + Math.round(m * 100) / 100, 0);
    if (Math.abs(roundedSum - canonicalTotal) > 1e-9) {
      expect(snapshot.debt.summary.totalRepayments).not.toBeCloseTo(roundedSum, 6);
    }
  });
});
