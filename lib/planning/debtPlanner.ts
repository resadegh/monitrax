/**
 * Debt Planner Engine
 *
 * Simulates debt repayment strategies with tax-aware, avalanche, and snowball methods.
 * Respects offset balances, fixed rate caps, and interest-only periods.
 *
 * Phase 2B Improvements:
 * - Per-loan payoff date tracking
 * - Monthly compounding interest calculation
 * - Emergency buffer implementation
 * - IO loan principal reduction with surplus
 * - Normalized monthly calculations
 * - Proper baseline vs strategy comparison
 *
 * Phase 2C Improvements:
 * - Fixed emergency buffer calculation (reduces surplus directly)
 * - IO loan safety: ioWarning flag for non-payoffable loans
 * - Daily interest calculation function (placeholder for Phase 3)
 * - Proper null handling for non-payoffable loans
 */

import { LoanType, RepaymentFrequency, RateType } from '@prisma/client';
import { toMonthly } from '../utils/frequencies';

export interface LoanInput {
  id: string;
  name: string;
  type: LoanType;
  principal: number;
  interestRateAnnual: number;
  rateType: RateType;
  fixedExpiry: Date | null;
  isInterestOnly: boolean;
  termMonthsRemaining: number;
  minRepayment: number;
  repaymentFrequency: RepaymentFrequency;
  offsetBalance: number; // Current offset account balance
  extraRepaymentCap: number | null; // Annual cap for fixed loans
}

export interface PlannerSettings {
  strategy: 'TAX_AWARE_MINIMUM_INTEREST' | 'AVALANCHE' | 'SNOWBALL';
  surplusPerPeriod: number;
  surplusFrequency: RepaymentFrequency;
  emergencyBuffer: number; // Amount to keep in offset - reduces available surplus
  respectFixedCaps: boolean;
  rolloverRepayments: boolean; // When a loan is paid off, add its min repayment to surplus
}

export interface LoanResult {
  loanId: string;
  loanName: string;
  originalPrincipal: number;
  payoffDate: Date | null; // null if loan is non-payoffable (IO with no surplus)
  baselinePayoffDate: Date | null;
  totalInterestPaid: number;
  baselineInterestPaid: number;
  monthsToPayoff: number | null; // null if loan is non-payoffable
  baselineMonthsToPayoff: number | null;
  monthsSaved: number;
  interestSaved: number;
  ioWarning: boolean; // true if IO loan cannot be paid off with current settings
}

export interface PlanResult {
  loanResults: LoanResult[];
  totalInterestPaid: number;
  totalInterestSaved: number;
  debtFreeDate: Date | null;
  baselineDebtFreeDate: Date | null;
  strategyUsed: string;
}

interface SimulationLoan {
  id: string;
  name: string;
  type: LoanType;
  originalPrincipal: number;
  currentPrincipal: number;
  interestRateAnnual: number;
  rateType: RateType;
  fixedExpiry: Date | null;
  isInterestOnly: boolean;
  termMonthsRemaining: number;
  minRepaymentMonthly: number; // Normalized to monthly
  offsetBalance: number;
  extraRepaymentCapMonthly: number | null; // Normalized to monthly
  totalInterestPaid: number;
  isPaidOff: boolean;
  isNonPayoffable: boolean; // IO loan with no surplus available
  payoffDate: Date | null;
  monthsToPayoff: number | null;
  extraRepaymentYTD: number; // Track extra repayments for fixed cap
}

// Monthly compounding constants
const MONTHS_PER_YEAR = 12;
const DAYS_PER_YEAR = 365;
const MAX_SIMULATION_MONTHS = 1200; // 100 years safety limit

/**
 * Calculate monthly interest using monthly compounding
 * Formula: Principal * (annualRate / 12)
 * This is the standard bank calculation method
 */
