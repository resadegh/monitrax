/**
 * FINANCIAL CALCULATION UNIT TESTS
 * Tests core financial calculations against known formulas
 *
 * Run with: npm run test:calculations
 */

import { describe, it, expect } from 'vitest';

// =============================================================================
// CALCULATION HELPERS (Extracted from application code)
// =============================================================================

/**
 * Calculate Loan-to-Value Ratio (LVR)
 */
function calculateLVR(loanPrincipal: number, propertyValue: number): number {
  if (propertyValue <= 0) throw new Error('Property value must be positive');
  return loanPrincipal / propertyValue;
}

/**
 * Calculate effective principal after offset
 */
function calculateEffectivePrincipal(
  principal: number,
  offsetBalance: number
): number {
  return Math.max(0, principal - offsetBalance);
}

/**
 * Calculate monthly interest
 */
function calculateMonthlyInterest(
  principal: number,
  annualRate: number
): number {
  return (principal * annualRate) / 12;
}

/**
 * Calculate interest saved by offset
 */
function calculateOffsetSavings(
  offsetBalance: number,
  linkedLoanRate: number
): number {
  return offsetBalance * linkedLoanRate;
}

/**
 * Calculate gross rental yield
 */
function calculateGrossYield(
  weeklyRent: number,
  propertyValue: number
): number {
  if (propertyValue <= 0) throw new Error('Property value must be positive');
  const annualRent = weeklyRent * 52;
  return annualRent / propertyValue;
}

/**
 * Calculate net rental yield
 */
function calculateNetYield(
  weeklyRent: number,
  annualExpenses: number,
  propertyValue: number
): number {
  if (propertyValue <= 0) throw new Error('Property value must be positive');
  const annualRent = weeklyRent * 52;
  return (annualRent - annualExpenses) / propertyValue;
}

/**
 * Calculate depreciation (Prime Cost method)
 */
function calculatePrimeCostDepreciation(
  cost: number,
  rate: number
): number {
  return cost * rate;
}

/**
 * Calculate depreciation (Diminishing Value method)
 */
function calculateDiminishingValueDepreciation(
  cost: number,
  rate: number,
  years: number
): number {
  // DV method: remaining value * rate * 2 (200% loading for post-10 May 2006)
  let remaining = cost;
  for (let i = 0; i < years - 1; i++) {
    remaining = remaining * (1 - rate * 2);
  }
  return remaining * rate * 2;
}

/**
 * Calculate franking credit
 */
function calculateFrankingCredit(
  grossDividend: number,
  frankingPercentage: number,
  companyTaxRate: number = 0.30
): number {
  return grossDividend * frankingPercentage * (companyTaxRate / (1 - companyTaxRate));
}

/**
 * Calculate capital gain with CGT discount
 */
function calculateCGT(
  costBase: number,
  salePrice: number,
  eligibleForDiscount: boolean
): { grossGain: number; taxableGain: number } {
  const grossGain = salePrice - costBase;
  const taxableGain = eligibleForDiscount && grossGain > 0
    ? grossGain * 0.5
    : grossGain;
  return { grossGain, taxableGain };
}

/**
 * Calculate weighted average cost
 */
function calculateWeightedAverageCost(
  parcels: Array<{ units: number; price: number; fees?: number }>
): number {
  const totalCost = parcels.reduce(
    (sum, p) => sum + p.units * p.price + (p.fees || 0),
    0
  );
  const totalUnits = parcels.reduce((sum, p) => sum + p.units, 0);
  return totalCost / totalUnits;
}

/**
 * Normalise amount to monthly
 */
function normalizeToMonthly(amount: number, frequency: string): number {
  switch (frequency) {
    case 'WEEKLY':
      return (amount * 52) / 12;
    case 'FORTNIGHTLY':
      return (amount * 26) / 12;
    case 'MONTHLY':
      return amount;
    case 'QUARTERLY':
      return amount / 3;
    case 'ANNUAL':
      return amount / 12;
    default:
      return amount;
  }
}

/**
 * Calculate negative gearing benefit
 */
function calculateNegativeGearingBenefit(
  rentalLoss: number,
  marginalTaxRate: number
): number {
  return Math.abs(rentalLoss) * marginalTaxRate;
}

// =============================================================================
// LVR CALCULATION TESTS
// =============================================================================

