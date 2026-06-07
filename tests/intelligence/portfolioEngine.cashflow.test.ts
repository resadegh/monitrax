/**
 * MA.4-002 follow-on regression test (2026-06-07).
 *
 * Pins the contract that `lib/intelligence/portfolioEngine.calculateCashflow`
 * delegates income + base expense computation to the canonical
 * `lib/calculations/cashflowOrchestrator.ts` SSOT (CLAUDE.md §12.2),
 * while preserving the interest-only loan-cost modeling that the
 * strategy stress-test (`calculateDebtStressTest`) depends on.
 *
 * Specifically:
 *   1. monthlyIncome comes from canonical (PAYG-aware NET salary).
 *   2. monthlyExpenses = canonical base expenses + interest-only loan cost.
 *   3. Stress-test invariant: monthlyExpenses - interestOnlyLoanCost
 *      equals the canonical base expenses (the subtraction in
 *      calculateDebtStressTest produces a sensible baseline).
 */

import { describe, it, expect } from 'vitest';
import {
  calculateCashflow,
  type PortfolioInput,
} from '@/lib/intelligence/portfolioEngine';

const baseInput: PortfolioInput = {
  properties: [],
  loans: [],
  accounts: [],
  income: [
    { id: 'i1', name: 'Day job', type: 'SALARY', amount: 8_000, frequency: 'MONTHLY', isTaxable: true },
  ],
  expenses: [
    { id: 'e1', name: 'Rent', amount: 2_500, frequency: 'MONTHLY', isEssential: true, isTaxDeductible: false },
    { id: 'e2', name: 'Groceries', amount: 800, frequency: 'MONTHLY', isEssential: true, isTaxDeductible: false },
  ],
  investments: [],
};

describe('MA.4-002 follow-on — intelligence engine cashflow delegates to canonical SSOT', () => {
  it('returns canonical income + expense totals with no loans', () => {
    const result = calculateCashflow(baseInput);
    expect(result.monthlyExpenses).toBe(3_300); // $2500 + $800
    expect(result.monthlySurplus).toBe(result.monthlyIncome - result.monthlyExpenses);
  });

  it('adds interest-only loan cost on top of canonical base expenses', () => {
    // $400k principal × 6% / 12 = $2,000/month interest.
    const withLoan = calculateCashflow({
      ...baseInput,
      loans: [
        { id: 'l1', name: 'Home loan', type: 'HOME', principal: 400_000, interestRate: 0.06, isInterestOnly: false, propertyId: undefined },
      ],
    });

    const baselineExpenses = 3_300;
    const expectedInterestOnly = 2_000;
    expect(withLoan.monthlyExpenses).toBe(baselineExpenses + expectedInterestOnly);
    expect(withLoan.expenseByCategory['Loan Interest']).toBe(expectedInterestOnly);
  });

  it('respects loan.offsetBalance — interest only on the EFFECTIVE principal', () => {
    // $400k principal, $100k offset, 6% rate → $300k × 6% / 12 = $1,500.
    const result = calculateCashflow({
      ...baseInput,
      loans: [
        { id: 'l1', name: 'Home loan', type: 'HOME', principal: 400_000, interestRate: 0.06, isInterestOnly: false, offsetBalance: 100_000 },
      ],
    });

    const baselineExpenses = 3_300;
    expect(result.monthlyExpenses).toBe(baselineExpenses + 1_500);
  });

  it('stress-test invariant: monthlyExpenses minus interest-only loan cost equals canonical base expenses', () => {
    // `calculateDebtStressTest` depends on this invariant — it computes
    // `baseExpensesExcludingLoans = monthlyExpenses - currentRepayments`
    // where `currentRepayments` is the same interest-only formula
    // (effectivePrincipal × rate / 12). If this invariant breaks, the
    // stress-test math at +2/+3/+4% rate scenarios silently produces
    // wrong results.
    const withLoan = calculateCashflow({
      ...baseInput,
      loans: [
        { id: 'l1', name: 'Home loan', type: 'HOME', principal: 400_000, interestRate: 0.06, isInterestOnly: false },
      ],
    });

    const interestOnlyLoanCost = 400_000 * (0.06 / 12); // 2000
    const baseExpensesExcludingLoans = withLoan.monthlyExpenses - interestOnlyLoanCost;
    expect(baseExpensesExcludingLoans).toBe(3_300); // canonical base expenses
  });

  it('uses canonical NET salary computation (PAYG-aware) instead of raw amount', () => {
    // Canonical `calculateSimpleCashflow` calls `calculateTakeHomePay`
    // for SALARY income, which applies the FY24-25 brackets + PAYG
    // withholding to convert gross → net. Pre-fix intel returned the
    // raw $10k unchanged (no PAYG awareness), making the AI advisor's
    // cashflow look better than reality. Post-fix asserts that NET is
    // strictly less than GROSS (PAYG was applied) and within a
    // plausible band for the FY24-25 marginal-rate math.
    const result = calculateCashflow({
      ...baseInput,
      income: [
        // $10k/month = $120k/year. Marginal rate after Stage 3 = 30%
        // for the band $45k-$135k. PAYG ≈ $26k/year → ~$2.2k/month tax.
        // Net should land roughly $7.4k-$8.0k/month.
        { id: 'i1', name: 'Salary', type: 'SALARY', amount: 10_000, frequency: 'MONTHLY', isTaxable: true },
      ],
    });
    expect(result.monthlyIncome).toBeLessThan(10_000); // PAYG was applied (key contract)
    expect(result.monthlyIncome).toBeGreaterThan(7_000); // not absurdly low
    expect(result.monthlyIncome).toBeLessThan(8_500); // band check
  });

  it('expenseByCategory aggregates duplicate names (was overwriting pre-fix)', () => {
    // Pre-fix code had `expenseByCategory[exp.name] = monthly;` (assignment,
    // not accumulation) so two expenses with the same name silently
    // overwrote each other. Fix uses `... ?? 0) + monthly`.
    const result = calculateCashflow({
      ...baseInput,
      expenses: [
        { id: 'e1', name: 'Subscriptions', amount: 50, frequency: 'MONTHLY', isEssential: false, isTaxDeductible: false },
        { id: 'e2', name: 'Subscriptions', amount: 30, frequency: 'MONTHLY', isEssential: false, isTaxDeductible: false },
      ],
    });

    expect(result.expenseByCategory['Subscriptions']).toBe(80); // accumulated, not overwritten
    expect(result.monthlyExpenses).toBe(80);
  });
});
