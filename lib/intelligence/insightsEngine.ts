/**
 * MONITRAX INSIGHTS ENGINE v2.0
 * Phase 8 Task 10.6 - GRDCS-Aware Relational Insights
 *
 * Generates actionable insights from Snapshot 2.0 relational data.
 * All insights include affected entities (GRDCS format) and recommended fixes.
 */

import { GRDCSLinkedEntity, GRDCSMissingLink, createLinkedEntity } from '@/lib/grdcs';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export type InsightSeverity = 'critical' | 'high' | 'medium' | 'low';

// Granular categories for detailed insight classification
export type InsightCategory =
  | 'missing_link'
  | 'orphaned_entity'
  | 'cross_module_health'
  | 'data_completeness'
  | 'structural_gap'
  | 'duplicate_invalid'
  | 'financial_metric'
  | 'risk_signal'
  | 'opportunity';

// Blueprint-aligned categories (Phase 04 Section 3)
export type BlueprintCategory =
  | 'RELATIONAL'
  | 'COMPLETENESS'
  | 'ANOMALY'
  | 'PERFORMANCE'
  | 'FORECAST'
  | 'HEALTH';

// Mapping from granular to blueprint categories
export const CATEGORY_TO_BLUEPRINT: Record<InsightCategory, BlueprintCategory> = {
  missing_link: 'RELATIONAL',
  orphaned_entity: 'RELATIONAL',
  cross_module_health: 'HEALTH',
  data_completeness: 'COMPLETENESS',
  structural_gap: 'RELATIONAL',
  duplicate_invalid: 'ANOMALY',
  financial_metric: 'PERFORMANCE',
  risk_signal: 'FORECAST',
  opportunity: 'PERFORMANCE',
};

// Get blueprint category from granular category
export function getBlueprintCategory(category: InsightCategory): BlueprintCategory {
  return CATEGORY_TO_BLUEPRINT[category];
}

export interface InsightItem {
  id: string;
  severity: InsightSeverity;
  category: InsightCategory;
  blueprintCategory?: BlueprintCategory;
  title: string;
  description: string;
  affectedEntities: GRDCSLinkedEntity[];
  recommendedFix: string;
  metadata?: Record<string, unknown>;
}

/**
 * Enrich insight with blueprint category
 */
function enrichWithBlueprintCategory(insight: InsightItem): InsightItem {
  return {
    ...insight,
    blueprintCategory: getBlueprintCategory(insight.category),
  };
}

export interface InsightsSummary {
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  totalCount: number;
}

export interface InsightsResult {
  insights: InsightItem[];
  summary: InsightsSummary;
}

// =============================================================================
// SNAPSHOT V2 TYPE (matches portfolio/snapshot response)
// =============================================================================

export interface SnapshotV2 {
  generatedAt: string;
  userId: string;
  version: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  cashflow: {
    totalIncome: number;
    totalExpenses: number;
    monthlyNetCashflow: number;
    annualNetCashflow: number;
    savingsRate: number;
  };
  assets: {
    properties: { count: number; totalValue: number };
    accounts: { count: number; totalValue: number };
    investments: { count: number; totalValue: number };
  };
  liabilities: {
    loans: { count: number; totalValue: number };
  };
  gearing: {
    portfolioLVR: number;
    debtToIncome: number;
  };
  linkageHealth: {
    completenessScore: number;
    orphanCount: number;
    missingLinks: GRDCSMissingLink[];
    crossModuleConsistency: number;
    warnings: string[];
  };
  moduleCompleteness: {
    properties: { count: number; linkedCount: number; score: number };
    loans: { count: number; linkedCount: number; score: number };
    income: { count: number; linkedCount: number; score: number };
    expenses: { count: number; linkedCount: number; score: number };
    accounts: { count: number; linkedCount: number; score: number };
    investmentAccounts: { count: number; linkedCount: number; score: number };
    holdings: { count: number; linkedCount: number; score: number };
    transactions: { count: number; linkedCount: number; score: number };
  };
  relationalInsights: {
    totalWarnings: number;
    errors: RelationalWarning[];
    warnings: RelationalWarning[];
    info: RelationalWarning[];
  };
  properties: PropertySnapshot[];
  loans: LoanSnapshot[];
  investments: {
    totalValue: number;
    accounts: InvestmentAccountSnapshot[];
  };
  taxExposure: {
    taxableIncome: number;
    deductibleExpenses: number;
    estimatedTaxableIncome: number;
  };
  entityCounts: {
    properties: number;
    loans: number;
    income: number;
    expenses: number;
    accounts: number;
    investmentAccounts: number;
    holdings: number;
    transactions: number;
  };
}

