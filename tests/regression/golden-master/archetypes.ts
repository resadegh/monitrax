/**
 * Phase 4 · Layer 2 — golden-master archetype fixtures.
 *
 * Six canonical Australian ownership structures. These are INPUTS ONLY — the
 * expected outputs are NEVER hand-authored here; they are captured from the
 * canonical engines into committed vitest snapshots (goldenMaster.test.ts).
 * A snapshot that changes is a regression signal: either the engine changed
 * intentionally (update the snapshot in the same PR) or a bug crept in.
 *
 * Shapes mirror the canonical engine input contracts:
 *   - calculateNetWorth        (lib/calculations/netWorthCalculator.ts)
 *   - calculateCashflow        (lib/calculations/cashflowOrchestrator.ts)
 *   - buildEntityBreakdown     (lib/calculations/entityBreakdown.ts)
 *   - computePropertyDisposalCgt (lib/cfo/scenarios/propertyDisposalCgt.ts)
 */

import type {
  PropertyInput,
  AccountInput,
  InvestmentInput,
  SuperInput,
  AssetInput,
  LoanInput,
} from '@/lib/calculations/netWorthCalculator';
import type { ExpenseItem, LoanItem } from '@/lib/calculations/cashflowOrchestrator';
import type { EntityRef, EntityBreakdownInput } from '@/lib/calculations/entityBreakdown';
import type { BankedIncomeRow } from '@/lib/income/banked/types';
import type { TaxYearConfig } from '@/lib/tax-engine/types';
import {
  buildBankedIncome,
  buildBankedIncomeDecimal,
  bankedTotalsFromResult,
  bankedTotalsFromResultDecimal,
  type BankedIncomeResult,
  type BankedIncomeResultDecimal,
} from '@/lib/income/banked/aggregator';
import type { PropertyOwner } from '@/lib/cfo/scenarios/propertyDisposalCgt';
import type { CgtEligibleEntityType } from '@/lib/tax-engine/divisions/cgtDiscount';

/** A representative property disposal for the CGT-split capture (inputs only). */
export interface DisposalFixture {
  proceeds: number;
  sellingCosts: number;
  costBase: number;
  acquisitionDate: Date;
  owners: Array<PropertyOwner & { weight: number }>;
  userMarginalRate: number;
}

export interface Archetype {
  key: string;
  label: string;
  entities: EntityRef[];
  properties: Array<PropertyInput & { currentValue: number }>;
  accounts: Array<AccountInput & { currentBalance: number; type: string }>;
  investments: InvestmentInput[];
  superannuation: SuperInput[];
  personalAssets: AssetInput[];
  loans: Array<LoanInput & { principal: number }>;
  income: BankedIncomeRow[];
  expenses: ExpenseItem[];
  cashflowLoans: LoanItem[];
  disposal: DisposalFixture;
}

/**
 * MON-131 T1-B: income enters the cashflow orchestrator as pre-computed
 * BANKED totals from the ONE engine (MON-137 culprit removed). This helper
 * runs the archetype's income rows through the real banked path (Float +
 * Decimal) so both regression suites exercise the production wiring.
 * Fixture rows have no user context → repaymentIncome null (HELP
 * undetermined, flagged by the engine — never asserted zero).
 */
export function bankedIncomeFixture(
  a: Archetype,
  config: TaxYearConfig,
): {
  rows: BankedIncomeRow[];
  banked: BankedIncomeResult;
  bankedDecimal: BankedIncomeResultDecimal;
  incomeTotals: ReturnType<typeof bankedTotalsFromResult>;
  incomeTotalsDecimal: ReturnType<typeof bankedTotalsFromResultDecimal>;
} {
  const rows = a.income.map((r, i) => ({ ...r, id: r.id ?? `${a.key}-inc-${i}` }));
  const input = {
    income: rows,
    properties: [],
    derivedAgentExpenses: [],
    transactions: [],
    ctx: { config, repaymentIncome: null },
  };
  const banked = buildBankedIncome(input);
  const bankedDecimal = buildBankedIncomeDecimal(input);
  return {
    rows,
    banked,
    bankedDecimal,
    incomeTotals: bankedTotalsFromResult(banked),
    incomeTotalsDecimal: bankedTotalsFromResultDecimal(bankedDecimal),
  };
}

