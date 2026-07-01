/**
 * Phase 54.1 (Neobrain) — merchant-noise denoising tests.
 *
 * Pins the two shared helpers (time-strip + verified alias expansion) and the
 * end-to-end effect on BOTH merchant-identity producers:
 *   - per-user identity   → renormaliseMerchant (lib/bank/normalisation.ts)
 *   - shared-KB signature → scrubToSignature (lib/categorisation/kb/scrubSignature.ts)
 *
 * The load-bearing case (Reza 2026-07-01): "09:19hjs North Parramattanorthmead"
 * and a later "13:42hjs Blacktown" must collapse to the SAME canonical merchant
 * so import-time rules + per-user auto-apply match across time/location noise.
 *
 * Over-merge guardrails (CLAUDE.md §19 — mis-merge misstates spend-by-category):
 * distinct merchants must NOT collapse, and the whole-token alias must never
 * rewrite the middle of an unrelated word.
 */

import { describe, it, expect } from 'vitest';
import {
  stripTransactionTimes,
  expandMerchantAliases,
  denoiseMerchantText,
  stripMerchantNumericNoise,
  MERCHANT_ALIASES,
} from '@/lib/bank/merchantNoise';
import { renormaliseMerchant } from '@/lib/bank/normalisation';
import { scrubToSignature } from '@/lib/categorisation/kb/scrubSignature';

describe('stripTransactionTimes', () => {
  it('strips a clock-time glued to the following token', () => {
    expect(stripTransactionTimes('09:19hjs North Parramatta')).toBe('hjs North Parramatta');
  });
  it('strips a standalone clock-time', () => {
    expect(stripTransactionTimes('WOOLWORTHS 14:05 SYDNEY')).toBe('WOOLWORTHS SYDNEY');
  });
  it('strips HH:MM:SS', () => {
    expect(stripTransactionTimes('COLES 08:30:59')).toBe('COLES');
  });
  it('leaves a description with no time untouched', () => {
    expect(stripTransactionTimes('BUNNINGS WAREHOUSE')).toBe('BUNNINGS WAREHOUSE');
  });
  it('does not strip a slash-date (that is a different noise class)', () => {
    expect(stripTransactionTimes('TELSTRA 05/06/2026')).toBe('TELSTRA 05/06/2026');
  });
  it('strips a LEADING space-separated time (colon → space at import) — 54.2e', () => {
    // cleanDescription rewrites "14:44hjs" → "14 44hjs" before storage; the
    // backfill must still recognise it as a leading time.
    expect(stripTransactionTimes('14 44hjs North Parramattanorthmead')).toBe(
      'hjs North Parramattanorthmead'
    );
    expect(stripTransactionTimes('09 56hjs North Parramatta')).toBe('hjs North Parramatta');
  });
  it('does NOT strip a mid-string number pair (only a LEADING time)', () => {
    expect(stripTransactionTimes('SOMESHOP 1234 SYDNEY')).toBe('SOMESHOP 1234 SYDNEY');
    expect(stripTransactionTimes('LEVEL 33 BAR')).toBe('LEVEL 33 BAR');
  });
  it('does NOT strip a leading 4-digit number (not a time)', () => {
    expect(stripTransactionTimes('1300 SMILES DENTAL')).toBe('1300 SMILES DENTAL');
  });
});

describe('expandMerchantAliases', () => {
  it('expands a verified whole-token abbreviation', () => {
    expect(expandMerchantAliases('hjs North Parramatta')).toBe('hungry jacks North Parramatta');
  });
  it('is case-insensitive', () => {
    expect(expandMerchantAliases('HJS Blacktown')).toBe('hungry jacks Blacktown');
  });
  it('NEVER rewrites the middle of an unrelated word (whole-token only)', () => {
    // guardrail: "highjinks" contains "hjs"? no — but prove substring safety
    expect(expandMerchantAliases('thjsomething')).toBe('thjsomething');
    expect(expandMerchantAliases('ashjs')).toBe('ashjs');
  });
  it('leaves text with no alias untouched', () => {
    expect(expandMerchantAliases('COLES EXPRESS')).toBe('COLES EXPRESS');
  });
  it('alias table is evidence-gated and small (no speculative bloat)', () => {
    expect(Object.keys(MERCHANT_ALIASES).length).toBeLessThanOrEqual(5);
    expect(MERCHANT_ALIASES.hjs).toBe('hungry jacks');
  });
});

describe('denoiseMerchantText — order is strip-times then expand-aliases', () => {
  it('resolves the glued time+abbreviation case', () => {
    // Without stripping the time first, "09:19hjs" has no word boundary before
    // "hjs" and the alias would not fire — order matters.
    expect(denoiseMerchantText('09:19hjs North Parramatta')).toBe(
      'hungry jacks North Parramatta',
    );
  });
});

