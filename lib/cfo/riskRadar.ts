/**
 * Phase 17: Risk Radar Service
 * Continuous monitoring for financial risks across short, medium, and long-term horizons
 */

import { prisma } from '@/lib/db';
import { v4 as uuid } from 'uuid';
import {
  FinancialRisk,
  RiskType,
  RiskSeverity,
  RiskTimeframe,
  RiskRadarOutput,
  RiskSummary,
  RiskEntity,
} from './types';

// ============================================================================
// Risk Thresholds
// ============================================================================

const THRESHOLDS = {
  // Short-term
  lowBalanceDays: 7,
  lowBalanceAmount: 500,
  expenseSpikePercent: 50,

  // Medium-term
  debtRatioWarning: 0.4,
  debtRatioCritical: 0.5,
  savingsRateWarning: 0.05,
  propertyYieldWarning: 0.03,

  // Long-term
  retirementGapPercent: 20,
  concentrationRiskPercent: 70,
};

// ============================================================================
// Main Risk Scanner
// ============================================================================

export async function scanForRisks(userId: string): Promise<RiskRadarOutput> {
  const risks: FinancialRisk[] = [];

  // Fetch all data
  const [
    accounts,
    loans,
    incomes,
    expenses,
    investments,
    properties,
  ] = await Promise.all([
    prisma.account.findMany({ where: { userId } }),
    prisma.loan.findMany({ where: { userId }, include: { property: true } }),
    prisma.income.findMany({ where: { userId } }),
    prisma.expense.findMany({ where: { userId } }),
    prisma.investmentAccount.findMany({ where: { userId }, include: { holdings: true } }),
    prisma.property.findMany({ where: { userId }, include: { income: true, expenses: true } }),
  ]);

  // Short-term risks
  risks.push(...detectLowBalanceRisks(accounts, expenses));
  risks.push(...detectCashflowShortfallRisks(accounts, incomes, expenses, loans));
  risks.push(...detectExpenseSpikeRisks(expenses));
  risks.push(...detectLoanStressRisks(loans, incomes));

  // Medium-term risks
  risks.push(...detectDebtRatioDeteriorationRisks(loans, incomes));
  risks.push(...detectSavingsTrajectoryRisks(incomes, expenses));
  risks.push(...detectPropertyUnderperformanceRisks(properties));
  risks.push(...detectSubscriptionCreepRisks(expenses));

  // Long-term risks
  risks.push(...detectConcentrationRisks(investments, properties));
  risks.push(...detectMortgageRenewalRisks(loans));

  // Sort by severity
  risks.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  return {
    risks,
    summary: calculateSummary(risks),
    lastScanned: new Date(),
  };
}

// ============================================================================
// Short-Term Risk Detectors
// ============================================================================

interface AccountWithBalance {
  id: string;
  name: string;
  type: string;
  currentBalance: number;
}

interface ExpenseWithDetails {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  category: string;
  isEssential: boolean;
}

interface LoanWithProperty {
  id: string;
  name: string;
  principal: number;
  minRepayment: number;
  repaymentFrequency: string;
  interestRateAnnual: number;
  termMonthsRemaining: number;
  property?: { id: string; name: string } | null;
}

interface IncomeBasic {
  id: string;
  name: string;
  amount: number;
  frequency: string;
}

function detectLowBalanceRisks(
  accounts: AccountWithBalance[],
  expenses: ExpenseWithDetails[]
): FinancialRisk[] {
  const risks: FinancialRisk[] = [];

  const monthlyExpenses = expenses.reduce((sum, e) => sum + monthlyize(e.amount, e.frequency), 0);
  const weeklyExpenses = monthlyExpenses / 4;

  for (const account of accounts) {
    if (['SAVINGS', 'TRANSACTIONAL'].includes(account.type)) {
      // Critical: balance covers less than 1 week of expenses
      if (account.currentBalance < weeklyExpenses && account.currentBalance < THRESHOLDS.lowBalanceAmount) {
        risks.push(createRisk({
          type: 'low_balance',
          severity: 'critical',
          timeframe: 'short',
          title: `Critical: ${account.name} balance is very low`,
          description: `Your ${account.name} account has only $${account.currentBalance.toFixed(0)}, which may not cover upcoming expenses.`,
          impact: weeklyExpenses - account.currentBalance,
          probability: 0.9,
          relatedEntities: [{ type: 'account', id: account.id, name: account.name }],
          suggestedActions: [
            'Transfer funds from another account',
            'Review upcoming automatic payments',
            'Consider delaying non-essential purchases',
          ],
        }));
      }
      // Warning: balance covers less than 2 weeks
      else if (account.currentBalance < weeklyExpenses * 2) {
        risks.push(createRisk({
          type: 'low_balance',
          severity: 'high',
          timeframe: 'short',
          title: `Warning: ${account.name} balance is getting low`,
          description: `Your ${account.name} account balance of $${account.currentBalance.toFixed(0)} may run low within 2 weeks.`,
          impact: weeklyExpenses * 2 - account.currentBalance,
          probability: 0.7,
          relatedEntities: [{ type: 'account', id: account.id, name: account.name }],
          suggestedActions: [
            'Monitor spending closely',
            'Consider topping up before payday',
          ],
        }));
      }
    }
  }

  return risks;
}

