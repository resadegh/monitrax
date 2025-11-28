/**
 * CASHFLOW OPTIMISATION ENGINE (COE)
 * Phase 14 - Section 14.2.2
 *
 * Recommends actions to increase surplus and reduce financial strain.
 * Detects inefficiencies, optimises payment schedules, and suggests fund movements.
 */

import {
  COEInput,
  COEOutput,
  COESummary,
  SpendingInefficiency,
  SubscriptionAnalysis,
  FundMovementRecommendation,
  PaymentScheduleOptimisation,
  RepaymentOptimisation,
  CashflowStrategy,
  CashflowInsightCategory,
  CashflowStrategyType,
  RecurringPaymentData,
  LoanData,
  OffsetAccountData,
  TrendDirection,
  StrategyStep,
  severityToPriority,
  valueToSeverity,
} from './types';

// =============================================================================
// CONSTANTS
// =============================================================================

const SUBSCRIPTION_PRICE_INCREASE_THRESHOLD = 0.05; // 5%
const INEFFICIENCY_THRESHOLD = 1.5; // 150% of benchmark
const MIN_SAVINGS_TO_REPORT = 20; // Minimum $20 savings to report
const OFFSET_BENEFIT_THRESHOLD = 100; // Minimum $100 annual benefit

// Category benchmarks (average monthly spend for Australian households)
const CATEGORY_BENCHMARKS: Record<string, number> = {
  'Food & Dining': 800,
  Groceries: 600,
  'Dining Out': 200,
  Subscriptions: 100,
  Entertainment: 150,
  Utilities: 350,
  Transport: 400,
  Insurance: 300,
  Shopping: 250,
  Health: 150,
};

// =============================================================================
// MAIN OPTIMISATION ENGINE
// =============================================================================

/**
 * Generate cashflow optimisation recommendations
 */
export async function generateOptimisations(input: COEInput): Promise<COEOutput> {
  const startTime = Date.now();

  // Detect spending inefficiencies
  const inefficiencies = detectInefficiencies(
    input.spendingProfile,
    input.recurringPayments
  );

  // Analyse subscriptions
  const { subscriptions, priceIncreases } = analyseSubscriptions(
    input.recurringPayments
  );

  // Generate fund movement recommendations
  const fundMovements = generateFundMovements(
    input.forecast,
    input.offsetAccounts,
    input.loans
  );

  // Optimise payment schedules
  const scheduleOptimisations = optimisePaymentSchedules(
    input.recurringPayments,
    input.forecast
  );

  // Generate loan repayment optimisations
  const repaymentOptimisations = optimiseLoanRepayments(
    input.loans,
    input.offsetAccounts,
    input.forecast
  );

  // Calculate break-even day
  const breakEvenDay = calculateBreakEvenDay(input.forecast);

  // Generate strategies from all optimisations
  const strategies = generateStrategies(
    inefficiencies,
    subscriptions,
    fundMovements,
    scheduleOptimisations,
    repaymentOptimisations
  );

  // Calculate summary
  const summary = calculateSummary(
    inefficiencies,
    subscriptions,
    priceIncreases,
    strategies
  );

  return {
    userId: input.userId,
    generatedAt: new Date(),
    inefficiencies,
    subscriptions,
    subscriptionsWithPriceIncrease: priceIncreases,
    fundMovements,
    scheduleOptimisations,
    repaymentOptimisations,
    breakEvenDay,
    strategies,
    summary,
  };
}

// =============================================================================
// INEFFICIENCY DETECTION
// =============================================================================

