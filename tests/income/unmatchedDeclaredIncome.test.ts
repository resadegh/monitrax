/**
 * MON-043 — Home showed $239K income ("Last 12 months" ACTUALS) while Tax showed
 * $524,831 (declared gross); the ~$192,698 gap was "Other" income DECLARED with no
 * matching transactions. This locks the ONE aggregation behind the nudge that
 * surfaces that gap.
 */
import { describe, it, expect } from 'vitest';
import { sumUnmatchedDeclaredAnnualIncome } from '../../lib/income/unmatchedDeclaredIncome';

describe('MON-043 · unmatched declared income aggregation', () => {
  it('§19.2 worked example: a $16,058/mo declared row with 0 transactions → ~$192,696/yr', () => {
    const { annualTotal, sourceCount } = sumUnmatchedDeclaredAnnualIncome([
      { amount: 16058, frequency: 'MONTHLY', hasTransactions: false, transactionCount: 0 },
    ]);
    expect(annualTotal).toBe(16058 * 12); // 192,696 ≈ the $192,698 "Other" income
    expect(sourceCount).toBe(1);
  });

  it('EXCLUDES rows that have matching actual transactions', () => {
    const { annualTotal, sourceCount } = sumUnmatchedDeclaredAnnualIncome([
      { amount: 5000, frequency: 'MONTHLY', hasTransactions: true, transactionCount: 12 },
      { amount: 1000, frequency: 'MONTHLY', hasTransactions: false, transactionCount: 0 },
    ]);
    expect(annualTotal).toBe(12000); // only the unmatched $1,000/mo row
    expect(sourceCount).toBe(1);
  });

  it('a row flagged hasTransactions but with 0 count is treated as unmatched', () => {
    const { sourceCount } = sumUnmatchedDeclaredAnnualIncome([
      { amount: 100, frequency: 'ANNUAL', hasTransactions: true, transactionCount: 0 },
    ]);
    expect(sourceCount).toBe(1);
  });

  it('all matched → zero', () => {
    const { annualTotal, sourceCount } = sumUnmatchedDeclaredAnnualIncome([
      { amount: 900, frequency: 'WEEKLY', hasTransactions: true, transactionCount: 40 },
    ]);
    expect(annualTotal).toBe(0);
    expect(sourceCount).toBe(0);
  });
});
