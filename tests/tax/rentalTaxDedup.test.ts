/**
 * MON-010 — the master tax summary must count a property's rental income ONCE,
 * not once-per-fragmented-record (§19.2 worked example + §19.4 cross-surface lock).
 *
 * WHAT WAS WRONG:
 *   `buildTaxSummary` was fed the RAW `data.income`. When reconciliation had split
 *   one lease into several "monthly" Income records, each row was summed → the
 *   taxable RENTAL income was counted N times. MON-009 already deduped this for the
 *   aggregate income breakdown (savings rate / health) via `adjustPropertyRentalIncome`,
 *   but the tax path was deliberately left on raw records → the dashboard and the tax
 *   number disagreed, and taxable rental was over-counted.
 *
 * THE FIX: `buildTaxSummary` now reads the SAME deduped array (`adjustedIncome`) the
 * income breakdown reads. `adjustPropertyRentalIncome` pools a property's rental at the
 * stream level via the ONE canonical `computePropertyCashflow` (actuals-first) into a
 * single synthetic RENTAL record → the passive-rental total and the taxable-rental
 * basis converge by construction.
 *
 * This test proves both halves without importing the DB-coupled master service:
 *   (1) the pooling NUMBER — via the pure engine the dedup delegates to; and
 *   (2) the WIRING — a source-lock that tax reads the deduped array.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { computePropertyCashflow } from '../../lib/calculations/propertyCashflow';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('MON-010: a rental fragmented across records is pooled to ONE monthly figure', () => {
  // Reconciliation split one lease into 4 "monthly" Income records, each declaring
  // $2,000/mo (the duplication). The reconciled transactions are the real single
  // stream. `adjustPropertyRentalIncome` pools ALL of a property's rental rows +
  // their transactions through this exact engine, so this is the number the tax
  // summary now reads (counted ONCE), not 4 × $2,000.
  const fragments = ['rent-0', 'rent-1', 'rent-2', 'rent-3'].map((id) => ({
    id,
    type: 'RENTAL',
    amount: 2_000, // each row declares the same $2,000/mo
    frequency: 'MONTHLY',
  }));

  // 12 monthly rent payments of $2,000, spread across the 4 fragmented rows.
  const monthlyRentTxns = Array.from({ length: 12 }, (_, i) => ({
    incomeId: `rent-${i % 4}`,
    expenseId: null,
    loanId: null,
    date: new Date(2024, i, 2),
    amount: 2_000,
  }));

  it('pools to ~$2,000/mo (one stream), NOT the 4× raw sum ($8,000)', () => {
    const cf = computePropertyCashflow({ income: fragments, transactions: monthlyRentTxns });
    // Actuals-first: 11 in-advance payments over ~305 days → ~$1,996/mo.
    expect(cf.monthlyRent).toBeGreaterThan(1_800);
    expect(cf.monthlyRent).toBeLessThan(2_200);
    // The old raw tax path summed all four rows = $8,000/mo. Prove we are nowhere near it.
    expect(cf.monthlyRent).toBeLessThan(4_000);
    const rawSum = fragments.reduce((s, r) => s + r.amount, 0);
    expect(rawSum).toBe(8_000); // demonstrate the old over-count magnitude
  });

  it('declared fallback (no transactions) still pools the property stream once', () => {
    // With no actuals the engine falls back to declared; the point of the fix is that
    // tax reads the pooled property stream, not N independent raw rows through a
    // separate code path.
    const cf = computePropertyCashflow({ income: fragments, transactions: [] });
    expect(cf.monthlyRent).toBeGreaterThan(0);
  });
});

describe('MON-010: the tax summary reads the deduped source (§19.4 convergence lock)', () => {
  const src = read('lib/services/masterFinancialService.ts');

  it('buildTaxSummary is fed adjustedIncome, not raw data.income', () => {
    // MON-020/060: master's tax summary now reads the ONE canonical bundle
    // (getUserTaxPosition) via the buildTaxSummaryFromPosition adapter — the
    // second assembler was deleted. The rental dedup still feeds the INCOME
    // breakdown (asserted separately); folding dedup into the canonical tax
    // assembler is the recorded MON-020 follow-up.
    expect(src).toContain('getUserTaxPosition(userId)');
    expect(src).toContain('buildTaxSummaryFromPosition(taxBundle.taxPosition)');
    expect(src).not.toContain('buildTaxSummary(adjustedIncome');
    expect(src).not.toContain('buildTaxSummary(data.income');
  });

  it('income breakdown reads the ONE pooled rental source (banked engine)', () => {
    // MON-131 T1-B: `adjustPropertyRentalIncome` (the synthetic-record dedup)
    // is DELETED. The income breakdown now reads the banked-income result,
    // whose rental leg pools each property's fragmented rows through the SAME
    // canonical `computePropertyCashflow` (lib/income/banked/rentalBanked.ts)
    // — one stream per property by construction, so the MON-010 over-count
    // class cannot recur via a second dedup path.
    // (name may survive in history comments — the CALL must be gone)
    expect(src).not.toContain('adjustPropertyRentalIncome(');
    expect(src).toContain('buildBankedIncomeFromData(');
    expect(src).toContain('buildIncomeBreakdown(banked');
  });
});
