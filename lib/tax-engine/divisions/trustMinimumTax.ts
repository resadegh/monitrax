/**
 * Phase 41E.1 — Discretionary trust 30% minimum tax (Measure 3, skeleton).
 *
 * **STAGE 1 SKELETON.** Returns `UC-TRUST-MIN-TAX-PENDING-EXPOSURE-DRAFT`
 * for every input until Treasury publishes the exposure draft + the
 * Bill assents. Per CLAUDE.md §12.14 FW-2 — no silent post-reform numbers.
 *
 * Per `docs/blueprint/PHASE_41E_REFORM_2026_27.md` §10.3.
 *
 * **What this module will do (Stage 2 — fills in the mechanic):**
 *   1. Read the trust's `taxableIncome` from the Phase 41e.4 (Div 6E)
 *      computation — this is the EXISTING engine output.
 *   2. Read the beneficiary list + per-beneficiary marginal allocation
 *      from `EntityTaxFacts.trustDistributionResolutions`.
 *   3. Read `TrustDeedExtractedRules.status === 'CONFIRMED'` from
 *      Phase 41f.4 — if confirmed, the deed tells us whether each
 *      beneficiary is corporate (no credit) or non-corporate (gets
 *      non-refundable credit).
 *   4. Compute `minimumTax = taxableIncome × 0.30`.
 *   5. Compute `actualTax = sum(perBeneficiaryTax)` based on marginal
 *      rates for non-corporate beneficiaries (15-47%) + 25%/30% for
 *      corporates.
 *   6. Top-up = `max(0, minimumTax − actualTax)`. Trust pays the
 *      top-up; non-corporate beneficiaries get a non-refundable
 *      credit; corporates do NOT (double-tax — the integrity measure).
 *
 * **Scope gate:** ONLY applies when `legalEntity.trustType === 'DISCRETIONARY'`.
 * Fixed, unit, widely-held, complying-super, charitable, deceased-estate,
 * special-disability, and fixed-testamentary trusts are explicitly
 * EXCLUDED per Treasury fact sheet. The gate is read from
 * `LegalEntity.trustType` (added in 41E.0 schema migration).
 *
 * **Open questions resolved in Stage 2 (see §3 Measure 3):**
 *   - Q1 — excluded-trust-type test: deed terms vs behaviour?
 *   - Q2 — beneficiary credit integration rates across marginal brackets.
 *   - Q3 — corporate beneficiary double-tax: any Part IVA carve-out
 *     during the 3-year rollover-relief window?
 *   - Q4 — primary-production / vulnerable-minor income exclusions.
 *   - Q5 — 3-year rollover relief (1 Jul 2027 – 30 Jun 2030) asset transfers.
 *
 * Until exposure draft + Royal Assent: every call returns UNCOMPUTED.
 */

import type {
  AuthorityCitation,
  TaxYearConfig,
  UncomputedFlag,
} from '../types';
import { Decimal, toDecimal } from '@/lib/decimal';

/**
 * `LegalEntity.trustType` values (mirrors the Prisma enum). DISCRETIONARY
 * is the only value subject to Measure 3. The 'OTHER' value is the
 * catch-all when the user hasn't confirmed the trust subtype.
 */
export type TrustTypeForMeasure3 =
  | 'DISCRETIONARY' // subject to Measure 3
  | 'FIXED'
  | 'UNIT'
  | 'TESTAMENTARY_FIXED'
  | 'CHARITABLE'
  | 'DECEASED_ESTATE'
  | 'SPECIAL_DISABILITY'
  | 'OTHER'
  | null; // unknown — engine treats as OTHER + surfaces UC-TRUST-TYPE-UNKNOWN