function detectInefficiencies(
  spendingProfile: COEInput['spendingProfile'],
  recurringPayments: RecurringPaymentData[]
): SpendingInefficiency[] {
  const inefficiencies: SpendingInefficiency[] = [];

  // Check category spending against benchmarks
  Object.entries(spendingProfile.categoryAverages).forEach(
    ([category, data]) => {
      const benchmark = CATEGORY_BENCHMARKS[category];
      if (benchmark && data.avgMonthly > benchmark * INEFFICIENCY_THRESHOLD) {
        const potentialSavings = data.avgMonthly - benchmark;
        if (potentialSavings >= MIN_SAVINGS_TO_REPORT) {
          inefficiencies.push({
            id: `ineff-${category.toLowerCase().replace(/\s+/g, '-')}`,
            category: 'INEFFICIENCY',
            merchantOrCategory: category,
            description: `Spending in ${category} is ${Math.round((data.avgMonthly / benchmark) * 100 - 100)}% above average`,
            currentSpend: data.avgMonthly,
            benchmarkSpend: benchmark,
            potentialSavings,
            confidenceScore: 0.8,
            evidence: {
              averageMonthlySpend: data.avgMonthly,
              trendDirection: data.trend,
              comparableBenchmark: benchmark,
            },
          });
        }
      }
    }
  );

  // Detect wasteful recurring payments
  recurringPayments
    .filter((rp) => rp.isActive)
    .forEach((rp) => {
      // Flag subscriptions with low usage indicators (placeholder logic)
      // In production, this would integrate with usage data
      if (rp.expectedAmount > 50 && rp.pattern === 'MONTHLY') {
        // Flag expensive monthly subscriptions for review
        const category = detectSubscriptionCategory(rp.merchantStandardised);
        if (category === 'Entertainment' || category === 'Subscriptions') {
          inefficiencies.push({
            id: `ineff-${rp.id}`,
            category: 'SUBSCRIPTION',
            merchantOrCategory: rp.merchantStandardised,
            description: `${rp.merchantStandardised} costs $${rp.expectedAmount}/month - consider if still providing value`,
            currentSpend: rp.expectedAmount * 12,
            potentialSavings: rp.expectedAmount * 12,
            confidenceScore: 0.5, // Lower confidence as we don't know usage
            evidence: {
              averageMonthlySpend: rp.expectedAmount,
              trendDirection: 'STABLE',
            },
          });
        }
      }
    });

  // Detect duplicate or overlapping services
  const duplicates = detectDuplicateServices(recurringPayments);
  inefficiencies.push(...duplicates);

  // Sort by potential savings
  return inefficiencies.sort((a, b) => b.potentialSavings - a.potentialSavings);
}

function detectSubscriptionCategory(merchantName: string): string {
  const lowered = merchantName.toLowerCase();

  if (
    lowered.includes('netflix') ||
    lowered.includes('spotify') ||
    lowered.includes('disney') ||
    lowered.includes('stan') ||
    lowered.includes('youtube')
  ) {
    return 'Entertainment';
  }

  if (
    lowered.includes('gym') ||
    lowered.includes('fitness') ||
    lowered.includes('anytime')
  ) {
    return 'Health';
  }

  return 'Subscriptions';
}

function detectDuplicateServices(
  recurringPayments: RecurringPaymentData[]
): SpendingInefficiency[] {
  const duplicates: SpendingInefficiency[] = [];

  // Group by service type
  const streamingServices = recurringPayments.filter((rp) => {
    const lowered = rp.merchantStandardised.toLowerCase();
    return (
      lowered.includes('netflix') ||
      lowered.includes('disney') ||
      lowered.includes('stan') ||
      lowered.includes('binge') ||
      lowered.includes('paramount') ||
      lowered.includes('prime video')
    );
  });

  if (streamingServices.length > 2) {
    const totalCost = streamingServices.reduce(
      (sum, s) => sum + s.expectedAmount * 12,
      0
    );
    duplicates.push({
      id: 'ineff-streaming-overlap',
      category: 'INEFFICIENCY',
      merchantOrCategory: 'Streaming Services',
      description: `You have ${streamingServices.length} streaming services. Consider consolidating.`,
      currentSpend: totalCost,
      potentialSavings: (streamingServices.length - 2) * 15 * 12, // Assume $15/month average
      confidenceScore: 0.7,
      evidence: {
        averageMonthlySpend: totalCost / 12,
        trendDirection: 'STABLE',
      },
    });
  }

  return duplicates;
}

// =============================================================================
// SUBSCRIPTION ANALYSIS
// =============================================================================

