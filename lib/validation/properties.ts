/**
 * Property Validation Schemas
 */

import { z } from 'zod';
import {
  IdSchema,
  CurrencySchema,
  PositiveCurrencySchema,
  OptionalDateSchema,
  NameSchema,
  AddressSchema,
  PaginatedQuerySchema,
} from './common';

// ============================================
// ENUMS
// ============================================

export const PropertyTypeSchema = z.enum(['HOME', 'INVESTMENT']);

// ============================================
// CREATE SCHEMA
// ============================================

export const PropertyCreateSchema = z.object({
  name: NameSchema,
  address: AddressSchema,
  type: PropertyTypeSchema,
  purchasePrice: PositiveCurrencySchema,
  purchaseDate: OptionalDateSchema,
  currentValue: CurrencySchema.optional(),
});

// ============================================
// UPDATE SCHEMA
// ============================================

export const PropertyUpdateSchema = PropertyCreateSchema.partial().extend({
  id: IdSchema,
});

// ============================================
// QUERY SCHEMA
// ============================================

export const PropertyQuerySchema = PaginatedQuerySchema.extend({
  type: PropertyTypeSchema.optional(),
  minValue: CurrencySchema.optional(),
  maxValue: CurrencySchema.optional(),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type PropertyType = z.infer<typeof PropertyTypeSchema>;
export type PropertyCreate = z.infer<typeof PropertyCreateSchema>;
export type PropertyUpdate = z.infer<typeof PropertyUpdateSchema>;
export type PropertyQuery = z.infer<typeof PropertyQuerySchema>;