export interface TrustMinimumTaxInput {
  /** The trust entity ID (for tracing / audit). */
  trustEntityId: string;
  /** Trust subtype — from `LegalEntity.trustType`. */
  trustType: TrustTypeForMeasure3;
  /**
   * The trust's TAXABLE INCOME for the FY (from Phase 41e.4 Div 6E
   * computation). The 30% min applies to this amount, NOT to
   * distributed income.
   */
  taxableIncome: number;
  /**
   * Sum of tax actually paid by beneficiaries on distributed income
   * (computed elsewhere by the Phase 41e.4 distribution flow).
   * The top-up = `max(0, taxableIncome × 0.30 − actualBeneficiaryTax)`.
   */
  actualBeneficiaryTax: number;
  /** Resolved `TaxYearConfig` for the target FY. */
  config: TaxYearConfig;
  /** Target FY for the calculation, e.g. `"2028-29"`. */
  fy: string;
}

export interface TrustMinimumTaxResult {
  /** The 30% minimum tax on `taxableIncome`. 0 when UNCOMPUTED. */
  minimumTax: number;
  /** Top-up payable by the trust (`max(0, minimumTax − actualBeneficiaryTax)`). 0 when UNCOMPUTED. */
  topUpTax: number;
  /** Whether the module produced a real number or returned UNCOMPUTED. */
  computed: boolean;
  /** `true` when the trust is in scope (DISCRETIONARY only). */
  inScope: boolean;
  reason: string;
  citations: AuthorityCitation[];
  uncomputed: UncomputedFlag[];
}

const STAGE_1_CITATION: AuthorityCitation = {
  kind: 'ITAA_1997',
  reference: 'Div 6 amendment (proposed Phase 41E Measure 3 — discretionary-trust 30% min)',
  lastReviewed: '2026-05-16',
};

/**
 * Apply the 30% minimum tax to a discretionary trust's taxable income.
 *
 * **Stage 1 behaviour:** returns UNCOMPUTED for every input. The
 * trust's existing tax position (Phase 41e.4 Div 6E flow) is
 * unaffected — this module is purely additive.
 *
 * **Stage 2 behaviour (queued):** when `trustMinTaxCommencementVerified`
 * flips to `true` AND `trustType === 'DISCRETIONARY'` AND
 * `fy >= '2028-29'`, computes the top-up. Outside those conditions
 * the module returns `{ inScope: false, topUpTax: 0 }` — the trust
 * uses its existing tax flow.
 */
export function applyTrustMinimumTax(input: TrustMinimumTaxInput): TrustMinimumTaxResult {
  // Scope gate 1 — only DISCRETIONARY trusts are affected by Measure 3.
  if (input.trustType !== 'DISCRETIONARY') {
    return {
      minimumTax: 0,
      topUpTax: 0,
      computed: true,
      inScope: false,
      reason:
        input.trustType === null
          ? 'Trust subtype not confirmed — engine treats as out-of-scope for Measure 3 (UC-TRUST-TYPE-UNKNOWN).'
          : `Trust subtype is ${input.trustType} — excluded from Phase 41E Measure 3 (only DISCRETIONARY trusts are subject to the 30% minimum).`,
      citations: [],
      uncomputed:
        input.trustType === null
          ? [
              {
                id: 'UC-TRUST-TYPE-UNKNOWN',
                rationale: `LegalEntity ${input.trustEntityId} has no \`trustType\` set. Cannot determine Measure 3 scope. UI must prompt the user to confirm the trust subtype.`,
                citation: STAGE_1_CITATION,
              },
            ]
          : [],
    };
  }

  // Scope gate 2 — commencement not yet verified → return UNCOMPUTED.
  // FW-2 (CLAUDE.md §12.14): never silent post-reform numbers.
  if (!input.config.trustMinTaxCommencementVerified) {
    return {
      minimumTax: 0,
      topUpTax: 0,
      computed: false,
      inScope: true,
      reason:
        'Discretionary trust 30% minimum tax (Phase 41E Measure 3) — awaiting Treasury exposure draft + Royal Assent. Existing Div 6 / Div 6E distribution flow applies until commencement is verified.',
      citations: [STAGE_1_CITATION],
      uncomputed: [
        {
          id: 'UC-TRUST-MIN-TAX-PENDING-EXPOSURE-DRAFT',
          rationale: `Phase 41E Measure 3 (30% minimum tax on discretionary-trust taxable income) commences 1 Jul 2028 / FY 2028-29. Trust ${input.trustEntityId} has taxable income $${Math.round(input.taxableIncome).toLocaleString()} in FY ${input.fy}. Existing distribution flow applies as fallback until exposure draft + Royal Assent.`,
          citation: STAGE_1_CITATION,
        },
      ],
    };
  }

  // Stage 2 — populated when commencementVerified flips to true.
  // The actual top-up + per-beneficiary credit logic depends on
  // the exposure draft. Defensive throw — never silently active.
  throw new Error(
    '[Phase 41E.1] trustMinTaxCommencementVerified is true but the Measure 3 mechanic is not yet implemented. Do NOT flip the flag until Stage 2 lands the per-beneficiary credit logic + the corporate-beneficiary double-tax handling (per the published exposure draft).',
  );
}

