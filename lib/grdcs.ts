/**
 * GRDCS - Global Relational Data Consistency Standard
 *
 * Provides standardized relational payload format across all API endpoints.
 * Ensures consistent linked data structure for cross-module navigation.
 */

// Entity types supported by GRDCS
export type GRDCSEntityType =
  | 'property'
  | 'loan'
  | 'income'
  | 'expense'
  | 'account'
  | 'investmentAccount'
  | 'investmentHolding'
  | 'investmentTransaction'
  | 'depreciationSchedule';

// Universal relational entity shape
export interface GRDCSLinkedEntity {
  id: string;
  type: GRDCSEntityType;
  name: string;
  href: string;
  summary?: string;
  value?: number;
  metadata?: Record<string, unknown>;
}

// Missing link indicator
export interface GRDCSMissingLink {
  type: GRDCSEntityType;
  reason: string;
  suggestedAction?: string;
}

// Standard response wrapper for single entity
export interface GRDCSResponse<T> {
  data: T;
  _links: {
    self: string;
    related: GRDCSLinkedEntity[];
  };
  _meta: {
    linkedCount: number;
    missingLinks: GRDCSMissingLink[];
  };
}

// Standard response wrapper for entity list
export interface GRDCSListResponse<T> {
  data: T[];
  _meta: {
    count: number;
    totalLinkedEntities: number;
  };
}

// Route mappings for href generation
const ROUTE_MAP: Record<GRDCSEntityType, string> = {
  property: '/dashboard/properties',
  loan: '/dashboard/loans',
  income: '/dashboard/income',
  expense: '/dashboard/expenses',
  account: '/dashboard/accounts',
  investmentAccount: '/dashboard/investments/accounts',
  investmentHolding: '/dashboard/investments/holdings',
  investmentTransaction: '/dashboard/investments/transactions',
  depreciationSchedule: '/dashboard/properties',
};

/**
 * Generate href for an entity
 */
export function generateHref(type: GRDCSEntityType, id: string): string {
  return `${ROUTE_MAP[type]}?id=${id}`;
}

/**
 * Create a GRDCS linked entity from raw data
 */
export function createLinkedEntity(
  type: GRDCSEntityType,
  id: string,
  name: string,
  options?: {
    summary?: string;
    value?: number;
    metadata?: Record<string, unknown>;
  }
): GRDCSLinkedEntity {
  return {
    id,
    type,
    name,
    href: generateHref(type, id),
    ...(options?.summary && { summary: options.summary }),
    ...(options?.value !== undefined && { value: options.value }),
    ...(options?.metadata && { metadata: options.metadata }),
  };
}

/**
 * Extract linked entities from a property
 */
export function extractPropertyLinks(property: {
  id: string;
  loans?: Array<{ id: string; name: string; principal: number; offsetAccount?: { id: string; name: string; currentBalance: number } | null }>;
  income?: Array<{ id: string; name: string; amount: number }>;
  expenses?: Array<{ id: string; name: string; amount: number }>;
  depreciationSchedules?: Array<{ id: string; assetName: string; annualDeduction?: number }>;
}): { linked: GRDCSLinkedEntity[]; missing: GRDCSMissingLink[] } {
  const linked: GRDCSLinkedEntity[] = [];
  const missing: GRDCSMissingLink[] = [];

  // Loans
  if (property.loans && property.loans.length > 0) {
    property.loans.forEach(loan => {
      linked.push(createLinkedEntity('loan', loan.id, loan.name, {
        value: loan.principal,
        summary: `Principal: $${loan.principal.toLocaleString()}`,
      }));

      // Offset accounts from loans
      if (loan.offsetAccount) {
        linked.push(createLinkedEntity('account', loan.offsetAccount.id, loan.offsetAccount.name, {
          value: loan.offsetAccount.currentBalance,
          summary: `Offset Balance: $${loan.offsetAccount.currentBalance.toLocaleString()}`,
        }));
      }
    });
  } else {
    missing.push({
      type: 'loan',
      reason: 'No loans linked to this property',
      suggestedAction: 'Link a loan to track LVR and equity',
    });
  }

  // Income
  if (property.income && property.income.length > 0) {
    property.income.forEach(inc => {
      linked.push(createLinkedEntity('income', inc.id, inc.name, {
        value: inc.amount,
        summary: `Amount: $${inc.amount.toLocaleString()}`,
      }));
    });
  }

  // Expenses
  if (property.expenses && property.expenses.length > 0) {
    property.expenses.forEach(exp => {
      linked.push(createLinkedEntity('expense', exp.id, exp.name, {
        value: exp.amount,
        summary: `Amount: $${exp.amount.toLocaleString()}`,
      }));
    });
  }

  // Depreciation Schedules
  if (property.depreciationSchedules && property.depreciationSchedules.length > 0) {
    property.depreciationSchedules.forEach(dep => {
      linked.push(createLinkedEntity('depreciationSchedule', dep.id, dep.assetName, {
        value: dep.annualDeduction,
        summary: dep.annualDeduction ? `Annual: $${dep.annualDeduction.toLocaleString()}` : undefined,
      }));
    });
  }

  return { linked, missing };
}