interface RelationalWarning {
  type: 'error' | 'warning' | 'info';
  category: string;
  entityType: string;
  entityId: string;
  entityName: string;
  message: string;
  suggestedAction?: string;
}

interface PropertySnapshot {
  id: string;
  name: string;
  type: string;
  marketValue: number;
  equity: number;
  lvr: number;
  rentalYield: number;
  cashflow: {
    annualIncome: number;
    annualExpenses: number;
    annualInterest: number;
    annualNet: number;
    monthlyNet: number;
  };
  _links?: { related: GRDCSLinkedEntity[] };
  _meta?: { linkedCount: number; missingLinks: GRDCSMissingLink[] };
}

interface LoanSnapshot {
  id: string;
  name: string;
  principal: number;
  interestRate: number;
  propertyId: string | null;
  propertyName: string | null;
  offsetBalance: number;
  _links?: { related: GRDCSLinkedEntity[] };
  _meta?: { linkedCount: number; missingLinks: GRDCSMissingLink[] };
}

interface InvestmentAccountSnapshot {
  id: string;
  name: string;
  totalValue: number;
  holdings: HoldingSnapshot[];
  _links?: { related: GRDCSLinkedEntity[] };
  _meta?: { linkedCount: number; missingLinks: GRDCSMissingLink[] };
}

interface HoldingSnapshot {
  id: string;
  ticker: string;
  currentValue: number;
  _links?: { related: GRDCSLinkedEntity[] };
  _meta?: { linkedCount: number; missingLinks: GRDCSMissingLink[] };
}

// =============================================================================
// INSIGHT GENERATORS
// =============================================================================

let insightIdCounter = 0;

function generateInsightId(): string {
  return `insight-${++insightIdCounter}`;
}

/**
 * Generate insights from orphaned entities
 */
function generateOrphanedEntityInsights(snapshot: SnapshotV2): InsightItem[] {
  const insights: InsightItem[] = [];

  // Process errors from relational insights (orphaned entities)
  for (const error of snapshot.relationalInsights.errors) {
    if (error.category === 'orphan' || error.category === 'inconsistency') {
      insights.push({
        id: generateInsightId(),
        severity: 'high',
        category: 'orphaned_entity',
        title: `Orphaned ${error.entityType.replace(/([A-Z])/g, ' $1').trim()}`,
        description: error.message,
        affectedEntities: [
          createLinkedEntity(
            error.entityType as any,
            error.entityId,
            error.entityName
          ),
        ],
        recommendedFix: error.suggestedAction || 'Link this entity to its parent module',
      });
    }
  }

  // Overall orphan count warning
  if (snapshot.linkageHealth.orphanCount > 0) {
    insights.push({
      id: generateInsightId(),
      severity: snapshot.linkageHealth.orphanCount > 5 ? 'high' : 'medium',
      category: 'orphaned_entity',
      title: `${snapshot.linkageHealth.orphanCount} Orphaned Entities Detected`,
      description: `Your portfolio contains ${snapshot.linkageHealth.orphanCount} entities that are not properly linked. This affects data accuracy and reporting.`,
      affectedEntities: [],
      recommendedFix: 'Review each module and ensure all entities are properly linked to their parent records.',
      metadata: { orphanCount: snapshot.linkageHealth.orphanCount },
    });
  }

  return insights;
}

/**
 * Generate insights from missing links
 */
function generateMissingLinkInsights(snapshot: SnapshotV2): InsightItem[] {
  const insights: InsightItem[] = [];

  // Process warnings from relational insights
  for (const warning of snapshot.relationalInsights.warnings) {
    if (warning.category === 'missing_link') {
      insights.push({
        id: generateInsightId(),
        severity: 'medium',
        category: 'missing_link',
        title: `Missing Link: ${warning.entityName}`,
        description: warning.message,
        affectedEntities: [
          createLinkedEntity(
            warning.entityType as any,
            warning.entityId,
            warning.entityName
          ),
        ],
        recommendedFix: warning.suggestedAction || 'Add the missing link for complete data tracking',
      });
    }
  }

  // Process global missing links
  for (const missingLink of snapshot.linkageHealth.missingLinks) {
    insights.push({
      id: generateInsightId(),
      severity: 'medium',
      category: 'missing_link',
      title: `Missing ${missingLink.type.replace(/([A-Z])/g, ' $1').trim()} Link`,
      description: missingLink.reason,
      affectedEntities: [],
      recommendedFix: missingLink.suggestedAction || `Add a ${missingLink.type} link to complete the relationship`,
    });
  }

  return insights;
}