describe('LVR Calculations', () => {
  it('should calculate standard LVR correctly', () => {
    expect(calculateLVR(520000, 950000)).toBeCloseTo(0.5474, 4);
    expect(calculateLVR(440000, 620000)).toBeCloseTo(0.7097, 4);
    expect(calculateLVR(400000, 500000)).toBe(0.8);
  });

  it('should calculate high LVR correctly', () => {
    // Portfolio B: Split loans on property
    const combinedLVR = calculateLVR(250000 + 180000, 460000);
    expect(combinedLVR).toBeCloseTo(0.9348, 4);
    expect(combinedLVR).toBeGreaterThan(0.9);
  });

  it('should handle edge case of 100% LVR', () => {
    expect(calculateLVR(500000, 500000)).toBe(1.0);
  });

  it('should handle underwater property (LVR > 100%)', () => {
    expect(calculateLVR(500000, 450000)).toBeCloseTo(1.1111, 4);
  });

  it('should throw for zero property value', () => {
    expect(() => calculateLVR(500000, 0)).toThrow();
  });
});

// =============================================================================
// INTEREST CALCULATION TESTS
// =============================================================================

describe('Interest Calculations', () => {
  it('should calculate effective principal with offset', () => {
    expect(calculateEffectivePrincipal(520000, 45000)).toBe(475000);
    expect(calculateEffectivePrincipal(250000, 12000)).toBe(238000);
  });

  it('should not go below zero with large offset', () => {
    expect(calculateEffectivePrincipal(100000, 150000)).toBe(0);
  });

  it('should calculate monthly interest correctly', () => {
    // Home loan: $475k effective @ 6.25%
    expect(calculateMonthlyInterest(475000, 0.0625)).toBeCloseTo(2473.96, 2);

    // Investment loan: $440k @ 6.85%
    expect(calculateMonthlyInterest(440000, 0.0685)).toBeCloseTo(2511.67, 2);

    // Variable loan with offset: $238k @ 6.95%
    expect(calculateMonthlyInterest(238000, 0.0695)).toBeCloseTo(1378.59, 2);

    // Fixed loan: $180k @ 5.89%
    expect(calculateMonthlyInterest(180000, 0.0589)).toBeCloseTo(883.50, 2);
  });

  it('should calculate annual offset savings', () => {
    // $45k in offset at 6.25%
    expect(calculateOffsetSavings(45000, 0.0625)).toBeCloseTo(2812.50, 2);

    // $12k in offset at 6.95%
    expect(calculateOffsetSavings(12000, 0.0695)).toBeCloseTo(834, 2);
  });

  it('should calculate credit card interest', () => {
    // $8,500 at 21.99%
    const monthlyInterest = calculateMonthlyInterest(8500, 0.2199);
    expect(monthlyInterest).toBeCloseTo(155.76, 2);
  });
});

// =============================================================================
// RENTAL YIELD TESTS
// =============================================================================

describe('Rental Yield Calculations', () => {
  it('should calculate gross yield correctly', () => {
    // Melbourne investment: $550/week, $620k value
    expect(calculateGrossYield(550, 620000)).toBeCloseTo(0.0461, 4);

    // Brisbane investment: $380/week, $460k value
    expect(calculateGrossYield(380, 460000)).toBeCloseTo(0.043, 3);
  });

  it('should calculate yield on purchase price', () => {
    // Melbourne: $550/week, $550k purchase
    expect(calculateGrossYield(550, 550000)).toBeCloseTo(0.052, 3);
  });

  it('should calculate net yield with expenses', () => {
    // Melbourne: $550/week, $48,776 expenses, $620k value
    const netYield = calculateNetYield(550, 48776, 620000);
    // Net: (28600 - 48776) / 620000 = -0.0325
    expect(netYield).toBeCloseTo(-0.0325, 4);
  });
});

// =============================================================================
// DEPRECIATION TESTS
// =============================================================================

