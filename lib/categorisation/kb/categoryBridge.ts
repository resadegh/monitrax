/**
 * Phase 52.5c — the ONE bridge between the two category vocabularies in the app.
 *
 * The app has two category vocabularies (a pre-existing split, not introduced here):
 *   1. LEGACY FLAT CODES — `EXPENSE_CATEGORIES` / `INCOME_TYPES` (e.g. `GROCERIES`,
 *      `LOAN_INTEREST`, `SALARY`). Used by the Expense/Income Prisma enum columns and
 *      by the Link / reconciliation dialog (`/api/transactions/[id]/link`).
 *   2. CANONICAL 3-LEVEL HIERARCHY — `CATEGORY_HIERARCHY` (e.g. `Food & Dining` >
 *      `Groceries`). Used by the TIE categoriser, the `CanonicalCategoryRegistry`
 *      (§12.2 SSOT), and the shared categorisation KB (Phase 52).
 *
 * Without a bridge, the Link dialog would write flat codes into the KB while every
 * other surface writes the canonical triple — fragmenting graduation (the same
 * Woolworths pattern voted `GROCERIES` vs `Food & Dining>Groceries` never reaches k
 * cleanly) and surfacing mismatched names on read. This module is the single,
 * documented, maintainable correspondence so the Link dialog can read AND write the
 * KB in the canonical vocabulary like everything else.
 *
 * The mappings are best-effort canonicalisations (some legacy codes are coarser than
 * the hierarchy). What matters for the KB is CONSISTENCY — the same code always maps
 * to the same triple — which this guarantees. When the codes ↔ hierarchy taxonomies
 * are eventually unified (the larger §12.2 cleanup), this bridge is the one file to
 * retire.
 *
 * See docs/blueprint/PHASE_52_SHARED_CATEGORISATION_KB.md §8b.
 */

export interface CanonicalTriple {
  level1: string;
  level2: string | null;
  subcategory: string | null;
}

/** Legacy `EXPENSE_CATEGORIES` code → canonical triple. */
const EXPENSE_CODE_TO_CANONICAL: Record<string, CanonicalTriple> = {
  HOUSING: { level1: 'Housing', level2: null, subcategory: null },
  RATES: { level1: 'Bills & Utilities', level2: 'Council Rates', subcategory: null },
  INSURANCE: { level1: 'Financial', level2: 'Insurance Premiums', subcategory: null },
  MAINTENANCE: { level1: 'Housing', level2: 'Repairs & Maintenance', subcategory: null },
  PERSONAL: { level1: 'Personal Care', level2: null, subcategory: null },
  UTILITIES: { level1: 'Bills & Utilities', level2: null, subcategory: null },
  FOOD: { level1: 'Food & Dining', level2: null, subcategory: null },
  GROCERIES: { level1: 'Food & Dining', level2: 'Groceries', subcategory: null },
  TRANSPORT: { level1: 'Transport', level2: null, subcategory: null },
  ENTERTAINMENT: { level1: 'Entertainment', level2: null, subcategory: null },
  SUBSCRIPTION: { level1: 'Entertainment', level2: 'Streaming Services', subcategory: null },
  STRATA: { level1: 'Bills & Utilities', level2: 'Body Corporate', subcategory: null },
  LAND_TAX: { level1: 'Financial', level2: 'Tax Payments', subcategory: null },
  LOAN_INTEREST: { level1: 'Financial', level2: 'Interest Payments', subcategory: null },
  REGISTRATION: { level1: 'Transport', level2: 'Registration & Insurance', subcategory: null },
  MODIFICATIONS: { level1: 'Housing', level2: 'Repairs & Maintenance', subcategory: null },
  HEALTH: { level1: 'Health', level2: null, subcategory: null },
  EDUCATION: { level1: 'Education', level2: null, subcategory: null },
  OTHER: { level1: 'Other', level2: null, subcategory: null },
};

/** Legacy `INCOME_TYPES` code → canonical triple (all under the `Income` level1). */
const INCOME_CODE_TO_CANONICAL: Record<string, CanonicalTriple> = {
  SALARY: { level1: 'Income', level2: 'Salary', subcategory: null },
  RENT: { level1: 'Income', level2: 'Rental Income', subcategory: null },
  RENTAL: { level1: 'Income', level2: 'Rental Income', subcategory: null },
  INVESTMENT: { level1: 'Income', level2: 'Dividends', subcategory: null },
  OTHER: { level1: 'Income', level2: 'Other Income', subcategory: null },
};

export type TxDirection = 'IN' | 'OUT';

/**
 * Map a legacy flat category code (from the Link dialog / Expense-Income enums) to
 * the canonical triple. Returns null for unknown / custom codes (custom categories
 * are user-specific free text — they never graduate, so they don't belong in the KB).
 */
export function legacyCodeToCanonical(
  code: string | null | undefined,
  direction: TxDirection
): CanonicalTriple | null {
  if (!code) return null;
  const table = direction === 'IN' ? INCOME_CODE_TO_CANONICAL : EXPENSE_CODE_TO_CANONICAL;
  return table[code.toUpperCase().trim()] ?? null;
}

// --- inverse (canonical → legacy code), built once for the READ path -------------

function buildReverse(table: Record<string, CanonicalTriple>) {
  const byPair = new Map<string, string>(); // `${level1}>${level2}` → code
  const byLevel1 = new Map<string, string>(); // `${level1}` → first code
  for (const [code, t] of Object.entries(table)) {
    const pairKey = `${t.level1}>${t.level2 ?? ''}`;
    if (!byPair.has(pairKey)) byPair.set(pairKey, code);
    if (!byLevel1.has(t.level1)) byLevel1.set(t.level1, code);
  }
  return { byPair, byLevel1 };
}

const EXPENSE_REVERSE = buildReverse(EXPENSE_CODE_TO_CANONICAL);
const INCOME_REVERSE = buildReverse(INCOME_CODE_TO_CANONICAL);

/**
 * Map a canonical (level1, level2) — e.g. a shared-KB suggestion — back to the
 * closest legacy code the Link dialog's CategorySelect understands. Falls back from
 * an exact (level1, level2) match → level1-only → 'OTHER'. Direction picks the table.
 */
export function canonicalToLegacyCode(
  level1: string | null | undefined,
  level2: string | null | undefined,
  direction: TxDirection
): string {
  const { byPair, byLevel1 } = direction === 'IN' ? INCOME_REVERSE : EXPENSE_REVERSE;
  if (!level1) return 'OTHER';
  return (
    byPair.get(`${level1}>${level2 ?? ''}`) ??
    byPair.get(`${level1}>`) ??
    byLevel1.get(level1) ??
    'OTHER'
  );
}
