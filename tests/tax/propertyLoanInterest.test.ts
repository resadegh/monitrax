/**
 * MON-045 (stage 1) — the canonical DEDUCTIBLE property-loan-interest helper.
 * Ring-0 §19.2 worked examples. Reform-INDEPENDENT (the reform gates the LOSS
 * offset, not interest deductibility — that is applyNegativeGearing, stage 2).
 *
 * This is the verified core the stage-2 engine wiring will deduct into
 * calculateTaxPosition.deductions.property, replacing the four rogue producers
 * (§12.2.1) that made the CFO neg-gearing benefit ($157,746) exceed total
 * deductions ($39,554).
 */
import { describe, it, expect } from 'vitest';
import { deductiblePropertyLoanInterest } from '../../lib/tax-engine/deductions/propertyLoanInterest';

describe('MON-045 · deductiblePropertyLoanInterest', () => {
  it('§19.2 ex.1 — theoretical: principal × rate (no offset, full fraction)', () => {
    const r = deductiblePropertyLoanInterest({ principal: 947076, interestRateAnnual: 0.0649 });
    expect(r.basis).toBe('theoretical');
    expect(r.deductibleInterest).toBeCloseTo(947076 * 0.0649, 2); // 61,465.23
  });

  it('§19.2 ex.2 — offset reduces the interest-bearing balance', () => {
    const r = deductiblePropertyLoanInterest({
      principal: 947076,
      interestRateAnnual: 0.0649,
      offsetBalance: 100000,
    });
    expect(r.deductibleInterest).toBeCloseTo((947076 - 100000) * 0.0649, 2); // 54,975.23
  });

  it('§19.2 ex.3 — deductibleFraction scales the theoretical interest', () => {
    const r = deductiblePropertyLoanInterest({
      principal: 947076,
      interestRateAnnual: 0.0649,
      deductibleFraction: 0.5,
    });
    expect(r.deductibleInterest).toBeCloseTo(947076 * 0.0649 * 0.5, 2); // 30,732.62
  });

  it('§19.2 ex.4 — ACTUALS-FIRST: charged-interest ledger wins over the theoretical', () => {
    const r = deductiblePropertyLoanInterest({
      principal: 947076,
      interestRateAnnual: 0.0649,
      offsetBalance: 100000, // ignored — actuals already reflect it
      actualInterestCharged: 60000,
    });
    expect(r.basis).toBe('actual');
    expect(r.deductibleInterest).toBe(60000);
  });

  it('actuals still scale by deductibleFraction (mixed-purpose loan)', () => {
    const r = deductiblePropertyLoanInterest({
      principal: 500000,
      interestRateAnnual: 0.06,
      actualInterestCharged: 30000,
      deductibleFraction: 0.5,
    });
    expect(r.deductibleInterest).toBe(15000);
  });

  it('offset ≥ principal → zero interest-bearing balance → 0 (never negative)', () => {
    const r = deductiblePropertyLoanInterest({
      principal: 200000,
      interestRateAnnual: 0.06,
      offsetBalance: 250000,
    });
    expect(r.deductibleInterest).toBe(0);
  });

  it('a $0 / missing rate loan yields 0 (no NaN, no crash)', () => {
    expect(deductiblePropertyLoanInterest({ principal: 0, interestRateAnnual: 0.06 }).deductibleInterest).toBe(0);
    expect(deductiblePropertyLoanInterest({ principal: 500000, interestRateAnnual: 0 }).deductibleInterest).toBe(0);
  });

  it('deductibleFraction is clamped to [0,1] defensively', () => {
    const over = deductiblePropertyLoanInterest({ principal: 100000, interestRateAnnual: 0.05, deductibleFraction: 2 });
    expect(over.deductibleInterest).toBeCloseTo(100000 * 0.05, 2); // clamped to 1.0
    const under = deductiblePropertyLoanInterest({ principal: 100000, interestRateAnnual: 0.05, deductibleFraction: -1 });
    expect(under.deductibleInterest).toBe(0); // clamped to 0
  });

  it('a negative actualInterestCharged is ignored → falls back to theoretical', () => {
    const r = deductiblePropertyLoanInterest({
      principal: 100000,
      interestRateAnnual: 0.05,
      actualInterestCharged: -5,
    });
    expect(r.basis).toBe('theoretical');
    expect(r.deductibleInterest).toBeCloseTo(5000, 2);
  });
});