/**
 * Extract linked entities from a loan
 */
export function extractLoanLinks(loan: {
  id: string;
  property?: { id: string; name: string; currentValue: number } | null;
  offsetAccount?: { id: string; name: string; currentBalance: number } | null;
  expenses?: Array<{ id: string; name: string; amount: number }>;
}): { linked: GRDCSLinkedEntity[]; missing: GRDCSMissingLink[] } {
  const linked: GRDCSLinkedEntity[] = [];
  const missing: GRDCSMissingLink[] = [];

  // Property
  if (loan.property) {
    linked.push(createLinkedEntity('property', loan.property.id, loan.property.name, {
      value: loan.property.currentValue,
      summary: `Value: $${loan.property.currentValue.toLocaleString()}`,
    }));
  } else {
    missing.push({
      type: 'property',
      reason: 'No property linked to this loan',
      suggestedAction: 'Link to a property for accurate LVR calculation',
    });
  }

  // Offset Account
  if (loan.offsetAccount) {
    linked.push(createLinkedEntity('account', loan.offsetAccount.id, loan.offsetAccount.name, {
      value: loan.offsetAccount.currentBalance,
      summary: `Balance: $${loan.offsetAccount.currentBalance.toLocaleString()}`,
    }));
  }

  // Expenses (interest, fees)
  if (loan.expenses && loan.expenses.length > 0) {
    loan.expenses.forEach(exp => {
      linked.push(createLinkedEntity('expense', exp.id, exp.name, {
        value: exp.amount,
        summary: `Amount: $${exp.amount.toLocaleString()}`,
      }));
    });
  }

  return { linked, missing };
}

/**
 * Extract linked entities from income
 */
export function extractIncomeLinks(income: {
  id: string;
  property?: { id: string; name: string; currentValue: number } | null;
  investmentAccount?: { id: string; name: string } | null;
}): { linked: GRDCSLinkedEntity[]; missing: GRDCSMissingLink[] } {
  const linked: GRDCSLinkedEntity[] = [];
  const missing: GRDCSMissingLink[] = [];

  // Property
  if (income.property) {
    linked.push(createLinkedEntity('property', income.property.id, income.property.name, {
      value: income.property.currentValue,
      summary: `Value: $${income.property.currentValue.toLocaleString()}`,
    }));
  }

  // Investment Account
  if (income.investmentAccount) {
    linked.push(createLinkedEntity('investmentAccount', income.investmentAccount.id, income.investmentAccount.name));
  }

  // Check if unlinked
  if (!income.property && !income.investmentAccount) {
    missing.push({
      type: 'property',
      reason: 'Income not linked to any property or investment',
      suggestedAction: 'Link to a property or investment account for better tracking',
    });
  }

  return { linked, missing };
}

/**
 * Extract linked entities from expense
 */
export function extractExpenseLinks(expense: {
  id: string;
  property?: { id: string; name: string; currentValue: number } | null;
  loan?: { id: string; name: string; principal: number } | null;
  investmentAccount?: { id: string; name: string } | null;
}): { linked: GRDCSLinkedEntity[]; missing: GRDCSMissingLink[] } {
  const linked: GRDCSLinkedEntity[] = [];
  const missing: GRDCSMissingLink[] = [];

  // Property
  if (expense.property) {
    linked.push(createLinkedEntity('property', expense.property.id, expense.property.name, {
      value: expense.property.currentValue,
      summary: `Value: $${expense.property.currentValue.toLocaleString()}`,
    }));
  }

  // Loan
  if (expense.loan) {
    linked.push(createLinkedEntity('loan', expense.loan.id, expense.loan.name, {
      value: expense.loan.principal,
      summary: `Principal: $${expense.loan.principal.toLocaleString()}`,
    }));
  }

  // Investment Account
  if (expense.investmentAccount) {
    linked.push(createLinkedEntity('investmentAccount', expense.investmentAccount.id, expense.investmentAccount.name));
  }

  return { linked, missing };
}

/**
 * Extract linked entities from account
 */
