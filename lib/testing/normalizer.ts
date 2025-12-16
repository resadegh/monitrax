/**
 * TEST SCENARIO NORMALIZER
 * Converts flexible input formats to standardized internal format
 *
 * @module lib/testing/normalizer
 */

import type {
  TestScenarioInput,
  TestPropertyInput,
  TestLoanInput,
  TestAccountInput,
  TestIncomeInput,
  TestExpenseInput,
  TestInvestmentAccountInput,
  TestHoldingInput,
  TestInvestmentTransactionInput,
  TestDepreciationScheduleInput,
} from './types';

// =============================================================================
// FLEXIBLE INPUT TYPES (what users might provide)
// =============================================================================

interface FlexibleProperty {
  id?: string;
  name: string;
  address?: string;
  type: string;
  purchaseDate: string;
  purchasePrice: number;
  currentValue: number;
  valuationDate?: string;
  latitude?: number;
  longitude?: number;
  suburb?: string;
  state?: string;
  postcode?: string;
}

interface FlexibleLoan {
  id?: string;
  name: string;
  lender?: string;
  type: string;
  balance?: number;
  principal?: number;
  interestRate?: number;
  interestRateAnnual?: number;
  rateType?: string;
  isInterestOnly?: boolean;
  termMonthsRemaining?: number;
  monthlyRepayment?: number;
  minRepayment?: number;
  repaymentFrequency?: string;
  fixedExpiry?: string;
  extraRepaymentCap?: number;
  // References (flexible)
  propertyId?: string;
  propertyRef?: string;
  offsetAccountId?: string;
  offsetAccountRef?: string;
}

interface FlexibleAccount {
  id?: string;
  name: string;
  type: string;
  institution?: string;
  balance?: number;
  currentBalance?: number;
  interestRate?: number;
  linkedLoanId?: string;
}

interface FlexibleIncome {
  id?: string;
  name: string;
  type?: string;
  category?: string;
  sourceType?: string;
  amount: number;
  frequency: string;
  isTaxable?: boolean;
  isNet?: boolean;
  salaryType?: string;
  superGuaranteeRate?: number;
  salarySacrifice?: number;
  frankingPercentage?: number;
  propertyId?: string;
  propertyRef?: string;
  investmentAccountId?: string;
  investmentAccountRef?: string;
  startDate?: string;
  endDate?: string;
}

interface FlexibleExpense {
  id?: string;
  name: string;
  vendorName?: string;
  category: string;
  sourceType?: string;
  amount: number;
  frequency: string;
  isEssential?: boolean;
  isTaxDeductible?: boolean;
  propertyId?: string;
  propertyRef?: string;
  loanId?: string;
  loanRef?: string;
  investmentAccountId?: string;
  investmentAccountRef?: string;
  assetRef?: string;
}

interface FlexibleInvestmentAccount {
  id?: string;
  name: string;
  type: string;
  platform?: string;
  currency?: string;
  balance?: number;
  cashBalance?: number;
  openingBalance?: number;
  costBasisMethod?: string;
}

interface FlexibleHolding {
  id?: string;
  ticker: string;
  name?: string;
  type?: string;
  units: number;
  averagePrice?: number;
  currentPrice?: number;
  frankingPercentage?: number;
  investmentAccountId?: string;
  investmentAccountRef?: string;
}

interface FlexibleTransaction {
  id?: string;
  type: string;
  date: string;
  price: number;
  units: number;
  fees?: number;
  notes?: string;
  investmentAccountId?: string;
  investmentAccountRef?: string;
  holdingId?: string;
  holdingRef?: string;
}

interface FlexibleDepreciationSchedule {
  id?: string;
  assetName: string;
  category: string;
  method: string;
  cost: number;
  rate: number;
  startDate: string;
  notes?: string;
  propertyId?: string;
  propertyRef?: string;
}

