/**
 * CASHFLOW FORECASTING ENGINE (CFE)
 * Phase 14 - Section 14.2.1
 *
 * Predicts future cash balances per account and globally.
 * Consumes Transaction Intelligence Engine (Phase 13) data.
 */

import {
  CFEInput,
  CFEOutput,
  ForecastPoint,
  AccountForecast,
  ShortfallAnalysis,
  RecurringTimelineEntry,
  ForecastSummary,
  RecurringPaymentData,
  IncomeStream,
  LoanSchedule,
  AccountBalance,
  TransactionRecord,
  getNextOccurrence,
  daysBetween,
} from './types';

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_FORECAST_DAYS = 90;
const CONFIDENCE_BASE = 0.95; // Base confidence score
const CONFIDENCE_DECAY_RATE = 0.002; // Confidence decreases per day
const VOLATILITY_WEIGHT = 0.3; // Weight of volatility in confidence

// =============================================================================
// MAIN FORECASTING ENGINE
// =============================================================================

/**
 * Generate cashflow forecast for a user
 */
export async function generateForecast(input: CFEInput): Promise<CFEOutput> {
  const startTime = Date.now();
  const forecastDays = input.config.forecastDays || DEFAULT_FORECAST_DAYS;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate historical spending patterns
  const spendingPatterns = calculateSpendingPatterns(input.transactions);

  // Generate recurring payment timeline
  const recurringTimeline = generateRecurringTimeline(
    input.recurringPayments,
    forecastDays
  );

  // Generate income timeline
  const incomeTimeline = generateIncomeTimeline(input.incomeStreams, forecastDays);

  // Generate loan repayment timeline
  const loanTimeline = generateLoanTimeline(input.loanSchedules, forecastDays);

  // Add planned expenses
  const plannedExpenseTimeline = input.plannedExpenses || [];

  // Generate per-account forecasts
  const accountForecasts: AccountForecast[] = input.accounts.map((account) =>
    generateAccountForecast(
      account,
      recurringTimeline,
      incomeTimeline,
      loanTimeline,
      spendingPatterns,
      forecastDays,
      input.config.includeConfidenceBands
    )
  );

  // Generate global forecast (all accounts combined)
  const globalForecast = generateGlobalForecast(
    accountForecasts,
    input.accounts,
    forecastDays
  );

  // Analyse shortfalls
  const shortfallAnalysis = analyseShortfalls(accountForecasts, globalForecast);

  // Calculate summary metrics
  const summary = calculateSummary(globalForecast, spendingPatterns);

  // Calculate overall volatility
  const volatilityIndex = calculateVolatilityIndex(
    input.transactions,
    spendingPatterns
  );

  return {
    userId: input.userId,
    generatedAt: new Date(),
    globalForecast,
    accountForecasts,
    shortfallAnalysis,
    recurringTimeline,
    volatilityIndex,
    summary,
    metadata: {
      inputTransactionCount: input.transactions.length,
      recurringPaymentCount: input.recurringPayments.length,
      forecastDays,
      calculationTimeMs: Date.now() - startTime,
    },
  };
}

// =============================================================================
// SPENDING PATTERN ANALYSIS
// =============================================================================

interface SpendingPatterns {
  dailyAverage: number;
  weekdayAverages: number[]; // Index 0 = Sunday
  categoryAverages: Map<string, number>;
  volatility: number;
  trend: 'INCREASING' | 'STABLE' | 'DECREASING';
}

