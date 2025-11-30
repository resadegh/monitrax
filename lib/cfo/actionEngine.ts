/**
 * Phase 17: Action Prioritisation Engine
 * Generates and prioritizes actionable financial recommendations
 */

import { prisma } from '@/lib/db';
import { v4 as uuid } from 'uuid';
import {
  CFOAction,
  ActionPriority,
  ActionCategory,
  ActionImpact,
  ActionEvidence,
  ActionPrioritisationOutput,
  RiskSeverity,
  FinancialRisk,
  CFOScoreComponents,
} from './types';

// ============================================================================
// Action Generation
// ============================================================================

export async function generateActions(
  userId: string,
  risks: FinancialRisk[],
  scoreComponents: CFOScoreComponents
): Promise<ActionPrioritisationOutput> {
  const actions: CFOAction[] = [];

  // Fetch data for action generation
  const [accounts, loans, expenses, incomes] = await Promise.all([
    prisma.account.findMany({ where: { userId } }),
    prisma.loan.findMany({ where: { userId } }),
    prisma.expense.findMany({ where: { userId } }),
    prisma.income.findMany({ where: { userId } }),
  ]);

  // Generate actions from risks
  for (const risk of risks) {
    const riskActions = generateActionsFromRisk(risk);
    actions.push(...riskActions);
  }

  // Generate proactive actions from score analysis
  const scoreActions = generateScoreImprovementActions(scoreComponents, {
    accounts,
    loans,
    expenses,
    incomes,
  });
  actions.push(...scoreActions);

  // Generate optimization opportunities
  const optimizationActions = await generateOptimizationActions(userId, {
    accounts,
    loans,
    expenses,
    incomes,
  });
  actions.push(...optimizationActions);

  // Deduplicate similar actions
  const deduped = deduplicateActions(actions);

  // Prioritize
  const prioritized = prioritizeActions(deduped);

  return {
    doNow: prioritized.filter(a => a.priority === 'do_now'),
    upcoming: prioritized.filter(a => a.priority === 'upcoming'),
    considerSoon: prioritized.filter(a => a.priority === 'consider_soon'),
    background: prioritized.filter(a => a.priority === 'background'),
    totalActions: prioritized.length,
    highestPriorityAction: prioritized[0] || null,
  };
}

// ============================================================================
// Risk-Based Action Generation
// ============================================================================