function analyseSubscriptions(
  recurringPayments: RecurringPaymentData[]
): { subscriptions: SubscriptionAnalysis[]; priceIncreases: SubscriptionAnalysis[] } {
  const subscriptions: SubscriptionAnalysis[] = [];
  const priceIncreases: SubscriptionAnalysis[] = [];

  recurringPayments
    .filter((rp) => rp.isActive && rp.pattern === 'MONTHLY')
    .forEach((rp) => {
      const hasPriceIncrease =
        rp.priceIncreaseAlert &&
        rp.lastPriceChange &&
        Math.abs(rp.lastPriceChange / rp.expectedAmount) >
          SUBSCRIPTION_PRICE_INCREASE_THRESHOLD;

      const analysis: SubscriptionAnalysis = {
        merchantStandardised: rp.merchantStandardised,
        currentAmount: rp.expectedAmount,
        previousAmount: rp.lastPriceChange
          ? rp.expectedAmount - rp.lastPriceChange
          : undefined,
        priceChangePercent: rp.lastPriceChange
          ? (rp.lastPriceChange / (rp.expectedAmount - rp.lastPriceChange)) * 100
          : undefined,
        hasPriceIncrease,
        firstSeen: new Date(rp.lastOccurrence),
        monthlyImpact: rp.expectedAmount,
        yearlyImpact: rp.expectedAmount * 12,
        category: detectSubscriptionCategory(rp.merchantStandardised),
      };

      subscriptions.push(analysis);

      if (hasPriceIncrease) {
        priceIncreases.push(analysis);
      }
    });

  return {
    subscriptions: subscriptions.sort((a, b) => b.yearlyImpact - a.yearlyImpact),
    priceIncreases,
  };
}

// =============================================================================
// FUND MOVEMENT RECOMMENDATIONS
// =============================================================================

function generateFundMovements(
  forecast: COEInput['forecast'],
  offsetAccounts: OffsetAccountData[],
  loans: LoanData[]
): FundMovementRecommendation[] {
  const recommendations: FundMovementRecommendation[] = [];

  // Analyse offset account optimisation
  offsetAccounts.forEach((offset) => {
    const linkedLoan = loans.find((l) => l.id === offset.linkedLoanId);
    if (!linkedLoan) return;

    // Check if there are other accounts with excess funds
    forecast.accountForecasts.forEach((af) => {
      if (af.accountId === offset.id) return;

      const excessFunds = af.averageBalance - 5000; // Keep $5k buffer
      if (excessFunds > 1000) {
        // Calculate annual benefit
        const annualBenefit = excessFunds * linkedLoan.interestRate;
        if (annualBenefit >= OFFSET_BENEFIT_THRESHOLD) {
          recommendations.push({
            fromAccountId: af.accountId,
            fromAccountName: af.accountName,
            toAccountId: offset.id,
            toAccountName: offset.name,
            amount: excessFunds,
            reason: `Moving funds to offset account saves $${Math.round(annualBenefit)}/year in interest`,
            projectedBenefit: annualBenefit,
            urgency: annualBenefit > 500 ? 'HIGH' : 'MEDIUM',
          });
        }
      }
    });
  });

  // Check for shortfall prevention
  if (forecast.shortfallAnalysis.hasShortfall) {
    const shortfallAmount = forecast.shortfallAnalysis.maxShortfallAmount;
    const accountsWithExcess = forecast.accountForecasts.filter(
      (af) =>
        af.averageBalance > shortfallAmount * 1.5 &&
        !forecast.shortfallAnalysis.accountsAtRisk.includes(af.accountId)
    );

    const accountAtRisk = forecast.accountForecasts.find((af) =>
      forecast.shortfallAnalysis.accountsAtRisk.includes(af.accountId)
    );

    if (accountsWithExcess.length > 0 && accountAtRisk) {
      recommendations.push({
        fromAccountId: accountsWithExcess[0].accountId,
        fromAccountName: accountsWithExcess[0].accountName,
        toAccountId: accountAtRisk.accountId,
        toAccountName: accountAtRisk.accountName,
        amount: shortfallAmount * 1.2, // 20% buffer
        reason: `Prevent predicted shortfall of $${Math.round(shortfallAmount)} in ${accountAtRisk.accountName}`,
        projectedBenefit: shortfallAmount, // Avoid overdraft fees
        urgency: 'HIGH',
      });
    }
  }

  return recommendations.sort((a, b) => b.projectedBenefit - a.projectedBenefit);
}

// =============================================================================
// PAYMENT SCHEDULE OPTIMISATION
// =============================================================================

