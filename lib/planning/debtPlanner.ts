/**
 * Debt Planner Engine
 *
 * Simulates debt repayment strategies with tax-aware, avalanche, and snowball methods.
 * Respects offset balances, fixed rate caps, and interest-only periods.
 */

import { LoanType, RepaymentFrequency, RateType } from '@prisma/client';
import { periodsPerYear } from '../utils/frequencies';

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
  emergencyBuffer: number; // Amount to keep in offset
  respectFixedCaps: boolean;
  rolloverRepayments: boolean; // When a loan is paid off, add its min repayment to surplus
}

export interface LoanResult {
  loanId: string;
  loanName: string;
  originalPrincipal: number;
  payoffDate: Date;
  totalInterestPaid: number;
  monthsSaved: number;
  interestSaved: number;
}

export interface PlanResult {
  loanResults: LoanResult[];
  totalInterestPaid: number;
  totalInterestSaved: number;
  debtFreeDate: Date | null;
  strategyUsed: string;
}

interface SimulationLoan extends LoanInput {
  currentPrincipal: number;
  totalInterestPaid: number;
  isPaidOff: boolean;
}

/**
 * Run the debt repayment simulation
 */
export function runDebtPlan(loans: LoanInput[], settings: PlannerSettings): PlanResult {
  // Calculate baseline (minimum repayments only)
  const baseline = simulateMinimumRepayments([...loans]);

  // Run strategy simulation with surplus
  const strategyResult = simulateStrategy([...loans], settings);

  // Calculate savings
  const loanResults: LoanResult[] = strategyResult.loans.map((loan) => {
    const baselineLoan = baseline.loans.find((l) => l.id === loan.id)!;

    return {
      loanId: loan.id,
      loanName: loan.name,
      originalPrincipal: loan.principal,
      payoffDate: loan.payoffDate!,
      totalInterestPaid: loan.totalInterestPaid,
      monthsSaved: Math.max(0, baselineLoan.monthsToPayoff! - loan.monthsToPayoff!),
      interestSaved: Math.max(0, baselineLoan.totalInterestPaid - loan.totalInterestPaid),
    };
  });

  const totalInterestPaid = strategyResult.totalInterestPaid;
  const totalInterestSaved = Math.max(0, baseline.totalInterestPaid - strategyResult.totalInterestPaid);

  return {
    loanResults,
    totalInterestPaid,
    totalInterestSaved,
    debtFreeDate: strategyResult.debtFreeDate,
    strategyUsed: settings.strategy,
  };
}

/**
 * Simulate minimum repayments only (baseline)
 */
function simulateMinimumRepayments(loans: LoanInput[]) {
  const simLoans: SimulationLoan[] = loans.map((l) => ({
    ...l,
    currentPrincipal: l.principal,
    totalInterestPaid: 0,
    isPaidOff: false,
  }));

  let currentDate = new Date();
  let totalInterestPaid = 0;
  let debtFreeDate: Date | null = null;
  const maxPeriods = 1200; // 100 years safety limit

  for (let period = 0; period < maxPeriods; period++) {
    let allPaidOff = true;

    for (const loan of simLoans) {
      if (loan.isPaidOff) continue;

      allPaidOff = false;

      const effectivePrincipal = Math.max(0, loan.currentPrincipal - loan.offsetBalance);
      const periodsPerYr = periodsPerYear(loan.repaymentFrequency);
      const interestForPeriod = (effectivePrincipal * loan.interestRateAnnual) / periodsPerYr;

      loan.totalInterestPaid += interestForPeriod;
      totalInterestPaid += interestForPeriod;

      if (!loan.isInterestOnly) {
        const principalPortion = loan.minRepayment - interestForPeriod;
        loan.currentPrincipal = Math.max(0, loan.currentPrincipal - principalPortion);
      }

      if (loan.currentPrincipal <= 0.01) {
        loan.isPaidOff = true;
        loan.currentPrincipal = 0;
      }
    }

    currentDate = addPeriod(currentDate, loans[0]?.repaymentFrequency || 'MONTHLY');

    if (allPaidOff) {
      debtFreeDate = currentDate;
      break;
    }
  }

  return {
    loans: simLoans.map((l) => ({
      ...l,
      monthsToPayoff: Math.ceil(
        ((currentDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 30.44))
      ),
      payoffDate: debtFreeDate,
    })),
    totalInterestPaid,
    debtFreeDate,
  };
}

