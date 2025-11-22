/**
 * Monitrax Investment Performance Engine
 * Phase 4 - Performance Metrics Calculations
 *
 * Pure functions for calculating investment performance metrics.
 * No database calls - all inputs are passed as parameters.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface CashFlow {
  date: Date;
  amount: number; // positive = inflow, negative = outflow
}

export interface PortfolioSnapshot {
  date: Date;
  value: number;
}

export interface PerformanceMetrics {
  totalReturn: number;
  totalReturnPercent: number;
  cagr: number;
  irr: number;
  twr: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

export interface PeriodReturn {
  startDate: Date;
  endDate: Date;
  startValue: number;
  endValue: number;
  cashFlows: CashFlow[];
  periodReturn: number;
}

// =============================================================================
// COMPOUND ANNUAL GROWTH RATE (CAGR)
// =============================================================================

/**
 * Calculate Compound Annual Growth Rate.
 * CAGR = (Ending Value / Beginning Value)^(1/years) - 1
 *
 * @param beginningValue - Initial investment value
 * @param endingValue - Final investment value
 * @param years - Number of years (can be fractional)
 * @returns CAGR as decimal (e.g., 0.08 for 8%)
 */
export function calculateCAGR(
  beginningValue: number,
  endingValue: number,
  years: number
): number {
  if (beginningValue <= 0 || years <= 0) return 0;
  if (endingValue <= 0) return -1; // Total loss

  return Math.pow(endingValue / beginningValue, 1 / years) - 1;
}

/**
 * Calculate CAGR from dates.
 *
 * @param beginningValue - Initial investment value
 * @param endingValue - Final investment value
 * @param startDate - Start date
 * @param endDate - End date
 * @returns CAGR as decimal
 */
export function calculateCAGRFromDates(
  beginningValue: number,
  endingValue: number,
  startDate: Date,
  endDate: Date
): number {
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  const years = (endDate.getTime() - startDate.getTime()) / msPerYear;
  return calculateCAGR(beginningValue, endingValue, years);
}

// =============================================================================
// INTERNAL RATE OF RETURN (IRR)
// =============================================================================

/**
 * Calculate Internal Rate of Return using Newton-Raphson method.
 * IRR is the discount rate that makes NPV of all cash flows equal to zero.
 *
 * @param cashFlows - Array of cash flows with dates and amounts
 * @param finalValue - Final portfolio value (treated as positive cash flow at end)
 * @param tolerance - Convergence tolerance (default 0.0001)
 * @param maxIterations - Maximum iterations (default 100)
 * @returns IRR as decimal (annualized)
 */
export function calculateIRR(
  cashFlows: CashFlow[],
  finalValue: number,
  tolerance: number = 0.0001,
  maxIterations: number = 100
): number {
  if (cashFlows.length === 0) return 0;

  // Sort cash flows by date
  const sortedFlows = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const startDate = sortedFlows[0].date;

  // Add final value as a positive cash flow
  const allFlows = [
    ...sortedFlows,
    { date: new Date(), amount: finalValue }
  ];

  // Convert to years from start
  const flowsWithYears = allFlows.map(cf => ({
    years: (cf.date.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
    amount: cf.amount
  }));

  // Newton-Raphson iteration
  let rate = 0.1; // Initial guess 10%

  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let npvDerivative = 0;

    for (const flow of flowsWithYears) {
      const discountFactor = Math.pow(1 + rate, -flow.years);
      npv += flow.amount * discountFactor;
      npvDerivative -= flow.years * flow.amount * Math.pow(1 + rate, -flow.years - 1);
    }

    if (Math.abs(npv) < tolerance) {
      return rate;
    }

    if (npvDerivative === 0) {
      break; // Avoid division by zero
    }

    rate = rate - npv / npvDerivative;

    // Bound the rate to reasonable values
    if (rate < -0.99) rate = -0.99;
    if (rate > 10) rate = 10;
  }

  return rate;
}

// =============================================================================
// TIME-WEIGHTED RETURN (TWR)
// =============================================================================

/**
 * Calculate Time-Weighted Return.
 * TWR eliminates the impact of cash flows to measure pure investment performance.
 *
 * @param periodReturns - Array of sub-period returns
 * @returns TWR as decimal
 */
export function calculateTWR(periodReturns: PeriodReturn[]): number {
  if (periodReturns.length === 0) return 0;

  // TWR = Product of (1 + sub-period return) - 1
  let twr = 1;

  for (const period of periodReturns) {
    twr *= (1 + period.periodReturn);
  }

  return twr - 1;
}

/**
 * Calculate sub-period return for TWR.
 *
 * @param startValue - Value at start of period
 * @param endValue - Value at end of period (before any end-of-period cash flow)
 * @param cashFlowDuringPeriod - Cash flow during period (positive = contribution)
 * @returns Sub-period return as decimal
 */
export function calculateSubPeriodReturn(
  startValue: number,
  endValue: number,
  cashFlowDuringPeriod: number = 0
): number {
  if (startValue + cashFlowDuringPeriod === 0) return 0;
  return (endValue - startValue - cashFlowDuringPeriod) / (startValue + cashFlowDuringPeriod);
}

/**
 * Calculate annualized TWR.
 *
 * @param twr - Total time-weighted return
 * @param years - Number of years
 * @returns Annualized TWR
 */
