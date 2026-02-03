/**
 * Enhanced Setup Wizard v2.0 - Type Definitions
 *
 * These types MUST match the Prisma schema exactly.
 * See prisma/schema.prisma for the source of truth.
 */

import { OnboardingProfileType } from '@/hooks/useOnboardingState';
import { toAnnual } from '@/lib/utils/frequencies';
import { Frequency as FrequencyType } from '@/lib/types/prisma-enums';

// =============================================================================
// WIZARD STEP DEFINITIONS
// =============================================================================

export type WizardStepId =
  | 'welcome'
  | 'properties'
  | 'accounts'
  | 'investments'
  | 'assets'
  | 'income-expenses'
  | 'review';

export interface WizardStep {
  id: WizardStepId;
  title: string;
  description: string;
  icon: string;
  isOptional?: boolean;
  profiles: OnboardingProfileType[]; // Which profiles see this step
}

export const WIZARD_STEPS: WizardStep[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    description: 'Tell us about yourself',
    icon: '👋',
    profiles: ['STARTER', 'HOMEOWNER', 'INVESTOR', 'MIXED'],
  },
  {
    id: 'properties',
    title: 'Properties',
    description: 'Add your properties and loans',
    icon: '🏠',
    isOptional: true,
    profiles: ['HOMEOWNER', 'INVESTOR', 'MIXED'],
  },
  {
    id: 'accounts',
    title: 'Accounts',
    description: 'Add your bank accounts',
    icon: '🏦',
    profiles: ['STARTER', 'HOMEOWNER', 'INVESTOR', 'MIXED'],
  },
  {
    id: 'investments',
    title: 'Investments',
    description: 'Add your investment accounts',
    icon: '📈',
    isOptional: true,
    profiles: ['INVESTOR', 'MIXED'],
  },
  {
    id: 'assets',
    title: 'Assets',
    description: 'Add your personal assets',
    icon: '🚗',
    isOptional: true,
    profiles: ['MIXED'],
  },
  {
    id: 'income-expenses',
    title: 'Income & Expenses',
    description: 'Set up your cashflow',
    icon: '💰',
    profiles: ['STARTER', 'HOMEOWNER', 'INVESTOR', 'MIXED'],
  },
  {
    id: 'review',
    title: 'Review',
    description: 'Launch your dashboard',
    icon: '🚀',
    profiles: ['STARTER', 'HOMEOWNER', 'INVESTOR', 'MIXED'],
  },
];

// =============================================================================
// PROPERTY DATA TYPES (matches Prisma PropertyType enum)
// =============================================================================

// Prisma: enum PropertyType { HOME, INVESTMENT }
export type PropertyType = 'HOME' | 'INVESTMENT';

// For UI display - maps to Prisma PropertyType
export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  HOME: 'Primary Residence',
  INVESTMENT: 'Investment Property',
};

export interface PropertyExpenseInput {
  id: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  frequency: Frequency;
}

// Prisma: enum RateType { VARIABLE, FIXED }
export type RateType = 'VARIABLE' | 'FIXED';

// Prisma: enum RepaymentFrequency { WEEKLY, FORTNIGHTLY, MONTHLY }
export type RepaymentFrequency = 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY';

export interface PropertyLoanInput {
  id: string;
  name: string; // Loan name (e.g., "Home Loan", "Investment Loan")
  lender: string; // For display - stored in name field
  principal: number;
  interestRateAnnual: number; // e.g., 0.0625 for 6.25%
  rateType: RateType;
  isInterestOnly: boolean;
  termMonthsRemaining: number;
  minRepayment: number;
  repaymentFrequency: RepaymentFrequency;
}

export interface PropertyIncomeInput {
  id: string;
  type: 'RENTAL'; // Maps to IncomeType.RENTAL
  amount: number;
  frequency: Frequency;
  tenantName?: string;
}

export interface PropertyInput {
  id: string;
  name: string;
  address: string;
  type: PropertyType;
  purchasePrice: number;
  currentValue: number;
  purchaseDate?: string;
  hasLoan: boolean;
  loan?: PropertyLoanInput;
  income?: PropertyIncomeInput;
  expenses: PropertyExpenseInput[];
}

// =============================================================================
// ACCOUNT DATA TYPES (matches Prisma AccountType enum)
// =============================================================================

// Prisma: enum AccountType { OFFSET, SAVINGS, TRANSACTIONAL, CREDIT_CARD }
export type AccountType = 'OFFSET' | 'SAVINGS' | 'TRANSACTIONAL' | 'CREDIT_CARD';

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  TRANSACTIONAL: 'Transaction Account',
  SAVINGS: 'Savings Account',
  OFFSET: 'Offset Account',
  CREDIT_CARD: 'Credit Card',
};