// Fixed dates so monthsHeld (and therefore the >12-month discount test) is
// deterministic regardless of when CI runs.
const HELD_LONG = new Date('2019-03-01T00:00:00Z'); // > 12 months held
const YOU = (over: Partial<PropertyOwner> & Pick<PropertyOwner, 'entityId' | 'entityType'>): PropertyOwner => ({
  name: over.name ?? over.entityId,
  isYou: over.isYou ?? false,
  isComplying: over.isComplying ?? true,
  isForeignResident: over.isForeignResident ?? false,
  ...over,
});
const o = (
  entityId: string,
  entityType: CgtEligibleEntityType,
  weight: number,
  extra: Partial<PropertyOwner> = {},
) => ({ ...YOU({ entityId, entityType, ...extra }), weight });

export const ARCHETYPES: Archetype[] = [
  // 1) Sole owner — one personal entity owns everything.
  {
    key: 'sole-owner',
    label: 'Sole owner (single individual)',
    entities: [{ id: 'you', name: 'You', type: 'PERSONAL_NAME' }],
    properties: [{ currentValue: 850_000, type: 'HOME', ownerEntityId: 'you' }],
    accounts: [
      { currentBalance: 40_000, type: 'SAVINGS', ownerEntityId: 'you' },
      { currentBalance: 15_000, type: 'OFFSET', ownerEntityId: 'you' },
    ],
    investments: [{ units: 1000, currentPrice: 35, averagePrice: 20, ownerEntityId: 'you' }],
    superannuation: [{ balance: 180_000, fundType: 'RETAIL', ownerEntityId: 'you' }],
    personalAssets: [{ currentValue: 25_000, ownerEntityId: 'you' }],
    loans: [{ principal: 520_000, type: 'HOME', propertyId: 'p1', ownerEntityId: 'you' }],
    income: [{ amount: 9_000, frequency: 'MONTHLY', type: 'SALARY', isTaxable: true, ownerEntityId: 'you' }],
    expenses: [
      { amount: 3_500, frequency: 'MONTHLY', isEssential: true, category: 'LIVING', ownerEntityId: 'you' },
      { amount: 800, frequency: 'MONTHLY', isEssential: false, category: 'LIFESTYLE', ownerEntityId: 'you' },
    ],
    cashflowLoans: [{ minRepayment: 2_900, repaymentFrequency: 'MONTHLY', principal: 520_000, interestRate: 6.1, ownerEntityId: 'you' }],
    disposal: {
      proceeds: 1_000_000, sellingCosts: 20_000, costBase: 600_000, acquisitionDate: HELD_LONG,
      owners: [o('you', 'PERSONAL_NAME', 1, { isYou: true, name: 'You' })], userMarginalRate: 0.39,
    },
  },

  // 2) Couple 50/50 — two personal entities, joint tenants.
  {
    key: 'couple-50-50',
    label: 'Couple, joint tenants 50/50',
    entities: [
      { id: 'you', name: 'You', type: 'PERSONAL_NAME' },
      { id: 'spouse', name: 'Sarah', type: 'PERSONAL_NAME' },
    ],
    properties: [
      { currentValue: 600_000, type: 'HOME', ownerEntityId: 'you' },
      { currentValue: 600_000, type: 'HOME', ownerEntityId: 'spouse' },
    ],
    accounts: [
      { currentBalance: 30_000, type: 'SAVINGS', ownerEntityId: 'you' },
      { currentBalance: 30_000, type: 'SAVINGS', ownerEntityId: 'spouse' },
    ],
    investments: [{ units: 500, currentPrice: 50, averagePrice: 40, ownerEntityId: 'you' }],
    superannuation: [
      { balance: 150_000, fundType: 'INDUSTRY', ownerEntityId: 'you' },
      { balance: 120_000, fundType: 'INDUSTRY', ownerEntityId: 'spouse' },
    ],
    personalAssets: [],
    loans: [
      { principal: 300_000, type: 'HOME', propertyId: 'p1', ownerEntityId: 'you' },
      { principal: 300_000, type: 'HOME', propertyId: 'p1', ownerEntityId: 'spouse' },
    ],
    income: [
      { amount: 7_000, frequency: 'MONTHLY', type: 'SALARY', isTaxable: true, ownerEntityId: 'you' },
      { amount: 6_000, frequency: 'MONTHLY', type: 'SALARY', isTaxable: true, ownerEntityId: 'spouse' },
    ],
    expenses: [{ amount: 5_000, frequency: 'MONTHLY', isEssential: true, category: 'LIVING', ownerEntityId: 'you' }],
    cashflowLoans: [{ minRepayment: 3_400, repaymentFrequency: 'MONTHLY', principal: 600_000, interestRate: 6.0, ownerEntityId: 'you' }],
    disposal: {
      proceeds: 1_200_000, sellingCosts: 24_000, costBase: 700_000, acquisitionDate: HELD_LONG,
      owners: [
        o('you', 'PERSONAL_NAME', 0.5, { isYou: true, name: 'You' }),
        o('spouse', 'PERSONAL_NAME', 0.5, { name: 'Sarah' }),
      ],
      userMarginalRate: 0.37,
    },
  },

  // 3) Discretionary trust — trust owns the investment property.
  {
    key: 'discretionary-trust',
    label: 'Discretionary (family) trust',
    entities: [
      { id: 'you', name: 'You', type: 'PERSONAL_NAME' },
      { id: 'trust', name: 'Smith Family Trust', type: 'DISCRETIONARY_TRUST' },
    ],
    properties: [{ currentValue: 750_000, type: 'INVESTMENT', ownerEntityId: 'trust' }],
    accounts: [
      { currentBalance: 20_000, type: 'SAVINGS', ownerEntityId: 'you' },
      { currentBalance: 55_000, type: 'SAVINGS', ownerEntityId: 'trust' },
    ],
    investments: [{ units: 2000, currentPrice: 30, averagePrice: 25, ownerEntityId: 'trust' }],
    superannuation: [{ balance: 210_000, fundType: 'RETAIL', ownerEntityId: 'you' }],
    personalAssets: [],
    loans: [{ principal: 400_000, type: 'INVESTMENT', propertyId: 'p1', ownerEntityId: 'trust' }],
    income: [
      { amount: 8_500, frequency: 'MONTHLY', type: 'SALARY', isTaxable: true, ownerEntityId: 'you' },
      { amount: 3_200, frequency: 'MONTHLY', type: 'RENT', isTaxable: true, ownerEntityId: 'trust' },
    ],
    expenses: [
      { amount: 4_000, frequency: 'MONTHLY', isEssential: true, category: 'LIVING', ownerEntityId: 'you' },
      { amount: 1_100, frequency: 'MONTHLY', isEssential: true, isTaxDeductible: true, category: 'PROPERTY', ownerEntityId: 'trust' },
    ],
    cashflowLoans: [{ minRepayment: 2_300, repaymentFrequency: 'MONTHLY', principal: 400_000, interestRate: 6.4, ownerEntityId: 'trust' }],
    disposal: {
      proceeds: 900_000, sellingCosts: 18_000, costBase: 500_000, acquisitionDate: HELD_LONG,
      owners: [o('trust', 'DISCRETIONARY_TRUST', 1, { name: 'Smith Family Trust' })], userMarginalRate: 0.39,
    },
  },

  // 4) SMSF — fund owns property + investment account; member super excluded.
  {
    key: 'smsf',
    label: 'SMSF (self-managed super fund)',
    entities: [
      { id: 'you', name: 'You', type: 'PERSONAL_NAME' },
      { id: 'smsf', name: 'Reza SMSF', type: 'SMSF' },
    ],
    properties: [{ currentValue: 680_000, type: 'INVESTMENT', ownerEntityId: 'smsf' }],
    accounts: [
      { currentBalance: 25_000, type: 'SAVINGS', ownerEntityId: 'you' },
      { currentBalance: 90_000, type: 'SAVINGS', ownerEntityId: 'smsf' },
    ],
    investments: [{ units: 3000, currentPrice: 40, averagePrice: 28, ownerEntityId: 'smsf' }],
    // member account flagged SMSF → excluded from the net-worth super sum
    // (its wealth is the fund's owned assets above).
    superannuation: [{ balance: 500_000, fundType: 'SMSF', ownerEntityId: 'smsf' }],
    personalAssets: [],
    loans: [{ principal: 350_000, type: 'INVESTMENT', propertyId: 'p1', ownerEntityId: 'smsf' }],
    income: [{ amount: 10_000, frequency: 'MONTHLY', type: 'SALARY', isTaxable: true, ownerEntityId: 'you' }],
    expenses: [{ amount: 4_500, frequency: 'MONTHLY', isEssential: true, category: 'LIVING', ownerEntityId: 'you' }],
    cashflowLoans: [{ minRepayment: 2_000, repaymentFrequency: 'MONTHLY', principal: 350_000, interestRate: 6.2, ownerEntityId: 'smsf' }],
    disposal: {
      proceeds: 820_000, sellingCosts: 16_000, costBase: 480_000, acquisitionDate: HELD_LONG,
      owners: [o('smsf', 'SMSF', 1, { name: 'Reza SMSF', isComplying: true })], userMarginalRate: 0.39,
    },
  },

  // 5) Company — bucket company owns the asset; 0% CGT discount.
  {
    key: 'company',
    label: 'Company (bucket/trading)',
    entities: [
      { id: 'you', name: 'You', type: 'PERSONAL_NAME' },
      { id: 'co', name: 'Renew Holdings Pty Ltd', type: 'COMPANY' },
    ],
    properties: [{ currentValue: 1_100_000, type: 'INVESTMENT', ownerEntityId: 'co' }],
    accounts: [
      { currentBalance: 18_000, type: 'SAVINGS', ownerEntityId: 'you' },
      { currentBalance: 120_000, type: 'SAVINGS', ownerEntityId: 'co' },
    ],
    investments: [{ units: 5000, currentPrice: 22, averagePrice: 15, ownerEntityId: 'co' }],
    superannuation: [{ balance: 160_000, fundType: 'RETAIL', ownerEntityId: 'you' }],
    personalAssets: [],
    loans: [{ principal: 600_000, type: 'INVESTMENT', propertyId: 'p1', ownerEntityId: 'co' }],
    income: [
      { amount: 9_500, frequency: 'MONTHLY', type: 'SALARY', isTaxable: true, ownerEntityId: 'you' },
      { amount: 4_000, frequency: 'MONTHLY', type: 'RENT', isTaxable: true, ownerEntityId: 'co' },
    ],
    expenses: [{ amount: 4_200, frequency: 'MONTHLY', isEssential: true, category: 'LIVING', ownerEntityId: 'you' }],
    cashflowLoans: [{ minRepayment: 3_500, repaymentFrequency: 'MONTHLY', principal: 600_000, interestRate: 6.5, ownerEntityId: 'co' }],
    disposal: {
      proceeds: 1_400_000, sellingCosts: 28_000, costBase: 800_000, acquisitionDate: HELD_LONG,
      owners: [o('co', 'COMPANY', 1, { name: 'Renew Holdings Pty Ltd' })], userMarginalRate: 0.39,
    },
  },

  // 6) Mixed entity portfolio — you + trust + company + SMSF, assets spread.
  {
    key: 'mixed-portfolio',
    label: 'Mixed entity portfolio',
    entities: [
      { id: 'you', name: 'You', type: 'PERSONAL_NAME' },
      { id: 'spouse', name: 'Sarah', type: 'PERSONAL_NAME' },
      { id: 'trust', name: 'Smith Family Trust', type: 'DISCRETIONARY_TRUST' },
      { id: 'co', name: 'Renew Holdings Pty Ltd', type: 'COMPANY' },
      { id: 'smsf', name: 'Reza SMSF', type: 'SMSF' },
    ],
    properties: [
      { currentValue: 900_000, type: 'HOME', ownerEntityId: 'you' },
      { currentValue: 700_000, type: 'INVESTMENT', ownerEntityId: 'trust' },
      { currentValue: 650_000, type: 'INVESTMENT', ownerEntityId: 'smsf' },
    ],
    accounts: [
      { currentBalance: 35_000, type: 'SAVINGS', ownerEntityId: 'you' },
      { currentBalance: 22_000, type: 'OFFSET', ownerEntityId: 'you' },
      { currentBalance: 60_000, type: 'SAVINGS', ownerEntityId: 'trust' },
      { currentBalance: 140_000, type: 'SAVINGS', ownerEntityId: 'co' },
      { currentBalance: 80_000, type: 'SAVINGS', ownerEntityId: 'smsf' },
    ],
    investments: [
      { units: 1500, currentPrice: 38, averagePrice: 30, ownerEntityId: 'co' },
      { units: 2500, currentPrice: 41, averagePrice: 33, ownerEntityId: 'smsf' },
    ],
    superannuation: [
      { balance: 175_000, fundType: 'RETAIL', ownerEntityId: 'you' },
      { balance: 540_000, fundType: 'SMSF', ownerEntityId: 'smsf' },
    ],
    personalAssets: [{ currentValue: 45_000, ownerEntityId: 'you' }],
    loans: [
      { principal: 480_000, type: 'HOME', propertyId: 'p1', ownerEntityId: 'you' },
      { principal: 420_000, type: 'INVESTMENT', propertyId: 'p2', ownerEntityId: 'trust' },
      { principal: 300_000, type: 'INVESTMENT', propertyId: 'p3', ownerEntityId: 'smsf' },
      { principal: 12_000, type: 'CREDIT_CARD', ownerEntityId: 'you' },
    ],
    income: [
      { amount: 11_000, frequency: 'MONTHLY', type: 'SALARY', isTaxable: true, ownerEntityId: 'you' },
      { amount: 6_500, frequency: 'MONTHLY', type: 'SALARY', isTaxable: true, ownerEntityId: 'spouse' },
      { amount: 3_000, frequency: 'MONTHLY', type: 'RENT', isTaxable: true, ownerEntityId: 'trust' },
    ],
    expenses: [
      { amount: 6_000, frequency: 'MONTHLY', isEssential: true, category: 'LIVING', ownerEntityId: 'you' },
      { amount: 1_500, frequency: 'MONTHLY', isEssential: false, category: 'LIFESTYLE', ownerEntityId: 'spouse' },
    ],
    cashflowLoans: [
      { minRepayment: 2_800, repaymentFrequency: 'MONTHLY', principal: 480_000, interestRate: 6.0, ownerEntityId: 'you' },
      { minRepayment: 2_400, repaymentFrequency: 'MONTHLY', principal: 420_000, interestRate: 6.4, ownerEntityId: 'trust' },
    ],
    disposal: {
      proceeds: 980_000, sellingCosts: 19_600, costBase: 540_000, acquisitionDate: HELD_LONG,
      owners: [o('trust', 'DISCRETIONARY_TRUST', 1, { name: 'Smith Family Trust' })], userMarginalRate: 0.45,
    },
  },
];
