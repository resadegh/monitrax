/**
 * Monitrax Portfolio Intelligence Engine
 * Phase 4 - Comprehensive Portfolio Analytics
 *
 * Aggregates all financial data to compute:
 * - Net worth
 * - Cashflow analysis
 * - Gearing analysis
 * - Risk analysis
 */

// =============================================================================
// TYPES
// =============================================================================

export interface PortfolioInput {
  // Properties
  properties: PropertyInput[];
  // Loans
  loans: LoanInput[];
  // Bank accounts
  accounts: AccountInput[];
  // Income
  income: IncomeInput[];
  // Expenses
  expenses: ExpenseInput[];
  // Investments
  investments: InvestmentInput[];
}

export interface PropertyInput {
  id: string;
  name: string;
  type: 'HOME' | 'INVESTMENT';
  currentValue: number;
  purchasePrice: number;
  purchaseDate: Date;
}

export interface LoanInput {
  id: string;
  name: string;
  type: 'HOME' | 'INVESTMENT';
  principal: number;
  interestRate: number;
  isInterestOnly: boolean;
  propertyId?: string;
  offsetBalance?: number;
}

export interface AccountInput {
  id: string;
  name: string;
  type: 'OFFSET' | 'SAVINGS' | 'TRANSACTIONAL' | 'CREDIT_CARD';
  currentBalance: number;
}

export interface IncomeInput {
  id: string;
  name: string;
  type: 'SALARY' | 'RENT' | 'INVESTMENT' | 'OTHER';
  amount: number;
  frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'ANNUAL';
  isTaxable: boolean;
  propertyId?: string;
}

export interface ExpenseInput {
  id: string;
  name: string;
  amount: number;
  frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'ANNUAL';
  isEssential: boolean;
  isTaxDeductible: boolean;
  propertyId?: string;
}

export interface InvestmentInput {
  id: string;
  ticker: string;
  units: number;
  averagePrice: number;
  currentPrice: number;
  type: 'SHARE' | 'ETF' | 'MANAGED_FUND' | 'CRYPTO';
}

// =============================================================================
// OUTPUT TYPES
// =============================================================================

export interface PortfolioIntelligence {
  timestamp: Date;
  netWorth: NetWorthAnalysis;
  cashflow: CashflowAnalysis;
  gearing: GearingAnalysis;
  risk: RiskAnalysis;
  propertyAnalysis: PropertyAnalysis[];
  investmentAnalysis: InvestmentAnalysisResult;
}

export interface NetWorthAnalysis {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  assetBreakdown: {
    properties: number;
    investments: number;
    cash: number;
    other: number;
  };
  liabilityBreakdown: {
    mortgages: number;
    creditCards: number;
    other: number;
  };
}

export interface CashflowAnalysis {
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlySurplus: number;
  annualIncome: number;
  annualExpenses: number;
  annualSurplus: number;
  incomeByType: Record<string, number>;
  expenseByCategory: Record<string, number>;
  savingsRate: number;
}

export interface GearingAnalysis {
  totalDebt: number;
  totalAssets: number;
  debtToAssetRatio: number;
  debtToIncomeRatio: number;
  portfolioLVR: number;
  propertyLVRs: Array<{ propertyId: string; propertyName: string; lvr: number }>;
  interestCoverageRatio: number;
  negativeGearingBenefit: number;
}

export interface RiskAnalysis {
  concentrationRisk: ConcentrationRisk;
  liquidityRisk: LiquidityRisk;
  debtStressTest: DebtStressTest;
  overallRiskScore: number; // 1-10
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';
}

export interface ConcentrationRisk {
  propertyConcentration: number;
  investmentConcentration: number;
  singleAssetRisk: boolean;
  topAssetPercentage: number;
  diversificationScore: number;
}

export interface LiquidityRisk {
  liquidAssets: number;
  monthlyExpenses: number;
  monthsOfExpensesCovered: number;
  liquidityScore: number;
}

