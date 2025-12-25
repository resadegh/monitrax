/**
 * TESTING FRAMEWORK TYPES
 * Defines input/output structures for automated testing and external verification
 *
 * @module lib/testing/types
 */

// =============================================================================
// INPUT TYPES - What external tools provide to load test data
// =============================================================================

/**
 * Property input for test scenarios
 */
export interface TestPropertyInput {
  name: string;
  type: 'HOME' | 'INVESTMENT';
  address?: string;
  purchasePrice: number;
  purchaseDate: string; // ISO date
  currentValue: number;
  valuationDate?: string; // ISO date
  // Location (optional)
  latitude?: number;
  longitude?: number;
  suburb?: string;
  state?: string;
  postcode?: string;
}

/**
 * Loan input for test scenarios
 */
export interface TestLoanInput {
  name: string;
  lender?: string;
  type: 'HOME' | 'INVESTMENT';
  principal: number;
  interestRateAnnual: number; // e.g., 0.0625 for 6.25%
  rateType: 'VARIABLE' | 'FIXED';
  isInterestOnly: boolean;
  termMonthsRemaining: number;
  minRepayment: number;
  repaymentFrequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY';
  fixedExpiry?: string; // ISO date (required if rateType is FIXED)
  extraRepaymentCap?: number;
  // Links (by reference key, resolved during load)
  propertyRef?: string; // Reference to property by name
  offsetAccountRef?: string; // Reference to account by name
}

/**
 * Account input for test scenarios
 */
export interface TestAccountInput {
  name: string;
  type: 'OFFSET' | 'SAVINGS' | 'TRANSACTIONAL' | 'CREDIT_CARD';
  institution?: string;
  currentBalance: number;
  interestRate?: number; // Annual rate
}

/**
 * Income input for test scenarios
 */
export interface TestIncomeInput {
  name: string;
  type: 'SALARY' | 'RENT' | 'RENTAL' | 'INVESTMENT' | 'OTHER';
  sourceType?: 'GENERAL' | 'PROPERTY' | 'INVESTMENT';
  amount: number;
  frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  isTaxable?: boolean;
  // Salary-specific fields
  salaryType?: 'GROSS' | 'NET';
  superGuaranteeRate?: number; // e.g., 0.115 for 11.5%
  salarySacrifice?: number;
  // Investment income fields
  frankingPercentage?: number; // 0-100
  // Links
  propertyRef?: string;
  investmentAccountRef?: string;
  // Dates
  startDate?: string;
  endDate?: string;
}

/**
 * Expense input for test scenarios
 */
export interface TestExpenseInput {
  name: string;
  vendorName?: string;
  category:
    | 'HOUSING' | 'RENT' | 'RATES' | 'INSURANCE' | 'MAINTENANCE'
    | 'PERSONAL' | 'UTILITIES' | 'FOOD' | 'TRANSPORT'
    | 'ENTERTAINMENT' | 'SUBSCRIPTION' | 'STRATA'
    | 'LAND_TAX' | 'LOAN_INTEREST' | 'REGISTRATION'
    | 'MODIFICATIONS' | 'OTHER';
  sourceType?: 'GENERAL' | 'PROPERTY' | 'LOAN' | 'INVESTMENT' | 'ASSET';
  amount: number;
  frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  isEssential?: boolean;
  isTaxDeductible?: boolean;
  // Links
  propertyRef?: string;
  loanRef?: string;
  investmentAccountRef?: string;
  assetRef?: string;
}

/**
 * Investment Account input for test scenarios
 */
export interface TestInvestmentAccountInput {
  name: string;
  type: 'BROKERAGE' | 'SUPERS' | 'FUND' | 'TRUST' | 'ETF_CRYPTO';
  platform?: string;
  currency?: string; // Default: AUD
  cashBalance?: number;
  openingBalance?: number;
  costBasisMethod?: 'FIFO' | 'LIFO' | 'HIFO' | 'SPECIFIC' | 'AVERAGE';
}

/**
 * Holding input for test scenarios
 */
export interface TestHoldingInput {
  ticker: string;
  name?: string;
  type: 'SHARE' | 'ETF' | 'MANAGED_FUND' | 'CRYPTO';
  units: number;
  averagePrice: number;
  currentPrice?: number;
  frankingPercentage?: number; // 0-100 for AU shares
  // Link
  investmentAccountRef: string;
}

/**
 * Investment Transaction input for test scenarios
 */
