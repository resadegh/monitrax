/**
 * Prisma-compatible type definitions
 *
 * These types mirror the Prisma schema enums and models.
 * Used when @prisma/client types are not available (e.g., before prisma generate).
 *
 * IMPORTANT: Keep these in sync with prisma/schema.prisma
 *
 * Note: Using string literal union types instead of TypeScript enums
 * for structural compatibility with Prisma's generated types.
 */

// =============================================================================
// ENUMS (as string literal union types for Prisma compatibility)
// =============================================================================

export type Frequency = 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';

export type RepaymentFrequency = 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY';

export type LoanType = 'HOME' | 'INVESTMENT';

export type RateType = 'VARIABLE' | 'FIXED';

export type DepreciationCategory = 'DIV40' | 'DIV43';

export type DepreciationMethod = 'PRIME_COST' | 'DIMINISHING_VALUE';

export type HoldingType = 'SHARE' | 'ETF' | 'MANAGED_FUND' | 'CRYPTO';

export type InvestmentTransactionType = 'BUY' | 'SELL' | 'DIVIDEND' | 'DISTRIBUTION' | 'DRP';

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