export interface DebtStressTest {
  currentMonthlyRepayments: number;
  repaymentAtPlus2Percent: number;
  repaymentAtPlus3Percent: number;
  repaymentAtPlus4Percent: number;
  surplusAtPlus2Percent: number;
  surplusAtPlus3Percent: number;
  surplusAtPlus4Percent: number;
  canSurvive2PercentRise: boolean;
  canSurvive3PercentRise: boolean;
  canSurvive4PercentRise: boolean;
}

export interface PropertyAnalysis {
  propertyId: string;
  propertyName: string;
  currentValue: number;
  equity: number;
  lvr: number;
  rentalYield: number;
  cashflowPositive: boolean;
  monthlyProfit: number;
  annualDepreciation: number;
  negativeGearingBenefit: number;
}

export interface InvestmentAnalysisResult {
  totalValue: number;
  totalCostBase: number;
  unrealisedGain: number;
  unrealisedGainPercent: number;
  byType: Record<string, { value: number; percentage: number }>;
}

// =============================================================================
// FREQUENCY NORMALISATION
// =============================================================================

/**
 * Convert amount to monthly equivalent.
 */
export function toMonthly(amount: number, frequency: string): number {
  switch (frequency) {
    case 'WEEKLY':
      return amount * 52 / 12;
    case 'FORTNIGHTLY':
      return amount * 26 / 12;
    case 'MONTHLY':
      return amount;
    case 'ANNUAL':
      return amount / 12;
    default:
      return amount;
  }
}

/**
 * Convert amount to annual equivalent.
 */
export function toAnnual(amount: number, frequency: string): number {
  switch (frequency) {
    case 'WEEKLY':
      return amount * 52;
    case 'FORTNIGHTLY':
      return amount * 26;
    case 'MONTHLY':
      return amount * 12;
    case 'ANNUAL':
      return amount;
    default:
      return amount * 12;
  }
}

// =============================================================================
// NET WORTH CALCULATION
// =============================================================================

/**
 * Calculate net worth analysis.
 */
export function calculateNetWorth(input: PortfolioInput): NetWorthAnalysis {
  // Assets
  const propertyValue = input.properties.reduce((sum, p) => sum + p.currentValue, 0);
  const investmentValue = input.investments.reduce((sum, i) => sum + i.units * i.currentPrice, 0);
  const cashValue = input.accounts
    .filter(a => a.type !== 'CREDIT_CARD')
    .reduce((sum, a) => sum + a.currentBalance, 0);

  const totalAssets = propertyValue + investmentValue + cashValue;

  // Liabilities
  const mortgageDebt = input.loans.reduce((sum, l) => sum + l.principal, 0);
  const creditCardDebt = input.accounts
    .filter(a => a.type === 'CREDIT_CARD')
    .reduce((sum, a) => sum + Math.abs(a.currentBalance), 0);

  const totalLiabilities = mortgageDebt + creditCardDebt;

  return {
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
    assetBreakdown: {
      properties: propertyValue,
      investments: investmentValue,
      cash: cashValue,
      other: 0
    },
    liabilityBreakdown: {
      mortgages: mortgageDebt,
      creditCards: creditCardDebt,
      other: 0
    }
  };
}

// =============================================================================
// CASHFLOW ANALYSIS
// =============================================================================

/**
 * Calculate cashflow analysis.
 */