function generateActionsFromRisk(risk: FinancialRisk): CFOAction[] {
  const actions: CFOAction[] = [];

  // Map risk type to actions
  switch (risk.type) {
    case 'low_balance':
      actions.push(createAction({
        category: 'cashflow',
        title: 'Top up account balance',
        explanation: `Your ${risk.relatedEntities[0]?.name || 'account'} balance is low. Transfer funds to avoid payment failures.`,
        severity: risk.severity,
        impact: {
          type: 'risk_reduction',
          amount: risk.impact,
          timeframe: 'immediate',
          description: 'Avoid overdraft fees and payment failures',
        },
        timeRequired: '5 minutes',
        confidence: 0.95,
        evidence: [
          { type: 'metric', label: 'Current Balance', value: `$${risk.impact}` },
        ],
        relatedRisks: [risk.id],
      }));
      break;

    case 'cashflow_shortfall':
      actions.push(createAction({
        category: 'cashflow',
        title: 'Review and reduce expenses',
        explanation: 'Your monthly expenses exceed income. Review non-essential spending to regain positive cashflow.',
        severity: risk.severity,
        impact: {
          type: 'savings',
          amount: risk.impact / 12,
          timeframe: 'per month',
          description: 'Restore positive cashflow',
        },
        timeRequired: '30 minutes',
        confidence: 0.85,
        evidence: [
          { type: 'metric', label: 'Monthly Shortfall', value: `$${Math.round(risk.impact / 12)}` },
        ],
        relatedRisks: [risk.id],
      }));
      break;

    case 'loan_stress':
      actions.push(createAction({
        category: 'debt',
        title: 'Explore refinancing options',
        explanation: `${risk.relatedEntities[0]?.name || 'Your loan'} payments are consuming a large portion of income. Compare rates from other lenders.`,
        severity: risk.severity,
        impact: {
          type: 'savings',
          amount: risk.impact * 0.1, // Assume 10% potential savings
          timeframe: 'per year',
          description: 'Potential savings from lower rate',
        },
        timeRequired: '2 hours',
        confidence: 0.7,
        evidence: [
          { type: 'metric', label: 'Annual Payments', value: `$${Math.round(risk.impact)}` },
        ],
        relatedRisks: [risk.id],
      }));
      break;

    case 'debt_ratio_deterioration':
      actions.push(createAction({
        category: 'debt',
        title: 'Create debt paydown plan',
        explanation: 'Your debt service ratio is high. Focus on reducing highest-interest debts first.',
        severity: risk.severity,
        impact: {
          type: 'risk_reduction',
          amount: risk.impact * 0.05,
          timeframe: 'per year',
          description: 'Interest savings from accelerated paydown',
        },
        timeRequired: '1 hour',
        confidence: 0.8,
        evidence: [
          { type: 'metric', label: 'Debt Service Ratio', value: 'Above threshold' },
        ],
        relatedRisks: [risk.id],
      }));
      break;

    case 'savings_trajectory':
      actions.push(createAction({
        category: 'savings',
        title: 'Set up automatic savings',
        explanation: 'Your savings rate is below recommended levels. Automate transfers to build savings consistently.',
        severity: risk.severity,
        impact: {
          type: 'growth',
          amount: risk.impact,
          timeframe: 'per year',
          description: 'Additional savings if rate improved',
        },
        timeRequired: '15 minutes',
        confidence: 0.9,
        evidence: [
          { type: 'metric', label: 'Current Savings Rate', value: 'Below 20%' },
        ],
        relatedRisks: [risk.id],
      }));
      break;

    case 'property_underperformance':
      actions.push(createAction({
        category: 'property',
        title: 'Review rental pricing',
        explanation: `${risk.relatedEntities[0]?.name || 'Your property'} yield is below market. Research comparable rents in the area.`,
        severity: risk.severity,
        impact: {
          type: 'growth',
          amount: risk.impact,
          timeframe: 'per year',
          description: 'Potential additional rental income',
        },
        timeRequired: '1 hour',
        confidence: 0.65,
        evidence: [
          { type: 'metric', label: 'Gross Yield', value: 'Below 3%' },
        ],
        relatedRisks: [risk.id],
      }));
      break;

    case 'subscription_creep':
      actions.push(createAction({
        category: 'spending',
        title: 'Audit subscriptions',
        explanation: 'You have multiple recurring subscriptions. Review each one and cancel unused services.',
        severity: risk.severity,
        impact: {
          type: 'savings',
          amount: risk.impact,
          timeframe: 'per year',
          description: 'Potential savings from cancelled subscriptions',
        },
        timeRequired: '20 minutes',
        confidence: 0.75,
        evidence: [
          { type: 'metric', label: 'Subscription Count', value: `${risk.relatedEntities.length}` },
        ],
        relatedRisks: [risk.id],
      }));
      break;

    case 'concentration_risk':
      actions.push(createAction({
        category: 'investment',
        title: 'Diversify investments',
        explanation: 'Your portfolio is concentrated in one asset class. Consider spreading risk across different investments.',
        severity: risk.severity,
        impact: {
          type: 'risk_reduction',
          amount: risk.impact,
          timeframe: 'one-time',
          description: 'Reduced portfolio volatility',
        },
        timeRequired: '2 hours',
        confidence: 0.7,
        evidence: [
          { type: 'metric', label: 'Concentration', value: 'Above 70%' },
        ],
        relatedRisks: [risk.id],
      }));
      break;

    case 'mortgage_renewal':
      actions.push(createAction({
        category: 'debt',
        title: 'Start refinancing research',
        explanation: `${risk.relatedEntities[0]?.name || 'Your loan'} term is ending soon. Begin comparing offers now for the best rates.`,
        severity: risk.severity,
        impact: {
          type: 'savings',
          amount: risk.impact,
          timeframe: 'per year',
          description: 'Potential rate savings',
        },
        timeRequired: '3 hours',
        confidence: 0.85,
        evidence: [
          { type: 'metric', label: 'Months Remaining', value: 'Less than 12' },
        ],
        relatedRisks: [risk.id],
      }));
      break;
  }

  return actions;
}

