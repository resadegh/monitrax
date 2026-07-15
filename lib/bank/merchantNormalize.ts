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