export function calculateCashflow(input: PortfolioInput): CashflowAnalysis {
  // Income
  let monthlyIncome = 0;
  const incomeByType: Record<string, number> = {};

  for (const inc of input.income) {
    const monthly = toMonthly(inc.amount, inc.frequency);
    monthlyIncome += monthly;
    incomeByType[inc.type] = (incomeByType[inc.type] || 0) + monthly;
  }

  // Expenses
  let monthlyExpenses = 0;
  const expenseByCategory: Record<string, number> = {};

  for (const exp of input.expenses) {
    const monthly = toMonthly(exp.amount, exp.frequency);
    monthlyExpenses += monthly;
    expenseByCategory[exp.name] = monthly;
  }

  // Add loan repayments to expenses (simplified - interest only for this calc)
  for (const loan of input.loans) {
    const effectivePrincipal = Math.max(0, loan.principal - (loan.offsetBalance || 0));
    const monthlyInterest = effectivePrincipal * (loan.interestRate / 12);
    monthlyExpenses += monthlyInterest;
    expenseByCategory['Loan Interest'] = (expenseByCategory['Loan Interest'] || 0) + monthlyInterest;
  }

  const monthlySurplus = monthlyIncome - monthlyExpenses;
  const savingsRate = monthlyIncome > 0 ? (monthlySurplus / monthlyIncome) * 100 : 0;

  return {
    monthlyIncome,
    monthlyExpenses,
    monthlySurplus,
    annualIncome: monthlyIncome * 12,
    annualExpenses: monthlyExpenses * 12,
    annualSurplus: monthlySurplus * 12,
    incomeByType,
    expenseByCategory,
    savingsRate
  };
}

// =============================================================================
// GEARING ANALYSIS
// =============================================================================

/**
 * Calculate gearing analysis.
 */
export function calculateGearing(input: PortfolioInput): GearingAnalysis {
  const netWorth = calculateNetWorth(input);
  const cashflow = calculateCashflow(input);

  const totalDebt = netWorth.liabilityBreakdown.mortgages + netWorth.liabilityBreakdown.creditCards;
  const totalAssets = netWorth.totalAssets;

  // Debt ratios
  const debtToAssetRatio = totalAssets > 0 ? totalDebt / totalAssets : 0;
  const debtToIncomeRatio = cashflow.annualIncome > 0 ? totalDebt / cashflow.annualIncome : 0;

  // Property LVRs
  const propertyLVRs: Array<{ propertyId: string; propertyName: string; lvr: number }> = [];
  let totalPropertyValue = 0;
  let totalPropertyDebt = 0;

  for (const property of input.properties) {
    const propertyLoans = input.loans.filter(l => l.propertyId === property.id);
    const propertyDebt = propertyLoans.reduce((sum, l) => sum + l.principal, 0);

    totalPropertyValue += property.currentValue;
    totalPropertyDebt += propertyDebt;

    const lvr = property.currentValue > 0 ? (propertyDebt / property.currentValue) * 100 : 0;
    propertyLVRs.push({
      propertyId: property.id,
      propertyName: property.name,
      lvr
    });
  }

  const portfolioLVR = totalPropertyValue > 0 ? (totalPropertyDebt / totalPropertyValue) * 100 : 0;

  // Interest coverage
  const totalAnnualInterest = input.loans.reduce((sum, l) => {
    const effectivePrincipal = Math.max(0, l.principal - (l.offsetBalance || 0));
    return sum + effectivePrincipal * l.interestRate;
  }, 0);

  const interestCoverageRatio = totalAnnualInterest > 0
    ? cashflow.annualIncome / totalAnnualInterest
    : 999;

  // Negative gearing benefit (simplified)
  const investmentPropertyIncome = input.income
    .filter(i => i.propertyId && i.type === 'RENT')
    .reduce((sum, i) => sum + toAnnual(i.amount, i.frequency), 0);

  const investmentPropertyExpenses = input.expenses
    .filter(e => e.propertyId)
    .reduce((sum, e) => sum + toAnnual(e.amount, e.frequency), 0);

  const investmentLoanInterest = input.loans
    .filter(l => l.type === 'INVESTMENT')
    .reduce((sum, l) => {
      const effectivePrincipal = Math.max(0, l.principal - (l.offsetBalance || 0));
      return sum + effectivePrincipal * l.interestRate;
    }, 0);

  const negativeGearingBenefit = Math.max(0,
    investmentPropertyExpenses + investmentLoanInterest - investmentPropertyIncome
  );

  return {
    totalDebt,
    totalAssets,
    debtToAssetRatio,
    debtToIncomeRatio,
    portfolioLVR,
    propertyLVRs,
    interestCoverageRatio,
    negativeGearingBenefit
  };
}

// =============================================================================
// RISK ANALYSIS
// =============================================================================

/**
 * Calculate risk analysis.
 */
