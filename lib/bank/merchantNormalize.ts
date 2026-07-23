/**
 * Merchant-name normalisation (MON-025) — for deduping expense/income records
 * that reconciliation would otherwise fragment because the bank supplies the
 * same merchant under slightly different strings.
 *
 * e.g. "QBE Insurance (Australia) Limited" and
 *      "Qbe Insurance (australia) Limited Abn 78 003 191 035"
 * both normalise to "qbe insurance" → one record, not two.
 *
 * Deliberately conservative: it strips only noise that is safe to remove
 * (case, punctuation, legal suffixes, ABN/ref numbers, trailing digit blobs),
 * so genuinely different merchants keep distinct keys. PURE.
 */

const LEGAL_SUFFIXES = [
  'pty ltd', 'pty limited', 'proprietary limited', 'ltd', 'limited', 'inc',
  'incorporated', 'llc', 'plc', 'co', 'company', 'group', 'holdings',
];
const NOISE_WORDS = ['australia', 'aus', 'the'];

/** A stable key for a merchant string — lowercased, de-punctuated, suffix-stripped. */
export function normalizeMerchant(raw: string | null | undefined): string {
  if (!raw) return '';
  let s = raw.toLowerCase();
  // Drop ABN / ACN + their numbers, and any long digit/ref blobs.
  s = s.replace(/\bab[cn]\b[\s:]*[\d\s]{5,}/g, ' ');
  s = s.replace(/\b\d[\d\s-]{3,}\d\b/g, ' ');
  // Punctuation → space.
  s = s.replace(/[^a-z0-9\s]/g, ' ');
  // Tokenise + drop legal suffixes and noise words.
  const suffixSet = new Set(LEGAL_SUFFIXES.flatMap((p) => p.split(' ')));
  const noiseSet = new Set(NOISE_WORDS);
  const tokens = s.split(/\s+/).filter((t) => t && !suffixSet.has(t) && !noiseSet.has(t));
  return tokens.join(' ').trim();
}

/** True when two merchant strings refer to the same merchant after normalisation. */
export function sameMerchant(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeMerchant(a);
  const nb = normalizeMerchant(b);
  return na.length > 0 && na === nb;
}

/**
 * MON-037 RC-B — true when one normalised name is a TOKEN-SUBSET of the other
 * ("Battery" ⊂ "Battery System" / "Battery Replacement"), the fingerprint of
 * the same real-world cost entered twice under name variants via different
 * intake paths (document-import estimate vs transaction-link actual).
 * Deliberately conservative: containment only (never partial overlap), so
 * "home insurance" vs "car insurance" stay distinct. Equal names are related.
 * NOT sufficient alone to declare a duplicate — pair with an amount check
 * (see lib/utils/reconciliation.ts `isNearDuplicateEntry`, the ONE decision).
 */
export function relatedMerchant(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeMerchant(a);
  const nb = normalizeMerchant(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ta = new Set(na.split(' '));
  const tb = new Set(nb.split(' '));
  const [small, large] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  for (const t of small) if (!large.has(t)) return false;
  return true;
}

/**
 * MON-095 — identifier tokens: the long digit runs in a RAW merchant string
 * that plausibly identify a specific policy / account / membership (e.g.
 * "Aia Australia . 68718123 /26" → ["68718123"]). ABN/ACN numbers are
 * excluded first (company-level, shared by every policy of the insurer).
 * PURE. ONE source — both the intake guardrail and the duplicates review
 * read identifiers through this function, never a second regex.
 */
export function extractIdentifierTokens(raw: string | null | undefined): string[] {
  if (!raw) return [];
  let s = raw.toLowerCase();
  s = s.replace(/\bab[cn]\b[\s:]*[\d\s]{5,}/g, ' ');
  const runs = s.match(/\d{5,}/g) ?? [];
  return [...new Set(runs)];
}

/**
 * MON-095 — true when BOTH strings carry identifier tokens and they share
 * none: the fingerprint of two DIFFERENT policies/accounts at the same
 * provider ("Aia … 68718123" vs "Aia … 68718100"). Merging these deletes a
 * real policy — the false-positive class Reza caught live (2026-07-23).
 * When either side has no identifier, this returns false (no evidence of
 * distinctness — the amount guard still applies separately).
 */
export function hasDisjointIdentifiers(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ta = extractIdentifierTokens(a);
  const tb = extractIdentifierTokens(b);
  if (ta.length === 0 || tb.length === 0) return false;
  return !ta.some((t) => tb.includes(t));
}