function calculateSpendingPatterns(
  transactions: TransactionRecord[]
): SpendingPatterns {
  // Filter to expenses only (OUT direction)
  const expenses = transactions.filter((t) => t.direction === 'OUT');

  if (expenses.length === 0) {
    return {
      dailyAverage: 0,
      weekdayAverages: [0, 0, 0, 0, 0, 0, 0],
      categoryAverages: new Map(),
      volatility: 0,
      trend: 'STABLE',
    };
  }

  // Calculate daily averages per weekday
  const weekdayTotals: number[] = [0, 0, 0, 0, 0, 0, 0];
  const weekdayCounts: number[] = [0, 0, 0, 0, 0, 0, 0];

  // Category totals
  const categoryTotals = new Map<string, number>();
  const categoryCounts = new Map<string, number>();

  // Monthly totals for trend analysis
  const monthlyTotals = new Map<string, number>();

  expenses.forEach((t) => {
    const date = new Date(t.date);
    const dayOfWeek = date.getDay();
    weekdayTotals[dayOfWeek] += Math.abs(t.amount);
    weekdayCounts[dayOfWeek]++;

    // Category analysis
    const category = t.categoryLevel1 || 'UNCATEGORISED';
    categoryTotals.set(
      category,
      (categoryTotals.get(category) || 0) + Math.abs(t.amount)
    );
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);

    // Monthly totals
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) || 0) + Math.abs(t.amount));
  });

  // Calculate weekday averages
  const weekdayAverages = weekdayTotals.map((total, i) =>
    weekdayCounts[i] > 0 ? total / weekdayCounts[i] : 0
  );

  // Calculate category averages (monthly)
  const months = monthlyTotals.size || 1;
  const categoryAverages = new Map<string, number>();
  categoryTotals.forEach((total, category) => {
    categoryAverages.set(category, total / months);
  });

  // Calculate overall daily average
  const totalSpend = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const dateRange = calculateDateRange(expenses);
  const dailyAverage = dateRange > 0 ? totalSpend / dateRange : 0;

  // Calculate volatility (coefficient of variation)
  const dailyAmounts = groupByDate(expenses);
  const volatility = calculateCoeffOfVariation(Array.from(dailyAmounts.values()));

  // Determine trend
  const trend = calculateTrend(monthlyTotals);

  return {
    dailyAverage,
    weekdayAverages,
    categoryAverages,
    volatility,
    trend,
  };
}

function calculateDateRange(transactions: TransactionRecord[]): number {
  if (transactions.length === 0) return 0;
  const dates = transactions.map((t) => new Date(t.date).getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  return Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) || 1;
}

function groupByDate(transactions: TransactionRecord[]): Map<string, number> {
  const grouped = new Map<string, number>();
  transactions.forEach((t) => {
    const dateKey = new Date(t.date).toISOString().split('T')[0];
    grouped.set(dateKey, (grouped.get(dateKey) || 0) + Math.abs(t.amount));
  });
  return grouped;
}

function calculateCoeffOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  return stdDev / mean;
}

function calculateTrend(
  monthlyTotals: Map<string, number>
): 'INCREASING' | 'STABLE' | 'DECREASING' {
  const sortedMonths = Array.from(monthlyTotals.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, value]) => value);

  if (sortedMonths.length < 3) return 'STABLE';

  // Compare last 3 months trend
  const recent = sortedMonths.slice(-3);
  const avgChange =
    (recent[2] - recent[0]) / recent[0] || 0;

  if (avgChange > 0.1) return 'INCREASING';
  if (avgChange < -0.1) return 'DECREASING';
  return 'STABLE';
}

// =============================================================================
// TIMELINE GENERATORS
// =============================================================================

function generateRecurringTimeline(
  recurringPayments: RecurringPaymentData[],
  forecastDays: number
): RecurringTimelineEntry[] {
  const timeline: RecurringTimelineEntry[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + forecastDays);

  recurringPayments
    .filter((rp) => rp.isActive)
    .forEach((rp) => {
      let nextDate = rp.nextExpected
        ? new Date(rp.nextExpected)
        : getNextOccurrence(new Date(rp.lastOccurrence), rp.pattern);

      while (nextDate <= endDate) {
        if (nextDate >= today) {
          timeline.push({
            date: new Date(nextDate),
            merchantStandardised: rp.merchantStandardised,
            expectedAmount: rp.expectedAmount,
            accountId: rp.accountId,
          });
        }
        nextDate = getNextOccurrence(nextDate, rp.pattern);
      }
    });

  return timeline.sort((a, b) => a.date.getTime() - b.date.getTime());
}

interface IncomeTimelineEntry {
  date: Date;
  amount: number;
  name: string;
}