function detectCashflowShortfallRisks(
  accounts: AccountWithBalance[],
  incomes: IncomeBasic[],
  expenses: ExpenseWithDetails[],
  loans: LoanWithProperty[]
): FinancialRisk[] {
  const risks: FinancialRisk[] = [];

  const monthlyIncome = incomes.reduce((sum, i) => sum + monthlyize(i.amount, i.frequency), 0);
  const monthlyExpenses = expenses.reduce((sum, e) => sum + monthlyize(e.amount, e.frequency), 0);
  const monthlyLoanPayments = loans.reduce((sum, l) => sum + monthlyize(l.minRepayment, l.repaymentFrequency), 0);
  const totalLiquid = accounts
    .filter(a => ['SAVINGS', 'TRANSACTIONAL', 'OFFSET'].includes(a.type))
    .reduce((sum, a) => sum + a.currentBalance, 0);

  const monthlyCashflow = monthlyIncome - monthlyExpenses - monthlyLoanPayments;

  if (monthlyCashflow < 0) {
    const shortfall = Math.abs(monthlyCashflow);
    const monthsUntilDepleted = totalLiquid > 0 ? totalLiquid / shortfall : 0;

    risks.push(createRisk({
      type: 'cashflow_shortfall',
      severity: monthsUntilDepleted < 1 ? 'critical' : monthsUntilDepleted < 3 ? 'high' : 'medium',
      timeframe: 'short',
      title: 'Negative monthly cashflow detected',
      description: `You're spending $${shortfall.toFixed(0)} more than you earn each month. At this rate, savings will be depleted in ${monthsUntilDepleted.toFixed(1)} months.`,
      impact: shortfall * 12,
      probability: 0.95,
      relatedEntities: [],
      suggestedActions: [
        'Review and reduce non-essential expenses',
        'Look for additional income sources',
        'Consider refinancing loans for lower payments',
      ],
    }));
  }

  return risks;
}

function detectExpenseSpikeRisks(expenses: ExpenseWithDetails[]): FinancialRisk[] {
  // This would compare against historical data
  // For now, flag any single expense that's > 30% of total
  const risks: FinancialRisk[] = [];

  const totalMonthly = expenses.reduce((sum, e) => sum + monthlyize(e.amount, e.frequency), 0);

  for (const expense of expenses) {
    const monthlyAmount = monthlyize(expense.amount, expense.frequency);
    const percentage = (monthlyAmount / totalMonthly) * 100;

    if (percentage > 30 && !expense.isEssential) {
      risks.push(createRisk({
        type: 'expense_spike',
        severity: 'medium',
        timeframe: 'short',
        title: `Large expense: ${expense.name}`,
        description: `${expense.name} accounts for ${percentage.toFixed(0)}% of your monthly expenses ($${monthlyAmount.toFixed(0)}/month).`,
        impact: monthlyAmount * 12,
        probability: 0.6,
        relatedEntities: [{ type: 'expense', id: expense.id, name: expense.name }],
        suggestedActions: [
          'Review if this expense is necessary',
          'Look for cheaper alternatives',
          'Consider negotiating or bundling services',
        ],
      }));
    }
  }

  return risks;
}

