/**
 * Phase 42 PR4 — Merchant Category Code (MCC) catalog for QIF / CSV / OFX.
 *
 * BASIQ ships MCC codes natively on every transaction. QIF / CSV / OFX
 * imports don't — they arrive as plain strings ("COLES BRUNSWICK 1234").
 * This catalog is the *self-hosted* substitute: ~50 high-volume AU
 * merchants mapped to their official MCC codes, applied at
 * normalisation time so the downstream categoriser gets the same
 * BASIQ-grade signal regardless of source.
 *
 * Per CLAUDE.md §12.2 SSOT — there is exactly one place that defines
 * "what MCC does this merchant have?", and it lives in this file.
 * Per §12.3 — no parallel implementation; every import path calls
 * `lookupMCC()` exactly once at normalisation.
 *
 * BASIQ-onboarding behaviour: when BASIQ later supersedes a QIF/CSV
 * row (Phase 13.10), the BASIQ-supplied MCC overrides the catalog
 * lookup automatically — BASIQ is more authoritative than our seed
 * for any merchant it covers. The catalog continues to seed any
 * QIF/CSV import the user runs while BASIQ is connected (e.g.
 * historical CSV imports for a period before BASIQ was activated).
 *
 * MCC reference: ISO 18245 / Visa-Mastercard merchant codes.
 *   - 4900s — Utilities (electricity, gas, water, telco)
 *   - 5200s — Building / hardware retail
 *   - 5400s — Grocery / food retail
 *   - 5800s — Eating places
 *   - 7000s — Lodging / travel
 *   - 8000s — Education / professional services
 */

export interface MccEntry {
  /** Canonical merchant key (lowercase, alphanumeric-collapsed). */
  key: string;
  /** Pattern alternates the catalog scans for. ALL must be lowercase. */
  patterns: readonly string[];
  /** ISO 18245 4-digit merchant category code. */
  mcc: string;
  /** Human-readable label (for debugging / future inspector UI). */
  label: string;
}

