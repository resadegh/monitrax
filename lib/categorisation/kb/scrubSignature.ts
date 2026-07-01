/**
 * Phase 52 — PII scrubber / de-identification gate for the shared categorisation
 * knowledge base (build increment 52.1).
 *
 * Turns a raw bank-transaction description into a **de-identified merchant
 * signature** safe to contribute to the SHARED knowledge base — or rejects it.
 * This is the gate from the Phase 52 guardrails (§5): a *merchant* may enter the
 * shared KB; a *person* never does.
 *
 * Layered defence (conservative by design):
 *   1. REJECT transfer-shaped / non-merchant descriptions (where names + account
 *      numbers live, and which aren't a categorisable merchant anyway).
 *   2. STRIP payment-method noise + numbers/dates/refs/BSBs/card-masks.
 *   3. Normalise to a canonical signature (reuse normaliseDescription) → UPPERCASE.
 *   4. REJECT anything with no stable merchant token left.
 * The k-anonymity graduation gate (≥k distinct users) is the second layer — any
 * residual identifying string never reaches enough users to be shared.
 *
 * See docs/blueprint/PHASE_52_SHARED_CATEGORISATION_KB.md §4.1, §5.
 */

import { normaliseDescription } from '@/lib/bookkeeping/normaliseDescription';
import { denoiseMerchantText } from '@/lib/bank/merchantNoise';

export type ScrubResult =
  | { ok: true; pattern: string }
  | { ok: false; reason: string };

/**
 * Descriptions that are NOT a categorisable merchant and/or commonly carry a
 * person's name or account number. We refuse to contribute these to the shared
 * KB at all (they stay in the per-user layer if anywhere).
 */
const REJECT_MARKERS =
  /\b(transfer|tfr|trf|xfer|pay\s?id|payid|osko|npp|to\s+acct|from\s+acct|internal\s+transfer|atm|cash\s?out|cash\s+withdrawal|withdrawal|deposit\s+from)\b/i;

/**
 * Payment-method / channel noise to remove while KEEPING the merchant token
 * (e.g. "EFTPOS BUNNINGS" → "BUNNINGS").
 */
const STRIP_TOKENS =
  /\b(eftpos|visa\s+purchase|visa|mastercard|card\s+purchase|pos\s+purchase|pos|purchase|direct\s+debit|direct\s+credit|dd|tap\s+and\s+pay|contactless|au\b|aus\b|australia)\b/gi;

/**
 * Produce a de-identified signature from a raw description, or reject it.
 */
export function scrubToSignature(raw: string | null | undefined): ScrubResult {
  if (!raw || raw.trim().length < 3) return { ok: false, reason: 'empty-or-too-short' };

  if (REJECT_MARKERS.test(raw)) {
    return { ok: false, reason: 'transfer-or-non-merchant (potential PII)' };
  }

  // Strip identifying tokens BEFORE normalising. Phase 54.1: first strip glued
  // clock-times and expand verified merchant abbreviations (shared with the
  // per-user identity via lib/bank/merchantNoise.ts) so a noisy same-vendor
  // signature de-noises the same way on both the private and shared paths.
  const stripped = denoiseMerchantText(raw)
    .replace(/\b\d{3}-?\d{3}\b/g, ' ') // BSB
    .replace(/x{2,}\d*/gi, ' ') // card masks (xxxx1234)
    .replace(/\b\d{1,2}[\/\-.]\d{1,2}([\/\-.]\d{2,4})?\b/g, ' ') // dates
    .replace(/\bref\b[:#]?\s*\S+/gi, ' ') // reference tails
    .replace(/\b\d{4,}\b/g, ' ') // long digit runs (account / ref numbers)
    .replace(STRIP_TOKENS, ' ');

  // normaliseDescription: lowercases, strips non-alphanumerics, collapses, caps 64.
  const pattern = normaliseDescription(stripped).trim().toUpperCase();

  // Reject if no stable alphabetic merchant token remains (≥3 letters).
  if (pattern.replace(/[^A-Z]/g, '').length < 3) {
    return { ok: false, reason: 'no-stable-merchant-token' };
  }

  return { ok: true, pattern };
}