function calculateMonthlyInterest(principal: number, annualRate: number, offsetBalance: number = 0): number {
  const effectivePrincipal = Math.max(0, principal - offsetBalance);
  const monthlyRate = annualRate / MONTHS_PER_YEAR;
  return effectivePrincipal * monthlyRate;
}

/**
 * Calculate daily interest (placeholder for Phase 3)
 *
 * Daily compounding formula: Principal * (annualRate / 365) * daysInPeriod
 * This provides more accurate interest calculation, especially for
 * mid-month payments or variable month lengths.
 *
 * @param principal - The loan principal
 * @param annualRate - Annual interest rate as decimal (e.g., 0.06 for 6%)
 * @param daysInPeriod - Number of days to calculate interest for
 * @param offsetBalance - Offset account balance to subtract from principal
 * @returns Interest amount for the period
 *
 * TODO: Enable in Phase 3 for more accurate calculations
 */
function calculateDailyInterest(
  principal: number,
  annualRate: number,
  daysInPeriod: number,
  offsetBalance: number = 0
): number {
  const effectivePrincipal = Math.max(0, principal - offsetBalance);
  const dailyRate = annualRate / DAYS_PER_YEAR;
  return effectivePrincipal * dailyRate * daysInPeriod;
}

/**
 * Calculate minimum repayment for P&I loan using amortization formula
 * M = P * [r(1+r)^n] / [(1+r)^n - 1]
 * where: P = principal, r = monthly rate, n = number of months
 */
function calculateMinRepaymentPI(principal: number, annualRate: number, termMonths: number): number {
  if (termMonths <= 0 || annualRate <= 0) return principal; // Edge case: pay off immediately

  const monthlyRate = annualRate / MONTHS_PER_YEAR;
  const factor = Math.pow(1 + monthlyRate, termMonths);
  const minPayment = principal * (monthlyRate * factor) / (factor - 1);

  return Math.max(minPayment, 0);
}

/**
 * Calculate minimum repayment for IO loan (interest only)
 */
function calculateMinRepaymentIO(principal: number, annualRate: number, offsetBalance: number = 0): number {
  return calculateMonthlyInterest(principal, annualRate, offsetBalance);
}

/**
 * Validate and correct minRepayment if needed
 */
function validateMinRepayment(loan: LoanInput): number {
  const monthlyMin = toMonthly(loan.minRepayment, loan.repaymentFrequency);

  if (loan.isInterestOnly) {
    const requiredMin = calculateMinRepaymentIO(loan.principal, loan.interestRateAnnual, loan.offsetBalance);
    // If user-supplied is less than interest, use calculated value
    return Math.max(monthlyMin, requiredMin);
  } else {
    const requiredMin = calculateMinRepaymentPI(loan.principal, loan.interestRateAnnual, loan.termMonthsRemaining);
    // If user-supplied is significantly less than required, use calculated value
    // Allow 5% tolerance for rounding
    if (monthlyMin < requiredMin * 0.95) {
      return requiredMin;
    }
    return monthlyMin;
  }
}

/**
 * Initialize simulation loan from input
 */
function initSimulationLoan(loan: LoanInput): SimulationLoan {
  return {
    id: loan.id,
    name: loan.name,
    type: loan.type,
    originalPrincipal: loan.principal,
    currentPrincipal: loan.principal,
    interestRateAnnual: loan.interestRateAnnual,
    rateType: loan.rateType,
    fixedExpiry: loan.fixedExpiry,
    isInterestOnly: loan.isInterestOnly,
    termMonthsRemaining: loan.termMonthsRemaining,
    minRepaymentMonthly: validateMinRepayment(loan),
    offsetBalance: loan.offsetBalance,
    extraRepaymentCapMonthly: loan.extraRepaymentCap !== null
      ? loan.extraRepaymentCap / MONTHS_PER_YEAR
      : null,
    totalInterestPaid: 0,
    isPaidOff: false,
    isNonPayoffable: false,
    payoffDate: null,
    monthsToPayoff: null,
    extraRepaymentYTD: 0,
  };
}

