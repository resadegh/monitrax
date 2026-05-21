/**
 * mapDocumentFields — Phase 12 Track G.5
 *
 * Pure mapper: turns the `fieldMappings` returned by the existing
 * Phase 26.6 endpoint `/api/documents/analyze-for-form` into a single
 * onboarding wizard row — an `IncomeInput` for a payslip, an
 * `ExpenseInput` for a bill or receipt.
 *
 * SSOT note: this module does NOT extract anything itself and contains
 * no financial calculation. Document OCR + AI field extraction is owned
 * by `/api/documents/analyze-for-form` (the canonical Phase 26 engine);
 * frequency-to-annual conversion is owned by `lib/utils/frequencies.ts`
 * and applied later by `calculateSummary`. This file is purely a shape
 * adapter from the API's `FieldMapping` record to one wizard row.
 *
 * Design rules (docs/blueprint/PHASE_12_TRACK_G_UNIFIED_ONBOARDING.md §6 G.5):
 *   - APPEND-only — produces ONE new row with a fresh `temp_` id. The
 *     caller appends it; the form stays the system of record. A poor
 *     extraction is non-destructive: at worst the user deletes the row.
 *   - Defensive — every field is validated against the wizard enums. An
 *     unrecognised value falls back to a safe default; a missing or
 *     unparseable amount yields 0 so the user simply types it in.
 *   - Pure — no I/O, no React. Trivially unit-testable.
 */

import {
  EXPENSE_CATEGORY_LABELS,
  ExpenseCategory,
  ExpenseInput,
  Frequency,
  IncomeInput,
  generateId,
} from '@/components/onboarding/wizard/types';

/** One field as returned by `/api/documents/analyze-for-form`. */
export interface DocumentFieldMapping {
  value: unknown;
  confidence?: number;
  source?: string;
  reason?: string;
}

export type DocumentFieldMappings = Record<string, DocumentFieldMapping>;

/** The two document kinds the onboarding accelerator supports. */
export type DocumentFormType = 'income' | 'expense';

const VALID_FREQUENCIES: ReadonlySet<string> = new Set<Frequency>([
  'WEEKLY',
  'FORTNIGHTLY',
  'MONTHLY',
  'QUARTERLY',
  'ANNUAL',
]);

// ---------------------------------------------------------------------------
// Field readers
// ---------------------------------------------------------------------------

/** The raw `value` of a mapping, or `undefined` when the field is absent. */
function rawValue(fields: DocumentFieldMappings, key: string): unknown {
  const mapping = fields[key];
  return mapping && typeof mapping === 'object' ? mapping.value : undefined;
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

/**
 * Parse a money/number value. The API usually returns a clean number,
 * but the pattern-matching fallback or a stray AI response can hand back
 * a string like "$1,234.50" — strip everything but digits, dot, minus.
 * Returns the magnitude: an income/expense amount is never negative.
 */
function asAmount(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.abs(value) : undefined;
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.\-]/g, '');
    if (!cleaned || cleaned === '-' || cleaned === '.') return undefined;
    const n = Number(cleaned);
    return Number.isFinite(n) ? Math.abs(n) : undefined;
  }
  return undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const t = value.trim().toLowerCase();
    if (t === 'true' || t === 'yes' || t === 'y') return true;
    if (t === 'false' || t === 'no' || t === 'n') return false;
  }
  return undefined;
}

/** Validate an extracted frequency against the wizard `Frequency` enum. */
function normalizeFrequency(value: unknown, fallback: Frequency): Frequency {
  const raw = asString(value);
  if (!raw) return fallback;
  const upper = raw.toUpperCase().replace(/\s+/g, '');
  if (VALID_FREQUENCIES.has(upper)) return upper as Frequency;
  // Tolerate a few natural-language variants the AI might return, e.g.
  // "per week", "fortnightly", "monthly". Fortnight/biweekly is checked
  // before "week" because "biweekly" also contains "week".
  if (upper.includes('FORT') || upper.includes('BIWEEK')) return 'FORTNIGHTLY';
  if (upper.includes('WEEK')) return 'WEEKLY';
  if (upper.includes('MONTH')) return 'MONTHLY';
  if (upper.includes('QUART')) return 'QUARTERLY';
  if (upper.includes('ANNUAL') || upper.includes('YEAR')) return 'ANNUAL';
  return fallback;
}

/** Validate an extracted category against the wizard `ExpenseCategory` enum. */
function normalizeCategory(value: unknown): ExpenseCategory {
  const raw = asString(value);
  if (!raw) return 'OTHER';
  const upper = raw.toUpperCase().replace(/\s+/g, '_');
  if (Object.prototype.hasOwnProperty.call(EXPENSE_CATEGORY_LABELS, upper)) {
    return upper as ExpenseCategory;
  }
  return 'OTHER';
}

// ---------------------------------------------------------------------------
// Public mappers
// ---------------------------------------------------------------------------

/**
 * Map a payslip's extracted fields to a single `IncomeInput` row.
 * `type` is fixed to SALARY (a payslip is salary/wages) and `salaryType`
 * to GROSS (payslips quote gross pay). Frequency defaults to FORTNIGHTLY
 * — the most common Australian pay cycle — when the document doesn't
 * state one.
 */
export function mapDocumentToIncome(fields: DocumentFieldMappings): IncomeInput {
  const source = asString(rawValue(fields, 'source'));
  const description = asString(rawValue(fields, 'description'));
  return {
    id: generateId(),
    name: source || description || 'Income from payslip',
    type: 'SALARY',
    amount: asAmount(rawValue(fields, 'amount')) ?? 0,
    frequency: normalizeFrequency(rawValue(fields, 'frequency'), 'FORTNIGHTLY'),
    salaryType: 'GROSS',
  };
}

/**
 * Map a bill/receipt's extracted fields to a single `ExpenseInput` row.
 * Frequency defaults to MONTHLY — a one-off receipt has no cadence, and
 * MONTHLY is the safest starting point for the user to adjust.
 */
export function mapDocumentToExpense(
  fields: DocumentFieldMappings,
): ExpenseInput {
  const vendor = asString(rawValue(fields, 'vendor'));
  const description = asString(rawValue(fields, 'description'));
  const taxDeductible = asBoolean(rawValue(fields, 'taxDeductible'));
  return {
    id: generateId(),
    name: vendor || description || 'Expense from document',
    category: normalizeCategory(rawValue(fields, 'category')),
    amount: asAmount(rawValue(fields, 'amount')) ?? 0,
    frequency: 'MONTHLY',
    ...(taxDeductible !== undefined ? { isTaxDeductible: taxDeductible } : {}),
  };
}