export function extractAccountLinks(account: {
  id: string;
  linkedLoan?: { id: string; name: string; principal: number } | null;
}): { linked: GRDCSLinkedEntity[]; missing: GRDCSMissingLink[] } {
  const linked: GRDCSLinkedEntity[] = [];
  const missing: GRDCSMissingLink[] = [];

  // Linked Loan (offset)
  if (account.linkedLoan) {
    linked.push(createLinkedEntity('loan', account.linkedLoan.id, account.linkedLoan.name, {
      value: account.linkedLoan.principal,
      summary: `Principal: $${account.linkedLoan.principal.toLocaleString()}`,
    }));
  }

  return { linked, missing };
}

/**
 * Extract linked entities from investment account
 */
export function extractInvestmentAccountLinks(account: {
  id: string;
  holdings?: Array<{ id: string; ticker: string; units: number; averagePrice: number }>;
  transactions?: Array<{ id: string; type: string; date: string; units: number; price: number }>;
  incomes?: Array<{ id: string; name: string; amount: number }>;
  expenses?: Array<{ id: string; name: string; amount: number }>;
}): { linked: GRDCSLinkedEntity[]; missing: GRDCSMissingLink[] } {
  const linked: GRDCSLinkedEntity[] = [];
  const missing: GRDCSMissingLink[] = [];

  // Holdings
  if (account.holdings && account.holdings.length > 0) {
    account.holdings.forEach(holding => {
      const value = holding.units * holding.averagePrice;
      linked.push(createLinkedEntity('investmentHolding', holding.id, holding.ticker, {
        value,
        summary: `${holding.units} units @ $${holding.averagePrice.toFixed(2)}`,
      }));
    });
  }

  // Recent Transactions
  if (account.transactions && account.transactions.length > 0) {
    account.transactions.slice(0, 5).forEach(tx => {
      linked.push(createLinkedEntity('investmentTransaction', tx.id, `${tx.type} - ${tx.date}`, {
        value: tx.units * tx.price,
        summary: `${tx.units} units @ $${tx.price.toFixed(2)}`,
      }));
    });
  }

  // Income
  if (account.incomes && account.incomes.length > 0) {
    account.incomes.forEach(inc => {
      linked.push(createLinkedEntity('income', inc.id, inc.name, {
        value: inc.amount,
        summary: `Amount: $${inc.amount.toLocaleString()}`,
      }));
    });
  }

  // Expenses
  if (account.expenses && account.expenses.length > 0) {
    account.expenses.forEach(exp => {
      linked.push(createLinkedEntity('expense', exp.id, exp.name, {
        value: exp.amount,
        summary: `Amount: $${exp.amount.toLocaleString()}`,
      }));
    });
  }

  return { linked, missing };
}

/**
 * Extract linked entities from investment holding
 */
export function extractHoldingLinks(holding: {
  id: string;
  investmentAccount?: { id: string; name: string; platform?: string | null; currency?: string } | null;
  transactions?: Array<{ id: string; type: string; date: string; units: number; price: number }>;
}): { linked: GRDCSLinkedEntity[]; missing: GRDCSMissingLink[] } {
  const linked: GRDCSLinkedEntity[] = [];
  const missing: GRDCSMissingLink[] = [];

  // Investment Account
  if (holding.investmentAccount) {
    linked.push(createLinkedEntity('investmentAccount', holding.investmentAccount.id, holding.investmentAccount.name, {
      summary: holding.investmentAccount.platform || undefined,
      metadata: { currency: holding.investmentAccount.currency },
    }));
  }

  // Transactions
  if (holding.transactions && holding.transactions.length > 0) {
    holding.transactions.forEach(tx => {
      linked.push(createLinkedEntity('investmentTransaction', tx.id, `${tx.type} - ${tx.date}`, {
        value: tx.units * tx.price,
        summary: `${tx.units} units @ $${tx.price.toFixed(2)}`,
      }));
    });
  }

  return { linked, missing };
}

/**
 * Wrap entity with GRDCS metadata (backwards-compatible)
 * Returns original entity data with _links and _meta appended
 */
export function wrapWithGRDCS<T extends Record<string, unknown>>(
  entity: T,
  entityType: GRDCSEntityType,
  links: { linked: GRDCSLinkedEntity[]; missing: GRDCSMissingLink[] }
): T & { _links: { self: string; related: GRDCSLinkedEntity[] }; _meta: { linkedCount: number; missingLinks: GRDCSMissingLink[] } } {
  return {
    ...entity,
    _links: {
      self: generateHref(entityType, entity.id as string),
      related: links.linked,
    },
    _meta: {
      linkedCount: links.linked.length,
      missingLinks: links.missing,
    },
  };
}