/**
 * Simulate strategy with surplus payments
 */
function simulateStrategy(loans: LoanInput[], settings: PlannerSettings) {
  const simLoans: SimulationLoan[] = loans.map((l) => ({
    ...l,
    currentPrincipal: l.principal,
    totalInterestPaid: 0,
    isPaidOff: false,
  }));

  let currentDate = new Date();
  let availableSurplus = settings.surplusPerPeriod;
  let totalInterestPaid = 0;
  let debtFreeDate: Date | null = null;
  const maxPeriods = 1200;

  for (let period = 0; period < maxPeriods; period++) {
    let allPaidOff = true;

    // Apply minimum repayments and calculate interest
    for (const loan of simLoans) {
      if (loan.isPaidOff) continue;

      allPaidOff = false;

      const effectivePrincipal = Math.max(0, loan.currentPrincipal - loan.offsetBalance);
      const periodsPerYr = periodsPerYear(loan.repaymentFrequency);
      const interestForPeriod = (effectivePrincipal * loan.interestRateAnnual) / periodsPerYr;

      loan.totalInterestPaid += interestForPeriod;
      totalInterestPaid += interestForPeriod;

      if (!loan.isInterestOnly) {
        const principalPortion = loan.minRepayment - interestForPeriod;
        loan.currentPrincipal = Math.max(0, loan.currentPrincipal - principalPortion);
      }

      if (loan.currentPrincipal <= 0.01) {
        loan.isPaidOff = true;
        loan.currentPrincipal = 0;
        if (settings.rolloverRepayments) {
          availableSurplus += loan.minRepayment;
        }
      }
    }

    // Apply surplus to target loan based on strategy
    if (availableSurplus > 0) {
      const targetLoan = selectTargetLoan(simLoans, settings, currentDate);

      if (targetLoan) {
        let extraPayment = availableSurplus;

        // Respect fixed rate caps
        if (settings.respectFixedCaps && targetLoan.rateType === 'FIXED') {
          if (targetLoan.fixedExpiry && currentDate < targetLoan.fixedExpiry) {
            if (targetLoan.extraRepaymentCap !== null) {
              const periodsPerYr = periodsPerYear(targetLoan.repaymentFrequency);
              const maxExtraPerPeriod = targetLoan.extraRepaymentCap / periodsPerYr;
              extraPayment = Math.min(extraPayment, maxExtraPerPeriod);
            }
          }
        }

        // Don't overpay
        extraPayment = Math.min(extraPayment, targetLoan.currentPrincipal);

        targetLoan.currentPrincipal = Math.max(0, targetLoan.currentPrincipal - extraPayment);

        if (targetLoan.currentPrincipal <= 0.01) {
          targetLoan.isPaidOff = true;
          targetLoan.currentPrincipal = 0;
          if (settings.rolloverRepayments) {
            availableSurplus += targetLoan.minRepayment;
          }
        }
      }
    }

    currentDate = addPeriod(currentDate, settings.surplusFrequency);

    if (allPaidOff) {
      debtFreeDate = currentDate;
      break;
    }
  }

  return {
    loans: simLoans.map((l) => ({
      ...l,
      monthsToPayoff: Math.ceil(
        ((debtFreeDate ? debtFreeDate.getTime() : currentDate.getTime()) - new Date().getTime()) /
          (1000 * 60 * 60 * 24 * 30.44)
      ),
      payoffDate: debtFreeDate || currentDate,
    })),
    totalInterestPaid,
    debtFreeDate,
  };
}

/**
 * Select target loan based on strategy
 */
function selectTargetLoan(
  loans: SimulationLoan[],
  settings: PlannerSettings,
  currentDate: Date
): SimulationLoan | null {
  const activeLoans = loans.filter((l) => !l.isPaidOff);

  if (activeLoans.length === 0) return null;

  switch (settings.strategy) {
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

/**
 * Add a period to a date based on frequency
 */
function addPeriod(date: Date, frequency: RepaymentFrequency): Date {
  const newDate = new Date(date);

  switch (frequency) {
    case 'WEEKLY':
      newDate.setDate(newDate.getDate() + 7);
      break;
    case 'FORTNIGHTLY':
      newDate.setDate(newDate.getDate() + 14);
      break;
    case 'MONTHLY':
      newDate.setMonth(newDate.getMonth() + 1);
      break;
  }

  return newDate;
}