function optimisePaymentSchedules(
  recurringPayments: RecurringPaymentData[],
  forecast: COEInput['forecast']
): PaymentScheduleOptimisation[] {
  const optimisations: PaymentScheduleOptimisation[] = [];

  // Identify income dates from forecast
  const incomedays = new Set<number>();
  forecast.globalForecast.forEach((day) => {
    if (day.predictedIncome > 0) {
      incomedays.add(new Date(day.date).getDate());
    }
  });

  // Find primary income day (most common)
  const primaryIncomeDay = Array.from(incomedays)[0] || 15;

  // Group expenses by timing
  const earlyMonthExpenses: RecurringPaymentData[] = [];
  const lateMonthExpenses: RecurringPaymentData[] = [];

  recurringPayments.forEach((rp) => {
    const dayOfMonth = new Date(rp.lastOccurrence).getDate();
    if (dayOfMonth <= 15) {
      earlyMonthExpenses.push(rp);
    } else {
      lateMonthExpenses.push(rp);
    }
  });

  // If income is late in month but expenses are early, suggest rescheduling
  if (primaryIncomeDay > 15 && earlyMonthExpenses.length > 3) {
    const totalEarlyExpenses = earlyMonthExpenses.reduce(
      (sum, e) => sum + e.expectedAmount,
      0
    );

    optimisations.push({
      description: 'Align payment dates with income',
      currentSchedule: earlyMonthExpenses.map((e) => ({
        date: new Date(e.lastOccurrence),
        description: e.merchantStandardised,
        amount: e.expectedAmount,
        accountId: e.accountId,
      })),
      optimisedSchedule: earlyMonthExpenses.map((e) => ({
        date: new Date(
          new Date().setDate(primaryIncomeDay + 3)
        ), // 3 days after income
        description: e.merchantStandardised,
        amount: e.expectedAmount,
        accountId: e.accountId,
      })),
      benefitDescription: `Moving ${earlyMonthExpenses.length} payments to after your income date reduces cashflow stress`,
      projectedBenefit: totalEarlyExpenses * 0.02, // Assume 2% benefit from avoiding overdraft
    });
  }

  return optimisations;
}

// =============================================================================
// LOAN REPAYMENT OPTIMISATION
// =============================================================================

function optimiseLoanRepayments(
  loans: LoanData[],
  offsetAccounts: OffsetAccountData[],
  forecast: COEInput['forecast']
): RepaymentOptimisation[] {
  const optimisations: RepaymentOptimisation[] = [];

  loans.forEach((loan) => {
    // Check if interest-only could switch to P&I
    if (loan.isInterestOnly) {
      const currentInterest = loan.principal * loan.interestRate;
      const pAndIPayment = calculatePandIPayment(
        loan.principal,
        loan.interestRate,
        30
      );
      const monthlyDiff = pAndIPayment - loan.monthlyRepayment;

      if (monthlyDiff < forecast.summary.netCashflow30 / 30) {
        optimisations.push({
          loanId: loan.id,
          loanName: loan.name,
          currentStrategy: 'Interest Only',
          recommendedStrategy: 'Principal & Interest',
          currentMonthlyPayment: loan.monthlyRepayment,
          recommendedMonthlyPayment: pAndIPayment,
          interestSavings: calculateInterestSavings(loan, 5),
          termReduction: 60, // 5 years earlier payoff estimate
          rationale: 'Your cashflow can support P&I payments, saving significant interest long-term',
        });
      }
    }

    // Check offset account utilisation
    const linkedOffset = offsetAccounts.find(
      (o) => o.linkedLoanId === loan.id
    );
    if (linkedOffset && linkedOffset.balance < loan.principal * 0.1) {
      optimisations.push({
        loanId: loan.id,
        loanName: loan.name,
        currentStrategy: 'Underutilised offset',
        recommendedStrategy: 'Maximise offset balance',
        currentMonthlyPayment: loan.monthlyRepayment,
        recommendedMonthlyPayment: loan.monthlyRepayment,
        interestSavings: loan.principal * 0.1 * loan.interestRate,
        termReduction: 12,
        rationale: `Building offset balance to 10% of loan ($${Math.round(loan.principal * 0.1)}) saves $${Math.round(loan.principal * 0.1 * loan.interestRate)}/year`,
      });
    }

    // Check for extra repayment opportunity
    if (!loan.isInterestOnly && forecast.summary.netCashflow30 > 500) {
      const extraPerMonth = Math.min(
        500,
        forecast.summary.netCashflow30 / 30 * 0.5
      );
      const annualExtra = extraPerMonth * 12;
      const interestSaved = annualExtra * loan.interestRate * 10; // Rough 10-year impact

      optimisations.push({
        loanId: loan.id,
        loanName: loan.name,
        currentStrategy: 'Minimum repayments',
        recommendedStrategy: `Extra $${Math.round(extraPerMonth)}/month repayments`,
        currentMonthlyPayment: loan.monthlyRepayment,
        recommendedMonthlyPayment: loan.monthlyRepayment + extraPerMonth,
        interestSavings: interestSaved,
        termReduction: Math.round((annualExtra * 10) / loan.monthlyRepayment),
        rationale: 'Extra repayments reduce principal faster, saving interest',
      });
    }
  });

  return optimisations.sort((a, b) => b.interestSavings - a.interestSavings);
}

