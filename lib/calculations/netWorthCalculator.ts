/**
 * Net Worth Calculator
 *
 * Single source of truth for net worth calculations.
 * Blueprint §5.1: Never Duplicate Logic
 *
 * Replaces scattered net worth calculations in:
 * - app/api/financial-health/route.ts
 * - app/api/portfolio/snapshot/route.ts
 * - lib/health/aggregateEngine.ts
 */

// =============================================================================
// TYPES
// =============================================================================

export interface AssetSummary {
  properties: number;
  accounts: number;
  investments: number;
  superannuation: number;
  personalAssets: number;
  total: number;
}

export interface LiabilitySummary {
  mortgages: number;
  personalLoans: number;
  creditCards: number;
  total: number;
}

export interface NetWorthResult {
  netWorth: number;
  assets: AssetSummary;
  liabilities: LiabilitySummary;
  breakdown: {
    propertyEquity: number;
    liquidAssets: number;
    investmentAssets: number;
  };
}

// Input types for calculation.
//
// Phase 41a — `LegalEntity` ownership FK propagated through every input
// (Phase 41e.0 audit C-3). Optional + nullable on every shape; the
// `ownerEntityId` filter param on `calculateTotalAssets` /
// `calculateTotalLiabilities` defaults to "no filter" so omitting it
// preserves pre-41e behaviour exactly.
export interface PropertyInput {
  currentValue: number;
  type?: string;
  ownerEntityId?: string | null;
}

export interface AccountInput {
  currentBalance: number;
  type?: string;
  ownerEntityId?: string | null;
}

export interface InvestmentInput {
  units: number;
  currentPrice?: number;
  averagePrice?: number;
  ownerEntityId?: string | null;
}

export interface SuperInput {
  balance: number;
  ownerEntityId?: string | null;
  /**
   * Phase 39.5: 'SMSF' member accounts are EXCLUDED from the net-worth super
   * sum — their value flows through the SMSF LegalEntity's owned assets
   * (investment accounts / property / cash), which are summed separately.
   * Counting both would double-count the fund. Retail/industry accounts
   * (default, undefined) are summed as before.
   */
  fundType?: 'INDUSTRY' | 'RETAIL' | 'SMSF' | null;
}

export interface AssetInput {
  currentValue: number;
  ownerEntityId?: string | null;
}

export interface LoanInput {
  principal: number;
  type?: string;
  propertyId?: string | null;
  ownerEntityId?: string | null;
}

// =============================================================================
// CALCULATIONS
// =============================================================================

/**
 * Calculate total assets from all sources.
 *
 * `ownerEntityId` (Phase 41e.0 audit C-3): when provided, only assets
 * whose `ownerEntityId` matches are summed. Default = no filter for
 * backward-compat. Per audit doc §6.3.
 */
export function calculateTotalAssets(
  properties: PropertyInput[],
  accounts: AccountInput[],
  investments: InvestmentInput[],
  superannuation: SuperInput[] = [],
  personalAssets: AssetInput[] = [],
  ownerEntityId?: string,
): AssetSummary {
  const matchEntity = <T extends { ownerEntityId?: string | null }>(items: T[]): T[] =>
    ownerEntityId ? items.filter((x) => x.ownerEntityId === ownerEntityId) : items;

  const propertyTotal = matchEntity(properties).reduce(
    (sum, p) => sum + Number(p.currentValue || 0),
    0
  );

  const accountTotal = matchEntity(accounts).reduce(
    (sum, a) => sum + Number(a.currentBalance || 0),
    0
  );

  const investmentTotal = matchEntity(investments).reduce((sum, i) => {
    const price = Number(i.currentPrice || i.averagePrice || 0);
    const units = Number(i.units || 0);
    return sum + units * price;
  }, 0);

  // Phase 39.5: exclude SMSF member accounts — their wealth is represented by
  // the SMSF LegalEntity's owned assets (already summed above), so adding the
  // member balance too would double-count the fund.
  const superTotal = matchEntity(superannuation)
    .filter((s) => s.fundType !== 'SMSF')
    .reduce((sum, s) => sum + Number(s.balance || 0), 0);

  const assetTotal = matchEntity(personalAssets).reduce(
    (sum, a) => sum + Number(a.currentValue || 0),
    0
  );

  return {
    properties: propertyTotal,
    accounts: accountTotal,
    investments: investmentTotal,
    superannuation: superTotal,
    personalAssets: assetTotal,
    total: propertyTotal + accountTotal + investmentTotal + superTotal + assetTotal,
  };
}

