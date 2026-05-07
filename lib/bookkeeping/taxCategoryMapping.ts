/**
 * Phase 42 PR5 — Tax category mapping registry.
 *
 * Bridge between Monitrax canonical categories
 * (`CanonicalCategoryRegistry`) and ATO labels (D-1, D-5, Rental
 * Schedule line items, Div 40 / Div 43 etc.).
 *
 * Used by the Phase 42 Tax Pack export to group transactions under
 * ATO labels — the accountant gets a CSV with ATO labels as columns;
 * Monitrax's job stops there. The accountant decides deductibility
 * per the spec §1 hard rule:
 *
 *   "This is a data summary; your registered tax agent confirms
 *    deductibility."
 *
 * Per CLAUDE.md §12.2 SSOT — there is exactly ONE module that knows
 * "what ATO label does this category map to?", and it's this one.
 *
 * System seeds: ~60 default mappings covering common AU rental +
 * employee + small-business deductions. Lazily seeded on first
 * `seedSystemMappings(userId)` call (run by the Tax Pack export
 * before generating output) — avoids the FK-bootstrap problem in
 * the migration (system rows can't reference category-registry
 * rows that don't exist yet for a new user).
 */

import prisma from '@/lib/db';
import { resolveOrCreateCategory } from './categoryRegistry';
import type { TaxCategoryMapping } from '@prisma/client';

/**
 * The canonical seed list. Each entry maps a (level1, level2)
 * Monitrax category triple to one or more ATO labels.
 *
 * Source: ATO myTax 2024-25 individual return + Rental Property
 * Schedule + Small Business simplified depreciation guidance.
 */
export interface TaxMappingSeed {
  /** Monitrax canonical level1 (matches `CanonicalCategoryRegistry`). */
  level1: string;
  level2?: string;
  atoLabel: string;
  schedule?: string;
  lineItem?: string;
  notes?: string;
}

