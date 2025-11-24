/**
 * Tenant-Aware Database Operations
 * Ensures data isolation between users/tenants
 *
 * Note: Uses generic types to avoid dependency on Prisma client generation.
 * When Prisma client is regenerated, types will be properly inferred at runtime.
 */

import { prisma } from '@/lib/db';

// ============================================
// TYPES
// ============================================

// Generic types for Prisma-like operations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WhereInput = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CreateInput = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UpdateInput = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FindManyArgs = { where?: WhereInput; [key: string]: any };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FindFirstArgs = { where?: WhereInput; [key: string]: any };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CountArgs = { where?: WhereInput; [key: string]: any };

// ============================================
// TENANT ISOLATION UTILITIES
// ============================================

/**
 * Add tenant filter to a where clause
 */
export function withTenant<T extends WhereInput | undefined>(
  tenantId: string,
  where?: T
): T & { userId: string } {
  return {
    ...where,
    userId: tenantId,
  } as T & { userId: string };
}

// ============================================
// GENERIC TENANT-SCOPED OPERATIONS FACTORY
// ============================================

function createTenantOperations<
  TModel extends {
    findMany: (args?: FindManyArgs) => Promise<unknown[]>;
    findFirst: (args?: FindFirstArgs) => Promise<unknown | null>;
    create: (args: { data: CreateInput }) => Promise<unknown>;
    updateMany: (args: { where: WhereInput; data: UpdateInput }) => Promise<{ count: number }>;
    deleteMany: (args: { where: WhereInput }) => Promise<{ count: number }>;
    count: (args?: CountArgs) => Promise<number>;
  }
>(model: TModel) {
  return {
    findMany: (tenantId: string, args?: FindManyArgs) =>
      model.findMany({
        ...args,
        where: withTenant(tenantId, args?.where),
      }),

    findFirst: (tenantId: string, args?: FindFirstArgs) =>
      model.findFirst({
        ...args,
        where: withTenant(tenantId, args?.where),
      }),

    findUnique: (tenantId: string, id: string) =>
      model.findFirst({
        where: { id, userId: tenantId },
      }),

    create: (tenantId: string, data: CreateInput) =>
      model.create({
        data: {
          ...data,
          user: { connect: { id: tenantId } },
        },
      }),

    update: (tenantId: string, id: string, data: UpdateInput) =>
      model.updateMany({
        where: { id, userId: tenantId },
        data,
      }),

    delete: (tenantId: string, id: string) =>
      model.deleteMany({
        where: { id, userId: tenantId },
      }),

    count: (tenantId: string, args?: CountArgs) =>
      model.count({
        ...args,
        where: withTenant(tenantId, args?.where),
      }),
  };
}

// ============================================
// TENANT-SCOPED MODEL OPERATIONS
// ============================================

export const tenantProperty = createTenantOperations(prisma.property);
export const tenantLoan = createTenantOperations(prisma.loan);
export const tenantAccount = createTenantOperations(prisma.account);
export const tenantIncome = createTenantOperations(prisma.income);
export const tenantExpense = createTenantOperations(prisma.expense);
export const tenantInvestmentAccount = createTenantOperations(prisma.investmentAccount);

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
