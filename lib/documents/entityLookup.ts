/**
 * Entity Lookup Service
 * Fetches entity names for document folder structure
 */

import { prisma } from '@/lib/db';
import { LinkedEntityType } from './types';

export interface EntityInfo {
  id: string;
  name: string;
  type: LinkedEntityType;
  parentId?: string;
  parentName?: string;
  parentType?: LinkedEntityType;
}

export interface EntityLookupResult {
  [entityId: string]: EntityInfo;
}

/**
 * Batch lookup entity information by IDs
 */
export async function lookupEntities(
  userId: string,
  entityLinks: { entityType: string; entityId: string }[]
): Promise<EntityLookupResult> {
  const result: EntityLookupResult = {};

  // Group by entity type
  const groupedLinks: Record<string, string[]> = {};
  entityLinks.forEach(link => {
    if (!groupedLinks[link.entityType]) {
      groupedLinks[link.entityType] = [];
    }
    if (!groupedLinks[link.entityType].includes(link.entityId)) {
      groupedLinks[link.entityType].push(link.entityId);
    }
  });

  // Fetch properties
  if (groupedLinks.PROPERTY?.length) {
    const properties = await prisma.property.findMany({
      where: {
        id: { in: groupedLinks.PROPERTY },
        userId,
      },
      select: {
        id: true,
        name: true,
        address: true,
      },
    });
    properties.forEach(p => {
      result[p.id] = {
        id: p.id,
        name: p.name || p.address || 'Unnamed Property',
        type: LinkedEntityType.PROPERTY,
      };
    });
  }

  // Fetch loans
  if (groupedLinks.LOAN?.length) {
    const loans = await prisma.loan.findMany({
      where: {
        id: { in: groupedLinks.LOAN },
        userId,
      },
      select: {
        id: true,
        name: true,
        lender: true,
        property: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
    });
    loans.forEach(l => {
      result[l.id] = {
        id: l.id,
        name: l.name || `${l.lender || 'Unknown'} Loan`,
        type: LinkedEntityType.LOAN,
        parentId: l.property?.id,
        parentName: l.property?.name || l.property?.address,
        parentType: l.property ? LinkedEntityType.PROPERTY : undefined,
      };
    });
  }

  // Fetch expenses
  if (groupedLinks.EXPENSE?.length) {
    const expenses = await prisma.expense.findMany({
      where: {
        id: { in: groupedLinks.EXPENSE },
        userId,
      },
      select: {
        id: true,
        name: true,
        category: true,
        property: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
    });
    expenses.forEach(e => {
      result[e.id] = {
        id: e.id,
        name: e.name || e.category || 'Unnamed Expense',
        type: LinkedEntityType.EXPENSE,
        parentId: e.property?.id,
        parentName: e.property?.name || e.property?.address,
        parentType: e.property ? LinkedEntityType.PROPERTY : undefined,
      };
    });
  }

  // Fetch income
  if (groupedLinks.INCOME?.length) {
    const incomes = await prisma.income.findMany({
      where: {
        id: { in: groupedLinks.INCOME },
        userId,
      },
      select: {
        id: true,
        name: true,
        category: true,
        property: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
    });
    incomes.forEach(i => {
      result[i.id] = {
        id: i.id,
        name: i.name || i.category || 'Unnamed Income',
        type: LinkedEntityType.INCOME,
        parentId: i.property?.id,
        parentName: i.property?.name || i.property?.address,
        parentType: i.property ? LinkedEntityType.PROPERTY : undefined,
      };
    });
  }

  // Fetch bank accounts
  if (groupedLinks.ACCOUNT?.length) {
    const accounts = await prisma.bankAccount.findMany({
      where: {
        id: { in: groupedLinks.ACCOUNT },
        userId,
      },
      select: {
        id: true,
        name: true,
        institution: true,
        accountType: true,
      },
    });
    accounts.forEach(a => {
      result[a.id] = {
        id: a.id,
        name: a.name || `${a.institution || 'Bank'} - ${a.accountType || 'Account'}`,
        type: LinkedEntityType.ACCOUNT,
      };
    });
  }

  // Fetch investment accounts
  if (groupedLinks.INVESTMENT_ACCOUNT?.length) {
    const investmentAccounts = await prisma.investmentAccount.findMany({
      where: {
        id: { in: groupedLinks.INVESTMENT_ACCOUNT },
        userId,
      },
      select: {
        id: true,
        name: true,
        platform: true,
      },
    });
    investmentAccounts.forEach(ia => {
      result[ia.id] = {
        id: ia.id,
        name: ia.name || ia.platform || 'Investment Account',
        type: LinkedEntityType.INVESTMENT_ACCOUNT,
      };
    });
  }

  // Fetch investment holdings
  if (groupedLinks.INVESTMENT_HOLDING?.length) {
    const holdings = await prisma.investmentHolding.findMany({
      where: {
        id: { in: groupedLinks.INVESTMENT_HOLDING },
        investmentAccount: {
          userId,
        },
      },
      select: {
        id: true,
        symbol: true,
        name: true,
        investmentAccount: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    holdings.forEach(h => {
      result[h.id] = {
        id: h.id,
        name: h.name || h.symbol || 'Holding',
        type: LinkedEntityType.INVESTMENT_HOLDING,
        parentId: h.investmentAccount?.id,
        parentName: h.investmentAccount?.name,
        parentType: LinkedEntityType.INVESTMENT_ACCOUNT,
      };
    });
  }

  return result;
}

/**
 * Get all entities for a user (for folder tree)
 */
export async function getAllUserEntities(userId: string): Promise<{
  properties: EntityInfo[];
  loans: EntityInfo[];
  expenses: EntityInfo[];
  income: EntityInfo[];
  accounts: EntityInfo[];
  investmentAccounts: EntityInfo[];
}> {
  const [properties, loans, expenses, income, accounts, investmentAccounts] = await Promise.all([
    prisma.property.findMany({
      where: { userId },
      select: { id: true, name: true, address: true },
      orderBy: { name: 'asc' },
    }),
    prisma.loan.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        lender: true,
        property: { select: { id: true, name: true, address: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.expense.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        category: true,
        property: { select: { id: true, name: true, address: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.income.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        category: true,
        property: { select: { id: true, name: true, address: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.bankAccount.findMany({
      where: { userId },
      select: { id: true, name: true, institution: true, accountType: true },
      orderBy: { name: 'asc' },
    }),
    prisma.investmentAccount.findMany({
      where: { userId },
      select: { id: true, name: true, platform: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return {
    properties: properties.map(p => ({
      id: p.id,
      name: p.name || p.address || 'Unnamed Property',
      type: LinkedEntityType.PROPERTY,
    })),
    loans: loans.map(l => ({
      id: l.id,
      name: l.name || `${l.lender || 'Unknown'} Loan`,
      type: LinkedEntityType.LOAN,
      parentId: l.property?.id,
      parentName: l.property?.name || l.property?.address,
      parentType: l.property ? LinkedEntityType.PROPERTY : undefined,
    })),
    expenses: expenses.map(e => ({
      id: e.id,
      name: e.name || e.category || 'Unnamed Expense',
      type: LinkedEntityType.EXPENSE,
      parentId: e.property?.id,
      parentName: e.property?.name || e.property?.address,
      parentType: e.property ? LinkedEntityType.PROPERTY : undefined,
    })),
    income: income.map(i => ({
      id: i.id,
      name: i.name || i.category || 'Unnamed Income',
      type: LinkedEntityType.INCOME,
      parentId: i.property?.id,
      parentName: i.property?.name || i.property?.address,
      parentType: i.property ? LinkedEntityType.PROPERTY : undefined,
    })),
    accounts: accounts.map(a => ({
      id: a.id,
      name: a.name || `${a.institution || 'Bank'} - ${a.accountType || 'Account'}`,
      type: LinkedEntityType.ACCOUNT,
    })),
    investmentAccounts: investmentAccounts.map(ia => ({
      id: ia.id,
      name: ia.name || ia.platform || 'Investment Account',
      type: LinkedEntityType.INVESTMENT_ACCOUNT,
    })),
  };
}
