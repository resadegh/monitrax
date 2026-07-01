/**
 * Phase 54.1 (Neobrain) — deterministic merchant-noise normalisation helpers.
 *
 * Two pure, side-effect-free helpers shared by BOTH merchant-identity producers
 * so the two can never drift (CLAUDE.md §12.2.1 — one source for one transform):
 *
 *   - `stripTransactionTimes` — removes clock times a bank feed glues into the
 *     description ("09:19hjs North Parramatta" → "hjs North Parramatta").
 *     GENERAL: helps every timestamped row, known merchant or not. The regex
 *     deliberately does NOT require a trailing word boundary — the glued form
 *     ("09:19hjs") is the whole point, and is exactly what breaks the downstream
 *     word-boundary rules/aliases until the time is removed.
 *
 *   - `expandMerchantAliases` — rewrites VERIFIED Australian bank-feed merchant
 *     abbreviations to the canonical merchant name ("hjs" → "hungry jacks") so
 *     the existing MERCHANT_MAPPINGS / CATEGORISATION_RULES / KB seed resolve
 *     them. This is what makes two noisy same-vendor rows collapse to one
 *     canonical name ("09:19hjs North Parramatta" and "13:42hjs Blacktown" both
 *     → "Hungry Jacks"), so import-time rules AND per-user auto-apply match.
 *
 * EVIDENCE-GATED (CLAUDE.md §19 — never guess): an alias entry is added ONLY
 * when the abbreviation→merchant mapping is confirmed from a real sample. Do NOT
 * populate this table speculatively — a wrong alias mis-files real money.
 *
 * Consumers: `normaliseMerchantName` (lib/bank/normalisation.ts, the per-user
 * `merchantStandardised` identity) and `scrubToSignature`
 * (lib/categorisation/kb/scrubSignature.ts, the shared-KB signature). Applied in
 * the SAME order in both: strip times → expand aliases.
 *
 * Design/behaviour doc: docs/blueprint/PHASE_54_NEOBRAIN.md §16.
 * Neomatrix: engine.normalisation.normaliseMerchantName + law.neobrain.merchantNoise.
 */

/**
 * Clock times banks glue into transaction descriptions. Matches HH:MM(:SS)
 * even when glued to the following token ("09:19hjs"). No trailing boundary
 * required — see file header.
 */
const TRANSACTION_TIME_RE = /\d{1,2}:\d{2}(?::\d{2})?/g;

/** Strip glued/standalone clock times and collapse the resulting whitespace. */
export function stripTransactionTimes(input: string): string {
  if (!input) return '';
  return input.replace(TRANSACTION_TIME_RE, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Verified AU bank-feed merchant abbreviations → canonical merchant name.
 * Key = lowercase whole-token abbreviation; value = a canonical name the
 * existing MERCHANT_MAPPINGS / CATEGORISATION_RULES / KB seed already resolve.
 *
 * EVIDENCE-GATED — add an entry ONLY from a confirmed real sample:
 *   - "hjs" → Hungry Jacks — confirmed from a live CBA feed
 *     ("09:19hjs North Parramattanorthmead", Reza 2026-07-01).
 */
export const MERCHANT_ALIASES: Record<string, string> = {
  hjs: 'hungry jacks',
};

/** Pre-compiled whole-token, case-insensitive matchers for each alias. */
const ALIAS_MATCHERS: ReadonlyArray<readonly [RegExp, string]> = Object.entries(
  MERCHANT_ALIASES,
).map(([abbr, canonical]) => [new RegExp(`\\b${abbr}\\b`, 'gi'), canonical] as const);

/**
 * Replace verified whole-token abbreviations with their canonical merchant name.
 * Whole-token (`\b…\b`) only — never a substring — so "hjs" never rewrites the
 * middle of an unrelated word. Case-insensitive; preserves surrounding text.
 */
export function expandMerchantAliases(input: string): string {
  if (!input) return '';
  let out = input;
  for (const [matcher, canonical] of ALIAS_MATCHERS) {
    matcher.lastIndex = 0;
    out = out.replace(matcher, canonical);
  }
  return out;
}

/**
 * Convenience: the canonical order both producers apply — strip times, then
 * expand aliases. Kept as one function so the ordering can't drift between the
 * two call sites.
 */
export function denoiseMerchantText(input: string): string {
  return expandMerchantAliases(stripTransactionTimes(input));
}

/**
 * Phase 54.1 P2 — identifying NUMERIC/noise tokens a bank feed appends to a
 * merchant string: BSBs, card masks (`xxxx1234`), reference tails (`ref 998…`),
 * and long digit runs (store numbers, account/reference numbers). Stripped by
 * BOTH the per-user identity (`normaliseMerchantName`) and the shared-KB
 * signature (`scrubToSignature`) — ONE source (§12.2.1) so the two keys denoise
 * numeric noise identically and can never drift.
 *
 * CONSERVATIVE BY DESIGN (§19 — over-merge misstates spend-by-category): this
 * strips only *numeric* noise. It NEVER strips location/suburb words — so
 * `SOMESHOP 1234 SYDNEY` and `SOMESHOP 9981 SYDNEY` (same store, different store
 * number) collapse to one key, but `SOMESHOP SYDNEY` and `SOMESHOP MELBOURNE`
 * (different locations) stay distinct. Cross-location matching for UNKNOWN
 * merchants is deferred to the guarded KB token-prefix / AI tail, not done here.
 *
 * Note: `\b\d{4,}\b` is word-boundary-anchored, so digits GLUED inside a token
 * (e.g. `1300SMILES`) are preserved — only free-standing numeric runs are noise.
 */
const NUMERIC_NOISE_STRIPS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b\d{3}-?\d{3}\b/g, ' '], // BSB (123-456 / 123456)
  [/x{2,}\d*/gi, ' '], // card masks (xxxx1234)
  [/\bref\b[:#]?\s*\S+/gi, ' '], // reference tails (REF: 99812)
  [/\b\d{4,}\b/g, ' '], // long digit runs (store / account / reference numbers)
];

export function stripMerchantNumericNoise(input: string): string {
  if (!input) return '';
  let out = input;
  for (const [re, repl] of NUMERIC_NOISE_STRIPS) {
    re.lastIndex = 0;
    out = out.replace(re, repl);
  }
  return out.replace(/\s+/g, ' ').trim();
}
