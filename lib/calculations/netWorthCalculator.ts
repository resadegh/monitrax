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

  const superTotal = matchEntity(superannuation).reduce(
    (sum, s) => sum + Number(s.balance || 0),
    0
  );

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
