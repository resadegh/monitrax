/**
 * Trust Engine · Tranche D.3 — the canonical income / expense / loan aggregators
 * (`lib/calculations/{income,expense,loan}Aggregator`).
 *
 * These are the SSOT homes for "what's my total income / spend / debt" (CLAUDE.md
 * §6.2). Their Float ⇄ Decimal shadow parity and entity-scoping are already
 * locked (tests/calculations/aggregators.decimal.test.ts +
 * aggregatorEntityScoping.test.ts). What was NOT yet covered — and is the
 * highest-value tie-out for an aggregator — is BREAKDOWN ADDITIVITY: the
 * per-category / per-type breakdown must sum to the headline total, and the
 * essential/discretionary + taxable/non-taxable splits must partition it. This
 * is the L3 "money is conserved across the SSOT breakdown" discipline — a
 * dropped bucket would silently understate the total a dozen surfaces render.
 *
 * Pure tie-outs over a deterministic sweep + a golden. No production logic
 * changed (this PROVES it). Units verified from source per §19.2:
 *   • frequency uses the UPPERCASE `Frequency` enum.
 *   • `Loan.interestRateAnnual` is a DECIMAL (0.0625 = 6.25%) — monthly
 *     interest = principal × rate/12 (the 2026-06-23 P0 convention).
 *
 * Models the aggregator engine nodes the Neomatrix now carries (Tranche D.3).
 */

import { describe, it, expect } from 'vitest';
import { aggregateIncome, type IncomeInput } from '@/lib/calculations/incomeAggregator';
import { aggregateExpenses, type ExpenseInput } from '@/lib/calculations/expenseAggregator';
import { aggregateLoanRepayments, type LoanInput } from '@/lib/calculations/loanAggregator';
import type { Frequency } from '@/lib/types/prisma-enums';

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const FREQS = ['WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUAL'] as Frequency[];
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

// =============================================================================
// Income — Σ byType === grossTotal/netTotal; taxable + nonTaxable === grossTotal
// =============================================================================

describe('Trust Engine D.3 · incomeAggregator — breakdown additivity ties out', () => {
  for (const target of ['monthly', 'annual'] as const) {
    it(`${target}: Σ byType.gross === grossTotal, Σ byType.net === netTotal, taxable+nonTaxable === grossTotal`, () => {
      const rand = rng(0x1c0e + (target === 'annual' ? 1 : 0));
      for (let trial = 0; trial < 40; trial++) {
        const n = 1 + Math.floor(rand() * 12);
        const income: IncomeInput[] = Array.from({ length: n }, () => ({
          amount: Math.round(rand() * 5_000),
          frequency: FREQS[Math.floor(rand() * FREQS.length)]!,
          type: (['SALARY', 'RENTAL', 'DIVIDEND', 'Other'] as const)[Math.floor(rand() * 4)]!,
          salaryType: rand() < 0.5 ? 'GROSS' : 'NET',
          isTaxable: rand() < 0.8,
        }));
        const r = aggregateIncome(income, target);
        expect(sum(Object.values(r.byType).map((b) => b.gross))).toBeCloseTo(r.grossTotal, 4);
        expect(sum(Object.values(r.byType).map((b) => b.net))).toBeCloseTo(r.netTotal, 4);
        expect(r.taxableIncome + r.nonTaxableIncome).toBeCloseTo(r.grossTotal, 4);
      }
    });
  }
});

// =============================================================================
// Expense — Σ byCategory === total; essential + discretionary === total
// =============================================================================

describe('Trust Engine D.3 · expenseAggregator — breakdown additivity ties out', () => {
  it('Σ byCategory === total AND essential + discretionary === total (a dropped bucket understates spend)', () => {
    const rand = rng(0xe7e5);
    const cats = ['Groceries', 'Dining', 'Transport', 'Utilities', 'Other'];
    for (let trial = 0; trial < 50; trial++) {
      const n = 1 + Math.floor(rand() * 15);
      const expenses: ExpenseInput[] = Array.from({ length: n }, () => ({
        amount: Math.round(rand() * 3_000),
        frequency: FREQS[Math.floor(rand() * FREQS.length)]!,
        category: cats[Math.floor(rand() * cats.length)]!,
        isEssential: rand() < 0.6,
        isTaxDeductible: rand() < 0.2,
      })) as ExpenseInput[];
      const r = aggregateExpenses(expenses, 'monthly');
      expect(sum(Object.values(r.byCategory))).toBeCloseTo(r.total, 4);
      expect(r.essential + r.discretionary).toBeCloseTo(r.total, 4);
      // taxDeductible is a subset, never exceeds total
      expect(r.taxDeductible).toBeLessThanOrEqual(r.total + 1e-6);
    }
  });
});

// =============================================================================
// Loan — Σ byType === totals; weighted-rate identity; golden interest (decimal rate)
// =============================================================================

describe('Trust Engine D.3 · loanAggregator — breakdown additivity + weighted-rate identity', () => {
  it('golden — $500k loan @6.25% (decimal 0.0625): monthly interest = $2,604.17 (the P0 unit)', () => {
    const r = aggregateLoanRepayments(
      [{ principal: 500_000, interestRateAnnual: 0.0625, minRepayment: 3_000, repaymentFrequency: 'MONTHLY', type: 'HOME' } as LoanInput],
      'monthly',
    );
    expect(r.totalInterest).toBeCloseTo(500_000 * (0.0625 / 12), 4); // 2604.17 — NOT /100 again
    expect(r.totalInterest).toBeCloseTo(2604.1667, 2);
    expect(r.weightedInterestRate).toBeCloseTo(0.0625, 6); // single loan → its own rate
  });

  it('Σ byType === totalPrincipal/totalRepayments; weightedRate × totalPrincipal === Σ(principal×rate)', () => {
    const rand = rng(0x10a4);
    const types = ['HOME', 'INVESTMENT', 'PERSONAL', 'CREDIT_CARD'];
    for (let trial = 0; trial < 50; trial++) {
      const n = 1 + Math.floor(rand() * 10);
      const loans: LoanInput[] = Array.from({ length: n }, () => ({
        principal: Math.round(rand() * 800_000),
        interestRateAnnual: 0.02 + rand() * 0.08, // decimal
        minRepayment: Math.round(rand() * 4_000),
        repaymentFrequency: FREQS[Math.floor(rand() * FREQS.length)]!,
        type: types[Math.floor(rand() * types.length)]!,
      })) as LoanInput[];
      const r = aggregateLoanRepayments(loans, 'monthly');
      expect(sum(Object.values(r.byType).map((b) => b.principal))).toBeCloseTo(r.totalPrincipal, 3);
      expect(sum(Object.values(r.byType).map((b) => b.repayments))).toBeCloseTo(r.totalRepayments, 3);
      // weighted-average rate identity (the SSOT debt-rate figure)
      const sumPrincipalRate = sum(loans.map((l) => Number(l.principal) * Number(l.interestRateAnnual)));
      expect(r.weightedInterestRate * r.totalPrincipal).toBeCloseTo(sumPrincipalRate, 2);
    }
  });
});
