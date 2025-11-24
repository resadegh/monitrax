/**
 * Common Validation Schemas
 * Shared Zod schemas used across all entity validations
 */

import { z } from 'zod';

// ============================================
// ID SCHEMAS
// ============================================

export const IdSchema = z.string().cuid();
export const UUIDSchema = z.string().uuid();
export const OptionalIdSchema = z.string().cuid().optional();

// ============================================
// DATE SCHEMAS
// ============================================

export const DateSchema = z.union([
  z.string().datetime(),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  z.date(),
]).transform((val) => {
  if (val instanceof Date) return val.toISOString();
  return val;
});

export const OptionalDateSchema = DateSchema.optional().nullable();

// ============================================
// NUMERIC SCHEMAS
// ============================================

export const CurrencySchema = z.number().nonnegative();
export const PositiveCurrencySchema = z.number().positive();
export const PercentageSchema = z.number().min(0).max(100);
export const InterestRateSchema = z.number().min(0).max(50); // 0-50%
export const YearsSchema = z.number().int().positive().max(50);
export const MonthsSchema = z.number().int().positive().max(600);

// ============================================
// FREQUENCY SCHEMAS
// ============================================

export const FrequencySchema = z.enum([
  'WEEKLY',
  'FORTNIGHTLY',
  'MONTHLY',
  'QUARTERLY',
  'ANNUAL',
]);

export const RepaymentFrequencySchema = z.enum([
  'WEEKLY',
  'FORTNIGHTLY',
  'MONTHLY',
]);

// ============================================
// PAGINATION SCHEMAS
// ============================================

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const SortSchema = z.object({
  field: z.string(),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export const PaginatedQuerySchema = PaginationSchema.extend({
  sort: SortSchema.optional(),
  search: z.string().optional(),
});

// ============================================
// COMMON FIELD SCHEMAS
// ============================================

export const NameSchema = z.string().min(1, 'Name is required').max(100);
export const DescriptionSchema = z.string().max(500).optional();
export const NotesSchema = z.string().max(2000).optional();
export const AddressSchema = z.string().max(500).optional();

// ============================================
// TYPE EXPORTS
// ============================================

export type Frequency = z.infer<typeof FrequencySchema>;
export type RepaymentFrequency = z.infer<typeof RepaymentFrequencySchema>;
export type Pagination = z.infer<typeof PaginationSchema>;
export type PaginatedQuery = z.infer<typeof PaginatedQuerySchema>;