/**
 * Calculate total liabilities from all loan sources.
 *
 * `ownerEntityId` (Phase 41e.0 audit C-3): when provided, only loans
 * whose `ownerEntityId` matches are summed. Default = no filter for
 * backward-compat. Per audit doc §6.3.
 */
/**
 * Calculate total liabilities, classified into mortgages / personal
 * loans / credit cards.
 *
 * **Contract** (verified by Phase 41i calc-audit fixture
 * `core.netWorth`):
 * - Loan classified as **mortgage** when `loan.type` (case-insensitive)
 *   is `'HOME'` or `'INVESTMENT'`, OR when `loan.propertyId` is set.
 *   This vocabulary matches `intelligence/portfolioEngine.ts`,
 *   `health/types.ts`, and `testing/types.ts`.
 * - Loan classified as **credit card** when `loan.type === 'CREDIT_CARD'`
 *   (case-insensitive).
 * - Anything else falls through to **personal loans** — including
 *   common typos like `'MORTGAGE'`, `'mortgage'`, etc. Reviewers
 *   touching loan-creation flows MUST use `'HOME'` / `'INVESTMENT'`
 *   for property loans.
 */
export function calculateTotalLiabilities(
  loans: LoanInput[],
  ownerEntityId?: string,
): LiabilitySummary {
  let mortgages = 0;
  let personalLoans = 0;
  let creditCards = 0;

  const filtered = ownerEntityId
    ? loans.filter((l) => l.ownerEntityId === ownerEntityId)
    : loans;

  for (const loan of filtered) {
    const principal = Number(loan.principal || 0);
    const type = loan.type?.toUpperCase() || '';

    if (type === 'HOME' || type === 'INVESTMENT' || loan.propertyId) {
      mortgages += principal;
    } else if (type === 'CREDIT_CARD') {
      creditCards += principal;
    } else {
      personalLoans += principal;
    }
  }

  return {
    mortgages,
    personalLoans,
    creditCards,
    total: mortgages + personalLoans + creditCards,
  };
}

/**
 * Calculate complete net worth with breakdown
 *
 * This is the canonical net worth calculation used throughout the app.
 */
export function calculateNetWorth(
  properties: PropertyInput[],
  accounts: AccountInput[],
  investments: InvestmentInput[],
  loans: LoanInput[],
  superannuation: SuperInput[] = [],
  personalAssets: AssetInput[] = []
): NetWorthResult {
  const assets = calculateTotalAssets(
    properties,
    accounts,
    investments,
    superannuation,
    personalAssets
  );

  const liabilities = calculateTotalLiabilities(loans);

  // Calculate property equity (property value - mortgages)
  const propertyEquity = assets.properties - liabilities.mortgages;

  // Liquid assets (accounts only, excluding offset which is against mortgage)
  const liquidAssets = accounts
    .filter((a) => a.type !== 'OFFSET')
    .reduce((sum, a) => sum + Number(a.currentBalance || 0), 0);

  // Investment assets (investments + super)
  const investmentAssets = assets.investments + assets.superannuation;

  return {
    netWorth: assets.total - liabilities.total,
    assets,
    liabilities,
    breakdown: {
      propertyEquity,
      liquidAssets,
      investmentAssets,
    },
  };
}

// =============================================================================
// Q-DEC PR 2.A — Decimal sibling path
// =============================================================================
//
// Mirror of the Float functions above, computing end-to-end in Decimal.
// Engines compose `Decimal` from the input boundary to the output boundary
// without ever rounding mid-arithmetic. Rounding happens later, when a
// caller invokes `fromDecimal(value, policy)`.
//
// The Float functions stay live for back-compat — every existing caller
// continues to work. The shadow-comparison harness (see
// `lib/calc-audit/engines/decimal-netWorth.ts`) runs BOTH paths on the
// same fixture inputs and surfaces any drift > policy tolerance.
//
// PR 3 will swap the route handlers + components to the Decimal path.
// PR 4 will delete the Float DB columns and the Float functions here.

import { Decimal, toDecimal, sumDecimal } from '@/lib/decimal';

export interface AssetSummaryDecimal {
  properties: Decimal;
  accounts: Decimal;
  investments: Decimal;
  superannuation: Decimal;
  personalAssets: Decimal;
  total: Decimal;
}

export interface LiabilitySummaryDecimal {
  mortgages: Decimal;
  personalLoans: Decimal;
  creditCards: Decimal;
  total: Decimal;
}

export interface NetWorthResultDecimal {
  netWorth: Decimal;
  assets: AssetSummaryDecimal;
  liabilities: LiabilitySummaryDecimal;
  breakdown: {
    propertyEquity: Decimal;
    liquidAssets: Decimal;
    investmentAssets: Decimal;
  };
}

