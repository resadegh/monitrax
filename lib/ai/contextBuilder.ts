/**
 * AI CONTEXT BUILDER
 * Phase 11 - AI Strategy Engine UI V2
 *
 * Entity-specific context building and AI request logging
 * for personalized financial advice.
 */

import { formatCurrencyForPrompt, formatPercentageForPrompt } from './openai';
import type { FinancialContext, PropertySummary, LoanSummary, InvestmentSummary } from './types';

// =============================================================================
// TYPES
// =============================================================================

export interface EntityContext {
  entityType: 'property' | 'loan' | 'investment';
  entityId: string;
  entityName: string;
  entityDetails: Record<string, any>;
  relatedEntities: {
    properties?: PropertySummary[];
    loans?: LoanSummary[];
    investments?: InvestmentSummary[];
  };
  financialContext: FinancialContext;
}

export interface AIRequestLog {
  id: string;
  timestamp: Date;
  userId: string;
  requestType: 'portfolio' | 'entity' | 'recommendation' | 'question';
  entityType?: string;
  entityId?: string;
  question?: string;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  responseTimeMs: number;
  success: boolean;
  errorMessage?: string;
}

// =============================================================================
// CONTEXT BUILDERS
// =============================================================================

/**
 * Build context for a specific property entity
 */
export function buildPropertyContext(
  property: any,
  linkedLoans: any[],
  financialContext: FinancialContext
): EntityContext {
  const propertyEquity = (property.currentValue || property.estimatedValue || 0) -
    linkedLoans.reduce((sum: number, l: any) => sum + (l.currentBalance || l.balance || 0), 0);

  const monthlyRentalIncome = property.rentalIncome || property.monthlyRent || 0;
  const monthlyLoanPayments = linkedLoans.reduce(
    (sum: number, l: any) => sum + (l.monthlyPayment || l.repayment || 0), 0
  );
  const netCashflow = monthlyRentalIncome - monthlyLoanPayments;

  return {
    entityType: 'property',
    entityId: property.id,
    entityName: property.name || property.address || 'Unnamed Property',
    entityDetails: {
      currentValue: property.currentValue || property.estimatedValue || 0,
      purchasePrice: property.purchasePrice || 0,
      purchaseDate: property.purchaseDate,
      propertyType: property.propertyType || property.type || 'RESIDENTIAL',
      isInvestment: property.isInvestmentProperty || property.purpose === 'INVESTMENT',
      equity: propertyEquity,
      lvr: property.currentValue ?
        ((property.currentValue - propertyEquity) / property.currentValue * 100).toFixed(1) : '0',
      rentalIncome: monthlyRentalIncome,
      rentalYield: property.currentValue && monthlyRentalIncome ?
        ((monthlyRentalIncome * 12) / property.currentValue * 100).toFixed(2) : '0',
      netCashflow: netCashflow,
      totalDebt: linkedLoans.reduce((sum: number, l: any) => sum + (l.currentBalance || l.balance || 0), 0),
      capitalGrowth: property.currentValue && property.purchasePrice ?
        ((property.currentValue - property.purchasePrice) / property.purchasePrice * 100).toFixed(2) : null,
    },
    relatedEntities: {
      loans: linkedLoans.map((l: any) => ({
        id: l.id,
        name: l.name || l.lender || 'Unnamed Loan',
        balance: l.currentBalance || l.balance || 0,
        interestRate: l.interestRate || 0,
        monthlyPayment: l.monthlyPayment || l.repayment || 0,
        type: l.loanType || l.type || 'MORTGAGE',
        remainingTermYears: l.remainingTermMonths ? l.remainingTermMonths / 12 : undefined,
      })),
    },
    financialContext,
  };
}

/**
 * Build context for a specific loan entity
 */
export function buildLoanContext(
  loan: any,
  linkedProperty: any | null,
  financialContext: FinancialContext
): EntityContext {
  const totalInterestPayable = calculateTotalInterest(
    loan.currentBalance || loan.balance || 0,
    loan.interestRate || 0,
    loan.remainingTermMonths || 0
  );

  return {
    entityType: 'loan',
    entityId: loan.id,
    entityName: loan.name || loan.lender || 'Unnamed Loan',
    entityDetails: {
      currentBalance: loan.currentBalance || loan.balance || 0,
      originalAmount: loan.originalAmount || loan.principalAmount || 0,
      interestRate: loan.interestRate || 0,
      monthlyPayment: loan.monthlyPayment || loan.repayment || 0,
      loanType: loan.loanType || loan.type || 'MORTGAGE',
      remainingTermMonths: loan.remainingTermMonths,
      remainingTermYears: loan.remainingTermMonths ? (loan.remainingTermMonths / 12).toFixed(1) : null,
      totalInterestPayable,
      lender: loan.lender,
      fixedOrVariable: loan.fixedOrVariable || loan.rateType || 'VARIABLE',
      offsetBalance: loan.offsetBalance || 0,
      redrawAvailable: loan.redrawAvailable || 0,
      isInterestOnly: loan.isInterestOnly || false,
      features: loan.features || [],
    },
    relatedEntities: {
      properties: linkedProperty ? [{
        id: linkedProperty.id,
        name: linkedProperty.name || linkedProperty.address || 'Unnamed Property',
        value: linkedProperty.currentValue || linkedProperty.estimatedValue || 0,
        equity: (linkedProperty.currentValue || 0) - (loan.currentBalance || loan.balance || 0),
        type: linkedProperty.propertyType || 'RESIDENTIAL',
        rentalIncome: linkedProperty.rentalIncome || 0,
        isInvestment: linkedProperty.isInvestmentProperty || false,
      }] : [],
    },
    financialContext,
  };
}