export function calculateRisk(input: PortfolioInput): RiskAnalysis {
  const netWorth = calculateNetWorth(input);
  const cashflow = calculateCashflow(input);

  // Concentration risk
  const totalAssets = netWorth.totalAssets;
  const propertyConcentration = totalAssets > 0
    ? (netWorth.assetBreakdown.properties / totalAssets) * 100
    : 0;
  const investmentConcentration = totalAssets > 0
    ? (netWorth.assetBreakdown.investments / totalAssets) * 100
    : 0;

  const assetValues = [
    ...input.properties.map(p => p.currentValue),
    ...input.investments.map(i => i.units * i.currentPrice)
  ].sort((a, b) => b - a);

  const topAssetPercentage = totalAssets > 0 && assetValues.length > 0
    ? (assetValues[0] / totalAssets) * 100
    : 0;

  const singleAssetRisk = topAssetPercentage > 50;
  const diversificationScore = Math.min(100, (assetValues.length * 10) + (100 - topAssetPercentage));

  const concentrationRisk: ConcentrationRisk = {
    propertyConcentration,
    investmentConcentration,
    singleAssetRisk,
    topAssetPercentage,
    diversificationScore
  };

  // Liquidity risk
  const liquidAssets = netWorth.assetBreakdown.cash +
    input.investments
      .filter(i => i.type === 'SHARE' || i.type === 'ETF')
      .reduce((sum, i) => sum + i.units * i.currentPrice, 0);

  const monthsOfExpensesCovered = cashflow.monthlyExpenses > 0
    ? liquidAssets / cashflow.monthlyExpenses
    : 999;

  const liquidityScore = Math.min(100, monthsOfExpensesCovered * 10);

  const liquidityRisk: LiquidityRisk = {
    liquidAssets,
    monthlyExpenses: cashflow.monthlyExpenses,
    monthsOfExpensesCovered,
    liquidityScore
  };

  // Debt stress test
  const debtStressTest = calculateDebtStressTest(input, cashflow);

  // Overall risk score
  let riskScore = 5; // Start at moderate

  // Adjust for concentration
  if (singleAssetRisk) riskScore += 1;
  if (propertyConcentration > 80) riskScore += 1;

  // Adjust for liquidity
  if (monthsOfExpensesCovered < 3) riskScore += 2;
  else if (monthsOfExpensesCovered < 6) riskScore += 1;

  // Adjust for debt stress
  if (!debtStressTest.canSurvive2PercentRise) riskScore += 2;
  else if (!debtStressTest.canSurvive3PercentRise) riskScore += 1;

  riskScore = Math.min(10, Math.max(1, riskScore));

  let riskLevel: RiskAnalysis['riskLevel'];
  if (riskScore <= 3) riskLevel = 'LOW';
  else if (riskScore <= 5) riskLevel = 'MODERATE';
  else if (riskScore <= 7) riskLevel = 'HIGH';
  else riskLevel = 'VERY_HIGH';

  return {
    concentrationRisk,
    liquidityRisk,
    debtStressTest,
    overallRiskScore: riskScore,
    riskLevel
  };
}

/**
 * Calculate debt stress test at different rate scenarios.
 */
