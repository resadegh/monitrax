/**
 * MON-045 (stage 2) — auto-derived DEDUCTIBLE property-loan interest wired
 * into the ONE tax-position engine, and the four rogue negative-gearing
 * producers deleted (§12.2.1 — one producer).
 *
 * Real-data symptom (VR-008 era): the CFO "Neg. Gearing Benefit" showed
 * $157,746 — computed by a rogue producer (Σ principal×rate per property from
 * raw rows) — while the canonical tax position held only $39,554 of TOTAL
 * deductions. A benefit cannot exceed the deductions that generate it.
 *
 * Rings here:
 *  - Ring-0: loan interest auto-derives into deductions.property (theoretical
 *    (principal−offset)×rate×fraction, actuals-first via INTEREST_CHARGED);
 *    HOME-typed property loans are excluded (primary residence interest is
 *    not deductible); loan-linked expense rows are de-duped.
 *  - Ring-2 (parity): Float === Decimal on the mixed worked example.
 *  - CFO derivation: benefit = max(0, deductions.property − income.rental)
 *    × marginalRate/100 — derived FROM the position, never re-computed from
 *    raw rows; benefit can no longer exceed the deductions that generate it.
 *  - Ring-1 SOURCE-LOCK: the deleted rogue producers cannot come back —
 *    taxIntegration/portfolioEngine no longer produce a negative-gearing
 *    number from raw rows, the calc-audit shadow of the deleted producer is
 *    gone, the orphaned property-roi route stays deleted, and the engine's
 *    auto-derive call sites are counted + HOME-gated.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  calculateTaxPosition,
  calculateTaxPositionDecimal,
} from '../../lib/tax-engine/position/taxPositionCalculator';

const NO_SUPER = { concessional: 0, nonConcessional: 0 };
const FY = '2025-26';

/** Guildford-shaped: primary residence (typed HOME) with a big loan. */
const homeLoan = {
  id: 'loan-home',
  propertyType: 'HOME',
  principal: 947076,
  interestRateAnnual: 0.0649,
};

/** Investment-property loan — theoretical interest 400,000 × 0.06 = 24,000. */
const ipLoan = {
  id: 'loan-ip',
  propertyType: 'INVESTMENT',
  principal: 400000,
  interestRateAnnual: 0.06,
};

const base = {
  incomes: [],
  expenses: [],
  depreciations: [],
  superContributions: NO_SUPER,
  financialYear: FY,
};