export interface FlexibleScenarioInput {
  scenarioId: string;
  name: string;
  description?: string;
  testUser: {
    email: string;
    name: string;
    password?: string;
  };
  data: {
    properties?: FlexibleProperty[];
    loans?: FlexibleLoan[];
    accounts?: FlexibleAccount[];
    income?: FlexibleIncome[];
    expenses?: FlexibleExpense[];
    investmentAccounts?: FlexibleInvestmentAccount[];
    holdings?: FlexibleHolding[];
    investmentTransactions?: FlexibleTransaction[];
    depreciationSchedules?: FlexibleDepreciationSchedule[];
  };
  expectedOutputs?: Record<string, unknown>;
}

// =============================================================================
// ID TO NAME MAPPING
// =============================================================================

/**
 * Build ID to name mapping from entities
 */
function buildIdToNameMap(entities: Array<{ id?: string; name: string }>): Map<string, string> {
  const map = new Map<string, string>();
  for (const entity of entities) {
    if (entity.id) {
      map.set(entity.id, entity.name);
    }
  }
  return map;
}

// =============================================================================
// NORMALIZERS
// =============================================================================

/**
 * Normalize property type
 */
function normalizePropertyType(type: string): TestPropertyInput['type'] {
  const normalized = type.toUpperCase();
  if (normalized === 'INVESTMENT' || normalized === 'INVESTOR') return 'INVESTMENT';
  return 'HOME';
}

/**
 * Normalize loan type
 */
function normalizeLoanType(type: string): TestLoanInput['type'] {
  const normalized = type.toUpperCase();
  if (normalized === 'INVESTMENT' || normalized === 'INVESTOR') return 'INVESTMENT';
  return 'HOME';
}

/**
 * Normalize account type
 */
function normalizeAccountType(type: string): TestAccountInput['type'] {
  const normalized = type.toUpperCase();
  if (normalized === 'OFFSET') return 'OFFSET';
  if (normalized === 'SAVINGS') return 'SAVINGS';
  if (normalized === 'CREDIT_CARD' || normalized === 'CREDIT') return 'CREDIT_CARD';
  return 'TRANSACTIONAL';
}

/**
 * Normalize income type
 */
function normalizeIncomeType(type: string): TestIncomeInput['type'] {
  const normalized = type.toUpperCase();
  if (normalized === 'SALARY') return 'SALARY';
  if (normalized === 'RENT' || normalized === 'RENTAL') return 'RENTAL';
  if (normalized === 'INVESTMENT' || normalized === 'DIVIDEND') return 'INVESTMENT';
  return 'OTHER';
}

/**
 * Normalize expense category
 */
function normalizeExpenseCategory(category: string): TestExpenseInput['category'] {
  const normalized = category.toUpperCase();
  const mapping: Record<string, TestExpenseInput['category']> = {
    HOUSING: 'HOUSING',
    RATES: 'RATES',
    INSURANCE: 'INSURANCE',
    MAINTENANCE: 'MAINTENANCE',
    PERSONAL: 'PERSONAL',
    UTILITIES: 'UTILITIES',
    FOOD: 'FOOD',
    TRANSPORT: 'TRANSPORT',
    ENTERTAINMENT: 'ENTERTAINMENT',
    SUBSCRIPTION: 'SUBSCRIPTION',
    STRATA: 'STRATA',
    LAND_TAX: 'LAND_TAX',
    LOAN_INTEREST: 'LOAN_INTEREST',
    REGISTRATION: 'REGISTRATION',
    MODIFICATIONS: 'MODIFICATIONS',
  };
  return mapping[normalized] || 'OTHER';
}

/**
 * Normalize frequency
 */
function normalizeFrequency(
  frequency: string
): 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' {
  const normalized = frequency.toUpperCase();
  if (normalized === 'WEEKLY') return 'WEEKLY';
  if (normalized === 'FORTNIGHTLY') return 'FORTNIGHTLY';
  if (normalized === 'MONTHLY') return 'MONTHLY';
  if (normalized === 'QUARTERLY') return 'QUARTERLY';
  if (normalized === 'ANNUAL' || normalized === 'YEARLY') return 'ANNUAL';
  return 'MONTHLY';
}