// ============================================================================
// Score Improvement Actions
// ============================================================================

interface FinancialData {
  accounts: { id: string; currentBalance: number; type: string }[];
  loans: { id: string; principal: number; interestRateAnnual: number }[];
  expenses: { id: string; amount: number; frequency: string; isEssential: boolean }[];
  incomes: { id: string; amount: number; frequency: string }[];
}

function generateScoreImprovementActions(
  components: CFOScoreComponents,
  data: FinancialData
): CFOAction[] {
  const actions: CFOAction[] = [];
  const weakAreas = findWeakAreas(components);

  for (const area of weakAreas) {
    switch (area.name) {
      case 'emergencyBuffer':
        if (area.score < 50) {
          actions.push(createAction({
            category: 'savings',
            title: 'Build emergency fund',
            explanation: 'Your emergency buffer is below recommended levels. Aim for 3-6 months of essential expenses.',
            severity: area.score < 30 ? 'high' : 'medium',
            impact: {
              type: 'risk_reduction',
              amount: 5000,
              timeframe: 'target',
              description: 'Better protection against unexpected expenses',
            },
            timeRequired: 'ongoing',
            confidence: 0.9,
            evidence: [
              { type: 'metric', label: 'Emergency Buffer Score', value: area.score },
            ],
            relatedRisks: [],
          }));
        }
        break;

      case 'spendingControl':
        if (area.score < 60) {
          actions.push(createAction({
            category: 'spending',
            title: 'Reduce discretionary spending',
            explanation: 'Discretionary spending is higher than recommended. Review non-essential purchases.',
            severity: area.score < 40 ? 'high' : 'medium',
            impact: {
              type: 'savings',
              amount: 200,
              timeframe: 'per month',
              description: 'Potential monthly savings',
            },
            timeRequired: '30 minutes',
            confidence: 0.75,
            evidence: [
              { type: 'metric', label: 'Spending Control Score', value: area.score },
            ],
            relatedRisks: [],
          }));
        }
        break;

      case 'investmentDiversification':
        if (area.score < 50) {
          actions.push(createAction({
            category: 'investment',
            title: 'Review investment allocation',
            explanation: 'Your investments could be better diversified. Consider adding different asset classes.',
            severity: 'medium',
            impact: {
              type: 'optimization',
              amount: 0,
              timeframe: 'long-term',
              description: 'Better risk-adjusted returns',
            },
            timeRequired: '1 hour',
            confidence: 0.7,
            evidence: [
              { type: 'metric', label: 'Diversification Score', value: area.score },
            ],
            relatedRisks: [],
          }));
        }
        break;
    }
  }

  return actions;
}

function findWeakAreas(components: CFOScoreComponents): { name: string; score: number }[] {
  return Object.entries(components)
    .map(([name, score]) => ({ name, score }))
    .filter(area => area.score < 60)
    .sort((a, b) => a.score - b.score);
}

// ============================================================================
// Optimization Actions
// ============================================================================