function generateIncomeTimeline(
  incomeStreams: IncomeStream[],
  forecastDays: number
): IncomeTimelineEntry[] {
  const timeline: IncomeTimelineEntry[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + forecastDays);

  incomeStreams.forEach((income) => {
    const frequencyToDays: Record<string, number> = {
      WEEKLY: 7,
      FORTNIGHTLY: 14,
      MONTHLY: 30,
      ANNUAL: 365,
    };

    const intervalDays = frequencyToDays[income.frequency] || 30;
    let nextDate = income.nextExpected ? new Date(income.nextExpected) : new Date(today);
    nextDate.setDate(nextDate.getDate() + intervalDays);

    // Convert to monthly if not already
    const monthlyAmount =
      income.frequency === 'WEEKLY'
        ? income.monthlyAmount * 4.33
        : income.frequency === 'FORTNIGHTLY'
          ? income.monthlyAmount * 2.17
          : income.frequency === 'ANNUAL'
            ? income.monthlyAmount / 12
            : income.monthlyAmount;

    const perOccurrence = monthlyAmount / (30 / intervalDays);

    while (nextDate <= endDate) {
      if (nextDate >= today) {
        timeline.push({
          date: new Date(nextDate),
          amount: perOccurrence,
          name: income.name,
        });
      }
      nextDate.setDate(nextDate.getDate() + intervalDays);
    }
  });

  return timeline.sort((a, b) => a.date.getTime() - b.date.getTime());
}

interface LoanTimelineEntry {
  date: Date;
  amount: number;
  loanId: string;
  loanName: string;
}

function generateLoanTimeline(
  loanSchedules: LoanSchedule[],
  forecastDays: number
): LoanTimelineEntry[] {
  const timeline: LoanTimelineEntry[] = [];
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + forecastDays);

  loanSchedules.forEach((loan) => {
    // Generate monthly repayment entries
    let nextDate = new Date(today);
    nextDate.setDate(loan.repaymentDate);
    if (nextDate < today) {
      nextDate.setMonth(nextDate.getMonth() + 1);
    }

    while (nextDate <= endDate) {
      timeline.push({
        date: new Date(nextDate),
        amount: loan.monthlyRepayment,
        loanId: loan.loanId,
        loanName: loan.loanName,
      });
      nextDate.setMonth(nextDate.getMonth() + 1);
    }
  });

  return timeline.sort((a, b) => a.date.getTime() - b.date.getTime());
}

// =============================================================================
// ACCOUNT FORECAST GENERATION
// =============================================================================

