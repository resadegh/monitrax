/**
 * Loan Validation Schemas
 */

import { z } from 'zod';
import {
  IdSchema,
  OptionalIdSchema,
  CurrencySchema,
  PositiveCurrencySchema,
  InterestRateSchema,
  YearsSchema,
  MonthsSchema,
  OptionalDateSchema,
  NameSchema,
  RepaymentFrequencySchema,
  PaginatedQuerySchema,
} from './common';

// ============================================
// ENUMS
// ============================================

export const LoanTypeSchema = z.enum(['HOME', 'INVESTMENT']);
export const RateTypeSchema = z.enum(['VARIABLE', 'FIXED']);

// ============================================
// CREATE SCHEMA
// ============================================

export const LoanCreateSchema = z.object({
  name: NameSchema,
  lender: z.string().max(100).optional(),
  propertyId: OptionalIdSchema,
  type: LoanTypeSchema,
  originalAmount: PositiveCurrencySchema,
  currentBalance: CurrencySchema,
  interestRate: InterestRateSchema,
  rateType: RateTypeSchema,
  termYears: YearsSchema,
  remainingTermMonths: MonthsSchema.optional(),
  repaymentFrequency: RepaymentFrequencySchema,
  repaymentAmount: CurrencySchema.optional(),
  interestOnlyPeriodMonths: MonthsSchema.optional(),
  fixedRatePeriodMonths: MonthsSchema.optional(),
  startDate: OptionalDateSchema,
  offsetAccountId: OptionalIdSchema,
});

// ============================================
// UPDATE SCHEMA
// ============================================

export const LoanUpdateSchema = LoanCreateSchema.partial().extend({
  id: IdSchema,
});

// ============================================
// QUERY SCHEMA
// ============================================

export const LoanQuerySchema = PaginatedQuerySchema.extend({
  type: LoanTypeSchema.optional(),
  rateType: RateTypeSchema.optional(),
  propertyId: OptionalIdSchema,
  minBalance: CurrencySchema.optional(),
  maxBalance: CurrencySchema.optional(),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type LoanType = z.infer<typeof LoanTypeSchema>;
export type RateType = z.infer<typeof RateTypeSchema>;
export type LoanCreate = z.infer<typeof LoanCreateSchema>;
export type LoanUpdate = z.infer<typeof LoanUpdateSchema>;
export type LoanQuery = z.infer<typeof LoanQuerySchema>;
