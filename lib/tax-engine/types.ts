/**
 * Phase 20: Australian Tax Intelligence Engine
 * Type definitions
 */

// =============================================================================
// Define enums locally for type safety
// These mirror the Prisma schema enums
// =============================================================================

export enum SalaryType {
  GROSS = 'GROSS',
  NET = 'NET',
}

export enum PayFrequency {
  WEEKLY = 'WEEKLY',
  FORTNIGHTLY = 'FORTNIGHTLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUALLY = 'ANNUALLY',
}

export enum TaxCategory {
  SALARY_WAGES = 'SALARY_WAGES',
  ALLOWANCES = 'ALLOWANCES',
  BONUSES = 'BONUSES',
  TERMINATION = 'TERMINATION',
  DIVIDENDS_FRANKED = 'DIVIDENDS_FRANKED',
  DIVIDENDS_UNFRANKED = 'DIVIDENDS_UNFRANKED',
  INTEREST = 'INTEREST',
  CAPITAL_GAINS = 'CAPITAL_GAINS',
  RENTAL = 'RENTAL',
  GOVERNMENT_TAXABLE = 'GOVERNMENT_TAXABLE',
  GOVERNMENT_EXEMPT = 'GOVERNMENT_EXEMPT',
  GIFTS = 'GIFTS',
  INHERITANCE = 'INHERITANCE',
  INSURANCE_PAYOUT = 'INSURANCE_PAYOUT',
  HOBBY_INCOME = 'HOBBY_INCOME',
  TAX_EXEMPT = 'TAX_EXEMPT',
}

export enum SuperContributionType {
  EMPLOYER_SG = 'EMPLOYER_SG',
  SALARY_SACRIFICE = 'SALARY_SACRIFICE',
  PERSONAL_DEDUCTIBLE = 'PERSONAL_DEDUCTIBLE',
  PERSONAL_NON_DEDUCT = 'PERSONAL_NON_DEDUCT',
  SPOUSE = 'SPOUSE',
  GOVERNMENT_COCONTRIB = 'GOVERNMENT_COCONTRIB',
  DOWNSIZER = 'DOWNSIZER',
}

export enum IncomeType {
  SALARY = 'SALARY',
  RENT = 'RENT',
  RENTAL = 'RENTAL',
  INVESTMENT = 'INVESTMENT',
  OTHER = 'OTHER',
}

export enum Frequency {
  WEEKLY = 'WEEKLY',
  FORTNIGHTLY = 'FORTNIGHTLY',
  MONTHLY = 'MONTHLY',
  ANNUAL = 'ANNUAL',
}

// =============================================================================
// Tax Year Configuration Types
// =============================================================================

export interface TaxBracket {
  min: number;
  max: number | null; // null for the highest bracket
  baseAmount: number;
  rate: number; // marginal rate as decimal (e.g., 0.19 for 19%)
}

export interface MedicareThresholds {
  single: number;
  family: number;
  dependentChildIncrease: number;
  shadeOutMultiplier: number; // e.g., 1.25 means shade-out is 125% of threshold
}

export interface MedicareSurchargeThreshold {
  min: number;
  max: number | null;
  rate: number;
}

export interface LITOWithdrawalTier {
  threshold: number; // Income threshold for this tier
  withdrawalRate: number; // Rate per dollar (e.g., 0.05 = 5 cents)
}

export interface LITOConfig {
  maxOffset: number;
  fullThreshold: number;
  tier1: LITOWithdrawalTier; // First withdrawal tier (5c/$)
  tier2: LITOWithdrawalTier; // Second withdrawal tier (1.5c/$)
  cutoffThreshold: number;
}

export interface TaxYearConfig {
  financialYear: string;
  startDate: Date;
  endDate: Date;

  /**
   * Display label, e.g. "FY24-25". Read by UI consumers instead of
   * hard-coding the subtitle. (CLAUDE.md §12.2 SSOT.)
   */
  label: string;

  // Tax brackets
  brackets: TaxBracket[];
  taxFreeThreshold: number;

  // Medicare
  medicareRate: number;
  medicareThresholds: MedicareThresholds;
  medicareSurchargeThresholds: MedicareSurchargeThreshold[];