export const SYSTEM_TAX_MAPPING_SEEDS: readonly TaxMappingSeed[] = [
  // === Income — taxable ===
  { level1: 'Income', level2: 'Salary', atoLabel: 'Item 1 — Salary or wages', schedule: 'Individual Tax Return' },
  { level1: 'Income', level2: 'Rent', atoLabel: 'Rental income — gross rent', schedule: 'Rental Schedule', lineItem: '21F' },
  { level1: 'Income', level2: 'Investment', atoLabel: 'Item 11 — Dividends', schedule: 'Individual Tax Return' },
  { level1: 'Income', level2: 'Interest', atoLabel: 'Item 10 — Interest', schedule: 'Individual Tax Return' },
  { level1: 'Income', level2: 'Government', atoLabel: 'Item 5 — Government allowances', schedule: 'Individual Tax Return' },
  { level1: 'Income', level2: 'Tax Refund', atoLabel: 'Tax refund (non-assessable)', notes: 'NOT income — informational only' },
  { level1: 'Income', level2: 'Refund', atoLabel: 'Refund / reimbursement (non-assessable)' },
  { level1: 'Income', level2: 'Other', atoLabel: 'Item 24 — Other income' },

  // === Property — rental deductions (Rental Schedule) ===
  { level1: 'Property', level2: 'Rates', atoLabel: 'Council rates', schedule: 'Rental Schedule', lineItem: '21Q' },
  { level1: 'Property', level2: 'Water', atoLabel: 'Water charges', schedule: 'Rental Schedule', lineItem: '21S' },
  { level1: 'Property', level2: 'Strata', atoLabel: 'Body corporate fees / strata levies', schedule: 'Rental Schedule', lineItem: '21H' },
  { level1: 'Property', level2: 'Land Tax', atoLabel: 'Land tax', schedule: 'Rental Schedule', lineItem: '21W' },
  { level1: 'Property', level2: 'Management', atoLabel: 'Property agent fees / commission', schedule: 'Rental Schedule', lineItem: '21G' },
  { level1: 'Property', level2: 'Repairs', atoLabel: 'Repairs and maintenance', schedule: 'Rental Schedule', lineItem: '21M' },
  { level1: 'Property', level2: 'Maintenance', atoLabel: 'Repairs and maintenance', schedule: 'Rental Schedule', lineItem: '21M' },
  { level1: 'Property', level2: 'Cleaning', atoLabel: 'Cleaning', schedule: 'Rental Schedule', lineItem: '21K' },
  { level1: 'Property', level2: 'Gardening', atoLabel: 'Gardening / lawn mowing', schedule: 'Rental Schedule', lineItem: '21J' },
  { level1: 'Property', level2: 'Pest Control', atoLabel: 'Pest control', schedule: 'Rental Schedule', lineItem: '21O' },
  { level1: 'Property', level2: 'Advertising', atoLabel: 'Advertising for tenants', schedule: 'Rental Schedule', lineItem: '21B' },

  // === Insurance ===
  { level1: 'Insurance', atoLabel: 'Insurance', schedule: 'Rental Schedule', lineItem: '21V', notes: 'Rental: building / landlord / contents' },

  // === Loan / interest ===
  { level1: 'Loan', level2: 'Interest', atoLabel: 'Interest on loans', schedule: 'Rental Schedule', lineItem: '21I' },

  // === Depreciation ===
  { level1: 'Depreciation', level2: 'Capital Works', atoLabel: 'Capital works deductions (Div 43)', schedule: 'Rental Schedule', lineItem: '21F' },
  { level1: 'Depreciation', level2: 'Plant & Equipment', atoLabel: 'Decline in value (Div 40)', schedule: 'Rental Schedule', lineItem: '21X' },

  // === Utilities (rental + general) ===
  { level1: 'Utilities', level2: 'Energy', atoLabel: 'Electricity / gas (rental)', schedule: 'Rental Schedule', lineItem: '21S' },
  { level1: 'Utilities', level2: 'Water', atoLabel: 'Water charges', schedule: 'Rental Schedule', lineItem: '21S' },
  { level1: 'Utilities', level2: 'Telecom', atoLabel: 'Phone / internet — work-related portion', schedule: 'Individual Tax Return', lineItem: 'D-5', notes: 'Apportion work vs personal use' },

  // === Work-related deductions (D-1 to D-15) ===
  { level1: 'Work', level2: 'Travel', atoLabel: 'D-2 Work-related travel expenses', schedule: 'Individual Tax Return' },
  { level1: 'Work', level2: 'Uniform', atoLabel: 'D-3 Work-related clothing, laundry', schedule: 'Individual Tax Return' },
  { level1: 'Work', level2: 'Education', atoLabel: 'D-4 Self-education expenses', schedule: 'Individual Tax Return' },
  { level1: 'Work', level2: 'Other', atoLabel: 'D-5 Other work-related expenses', schedule: 'Individual Tax Return' },
  { level1: 'Work', level2: 'Tools', atoLabel: 'D-5 Tools / equipment for work', schedule: 'Individual Tax Return' },
  { level1: 'Education', atoLabel: 'D-4 Self-education expenses', schedule: 'Individual Tax Return' },

  // === Investment deductions ===
  { level1: 'Investment', level2: 'Interest', atoLabel: 'D-7 Interest deductions', schedule: 'Individual Tax Return' },
  { level1: 'Investment', level2: 'Fees', atoLabel: 'D-8 Dividend & interest deductions', schedule: 'Individual Tax Return' },
  { level1: 'Investment', level2: 'Subscription', atoLabel: 'D-8 Investment publications / advice', schedule: 'Individual Tax Return' },

  // === Tax preparation ===
  { level1: 'Tax', level2: 'Preparation', atoLabel: 'D-10 Cost of managing tax affairs', schedule: 'Individual Tax Return' },
  { level1: 'Professional Services', level2: 'Tax Agent', atoLabel: 'D-10 Cost of managing tax affairs', schedule: 'Individual Tax Return' },
  { level1: 'Professional Services', level2: 'Accountant', atoLabel: 'D-10 Cost of managing tax affairs', schedule: 'Individual Tax Return' },

  // === Donations ===
  { level1: 'Donation', atoLabel: 'D-9 Gifts or donations', schedule: 'Individual Tax Return' },
  { level1: 'Charity', atoLabel: 'D-9 Gifts or donations', schedule: 'Individual Tax Return' },

  // === Health / medical (not directly deductible — but income-tested rebates) ===
  { level1: 'Health', level2: 'Insurance', atoLabel: 'Private health insurance (M2 / rebate)', schedule: 'Individual Tax Return' },
  { level1: 'Health', atoLabel: 'Net medical expenses (informational)', notes: 'No longer claimable for most taxpayers — kept for prior-year amendments' },

  // === Small business / sole trader ===
  { level1: 'Business', level2: 'Income', atoLabel: 'Item 15 — Net income from business', schedule: 'Business Schedule' },
  { level1: 'Business', level2: 'Expenses', atoLabel: 'P8 — All other expenses', schedule: 'Business Schedule' },
  { level1: 'Business', level2: 'Vehicle', atoLabel: 'Motor vehicle expenses', schedule: 'Business Schedule' },
  { level1: 'Business', level2: 'Subscriptions', atoLabel: 'Subscriptions', schedule: 'Business Schedule' },
  { level1: 'Business', level2: 'Office', atoLabel: 'Office supplies', schedule: 'Business Schedule' },

  // === Common consumer categories — informational only (not deductible by default) ===
  { level1: 'Food & Dining', atoLabel: 'Personal — not deductible', notes: 'Personal expense; no ATO label' },
  { level1: 'Transport', level2: 'Public Transit', atoLabel: 'Personal — not deductible', notes: 'Unless claiming D-2 work-related travel' },
  { level1: 'Transport', level2: 'Fuel', atoLabel: 'Personal — not deductible', notes: 'Unless car-expense method (cents/km or logbook)' },
  { level1: 'Transport', level2: 'Rideshare', atoLabel: 'Personal — not deductible', notes: 'Unless work-related portion claimable D-2' },
  { level1: 'Entertainment', atoLabel: 'Personal — not deductible' },
  { level1: 'Subscriptions', atoLabel: 'Personal — not deductible', notes: 'Unless work-related (D-5) or investment publication (D-8)' },

  // === Transfers (always informational — never income / never deductible) ===
  { level1: 'Transfer', atoLabel: 'Transfer (informational only)', notes: 'NOT income; NOT a deduction' },
];