function calculateDebtStressTest(input: PortfolioInput, cashflow: CashflowAnalysis): DebtStressTest {
  const currentRepayments = input.loans.reduce((sum, l) => {
    const effectivePrincipal = Math.max(0, l.principal - (l.offsetBalance || 0));
    return sum + effectivePrincipal * (l.interestRate / 12);
  }, 0);

  const calculateRepaymentsAtRate = (rateIncrease: number) => {
    return input.loans.reduce((sum, l) => {
      const effectivePrincipal = Math.max(0, l.principal - (l.offsetBalance || 0));
      return sum + effectivePrincipal * ((l.interestRate + rateIncrease) / 12);
    }, 0);
  };

  const repaymentAtPlus2 = calculateRepaymentsAtRate(0.02);
  const repaymentAtPlus3 = calculateRepaymentsAtRate(0.03);
  const repaymentAtPlus4 = calculateRepaymentsAtRate(0.04);

  const baseExpensesExcludingLoans = cashflow.monthlyExpenses - currentRepayments;

  return {
    currentMonthlyRepayments: currentRepayments,
    repaymentAtPlus2Percent: repaymentAtPlus2,
    repaymentAtPlus3Percent: repaymentAtPlus3,
    repaymentAtPlus4Percent: repaymentAtPlus4,
    surplusAtPlus2Percent: cashflow.monthlyIncome - baseExpensesExcludingLoans - repaymentAtPlus2,
    surplusAtPlus3Percent: cashflow.monthlyIncome - baseExpensesExcludingLoans - repaymentAtPlus3,
    surplusAtPlus4Percent: cashflow.monthlyIncome - baseExpensesExcludingLoans - repaymentAtPlus4,
    canSurvive2PercentRise: (cashflow.monthlyIncome - baseExpensesExcludingLoans - repaymentAtPlus2) > 0,
    canSurvive3PercentRise: (cashflow.monthlyIncome - baseExpensesExcludingLoans - repaymentAtPlus3) > 0,
    canSurvive4PercentRise: (cashflow.monthlyIncome - baseExpensesExcludingLoans - repaymentAtPlus4) > 0
  };
}

// =============================================================================
// DATABASE WRAPPER
// =============================================================================

/**
 * Generate portfolio snapshot from database for a user
 */
export async function generatePortfolioSnapshot(userId: string) {
  // Import prisma dynamically to avoid circular dependencies
  const { default: prisma } = await import('@/lib/db');

  // Fetch all user's financial data
  const [properties, loans, accounts, income, expenses, investments] = await Promise.all([
    prisma.property.findMany({ where: { userId } }),
    prisma.loan.findMany({ where: { userId } }),
    prisma.bankAccount.findMany({ where: { userId } }),
    prisma.income.findMany({ where: { userId } }),
    prisma.expense.findMany({ where: { userId } }),
    prisma.investment.findMany({ where: { userId } }),
  ]);

  // Transform to PortfolioInput format
  const portfolioInput: PortfolioInput = {
    properties: properties.map(p => ({
      id: p.id,
      name: p.address || p.id,
      type: p.propertyType === 'INVESTMENT' ? 'INVESTMENT' : 'HOME',
      currentValue: Number(p.currentValue || 0),
      purchasePrice: Number(p.purchasePrice || 0),
      purchaseDate: p.purchaseDate || new Date(),
    })),
    loans: loans.map(l => ({
      id: l.id,
      name: l.lender || l.id,
      type: l.loanType === 'INVESTMENT' ? 'INVESTMENT' : 'HOME',
      principal: Number(l.currentBalance || 0),
      interestRate: Number(l.interestRate || 0) / 100,
      isInterestOnly: l.isInterestOnly || false,
      propertyId: l.propertyId || undefined,
      offsetBalance: l.offsetBalance ? Number(l.offsetBalance) : undefined,
    })),
    accounts: accounts.map(a => ({
      id: a.id,
      name: a.accountName || a.id,
      type: (a.accountType as any) || 'TRANSACTIONAL',
      currentBalance: Number(a.currentBalance || 0),
    })),
    income: income.map(i => ({
      id: i.id,
      name: i.source || i.id,
      type: (i.incomeType as any) || 'OTHER',
      amount: Number(i.amount || 0),
      frequency: (i.frequency as any) || 'MONTHLY',
      isTaxable: true,
      propertyId: i.propertyId || undefined,
    })),
    expenses: expenses.map(e => ({
      id: e.id,
      name: e.category || e.id,
      amount: Number(e.amount || 0),
      frequency: (e.frequency as any) || 'MONTHLY',
      isEssential: true,
      isTaxDeductible: false,
      propertyId: e.propertyId || undefined,
    })),
    investments: investments.map(inv => ({
      id: inv.id,
      ticker: inv.ticker || inv.id,
      units: Number(inv.units || 0),
      averagePrice: Number(inv.averagePrice || 0),
      currentPrice: Number(inv.currentPrice || 0),
      type: (inv.investmentType as any) || 'SHARE',
    })),
  };

  // Generate intelligence
  const intelligence = generatePortfolioIntelligence(portfolioInput);

  // Return in expected format for dataCollector
  return {
    summary: {
      totalNetWorth: intelligence.netWorth.netWorth,
      totalAssets: intelligence.netWorth.totalAssets,
      totalLiabilities: intelligence.netWorth.totalLiabilities,
    },
    properties: intelligence.propertyAnalysis,
    loans: portfolioInput.loans,
    investments: [intelligence.investmentAnalysis],
    cashflow: intelligence.cashflow,
    trends: {
      netWorth: [],
      cashflow: [],
    },
  };
}

