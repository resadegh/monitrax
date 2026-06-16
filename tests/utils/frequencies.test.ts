/**
 * FREQUENCIES UTILITY TESTS
 * Comprehensive tests for frequency conversion utilities
 *
 * Run with: npm run test
 */

import { describe, it, expect } from 'vitest';
import {
  toAnnual,
  toMonthly,
  toFortnightly,
  toWeekly,
  periodsPerYear,
} from '@/lib/utils/frequencies';

// =============================================================================
// TO ANNUAL CONVERSION TESTS
// =============================================================================

describe('toAnnual', () => {
  describe('standard conversions', () => {
    it('converts weekly to annual (x52)', () => {
      expect(toAnnual(100, 'WEEKLY')).toBe(5200);
    });

    it('converts fortnightly to annual (x26)', () => {
      expect(toAnnual(100, 'FORTNIGHTLY')).toBe(2600);
    });

    it('converts monthly to annual (x12)', () => {
      expect(toAnnual(100, 'MONTHLY')).toBe(1200);
    });

    it('converts quarterly to annual (x4)', () => {
      expect(toAnnual(100, 'QUARTERLY')).toBe(400);
    });

    it('returns annual as-is (x1)', () => {
      expect(toAnnual(100, 'ANNUAL')).toBe(100);
    });

    it('converts half-yearly to annual (x2)', () => {
      expect(toAnnual(100, 'HALF_YEARLY')).toBe(200);
    });

    // Insurance commonly billed half-yearly — a $215.59 premium every
    // 6 months is $431.18/yr, NOT $215.59 (the bug this guards against).
    it('annualises a half-yearly insurance premium correctly', () => {
      expect(toAnnual(215.59, 'HALF_YEARLY')).toBeCloseTo(431.18, 2);
      expect(toMonthly(215.59, 'HALF_YEARLY')).toBeCloseTo(35.93, 2);
    });
  });

  describe('real-world financial scenarios', () => {
    // Salary scenarios
    it('converts weekly salary to annual', () => {
      expect(toAnnual(2000, 'WEEKLY')).toBe(104000);
    });

    it('converts fortnightly salary to annual', () => {
      expect(toAnnual(4000, 'FORTNIGHTLY')).toBe(104000);
    });

    it('converts monthly salary to annual', () => {
      expect(toAnnual(8333.33, 'MONTHLY')).toBeCloseTo(99999.96, 2);
    });

    // Rental income scenarios
    it('converts weekly rent to annual', () => {
      expect(toAnnual(650, 'WEEKLY')).toBe(33800);
    });

    // Expense scenarios
    it('converts monthly mortgage payment to annual', () => {
      expect(toAnnual(2500, 'MONTHLY')).toBe(30000);
    });

    it('converts fortnightly loan payment to annual', () => {
      expect(toAnnual(1250, 'FORTNIGHTLY')).toBe(32500);
    });
  });

  describe('edge cases', () => {
    it('handles zero amount', () => {
      expect(toAnnual(0, 'MONTHLY')).toBe(0);
    });

    it('handles negative amounts', () => {
      expect(toAnnual(-100, 'MONTHLY')).toBe(-1200);
    });

    it('handles decimal amounts', () => {
      expect(toAnnual(99.99, 'MONTHLY')).toBeCloseTo(1199.88, 2);
    });

    it('handles very large amounts', () => {
      expect(toAnnual(1000000, 'MONTHLY')).toBe(12000000);
    });
  });
});

// =============================================================================
// TO MONTHLY CONVERSION TESTS
// =============================================================================

describe('toMonthly', () => {
  describe('standard conversions', () => {
    it('converts weekly to monthly', () => {
      expect(toMonthly(100, 'WEEKLY')).toBeCloseTo(433.33, 2);
    });

    it('converts fortnightly to monthly', () => {
      expect(toMonthly(100, 'FORTNIGHTLY')).toBeCloseTo(216.67, 2);
    });

    it('returns monthly as-is', () => {
      expect(toMonthly(100, 'MONTHLY')).toBeCloseTo(100, 2);
    });

    it('converts quarterly to monthly', () => {
      expect(toMonthly(100, 'QUARTERLY')).toBeCloseTo(33.33, 2);
    });

    it('converts annual to monthly', () => {
      expect(toMonthly(1200, 'ANNUAL')).toBe(100);
    });
  });

  describe('real-world scenarios', () => {
    it('converts weekly rent to monthly for budgeting', () => {
      expect(toMonthly(650, 'WEEKLY')).toBeCloseTo(2816.67, 2);
    });

    it('converts annual insurance to monthly', () => {
      expect(toMonthly(1800, 'ANNUAL')).toBe(150);
    });
  });
});

// =============================================================================
// TO FORTNIGHTLY CONVERSION TESTS
// =============================================================================

describe('toFortnightly', () => {
  it('converts weekly to fortnightly', () => {
    expect(toFortnightly(100, 'WEEKLY')).toBe(200);
  });

  it('returns fortnightly as-is', () => {
    expect(toFortnightly(100, 'FORTNIGHTLY')).toBe(100);
  });

  it('converts monthly to fortnightly', () => {
    expect(toFortnightly(1200, 'MONTHLY')).toBeCloseTo(553.85, 2);
  });

  it('converts annual to fortnightly', () => {
    expect(toFortnightly(26000, 'ANNUAL')).toBe(1000);
  });
});

// =============================================================================
// TO WEEKLY CONVERSION TESTS
// =============================================================================