/**
 * Normalize loan repayment frequency (only WEEKLY, FORTNIGHTLY, MONTHLY allowed)
 */
function normalizeLoanRepaymentFrequency(
  frequency?: string
): 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' {
  if (!frequency) return 'MONTHLY';
  const normalized = frequency.toUpperCase();
  if (normalized === 'WEEKLY') return 'WEEKLY';
  if (normalized === 'FORTNIGHTLY') return 'FORTNIGHTLY';
  return 'MONTHLY';
}

/**
 * Normalize investment account type
 */
function normalizeInvestmentAccountType(
  type: string
): TestInvestmentAccountInput['type'] {
  const normalized = type.toUpperCase();
  if (normalized === 'BROKERAGE' || normalized === 'STOCKS') return 'BROKERAGE';
  if (normalized === 'SUPER' || normalized === 'SUPERS') return 'SUPERS';
  if (normalized === 'FUND') return 'FUND';
  if (normalized === 'TRUST') return 'TRUST';
  return 'BROKERAGE';
}

/**
 * Normalize holding type
 */
function normalizeHoldingType(type?: string): TestHoldingInput['type'] {
  if (!type) return 'SHARE';
  const normalized = type.toUpperCase();
  if (normalized === 'ETF') return 'ETF';
  if (normalized === 'MANAGED_FUND' || normalized === 'FUND') return 'MANAGED_FUND';
  if (normalized === 'CRYPTO') return 'CRYPTO';
  return 'SHARE';
}

// =============================================================================
// MAIN NORMALIZER
// =============================================================================

/**
 * Normalize flexible scenario input to standardized format
 */
