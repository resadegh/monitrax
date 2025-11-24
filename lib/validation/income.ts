/**
 * Income Validation Schemas
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

export const IncomeTypeSchema = z.enum(['SALARY', 'RENT', 'RENTAL', 'INVESTMENT', 'OTHER']);
export const IncomeSourceTypeSchema = z.enum(['GENERAL', 'PROPERTY', 'INVESTMENT']);

// ============================================
// CREATE SCHEMA
// ============================================

export const IncomeCreateSchema = z.object({
  name: NameSchema,
  type: IncomeTypeSchema,
  sourceType: IncomeSourceTypeSchema.default('GENERAL'),
  propertyId: OptionalIdSchema,
  investmentAccountId: OptionalIdSchema,
  amount: PositiveCurrencySchema,
  frequency: FrequencySchema,
  isTaxable: z.boolean().default(true),
});

// ============================================
// UPDATE SCHEMA
// ============================================

export const IncomeUpdateSchema = IncomeCreateSchema.partial().extend({
  id: IdSchema,
});

// ============================================
// QUERY SCHEMA
// ============================================

export const IncomeQuerySchema = PaginatedQuerySchema.extend({
  type: IncomeTypeSchema.optional(),
  sourceType: IncomeSourceTypeSchema.optional(),
  propertyId: OptionalIdSchema,
  investmentAccountId: OptionalIdSchema,
  isTaxable: z.boolean().optional(),
  minAmount: CurrencySchema.optional(),
  maxAmount: CurrencySchema.optional(),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type IncomeType = z.infer<typeof IncomeTypeSchema>;
export type IncomeSourceType = z.infer<typeof IncomeSourceTypeSchema>;
export type IncomeCreate = z.infer<typeof IncomeCreateSchema>;
export type IncomeUpdate = z.infer<typeof IncomeUpdateSchema>;
export type IncomeQuery = z.infer<typeof IncomeQuerySchema>;