describe('toWeekly', () => {
  it('returns weekly as-is', () => {
    expect(toWeekly(100, 'WEEKLY')).toBe(100);
  });

  it('converts fortnightly to weekly', () => {
    expect(toWeekly(200, 'FORTNIGHTLY')).toBe(100);
  });

  it('converts monthly to weekly', () => {
    expect(toWeekly(433.33, 'MONTHLY')).toBeCloseTo(100, 0);
  });

  it('converts annual to weekly', () => {
    expect(toWeekly(5200, 'ANNUAL')).toBe(100);
  });
});

// =============================================================================
// PERIODS PER YEAR TESTS
// =============================================================================

describe('periodsPerYear', () => {
  it('returns 52 for weekly', () => {
    expect(periodsPerYear('WEEKLY')).toBe(52);
  });

  it('returns 26 for fortnightly', () => {
    expect(periodsPerYear('FORTNIGHTLY')).toBe(26);
  });

  it('returns 12 for monthly', () => {
    expect(periodsPerYear('MONTHLY')).toBe(12);
  });

  it('returns 4 for quarterly', () => {
    expect(periodsPerYear('QUARTERLY')).toBe(4);
  });

  it('returns 1 for annual', () => {
    expect(periodsPerYear('ANNUAL')).toBe(1);
  });

  it('returns 2 for half-yearly', () => {
    expect(periodsPerYear('HALF_YEARLY')).toBe(2);
  });
});

// =============================================================================
// CONSISTENCY TESTS
// These ensure the conversions are mathematically consistent
// =============================================================================

describe('conversion consistency', () => {
  const testAmount = 1000;

  it('weekly -> annual -> monthly equals weekly -> monthly', () => {
    const viaAnnual = toMonthly(toAnnual(testAmount, 'WEEKLY'), 'ANNUAL');
    const direct = toMonthly(testAmount, 'WEEKLY');
    expect(viaAnnual).toBeCloseTo(direct, 2);
  });

  it('converting to annual and back gives original amount', () => {
    const frequencies = ['WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUAL'] as const;

    frequencies.forEach((freq) => {
      const annual = toAnnual(testAmount, freq);
      const backToOriginal = annual / periodsPerYear(freq);
      expect(backToOriginal).toBeCloseTo(testAmount, 2);
    });
  });

  it('all frequencies sum to same annual total', () => {
    // If someone earns $52,000/year, all these should be equivalent
    const annualAmount = 52000;

    expect(toAnnual(1000, 'WEEKLY')).toBe(annualAmount);
    expect(toAnnual(2000, 'FORTNIGHTLY')).toBe(annualAmount);
    expect(toAnnual(annualAmount / 12, 'MONTHLY')).toBeCloseTo(annualAmount, 0);
    expect(toAnnual(13000, 'QUARTERLY')).toBe(annualAmount);
    expect(toAnnual(52000, 'ANNUAL')).toBe(annualAmount);
  });
});

// =============================================================================
// INTEGRATION SCENARIOS
// These test common patterns found in the duplicate implementations
// =============================================================================

describe('integration scenarios (matching duplicate implementations)', () => {
  describe('income calculations', () => {
    it('calculates total annual income from mixed frequencies', () => {
      // Primary salary: $8,500/month
      // Rental income: $650/week
      // Dividend income: $2,000/quarter

      const salary = toAnnual(8500, 'MONTHLY');
      const rental = toAnnual(650, 'WEEKLY');
      const dividends = toAnnual(2000, 'QUARTERLY');

      const totalAnnual = salary + rental + dividends;

      expect(salary).toBe(102000);
      expect(rental).toBe(33800);
      expect(dividends).toBe(8000);
      expect(totalAnnual).toBe(143800);
    });
  });

  describe('expense calculations', () => {
    it('calculates total annual expenses from mixed frequencies', () => {
      // Mortgage: $2,500/month
      // Insurance: $1,800/year
      // Rates: $3,600/year

      const mortgage = toAnnual(2500, 'MONTHLY');
      const insurance = toAnnual(1800, 'ANNUAL');
      const rates = toAnnual(3600, 'ANNUAL');

      const totalAnnual = mortgage + insurance + rates;

      expect(mortgage).toBe(30000);
      expect(totalAnnual).toBe(35400);
    });
  });

  describe('loan calculations', () => {
    it('calculates annual loan repayments', () => {
      // Monthly repayment: $2,800
      const monthlyRepayment = 2800;
      const annualRepayment = toAnnual(monthlyRepayment, 'MONTHLY');

      expect(annualRepayment).toBe(33600);

      // Fortnightly alternative
      const fortnightlyRepayment = toFortnightly(monthlyRepayment, 'MONTHLY');
      const annualFromFortnightly = toAnnual(fortnightlyRepayment, 'FORTNIGHTLY');

      // Should be approximately the same (small rounding difference)
      expect(annualFromFortnightly).toBeCloseTo(annualRepayment, 0);
    });
  });

  describe('cashflow normalization', () => {
    it('normalizes all income to monthly for cashflow display', () => {
      const incomes = [
        { amount: 650, frequency: 'WEEKLY' as const, name: 'Rent' },
        { amount: 8500, frequency: 'MONTHLY' as const, name: 'Salary' },
        { amount: 500, frequency: 'QUARTERLY' as const, name: 'Dividends' },
      ];

      const monthlyIncomes = incomes.map((i) => ({
        name: i.name,
        monthly: toMonthly(i.amount, i.frequency),
      }));

      expect(monthlyIncomes[0].monthly).toBeCloseTo(2816.67, 2); // Rent
      expect(monthlyIncomes[1].monthly).toBe(8500); // Salary
      expect(monthlyIncomes[2].monthly).toBeCloseTo(166.67, 2); // Dividends
    });
  });
});