/**
 * Generate cross-module health insights
 */
function generateCrossModuleInsights(snapshot: SnapshotV2): InsightItem[] {
  const insights: InsightItem[] = [];

  // Cross-module consistency score
  if (snapshot.linkageHealth.crossModuleConsistency < 70) {
    insights.push({
      id: generateInsightId(),
      severity: snapshot.linkageHealth.crossModuleConsistency < 50 ? 'critical' : 'high',
      category: 'cross_module_health',
      title: 'Low Cross-Module Consistency',
      description: `Your portfolio's cross-module consistency is ${snapshot.linkageHealth.crossModuleConsistency}%. This indicates relationship issues between modules that may affect calculations.`,
      affectedEntities: [],
      recommendedFix: 'Review and fix orphaned entities and missing links to improve data consistency.',
      metadata: { score: snapshot.linkageHealth.crossModuleConsistency },
    });
  }

  // Process inconsistency warnings
  for (const warning of snapshot.relationalInsights.warnings) {
    if (warning.category === 'inconsistency') {
      insights.push({
        id: generateInsightId(),
        severity: 'high',
        category: 'cross_module_health',
        title: `Data Inconsistency: ${warning.entityName}`,
        description: warning.message,
        affectedEntities: [
          createLinkedEntity(
            warning.entityType as any,
            warning.entityId,
            warning.entityName
          ),
        ],
        recommendedFix: warning.suggestedAction || 'Verify and correct the relationship data',
      });
    }
  }

  return insights;
}

/**
 * Generate data completeness insights
 */
function generateCompletenessInsights(snapshot: SnapshotV2): InsightItem[] {
  const insights: InsightItem[] = [];

  // Overall completeness score
  if (snapshot.linkageHealth.completenessScore < 80) {
    insights.push({
      id: generateInsightId(),
      severity: snapshot.linkageHealth.completenessScore < 50 ? 'high' : 'medium',
      category: 'data_completeness',
      title: 'Portfolio Data Incomplete',
      description: `Your portfolio completeness score is ${snapshot.linkageHealth.completenessScore}%. Complete data ensures accurate financial insights.`,
      affectedEntities: [],
      recommendedFix: 'Add missing relationships and ensure all entities are properly linked.',
      metadata: { score: snapshot.linkageHealth.completenessScore },
    });
  }

  // Module-specific completeness
  const modules = [
    { name: 'Properties', data: snapshot.moduleCompleteness.properties },
    { name: 'Loans', data: snapshot.moduleCompleteness.loans },
    { name: 'Income', data: snapshot.moduleCompleteness.income },
    { name: 'Expenses', data: snapshot.moduleCompleteness.expenses },
    { name: 'Investment Accounts', data: snapshot.moduleCompleteness.investmentAccounts },
    { name: 'Holdings', data: snapshot.moduleCompleteness.holdings },
    { name: 'Transactions', data: snapshot.moduleCompleteness.transactions },
  ];

  for (const module of modules) {
    if (module.data.count > 0 && module.data.score < 70) {
      insights.push({
        id: generateInsightId(),
        severity: module.data.score < 50 ? 'medium' : 'low',
        category: 'data_completeness',
        title: `${module.name} Module Incomplete`,
        description: `Only ${module.data.linkedCount} of ${module.data.count} ${module.name.toLowerCase()} are properly linked (${module.data.score}% complete).`,
        affectedEntities: [],
        recommendedFix: `Review your ${module.name.toLowerCase()} and add missing links to related entities.`,
        metadata: {
          module: module.name,
          linked: module.data.linkedCount,
          total: module.data.count,
          score: module.data.score
        },
      });
    }
  }

  // Process info-level completeness warnings
  for (const info of snapshot.relationalInsights.info) {
    if (info.category === 'completeness') {
      insights.push({
        id: generateInsightId(),
        severity: 'low',
        category: 'data_completeness',
        title: `${info.entityName} Missing Data`,
        description: info.message,
        affectedEntities: [
          createLinkedEntity(
            info.entityType as any,
            info.entityId,
            info.entityName
          ),
        ],
        recommendedFix: info.suggestedAction || 'Add missing data for complete tracking',
      });
    }
  }

  return insights;
}