function detectLoanStressRisks(
  loans: LoanWithProperty[],
  incomes: IncomeBasic[]
): FinancialRisk[] {
  const risks: FinancialRisk[] = [];
  const monthlyIncome = incomes.reduce((sum, i) => sum + monthlyize(i.amount, i.frequency), 0);

  for (const loan of loans) {
    const monthlyPayment = monthlyize(loan.minRepayment, loan.repaymentFrequency);
    const paymentRatio = monthlyPayment / monthlyIncome;

    // Single loan consuming > 30% of income
    if (paymentRatio > 0.3) {
      risks.push(createRisk({
        type: 'loan_stress',
        severity: paymentRatio > 0.4 ? 'high' : 'medium',
        timeframe: 'short',
        title: `High loan payment: ${loan.name}`,
        description: `${loan.name} payments of $${monthlyPayment.toFixed(0)}/month consume ${(paymentRatio * 100).toFixed(0)}% of your income.`,
        impact: monthlyPayment * 12,
        probability: 0.8,
        relatedEntities: [{ type: 'loan', id: loan.id, name: loan.name }],
        suggestedActions: [
          'Consider refinancing to a lower rate',
          'Explore extending the loan term',
          'Review if interest-only period is an option',
        ],
      }));
    }
  }

  return risks;
}

// ============================================================================
// Medium-Term Risk Detectors
// ============================================================================

function detectDebtRatioDeteriorationRisks(
  loans: LoanWithProperty[],
  incomes: IncomeBasic[]
): FinancialRisk[] {
  const risks: FinancialRisk[] = [];
  const monthlyIncome = incomes.reduce((sum, i) => sum + monthlyize(i.amount, i.frequency), 0);
  const totalMonthlyPayments = loans.reduce((sum, l) => sum + monthlyize(l.minRepayment, l.repaymentFrequency), 0);

  const dsr = totalMonthlyPayments / monthlyIncome;

  if (dsr > THRESHOLDS.debtRatioCritical) {
    risks.push(createRisk({
      type: 'debt_ratio_deterioration',
      severity: 'high',
      timeframe: 'medium',
      title: 'Debt service ratio is critical',
      description: `Your debt payments consume ${(dsr * 100).toFixed(0)}% of income. This exceeds most lender limits and leaves little room for unexpected expenses.`,
      impact: totalMonthlyPayments * 12,
      probability: 0.85,
      relatedEntities: loans.map(l => ({ type: 'loan' as const, id: l.id, name: l.name })),
      suggestedActions: [
        'Prioritize paying off highest-rate debts',
        'Consider debt consolidation',
        'Explore increasing income streams',
      ],
    }));
  } else if (dsr > THRESHOLDS.debtRatioWarning) {
    risks.push(createRisk({
      type: 'debt_ratio_deterioration',
      severity: 'medium',
      timeframe: 'medium',
      title: 'Debt service ratio is elevated',
      description: `Your debt payments consume ${(dsr * 100).toFixed(0)}% of income. Consider reducing debt before taking on new commitments.`,
      impact: totalMonthlyPayments * 6,
      probability: 0.7,
      relatedEntities: loans.map(l => ({ type: 'loan' as const, id: l.id, name: l.name })),
      suggestedActions: [
        'Focus on debt reduction',
        'Avoid new debt commitments',
      ],
    }));
  }

  return risks;
}

function detectSavingsTrajectoryRisks(
  incomes: IncomeBasic[],
  expenses: ExpenseWithDetails[]
): FinancialRisk[] {
  const risks: FinancialRisk[] = [];
  const monthlyIncome = incomes.reduce((sum, i) => sum + monthlyize(i.amount, i.frequency), 0);
  const monthlyExpenses = expenses.reduce((sum, e) => sum + monthlyize(e.amount, e.frequency), 0);

  const savingsRate = (monthlyIncome - monthlyExpenses) / monthlyIncome;

  if (savingsRate < 0) {
    // Already covered by cashflow shortfall
    return risks;
  }

  if (savingsRate < THRESHOLDS.savingsRateWarning) {
    risks.push(createRisk({
      type: 'savings_trajectory',
      severity: 'medium',
      timeframe: 'medium',
      title: 'Low savings rate',
      description: `You're only saving ${(savingsRate * 100).toFixed(1)}% of income. Financial experts recommend at least 20% for long-term security.`,
      impact: monthlyIncome * 0.15 * 12, // Gap to 20%
      probability: 0.75,
      relatedEntities: [],
      suggestedActions: [
        'Set up automatic savings transfers',
        'Review subscriptions and recurring expenses',
        'Consider the 50/30/20 budget rule',
      ],
    }));
  }

  return risks;
}