/**
 * Project offset balance growth (placeholder - disabled)
 * When enabled, this would model offset balance increasing over time
 */
function projectOffsetBalance(
  currentBalance: number,
  _monthsElapsed: number,
  _growthRateAnnual: number = 0
): number {
  // Placeholder: offset balance projection disabled
  // When enabled, would return: currentBalance * Math.pow(1 + growthRateAnnual/12, monthsElapsed)
  return currentBalance;
}

/**
 * Run the debt repayment simulation
 */
export function runDebtPlan(loans: LoanInput[], settings: PlannerSettings): PlanResult {
  // Normalize surplus to monthly
  const monthlySurplus = toMonthly(settings.surplusPerPeriod, settings.surplusFrequency);

  // Emergency buffer reduces available surplus for extra repayments
  // This represents money the user wants to keep available for emergencies
  // rather than putting towards debt repayment
  const effectiveSurplus = Math.max(0, monthlySurplus - settings.emergencyBuffer);

  // Calculate baseline (minimum repayments only)
  const baselineResults = simulateRepayments(loans, {
    monthlySurplus: 0,
    emergencyBuffer: 0,
    rolloverRepayments: false,
    respectFixedCaps: true,
    strategy: settings.strategy,
  });

  // Run strategy simulation with surplus
  const strategyResults = simulateRepayments(loans, {
    monthlySurplus: effectiveSurplus,
    emergencyBuffer: settings.emergencyBuffer,
    rolloverRepayments: settings.rolloverRepayments,
    respectFixedCaps: settings.respectFixedCaps,
    strategy: settings.strategy,
  });

  // Build loan results with comparison
  const loanResults: LoanResult[] = strategyResults.loans.map((stratLoan) => {
    const baseLoan = baselineResults.loans.find((l) => l.id === stratLoan.id)!;

    // Determine if this is a non-payoffable IO loan
    const ioWarning = stratLoan.isNonPayoffable || baseLoan.isNonPayoffable;

    // Calculate months saved (only if both are payoffable)
    const monthsSaved = (stratLoan.monthsToPayoff !== null && baseLoan.monthsToPayoff !== null)
      ? Math.max(0, baseLoan.monthsToPayoff - stratLoan.monthsToPayoff)
      : 0;

    return {
      loanId: stratLoan.id,
      loanName: stratLoan.name,
      originalPrincipal: stratLoan.originalPrincipal,
      payoffDate: stratLoan.payoffDate,
      baselinePayoffDate: baseLoan.payoffDate,
      totalInterestPaid: stratLoan.totalInterestPaid,
      baselineInterestPaid: baseLoan.totalInterestPaid,
      monthsToPayoff: stratLoan.monthsToPayoff,
      baselineMonthsToPayoff: baseLoan.monthsToPayoff,
      monthsSaved,
      interestSaved: Math.max(0, baseLoan.totalInterestPaid - stratLoan.totalInterestPaid),
      ioWarning,
    };
  });

  const totalInterestPaid = strategyResults.totalInterestPaid;
  const totalInterestSaved = Math.max(0, baselineResults.totalInterestPaid - strategyResults.totalInterestPaid);

  return {
    loanResults,
    totalInterestPaid,
    totalInterestSaved,
    debtFreeDate: strategyResults.debtFreeDate,
    baselineDebtFreeDate: baselineResults.debtFreeDate,
    strategyUsed: settings.strategy,
  };
}

interface SimulationSettings {
  monthlySurplus: number;
  emergencyBuffer: number;
  rolloverRepayments: boolean;
  respectFixedCaps: boolean;
  strategy: 'TAX_AWARE_MINIMUM_INTEREST' | 'AVALANCHE' | 'SNOWBALL';
}

/**
 * Core simulation function - runs monthly
 */