/**
 * Generate structural gap insights
 */
function generateStructuralGapInsights(snapshot: SnapshotV2): InsightItem[] {
  const insights: InsightItem[] = [];

  // Properties without loans
  const propertiesWithLoans = snapshot.loans.filter(l => l.propertyId).length;
  if (snapshot.entityCounts.properties > 0 && propertiesWithLoans < snapshot.entityCounts.properties) {
    const missingCount = snapshot.entityCounts.properties - propertiesWithLoans;
    insights.push({
      id: generateInsightId(),
      severity: 'low',
      category: 'structural_gap',
      title: 'Properties Without Loans',
      description: `${missingCount} propert${missingCount === 1 ? 'y' : 'ies'} ${missingCount === 1 ? 'has' : 'have'} no linked loans. If these are mortgaged, link the loans for accurate LVR calculations.`,
      affectedEntities: [],
      recommendedFix: 'Review properties and link any associated loans.',
    });
  }

  // Investment accounts without holdings
  const accountsWithHoldings = snapshot.investments.accounts.filter(
    a => a.holdings && a.holdings.length > 0
  ).length;
  if (snapshot.entityCounts.investmentAccounts > 0 && accountsWithHoldings < snapshot.entityCounts.investmentAccounts) {
    const emptyCount = snapshot.entityCounts.investmentAccounts - accountsWithHoldings;
    insights.push({
      id: generateInsightId(),
      severity: 'low',
      category: 'structural_gap',
      title: 'Empty Investment Accounts',
      description: `${emptyCount} investment account${emptyCount === 1 ? '' : 's'} ${emptyCount === 1 ? 'has' : 'have'} no holdings. Add holdings to track portfolio value.`,
      affectedEntities: [],
      recommendedFix: 'Add holdings to empty investment accounts or remove unused accounts.',
    });
  }

  // Holdings without transactions
  const totalHoldings = snapshot.entityCounts.holdings;
  const transactionsByHolding = new Set<string>();
  // This would need transaction data - using entity counts as proxy
  if (totalHoldings > 0 && snapshot.entityCounts.transactions === 0) {
    insights.push({
      id: generateInsightId(),
      severity: 'low',
      category: 'structural_gap',
      title: 'Holdings Without Transaction History',
      description: 'Your holdings have no recorded transactions. Add transactions for accurate cost base and CGT tracking.',
      affectedEntities: [],
      recommendedFix: 'Record buy transactions for each holding to establish cost base.',
    });
  }

  return insights;
}

/**
 * Generate financial metric insights with relational context
 */