function calculatePandIPayment(
  principal: number,
  annualRate: number,
  years: number
): number {
  const monthlyRate = annualRate / 12;
  const numPayments = years * 12;
  return (
    (principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))) /
    (Math.pow(1 + monthlyRate, numPayments) - 1)
  );
}

function calculateInterestSavings(loan: LoanData, years: number): number {
  // Simplified calculation - actual would use amortisation schedule
  const ioInterest = loan.principal * loan.interestRate * years;
  const pAndIInterest =
    loan.principal * loan.interestRate * years * 0.7; // Rough estimate
  return ioInterest - pAndIInterest;
}

// =============================================================================
// BREAK-EVEN ANALYSIS
// =============================================================================

function calculateBreakEvenDay(forecast: COEInput['forecast']): number {
  // Find day of month when cumulative income equals cumulative expenses
  let cumulativeIncome = 0;
  let cumulativeExpenses = 0;

  for (let i = 0; i < Math.min(30, forecast.globalForecast.length); i++) {
    const day = forecast.globalForecast[i];
    cumulativeIncome += day.predictedIncome;
    cumulativeExpenses += day.predictedExpenses;

    if (cumulativeIncome >= cumulativeExpenses) {
      return new Date(day.date).getDate();
    }
  }

  return -1; // Never breaks even
}

// =============================================================================
// STRATEGY GENERATION
// =============================================================================

function generateStrategies(
  inefficiencies: SpendingInefficiency[],
  subscriptions: SubscriptionAnalysis[],
  fundMovements: FundMovementRecommendation[],
  scheduleOptimisations: PaymentScheduleOptimisation[],
  repaymentOptimisations: RepaymentOptimisation[]
): CashflowStrategy[] {
  const strategies: CashflowStrategy[] = [];

  // Generate strategies from inefficiencies
  inefficiencies.slice(0, 5).forEach((ineff, index) => {
    strategies.push({
      id: `strategy-ineff-${index}`,
      type: 'REDUCE_WASTE',
      priority: severityToPriority(valueToSeverity(ineff.potentialSavings)),
      title: `Reduce ${ineff.merchantOrCategory} spending`,
      summary: ineff.description,
      detail: `Current spend: $${Math.round(ineff.currentSpend)}/year. Potential savings: $${Math.round(ineff.potentialSavings)}/year.`,
      confidence: ineff.confidenceScore,
      projectedBenefit: ineff.potentialSavings,
      recommendedSteps: generateInefficiencySteps(ineff),
      affectedAccountIds: [],
      affectedLoanIds: [],
      affectedRecurringIds: [],
      status: 'PENDING',
    });
  });

  // Generate strategies from fund movements
  fundMovements.forEach((fm, index) => {
    strategies.push({
      id: `strategy-fund-${index}`,
      type: fm.reason.includes('shortfall') ? 'PREVENT_SHORTFALL' : 'MAXIMISE_OFFSET',
      priority: fm.urgency === 'HIGH' ? 90 : fm.urgency === 'MEDIUM' ? 60 : 30,
      title: `Transfer funds to ${fm.toAccountName}`,
      summary: fm.reason,
      confidence: 0.9,
      projectedBenefit: fm.projectedBenefit,
      recommendedSteps: [
        {
          order: 1,
          action: 'TRANSFER',
          description: `Transfer $${Math.round(fm.amount)} from ${fm.fromAccountName} to ${fm.toAccountName}`,
          optional: false,
        },
        {
          order: 2,
          action: 'MONITOR',
          description: 'Monitor account balances for 30 days',
          optional: true,
        },
      ],
      affectedAccountIds: [fm.fromAccountId, fm.toAccountId],
      affectedLoanIds: [],
      affectedRecurringIds: [],
      status: 'PENDING',
    });
  });

  // Generate strategies from repayment optimisations
  repaymentOptimisations.slice(0, 3).forEach((ro, index) => {
    strategies.push({
      id: `strategy-repay-${index}`,
      type: 'REPAYMENT_OPTIMISE',
      priority: ro.interestSavings > 5000 ? 85 : ro.interestSavings > 1000 ? 65 : 45,
      title: ro.recommendedStrategy,
      summary: ro.rationale,
      detail: `Save $${Math.round(ro.interestSavings)} in interest. Pay off ${ro.termReduction} months earlier.`,
      confidence: 0.85,
      projectedBenefit: ro.interestSavings,
      recommendedSteps: [
        {
          order: 1,
          action: 'CONTACT_LENDER',
          description: `Contact lender to change repayment strategy`,
          optional: false,
        },
        {
          order: 2,
          action: 'ADJUST_PAYMENT',
          description: `Adjust payment from $${Math.round(ro.currentMonthlyPayment)} to $${Math.round(ro.recommendedMonthlyPayment)}/month`,
          optional: false,
        },
      ],
      affectedAccountIds: [],
      affectedLoanIds: [ro.loanId],
      affectedRecurringIds: [],
      status: 'PENDING',
    });
  });

  // Generate strategy for schedule optimisation
  scheduleOptimisations.forEach((so, index) => {
    strategies.push({
      id: `strategy-schedule-${index}`,
      type: 'SCHEDULE_OPTIMISE',
      priority: 50,
      title: 'Optimise payment schedule',
      summary: so.benefitDescription,
      confidence: 0.7,
      projectedBenefit: so.projectedBenefit,
      recommendedSteps: [
        {
          order: 1,
          action: 'REVIEW',
          description: 'Review which payments can have their dates changed',
          optional: false,
        },
        {
          order: 2,
          action: 'RESCHEDULE',
          description: 'Contact service providers to reschedule payment dates',
          optional: false,
        },
      ],
      affectedAccountIds: [],
      affectedLoanIds: [],
      affectedRecurringIds: [],
      status: 'PENDING',
    });
  });

  // Sort by priority
  return strategies.sort((a, b) => b.priority - a.priority);
}