export interface TestInvestmentTransactionInput {
  type: 'BUY' | 'SELL' | 'DIVIDEND' | 'DISTRIBUTION' | 'DRP' | 'DEPOSIT' | 'WITHDRAWAL';
  date: string; // ISO date
  price: number;
  units: number;
  fees?: number;
  notes?: string;
  // Links
  investmentAccountRef: string;
  holdingRef?: string; // ticker symbol
}

/**
 * Depreciation Schedule input for test scenarios
 */
export interface TestDepreciationScheduleInput {
  assetName: string;
  category: 'DIV40' | 'DIV43';
  method: 'PRIME_COST' | 'DIMINISHING_VALUE';
  cost: number;
  rate: number; // e.g., 0.025 for 2.5%
  startDate: string; // ISO date
  notes?: string;
  // Link
  propertyRef: string;
}

/**
 * Complete test scenario input
 */
export interface TestScenarioInput {
  /** Unique scenario identifier */
  scenarioId: string;
  /** Human-readable scenario name */
  name: string;
  /** Description of what this scenario tests */
  description: string;
  /** Test user details */
  testUser: {
    email: string;
    name: string;
    password?: string;
  };
  /** All entities to load */
  data: {
    properties?: TestPropertyInput[];
    loans?: TestLoanInput[];
    accounts?: TestAccountInput[];
    income?: TestIncomeInput[];
    expenses?: TestExpenseInput[];
    investmentAccounts?: TestInvestmentAccountInput[];
    holdings?: TestHoldingInput[];
    investmentTransactions?: TestInvestmentTransactionInput[];
    depreciationSchedules?: TestDepreciationScheduleInput[];
  };
  /** Expected outputs for verification (optional) */
  expectedOutputs?: TestExpectedOutputs;
}

// =============================================================================
// OUTPUT TYPES - What the app calculates for external verification
// =============================================================================

/**
 * Net worth breakdown
 */
export interface NetWorthOutput {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  assetBreakdown: {
    properties: number;
    investments: number;
    accounts: number;
    personalAssets: number;
  };
  liabilityBreakdown: {
    loans: number;
    creditCards: number;
  };
}

/**
 * Cashflow analysis output
 */
export interface CashflowOutput {
  grossIncome: number;
  netIncome: number;
  paygWithholding: number;
  totalExpenses: number;
  totalLoanRepayments: number;
  monthlyNetCashflow: number;
  annualNetCashflow: number;
  savingsRate: number; // percentage
  incomeBreakdown: Record<string, number>;
  expenseBreakdown: Record<string, number>;
}

/**
 * Gearing metrics output
 */
export interface GearingOutput {
  portfolioLVR: number;
  debtToIncomeRatio: number;
  debtToAssetRatio: number;
  propertyLVRs: Array<{
    propertyName: string;
    lvr: number;
    equity: number;
  }>;
}

/**
 * Per-property calculated metrics
 */
export interface PropertyMetricsOutput {
  propertyId: string;
  propertyName: string;
  marketValue: number;
  totalLoans: number;
  equity: number;
  lvr: number;
  grossYield: number;
  netYield: number;
  annualIncome: number;
  annualExpenses: number;
  annualInterest: number;
  annualLoanRepayments: number;
  annualNetCashflow: number;
  monthlyNetCashflow: number;
  annualDepreciation: number;
}

/**
 * Per-loan calculated metrics
 */
export interface LoanMetricsOutput {
  loanId: string;
  loanName: string;
  principal: number;
  effectivePrincipal: number; // After offset
  interestRate: number;
  monthlyInterest: number;
  annualInterest: number;
  monthlyRepayment: number;
  annualRepayment: number;
  offsetBalance: number;
  interestSavedByOffset: number;
}

/**
 * Investment metrics output
 */
export interface InvestmentMetricsOutput {
  totalValue: number;
  totalCostBase: number;
  totalUnrealisedGain: number;
  totalUnrealisedGainPercent: number;
  accounts: Array<{
    accountId: string;
    accountName: string;
    totalValue: number;
    cashBalance: number;
    holdings: Array<{
      holdingId: string;
      ticker: string;
      units: number;
      averagePrice: number;
      currentPrice: number;
      marketValue: number;
      costBase: number;
      unrealisedGain: number;
      unrealisedGainPercent: number;
    }>;
  }>;
}

/**
 * Depreciation output
 */
export interface DepreciationOutput {
  totalAnnualDepreciation: number;
  totalDiv40: number;
  totalDiv43: number;
  byProperty: Array<{
    propertyId: string;
    propertyName: string;
    totalAnnual: number;
    div40: number;
    div43: number;
    schedules: Array<{
      assetName: string;
      category: string;
      method: string;
      originalCost: number;
      writtenDownValue: number;
      annualDepreciation: number;
    }>;
  }>;
}