/**
 * Build context for a specific investment entity
 */
export function buildInvestmentContext(
  investment: any,
  financialContext: FinancialContext
): EntityContext {
  const gain = (investment.currentValue || 0) - (investment.purchasePrice || investment.costBasis || 0);
  const gainPercent = investment.purchasePrice ? (gain / investment.purchasePrice * 100) : 0;

  return {
    entityType: 'investment',
    entityId: investment.id,
    entityName: investment.name || investment.symbol || 'Unnamed Investment',
    entityDetails: {
      currentValue: investment.currentValue || investment.value || 0,
      purchasePrice: investment.purchasePrice || investment.costBasis || 0,
      quantity: investment.quantity || investment.units || 0,
      symbol: investment.symbol,
      investmentType: investment.type || investment.assetClass || 'OTHER',
      allocation: investment.allocation,
      totalGain: gain,
      gainPercent: gainPercent.toFixed(2),
      performance: investment.performance || investment.returnRate,
      dividendYield: investment.dividendYield,
      lastUpdated: investment.lastUpdated || investment.updatedAt,
      sector: investment.sector,
      marketCap: investment.marketCap,
    },
    relatedEntities: {},
    financialContext,
  };
}

// =============================================================================
// PROMPT BUILDERS
// =============================================================================

/**
 * Build entity-specific prompt for AI
 */
export function buildEntityPrompt(context: EntityContext): string {
  const { entityType, entityName, entityDetails, relatedEntities, financialContext } = context;

  let prompt = `
ENTITY ANALYSIS: ${entityName.toUpperCase()}
Entity Type: ${entityType.charAt(0).toUpperCase() + entityType.slice(1)}
============================================

`;

  if (entityType === 'property') {
    prompt += buildPropertyPromptSection(entityDetails, relatedEntities.loans || []);
  } else if (entityType === 'loan') {
    prompt += buildLoanPromptSection(entityDetails, relatedEntities.properties || []);
  } else if (entityType === 'investment') {
    prompt += buildInvestmentPromptSection(entityDetails);
  }

  // Add portfolio context summary
  prompt += `

PORTFOLIO CONTEXT
=================
Total Net Worth: ${formatCurrencyForPrompt(financialContext.netWorth)}
Total Assets: ${formatCurrencyForPrompt(financialContext.totalAssets)}
Total Debt: ${formatCurrencyForPrompt(financialContext.totalDebt)}
Monthly Surplus: ${formatCurrencyForPrompt(financialContext.monthlySurplus)}
Risk Appetite: ${financialContext.riskAppetite || 'Not specified'}

`;

  return prompt;
}

function buildPropertyPromptSection(details: Record<string, any>, loans: LoanSummary[]): string {
  let section = `
PROPERTY DETAILS
----------------
Current Value: ${formatCurrencyForPrompt(details.currentValue)}
Purchase Price: ${details.purchasePrice ? formatCurrencyForPrompt(details.purchasePrice) : 'Not recorded'}
Property Type: ${details.propertyType}
Purpose: ${details.isInvestment ? 'Investment Property' : 'Owner-Occupied'}

EQUITY & LEVERAGE
-----------------
Current Equity: ${formatCurrencyForPrompt(details.equity)}
LVR (Loan-to-Value): ${details.lvr}%
Total Secured Debt: ${formatCurrencyForPrompt(details.totalDebt)}
${details.capitalGrowth ? `Capital Growth: ${details.capitalGrowth}%` : ''}

`;

  if (details.isInvestment) {
    section += `
RENTAL PERFORMANCE
------------------
Monthly Rent: ${formatCurrencyForPrompt(details.rentalIncome)}
Gross Yield: ${details.rentalYield}%
Net Monthly Cashflow: ${formatCurrencyForPrompt(details.netCashflow)}

`;
  }

  if (loans.length > 0) {
    section += `
LINKED LOANS
------------
`;
    loans.forEach((loan, i) => {
      section += `${i + 1}. ${loan.name}
   Balance: ${formatCurrencyForPrompt(loan.balance)}
   Rate: ${formatPercentageForPrompt(loan.interestRate)}
   Payment: ${formatCurrencyForPrompt(loan.monthlyPayment)}/month
`;
    });
  }

  return section;
}