describe('end-to-end — per-user identity (renormaliseMerchant)', () => {
  it('two noisy same-vendor rows collapse to ONE canonical merchant', () => {
    const a = renormaliseMerchant('09:19hjs North Parramattanorthmead');
    const b = renormaliseMerchant('13:42hjs Blacktown');
    expect(a).toBe('Hungry Jacks');
    expect(b).toBe('Hungry Jacks');
    expect(a).toBe(b); // → per-user auto-apply + rules match across location/time
  });
  it('the SPACE form as stored on existing rows also resolves (54.2e backfill fix)', () => {
    expect(renormaliseMerchant('14 44hjs North Parramattanorthmead')).toBe('Hungry Jacks');
    expect(renormaliseMerchant('09 56hjs North Parramattanorthmead')).toBe('Hungry Jacks');
  });
  it('a clean known merchant is unaffected by the new denoise', () => {
    expect(renormaliseMerchant('WOOLWORTHS 1234 NSW')).toBe('Woolworths');
  });
  it('OVER-MERGE GUARDRAIL: distinct merchants stay distinct', () => {
    const cafe = renormaliseMerchant('08:00 SMITH ST CAFE MANLY');
    const bar = renormaliseMerchant('22:00 SMITH ST BAR MANLY');
    expect(cafe).not.toBe(bar);
  });
});

describe('end-to-end — shared-KB signature (scrubToSignature)', () => {
  function pattern(raw: string): string | null {
    const r = scrubToSignature(raw);
    return r.ok ? r.pattern : null;
  }
  it('de-noises time + abbreviation into a matchable signature', () => {
    expect(pattern('09:19hjs North Parramattanorthmead')).toBe(
      'HUNGRY JACKS NORTH PARRAMATTANORTHMEAD',
    );
  });
  it('the abbreviation-expanded signature shares the seed merchant prefix', () => {
    // seedData has "HUNGRY JACKS" → the token-prefix KB lookup can now match.
    expect(pattern('13:42hjs Blacktown')?.startsWith('HUNGRY JACKS')).toBe(true);
  });
  it('does not regress the existing store-number strip', () => {
    expect(pattern('WOOLWORTHS 1234 SYDNEY')).toBe('WOOLWORTHS SYDNEY');
  });
});

// ─── Phase 54.1 P2 — shared numeric-noise strip + per-user key unification ───

describe('stripMerchantNumericNoise', () => {
  it('strips a long free-standing digit run (store / ref number)', () => {
    expect(stripMerchantNumericNoise('SOMESHOP 1234 SYDNEY')).toBe('SOMESHOP SYDNEY');
  });
  it('strips a BSB', () => {
    expect(stripMerchantNumericNoise('MERCHANT 062-000')).toBe('MERCHANT');
  });
  it('strips a card mask', () => {
    expect(stripMerchantNumericNoise('AMAZON xxxx4521')).toBe('AMAZON');
  });
  it('strips a reference tail', () => {
    expect(stripMerchantNumericNoise('TELSTRA REF: 99812')).toBe('TELSTRA');
  });
  it('PRESERVES digits glued inside a token (1300SMILES stays)', () => {
    expect(stripMerchantNumericNoise('1300SMILES DENTAL')).toBe('1300SMILES DENTAL');
  });
  it('NEVER strips a location word (only numeric noise)', () => {
    expect(stripMerchantNumericNoise('SOMESHOP SYDNEY')).toBe('SOMESHOP SYDNEY');
  });
  it('keeps short numbers (a 2-digit level/unit is not noise)', () => {
    expect(stripMerchantNumericNoise('LEVEL 33 BAR')).toBe('LEVEL 33 BAR');
  });
});

describe('P2 per-user identity — store-number robustness WITHOUT over-merge', () => {
  it('same vendor + same location, different store number → ONE key', () => {
    const a = renormaliseMerchant('SOMESHOP 1234 SYDNEY');
    const b = renormaliseMerchant('SOMESHOP 9981 SYDNEY');
    expect(a).toBe('Someshop Sydney');
    expect(a).toBe(b); // per-user auto-apply now matches across store numbers
  });
  it('OVER-MERGE GUARDRAIL: same vendor, DIFFERENT location stays distinct', () => {
    const syd = renormaliseMerchant('SOMESHOP 1234 SYDNEY');
    const mel = renormaliseMerchant('SOMESHOP 5678 MELBOURNE');
    expect(syd).not.toBe(mel); // location is never stripped (cross-location → KB/AI, P-tail)
  });
  it('NO REGRESSION: a KNOWN merchant stays location-independent (canonical short name)', () => {
    // The pre-P2 behaviour — known merchants collapse to their canonical name
    // regardless of location — MUST be preserved (this was the reframe-P2 risk).
    expect(renormaliseMerchant('WOOLWORTHS 1234 SYDNEY')).toBe('Woolworths');
    expect(renormaliseMerchant('WOOLWORTHS TOWN HALL MELBOURNE')).toBe('Woolworths');
  });
});
