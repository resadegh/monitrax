/**
 * Enhanced Setup Wizard v2.0 - Type Definitions
 *
 * Comprehensive type system for the onboarding wizard that captures
 * all financial data with proper entity linking.
 */

import { OnboardingProfileType } from '@/hooks/useOnboardingState';

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
// PROPERTY DATA TYPES
// =============================================================================

export type PropertyType = 'PRIMARY_RESIDENCE' | 'INVESTMENT' | 'HOLIDAY_HOME';

export interface PropertyExpenseInput {
  id: string;
  name: string;
  category: string;
  amount: number;
  frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
}

export interface PropertyLoanInput {
  id: string;
  lender: string;
  principal: number;
  interestRate: number;
  rateType: 'FIXED' | 'VARIABLE';
  isInterestOnly: boolean;
  repaymentAmount: number;
  repaymentFrequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY';
}

export interface PropertyIncomeInput {
  id: string;
  type: 'RENT';
  amount: number;
  frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY';
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
// ACCOUNT DATA TYPES
// =============================================================================

export type AccountType = 'TRANSACTION' | 'SAVINGS' | 'OFFSET' | 'CREDIT_CARD';

export interface AccountInput {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  isOffset: boolean;
  linkedLoanId?: string; // Reference to a loan from properties step
}

// =============================================================================
// INVESTMENT DATA TYPES
// =============================================================================

export type InvestmentAccountType = 'BROKERAGE' | 'SUPER' | 'MANAGED_FUND' | 'CRYPTO';

export interface HoldingInput {
  id: string;
  ticker: string;
  units: number;
  averagePrice: number;
}

export interface InvestmentAccountInput {
  id: string;
  name: string;
  platform: string;
  type: InvestmentAccountType;
  cashBalance: number;
  holdings: HoldingInput[];
}

// =============================================================================
// ASSET DATA TYPES
// =============================================================================

export type AssetType = 'VEHICLE' | 'ELECTRONICS' | 'JEWELLERY' | 'FURNITURE' | 'COLLECTIBLE' | 'OTHER';

export interface AssetExpenseInput {
  id: string;
  name: string;
  amount: number;
  frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
}

export interface AssetInput {
  id: string;
  name: string;
  type: AssetType;
  purchasePrice: number;
  currentValue: number;
  purchaseDate?: string;
  expenses: AssetExpenseInput[];
  // Vehicle-specific fields
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: number;
}

// =============================================================================
// INCOME & EXPENSE DATA TYPES
// =============================================================================

export type IncomeType = 'SALARY' | 'DIVIDENDS' | 'INTEREST' | 'RENTAL' | 'BUSINESS' | 'OTHER';
export type SalaryType = 'GROSS' | 'NET';

export interface IncomeInput {
  id: string;
  name: string;
  type: IncomeType;
  amount: number;
  frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'ANNUAL';
  salaryType?: SalaryType; // For SALARY type
}

export type ExpenseCategory =
  | 'GROCERIES'
  | 'UTILITIES'
  | 'TRANSPORT'
  | 'HEALTHCARE'
  | 'INSURANCE'
  | 'SUBSCRIPTIONS'
  | 'ENTERTAINMENT'
  | 'DINING'
  | 'EDUCATION'
  | 'CHILDCARE'
  | 'PERSONAL'
  | 'OTHER';

export interface ExpenseInput {
  id: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
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
  const frequencyToAnnual = (amount: number, freq: string): number => {
    switch (freq) {
      case 'WEEKLY': return amount * 52;
      case 'FORTNIGHTLY': return amount * 26;
      case 'MONTHLY': return amount * 12;
      case 'QUARTERLY': return amount * 4;
      case 'ANNUAL': return amount;
      default: return amount * 12;
    }
  };

  const totalPropertyValue = data.properties.reduce((sum, p) => sum + p.currentValue, 0);
  const totalLoanBalance = data.properties.reduce((sum, p) => sum + (p.loan?.principal || 0), 0);
  const totalAccountBalance = data.accounts.reduce((sum, a) => sum + a.balance, 0);
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
      annualLoanRepayments += frequencyToAnnual(prop.loan.repaymentAmount, prop.loan.repaymentFrequency);
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