function simulateRepayments(loans: LoanInput[], settings: SimulationSettings) {
  const simLoans: SimulationLoan[] = loans.map(initSimulationLoan);

  // Pre-check for IO loans that cannot be paid off
  // An IO loan with no surplus cannot pay down principal
  for (const loan of simLoans) {
    if (loan.isInterestOnly && settings.monthlySurplus <= 0) {
      // Mark as non-payoffable - IO loan with no surplus will never pay off
      loan.isNonPayoffable = true;
    }
  }

  const startDate = new Date();
  let currentDate = new Date(startDate);
  let availableSurplus = settings.monthlySurplus;
  let totalInterestPaid = 0;
  let debtFreeDate: Date | null = null;
  let currentYear = currentDate.getFullYear();

  for (let month = 0; month < MAX_SIMULATION_MONTHS; month++) {
    // Reset annual extra repayment tracking at year boundary
    if (currentDate.getFullYear() !== currentYear) {
      currentYear = currentDate.getFullYear();
      for (const loan of simLoans) {
        loan.extraRepaymentYTD = 0;
      }
    }

    let allPaidOffOrNonPayoffable = true;

    // Process each loan
    for (const loan of simLoans) {
      if (loan.isPaidOff) continue;

      // Skip non-payoffable loans for payoff check but still accrue interest
      if (loan.isNonPayoffable) {
        // Still calculate interest for non-payoffable loans (for reporting)
        const projectedOffset = projectOffsetBalance(loan.offsetBalance, month);
        const interestThisMonth = calculateMonthlyInterest(
          loan.currentPrincipal,
          loan.interestRateAnnual,
          projectedOffset
        );
        loan.totalInterestPaid += interestThisMonth;
        totalInterestPaid += interestThisMonth;
        continue; // Don't count towards allPaidOff
      }

      allPaidOffOrNonPayoffable = false;

      // Project offset balance (placeholder - currently returns same value)
      const projectedOffset = projectOffsetBalance(loan.offsetBalance, month);

      // Calculate interest for this month (monthly compounding)
      const interestThisMonth = calculateMonthlyInterest(
        loan.currentPrincipal,
        loan.interestRateAnnual,
        projectedOffset
      );

      loan.totalInterestPaid += interestThisMonth;
      totalInterestPaid += interestThisMonth;

      // Apply minimum repayment
      if (loan.isInterestOnly) {
        // IO loan: minimum payment covers interest only
        // Principal can only be reduced by surplus payments
        // Note: IO loans don't reduce principal with min payment
      } else {
        // P&I loan: minimum payment covers interest + principal
        const principalPortion = loan.minRepaymentMonthly - interestThisMonth;
        if (principalPortion > 0) {
          loan.currentPrincipal = Math.max(0, loan.currentPrincipal - principalPortion);
        }
      }

      // Check if paid off by minimum payments
      if (loan.currentPrincipal <= 0.01) {
        loan.isPaidOff = true;
        loan.currentPrincipal = 0;
        loan.payoffDate = new Date(currentDate);
        loan.monthsToPayoff = month + 1;
        if (settings.rolloverRepayments) {
          availableSurplus += loan.minRepaymentMonthly;
        }
      }
    }

    // Apply surplus to target loan based on strategy
    if (availableSurplus > 0) {
      const targetLoan = selectTargetLoan(simLoans, settings.strategy, currentDate);

      if (targetLoan) {
        let extraPayment = availableSurplus;

        // Respect fixed rate caps
        if (settings.respectFixedCaps && targetLoan.rateType === 'FIXED') {
          if (targetLoan.fixedExpiry && currentDate < targetLoan.fixedExpiry) {
            if (targetLoan.extraRepaymentCapMonthly !== null) {
              // Check annual cap - convert monthly cap to remaining annual allowance
              const annualCap = targetLoan.extraRepaymentCapMonthly * MONTHS_PER_YEAR;
              const remainingCap = annualCap - targetLoan.extraRepaymentYTD;
              extraPayment = Math.min(extraPayment, Math.max(0, remainingCap));
            }
          }
        }

        // Don't overpay
        extraPayment = Math.min(extraPayment, targetLoan.currentPrincipal);

        if (extraPayment > 0) {
          targetLoan.currentPrincipal = Math.max(0, targetLoan.currentPrincipal - extraPayment);
          targetLoan.extraRepaymentYTD += extraPayment;

          // Check if paid off by extra payment
          if (targetLoan.currentPrincipal <= 0.01) {
            targetLoan.isPaidOff = true;
            targetLoan.currentPrincipal = 0;
            targetLoan.payoffDate = new Date(currentDate);
            targetLoan.monthsToPayoff = month + 1;
            if (settings.rolloverRepayments) {
              availableSurplus += targetLoan.minRepaymentMonthly;
            }
          }
        }
      }
    }

    // Advance to next month
    currentDate = new Date(currentDate);
    currentDate.setMonth(currentDate.getMonth() + 1);

    // Check if all payoffable loans are paid off
    const payoffableLoans = simLoans.filter(l => !l.isNonPayoffable);
    if (allPaidOffOrNonPayoffable || payoffableLoans.every((l) => l.isPaidOff)) {
      debtFreeDate = new Date(currentDate);
      // Set payoff date for any payoffable loans that haven't been set
      for (const loan of simLoans) {
        if (!loan.isNonPayoffable && !loan.payoffDate) {
          loan.payoffDate = debtFreeDate;
          loan.monthsToPayoff = month + 1;
        }
      }
      break;
    }
  }

  // Handle loans that didn't pay off
  for (const loan of simLoans) {
    if (loan.isNonPayoffable) {
      // Non-payoffable loans get null values
      loan.payoffDate = null;
      loan.monthsToPayoff = null;
    } else if (!loan.payoffDate) {
      // Payoffable loans that hit max months get the final date
      loan.payoffDate = new Date(currentDate);
      loan.monthsToPayoff = MAX_SIMULATION_MONTHS;
    }
  }

  return {
    loans: simLoans,
    totalInterestPaid,
    debtFreeDate,
  };
}