describe('Depreciation Calculations', () => {
  describe('DIV43 Capital Works', () => {
    it('should calculate 2.5% rate for post-1987 buildings', () => {
      const building = calculatePrimeCostDepreciation(350000, 0.025);
      expect(building).toBe(8750);
    });

    it('should calculate 4% rate for pre-1987 buildings', () => {
      const building = calculatePrimeCostDepreciation(350000, 0.04);
      expect(building).toBe(14000);
    });
  });

  describe('DIV40 Plant & Equipment', () => {
    it('should calculate prime cost depreciation', () => {
      // Air conditioning: $6,500 @ 10%
      expect(calculatePrimeCostDepreciation(6500, 0.1)).toBe(650);

      // Hot water system: $2,500 @ 10%
      expect(calculatePrimeCostDepreciation(2500, 0.1)).toBe(250);
    });

    it('should calculate diminishing value depreciation year 1', () => {
      // Carpet: $8,000 @ 12.5% DV
      // Year 1 = $8,000 * 0.125 * 2 = $2,000
      const year1 = calculateDiminishingValueDepreciation(8000, 0.125, 1);
      expect(year1).toBe(2000);
    });

    it('should calculate diminishing value depreciation year 3', () => {
      // Carpet: $8,000 @ 12.5% DV
      // Year 1: remaining = 8000, deduction = 2000, end = 6000
      // Year 2: remaining = 6000, deduction = 1500, end = 4500
      // Year 3: remaining = 4500, deduction = 1125
      const year3 = calculateDiminishingValueDepreciation(8000, 0.125, 3);
      expect(year3).toBeCloseTo(1125, 0);
    });
  });

  describe('Total Depreciation', () => {
    it('should calculate total annual depreciation for investment property', () => {
      const div43 = calculatePrimeCostDepreciation(350000, 0.025); // 8750
      const aircon = calculatePrimeCostDepreciation(6500, 0.1); // 650
      const hws = calculatePrimeCostDepreciation(2500, 0.1); // 250
      // Carpet DV year 3 ≈ 1125

      const total = div43 + aircon + hws + 1125;
      expect(total).toBeCloseTo(10775, -2); // Within 100
    });
  });
});

// =============================================================================
// FRANKING CREDIT TESTS
// =============================================================================

describe('Franking Credit Calculations', () => {
  it('should calculate franking credit for fully franked dividend', () => {
    // $382.50 dividend, 100% franked
    const credit = calculateFrankingCredit(382.50, 1.0, 0.30);
    // = 382.50 * 1.0 * (0.30 / 0.70) = 382.50 * 0.4286 = 163.93
    expect(credit).toBeCloseTo(163.93, 2);
  });

  it('should calculate franking credit for 80% franked dividend', () => {
    // VAS dividend: $382.50, 80% franked
    const credit = calculateFrankingCredit(382.50, 0.80, 0.30);
    // = 382.50 * 0.80 * (0.30 / 0.70) = 306 * 0.4286 = 131.14
    expect(credit).toBeCloseTo(131.14, 2);
  });

  it('should return 0 for unfranked dividend', () => {
    const credit = calculateFrankingCredit(500, 0, 0.30);
    expect(credit).toBe(0);
  });

  it('should handle base rate entity (25% company tax)', () => {
    const credit = calculateFrankingCredit(100, 1.0, 0.25);
    // = 100 * 1.0 * (0.25 / 0.75) = 100 * 0.333 = 33.33
    expect(credit).toBeCloseTo(33.33, 2);
  });
});

// =============================================================================
// CGT CALCULATION TESTS
// =============================================================================

describe('CGT Calculations', () => {
  it('should calculate full capital gain', () => {
    const result = calculateCGT(550000, 620000, false);
    expect(result.grossGain).toBe(70000);
    expect(result.taxableGain).toBe(70000);
  });

  it('should apply 50% CGT discount for assets held > 12 months', () => {
    const result = calculateCGT(550000, 620000, true);
    expect(result.grossGain).toBe(70000);
    expect(result.taxableGain).toBe(35000);
  });

  it('should handle capital loss', () => {
    const result = calculateCGT(480000, 460000, true);
    expect(result.grossGain).toBe(-20000);
    expect(result.taxableGain).toBe(-20000); // No discount on loss
  });

  it('should calculate CGT for ETF holdings', () => {
    // VAS: cost base $38,544, current value $40,500
    const vas = calculateCGT(38544, 40500, true);
    expect(vas.grossGain).toBe(1956);
    expect(vas.taxableGain).toBe(978);

    // VGS: cost base $29,474, current value $32,200
    const vgs = calculateCGT(29474, 32200, true);
    expect(vgs.grossGain).toBe(2726);
    expect(vgs.taxableGain).toBe(1363);
  });
});

// =============================================================================
// INVESTMENT CALCULATION TESTS
// =============================================================================

