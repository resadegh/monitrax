/**
 * Investment Validation Schemas
 */

import { z } from 'zod';
import {
  IdSchema,
  OptionalIdSchema,
  PositiveCurrencySchema,
  CurrencySchema,
  NameSchema,
  PaginatedQuerySchema,
} from './common';

// ============================================
// ENUMS
// ============================================

export const InvestmentAccountTypeSchema = z.enum([
  'BROKERAGE',
  'SUPERS',
  'FUND',
  'TRUST',
  'ETF_CRYPTO',
]);

export const HoldingTypeSchema = z.enum(['SHARE', 'ETF', 'LIC', 'REIT', 'BOND', 'CRYPTO', 'OTHER']);

export const InvestmentTransactionTypeSchema = z.enum([
  'BUY',
  'SELL',
  'DIVIDEND',
  'DISTRIBUTION',
  'SPLIT',
  'TRANSFER_IN',
  'TRANSFER_OUT',
]);

// ============================================
// INVESTMENT ACCOUNT SCHEMAS
// ============================================

export const InvestmentAccountCreateSchema = z.object({
  name: NameSchema,
  type: InvestmentAccountTypeSchema,
  platform: z.string().max(100).optional(),
  currency: z.string().length(3).default('AUD'),
});

export const InvestmentAccountUpdateSchema = InvestmentAccountCreateSchema.partial().extend({
  id: IdSchema,
});

export const InvestmentAccountQuerySchema = PaginatedQuerySchema.extend({
  type: InvestmentAccountTypeSchema.optional(),
  platform: z.string().optional(),
});

// ============================================
// HOLDING SCHEMAS
// ============================================

export const HoldingCreateSchema = z.object({
  investmentAccountId: IdSchema,
  symbol: z.string().min(1).max(20),
  name: NameSchema,
  type: HoldingTypeSchema,
  units: z.number().positive(),
  averageCost: PositiveCurrencySchema,
  currentPrice: CurrencySchema.optional(),
});

export const HoldingUpdateSchema = HoldingCreateSchema.partial().extend({
  id: IdSchema,
});

export const HoldingQuerySchema = PaginatedQuerySchema.extend({
  investmentAccountId: OptionalIdSchema,
  type: HoldingTypeSchema.optional(),
  symbol: z.string().optional(),
});

// ============================================
// INVESTMENT TRANSACTION SCHEMAS
// ============================================

export const InvestmentTransactionCreateSchema = z.object({
  investmentAccountId: IdSchema,
  holdingId: OptionalIdSchema,
  type: InvestmentTransactionTypeSchema,
  symbol: z.string().min(1).max(20).optional(),
  units: z.number().positive().optional(),
  pricePerUnit: PositiveCurrencySchema.optional(),
  totalAmount: PositiveCurrencySchema,
  fees: CurrencySchema.default(0),
  transactionDate: z.coerce.date(),
  notes: z.string().max(500).optional(),
});

export const InvestmentTransactionUpdateSchema = InvestmentTransactionCreateSchema.partial().extend({
  id: IdSchema,
});

export const InvestmentTransactionQuerySchema = PaginatedQuerySchema.extend({
  investmentAccountId: OptionalIdSchema,
  holdingId: OptionalIdSchema,
  type: InvestmentTransactionTypeSchema.optional(),
  symbol: z.string().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type InvestmentAccountType = z.infer<typeof InvestmentAccountTypeSchema>;
export type HoldingType = z.infer<typeof HoldingTypeSchema>;
export type InvestmentTransactionType = z.infer<typeof InvestmentTransactionTypeSchema>;

export type InvestmentAccountCreate = z.infer<typeof InvestmentAccountCreateSchema>;
export type InvestmentAccountUpdate = z.infer<typeof InvestmentAccountUpdateSchema>;
export type InvestmentAccountQuery = z.infer<typeof InvestmentAccountQuerySchema>;

export type HoldingCreate = z.infer<typeof HoldingCreateSchema>;
export type HoldingUpdate = z.infer<typeof HoldingUpdateSchema>;
export type HoldingQuery = z.infer<typeof HoldingQuerySchema>;

export type InvestmentTransactionCreate = z.infer<typeof InvestmentTransactionCreateSchema>;
export type InvestmentTransactionUpdate = z.infer<typeof InvestmentTransactionUpdateSchema>;
export type InvestmentTransactionQuery = z.infer<typeof InvestmentTransactionQuerySchema>;