/**
 * Select target loan based on strategy
 */
function selectTargetLoan(
  loans: SimulationLoan[],
  strategy: 'TAX_AWARE_MINIMUM_INTEREST' | 'AVALANCHE' | 'SNOWBALL',
  _currentDate: Date
): SimulationLoan | null {
  // Only consider loans that are not paid off and not non-payoffable
  const activeLoans = loans.filter((l) => !l.isPaidOff && !l.isNonPayoffable);

  if (activeLoans.length === 0) return null;

  switch (strategy) {
    case 'TAX_AWARE_MINIMUM_INTEREST':
      // Pay off HOME loans first (non-deductible), then INVESTMENT loans
      const homeLoans = activeLoans.filter((l) => l.type === 'HOME');
      if (homeLoans.length > 0) {
        // Within HOME loans, target highest rate
        return homeLoans.reduce((highest, loan) =>
          loan.interestRateAnnual > highest.interestRateAnnual ? loan : highest
        );
      }
      // All HOME loans paid off, target highest rate INVESTMENT loan
      return activeLoans.reduce((highest, loan) =>
        loan.interestRateAnnual > highest.interestRateAnnual ? loan : highest
      );

    case 'AVALANCHE':
      // Highest interest rate first
      return activeLoans.reduce((highest, loan) =>
        loan.interestRateAnnual > highest.interestRateAnnual ? loan : highest
      );

    case 'SNOWBALL':
      // Smallest balance first
      return activeLoans.reduce((smallest, loan) =>
        loan.currentPrincipal < smallest.currentPrincipal ? loan : smallest
      );

    default:
      return activeLoans[0];
  }
}

// Export for testing
export { calculateDailyInterest, calculateMonthlyInterest, calculateMinRepaymentPI };