/**
 * Idempotently seed the system tax mappings for a user.
 *
 * For each seed entry, we:
 *   1. Resolve the (level1, level2) triple to a `CanonicalCategoryRegistry`
 *      row via the existing PR1 helper. This either returns the existing
 *      row or lazy-seeds a new one (the registry is the SSOT).
 *   2. Upsert a `TaxCategoryMapping` row keyed by
 *      (userId=NULL, canonicalCategoryId, atoLabel). System rows have
 *      `userId IS NULL` so all users share them.
 *
 * Safe to call on every Tax Pack export — the `findUnique` short-
 * circuits when the mapping already exists. Per CLAUDE.md §12.10,
 * audit-not-required (this is system seed data, not user mutation).
 *
 * Note: the registry resolves under THIS user's id (so the registry
 * row is per-user — that's how PR1 designed it). The TaxCategoryMapping
 * with `userId IS NULL` then references the user's registry id; this
 * means each user has their own copy of the system mappings, but the
 * shape + `atoLabel` columns are identical across users (sourced from
 * `SYSTEM_TAX_MAPPING_SEEDS`). The `userId IS NULL` flag still has
 * value: it tells the UI "this is the system default; user can
 * override by inserting a row with userId set".
 */
export async function seedSystemMappings(userId: string): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  for (const seed of SYSTEM_TAX_MAPPING_SEEDS) {
    const category = await resolveOrCreateCategory({
      userId,
      level1: seed.level1,
      level2: seed.level2 ?? null,
      subcategory: null,
    });
    const existing = await prisma.taxCategoryMapping.findUnique({
      where: {
        userId_canonicalCategoryId_atoLabel: {
          userId: null as unknown as string, // Prisma treats null on a nullable in a compound key
          canonicalCategoryId: category.id,
          atoLabel: seed.atoLabel,
        },
      },
    }).catch(() => null);
    if (existing) {
      skipped++;
      continue;
    }
    try {
      await prisma.taxCategoryMapping.create({
        data: {
          userId: null,
          canonicalCategoryId: category.id,
          atoLabel: seed.atoLabel,
          schedule: seed.schedule ?? null,
          lineItem: seed.lineItem ?? null,
          notes: seed.notes ?? null,
        },
      });
      created++;
    } catch {
      // Race-tolerant — concurrent seeds collapse here.
      skipped++;
    }
  }
  return { created, skipped };
}

/**
 * Lookup all tax mappings for a category, preferring user overrides
 * over system defaults. Used by the Tax Pack export's grouping step.
 */
export async function getMappingsForCategory(
  userId: string,
  canonicalCategoryId: string
): Promise<TaxCategoryMapping[]> {
  const userOverrides = await prisma.taxCategoryMapping.findMany({
    where: { userId, canonicalCategoryId },
  });
  if (userOverrides.length > 0) return userOverrides;
  return prisma.taxCategoryMapping.findMany({
    where: { userId: null, canonicalCategoryId },
  });
}

export type { TaxCategoryMapping };