describe('MON-045 · Ring-0: auto-derived deductible interest', () => {
  it('§19.2 ex.1 — IP loan interest lands in deductions.property (400,000 × 0.06 = 24,000)', () => {
    const r = calculateTaxPosition({ ...base, propertyLoans: [ipLoan] });
    expect(r.deductions.property).toBeCloseTo(24000, 2);
    expect(r.deductions.total).toBeCloseTo(24000, 2);
  });

  it('§19.2 ex.2 — a HOME-typed property loan contributes NOTHING (primary residence)', () => {
    const r = calculateTaxPosition({ ...base, propertyLoans: [homeLoan] });
    expect(r.deductions.property).toBe(0);
    expect(r.deductions.total).toBe(0);
  });

  it('§19.2 ex.3 — ACTUALS-FIRST: Σ INTEREST_CHARGED wins over the theoretical', () => {
    const r = calculateTaxPosition({
      ...base,
      propertyLoans: [{ ...ipLoan, actualInterestCharged: 18500 }],
    });
    expect(r.deductions.property).toBe(18500); // not 24,000
  });

  it('§19.2 ex.4 — offset + fraction flow through ((400k−100k) × 0.06 × 0.5 = 9,000)', () => {
    const r = calculateTaxPosition({
      ...base,
      propertyLoans: [{ ...ipLoan, offsetBalance: 100000, deductibleFraction: 0.5 }],
    });
    expect(r.deductions.property).toBeCloseTo(9000, 2);
  });

  it('DE-DUP: a deductible expense row linked to an auto-derived loan is SKIPPED (interest never counted twice)', () => {
    const r = calculateTaxPosition({
      ...base,
      propertyLoans: [ipLoan],
      expenses: [
        // A logged interest expense for the SAME loan — would double-count.
        {
          id: 'e-int', name: 'Loan interest', category: 'INTEREST',
          amount: 2000, frequency: 'MONTHLY', isTaxDeductible: true,
          propertyId: 'p1', loanId: 'loan-ip',
        },
        // An unrelated property expense — still counts (500/quarter = 2,000/yr).
        {
          id: 'e-rates', name: 'Council rates', category: 'RATES',
          amount: 500, frequency: 'QUARTERLY', isTaxDeductible: true,
          propertyId: 'p1',
        },
      ],
    });
    // 24,000 loan-derived + 2,000 rates. NOT 24,000 + 24,000 + 2,000.
    expect(r.deductions.property).toBeCloseTo(26000, 2);
  });

  it('BACK-COMPAT: without propertyLoans, expense rows behave exactly as before (loanId or not)', () => {
    const r = calculateTaxPosition({
      ...base,
      expenses: [
        {
          id: 'e-int', name: 'Loan interest', category: 'INTEREST',
          amount: 2000, frequency: 'MONTHLY', isTaxDeductible: true,
          propertyId: 'p1', loanId: 'loan-ip',
        },
      ],
    });
    expect(r.deductions.property).toBeCloseTo(24000, 2);
  });
});

describe('MON-045 · Ring-2 parity: Float === Decimal on the mixed worked example', () => {
  const input = {
    ...base,
    incomes: [
      { id: 'i-rent', name: 'Rent', type: 'RENTAL', amount: 2000, frequency: 'MONTHLY' },
      { id: 'i-sal', name: 'Salary', type: 'SALARY', amount: 200000, frequency: 'ANNUAL' },
    ],
    expenses: [
      {
        id: 'e-int', name: 'Loan interest', category: 'INTEREST',
        amount: 2000, frequency: 'MONTHLY', isTaxDeductible: true,
        propertyId: 'p1', loanId: 'loan-ip',
      },
      {
        id: 'e-rates', name: 'Council rates', category: 'RATES',
        amount: 500, frequency: 'QUARTERLY', isTaxDeductible: true,
        propertyId: 'p1',
      },
    ],
    propertyLoans: [ipLoan, homeLoan],
  };

  it('deductions.property, income and taxable income agree across both engines', () => {
    const f = calculateTaxPosition(input);
    const d = calculateTaxPositionDecimal(input);
    expect(f.deductions.property).toBeCloseTo(26000, 2); // 24,000 loan + 2,000 rates
    expect(Number(d.deductions.property.toString())).toBeCloseTo(f.deductions.property, 6);
    expect(Number(d.income.total.toString())).toBeCloseTo(f.income.total, 6);
    expect(Number(d.tax.taxableIncome.toString())).toBeCloseTo(f.tax.taxableIncome, 6);
  });
});

