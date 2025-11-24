/**
 * Tenant-Aware Database Operations
 * Ensures data isolation between users/tenants
 */

import { prisma } from '@/lib/db';

// ============================================
// TENANT ISOLATION UTILITIES
// ============================================

/**
 * Add tenant filter to a where clause
 */
export function withTenant<T extends Record<string, unknown> | undefined>(
  tenantId: string,
  where?: T
): T & { userId: string } {
  return {
    ...where,
    userId: tenantId,
  } as T & { userId: string };
}

// ============================================
// TENANT-SCOPED PROPERTY OPERATIONS
// ============================================

export const tenantProperty = {
  findMany: (tenantId: string, args?: Parameters<typeof prisma.property.findMany>[0]) =>
    prisma.property.findMany({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),

  findFirst: (tenantId: string, args?: Parameters<typeof prisma.property.findFirst>[0]) =>
    prisma.property.findFirst({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),

  findUnique: (tenantId: string, id: string) =>
    prisma.property.findFirst({
      where: { id, userId: tenantId },
    }),

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create: (tenantId: string, data: Record<string, any>) =>
    prisma.property.create({
      data: {
        ...data,
        userId: tenantId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    }),

  update: (tenantId: string, id: string, data: Parameters<typeof prisma.property.update>[0]['data']) =>
    prisma.property.updateMany({
      where: { id, userId: tenantId },
      data,
    }),

  delete: (tenantId: string, id: string) =>
    prisma.property.deleteMany({
      where: { id, userId: tenantId },
    }),

  count: (tenantId: string, args?: Parameters<typeof prisma.property.count>[0]) =>
    prisma.property.count({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),
};

// ============================================
// TENANT-SCOPED LOAN OPERATIONS
// ============================================

export const tenantLoan = {
  findMany: (tenantId: string, args?: Parameters<typeof prisma.loan.findMany>[0]) =>
    prisma.loan.findMany({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),

  findFirst: (tenantId: string, args?: Parameters<typeof prisma.loan.findFirst>[0]) =>
    prisma.loan.findFirst({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),

  findUnique: (tenantId: string, id: string) =>
    prisma.loan.findFirst({
      where: { id, userId: tenantId },
    }),

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create: (tenantId: string, data: Record<string, any>) =>
    prisma.loan.create({
      data: {
        ...data,
        userId: tenantId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    }),

  update: (tenantId: string, id: string, data: Parameters<typeof prisma.loan.update>[0]['data']) =>
    prisma.loan.updateMany({
      where: { id, userId: tenantId },
      data,
    }),

  delete: (tenantId: string, id: string) =>
    prisma.loan.deleteMany({
      where: { id, userId: tenantId },
    }),

  count: (tenantId: string, args?: Parameters<typeof prisma.loan.count>[0]) =>
    prisma.loan.count({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),
};

// ============================================
// TENANT-SCOPED ACCOUNT OPERATIONS
// ============================================

export const tenantAccount = {
  findMany: (tenantId: string, args?: Parameters<typeof prisma.account.findMany>[0]) =>
    prisma.account.findMany({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),

  findFirst: (tenantId: string, args?: Parameters<typeof prisma.account.findFirst>[0]) =>
    prisma.account.findFirst({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),

  findUnique: (tenantId: string, id: string) =>
    prisma.account.findFirst({
      where: { id, userId: tenantId },
    }),

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create: (tenantId: string, data: Record<string, any>) =>
    prisma.account.create({
      data: {
        ...data,
        userId: tenantId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    }),

  update: (tenantId: string, id: string, data: Parameters<typeof prisma.account.update>[0]['data']) =>
    prisma.account.updateMany({
      where: { id, userId: tenantId },
      data,
    }),

  delete: (tenantId: string, id: string) =>
    prisma.account.deleteMany({
      where: { id, userId: tenantId },
    }),

  count: (tenantId: string, args?: Parameters<typeof prisma.account.count>[0]) =>
    prisma.account.count({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),
};

// ============================================
// TENANT-SCOPED INCOME OPERATIONS
// ============================================

export const tenantIncome = {
  findMany: (tenantId: string, args?: Parameters<typeof prisma.income.findMany>[0]) =>
    prisma.income.findMany({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),

  findFirst: (tenantId: string, args?: Parameters<typeof prisma.income.findFirst>[0]) =>
    prisma.income.findFirst({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),

  findUnique: (tenantId: string, id: string) =>
    prisma.income.findFirst({
      where: { id, userId: tenantId },
    }),

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create: (tenantId: string, data: Record<string, any>) =>
    prisma.income.create({
      data: {
        ...data,
        userId: tenantId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    }),

  update: (tenantId: string, id: string, data: Parameters<typeof prisma.income.update>[0]['data']) =>
    prisma.income.updateMany({
      where: { id, userId: tenantId },
      data,
    }),

  delete: (tenantId: string, id: string) =>
    prisma.income.deleteMany({
      where: { id, userId: tenantId },
    }),

  count: (tenantId: string, args?: Parameters<typeof prisma.income.count>[0]) =>
    prisma.income.count({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),
};

// ============================================
// TENANT-SCOPED EXPENSE OPERATIONS
// ============================================

export const tenantExpense = {
  findMany: (tenantId: string, args?: Parameters<typeof prisma.expense.findMany>[0]) =>
    prisma.expense.findMany({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),

  findFirst: (tenantId: string, args?: Parameters<typeof prisma.expense.findFirst>[0]) =>
    prisma.expense.findFirst({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),

  findUnique: (tenantId: string, id: string) =>
    prisma.expense.findFirst({
      where: { id, userId: tenantId },
    }),

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create: (tenantId: string, data: Record<string, any>) =>
    prisma.expense.create({
      data: {
        ...data,
        userId: tenantId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    }),

  update: (tenantId: string, id: string, data: Parameters<typeof prisma.expense.update>[0]['data']) =>
    prisma.expense.updateMany({
      where: { id, userId: tenantId },
      data,
    }),

  delete: (tenantId: string, id: string) =>
    prisma.expense.deleteMany({
      where: { id, userId: tenantId },
    }),

  count: (tenantId: string, args?: Parameters<typeof prisma.expense.count>[0]) =>
    prisma.expense.count({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),
};

// ============================================
// TENANT-SCOPED INVESTMENT ACCOUNT OPERATIONS
// ============================================

export const tenantInvestmentAccount = {
  findMany: (tenantId: string, args?: Parameters<typeof prisma.investmentAccount.findMany>[0]) =>
    prisma.investmentAccount.findMany({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),

  findFirst: (tenantId: string, args?: Parameters<typeof prisma.investmentAccount.findFirst>[0]) =>
    prisma.investmentAccount.findFirst({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),

  findUnique: (tenantId: string, id: string) =>
    prisma.investmentAccount.findFirst({
      where: { id, userId: tenantId },
    }),

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create: (tenantId: string, data: Record<string, any>) =>
    prisma.investmentAccount.create({
      data: {
        ...data,
        userId: tenantId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    }),

  update: (tenantId: string, id: string, data: Parameters<typeof prisma.investmentAccount.update>[0]['data']) =>
    prisma.investmentAccount.updateMany({
      where: { id, userId: tenantId },
      data,
    }),

  delete: (tenantId: string, id: string) =>
    prisma.investmentAccount.deleteMany({
      where: { id, userId: tenantId },
    }),

  count: (tenantId: string, args?: Parameters<typeof prisma.investmentAccount.count>[0]) =>
    prisma.investmentAccount.count({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),
};

// ============================================
// COMBINED TENANT PRISMA
// ============================================

export const tenantPrisma = {
  property: tenantProperty,
  loan: tenantLoan,
  account: tenantAccount,
  income: tenantIncome,
  expense: tenantExpense,
  investmentAccount: tenantInvestmentAccount,
};

// ============================================
// TENANT VALIDATION UTILITIES
// ============================================

/**
 * Verify that a record belongs to the specified tenant
 * Returns true if the record exists and belongs to the tenant
 */
export async function verifyTenantOwnership(
  tenantId: string,
  entity: 'property' | 'loan' | 'account' | 'income' | 'expense' | 'investmentAccount',
  recordId: string
): Promise<boolean> {
  const operations = tenantPrisma[entity];
  const record = await operations.findUnique(tenantId, recordId);
  return record !== null;
}

/**
 * Verify multiple records belong to the specified tenant
 */
export async function verifyTenantOwnershipBulk(
  tenantId: string,
  entity: 'property' | 'loan' | 'account' | 'income' | 'expense' | 'investmentAccount',
  recordIds: string[]
): Promise<{ valid: string[]; invalid: string[] }> {
  const validIds: string[] = [];
  const invalidIds: string[] = [];

  await Promise.all(
    recordIds.map(async (id) => {
      const isOwned = await verifyTenantOwnership(tenantId, entity, id);
      if (isOwned) {
        validIds.push(id);
      } else {
        invalidIds.push(id);
      }
    })
  );

  return { valid: validIds, invalid: invalidIds };
}
