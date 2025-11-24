/**
 * Expense Validation Schemas
 */

import { z } from 'zod';
import {
  IdSchema,
  OptionalIdSchema,
  PositiveCurrencySchema,
  CurrencySchema,
  FrequencySchema,
  NameSchema,
  PaginatedQuerySchema,
} from './common';

// ============================================
// ENUMS
// ============================================

export const ExpenseCategorySchema = z.enum([
  'HOUSING',
  'RATES',
  'INSURANCE',
  'MAINTENANCE',
  'PERSONAL',
  'UTILITIES',
  'FOOD',
  'TRANSPORT',
  'ENTERTAINMENT',
  'STRATA',
  'LAND_TAX',
  'LOAN_INTEREST',
  'OTHER',
]);

export const ExpenseSourceTypeSchema = z.enum(['GENERAL', 'PROPERTY', 'LOAN', 'INVESTMENT']);

// ============================================
// CREATE SCHEMA
// ============================================

export const ExpenseCreateSchema = z.object({
  name: NameSchema,
  vendorName: z.string().max(100).optional(),
  category: ExpenseCategorySchema,
  sourceType: ExpenseSourceTypeSchema.default('GENERAL'),
  propertyId: OptionalIdSchema,
  loanId: OptionalIdSchema,
  investmentAccountId: OptionalIdSchema,
  amount: PositiveCurrencySchema,
  frequency: FrequencySchema,
  isEssential: z.boolean().default(true),
  isTaxDeductible: z.boolean().default(false),
});

// ============================================
// UPDATE SCHEMA
// ============================================

export const ExpenseUpdateSchema = ExpenseCreateSchema.partial().extend({
  id: IdSchema,
});

// ============================================
// QUERY SCHEMA
// ============================================

export const ExpenseQuerySchema = PaginatedQuerySchema.extend({
  category: ExpenseCategorySchema.optional(),
  sourceType: ExpenseSourceTypeSchema.optional(),
  propertyId: OptionalIdSchema,
  loanId: OptionalIdSchema,
  investmentAccountId: OptionalIdSchema,
  isEssential: z.boolean().optional(),
  isTaxDeductible: z.boolean().optional(),
  minAmount: CurrencySchema.optional(),
  maxAmount: CurrencySchema.optional(),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type ExpenseCategory = z.infer<typeof ExpenseCategorySchema>;
export type ExpenseSourceType = z.infer<typeof ExpenseSourceTypeSchema>;
export type ExpenseCreate = z.infer<typeof ExpenseCreateSchema>;
export type ExpenseUpdate = z.infer<typeof ExpenseUpdateSchema>;
export type ExpenseQuery = z.infer<typeof ExpenseQuerySchema>;
