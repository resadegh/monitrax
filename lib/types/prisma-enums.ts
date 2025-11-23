/**
 * Prisma-compatible type definitions
 *
 * These types mirror the Prisma schema enums and models.
 * Used when @prisma/client types are not available (e.g., before prisma generate).
 *
 * IMPORTANT: Keep these in sync with prisma/schema.prisma
 */

// =============================================================================
// ENUMS
// =============================================================================

export enum Frequency {
  WEEKLY = 'WEEKLY',
  FORTNIGHTLY = 'FORTNIGHTLY',
  MONTHLY = 'MONTHLY',
  ANNUAL = 'ANNUAL',
}

export enum RepaymentFrequency {
  WEEKLY = 'WEEKLY',
  FORTNIGHTLY = 'FORTNIGHTLY',
  MONTHLY = 'MONTHLY',
}

export enum LoanType {
  HOME = 'HOME',
  INVESTMENT = 'INVESTMENT',
}

export enum RateType {
  VARIABLE = 'VARIABLE',
  FIXED = 'FIXED',
}

export enum DepreciationCategory {
  DIV40 = 'DIV40',
  DIV43 = 'DIV43',
}

export enum DepreciationMethod {
  PRIME_COST = 'PRIME_COST',
  DIMINISHING_VALUE = 'DIMINISHING_VALUE',
}

export enum HoldingType {
  SHARE = 'SHARE',
  ETF = 'ETF',
  MANAGED_FUND = 'MANAGED_FUND',
  CRYPTO = 'CRYPTO',
}

export enum InvestmentTransactionType {
  BUY = 'BUY',
  SELL = 'SELL',
  DIVIDEND = 'DIVIDEND',
  DISTRIBUTION = 'DISTRIBUTION',
  DRP = 'DRP',
}

// =============================================================================
// MODEL INTERFACES
// =============================================================================

export interface DepreciationSchedule {
  id: string;
  propertyId: string;
  category: DepreciationCategory;
  assetName: string;
  cost: number;
  startDate: Date;
  rate: number;
  method: DepreciationMethod;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvestmentHolding {
  id: string;
  investmentAccountId: string;
  ticker: string;
  units: number;
  averagePrice: number;
  frankingPercentage: number | null;
  type: HoldingType;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvestmentTransaction {
  id: string;
  investmentAccountId: string;
  holdingId: string | null;
  date: Date;
  type: InvestmentTransactionType;
  price: number;
  units: number;
  fees: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