  // Tax offsets
  lito: LITOConfig;
  saptoSingle: number;
  saptoCoupleEach: number;

  // Super
  superGuaranteeRate: number;
  /**
   * Maximum quarterly OTE (Ordinary Time Earnings) on which SG must
   * be paid. Above this, SG is capped. ATO publishes this annually.
   * FY24-25: $62,500; FY25-26: $65,250 (preliminary).
   */
  superGuaranteeQuarterlyCap: number;
  concessionalCap: number;
  nonConcessionalCap: number;
  division293Threshold: number;
  /**
   * Tax rate on concessional contributions inside the fund (per
   * ITAA 1997 s295-485). 15% across all FYs covered. Replaces the
   * 7 hard-coded `0.15` / `0.85` values across the tax-route layer.
   */
  superContributionsTaxRate: number;
  /**
   * Government co-contribution income threshold — phase-out upper
   * bound. Below this, eligible for some co-contribution. Indexed
   * annually. FY24-25: $60,400.
   */
  coContributionIncomeThreshold: number;
  /**
   * Total Super Balance threshold below which carry-forward of
   * unused concessional cap is permitted (ITAA s291-20(3)).
   * Currently $500,000 across all FYs.
   */
  carryForwardTsbThreshold: number;
  /**
   * Total Super Balance tiers controlling bring-forward
   * non-concessional eligibility (ITAA s292-85(2)). At or above
   * `none`, no bring-forward; between `reduced` and `none`, 2-year
   * bring-forward; below `full`, full 3-year bring-forward.
   */
  bringForwardThresholds: BringForwardThresholds;

  // CGT
  cgtDiscount: number;
  cgtDiscountMonths: number; // Holding period for discount eligibility

  /**
   * Per-FY review checkpoint. Forces an explicit human review of
   * thresholds before the FY commences. Per
   * `PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` §10.2.
   */
  reviewSchedule: TaxYearReviewSchedule;
}

export interface BringForwardThresholds {
  /** Below this TSB → 3-year bring-forward available (3× cap). */
  full: number;
  /** Below this TSB → 2-year bring-forward available (2× cap). */
  reduced: number;
  /** At or above this TSB → no bring-forward (1× cap only). */
  none: number;
}

export interface TaxYearReviewSchedule {
  /** ISO date by which the next review of this FY's config is due. */
  nextReviewBy: string;
  /**
   * Who's responsible for the review. Owners read this so they
   * know whose desk the review lands on each year.
   */
  reviewers: string[];
}

// =============================================================================
// Salary Processing Types
// =============================================================================

export interface SalaryInput {
  amount: number;
  salaryType: 'GROSS' | 'NET';
  payFrequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  salarySacrifice?: number;
  salarySacrificeFrequency?: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  hasTaxFreeThreshold?: boolean; // Default true
  hasHECSDebt?: boolean;
  hecsDebt?: number;
}

export interface SalaryBreakdown {
  // Annual amounts
  grossSalary: number;
  netSalary: number;

  // Superannuation
  superGuarantee: number;
  salarySacrifice: number;
  totalSuper: number;

  // Tax
  taxableIncome: number; // Gross - Salary Sacrifice
  paygWithholding: number;
  medicareLevy: number;
  totalTax: number;

  // Per pay period amounts
  perPeriod: {
    gross: number;
    super: number;
    tax: number;
    net: number;
    frequency: string;
  };

  // Calculation breakdown for display
  calculations: CalculationStep[];
}

export interface CalculationStep {
  label: string;
  value: number;
  operation?: '+' | '-' | '=' | '*';
  explanation?: string;
}

// =============================================================================
// PAYG Types
// =============================================================================

export interface PAYGCoefficients {
  a: number;
  b: number;
}

export interface PAYGScale {
  weeklyEarningsMin: number;
  weeklyEarningsMax: number | null;
  coefficients: PAYGCoefficients;
}

// =============================================================================
// Income Taxability Types
// =============================================================================

export interface TaxabilityResult {
  category: string; // TaxCategory enum value
  taxableAmount: number;
  exemptAmount: number;
  frankingCredits: number;
  grossedUpAmount: number;
  explanation: string;
  references: string[];
}

