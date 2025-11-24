/**
 * Account Validation Schemas
 */

import { z } from 'zod';
import {
  IdSchema,
  OptionalIdSchema,
  CurrencySchema,
  InterestRateSchema,
  NameSchema,
  PaginatedQuerySchema,
} from './common';

// ============================================
// ENUMS
// ============================================

export const AccountTypeSchema = z.enum(['OFFSET', 'SAVINGS', 'TRANSACTIONAL', 'CREDIT_CARD']);

// ============================================
// CREATE SCHEMA
// ============================================

export const AccountCreateSchema = z.object({
  name: NameSchema,
  type: AccountTypeSchema,
  institution: z.string().max(100).optional(),
  currentBalance: CurrencySchema,
  interestRate: InterestRateSchema.optional(),
});

// ============================================
// UPDATE SCHEMA
// ============================================

export const AccountUpdateSchema = AccountCreateSchema.partial().extend({
  id: IdSchema,
});

// ============================================
// QUERY SCHEMA
// ============================================

export const AccountQuerySchema = PaginatedQuerySchema.extend({
  type: AccountTypeSchema.optional(),
  institution: z.string().optional(),
  minBalance: CurrencySchema.optional(),
  maxBalance: CurrencySchema.optional(),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type AccountType = z.infer<typeof AccountTypeSchema>;
export type AccountCreate = z.infer<typeof AccountCreateSchema>;
export type AccountUpdate = z.infer<typeof AccountUpdateSchema>;
export type AccountQuery = z.infer<typeof AccountQuerySchema>;