/**
 * Decimal sibling of `calculateTotalAssets`. Same contract:
 *   - Phase 41e.0 `ownerEntityId` filter
 *   - Phase 39.5 SMSF super-account exclusion
 *   - Null-safe — missing values treated as 0 (matches `Number(x || 0)`).
 */
export function calculateTotalAssetsDecimal(
  properties: PropertyInput[],
  accounts: AccountInput[],
  investments: InvestmentInput[],
  superannuation: SuperInput[] = [],
  personalAssets: AssetInput[] = [],
  ownerEntityId?: string,
): AssetSummaryDecimal {
  const matchEntity = <T extends { ownerEntityId?: string | null }>(items: T[]): T[] =>
    ownerEntityId ? items.filter((x) => x.ownerEntityId === ownerEntityId) : items;

  const propertyTotal = sumDecimal(
    matchEntity(properties).map((p) => toDecimal(p.currentValue)),
  );

  const accountTotal = sumDecimal(
    matchEntity(accounts).map((a) => toDecimal(a.currentBalance)),
  );

  const investmentTotal = sumDecimal(
    matchEntity(investments).map((i) => {
      const price = toDecimal(i.currentPrice ?? i.averagePrice ?? 0) ?? new Decimal(0);
      const units = toDecimal(i.units) ?? new Decimal(0);
      return units.times(price);
    }),
  );

  // Phase 39.5: exclude SMSF member accounts (same rule as Float path).
  const superTotal = sumDecimal(
    matchEntity(superannuation)
      .filter((s) => s.fundType !== 'SMSF')
      .map((s) => toDecimal(s.balance)),
  );

  const assetTotal = sumDecimal(
    matchEntity(personalAssets).map((a) => toDecimal(a.currentValue)),
  );

  return {
    properties: propertyTotal,
    accounts: accountTotal,
    investments: investmentTotal,
    superannuation: superTotal,
    personalAssets: assetTotal,
    total: propertyTotal.plus(accountTotal).plus(investmentTotal).plus(superTotal).plus(assetTotal),
  };
}

/**
 * Decimal sibling of `calculateTotalLiabilities`. Same classification
 * contract (loan type HOME / INVESTMENT / propertyId → mortgage;
 * CREDIT_CARD → credit cards; everything else → personal loans).
 */
export function calculateTotalLiabilitiesDecimal(
  loans: LoanInput[],
  ownerEntityId?: string,
): LiabilitySummaryDecimal {
  let mortgages = new Decimal(0);
  let personalLoans = new Decimal(0);
  let creditCards = new Decimal(0);

  const filtered = ownerEntityId
    ? loans.filter((l) => l.ownerEntityId === ownerEntityId)
    : loans;

  for (const loan of filtered) {
    const principal = toDecimal(loan.principal) ?? new Decimal(0);
    const type = loan.type?.toUpperCase() || '';

    if (type === 'HOME' || type === 'INVESTMENT' || loan.propertyId) {
      mortgages = mortgages.plus(principal);
    } else if (type === 'CREDIT_CARD') {
      creditCards = creditCards.plus(principal);
    } else {
      personalLoans = personalLoans.plus(principal);
    }
  }

  return {
    mortgages,
    personalLoans,
    creditCards,
    total: mortgages.plus(personalLoans).plus(creditCards),
  };
}

/**
 * Decimal sibling of `calculateNetWorth`. End-to-end Decimal — no
 * rounding inside the engine.
 */
export function calculateNetWorthDecimal(
  properties: PropertyInput[],
  accounts: AccountInput[],
  investments: InvestmentInput[],
  loans: LoanInput[],
  superannuation: SuperInput[] = [],
  personalAssets: AssetInput[] = [],
): NetWorthResultDecimal {
  const assets = calculateTotalAssetsDecimal(
    properties,
    accounts,
    investments,
    superannuation,
    personalAssets,
  );

  const liabilities = calculateTotalLiabilitiesDecimal(loans);

  const propertyEquity = assets.properties.minus(liabilities.mortgages);

  const liquidAssets = sumDecimal(
    accounts.filter((a) => a.type !== 'OFFSET').map((a) => toDecimal(a.currentBalance)),
  );

  const investmentAssets = assets.investments.plus(assets.superannuation);

  return {
    netWorth: assets.total.minus(liabilities.total),
    assets,
    liabilities,
    breakdown: {
      propertyEquity,
      liquidAssets,
      investmentAssets,
    },
  };
}