/**
 * Debt plan output
 */
export interface DebtPlanOutput {
  strategy: string;
  debtFreeDate: string;
  baselineDebtFreeDate: string;
  totalInterestPaid: number;
  totalInterestSaved: number;
  monthsSaved: number;
  loanResults: Array<{
    loanId: string;
    loanName: string;
    originalPrincipal: number;
    payoffDate: string;
    baselinePayoffDate: string;
    totalInterestPaid: number;
    interestSaved: number;
    monthsSaved: number;
    ioWarning: boolean;
  }>;
}

/**
 * GRDCS linkage health output
 */
export interface LinkageHealthOutput {
  completenessScore: number;
  crossModuleConsistency: number;
  orphanCount: number;
  missingLinkCount: number;
  missingLinks: Array<{
    entityType: string;
    entityId: string;
    entityName: string;
    missingLinkType: string;
  }>;
  warnings: string[];
}

/**
 * Insights summary output
 */
export interface InsightsOutput {
  totalCount: number;
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  byCategory: Record<string, number>;
  topInsights: Array<{
    id: string;
    severity: string;
    category: string;
    title: string;
    description: string;
    affectedEntity?: string;
  }>;
}

/**
 * Tax exposure output
 */
export interface TaxExposureOutput {
  taxableIncome: number;
  deductibleExpenses: number;
  estimatedTaxableIncome: number;
  projectedPAYG: number;
  frankingCredits: number;
  depreciationDeductions: number;
}

/**
 * Expected outputs for verification (subset that external tool can verify)
 */
export interface TestExpectedOutputs {
  netWorth?: Partial<NetWorthOutput>;
  cashflow?: Partial<CashflowOutput>;
  gearing?: Partial<GearingOutput>;
  propertyMetrics?: Partial<PropertyMetricsOutput>[];
  loanMetrics?: Partial<LoanMetricsOutput>[];
  depreciation?: Partial<DepreciationOutput>;
}

/**
 * Complete test export output
 */
export interface TestExportOutput {
  /** Metadata */
  meta: {
    exportedAt: string;
    scenarioId: string;
    scenarioName: string;
    userId: string;
    version: string;
  };
  /** Summary of what was loaded */
  inputSummary: {
    properties: number;
    loans: number;
    accounts: number;
    income: number;
    expenses: number;
    investmentAccounts: number;
    holdings: number;
    investmentTransactions: number;
    depreciationSchedules: number;
  };
  /** All calculated outputs */
  calculatedOutputs: {
    netWorth: NetWorthOutput;
    cashflow: CashflowOutput;
    gearing: GearingOutput;
    propertyMetrics: PropertyMetricsOutput[];
    loanMetrics: LoanMetricsOutput[];
    investmentMetrics: InvestmentMetricsOutput;
    depreciation: DepreciationOutput;
    debtPlan?: DebtPlanOutput;
    linkageHealth: LinkageHealthOutput;
    insights: InsightsOutput;
    taxExposure: TaxExposureOutput;
  };
  /** Raw portfolio snapshot (full detail) */
  rawSnapshot: unknown;
}

// =============================================================================
// LOADER TYPES
// =============================================================================

/**
 * Result of loading a test scenario
 */
export interface TestLoadResult {
  success: boolean;
  scenarioId: string;
  userId: string;
  /** Entity ID mappings (name → id) for reference resolution */
  entityMappings: {
    properties: Record<string, string>;
    loans: Record<string, string>;
    accounts: Record<string, string>;
    income: Record<string, string>;
    expenses: Record<string, string>;
    investmentAccounts: Record<string, string>;
    holdings: Record<string, string>;
  };
  /** Load statistics */
  stats: {
    propertiesCreated: number;
    loansCreated: number;
    accountsCreated: number;
    incomeCreated: number;
    expensesCreated: number;
    investmentAccountsCreated: number;
    holdingsCreated: number;
    transactionsCreated: number;
    depreciationSchedulesCreated: number;
  };
  /** Any errors encountered */
  errors: Array<{
    entity: string;
    name: string;
    error: string;
  }>;
}

/**
 * Result of resetting test data
 */
export interface TestResetResult {
  success: boolean;
  userId: string;
  deleted: {
    properties: number;
    loans: number;
    accounts: number;
    income: number;
    expenses: number;
    investmentAccounts: number;
    holdings: number;
    transactions: number;
    depreciationSchedules: number;
  };
}