function generateFinancialMetricInsights(snapshot: SnapshotV2): InsightItem[] {
  const insights: InsightItem[] = [];

  // High LVR properties
  for (const property of snapshot.properties) {
    if (property.lvr > 80) {
      const affectedEntities: GRDCSLinkedEntity[] = [
        createLinkedEntity('property', property.id, property.name, {
          value: property.marketValue,
          summary: `LVR: ${property.lvr.toFixed(1)}%`,
        }),
      ];

      // Add linked loans
      if (property._links?.related) {
        const linkedLoans = property._links.related.filter(e => e.type === 'loan');
        affectedEntities.push(...linkedLoans);
      }

      insights.push({
        id: generateInsightId(),
        severity: property.lvr > 90 ? 'critical' : 'high',
        category: 'financial_metric',
        title: `High LVR: ${property.name}`,
        description: `Property "${property.name}" has an LVR of ${property.lvr.toFixed(1)}%. High LVR increases risk and may affect refinancing options.`,
        affectedEntities,
        recommendedFix: property.lvr > 90
          ? 'Consider paying down the loan or making additional repayments to reduce LVR below 90%.'
          : 'Monitor LVR and consider strategies to reduce debt or increase property value.',
        metadata: { lvr: property.lvr, propertyValue: property.marketValue },
      });
    }
  }

  // Negative cashflow properties
  for (const property of snapshot.properties) {
    if (property.type === 'INVESTMENT' && property.cashflow.annualNet < 0) {
      const affectedEntities: GRDCSLinkedEntity[] = [
        createLinkedEntity('property', property.id, property.name, {
          value: property.cashflow.annualNet,
          summary: `Annual: $${property.cashflow.annualNet.toLocaleString()}`,
        }),
      ];

      insights.push({
        id: generateInsightId(),
        severity: Math.abs(property.cashflow.annualNet) > 20000 ? 'high' : 'medium',
        category: 'financial_metric',
        title: `Negative Cashflow: ${property.name}`,
        description: `Investment property "${property.name}" has negative cashflow of $${Math.abs(property.cashflow.monthlyNet).toFixed(0)}/month. While this provides tax benefits, ensure it's sustainable.`,
        affectedEntities,
        recommendedFix: 'Review rental income and expenses. Consider rent increases or expense reduction strategies.',
        metadata: {
          annualCashflow: property.cashflow.annualNet,
          monthlyCashflow: property.cashflow.monthlyNet,
        },
      });
    }
  }

  // Low rental yield
  for (const property of snapshot.properties) {
    if (property.type === 'INVESTMENT' && property.rentalYield < 3 && property.cashflow.annualIncome > 0) {
      insights.push({
        id: generateInsightId(),
        severity: 'low',
        category: 'financial_metric',
        title: `Low Rental Yield: ${property.name}`,
        description: `Property "${property.name}" has a rental yield of ${property.rentalYield.toFixed(2)}%, below the typical 3-5% range.`,
        affectedEntities: [
          createLinkedEntity('property', property.id, property.name, {
            value: property.rentalYield,
            summary: `Yield: ${property.rentalYield.toFixed(2)}%`,
          }),
        ],
        recommendedFix: 'Consider reviewing rental pricing against market rates or evaluating the property\'s long-term growth potential.',
        metadata: { rentalYield: property.rentalYield },
      });
    }
  }

  // Portfolio-level gearing
  if (snapshot.gearing.portfolioLVR > 70) {
    insights.push({
      id: generateInsightId(),
      severity: snapshot.gearing.portfolioLVR > 80 ? 'high' : 'medium',
      category: 'financial_metric',
      title: 'High Portfolio Gearing',
      description: `Your overall portfolio LVR is ${snapshot.gearing.portfolioLVR.toFixed(1)}%. High gearing increases risk during market downturns.`,
      affectedEntities: [],
      recommendedFix: 'Consider debt reduction strategies or building equity before acquiring new assets.',
      metadata: { portfolioLVR: snapshot.gearing.portfolioLVR },
    });
  }

  // Debt to income ratio
  if (snapshot.gearing.debtToIncome > 6) {
    insights.push({
      id: generateInsightId(),
      severity: snapshot.gearing.debtToIncome > 8 ? 'high' : 'medium',
      category: 'financial_metric',
      title: 'High Debt-to-Income Ratio',
      description: `Your debt-to-income ratio is ${snapshot.gearing.debtToIncome.toFixed(1)}x. Lenders typically prefer ratios below 6x.`,
      affectedEntities: [],
      recommendedFix: 'Focus on increasing income or reducing debt to improve borrowing capacity.',
      metadata: { debtToIncome: snapshot.gearing.debtToIncome },
    });
  }

  // Negative savings rate
  if (snapshot.cashflow.savingsRate < 0) {
    insights.push({
      id: generateInsightId(),
      severity: 'critical',
      category: 'financial_metric',
      title: 'Negative Cash Flow',
      description: `Your expenses exceed income by $${Math.abs(snapshot.cashflow.monthlyNetCashflow).toFixed(0)}/month. This is unsustainable long-term.`,
      affectedEntities: [],
      recommendedFix: 'Urgently review expenses and income sources. Consider budget cuts or additional income streams.',
      metadata: {
        savingsRate: snapshot.cashflow.savingsRate,
        monthlyDeficit: snapshot.cashflow.monthlyNetCashflow,
      },
    });
  } else if (snapshot.cashflow.savingsRate < 10 && snapshot.cashflow.totalIncome > 0) {
    insights.push({
      id: generateInsightId(),
      severity: 'medium',
      category: 'financial_metric',
      title: 'Low Savings Rate',
      description: `Your savings rate is ${snapshot.cashflow.savingsRate.toFixed(1)}%. Financial experts recommend at least 20% for wealth building.`,
      affectedEntities: [],
      recommendedFix: 'Review discretionary expenses and look for opportunities to increase savings.',
      metadata: { savingsRate: snapshot.cashflow.savingsRate },
    });
  }

  return insights;
}

/**
 * Generate risk signal insights
 */
