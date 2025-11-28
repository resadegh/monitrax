/**
 * Tenant-scoped Prisma operations
 * Ensures all queries are filtered by userId (tenant isolation)
 * 
 * Phase 3: Multi-tenant data isolation layer
 */

import prisma from '@/lib/db';

// ============================================
// TENANT-SCOPED PROPERTY OPERATIONS
// ============================================

export const tenantProperty = {
  findMany: (tenantId: string, args?: any) =>
    prisma.property.findMany({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),

  findFirst: (tenantId: string, args?: any) =>
    prisma.property.findFirst({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),

  findUnique: (tenantId: string, id: string) =>
    prisma.property.findFirst({
      where: { id, userId: tenantId },
    }),

  create: (tenantId: string, data: any) =>
    prisma.property.create({
      data: { ...data, userId: tenantId },
    }),

  update: (tenantId: string, id: string, data: any) =>
    prisma.property.updateMany({
      where: { id, userId: tenantId },
      data,
    }),

  delete: (tenantId: string, id: string) =>
    prisma.property.deleteMany({
      where: { id, userId: tenantId },
    }),

  count: (tenantId: string, args?: any) =>
    prisma.property.count({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),
};

// ============================================
// TENANT-SCOPED LOAN OPERATIONS
// ============================================

export const tenantLoan = {
  findMany: (tenantId: string, args?: any) =>
    prisma.loan.findMany({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),

  findFirst: (tenantId: string, args?: any) =>
    prisma.loan.findFirst({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),

  findUnique: (tenantId: string, id: string) =>
    prisma.loan.findFirst({
      where: { id, userId: tenantId },
    }),

  create: (tenantId: string, data: any) =>
    prisma.loan.create({
      data: { ...data, userId: tenantId },
    }),

  update: (tenantId: string, id: string, data: any) =>
    prisma.loan.updateMany({
      where: { id, userId: tenantId },
      data,
    }),

  delete: (tenantId: string, id: string) =>
    prisma.loan.deleteMany({
      where: { id, userId: tenantId },
    }),

  count: (tenantId: string, args?: any) =>
    prisma.loan.count({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),
};

// ============================================
// TENANT-SCOPED ACCOUNT OPERATIONS
// ============================================

export const tenantAccount = {
  findMany: (tenantId: string, args?: any) =>
    prisma.account.findMany({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),

  findFirst: (tenantId: string, args?: any) =>
    prisma.account.findFirst({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),

  findUnique: (tenantId: string, id: string) =>
    prisma.account.findFirst({
      where: { id, userId: tenantId },
    }),

  create: (tenantId: string, data: any) =>
    prisma.account.create({
      data: { ...data, userId: tenantId },
    }),

  update: (tenantId: string, id: string, data: any) =>
    prisma.account.updateMany({
      where: { id, userId: tenantId },
      data,
    }),

  delete: (tenantId: string, id: string) =>
    prisma.account.deleteMany({
      where: { id, userId: tenantId },
    }),

  count: (tenantId: string, args?: any) =>
    prisma.account.count({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),
};

// ============================================
// TENANT-SCOPED INCOME OPERATIONS
// ============================================

export const tenantIncome = {
  findMany: (tenantId: string, args?: any) =>
    prisma.income.findMany({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),

  findFirst: (tenantId: string, args?: any) =>
    prisma.income.findFirst({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),

  findUnique: (tenantId: string, id: string) =>
    prisma.income.findFirst({
      where: { id, userId: tenantId },
    }),

  create: (tenantId: string, data: any) =>
    prisma.income.create({
      data: { ...data, userId: tenantId },
    }),

  update: (tenantId: string, id: string, data: any) =>
    prisma.income.updateMany({
      where: { id, userId: tenantId },
      data,
    }),

  delete: (tenantId: string, id: string) =>
    prisma.income.deleteMany({
      where: { id, userId: tenantId },
    }),

  count: (tenantId: string, args?: any) =>
    prisma.income.count({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),
};

// ============================================
// TENANT-SCOPED EXPENSE OPERATIONS
// ============================================

export const tenantExpense = {
  findMany: (tenantId: string, args?: any) =>
    prisma.expense.findMany({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),

  findFirst: (tenantId: string, args?: any) =>
    prisma.expense.findFirst({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),

  findUnique: (tenantId: string, id: string) =>
    prisma.expense.findFirst({
      where: { id, userId: tenantId },
    }),

  create: (tenantId: string, data: any) =>
    prisma.expense.create({
      data: { ...data, userId: tenantId },
    }),

  update: (tenantId: string, id: string, data: any) =>
    prisma.expense.updateMany({
      where: { id, userId: tenantId },
      data,
    }),

  delete: (tenantId: string, id: string) =>
    prisma.expense.deleteMany({
      where: { id, userId: tenantId },
    }),

  count: (tenantId: string, args?: any) =>
    prisma.expense.count({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),
};

// ============================================
// TENANT-SCOPED INVESTMENT ACCOUNT OPERATIONS
// ============================================

export const tenantInvestmentAccount = {
  findMany: (tenantId: string, args?: any) =>
    prisma.investmentAccount.findMany({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),

  findFirst: (tenantId: string, args?: any) =>
    prisma.investmentAccount.findFirst({
      ...args,
      where: { ...args?.where, userId: tenantId },
    }),

  findUnique: (tenantId: string, id: string) =>
    prisma.investmentAccount.findFirst({
      where: { id, userId: tenantId },
    }),

  create: (tenantId: string, data: any) =>
    prisma.investmentAccount.create({
      data: { ...data, userId: tenantId },
    }),

  update: (tenantId: string, id: string, data: any) =>
    prisma.investmentAccount.updateMany({
      where: { id, userId: tenantId },
      data,
    }),

  delete: (tenantId: string, id: string) =>
    prisma.investmentAccount.deleteMany({
      where: { id, userId: tenantId },
    }),

  count: (tenantId: string, args?: any) =>
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