export interface IncomeContext {
  incomeType: string;
  amount: number;
  frequency: string;
  propertyId?: string;
  investmentAccountId?: string;
  frankingPercentage?: number;
  isFromTrust?: boolean;
  isGovernmentPayment?: boolean;
  paymentType?: string;
}

// =============================================================================
// Tax Position Types
// =============================================================================

export interface TaxPositionInput {
  userId: string;
  financialYear: string;
}

export interface IncomeBreakdown {
  salary: number;
  rental: number;
  dividends: number;
  interest: number;
  capitalGains: number;
  other: number;
  total: number;
  frankingCredits: number;
}

export interface DeductionBreakdown {
  workRelated: number;
  property: number;
  investment: number;
  depreciation: number;
  other: number;
  total: number;
}

export interface TaxCalculation {
  assessableIncome: number;
  taxableIncome: number;
  taxOnIncome: number;
  medicareLevy: number;
  medicareSurcharge: number;
  grossTax: number;
  offsets: TaxOffsets;
  netTax: number;
  effectiveRate: number;
  marginalRate: number;
}

export interface TaxOffsets {
  lito: number;
  sapto: number;
  frankingCredits: number;
  foreignTax: number;
  other: number;
  total: number;
}

export interface TaxPositionResult {
  financialYear: string;
  income: IncomeBreakdown;
  deductions: DeductionBreakdown;
  tax: TaxCalculation;
  paygWithheld: number;
  estimatedRefund: number; // Positive = refund, Negative = owing
  superContributions: {
    concessional: number;
    nonConcessional: number;
    total: number;
    division293Tax: number;
  };
  warnings: string[];
  recommendations: TaxRecommendation[];
}

export interface TaxRecommendation {
  id: string;
  type: 'SAVINGS' | 'OPTIMIZATION' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  potentialSavings?: number;
  action?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

// =============================================================================
// Super Types
// =============================================================================

export interface SuperPosition {
  totalBalance: number;
  taxableComponent: number;
  taxFreeComponent: number;
  currentYearContributions: {
    concessional: number;
    nonConcessional: number;
    employerSG: number;
    salarySacrifice: number;
    personalDeductible: number;
  };
  caps: {
    concessional: number;
    nonConcessional: number;
    carryForwardAvailable: number;
  };
  remainingCaps: {
    concessional: number;
    nonConcessional: number;
  };
  warnings: string[];
}

// =============================================================================
// Scenario Modelling Types
// =============================================================================

export interface TaxScenario {
  name: string;
  changes: {
    additionalIncome?: number;
    additionalDeductions?: number;
    salarySacrificeChange?: number;
    sellProperty?: string;
    sellInvestment?: { holdingId: string; amount: number };
  };
}

export interface ScenarioResult {
  scenario: TaxScenario;
  originalTax: number;
  newTax: number;
  difference: number;
  percentageChange: number;
  breakdown: TaxPositionResult;
}

// =============================================================================
// Helper Types
// =============================================================================

export interface FinancialYear {
  year: string; // e.g., "2024-25"
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
}

export function getCurrentFinancialYear(): FinancialYear {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  // Australian FY runs July 1 to June 30
  if (month >= 6) {
    // July onwards = current year to next year
    return {
      year: `${year}-${(year + 1).toString().slice(-2)}`,
      startDate: new Date(year, 6, 1), // July 1
      endDate: new Date(year + 1, 5, 30), // June 30
      isCurrent: true,
    };
  } else {
    // Before July = previous year to current year
    return {
      year: `${year - 1}-${year.toString().slice(-2)}`,
      startDate: new Date(year - 1, 6, 1),
      endDate: new Date(year, 5, 30),
      isCurrent: true,
    };
  }
}

export function parseFinancialYear(fy: string): FinancialYear {
  // Parse "2024-25" format
  const [startYear] = fy.split('-');
  const year = parseInt(startYear, 10);

  const now = new Date();
  const currentFY = getCurrentFinancialYear();

  return {
    year: fy,
    startDate: new Date(year, 6, 1),
    endDate: new Date(year + 1, 5, 30),
    isCurrent: fy === currentFY.year,
  };
}