function generateRiskInsights(snapshot: SnapshotV2): InsightItem[] {
  const insights: InsightItem[] = [];

  // No emergency buffer (low cash)
  const totalCash = snapshot.assets.accounts.totalValue;
  const monthlyExpenses = snapshot.cashflow.totalExpenses / 12;
  const monthsOfBuffer = monthlyExpenses > 0 ? totalCash / monthlyExpenses : 0;

  if (monthsOfBuffer < 3 && monthlyExpenses > 0) {
    insights.push({
      id: generateInsightId(),
      severity: monthsOfBuffer < 1 ? 'critical' : 'high',
      category: 'risk_signal',
      title: 'Insufficient Emergency Buffer',
      description: `You have only ${monthsOfBuffer.toFixed(1)} months of expenses in cash reserves. Recommend 3-6 months minimum.`,
      affectedEntities: [],
      recommendedFix: 'Build emergency savings to cover at least 3 months of expenses before further investing.',
      metadata: { monthsOfBuffer, cashBalance: totalCash },
    });
  }

  // Asset concentration
  const totalAssets = snapshot.totalAssets;
  if (totalAssets > 0) {
    const propertyConcentration = (snapshot.assets.properties.totalValue / totalAssets) * 100;
    if (propertyConcentration > 80) {
      insights.push({
        id: generateInsightId(),
        severity: 'medium',
        category: 'risk_signal',
        title: 'High Property Concentration',
        description: `${propertyConcentration.toFixed(0)}% of your assets are in property. Consider diversifying into other asset classes.`,
        affectedEntities: [],
        recommendedFix: 'Consider building positions in shares, ETFs, or other liquid investments for diversification.',
        metadata: { propertyConcentration },
      });
    }
  }

  // Loans without offset utilisation
  for (const loan of snapshot.loans) {
    if (loan.offsetBalance === 0 && loan.principal > 100000) {
      insights.push({
        id: generateInsightId(),
        severity: 'low',
        category: 'risk_signal',
        title: `No Offset: ${loan.name}`,
        description: `Loan "${loan.name}" has no offset account utilisation. An offset can significantly reduce interest costs.`,
        affectedEntities: [
          createLinkedEntity('loan', loan.id, loan.name, {
            value: loan.principal,
            summary: `Principal: $${loan.principal.toLocaleString()}`,
          }),
        ],
        recommendedFix: 'Consider linking an offset account and parking cash there to reduce interest.',
        metadata: { principal: loan.principal },
      });
    }
  }

  return insights;
}

/**
 * Generate opportunity insights
 */
function generateOpportunityInsights(snapshot: SnapshotV2): InsightItem[] {
  const insights: InsightItem[] = [];

  // High savings rate - good position
  if (snapshot.cashflow.savingsRate > 30) {
    insights.push({
      id: generateInsightId(),
      severity: 'low',
      category: 'opportunity',
      title: 'Strong Savings Position',
      description: `Your savings rate of ${snapshot.cashflow.savingsRate.toFixed(1)}% is excellent. Consider accelerating wealth building.`,
      affectedEntities: [],
      recommendedFix: 'You\'re in a great position to invest surplus cash or accelerate debt repayment.',
      metadata: { savingsRate: snapshot.cashflow.savingsRate },
    });
  }

  // Properties with equity - refinance opportunity
  for (const property of snapshot.properties) {
    if (property.equity > 200000 && property.lvr < 60) {
      insights.push({
        id: generateInsightId(),
        severity: 'low',
        category: 'opportunity',
        title: `Equity Opportunity: ${property.name}`,
        description: `Property "${property.name}" has $${property.equity.toLocaleString()} equity with low LVR. This equity could be leveraged for investment.`,
        affectedEntities: [
          createLinkedEntity('property', property.id, property.name, {
            value: property.equity,
            summary: `Equity: $${property.equity.toLocaleString()}`,
          }),
        ],
        recommendedFix: 'Consider accessing equity for further investment opportunities, keeping LVR below 80%.',
        metadata: { equity: property.equity, lvr: property.lvr },
      });
    }
  }

  // Tax deduction opportunities
  if (snapshot.taxExposure.taxableIncome > 100000 && snapshot.taxExposure.deductibleExpenses < 10000) {
    insights.push({
      id: generateInsightId(),
      severity: 'low',
      category: 'opportunity',
      title: 'Tax Deduction Opportunity',
      description: 'Your high taxable income with low deductions suggests potential tax planning opportunities.',
      affectedEntities: [],
      recommendedFix: 'Consult a tax professional about additional deductible expenses or investment strategies for tax efficiency.',
      metadata: {
        taxableIncome: snapshot.taxExposure.taxableIncome,
        deductions: snapshot.taxExposure.deductibleExpenses,
      },
    });
  }

  return insights;
}