function buildLoanPromptSection(details: Record<string, any>, properties: PropertySummary[]): string {
  let section = `
LOAN DETAILS
------------
Current Balance: ${formatCurrencyForPrompt(details.currentBalance)}
Original Amount: ${details.originalAmount ? formatCurrencyForPrompt(details.originalAmount) : 'Not recorded'}
Interest Rate: ${formatPercentageForPrompt(details.interestRate)}
Rate Type: ${details.fixedOrVariable}
Monthly Payment: ${formatCurrencyForPrompt(details.monthlyPayment)}
Lender: ${details.lender || 'Not specified'}

LOAN TERM
---------
Remaining Term: ${details.remainingTermYears ? `${details.remainingTermYears} years` : 'Not specified'}
Total Interest Payable: ${formatCurrencyForPrompt(details.totalInterestPayable)}
Interest Only: ${details.isInterestOnly ? 'Yes' : 'No'}

FEATURES & BALANCES
-------------------
Offset Balance: ${formatCurrencyForPrompt(details.offsetBalance)}
Redraw Available: ${formatCurrencyForPrompt(details.redrawAvailable)}
Features: ${details.features?.length > 0 ? details.features.join(', ') : 'Standard'}

`;

  if (properties.length > 0) {
    section += `
SECURED PROPERTY
----------------
`;
    properties.forEach((prop) => {
      section += `${prop.name}
   Value: ${formatCurrencyForPrompt(prop.value)}
   Type: ${prop.type}
   Purpose: ${prop.isInvestment ? 'Investment' : 'Owner-Occupied'}
`;
    });
  }

  return section;
}

function buildInvestmentPromptSection(details: Record<string, any>): string {
  return `
INVESTMENT DETAILS
------------------
Current Value: ${formatCurrencyForPrompt(details.currentValue)}
Cost Basis: ${details.purchasePrice ? formatCurrencyForPrompt(details.purchasePrice) : 'Not recorded'}
Quantity/Units: ${details.quantity || 'N/A'}
Symbol: ${details.symbol || 'N/A'}
Type: ${details.investmentType}
Sector: ${details.sector || 'Not specified'}

PERFORMANCE
-----------
Total Return: ${formatCurrencyForPrompt(details.totalGain)} (${details.gainPercent}%)
${details.performance ? `Annual Performance: ${formatPercentageForPrompt(details.performance)}` : ''}
${details.dividendYield ? `Dividend Yield: ${formatPercentageForPrompt(details.dividendYield)}` : ''}

ALLOCATION
----------
Portfolio Allocation: ${details.allocation || 'Not specified'}

`;
}

// =============================================================================
// LOGGING UTILITIES
// =============================================================================

/**
 * Log AI request for analytics and debugging
 */
export function logAIRequest(log: AIRequestLog): void {
  const logEntry = {
    ...log,
    timestamp: log.timestamp.toISOString(),
  };

  // Console logging for development
  console.log(`[AI Request] ${log.requestType}${log.entityType ? ` - ${log.entityType}` : ''}`);
  console.log(`[AI Request] Tokens: ${log.tokenUsage.totalTokens}, Time: ${log.responseTimeMs}ms`);

  if (!log.success) {
    console.error(`[AI Request] Error: ${log.errorMessage}`);
  }

  // In production, this would write to a database or analytics service
  // For now, we'll emit a custom event that can be captured
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ai-request-logged', { detail: logEntry }));
  }
}

/**
 * Create a new AI request log entry
 */
export function createRequestLog(
  userId: string,
  requestType: AIRequestLog['requestType'],
  options?: {
    entityType?: string;
    entityId?: string;
    question?: string;
  }
): Omit<AIRequestLog, 'tokenUsage' | 'responseTimeMs' | 'success' | 'errorMessage'> {
  return {
    id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    userId,
    requestType,
    entityType: options?.entityType,
    entityId: options?.entityId,
    question: options?.question,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate total interest payable over remaining term
 */
function calculateTotalInterest(
  balance: number,
  annualRate: number,
  remainingMonths: number
): number {
  if (!balance || !annualRate || !remainingMonths) return 0;

  const monthlyRate = annualRate / 100 / 12;
  const monthlyPayment = (balance * monthlyRate * Math.pow(1 + monthlyRate, remainingMonths)) /
    (Math.pow(1 + monthlyRate, remainingMonths) - 1);

  const totalPayments = monthlyPayment * remainingMonths;
  return Math.max(0, totalPayments - balance);
}