const MCC_CATALOG: readonly MccEntry[] = [
  // === Grocery / supermarkets (5411) ===
  { key: 'coles', patterns: ['coles', 'coles supermarkets', 'coles group'], mcc: '5411', label: 'Coles' },
  { key: 'woolworths', patterns: ['woolworths', 'woolies', 'woolworths group'], mcc: '5411', label: 'Woolworths' },
  { key: 'aldi', patterns: ['aldi', 'aldi stores'], mcc: '5411', label: 'Aldi' },
  { key: 'iga', patterns: ['iga', 'iga supermarket'], mcc: '5411', label: 'IGA' },
  { key: 'costco', patterns: ['costco', 'costco wholesale'], mcc: '5411', label: 'Costco' },

  // === Hardware / building (5200) ===
  { key: 'bunnings', patterns: ['bunnings', 'bunnings warehouse'], mcc: '5200', label: 'Bunnings' },
  { key: 'mitre10', patterns: ['mitre 10', 'mitre10'], mcc: '5200', label: 'Mitre 10' },

  // === Office supplies (5943) ===
  { key: 'officeworks', patterns: ['officeworks', 'office works'], mcc: '5943', label: 'Officeworks' },

  // === Pharmacy (5912) ===
  { key: 'chemistwarehouse', patterns: ['chemist warehouse', 'chemistwarehouse'], mcc: '5912', label: 'Chemist Warehouse' },
  { key: 'priceline', patterns: ['priceline pharmacy', 'priceline'], mcc: '5912', label: 'Priceline' },
  { key: 'terry-white', patterns: ['terry white', 'terrywhite'], mcc: '5912', label: 'Terry White Chemmart' },

  // === Department stores (5311) ===
  { key: 'kmart', patterns: ['kmart', 'k-mart', 'kmart australia'], mcc: '5311', label: 'Kmart' },
  { key: 'target', patterns: ['target australia', 'target country'], mcc: '5311', label: 'Target' },
  { key: 'big-w', patterns: ['big w', 'bigw'], mcc: '5311', label: 'Big W' },
  { key: 'myer', patterns: ['myer'], mcc: '5311', label: 'Myer' },
  { key: 'davidjones', patterns: ['david jones', 'davidjones'], mcc: '5311', label: 'David Jones' },

  // === Electricity (4900) ===
  { key: 'agl', patterns: ['agl', 'agl energy'], mcc: '4900', label: 'AGL Energy' },
  { key: 'origin', patterns: ['origin energy', 'origin'], mcc: '4900', label: 'Origin Energy' },
  { key: 'energyaustralia', patterns: ['energy australia', 'energyaustralia'], mcc: '4900', label: 'EnergyAustralia' },
  { key: 'red-energy', patterns: ['red energy'], mcc: '4900', label: 'Red Energy' },

  // === Telecom (4814) ===
  { key: 'telstra', patterns: ['telstra'], mcc: '4814', label: 'Telstra' },
  { key: 'optus', patterns: ['optus'], mcc: '4814', label: 'Optus' },
  { key: 'vodafone', patterns: ['vodafone', 'tpg'], mcc: '4814', label: 'Vodafone / TPG' },

  // === Water (4900) ===
  { key: 'sydneywater', patterns: ['sydney water'], mcc: '4900', label: 'Sydney Water' },
  { key: 'yarra-valley-water', patterns: ['yarra valley water'], mcc: '4900', label: 'Yarra Valley Water' },

  // === Streaming (4899) ===
  { key: 'netflix', patterns: ['netflix'], mcc: '4899', label: 'Netflix' },
  { key: 'spotify', patterns: ['spotify'], mcc: '4899', label: 'Spotify' },
  { key: 'disney', patterns: ['disney plus', 'disneyplus', 'disney+'], mcc: '4899', label: 'Disney+' },
  { key: 'stan', patterns: ['stan entertainment', 'stan.com.au'], mcc: '4899', label: 'Stan' },
  { key: 'binge', patterns: ['binge', 'foxtel binge'], mcc: '4899', label: 'Binge' },

  // === Petrol (5541) ===
  { key: 'bp', patterns: ['bp '], mcc: '5541', label: 'BP' },
  { key: 'shell', patterns: ['shell ', 'shell coles express'], mcc: '5541', label: 'Shell' },
  { key: '7eleven', patterns: ['7-eleven', '7eleven'], mcc: '5541', label: '7-Eleven' },
  { key: 'caltex', patterns: ['caltex', 'ampol'], mcc: '5541', label: 'Ampol / Caltex' },
  { key: 'united', patterns: ['united petroleum', 'united '], mcc: '5541', label: 'United Petroleum' },

  // === Food delivery (5814) — MUST come BEFORE the rideshare /
  // "uber " match so "uber eats" doesn't get mis-categorised as
  // rideshare (the catalog scans top-to-bottom and the first
  // pattern hit wins).
  { key: 'ubereats', patterns: ['uber eats', 'ubereats'], mcc: '5814', label: 'Uber Eats' },
  { key: 'menulog', patterns: ['menulog'], mcc: '5814', label: 'Menulog' },
  { key: 'doordash', patterns: ['doordash'], mcc: '5814', label: 'DoorDash' },

  // === Rideshare / taxi (4121 / 4111) ===
  { key: 'uber', patterns: ['uber ', 'uber au', 'uberau', 'uber bv'], mcc: '4121', label: 'Uber' },
  { key: 'didi', patterns: ['didi'], mcc: '4121', label: 'DiDi' },
  { key: 'ola', patterns: ['ola australia', 'ola cabs'], mcc: '4121', label: 'Ola' },

  // === Public transport (4111) ===
  { key: 'opal', patterns: ['opal pay', 'transport for nsw', 'tfnsw'], mcc: '4111', label: 'Opal / TfNSW' },
  { key: 'myki', patterns: ['ptv', 'myki'], mcc: '4111', label: 'myki / PTV' },

  // === Coffee / fast food (5814) ===
  { key: 'mcdonalds', patterns: ['mcdonalds', "mcdonald's"], mcc: '5814', label: "McDonald's" },
  { key: 'kfc', patterns: ['kfc'], mcc: '5814', label: 'KFC' },
  { key: 'subway', patterns: ['subway'], mcc: '5814', label: 'Subway' },
  { key: 'starbucks', patterns: ['starbucks'], mcc: '5814', label: 'Starbucks' },

  // === Insurance (6300) ===
  { key: 'nrma', patterns: ['nrma '], mcc: '6300', label: 'NRMA Insurance' },
  { key: 'racv', patterns: ['racv'], mcc: '6300', label: 'RACV' },
  { key: 'aami', patterns: ['aami'], mcc: '6300', label: 'AAMI' },
  { key: 'allianz', patterns: ['allianz'], mcc: '6300', label: 'Allianz' },
  { key: 'medibank', patterns: ['medibank'], mcc: '6300', label: 'Medibank' },
  { key: 'bupa', patterns: ['bupa'], mcc: '6300', label: 'Bupa' },

  // === Tax / government (9311) ===
  { key: 'ato', patterns: ['ato ', 'australian taxation', 'aus tax office'], mcc: '9311', label: 'ATO' },
];

const KEY_INDEX = new Map<string, MccEntry>(MCC_CATALOG.map((e) => [e.key, e]));

/**
 * Normalise a merchant name for catalog lookup. Mirror of the
 * normalisation in `lib/bookkeeping/normaliseDescription.ts`: lowercase,
 * alphanumeric-runs-collapsed, whitespace-runs-collapsed, trimmed.
 *
 * Kept inline (not imported) because this module ships in the import
 * pipeline and we don't want a circular dep between `lib/bank/` and
 * `lib/bookkeeping/`.
 */
export function normaliseMerchantForMcc(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Look up a merchant string against the catalog. Returns the matching
 * MCC entry (or null) on the FIRST pattern hit. Patterns are matched
 * as substring on the normalised merchant name.
 *
 * Order in `MCC_CATALOG` is preserved — earlier entries win when
 * patterns overlap (rare; keep the catalog deduped by intent). The
 * key index is provided for direct-key lookup in tests and admin.
 */
export function lookupMCC(merchant: string | null | undefined): MccEntry | null {
  const norm = normaliseMerchantForMcc(merchant);
  if (norm.length === 0) return null;
  for (const entry of MCC_CATALOG) {
    for (const pattern of entry.patterns) {
      if (norm.includes(pattern)) return entry;
    }
  }
  return null;
}

/**
 * Look up by canonical key. Useful for admin tooling and tests.
 * Does NOT scan patterns — pass the entry's `key` (e.g. 'coles').
 */
export function getMccEntry(key: string): MccEntry | null {
  return KEY_INDEX.get(key) ?? null;
}

/**
 * Read-only access to the full catalog — for admin / inspector UI.
 */
export const MCC_CATALOG_READONLY: readonly MccEntry[] = MCC_CATALOG;