// =============================================================================
// MAIN EXPORT FUNCTION
// =============================================================================

/**
 * Generate all insights for the dashboard from Snapshot 2.0 data.
 * Insights are sorted by severity (critical → high → medium → low).
 */
export function getInsightsForDashboard(snapshot: SnapshotV2): InsightsResult {
  // Reset counter for consistent IDs
  insightIdCounter = 0;

  // Generate all insight categories
  const allInsights: InsightItem[] = [
    ...generateOrphanedEntityInsights(snapshot),
    ...generateMissingLinkInsights(snapshot),
    ...generateCrossModuleInsights(snapshot),
    ...generateCompletenessInsights(snapshot),
    ...generateStructuralGapInsights(snapshot),
    ...generateFinancialMetricInsights(snapshot),
    ...generateRiskInsights(snapshot),
    ...generateOpportunityInsights(snapshot),
  ];

  // Sort by severity
  const severityOrder: Record<InsightSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  // Enrich with blueprint categories and sort by severity
  const enrichedInsights = allInsights
    .map(enrichWithBlueprintCategory)
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Calculate summary
  const summary: InsightsSummary = {
    criticalCount: enrichedInsights.filter(i => i.severity === 'critical').length,
    highCount: enrichedInsights.filter(i => i.severity === 'high').length,
    mediumCount: enrichedInsights.filter(i => i.severity === 'medium').length,
    lowCount: enrichedInsights.filter(i => i.severity === 'low').length,
    totalCount: enrichedInsights.length,
  };

  return {
    insights: enrichedInsights,
    summary,
  };
}

/**
 * Get insights filtered by category
 */
export function getInsightsByCategory(
  snapshot: SnapshotV2,
  categories: InsightCategory[]
): InsightsResult {
  const result = getInsightsForDashboard(snapshot);
  const filtered = result.insights.filter(i => categories.includes(i.category));

  return {
    insights: filtered,
    summary: {
      criticalCount: filtered.filter(i => i.severity === 'critical').length,
      highCount: filtered.filter(i => i.severity === 'high').length,
      mediumCount: filtered.filter(i => i.severity === 'medium').length,
      lowCount: filtered.filter(i => i.severity === 'low').length,
      totalCount: filtered.length,
    },
  };
}

/**
 * Get insights filtered by severity
 */
export function getInsightsBySeverity(
  snapshot: SnapshotV2,
  minSeverity: InsightSeverity
): InsightsResult {
  const result = getInsightsForDashboard(snapshot);
  const severityOrder: Record<InsightSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  const filtered = result.insights.filter(
    i => severityOrder[i.severity] <= severityOrder[minSeverity]
  );

  return {
    insights: filtered,
    summary: {
      criticalCount: filtered.filter(i => i.severity === 'critical').length,
      highCount: filtered.filter(i => i.severity === 'high').length,
      mediumCount: filtered.filter(i => i.severity === 'medium').length,
      lowCount: filtered.filter(i => i.severity === 'low').length,
      totalCount: filtered.length,
    },
  };
}

/**
 * Get critical and high severity insights only (for dashboard alerts)
 */
export function getCriticalInsights(snapshot: SnapshotV2): InsightsResult {
  return getInsightsBySeverity(snapshot, 'high');
}

/**
 * Get insights filtered by blueprint category (Phase 04 aligned)
 */
export function getInsightsByBlueprintCategory(
  snapshot: SnapshotV2,
  blueprintCategories: BlueprintCategory[]
): InsightsResult {
  const result = getInsightsForDashboard(snapshot);
  const filtered = result.insights.filter(
    i => i.blueprintCategory && blueprintCategories.includes(i.blueprintCategory)
  );

  return {
    insights: filtered,
    summary: {
      criticalCount: filtered.filter(i => i.severity === 'critical').length,
      highCount: filtered.filter(i => i.severity === 'high').length,
      mediumCount: filtered.filter(i => i.severity === 'medium').length,
      lowCount: filtered.filter(i => i.severity === 'low').length,
      totalCount: filtered.length,
    },
  };
}