// =============================================================================
// MAIN ENGINE
// =============================================================================

/**
 * Generate complete portfolio intelligence report.
 */
export function generatePortfolioIntelligence(input: PortfolioInput): PortfolioIntelligence {
  const netWorth = calculateNetWorth(input);
  const cashflow = calculateCashflow(input);
  const gearing = calculateGearing(input);
  const risk = calculateRisk(input);

  // Property analysis
  const propertyAnalysis: PropertyAnalysis[] = input.properties.map(property => {
    const propertyLoans = input.loans.filter(l => l.propertyId === property.id);
    const propertyDebt = propertyLoans.reduce((sum, l) => sum + l.principal, 0);
    const equity = property.currentValue - propertyDebt;
    const lvr = property.currentValue > 0 ? (propertyDebt / property.currentValue) * 100 : 0;

    const propertyIncome = input.income
      .filter(i => i.propertyId === property.id)
      .reduce((sum, i) => sum + toAnnual(i.amount, i.frequency), 0);

    const propertyExpenses = input.expenses
      .filter(e => e.propertyId === property.id)
      .reduce((sum, e) => sum + toAnnual(e.amount, e.frequency), 0);

    const loanInterest = propertyLoans.reduce((sum, l) => {
      const effectivePrincipal = Math.max(0, l.principal - (l.offsetBalance || 0));
      return sum + effectivePrincipal * l.interestRate;
    }, 0);

    const annualProfit = propertyIncome - propertyExpenses - loanInterest;
    const rentalYield = property.currentValue > 0 ? (propertyIncome / property.currentValue) * 100 : 0;

    return {
      propertyId: property.id,
      propertyName: property.name,
      currentValue: property.currentValue,
      equity,
      lvr,
      rentalYield,
      cashflowPositive: annualProfit > 0,
      monthlyProfit: annualProfit / 12,
      annualDepreciation: 0, // Would need depreciation schedule
      negativeGearingBenefit: Math.max(0, -annualProfit)
    };
  });

  // Investment analysis
  const totalInvestmentValue = input.investments.reduce((sum, i) => sum + i.units * i.currentPrice, 0);
  const totalCostBase = input.investments.reduce((sum, i) => sum + i.units * i.averagePrice, 0);

  const byType: Record<string, { value: number; percentage: number }> = {};
  for (const inv of input.investments) {
    const value = inv.units * inv.currentPrice;
    if (!byType[inv.type]) {
      byType[inv.type] = { value: 0, percentage: 0 };
    }
    byType[inv.type].value += value;
  }
  for (const type of Object.keys(byType)) {
    byType[type].percentage = totalInvestmentValue > 0
      ? (byType[type].value / totalInvestmentValue) * 100
      : 0;
  }

  const investmentAnalysis: InvestmentAnalysisResult = {
    totalValue: totalInvestmentValue,
    totalCostBase,
    unrealisedGain: totalInvestmentValue - totalCostBase,
    unrealisedGainPercent: totalCostBase > 0
      ? ((totalInvestmentValue - totalCostBase) / totalCostBase) * 100
      : 0,
    byType
  };

  return {
    timestamp: new Date(),
    netWorth,
    cashflow,
    gearing,
    risk,
    propertyAnalysis,
    investmentAnalysis
  };
}