function generateAccountForecast(
  account: AccountBalance,
  recurringTimeline: RecurringTimelineEntry[],
  incomeTimeline: IncomeTimelineEntry[],
  loanTimeline: LoanTimelineEntry[],
  spendingPatterns: SpendingPatterns,
  forecastDays: number,
  includeConfidenceBands: boolean
): AccountForecast {
  const forecasts: ForecastPoint[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let runningBalance = account.currentBalance;
  let minBalance = runningBalance;
  let maxBalance = runningBalance;
  const shortfallDays: Date[] = [];

  // Filter timelines for this account
  const accountRecurring = recurringTimeline.filter(
    (r) => r.accountId === account.accountId
  );

  for (let day = 0; day < forecastDays; day++) {
    const forecastDate = new Date(today);
    forecastDate.setDate(forecastDate.getDate() + day);
    const dayOfWeek = forecastDate.getDay();
    const dateStr = forecastDate.toISOString().split('T')[0];

    // Calculate predicted income for this day
    const dayIncome = incomeTimeline
      .filter((i) => i.date.toISOString().split('T')[0] === dateStr)
      .reduce((sum, i) => sum + i.amount, 0);

    // Calculate recurring payments for this day
    const dayRecurring = accountRecurring
      .filter((r) => r.date.toISOString().split('T')[0] === dateStr)
      .reduce((sum, r) => sum + r.expectedAmount, 0);

    // Calculate loan repayments for this day
    const dayLoan = loanTimeline
      .filter((l) => l.date.toISOString().split('T')[0] === dateStr)
      .reduce((sum, l) => sum + l.amount, 0);

    // Estimate non-recurring expenses based on patterns
    const dayNonRecurring = spendingPatterns.weekdayAverages[dayOfWeek] || 0;

    // Total predicted expenses
    const dayExpenses = dayRecurring + dayLoan + dayNonRecurring;

    // Update running balance
    runningBalance = runningBalance + dayIncome - dayExpenses;

    // Track min/max
    minBalance = Math.min(minBalance, runningBalance);
    maxBalance = Math.max(maxBalance, runningBalance);

    // Check for shortfall
    const isShortfall = runningBalance < 0;
    if (isShortfall) {
      shortfallDays.push(forecastDate);
    }

    // Calculate confidence (decreases with time and volatility)
    const dayConfidence = calculateDayConfidence(
      day,
      spendingPatterns.volatility
    );

    // Calculate confidence bands
    const volatilityAdjustment =
      spendingPatterns.dailyAverage * spendingPatterns.volatility * Math.sqrt(day + 1);

    const forecast: ForecastPoint = {
      date: forecastDate,
      predictedBalance: runningBalance,
      predictedIncome: dayIncome,
      predictedExpenses: dayExpenses,
      predictedRecurring: dayRecurring + dayLoan,
      predictedNonRecurring: dayNonRecurring,
      confidenceScore: dayConfidence,
      volatilityFactor: spendingPatterns.volatility,
      shortfallRisk: isShortfall,
      shortfallAmount: isShortfall ? Math.abs(runningBalance) : undefined,
    };

    if (includeConfidenceBands) {
      forecast.upperBound = runningBalance + volatilityAdjustment;
      forecast.lowerBound = runningBalance - volatilityAdjustment;
    }

    forecasts.push(forecast);
  }

  return {
    accountId: account.accountId,
    accountName: account.accountName,
    accountType: account.accountType,
    forecasts,
    averageBalance:
      forecasts.reduce((sum, f) => sum + f.predictedBalance, 0) / forecasts.length,
    minBalance,
    maxBalance,
    shortfallDays,
  };
}

function calculateDayConfidence(day: number, volatility: number): number {
  const timeDecay = Math.exp(-CONFIDENCE_DECAY_RATE * day);
  const volatilityPenalty = 1 - volatility * VOLATILITY_WEIGHT;
  return Math.max(0.1, CONFIDENCE_BASE * timeDecay * volatilityPenalty);
}

// =============================================================================
// GLOBAL FORECAST GENERATION
// =============================================================================

function generateGlobalForecast(
  accountForecasts: AccountForecast[],
  accounts: AccountBalance[],
  forecastDays: number
): ForecastPoint[] {
  const globalForecasts: ForecastPoint[] = [];

  for (let day = 0; day < forecastDays; day++) {
    let totalBalance = 0;
    let totalIncome = 0;
    let totalExpenses = 0;
    let totalRecurring = 0;
    let totalNonRecurring = 0;
    let minConfidence = 1;
    let maxVolatility = 0;
    let hasShortfall = false;
    let shortfallTotal = 0;
    let upperBoundTotal = 0;
    let lowerBoundTotal = 0;

    accountForecasts.forEach((af) => {
      const dayForecast = af.forecasts[day];
      if (dayForecast) {
        totalBalance += dayForecast.predictedBalance;
        totalIncome += dayForecast.predictedIncome;
        totalExpenses += dayForecast.predictedExpenses;
        totalRecurring += dayForecast.predictedRecurring;
        totalNonRecurring += dayForecast.predictedNonRecurring;
        minConfidence = Math.min(minConfidence, dayForecast.confidenceScore);
        maxVolatility = Math.max(maxVolatility, dayForecast.volatilityFactor);

        if (dayForecast.shortfallRisk) {
          hasShortfall = true;
          shortfallTotal += dayForecast.shortfallAmount || 0;
        }

        if (dayForecast.upperBound !== undefined) {
          upperBoundTotal += dayForecast.upperBound;
        }
        if (dayForecast.lowerBound !== undefined) {
          lowerBoundTotal += dayForecast.lowerBound;
        }
      }
    });

    const firstForecast = accountForecasts[0]?.forecasts[day];

    globalForecasts.push({
      date: firstForecast?.date || new Date(),
      predictedBalance: totalBalance,
      predictedIncome: totalIncome,
      predictedExpenses: totalExpenses,
      predictedRecurring: totalRecurring,
      predictedNonRecurring: totalNonRecurring,
      confidenceScore: minConfidence,
      volatilityFactor: maxVolatility,
      shortfallRisk: hasShortfall,
      shortfallAmount: hasShortfall ? shortfallTotal : undefined,
      upperBound: upperBoundTotal > 0 ? upperBoundTotal : undefined,
      lowerBound: lowerBoundTotal > 0 ? lowerBoundTotal : undefined,
    });
  }

  return globalForecasts;
}

// =============================================================================
// SHORTFALL ANALYSIS
// =============================================================================

function analyseShortfalls(
  accountForecasts: AccountForecast[],
  globalForecast: ForecastPoint[]
): ShortfallAnalysis {
  const shortfallDates: Date[] = [];
  let maxShortfallAmount = 0;
  const accountsAtRisk = new Set<string>();

  globalForecast.forEach((day) => {
    if (day.shortfallRisk) {
      shortfallDates.push(day.date);
      maxShortfallAmount = Math.max(
        maxShortfallAmount,
        day.shortfallAmount || 0
      );
    }
  });

  accountForecasts.forEach((af) => {
    if (af.shortfallDays.length > 0) {
      accountsAtRisk.add(af.accountId);
    }
  });

  return {
    hasShortfall: shortfallDates.length > 0,
    shortfallDates,
    maxShortfallAmount,
    totalShortfallDays: shortfallDates.length,
    firstShortfallDate: shortfallDates[0],
    accountsAtRisk: Array.from(accountsAtRisk),
  };
}

// =============================================================================
// SUMMARY CALCULATION
// =============================================================================

function calculateSummary(
  globalForecast: ForecastPoint[],
  spendingPatterns: SpendingPatterns
): ForecastSummary {
  const first30 = globalForecast.slice(0, 30);
  const first90 = globalForecast.slice(0, 90);

  const avgDaily30 =
    first30.reduce((sum, f) => sum + f.predictedBalance, 0) / first30.length || 0;
  const totalIncome30 = first30.reduce((sum, f) => sum + f.predictedIncome, 0);
  const totalExpenses30 = first30.reduce(
    (sum, f) => sum + f.predictedExpenses,
    0
  );

  const avgDaily90 =
    first90.reduce((sum, f) => sum + f.predictedBalance, 0) / first90.length || 0;
  const totalIncome90 = first90.reduce((sum, f) => sum + f.predictedIncome, 0);
  const totalExpenses90 = first90.reduce(
    (sum, f) => sum + f.predictedExpenses,
    0
  );

  const monthlyBurnRate = spendingPatterns.dailyAverage * 30;
  const threeMonthBurnRate = monthlyBurnRate * 3;

  // Withdrawable cash = current balance - 3 months expenses
  const currentBalance = globalForecast[0]?.predictedBalance || 0;
  const withdrawableCash = Math.max(0, currentBalance - threeMonthBurnRate);

  return {
    avgDailyBalance30: avgDaily30,
    totalIncome30,
    totalExpenses30,
    netCashflow30: totalIncome30 - totalExpenses30,
    avgDailyBalance90: avgDaily90,
    totalIncome90,
    totalExpenses90,
    netCashflow90: totalIncome90 - totalExpenses90,
    monthlyBurnRate,
    threeMonthBurnRate,
    withdrawableCash,
    withdrawableDate: new Date(),
  };
}

function calculateVolatilityIndex(
  transactions: TransactionRecord[],
  patterns: SpendingPatterns
): number {
  // Volatility index is based on coefficient of variation
  // Scale from 0 to 100
  return Math.min(100, patterns.volatility * 100);
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Quick forecast check for dashboard
 */
export function getQuickForecast(
  currentBalance: number,
  monthlyIncome: number,
  monthlyExpenses: number,
  days: number = 30
): { endBalance: number; hasShortfall: boolean } {
  const dailyNet = (monthlyIncome - monthlyExpenses) / 30;
  const endBalance = currentBalance + dailyNet * days;
  return {
    endBalance,
    hasShortfall: endBalance < 0,
  };
}

/**
 * Calculate days until shortfall
 */
export function daysUntilShortfall(
  currentBalance: number,
  dailyBurnRate: number
): number | null {
  if (dailyBurnRate <= 0) return null;
  if (currentBalance <= 0) return 0;
  return Math.floor(currentBalance / dailyBurnRate);
}