interface PropertyWithFinancials {
  id: string;
  name: string;
  currentValue: number;
  type: string;
  income: { amount: number; frequency: string }[];
  expenses: { amount: number; frequency: string }[];
}

function detectPropertyUnderperformanceRisks(
  properties: PropertyWithFinancials[]
): FinancialRisk[] {
  const risks: FinancialRisk[] = [];

  for (const property of properties) {
    if (property.type !== 'INVESTMENT') continue;

    const annualIncome = property.income.reduce((sum, i) => sum + annualize(i.amount, i.frequency), 0);
    const annualExpenses = property.expenses.reduce((sum, e) => sum + annualize(e.amount, e.frequency), 0);
    const grossYield = annualIncome / property.currentValue;
    const netYield = (annualIncome - annualExpenses) / property.currentValue;

    if (grossYield < THRESHOLDS.propertyYieldWarning) {
      risks.push(createRisk({
        type: 'property_underperformance',
        severity: netYield < 0 ? 'high' : 'medium',
        timeframe: 'medium',
        title: `Low yield: ${property.name}`,
        description: `${property.name} has a gross yield of ${(grossYield * 100).toFixed(2)}%${netYield < 0 ? ' and is cash-flow negative' : ''}. Consider reviewing rent or expenses.`,
        impact: Math.abs(netYield < 0 ? annualIncome - annualExpenses : property.currentValue * 0.01),
        probability: 0.8,
        relatedEntities: [{ type: 'property', id: property.id, name: property.name }],
        suggestedActions: [
          'Review current market rents',
          'Consider property improvements to justify higher rent',
          'Audit property expenses',
        ],
      }));
    }
  }

  return risks;
}

function detectSubscriptionCreepRisks(expenses: ExpenseWithDetails[]): FinancialRisk[] {
  const risks: FinancialRisk[] = [];

  // Look for multiple small recurring expenses
  const subscriptionLike = expenses.filter(e =>
    !e.isEssential &&
    ['MONTHLY', 'ANNUAL'].includes(e.frequency.toUpperCase()) &&
    monthlyize(e.amount, e.frequency) < 100
  );

  const totalSubscriptions = subscriptionLike.reduce((sum, e) => sum + monthlyize(e.amount, e.frequency), 0);

  if (subscriptionLike.length >= 5 && totalSubscriptions > 100) {
    risks.push(createRisk({
      type: 'subscription_creep',
      severity: totalSubscriptions > 300 ? 'medium' : 'low',
      timeframe: 'medium',
      title: 'Multiple subscriptions detected',
      description: `You have ${subscriptionLike.length} subscription-like expenses totalling $${totalSubscriptions.toFixed(0)}/month. Review for unused services.`,
      impact: totalSubscriptions * 12 * 0.3, // Assume 30% could be cut
      probability: 0.6,
      relatedEntities: subscriptionLike.map(e => ({ type: 'expense' as const, id: e.id, name: e.name })),
      suggestedActions: [
        'Audit all subscriptions and cancel unused ones',
        'Look for bundle deals',
        'Use annual billing for discounts on services you keep',
      ],
    }));
  }

  return risks;
}

// ============================================================================
// Long-Term Risk Detectors
// ============================================================================

interface InvestmentWithHoldings {
  id: string;
  name: string;
  holdings: { units: number; averagePrice: number; type: string }[];
}