describe('Investment Calculations', () => {
  describe('Weighted Average Cost', () => {
    it('should calculate VAS weighted average cost', () => {
      const parcels = [
        { units: 200, price: 82.00, fees: 9.50 },
        { units: 250, price: 88.50, fees: 9.50 },
      ];
      const avgCost = calculateWeightedAverageCost(parcels);
      // Total cost: (200*82 + 9.50) + (250*88.50 + 9.50) = 16409.50 + 22134.50 = 38544
      // Total units: 450
      // Avg: 38544 / 450 = 85.65
      expect(avgCost).toBeCloseTo(85.65, 2);
    });

    it('should calculate VGS weighted average cost', () => {
      const parcels = [
        { units: 150, price: 98.00, fees: 9.50 },
        { units: 130, price: 113.50, fees: 9.50 },
      ];
      const avgCost = calculateWeightedAverageCost(parcels);
      // Total cost: (150*98 + 9.50) + (130*113.50 + 9.50) = 14709.50 + 14764.50 = 29474
      // Total units: 280
      // Avg: 29474 / 280 = 105.26
      expect(avgCost).toBeCloseTo(105.26, 2);
    });
  });

  describe('Portfolio Value', () => {
    it('should calculate total portfolio value', () => {
      const holdings = [
        { units: 450, currentPrice: 90 }, // VAS
        { units: 280, currentPrice: 115 }, // VGS
      ];
      const totalValue = holdings.reduce(
        (sum, h) => sum + h.units * h.currentPrice,
        0
      );
      expect(totalValue).toBe(72700);
    });
  });
});

// =============================================================================
// FREQUENCY NORMALISATION TESTS
// =============================================================================

describe('Frequency Normalisation', () => {
  it('should normalise weekly to monthly', () => {
    // $550/week rent
    expect(normalizeToMonthly(550, 'WEEKLY')).toBeCloseTo(2383.33, 2);
  });

  it('should normalise fortnightly to monthly', () => {
    expect(normalizeToMonthly(1000, 'FORTNIGHTLY')).toBeCloseTo(2166.67, 2);
  });

  it('should keep monthly as is', () => {
    expect(normalizeToMonthly(3000, 'MONTHLY')).toBe(3000);
  });

  it('should normalise annual to monthly', () => {
    expect(normalizeToMonthly(24000, 'ANNUAL')).toBe(2000);
  });

  it('should normalise quarterly to monthly', () => {
    expect(normalizeToMonthly(3000, 'QUARTERLY')).toBe(1000);
  });
});

// =============================================================================
// NEGATIVE GEARING TESTS
// =============================================================================

describe('Negative Gearing Calculations', () => {
  it('should calculate tax benefit at 37% rate', () => {
    // Portfolio A: $20,176 rental loss
    const benefit = calculateNegativeGearingBenefit(-20176, 0.37);
    expect(benefit).toBeCloseTo(7465, 0);
  });

  it('should calculate tax benefit at 32.5% rate', () => {
    // Portfolio B: $17,583 rental loss
    const benefit = calculateNegativeGearingBenefit(-17583, 0.325);
    expect(benefit).toBeCloseTo(5714, 0);
  });

  it('should calculate effective out-of-pocket cost', () => {
    const rentalLoss = -17583;
    const taxBenefit = calculateNegativeGearingBenefit(rentalLoss, 0.325);
    const netCost = Math.abs(rentalLoss) - taxBenefit;
    expect(netCost).toBeCloseTo(11869, 0);
  });
});

// =============================================================================
// NET WORTH CALCULATION TESTS
// =============================================================================

describe('Net Worth Calculations', () => {
  it('should calculate Portfolio A net worth', () => {
    // Assets
    const properties = 950000 + 620000;
    const accounts = 45000 + 25000 + 5000;
    const investments = 40500 + 32200;
    const totalAssets = properties + accounts + investments;

    // Liabilities
    const loans = 520000 + 440000;
    const totalLiabilities = loans;

    const netWorth = totalAssets - totalLiabilities;

    expect(netWorth).toBe(757700);
  });

  it('should calculate Portfolio B net worth', () => {
    // Assets
    const properties = 460000;
    const accounts = 12000; // Offset only (CC is liability)
    const totalAssets = properties + accounts;

    // Liabilities
    const loans = 250000 + 180000;
    const creditCard = 8500;
    const totalLiabilities = loans + creditCard;

    const netWorth = totalAssets - totalLiabilities;

    expect(netWorth).toBe(33500);
  });
});