describe('MON-045 · CFO derivation: benefit comes FROM the position, bounded by it', () => {
  it('§19.2 ex.5 — benefit = max(0, deductions.property − income.rental) × marginalRate/100', () => {
    const r = calculateTaxPosition({
      ...base,
      incomes: [
        { id: 'i-rent', name: 'Rent', type: 'RENTAL', amount: 2000, frequency: 'MONTHLY' }, // 24,000
        { id: 'i-sal', name: 'Salary', type: 'SALARY', amount: 200000, frequency: 'ANNUAL' },
      ],
      expenses: [
        {
          id: 'e-rates', name: 'Council rates', category: 'RATES',
          amount: 500, frequency: 'QUARTERLY', isTaxDeductible: true, propertyId: 'p1',
        },
      ],
      propertyLoans: [ipLoan], // 24,000 interest
    });
    // The exact derivation calculateCFOTaxInsights now uses:
    const benefit =
      Math.max(0, r.deductions.property - r.income.rental) * (r.tax.marginalRate / 100);
    // property 26,000 − rental 24,000 = 2,000 loss × marginal rate.
    expect(r.deductions.property - r.income.rental).toBeCloseTo(2000, 2);
    expect(benefit).toBeCloseTo(2000 * (r.tax.marginalRate / 100), 2);
    // THE MON-045 INVARIANT: a benefit can never exceed the deductions that
    // generate it (the $157,746-vs-$39,554 impossibility can't recur).
    expect(benefit).toBeLessThanOrEqual(r.deductions.total);
    expect(benefit).toBeLessThanOrEqual(r.deductions.property * (r.tax.marginalRate / 100));
  });

  it('positively-geared portfolio → 0 benefit (rental covers the deductions)', () => {
    const r = calculateTaxPosition({
      ...base,
      incomes: [{ id: 'i-rent', name: 'Rent', type: 'RENTAL', amount: 4000, frequency: 'MONTHLY' }], // 48,000
      propertyLoans: [ipLoan], // 24,000
    });
    const benefit =
      Math.max(0, r.deductions.property - r.income.rental) * (r.tax.marginalRate / 100);
    expect(benefit).toBe(0);
  });
});

describe('MON-045 · Ring-1 SOURCE-LOCK: the rogue producers stay dead', () => {
  const root = resolve(__dirname, '../..');
  const read = (p: string) => readFileSync(resolve(root, p), 'utf-8');

  it('taxIntegration.ts no longer computes negative gearing from raw rows — it derives from the position', () => {
    const src = read('lib/cfo/decisionSupport/taxIntegration.ts');
    expect(src).not.toMatch(/function calculateNegativeGearingBenefit/);
    expect(src).not.toMatch(/calculateNegativeGearingBenefitDecimal\s*\(/);
    expect(src).not.toMatch(/toAnnual(Decimal)?\(/); // no raw-row annualisation left
    expect(src).toMatch(/taxPosition\.deductions\.property - taxPosition\.income\.rental/);
  });

  it('portfolioEngine.ts no longer produces a negativeGearingBenefit', () => {
    const src = read('lib/intelligence/portfolioEngine.ts');
    expect(src).not.toMatch(/negativeGearingBenefit\s*[:=]\s*(Math\.max|[0-9])/);
  });

  it('the deleted producer\'s calc-audit shadow is gone (canonical applyNegativeGearing shadow untouched)', () => {
    const src = read('lib/calc-audit/engines/decimal-cfo-decision-support.ts');
    expect(src).not.toMatch(/negativeGearingBenefitShadow\s*[,:=]/);
    const canonical = read('lib/calc-audit/engines/decimal-tax-engine-loss.ts');
    expect(canonical).toMatch(/negativeGearingShadow/);
  });

  it('the orphaned property-roi route (hardcoded 37% producer) stays deleted', () => {
    expect(existsSync(resolve(root, 'app/api/calculate/property-roi/route.ts'))).toBe(false);
  });

  it('the engine has exactly 2 auto-derive call sites (Float + Decimal), each HOME-gated within 3 lines above', () => {
    const src = read('lib/tax-engine/position/taxPositionCalculator.ts');
    const lines = src.split('\n');
    const callSites = lines
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => /deductiblePropertyLoanInterest\(/.test(l) && !/^import/.test(l.trim()));
    expect(callSites.length).toBe(2);
    for (const { i } of callSites) {
      const windowBefore = lines.slice(Math.max(0, i - 3), i).join('\n');
      expect(
        /propertyType === 'HOME'/.test(windowBefore),
        `auto-derive at taxPositionCalculator.ts:${i + 1} lacks the HOME gate within 3 lines above`,
      ).toBe(true);
    }
  });
});