function detectConcentrationRisks(
  investments: InvestmentWithHoldings[],
  properties: PropertyWithFinancials[]
): FinancialRisk[] {
  const risks: FinancialRisk[] = [];

  // Calculate total portfolio value
  let equityValue = 0;
  let propertyValue = properties.reduce((sum, p) => sum + p.currentValue, 0);
  let cryptoValue = 0;
  let otherValue = 0;

  for (const account of investments) {
    for (const holding of account.holdings) {
      const value = holding.units * holding.averagePrice;
      switch (holding.type) {
        case 'SHARE':
        case 'ETF':
          equityValue += value;
          break;
        case 'CRYPTO':
          cryptoValue += value;
          break;
        default:
          otherValue += value;
      }
    }
  }

  const totalValue = equityValue + propertyValue + cryptoValue + otherValue;
  if (totalValue === 0) return risks;

  // Check for over-concentration
  const propertyConcentration = propertyValue / totalValue;
  const cryptoConcentration = cryptoValue / totalValue;

  if (propertyConcentration > THRESHOLDS.concentrationRiskPercent / 100) {
    risks.push(createRisk({
      type: 'concentration_risk',
      severity: propertyConcentration > 0.9 ? 'high' : 'medium',
      timeframe: 'long',
      title: 'High property concentration',
      description: `${(propertyConcentration * 100).toFixed(0)}% of your wealth is in property. Consider diversifying into other asset classes.`,
      impact: totalValue * 0.1, // Potential loss from concentration
      probability: 0.5,
      relatedEntities: properties.map(p => ({ type: 'property' as const, id: p.id, name: p.name })),
      suggestedActions: [
        'Consider investing in shares or ETFs',
        'Build cash reserves',
        'Review property portfolio efficiency',
      ],
    }));
  }

  if (cryptoConcentration > 0.2) {
    risks.push(createRisk({
      type: 'concentration_risk',
      severity: cryptoConcentration > 0.4 ? 'high' : 'medium',
      timeframe: 'long',
      title: 'High crypto exposure',
      description: `${(cryptoConcentration * 100).toFixed(0)}% of your wealth is in cryptocurrency, which is highly volatile.`,
      impact: cryptoValue * 0.5,
      probability: 0.6,
      relatedEntities: [],
      suggestedActions: [
        'Consider reducing crypto allocation',
        'Diversify into more stable assets',
        'Set stop-loss limits',
      ],
    }));
  }

  return risks;
}

function detectMortgageRenewalRisks(loans: LoanWithProperty[]): FinancialRisk[] {
  const risks: FinancialRisk[] = [];

  for (const loan of loans) {
    // Check if loan term is ending within 12 months
    if (loan.termMonthsRemaining <= 12 && loan.termMonthsRemaining > 0) {
      risks.push(createRisk({
        type: 'mortgage_renewal',
        severity: loan.termMonthsRemaining <= 3 ? 'high' : 'medium',
        timeframe: 'long',
        title: `Loan term ending: ${loan.name}`,
        description: `${loan.name} has ${loan.termMonthsRemaining} months remaining. Start reviewing refinancing options now.`,
        impact: loan.principal * 0.01, // Potential rate increase impact
        probability: 0.9,
        relatedEntities: [{ type: 'loan', id: loan.id, name: loan.name }],
        suggestedActions: [
          'Compare rates from multiple lenders',
          'Contact your current lender about renewal terms',
          'Consider fixing rate if expecting increases',
        ],
      }));
    }
  }

  return risks;
}

// ============================================================================
// Helpers
// ============================================================================

function monthlyize(amount: number, frequency: string): number {
  switch (frequency.toUpperCase()) {
    case 'WEEKLY': return amount * 52 / 12;
    case 'FORTNIGHTLY': return amount * 26 / 12;
    case 'MONTHLY': return amount;
    case 'QUARTERLY': return amount / 3;
    case 'ANNUAL': return amount / 12;
    default: return amount;
  }
}

function annualize(amount: number, frequency: string): number {
  return monthlyize(amount, frequency) * 12;
}

interface CreateRiskParams {
  type: RiskType;
  severity: RiskSeverity;
  timeframe: RiskTimeframe;
  title: string;
  description: string;
  impact: number;
  probability: number;
  relatedEntities: RiskEntity[];
  suggestedActions: string[];
}

function createRisk(params: CreateRiskParams): FinancialRisk {
  return {
    id: uuid(),
    type: params.type,
    severity: params.severity,
    timeframe: params.timeframe,
    title: params.title,
    description: params.description,
    impact: Math.round(params.impact),
    probability: params.probability,
    detectedAt: new Date(),
    relatedEntities: params.relatedEntities,
    suggestedActions: params.suggestedActions,
  };
}

function calculateSummary(risks: FinancialRisk[]): RiskSummary {
  return {
    critical: risks.filter(r => r.severity === 'critical').length,
    high: risks.filter(r => r.severity === 'high').length,
    medium: risks.filter(r => r.severity === 'medium').length,
    low: risks.filter(r => r.severity === 'low').length,
    totalImpact: risks.reduce((sum, r) => sum + r.impact, 0),
    topRisk: risks[0] || null,
  };
}
