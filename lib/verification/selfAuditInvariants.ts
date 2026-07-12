/**
 * NEOAUDIT SELF-AUDIT — shared invariant computation (R3-self node).
 *
 * The single implementation of the NeoAudit Ring-3 accounting invariants
 * (NEOAUDIT.md §1.2 R3-self, §6 Release Scorecard). Both callers run THIS —
 * never a second copy (§12.2.1):
 *   - GET /api/verify/invariants        → the logged-in user, on their own data
 *   - GET /api/admin/neoaudit?userId=…  → an admin, on a selected user's data
 *
 * Sole responsibility (non-overlap contract §1.2): "do the invariants hold on
 * this snapshot right now?" — nothing else. It READS canonical sources only
 * (§12.2.1): the master snapshot + the canonical accessors. It computes NO
 * financial figure of its own — every lhs/rhs below is either a canonical field
 * or the arithmetic identity between canonical fields that the invariant asserts.
 */

import type { MasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import { computeAccessibilityBuckets } from '@/lib/calculations/accessibilityBuckets';
import {
  getCanonicalMonthlyCashflow,
  getCanonicalSavingsRate,
} from '@/lib/calculations/canonicalCashflow';

export interface InvariantResult {
  id: string;
  label: string;
  lhs: number;
  rhs: number;
  delta: number;
  /** Absolute tolerance in dollars (0 = exact; identities between canonical fields). */
  tolerance: number;
  pass: boolean;
}

export interface SelfAuditReport {
  pass: boolean;
  /** WHOSE data this audited (resolves "which account did it run against?"). */
  auditedAccount: string;
  advisories: string[];
  checkedAt: string;
  invariantCount: number;
  failureCount: number;
  invariants: InvariantResult[];
  info: {
    canonicalMonthlyNet: number;
    cashflowBasis: string;
    canonicalSavingsRate: number;
    nonFiniteFields: string[];
  };
}

/** Cents-level tolerance for float-summed identities (never for true equality of one field). */
const CENTS = 0.01;

function check(
  id: string,
  label: string,
  lhs: number,
  rhs: number,
  tolerance: number,
): InvariantResult {
  const delta = lhs - rhs;
  return { id, label, lhs, rhs, delta, tolerance, pass: Math.abs(delta) <= tolerance };
}

/**
 * Compute the Ring-3 self-audit report for a master snapshot.
 *
 * @param snapshot        canonical master financial snapshot (the ONLY data source)
 * @param auditedAccount  human-readable identity of whose data this is (email)
 */
export function computeSelfAuditReport(
  snapshot: MasterFinancialSnapshot,
  auditedAccount: string,
): SelfAuditReport {
  const qm = snapshot.quickMetrics;
  const nw = snapshot.netWorth;

  const invariants: InvariantResult[] = [];

  // ── I1: Assets − Liabilities === Net worth (the base accounting identity) ──
  invariants.push(
    check('I1', 'Assets − Liabilities = Net worth', nw.assets.total - nw.liabilities.total, nw.netWorth, CENTS), /* @financial-math-allowed: NeoAudit R3-self invariant — this arithmetic IS the identity under audit, asserted against the canonical netWorth field; not a producer */
  );

  // ── I2: quickMetrics mirrors of the same identity agree with netWorth ──
  invariants.push(
    check('I2a', 'quickMetrics.totalAssets = netWorth.assets.total', qm.totalAssets, nw.assets.total, CENTS),
    check('I2b', 'quickMetrics.totalLiabilities = netWorth.liabilities.total', qm.totalLiabilities, nw.liabilities.total, CENTS),
    check('I2c', 'quickMetrics.netWorthValue = netWorth.netWorth', qm.netWorthValue, nw.netWorth, CENTS),
  );

  // ── I3: Liquid + Accessible + Locked === Net worth (MON-012 bucket tie-out) ──
  const buckets = computeAccessibilityBuckets(nw, qm.liquidCash);
  invariants.push(
    check(
      'I3',
      'Liquid + Accessible + Locked = Net worth',
      buckets.liquidToday + buckets.accessible + buckets.lockedLongTerm,
      nw.netWorth,
      CENTS,
    ),
  );

  // ── I4: Σ per-property equity === portfolio equity (MON-011 tie-out) ──
  const equitySum = snapshot.properties.reduce((sum, p) => sum + p.equity, 0);
  invariants.push(
    check('I4', 'Σ per-property equity = Portfolio equity', equitySum, snapshot.propertyPortfolioEquity, CENTS),
  );

  // ── I5: per-property internal consistency: equity === value − loans ──
  for (const p of snapshot.properties) {
    invariants.push(
      check(`I5:${p.id}`, `${p.name}: equity = value − loans`, p.currentValue - p.loanBalance, p.equity, CENTS),
    );
  }

  // ── I6: finite-number scan — no NaN/Infinity in any headline figure ──
  const headline: Record<string, number> = {
    totalAssets: qm.totalAssets,
    totalLiabilities: qm.totalLiabilities,
    netWorth: qm.netWorthValue,
    portfolioEquity: snapshot.propertyPortfolioEquity,
    liquidCash: qm.liquidCash,
    emergencyMonths: snapshot.emergencyFund.monthsCovered,
    healthScore: snapshot.healthScore.score,
    canonicalMonthlyNet: getCanonicalMonthlyCashflow(snapshot).net,
    canonicalSavingsRate: getCanonicalSavingsRate(snapshot).rate,
  };
  const nonFinite = Object.entries(headline).filter(([, v]) => !Number.isFinite(v));
  invariants.push({
    id: 'I6',
    label: 'All headline figures are finite (no NaN/Infinity)',
    lhs: nonFinite.length,
    rhs: 0,
    delta: nonFinite.length,
    tolerance: 0,
    pass: nonFinite.length === 0,
  });

  // ── I7: range sanity — months/score/LVR within meaningful bounds ──
  invariants.push({
    id: 'I7',
    label: 'Ranges sane (emergency months ≥ 0, health score 0–100, LVR ≥ 0)',
    lhs:
      (snapshot.emergencyFund.monthsCovered < 0 ? 1 : 0) +
      (snapshot.healthScore.score < 0 || snapshot.healthScore.score > 100 ? 1 : 0) +
      snapshot.properties.filter((p) => p.lvr < 0).length,
    rhs: 0,
    delta: 0,
    tolerance: 0,
    pass:
      snapshot.emergencyFund.monthsCovered >= 0 &&
      snapshot.healthScore.score >= 0 &&
      snapshot.healthScore.score <= 100 &&
      snapshot.properties.every((p) => p.lvr >= 0),
  });

  // ── I8/I9: emergency-fund identities (gap + months from the same fields) ──
  const ef = snapshot.emergencyFund;
  invariants.push(
    check(
      'I8',
      'Emergency gap = max(0, target × burn − liquid)',
      ef.gap,
      Math.max(0, ef.targetMonths * ef.monthlyExpenses - ef.liquidCash), /* @financial-math-allowed: NeoAudit R3-self invariant — re-states the canonical gap formula (masterFinancialService:1411) to assert the stored field matches it */
      CENTS,
    ),
  );
  if (ef.monthlyExpenses > 0) {
    invariants.push(
      check('I9', 'Months covered × burn = liquid cash', ef.monthsCovered * ef.monthlyExpenses, ef.liquidCash, CENTS), /* @financial-math-allowed: NeoAudit R3-self invariant — identity check, not a producer */
    );
  }

  // ── I10/I11: expense-breakdown additivity (the "where your money goes" class) ──
  const exp = snapshot.expenses.monthly.all;
  const categorySum = Object.values(exp.byCategory).reduce((sum, v) => sum + v, 0);
  invariants.push(
    check('I10', 'Σ expense categories = total monthly expenses', categorySum, exp.total, CENTS),
    check('I11', 'Essential + Discretionary = total monthly expenses', exp.essential + exp.discretionary, exp.total, CENTS), /* @financial-math-allowed: NeoAudit R3-self invariant — additivity assertion between canonical fields */
  );

  // ── I12: declared-cashflow internal identity ──
  const cf = snapshot.cashflow;
  invariants.push(
    check(
      'I12',
      'Declared cashflow = net income − expenses − loan repayments',
      cf.monthlyCashflow,
      cf.monthlyNetIncome - cf.monthlyExpenses - cf.monthlyLoanRepayments, /* @financial-math-allowed: NeoAudit R3-self invariant — asserts the canonical cashflow block is internally consistent */
      CENTS,
    ),
  );

  // ── ADVISORIES — plausibility smells (not identity FAILs; a human should
  //    look). These catch the "consistent but wrong / whose-account-is-this"
  //    gap that identity checks are blind to (e.g. a $0-liabilities test
  //    account vs a real account with loans silently dropped). ──
  const advisories: string[] = [];
  if (snapshot.counts.loans > 0 && nw.liabilities.total <= 0) {
    advisories.push(`${snapshot.counts.loans} loan record(s) exist but total liabilities is $0 — loans may not be aggregating (possible real bug).`);
  }
  if (snapshot.counts.properties > 0 && nw.liabilities.mortgages <= 0) {
    advisories.push(`${snapshot.counts.properties} propert(y/ies) but $0 mortgages — likely test data, or property loans aren't linked.`);
  }
  if (qm.monthlyIncome > 0 && Math.abs(getCanonicalMonthlyCashflow(snapshot).net) < 0.01) {
    advisories.push('Monthly net is exactly $0 despite income — looks like placeholder/empty data.');
  }
  if (nw.assets.total === 0 && nw.liabilities.total === 0) {
    advisories.push('Assets and liabilities are both $0 — this account has no financial data (empty/test account).');
  }

  const failures = invariants.filter((i) => !i.pass);

  return {
    pass: failures.length === 0,
    auditedAccount,
    advisories,
    checkedAt: new Date().toISOString(),
    invariantCount: invariants.length,
    failureCount: failures.length,
    invariants,
    info: {
      canonicalMonthlyNet: Math.round(getCanonicalMonthlyCashflow(snapshot).net),
      cashflowBasis: getCanonicalMonthlyCashflow(snapshot).basis,
      canonicalSavingsRate: Math.round(getCanonicalSavingsRate(snapshot).rate * 10) / 10,
      nonFiniteFields: nonFinite.map(([k]) => k),
    },
  };
}