export interface AccountInput {
  id: string;
  name: string;
  type: AccountType;
  institution?: string;
  currentBalance: number;
  interestRate?: number; // Annual interest rate (e.g., 0.025 for 2.5%)
  linkedLoanId?: string; // For offset accounts - reference to a loan
}

// =============================================================================
// INVESTMENT DATA TYPES (matches Prisma InvestmentAccountType enum)
// =============================================================================

// Prisma: enum InvestmentAccountType { BROKERAGE, SUPERS, FUND, TRUST, ETF_CRYPTO }
export type InvestmentAccountType = 'BROKERAGE' | 'SUPERS' | 'FUND' | 'TRUST' | 'ETF_CRYPTO';

export const INVESTMENT_TYPE_LABELS: Record<InvestmentAccountType, string> = {
  BROKERAGE: 'Brokerage Account',
  SUPERS: 'Superannuation',
  FUND: 'Managed Fund',
  TRUST: 'Trust',
  ETF_CRYPTO: 'ETF / Crypto',
};

// Prisma: enum HoldingType { SHARE, ETF, MANAGED_FUND, CRYPTO }
export type HoldingType = 'SHARE' | 'ETF' | 'MANAGED_FUND' | 'CRYPTO';

export interface HoldingInput {
  id: string;
  ticker: string;
  name?: string;
  units: number;
  averagePrice: number;
  type: HoldingType;
}

export interface InvestmentAccountInput {
  id: string;
  name: string;
  platform?: string;
  type: InvestmentAccountType;
  cashBalance: number;
  holdings: HoldingInput[];
}

// =============================================================================
// ASSET DATA TYPES (matches Prisma AssetType enum)
// =============================================================================

// Prisma: enum AssetType { VEHICLE, ELECTRONICS, FURNITURE, EQUIPMENT, COLLECTIBLE, OTHER }
export type AssetType = 'VEHICLE' | 'ELECTRONICS' | 'FURNITURE' | 'EQUIPMENT' | 'COLLECTIBLE' | 'OTHER';

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  VEHICLE: 'Vehicle',
  ELECTRONICS: 'Electronics',
  FURNITURE: 'Furniture',
  EQUIPMENT: 'Equipment',
  COLLECTIBLE: 'Collectibles',
  OTHER: 'Other',
};

export interface AssetExpenseInput {
  id: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  frequency: Frequency;
}

export interface AssetInput {
  id: string;
  name: string;
  type: AssetType;
  purchasePrice: number;
  currentValue: number;
  purchaseDate?: string;
  description?: string;
  expenses: AssetExpenseInput[];
  // Vehicle-specific fields
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: number;
}

// =============================================================================
// INCOME & EXPENSE DATA TYPES (matches Prisma enums)
// =============================================================================

// Prisma: enum IncomeType { SALARY, RENT, RENTAL, INVESTMENT, OTHER }
export type IncomeType = 'SALARY' | 'RENT' | 'RENTAL' | 'INVESTMENT' | 'OTHER';

export const INCOME_TYPE_LABELS: Record<IncomeType, string> = {
  SALARY: 'Salary/Wages',
  RENT: 'Rent Received',
  RENTAL: 'Rental Income',
  INVESTMENT: 'Investment Income',
  OTHER: 'Other Income',
};

// Prisma: enum SalaryType { GROSS, NET }
export type SalaryType = 'GROSS' | 'NET';

// Prisma: enum Frequency { WEEKLY, FORTNIGHTLY, MONTHLY, QUARTERLY, ANNUAL }
export type Frequency = 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';

export interface IncomeInput {
  id: string;
  name: string;
  type: IncomeType;
  amount: number;
  frequency: Frequency;
  salaryType?: SalaryType; // For SALARY type
}

// Prisma: enum ExpenseCategory
export type ExpenseCategory =
  | 'HOUSING'
  | 'RATES'
  | 'INSURANCE'
  | 'MAINTENANCE'
  | 'PERSONAL'
  | 'UTILITIES'
  | 'FOOD'
  | 'TRANSPORT'
  | 'ENTERTAINMENT'
  | 'STRATA'
  | 'LAND_TAX'
  | 'LOAN_INTEREST'
  | 'REGISTRATION'
  | 'MODIFICATIONS'
  | 'OTHER';

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  HOUSING: 'Housing',
  RATES: 'Council Rates',
  INSURANCE: 'Insurance',
  MAINTENANCE: 'Maintenance',
  PERSONAL: 'Personal',
  UTILITIES: 'Utilities',
  FOOD: 'Food & Groceries',
  TRANSPORT: 'Transport',
  ENTERTAINMENT: 'Entertainment',
  STRATA: 'Strata Fees',
  LAND_TAX: 'Land Tax',
  LOAN_INTEREST: 'Loan Interest',
  REGISTRATION: 'Registration',
  MODIFICATIONS: 'Modifications',
  OTHER: 'Other',
};

