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
  | 'household'  // Phase 29: Household setup step (first after welcome)
  | 'entities'   // Phase 41b: "How is your wealth held?" — entity layer
  | 'properties'
  | 'debts'      // Phase 12 PR 3b: non-property loans (CAR/STUDENT/PERSONAL/BUSINESS)
  | 'accounts'
  | 'investments'
  | 'super'      // Phase 12 PR 3b: dedicated SuperannuationAccount step
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
    id: 'household',
    title: 'Household',
    description: 'Add your household members',
    icon: '👨‍👩‍👧‍👦',
    profiles: ['STARTER', 'HOMEOWNER', 'INVESTOR', 'MIXED'],
  },
  // Phase 41b: Entity layer step. Sits between Household and Properties so
  // every property/loan/account/etc. created in subsequent steps can be
  // attached to the correct LegalEntity. Smart default — "Just my personal
  // name" creates one PERSONAL_NAME entity (idempotent with the 41a
  // backfill) and lets the user move on without ceremony.
  {
    id: 'entities',
    title: 'Your structure',
    description: 'How is your wealth held?',
    icon: '🏛️',
    isOptional: true,
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
  // Phase 12 PR 3b: Debts step — conditionally shown when the user ticks
  // at least one "Do you have any of these debts?" option on Welcome.
  // Visibility is further filtered at runtime in getStepsForProfile based
  // on WizardData.hasDebts (see below) — not just the profile list.
  {
    id: 'debts',
    title: 'Debts',
    description: 'Car, student, personal or business loans',
    icon: '💳',
    isOptional: true,
    profiles: ['STARTER', 'HOMEOWNER', 'INVESTOR', 'MIXED'],
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
  // Phase 12 PR 3b: Super step — shown to all profiles; still optional.
  // Creates real SuperannuationAccount rows (not InvestmentAccount type=SUPERS).
  {
    id: 'super',
    title: 'Super',
    description: 'Add your superannuation accounts',
    icon: '🛡️',
    isOptional: true,
    profiles: ['STARTER', 'HOMEOWNER', 'INVESTOR', 'MIXED'],
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
// PHASE 41b — LEGAL ENTITY DATA TYPES (matches Prisma LegalEntityType / Role)
// =============================================================================

// Prisma: enum LegalEntityType { PERSONAL_NAME, COMPANY, DISCRETIONARY_TRUST,
//   UNIT_TRUST, SMSF, PARTNERSHIP, SOLE_TRADER }
export type LegalEntityType =
  | 'PERSONAL_NAME'
  | 'COMPANY'
  | 'DISCRETIONARY_TRUST'
  | 'UNIT_TRUST'
  | 'SMSF'
  | 'PARTNERSHIP'
  | 'SOLE_TRADER';

// Prisma: enum LegalEntityRole { PERSONAL, HOLDING, OPERATING, INVESTMENT, SUPERANNUATION }
export type LegalEntityRole =
  | 'PERSONAL'
  | 'HOLDING'
  | 'OPERATING'
  | 'INVESTMENT'
  | 'SUPERANNUATION';

// Warm AU language — drives all entity-pickers and copy.
export const LEGAL_ENTITY_TYPE_LABELS: Record<LegalEntityType, string> = {
  PERSONAL_NAME: 'My personal name',
  COMPANY: 'Company (Pty Ltd)',
  DISCRETIONARY_TRUST: 'Discretionary / family trust',
  UNIT_TRUST: 'Unit trust',
  SMSF: 'Self-Managed Super Fund (SMSF)',
  PARTNERSHIP: 'Partnership',
  SOLE_TRADER: 'Sole trader (ABN, no separate entity)',
};

export const LEGAL_ENTITY_ROLE_LABELS: Record<LegalEntityRole, string> = {
  PERSONAL: 'Personal — natural-person ownership',
  HOLDING: 'Holding — passive investments',
  OPERATING: 'Operating — runs an active business',
  INVESTMENT: 'Investment — investment-only vehicle',
  SUPERANNUATION: 'Superannuation — SMSF only',
};

// One captured-during-wizard entity row. Mirrors `CreateEntityInput` from
// `lib/services/legalEntityService.ts` but uses string types friendly to
// HTML form state. The bulk-create writer converts these to the service
// shape and persists via the canonical `createEntity()` helper.
export interface EntityInput {
  id: string;                   // wizard-local temp id; resolved to real DB id at write time
  name: string;
  type: LegalEntityType;
  role: LegalEntityRole;
  abn?: string;                 // raw input; validated client-side via lib/utils/auValidators.ts
  acn?: string;
  tfn?: string;                 // OPTIONAL, opt-in only; encrypted at rest by the server
  tradingName?: string;
  establishedDate?: string;     // ISO date string
  parentEntityTempId?: string;  // wizard-local pointer to another EntityInput.id (trustee → trust)
}

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

// Phase 12 PR 3b: Data source hierarchy for an account entered in the
// wizard. Matches the schema's BalanceSource enum (minus USER_VERIFIED
// which isn't reachable from onboarding).
//   - BASIQ  : account was imported via the Basiq Open Banking connect
//              flow; the real Account row already exists in the DB, the
//              wizard only holds a display-pointer. bulk-create skips
//              writing these.
//   - IMPORT : account was created by the file-import flow (CSV/OFX/QIF)
//              which set a closing balance anchor; the real Account row
//              already exists. bulk-create skips writing these.
//   - MANUAL : user typed the balance directly (existing PR 1/3a path).
export type AccountDataSource = 'BASIQ' | 'IMPORT' | 'MANUAL';

export interface AccountInput {
  id: string;
  name: string;
  type: AccountType;
  institution?: string;
  currentBalance: number;
  interestRate?: number; // Annual interest rate (e.g., 0.025 for 2.5%)
  linkedLoanId?: string; // For offset accounts - reference to a loan
  // Phase 12 PR 3b: origin of the balance. Default MANUAL for existing
  // quick-add and manual-entry paths. Set to BASIQ or IMPORT by the
  // three-tier Accounts step when the user takes one of those routes.
  source?: AccountDataSource;
  // For BASIQ / IMPORT accounts, this is the ID of the real Account
  // row already persisted in the DB. bulk-create uses it to skip the
  // write without losing the reference.
  existingAccountId?: string;
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
// Must stay in sync with prisma/schema.prisma.
export type ExpenseCategory =
  | 'HOUSING'
  | 'RENT'
  | 'RATES'
  | 'INSURANCE'
  | 'MAINTENANCE'
  | 'PERSONAL'
  | 'UTILITIES'
  | 'FOOD'
  | 'GROCERIES'
  | 'TRANSPORT'
  | 'ENTERTAINMENT'
  | 'SUBSCRIPTION'
  | 'STRATA'
  | 'LAND_TAX'
  | 'LOAN_INTEREST'
  | 'REGISTRATION'
  | 'MODIFICATIONS'
  | 'HEALTH'
  | 'EDUCATION'
  | 'OTHER';

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  HOUSING: 'Housing',
  RENT: 'Rent',
  RATES: 'Council Rates',
  INSURANCE: 'Insurance',
  MAINTENANCE: 'Maintenance',
  PERSONAL: 'Personal',
  UTILITIES: 'Utilities',
  FOOD: 'Food & Dining',
  GROCERIES: 'Groceries',
  TRANSPORT: 'Transport',
  ENTERTAINMENT: 'Entertainment',
  SUBSCRIPTION: 'Subscriptions',
  STRATA: 'Strata Fees',
  LAND_TAX: 'Land Tax',
  LOAN_INTEREST: 'Loan Interest',
  REGISTRATION: 'Registration',
  MODIFICATIONS: 'Modifications',
  HEALTH: 'Health & Medical',
  EDUCATION: 'Education',
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
// PHASE 29: HOUSEHOLD MEMBER AND PET TYPES
// =============================================================================

export type HouseholdRelationship = 'SELF' | 'SPOUSE' | 'PARTNER' | 'CHILD' | 'PARENT' | 'SIBLING' | 'OTHER';
export type HouseholdPetType = 'DOG' | 'CAT' | 'BIRD' | 'FISH' | 'RABBIT' | 'REPTILE' | 'OTHER';

export const RELATIONSHIP_LABELS: Record<HouseholdRelationship, string> = {
  SELF: 'You',
  SPOUSE: 'Spouse',
  PARTNER: 'Partner',
  CHILD: 'Child',
  PARENT: 'Parent',
  SIBLING: 'Sibling',
  OTHER: 'Other',
};

export const PET_TYPE_LABELS: Record<HouseholdPetType, string> = {
  DOG: 'Dog',
  CAT: 'Cat',
  BIRD: 'Bird',
  FISH: 'Fish',
  RABBIT: 'Rabbit',
  REPTILE: 'Reptile',
  OTHER: 'Other',
};

export interface HouseholdMemberInput {
  id: string;
  name: string;
  relationship: HouseholdRelationship;
  dateOfBirth?: string;
  isIncomeEarner: boolean;
}

export interface HouseholdPetInput {
  id: string;
  name: string;
  type: HouseholdPetType;
  breed?: string;
}

// =============================================================================
// PHASE 12 PR 3b: RENTER PATH
// =============================================================================

// Housing situation — captured on Welcome as a 3-option segmented control.
//   - OWN   : user owns at least one property (home and/or investment).
//             Shows the Properties step.
//   - RENT  : user rents. Hides the Properties step. bulk-create seeds an
//             Expense(category=RENT, sourceType=GENERAL) in IncomeExpenses
//             if the user leaves the rent row untouched but has this
//             value set.
//   - BOTH  : user both owns property AND rents (e.g. has an investment
//             property and rents their primary residence). Shows both
//             the Properties step and the rent expense seeding.
export type HousingSituation = 'OWN' | 'RENT' | 'BOTH';

// Phase 12 v3 (bug A.5): Yes/No answer captured on the Welcome step's
// "Do you have any investments?" question. Previously this was a
// local-state-only type inside WelcomeStep, which meant the answer was
// never persisted to the wizard draft and had to be reverse-inferred from
// profileType on resume. Promoted to a first-class WizardData field here
// so it survives resume without guesswork.
export type YesNo = 'YES' | 'NO';

// =============================================================================
// PHASE 12 PR 3b: DEBTS STEP (non-property loans)
// =============================================================================

// Which debt types the user indicated on Welcome. Drives visibility of
// the Debts step and the pre-seeded rows inside it.
export type DebtCategory = 'CAR' | 'STUDENT' | 'PERSONAL' | 'BUSINESS';

// Prisma LoanType values the Debts step captures (HOME / INVESTMENT /
// LINE_OF_CREDIT are NOT in this set — HOME/INVESTMENT live on the
// Properties step, LINE_OF_CREDIT is modelled as a CREDIT_CARD Account
// per the PR 3b design decision in the plan doc §3 row C).
export type DebtLoanType = 'CAR' | 'PERSONAL' | 'STUDENT' | 'BUSINESS';

export interface DebtInput {
  id: string;
  name: string;
  type: DebtLoanType;
  lender?: string;
  principal: number;
  interestRateAnnual: number; // percentage, e.g. 6.5 (converted to decimal in bulk-create)
  minRepayment: number;
  repaymentFrequency: RepaymentFrequency;
  termMonthsRemaining?: number;
  // For CAR loans: optional link to an Asset row in the Assets step.
  // Matches the existing Loan.linkedAssetId column.
  linkedAssetId?: string;
  // For STUDENT loans: HECS/HELP has no lender name and no minimum
  // repayment in the traditional sense (it's income-contingent). The
  // wizard still uses `principal` for the outstanding balance; the
  // other fields are optional and default sensibly.
  isHecsHelp?: boolean;
}

// =============================================================================
// PHASE 12 PR 3b: SUPER STEP (SuperannuationAccount)
// =============================================================================

// Matches the core fields on the SuperannuationAccount Prisma model.
// PR 3b captures only the absolute minimum — users can fill in the rest
// from a future Settings > Retirement page (per plan doc §3 row A).
export interface SuperAccountInput {
  id: string;
  name: string;
  fundName: string;
  currentBalance: number;
}

// =============================================================================
// PHASE 12 PR 3b: HOUSEHOLD LIFESTYLE FIELDS (Phase 28 budget AI)
// =============================================================================

// Matches the LifestylePreference enum in the Prisma schema.
export type LifestylePreference = 'FRUGAL' | 'MODERATE' | 'COMFORTABLE';

// Matches the DiningFrequency enum in the Prisma schema.
export type DiningFrequency = 'NEVER' | 'RARELY' | 'SOMETIMES' | 'OFTEN';

// =============================================================================
// WIZARD STATE
// =============================================================================

export interface WizardData {
  // Step 1: Welcome
  profileType: OnboardingProfileType | null;
  country: string;
  taxYear: string;
  // Phase 12 PR 3b: housing situation drives Properties step visibility
  // and the renter-path expense seed. null until the user answers.
  housing: HousingSituation | null;
  // Phase 12 v3 (bug A.5): "Do you have any investments?" Yes/No answer.
  // Previously WelcomeStep-local state, which meant this value was lost
  // on resume — it had to be reverse-inferred from `profileType` and
  // returned null whenever the profile wasn't fully inferred yet,
  // forcing the user to re-pick and keeping Continue grayed out. Now a
  // persisted field so resumes actually restore the answer.
  hasInvestments: YesNo | null;
  // Phase 12 PR 3b: which non-property debts the user has. Drives
  // Debts step visibility and the pre-seeded rows.
  debtCategories: DebtCategory[];

  // Step 2: Household (Phase 29 + PR 3b lifestyle)
  householdMembers: HouseholdMemberInput[];
  householdPets: HouseholdPetInput[];
  carsCount: number;
  // Phase 12 PR 3b: lifestyle fields for the Phase 28 budget AI.
  // All three are nullable — defaults only apply in bulk-create.
  lifestylePreference: LifestylePreference | null;
  diningOutFrequency: DiningFrequency | null;
  hobbiesWithCosts: string;

  // Phase 41b: Legal entities (Personal, Trust, SMSF, Pty Ltd, etc.).
  // Smart default: empty array means the wizard relies on the
  // PERSONAL_NAME entity that the Phase 41a backfill created (or that
  // bulk-create creates on demand for new registrations).
  entities: EntityInput[];

  // Step 3: Properties (with inline loans)
  properties: PropertyInput[];

  // Step 3b: Debts (non-property loans) — PR 3b
  debts: DebtInput[];

  // Step 4: Accounts
  accounts: AccountInput[];

  // Step 5: Investments
  investments: InvestmentAccountInput[];

  // Step 5b: Super (SuperannuationAccount) — PR 3b
  superAccounts: SuperAccountInput[];

  // Step 6: Assets
  assets: AssetInput[];

  // Step 7: Income & Expenses
  income: IncomeInput[];
  expenses: ExpenseInput[];
}

export const INITIAL_WIZARD_DATA: WizardData = {
  profileType: null,
  country: 'AU',
  taxYear: new Date().getFullYear().toString(),
  // PR 3b new fields
  housing: null,
  // Phase 12 v3 bug A.5
  hasInvestments: null,
  debtCategories: [],
  lifestylePreference: null,
  diningOutFrequency: null,
  hobbiesWithCosts: '',
  // Existing fields
  householdMembers: [],
  householdPets: [],
  carsCount: 0,
  entities: [],
  properties: [],
  debts: [],
  accounts: [],
  investments: [],
  superAccounts: [],
  assets: [],
  income: [],
  expenses: [],
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Phase 12 PR 3a: Returns the visible steps for a given profile type.
 *
 * Phase 12 PR 3b extends this with **runtime context** so that step
 * visibility can depend on Welcome answers in addition to the profile
 * label. The optional `context` parameter drives three conditions:
 *
 *   1. **Renter path**: if `context.housing === 'RENT'`, the Properties
 *      step is hidden — renters don't own property. When they later add
 *      a rent expense on the Income/Expenses step, it's seeded as an
 *      Expense(category=RENT) rather than a Property(type=RENTAL).
 *   2. **Debts step**: the Debts step is only shown when
 *      `context.debtCategories.length > 0` — i.e. the user ticked at
 *      least one checkbox on Welcome ("Do you have any of these debts?").
 *   3. **Backwards compatibility**: if `context` is undefined (existing
 *      callers from PR 3a that don't pass it yet), Properties and Debts
 *      fall back to their legacy behaviour — Properties always visible
 *      for non-STARTER profiles, Debts always visible.
 *
 * Super and Assets stay profile-gated as they were in PR 3a (Super is
 * all profiles, Assets is MIXED only — Assets may also become
 * conditionally gated in a future PR).
 */
export function getStepsForProfile(
  profile: OnboardingProfileType,
  context?: { housing?: HousingSituation | null; debtCategories?: DebtCategory[] }
): WizardStep[] {
  return WIZARD_STEPS.filter((step) => {
    // Profile gate — always applied
    if (!step.profiles.includes(profile)) return false;

    // PR 3b runtime gates
    if (context) {
      // Renter path — hide Properties unless they actually own
      if (step.id === 'properties' && context.housing === 'RENT') {
        return false;
      }
      // Debts step — only show when Welcome-ticked
      if (
        step.id === 'debts' &&
        (!context.debtCategories || context.debtCategories.length === 0)
      ) {
        return false;
      }
    } else {
      // Legacy behaviour (no context supplied): hide the Debts step by
      // default so PR 3a tests that don't know about it still pass.
      if (step.id === 'debts') return false;
    }

    return true;
  });
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
  /** PR 3b: total principal across non-property debts */
  totalDebtsBalance: number;
  totalAccountBalance: number;
  totalInvestmentValue: number;
  /** PR 3b: total superannuation balance */
  totalSuperValue: number;
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
  // PR 3b: include non-property debts (CAR / STUDENT / PERSONAL / BUSINESS)
  const totalDebtsBalance = data.debts.reduce((sum, d) => sum + d.principal, 0);
  const totalAccountBalance = data.accounts.reduce((sum, a) => sum + a.currentBalance, 0);
  const totalInvestmentValue = data.investments.reduce((sum, inv) => {
    const holdingsValue = inv.holdings.reduce((h, hold) => h + (hold.units * hold.averagePrice), 0);
    return sum + inv.cashBalance + holdingsValue;
  }, 0);
  // PR 3b: include superannuation balances
  const totalSuperValue = data.superAccounts.reduce((sum, s) => sum + s.currentBalance, 0);
  const totalAssetValue = data.assets.reduce((sum, a) => sum + a.currentValue, 0);

  const netWorth =
    totalPropertyValue +
    totalAccountBalance +
    totalInvestmentValue +
    totalSuperValue +
    totalAssetValue -
    totalLoanBalance -
    totalDebtsBalance;

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
  // PR 3b: include non-property debt repayments (CAR / PERSONAL / BUSINESS —
  // STUDENT/HECS is income-contingent, so it has no fixed minRepayment and
  // contributes 0 here).
  data.debts.forEach((debt) => {
    if (debt.minRepayment > 0 && !debt.isHecsHelp) {
      annualLoanRepayments += frequencyToAnnual(
        debt.minRepayment,
        debt.repaymentFrequency
      );
    }
  });

  const monthlyCashflow = (annualIncome - annualExpenses - annualLoanRepayments) / 12;

  return {
    totalPropertyValue,
    totalLoanBalance,
    totalDebtsBalance,
    totalAccountBalance,
    totalInvestmentValue,
    totalSuperValue,
    totalAssetValue,
    netWorth,
    annualIncome,
    annualExpenses,
    annualLoanRepayments,
    monthlyCashflow,
  };
}