export function normalizeScenario(input: FlexibleScenarioInput): TestScenarioInput {
  // Build ID-to-name mappings for reference resolution
  const propertyIdMap = buildIdToNameMap(input.data.properties || []);
  const accountIdMap = buildIdToNameMap(input.data.accounts || []);
  const loanIdMap = buildIdToNameMap(input.data.loans || []);
  const investmentAccountIdMap = buildIdToNameMap(input.data.investmentAccounts || []);

  // Build holding ticker map (id -> ticker)
  const holdingIdMap = new Map<string, string>();
  for (const h of input.data.holdings || []) {
    if (h.id) holdingIdMap.set(h.id, h.ticker);
  }

  // Normalize properties
  const properties: TestPropertyInput[] = (input.data.properties || []).map((p) => ({
    name: p.name,
    type: normalizePropertyType(p.type),
    address: p.address,
    purchasePrice: p.purchasePrice,
    purchaseDate: p.purchaseDate,
    currentValue: p.currentValue,
    valuationDate: p.valuationDate,
    latitude: p.latitude,
    longitude: p.longitude,
    suburb: p.suburb,
    state: p.state,
    postcode: p.postcode,
  }));

  // Normalize accounts
  const accounts: TestAccountInput[] = (input.data.accounts || []).map((a) => ({
    name: a.name,
    type: normalizeAccountType(a.type),
    institution: a.institution,
    currentBalance: a.balance ?? a.currentBalance ?? 0,
    interestRate: a.interestRate,
  }));

  // Normalize loans
  const loans: TestLoanInput[] = (input.data.loans || []).map((l) => {
    // Resolve property reference
    let propertyRef = l.propertyRef;
    if (!propertyRef && l.propertyId) {
      propertyRef = propertyIdMap.get(l.propertyId);
    }

    // Resolve offset account reference
    let offsetAccountRef = l.offsetAccountRef;
    if (!offsetAccountRef && l.offsetAccountId) {
      offsetAccountRef = accountIdMap.get(l.offsetAccountId);
    }

    // Determine if interest-only
    const isInterestOnly =
      l.isInterestOnly ??
      (l.type?.toLowerCase().includes('interest_only') ||
        l.type?.toLowerCase().includes('interest-only') ||
        l.type?.toLowerCase() === 'io');

    // Calculate monthly repayment from frequency if needed
    const monthlyRepayment = l.monthlyRepayment ?? l.minRepayment ?? 0;

    return {
      name: l.name,
      lender: l.lender,
      type: normalizeLoanType(l.type),
      principal: l.balance ?? l.principal ?? 0,
      interestRateAnnual: l.interestRate ?? l.interestRateAnnual ?? 0,
      rateType: (l.rateType?.toUpperCase() as 'VARIABLE' | 'FIXED') || 'VARIABLE',
      isInterestOnly,
      termMonthsRemaining: l.termMonthsRemaining ?? 360,
      minRepayment: monthlyRepayment,
      repaymentFrequency: normalizeLoanRepaymentFrequency(l.repaymentFrequency),
      fixedExpiry: l.fixedExpiry,
      extraRepaymentCap: l.extraRepaymentCap,
      propertyRef,
      offsetAccountRef,
    };
  });

  // Normalize income
  const income: TestIncomeInput[] = (input.data.income || []).map((i) => {
    // Resolve property reference
    let propertyRef = i.propertyRef;
    if (!propertyRef && i.propertyId) {
      propertyRef = propertyIdMap.get(i.propertyId);
    }

    // Resolve investment account reference
    let investmentAccountRef = i.investmentAccountRef;
    if (!investmentAccountRef && i.investmentAccountId) {
      investmentAccountRef = investmentAccountIdMap.get(i.investmentAccountId);
    }

    // Determine type from category if type not provided
    const type = normalizeIncomeType(i.type || i.category || 'OTHER');

    // Determine salary type from isNet
    let salaryType = i.salaryType as 'GROSS' | 'NET' | undefined;
    if (!salaryType && i.isNet !== undefined) {
      salaryType = i.isNet ? 'NET' : 'GROSS';
    }

    // Determine source type
    let sourceType = i.sourceType as 'GENERAL' | 'PROPERTY' | 'INVESTMENT' | undefined;
    if (!sourceType) {
      if (propertyRef || type === 'RENTAL') {
        sourceType = 'PROPERTY';
      } else if (investmentAccountRef || type === 'INVESTMENT') {
        sourceType = 'INVESTMENT';
      } else {
        sourceType = 'GENERAL';
      }
    }

    return {
      name: i.name,
      type,
      sourceType,
      amount: i.amount,
      frequency: normalizeFrequency(i.frequency),
      isTaxable: i.isTaxable ?? true,
      salaryType,
      superGuaranteeRate: i.superGuaranteeRate,
      salarySacrifice: i.salarySacrifice,
      frankingPercentage: i.frankingPercentage,
      propertyRef,
      investmentAccountRef,
      startDate: i.startDate,
      endDate: i.endDate,
    };
  });

  // Normalize expenses
  const expenses: TestExpenseInput[] = (input.data.expenses || []).map((e) => {
    // Resolve property reference
    let propertyRef = e.propertyRef;
    if (!propertyRef && e.propertyId) {
      propertyRef = propertyIdMap.get(e.propertyId);
    }

    // Resolve loan reference
    let loanRef = e.loanRef;
    if (!loanRef && e.loanId) {
      loanRef = loanIdMap.get(e.loanId);
    }

    // Resolve investment account reference
    let investmentAccountRef = e.investmentAccountRef;
    if (!investmentAccountRef && e.investmentAccountId) {
      investmentAccountRef = investmentAccountIdMap.get(e.investmentAccountId);
    }

    // Determine source type
    let sourceType = e.sourceType as 'GENERAL' | 'PROPERTY' | 'LOAN' | 'INVESTMENT' | 'ASSET' | undefined;
    if (!sourceType) {
      if (propertyRef) {
        sourceType = 'PROPERTY';
      } else if (loanRef) {
        sourceType = 'LOAN';
      } else if (investmentAccountRef) {
        sourceType = 'INVESTMENT';
      } else {
        sourceType = 'GENERAL';
      }
    }

    return {
      name: e.name,
      vendorName: e.vendorName,
      category: normalizeExpenseCategory(e.category),
      sourceType,
      amount: e.amount,
      frequency: normalizeFrequency(e.frequency),
      isEssential: e.isEssential ?? true,
      isTaxDeductible: e.isTaxDeductible ?? (sourceType === 'PROPERTY'),
      propertyRef,
      loanRef,
      investmentAccountRef,
      assetRef: e.assetRef,
    };
  });

  // Normalize investment accounts
  const investmentAccounts: TestInvestmentAccountInput[] = (
    input.data.investmentAccounts || []
  ).map((ia) => ({
    name: ia.name,
    type: normalizeInvestmentAccountType(ia.type),
    platform: ia.platform,
    currency: ia.currency || 'AUD',
    cashBalance: ia.balance ?? ia.cashBalance ?? 0,
    openingBalance: ia.openingBalance ?? 0,
    costBasisMethod: (ia.costBasisMethod?.toUpperCase() as 'FIFO' | 'LIFO' | 'HIFO' | 'SPECIFIC' | 'AVERAGE') || 'FIFO',
  }));

  // Normalize holdings
  const holdings: TestHoldingInput[] = (input.data.holdings || []).map((h) => {
    // Resolve investment account reference
    let investmentAccountRef = h.investmentAccountRef;
    if (!investmentAccountRef && h.investmentAccountId) {
      investmentAccountRef = investmentAccountIdMap.get(h.investmentAccountId) || '';
    }

    return {
      ticker: h.ticker,
      name: h.name,
      type: normalizeHoldingType(h.type),
      units: h.units,
      averagePrice: h.averagePrice ?? 0,
      currentPrice: h.currentPrice,
      frankingPercentage: h.frankingPercentage,
      investmentAccountRef: investmentAccountRef || '',
    };
  });

  // Normalize investment transactions
  const investmentTransactions: TestInvestmentTransactionInput[] = (
    input.data.investmentTransactions || []
  ).map((t) => {
    // Resolve investment account reference
    let investmentAccountRef = t.investmentAccountRef;
    if (!investmentAccountRef && t.investmentAccountId) {
      investmentAccountRef = investmentAccountIdMap.get(t.investmentAccountId) || '';
    }

    // Resolve holding reference
    let holdingRef = t.holdingRef;
    if (!holdingRef && t.holdingId) {
      holdingRef = holdingIdMap.get(t.holdingId);
    }

    return {
      type: t.type.toUpperCase() as TestInvestmentTransactionInput['type'],
      date: t.date,
      price: t.price,
      units: t.units,
      fees: t.fees,
      notes: t.notes,
      investmentAccountRef: investmentAccountRef || '',
      holdingRef,
    };
  });

  // Normalize depreciation schedules
  const depreciationSchedules: TestDepreciationScheduleInput[] = (
    input.data.depreciationSchedules || []
  ).map((d) => {
    // Resolve property reference
    let propertyRef = d.propertyRef;
    if (!propertyRef && d.propertyId) {
      propertyRef = propertyIdMap.get(d.propertyId) || '';
    }

    return {
      assetName: d.assetName,
      category: d.category.toUpperCase() as 'DIV40' | 'DIV43',
      method: d.method.toUpperCase() as 'PRIME_COST' | 'DIMINISHING_VALUE',
      cost: d.cost,
      rate: d.rate,
      startDate: d.startDate,
      notes: d.notes,
      propertyRef: propertyRef || '',
    };
  });

  return {
    scenarioId: input.scenarioId,
    name: input.name,
    description: input.description || '',
    testUser: input.testUser,
    data: {
      properties,
      accounts,
      loans,
      income,
      expenses,
      investmentAccounts,
      holdings,
      investmentTransactions,
      depreciationSchedules,
    },
    expectedOutputs: input.expectedOutputs as TestScenarioInput['expectedOutputs'],
  };
}