export interface ExpenseInput {
  id: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  frequency: Frequency;
  isEssential?: boolean;
  isTaxDeductible?: boolean;
}

// =============================================================================
// WIZARD STATE
// =============================================================================

export interface WizardData {
  // Step 1: Welcome
  profileType: OnboardingProfileType | null;
  country: string;
  taxYear: string;

  // Step 2: Properties (with inline loans)
  properties: PropertyInput[];

  // Step 3: Accounts
  accounts: AccountInput[];

  // Step 4: Investments
  investments: InvestmentAccountInput[];

  // Step 5: Assets
  assets: AssetInput[];

  // Step 6: Income & Expenses
  income: IncomeInput[];
  expenses: ExpenseInput[];
}

export const INITIAL_WIZARD_DATA: WizardData = {
  profileType: null,
  country: 'AU',
  taxYear: new Date().getFullYear().toString(),
  properties: [],
  accounts: [],
  investments: [],
  assets: [],
  income: [],
  expenses: [],
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function getStepsForProfile(profile: OnboardingProfileType): WizardStep[] {
  return WIZARD_STEPS.filter(step => step.profiles.includes(profile));
}

export function generateId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Get all loans from properties for linking
export function getLoansFromProperties(properties: PropertyInput[]): Array<{ id: string; name: string; propertyName: string }> {
  return properties
    .filter(p => p.hasLoan && p.loan)
    .map(p => ({
      id: p.loan!.id,
      name: `${p.loan!.lender} - ${p.name}`,
      propertyName: p.name,
    }));
}

// Calculate summary metrics
export function calculateSummary(data: WizardData): {
  totalPropertyValue: number;
  totalLoanBalance: number;
  totalAccountBalance: number;
  totalInvestmentValue: number;
  totalAssetValue: number;
  netWorth: number;
  annualIncome: number;
  annualExpenses: number;
  annualLoanRepayments: number;
  monthlyCashflow: number;
} {
  // Use centralized frequency utility
  const frequencyToAnnual = (amount: number, freq: string): number => {
    return toAnnual(amount, freq as Frequency);
  };

  const totalPropertyValue = data.properties.reduce((sum, p) => sum + p.currentValue, 0);
  const totalLoanBalance = data.properties.reduce((sum, p) => sum + (p.loan?.principal || 0), 0);
  const totalAccountBalance = data.accounts.reduce((sum, a) => sum + a.currentBalance, 0);
  const totalInvestmentValue = data.investments.reduce((sum, inv) => {
    const holdingsValue = inv.holdings.reduce((h, hold) => h + (hold.units * hold.averagePrice), 0);
    return sum + inv.cashBalance + holdingsValue;
  }, 0);
  const totalAssetValue = data.assets.reduce((sum, a) => sum + a.currentValue, 0);

  const netWorth = totalPropertyValue + totalAccountBalance + totalInvestmentValue + totalAssetValue - totalLoanBalance;

  // Calculate annual income
  let annualIncome = 0;
  data.income.forEach(inc => {
    annualIncome += frequencyToAnnual(inc.amount, inc.frequency);
  });
  data.properties.forEach(prop => {
    if (prop.income) {
      annualIncome += frequencyToAnnual(prop.income.amount, prop.income.frequency);
    }
  });

  // Calculate annual expenses
  let annualExpenses = 0;
  data.expenses.forEach(exp => {
    annualExpenses += frequencyToAnnual(exp.amount, exp.frequency);
  });
  data.properties.forEach(prop => {
    prop.expenses.forEach(exp => {
      annualExpenses += frequencyToAnnual(exp.amount, exp.frequency);
    });
  });
  data.assets.forEach(asset => {
    asset.expenses.forEach(exp => {
      annualExpenses += frequencyToAnnual(exp.amount, exp.frequency);
    });
  });

  // Calculate annual loan repayments
  let annualLoanRepayments = 0;
  data.properties.forEach(prop => {
    if (prop.loan) {
      annualLoanRepayments += frequencyToAnnual(prop.loan.minRepayment, prop.loan.repaymentFrequency);
    }
  });

  const monthlyCashflow = (annualIncome - annualExpenses - annualLoanRepayments) / 12;

  return {
    totalPropertyValue,
    totalLoanBalance,
    totalAccountBalance,
    totalInvestmentValue,
    totalAssetValue,
    netWorth,
    annualIncome,
    annualExpenses,
    annualLoanRepayments,
    monthlyCashflow,
  };
}