function generateInefficiencySteps(ineff: SpendingInefficiency): StrategyStep[] {
  const steps: StrategyStep[] = [];

  if (ineff.category === 'SUBSCRIPTION') {
    steps.push({
      order: 1,
      action: 'REVIEW',
      description: `Review usage of ${ineff.merchantOrCategory}`,
      optional: false,
    });
    steps.push({
      order: 2,
      action: 'EVALUATE',
      description: 'Determine if subscription is still providing value',
      optional: false,
    });
    steps.push({
      order: 3,
      action: 'CANCEL_OR_DOWNGRADE',
      description: 'Cancel or downgrade if not needed',
      optional: false,
    });
  } else {
    steps.push({
      order: 1,
      action: 'ANALYSE',
      description: `Review ${ineff.merchantOrCategory} transactions`,
      optional: false,
    });
    steps.push({
      order: 2,
      action: 'SET_BUDGET',
      description: `Set budget of $${Math.round(ineff.benchmarkSpend || ineff.currentSpend * 0.7)}/month`,
      optional: false,
    });
    steps.push({
      order: 3,
      action: 'TRACK',
      description: 'Track spending against budget for 30 days',
      optional: true,
    });
  }

  return steps;
}

// =============================================================================
// SUMMARY CALCULATION
// =============================================================================

function calculateSummary(
  inefficiencies: SpendingInefficiency[],
  subscriptions: SubscriptionAnalysis[],
  priceIncreases: SubscriptionAnalysis[],
  strategies: CashflowStrategy[]
): COESummary {
  const totalPotentialSavings =
    inefficiencies.reduce((sum, i) => sum + i.potentialSavings, 0) +
    strategies.reduce((sum, s) => sum + s.projectedBenefit, 0);

  const highPriorityActions = strategies.filter((s) => s.priority >= 70).length;

  return {
    totalPotentialSavings,
    inefficiencyCount: inefficiencies.length,
    subscriptionCount: subscriptions.length,
    priceIncreaseCount: priceIncreases.length,
    strategyCount: strategies.length,
    highPriorityActions,
  };
}