export function annualizeTWR(twr: number, years: number): number {
  if (years <= 0) return 0;
  return Math.pow(1 + twr, 1 / years) - 1;
}

// =============================================================================
// VOLATILITY
// =============================================================================

/**
 * Calculate annualized volatility (standard deviation of returns).
 *
 * @param returns - Array of periodic returns (e.g., monthly returns)
 * @param periodsPerYear - Number of periods per year (12 for monthly, 252 for daily)
 * @returns Annualized volatility as decimal
 */
export function calculateVolatility(
  returns: number[],
  periodsPerYear: number = 12
): number {
  if (returns.length < 2) return 0;

  // Calculate mean return
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;

  // Calculate variance
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);

  // Standard deviation
  const stdDev = Math.sqrt(variance);

  // Annualize
  return stdDev * Math.sqrt(periodsPerYear);
}

/**
 * Calculate periodic returns from portfolio snapshots.
 *
 * @param snapshots - Array of portfolio snapshots sorted by date
 * @returns Array of periodic returns
 */
export function calculatePeriodicReturns(snapshots: PortfolioSnapshot[]): number[] {
  if (snapshots.length < 2) return [];

  const returns: number[] = [];
  for (let i = 1; i < snapshots.length; i++) {
    const prevValue = snapshots[i - 1].value;
    const currValue = snapshots[i].value;
    if (prevValue > 0) {
      returns.push((currValue - prevValue) / prevValue);
    }
  }

  return returns;
}

// =============================================================================
// SHARPE RATIO
// =============================================================================

/**
 * Calculate Sharpe Ratio.
 * Measures risk-adjusted return relative to risk-free rate.
 *
 * @param portfolioReturn - Annualized portfolio return
 * @param riskFreeRate - Annualized risk-free rate (e.g., 0.04 for 4%)
 * @param volatility - Annualized volatility
 * @returns Sharpe ratio
 */
export function calculateSharpeRatio(
  portfolioReturn: number,
  riskFreeRate: number,
  volatility: number
): number {
  if (volatility === 0) return 0;
  return (portfolioReturn - riskFreeRate) / volatility;
}

// =============================================================================
// MAXIMUM DRAWDOWN
// =============================================================================

/**
 * Calculate maximum drawdown.
 * The largest peak-to-trough decline in portfolio value.
 *
 * @param values - Array of portfolio values over time
 * @returns Maximum drawdown as positive decimal (e.g., 0.20 for 20% drawdown)
 */
export function calculateMaxDrawdown(values: number[]): number {
  if (values.length < 2) return 0;

  let maxDrawdown = 0;
  let peak = values[0];

  for (const value of values) {
    if (value > peak) {
      peak = value;
    }

    const drawdown = (peak - value) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
}

// =============================================================================
// COMPREHENSIVE PERFORMANCE CALCULATION
// =============================================================================

/**
 * Calculate comprehensive performance metrics for a portfolio.
 *
 * @param snapshots - Array of portfolio snapshots
 * @param cashFlows - Array of cash flows (contributions/withdrawals)
 * @param riskFreeRate - Annual risk-free rate for Sharpe calculation
 * @returns Complete performance metrics
 */
export function calculatePerformanceMetrics(
  snapshots: PortfolioSnapshot[],
  cashFlows: CashFlow[],
  riskFreeRate: number = 0.04
): PerformanceMetrics {
  if (snapshots.length < 2) {
    return {
      totalReturn: 0,
      totalReturnPercent: 0,
      cagr: 0,
      irr: 0,
      twr: 0,
      volatility: 0,
      sharpeRatio: 0,
      maxDrawdown: 0
    };
  }

  const sortedSnapshots = [...snapshots].sort((a, b) => a.date.getTime() - b.date.getTime());
  const firstSnapshot = sortedSnapshots[0];
  const lastSnapshot = sortedSnapshots[sortedSnapshots.length - 1];

  // Total cash contributed
  const totalContributed = cashFlows
    .filter(cf => cf.amount < 0) // Negative = money invested
    .reduce((sum, cf) => sum + Math.abs(cf.amount), 0);

  // Total return
  const totalReturn = lastSnapshot.value - firstSnapshot.value;
  const totalReturnPercent = firstSnapshot.value > 0 ? totalReturn / firstSnapshot.value : 0;

  // CAGR
  const cagr = calculateCAGRFromDates(
    firstSnapshot.value,
    lastSnapshot.value,
    firstSnapshot.date,
    lastSnapshot.date
  );

  // IRR
  const irr = calculateIRR(cashFlows, lastSnapshot.value);

  // Periodic returns for TWR and volatility
  const periodicReturns = calculatePeriodicReturns(sortedSnapshots);

  // TWR
  const twr = periodicReturns.reduce((acc, r) => acc * (1 + r), 1) - 1;

  // Volatility
  const volatility = calculateVolatility(periodicReturns, 12);

  // Sharpe Ratio
  const sharpeRatio = calculateSharpeRatio(cagr, riskFreeRate, volatility);

  // Max Drawdown
  const values = sortedSnapshots.map(s => s.value);
  const maxDrawdown = calculateMaxDrawdown(values);

  return {
    totalReturn,
    totalReturnPercent,
    cagr,
    irr,
    twr,
    volatility,
    sharpeRatio,
    maxDrawdown
  };
}