// =============================================================================
// Q-DEC PR 2.D.3c — Decimal sibling path (§12.14 FW-2 preserved)
// =============================================================================

export interface TrustMinimumTaxInputDecimal {
  trustEntityId: string;
  trustType: TrustTypeForMeasure3 | null;
  taxableIncome: number | string | Decimal;
  actualBeneficiaryTax: number | string | Decimal;
  config: TaxYearConfig;
  fy: string;
}

export interface TrustMinimumTaxResultDecimal {
  minimumTax: Decimal;
  topUpTax: Decimal;
  computed: boolean;
  inScope: boolean;
  reason: string;
  citations: AuthorityCitation[];
  uncomputed: UncomputedFlag[];
}

/**
 * Decimal sibling of `applyTrustMinimumTax`. **Stage 1 behaviour preserved**
 * — out-of-scope for non-DISCRETIONARY trusts; UNCOMPUTED when
 * `trustMinTaxCommencementVerified === false`. Stage 2 throws.
 */
export function applyTrustMinimumTaxDecimal(input: TrustMinimumTaxInputDecimal): TrustMinimumTaxResultDecimal {
  const zero = new Decimal(0);

  if (input.trustType !== 'DISCRETIONARY') {
    return {
      minimumTax: zero,
      topUpTax: zero,
      computed: true,
      inScope: false,
      reason:
        input.trustType === null
          ? 'Trust subtype not confirmed — engine treats as out-of-scope for Measure 3 (UC-TRUST-TYPE-UNKNOWN).'
          : `Trust subtype is ${input.trustType} — excluded from Phase 41E Measure 3 (only DISCRETIONARY trusts are subject to the 30% minimum).`,
      citations: [],
      uncomputed:
        input.trustType === null
          ? [
              {
                id: 'UC-TRUST-TYPE-UNKNOWN',
                rationale: `LegalEntity ${input.trustEntityId} has no \`trustType\` set. Cannot determine Measure 3 scope. UI must prompt the user to confirm the trust subtype.`,
                citation: STAGE_1_CITATION,
              },
            ]
          : [],
    };
  }

  if (!input.config.trustMinTaxCommencementVerified) {
    return {
      minimumTax: zero,
      topUpTax: zero,
      computed: false,
      inScope: true,
      reason:
        'Discretionary trust 30% minimum tax (Phase 41E Measure 3) — awaiting Treasury exposure draft + Royal Assent. Existing Div 6 / Div 6E distribution flow applies until commencement is verified.',
      citations: [STAGE_1_CITATION],
      uncomputed: [
        {
          id: 'UC-TRUST-MIN-TAX-PENDING-EXPOSURE-DRAFT',
          rationale: `Phase 41E Measure 3 (discretionary-trust 30% minimum tax) commences 1 Jul 2028 / FY 2028-29 but requires Treasury exposure draft + Royal Assent before the engine computes the top-up. Trust entity ${input.trustEntityId}, FY ${input.fy}.`,
          citation: STAGE_1_CITATION,
        },
      ],
    };
  }

  throw new Error(
    '[Phase 41E.1] trustMinTaxCommencementVerified is true but the Measure 3 mechanic is not yet implemented. Do NOT flip the flag until Stage 2 lands the beneficiary credit allocation + top-up formula (per the published exposure draft).',
  );
}