async function generateOptimizationActions(
  userId: string,
  data: FinancialData
): Promise<CFOAction[]> {
  const actions: CFOAction[] = [];

  // High-interest debt optimization
  const highInterestLoans = data.loans
    .filter(l => l.interestRateAnnual > 0.06)
    .sort((a, b) => b.interestRateAnnual - a.interestRateAnnual);

  if (highInterestLoans.length > 0) {
    const topLoan = highInterestLoans[0];
    const potentialSavings = topLoan.principal * (topLoan.interestRateAnnual - 0.05);

    actions.push(createAction({
      category: 'debt',
      title: 'Refinance high-interest loan',
      explanation: `You have a loan at ${(topLoan.interestRateAnnual * 100).toFixed(2)}% interest. Current market rates may be lower.`,
      severity: 'low',
      impact: {
        type: 'savings',
        amount: Math.round(potentialSavings),
        timeframe: 'per year',
        description: 'Potential interest savings',
      },
      timeRequired: '2 hours',
      confidence: 0.6,
      evidence: [
        { type: 'metric', label: 'Current Rate', value: `${(topLoan.interestRateAnnual * 100).toFixed(2)}%` },
        { type: 'comparison', label: 'Market Rates', value: '~5-6%' },
      ],
      relatedRisks: [],
    }));
  }

  // Offset account optimization
  const offsetAccounts = data.accounts.filter(a => a.type === 'OFFSET');
  const savingsAccounts = data.accounts.filter(a => a.type === 'SAVINGS');

  if (offsetAccounts.length > 0 && savingsAccounts.length > 0) {
    const totalSavings = savingsAccounts.reduce((sum, a) => sum + a.currentBalance, 0);
    if (totalSavings > 5000) {
      actions.push(createAction({
        category: 'debt',
        title: 'Move savings to offset account',
        explanation: 'You have savings earning low interest while paying higher mortgage interest. Moving to offset saves more.',
        severity: 'low',
        impact: {
          type: 'savings',
          amount: Math.round(totalSavings * 0.03), // Assume 3% rate differential
          timeframe: 'per year',
          description: 'Interest savings from offset',
        },
        timeRequired: '15 minutes',
        confidence: 0.85,
        evidence: [
          { type: 'metric', label: 'Savings Balance', value: `$${totalSavings.toFixed(0)}` },
        ],
        relatedRisks: [],
      }));
    }
  }

  return actions;
}

// ============================================================================
// Action Helpers
// ============================================================================

interface CreateActionParams {
  category: ActionCategory;
  title: string;
  explanation: string;
  severity: RiskSeverity;
  impact: ActionImpact;
  timeRequired: string;
  confidence: number;
  evidence: ActionEvidence[];
  relatedRisks: string[];
}

function createAction(params: CreateActionParams): CFOAction {
  return {
    id: uuid(),
    priority: determinePriority(params.severity, params.impact),
    category: params.category,
    title: params.title,
    explanation: params.explanation,
    severity: params.severity,
    expectedImpact: params.impact,
    timeRequired: params.timeRequired,
    confidence: params.confidence,
    supportingData: params.evidence,
    relatedRisks: params.relatedRisks,
    createdAt: new Date(),
    status: 'pending',
  };
}

function determinePriority(severity: RiskSeverity, impact: ActionImpact): ActionPriority {
  // Critical severity always do_now
  if (severity === 'critical') return 'do_now';

  // High severity with significant impact
  if (severity === 'high' && impact.amount > 500) return 'do_now';
  if (severity === 'high') return 'upcoming';

  // Medium severity
  if (severity === 'medium' && impact.amount > 1000) return 'upcoming';
  if (severity === 'medium') return 'consider_soon';

  // Low severity
  return 'background';
}

function prioritizeActions(actions: CFOAction[]): CFOAction[] {
  const priorityOrder = { do_now: 0, upcoming: 1, consider_soon: 2, background: 3 };
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

  return actions.sort((a, b) => {
    // First by priority
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    // Then by severity
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;

    // Then by impact amount
    return b.expectedImpact.amount - a.expectedImpact.amount;
  });
}

function deduplicateActions(actions: CFOAction[]): CFOAction[] {
  const seen = new Map<string, CFOAction>();

  for (const action of actions) {
    const key = `${action.category}-${action.title}`;
    const existing = seen.get(key);

    if (!existing || action.severity === 'critical' ||
        (action.severity === 'high' && existing.severity !== 'critical')) {
      seen.set(key, action);
    }
  }

  return Array.from(seen.values());
}
