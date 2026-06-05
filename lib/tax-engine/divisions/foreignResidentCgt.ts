/**
 * Phase 41E.1 — Foreign-resident CGT regime (Measure 4, skeleton).
 *
 * **STAGE 1 SKELETON.** Returns `UC-FR-CGT-PENDING-ROYAL-ASSENT` for
 * every input until the implementing Bill assents. Per CLAUDE.md §12.14
 * FW-2 — no silent post-reform numbers. Treasury exposure draft was
 * published 10 April 2026 (consultation closed 24 April 2026), so the
 * rule mechanic IS code-ready — only the Royal Assent gate keeps this
 * a skeleton in Stage 1. When `foreignResidentCgtCommencementVerified`
 * flips to `true`, the Stage 2 sub-PR replaces the throw with the
 * mechanic.
 *
 * Per `docs/blueprint/PHASE_41E_REFORM_2026_27.md` §10.4.
 *
 * AU primary authority (post-reform):
 *   - ITAA 1997 Div 855 — foreign-resident CGT (expanded by Measure 4)
 *   - ITAA 1997 s855-25 — TARP (Taxable Australian Real Property) definition
 *     (broadened to include mining/quarrying/prospecting rights regardless
 *     of physical extraction stage, plus options + leases over land + similar)
 *   - ITAA 1997 s855-30 — Principal Asset Test (becomes 365-day measurement
 *     window, replaces point-in-time)
 *   - ITAA 1997 s855-A (new) — >$50M notification to ATO (≥ 14 days before settlement)
 *
 * **What this module will do (Stage 2 — mechanic ships when Bill assents):**
 *   1. TARP test (s855-25) — broadened definition.
 *   2. 365-day Principal Asset Test — TARP-vs-non-TARP ratio measured
 *      across the 365 days ending on disposal.
 *   3. >$50M notification flag — surface to user pre-disposal.
 *   4. Renewables 50% concession — qualifying renewable-energy-infrastructure
 *      assets get a 50% concession until 30 Jun 2030.
 *   5. Retrospective TARP test — for CGT events from 12 Dec 2006 onwards
 *      under the expanded definition.
 *
 * **Open questions resolved at Stage 2 (§3 Measure 4):**
 *   - Q1 — final retrospective scope (12 Dec 2006 reach may be tempered).
 *   - Q2 — "qualifying renewable energy infrastructure" boundary list.
 *   - Q3 — >$50M threshold: gross vs net of liabilities; aggregated vs per-deal.
 *
 * Scope: only entities with `LegalEntity.isForeignResident === true`.
 */

import type { AuthorityCitation, TaxYearConfig, UncomputedFlag } from '../types';
import { Decimal, toDecimal } from '@/lib/decimal';

export interface ForeignResidentCgtInput {
  /** Entity ID (for tracing). */
  entityId: string;
  /**
   * From `LegalEntity.isForeignResident`. When null/false, the
   * module is out-of-scope (returns `{ inScope: false }`).
   */
  isForeignResident: boolean | null;
  /** Nominal capital gain on the disposal. */
  nominalGain: number;
  /**
   * Whether the asset is renewable-energy infrastructure (per
   * `Property.isRenewablesInfrastructure` flag added in 41E.0 schema).
   * Drives the 50% concession until 30 Jun 2030.
   */
  isRenewablesInfrastructure?: boolean;
  /** Disposal value (gross of liabilities) — feeds the >$50M notification check. */
  disposalValue: number;
  /** Resolved `TaxYearConfig` for the disposal FY. */
  config: TaxYearConfig;
  /** Target FY for the disposal. */
  fy: string;
}

export interface ForeignResidentCgtResult {
  /** Whether the entity is in scope of Measure 4. */
  inScope: boolean;
  /** Whether the module produced a real number or returned UNCOMPUTED. */
  computed: boolean;
  /** Tax payable on the disposal under Measure 4 — 0 when UNCOMPUTED or out-of-scope. */
  taxPayable: number;
  /** `true` if the disposal value exceeds the >$50M notification threshold. */
  triggersNotification: boolean;
  /** `true` if the renewables 50% concession applies. */
  renewablesConcessionApplied: boolean;
  reason: string;
  citations: AuthorityCitation[];
  uncomputed: UncomputedFlag[];
}

const STAGE_1_CITATION: AuthorityCitation = {
  kind: 'ITAA_1997',
  reference: 'Div 855 (Phase 41E Measure 4 exposure draft, 10 Apr 2026)',
  lastReviewed: '2026-05-16',
};

const NOTIFICATION_THRESHOLD_AUD = 50_000_000;

/**
 * Apply Measure 4 (foreign-resident CGT) to a single disposal.
 *
 * **Stage 1 behaviour:** when not foreign-resident → out-of-scope
 * (existing CGT flow applies). When foreign-resident AND
 * `foreignResidentCgtCommencementVerified === false` → UNCOMPUTED.
 */
export function applyForeignResidentCgt(input: ForeignResidentCgtInput): ForeignResidentCgtResult {
  // Scope gate 1 — domestic-only entities are unaffected.
  if (!input.isForeignResident) {
    return {
      inScope: false,
      computed: true,
      taxPayable: 0,
      triggersNotification: false,
      renewablesConcessionApplied: false,
      reason: `Entity ${input.entityId} is not foreign-resident — Measure 4 (Div 855 expansion) does not apply.`,
      citations: [],
      uncomputed: [],
    };
  }

  // Scope gate 2 — commencement not yet verified → return UNCOMPUTED.
  if (!input.config.foreignResidentCgtCommencementVerified) {
    const triggersNotification = input.disposalValue >= NOTIFICATION_THRESHOLD_AUD;
    return {
      inScope: true,
      computed: false,
      taxPayable: 0,
      triggersNotification,
      renewablesConcessionApplied: false,
      reason:
        'Foreign-resident CGT regime (Phase 41E Measure 4) — Treasury exposure draft published 10 Apr 2026; awaiting Royal Assent of the implementing Bill. Existing Subdiv 115-D treatment (UC-FOREIGN-RESIDENT-CGT in `cgtDiscount.ts`) applies as fallback until commencement is verified.',
      citations: [STAGE_1_CITATION],
      uncomputed: [
        {
          id: 'UC-FR-CGT-PENDING-ROYAL-ASSENT',
          rationale: `Phase 41E Measure 4 (Div 855 TARP expansion + 365-day PAT + >$50M notification + renewables 50% concession) — exposure draft is final but Royal Assent of the implementing Bill not yet confirmed. Entity ${input.entityId} foreign-resident with disposal value $${Math.round(input.disposalValue).toLocaleString()}${triggersNotification ? ' (TRIGGERS >$50M notification threshold)' : ''}.`,
          citation: STAGE_1_CITATION,
        },
      ],
    };
  }

  // Stage 2 — mechanic from the exposure draft ships when this branch activates.
  throw new Error(
    '[Phase 41E.1] foreignResidentCgtCommencementVerified is true but the Measure 4 mechanic is not yet implemented. Do NOT flip the flag until Stage 2 lands the TARP test + 365-day PAT + renewables concession + retrospective handling (per the published Bill).',
  );
}

/**
 * Convenience — the >$50M notification threshold per the exposure
 * draft (s855-A). Exposed for AI advisor narration + UI.
 */
export function getForeignResidentNotificationThresholdAud(): number {
  return NOTIFICATION_THRESHOLD_AUD;
}

// =============================================================================
// Q-DEC PR 2.D.3b — Decimal sibling path (§12.14 FW-2 preserved)
// =============================================================================

export interface ForeignResidentCgtInputDecimal {
  entityId: string;
  isForeignResident: boolean | null;
  nominalGain: number | string | Decimal;
  isRenewablesInfrastructure?: boolean;
  disposalValue: number | string | Decimal;
  config: TaxYearConfig;
  fy: string;
}

export interface ForeignResidentCgtResultDecimal {
  inScope: boolean;
  computed: boolean;
  taxPayable: Decimal;
  triggersNotification: boolean;
  renewablesConcessionApplied: boolean;
  reason: string;
  citations: AuthorityCitation[];
  uncomputed: UncomputedFlag[];
}

/**
 * Decimal sibling of `applyForeignResidentCgt`. Stage 1 behaviour
 * preserved exactly — UNCOMPUTED returned when foreign-resident +
 * commencement not verified. Out-of-scope (non-foreign-resident)
 * returns 0 immediately. Stage 2 throws.
 */
export function applyForeignResidentCgtDecimal(input: ForeignResidentCgtInputDecimal): ForeignResidentCgtResultDecimal {
  const disposalValue = toDecimal(input.disposalValue) ?? new Decimal(0);
  const zero = new Decimal(0);

  if (!input.isForeignResident) {
    return {
      inScope: false,
      computed: true,
      taxPayable: zero,
      triggersNotification: false,
      renewablesConcessionApplied: false,
      reason: `Entity ${input.entityId} is not foreign-resident — Measure 4 (Div 855 expansion) does not apply.`,
      citations: [],
      uncomputed: [],
    };
  }

  if (!input.config.foreignResidentCgtCommencementVerified) {
    const triggersNotification = disposalValue.gte(NOTIFICATION_THRESHOLD_AUD);
    return {
      inScope: true,
      computed: false,
      taxPayable: zero,
      triggersNotification,
      renewablesConcessionApplied: false,
      reason:
        'Foreign-resident CGT regime (Phase 41E Measure 4) — Treasury exposure draft published 10 Apr 2026; awaiting Royal Assent of the implementing Bill. Existing Subdiv 115-D treatment (UC-FOREIGN-RESIDENT-CGT in `cgtDiscount.ts`) applies as fallback until commencement is verified.',
      citations: [STAGE_1_CITATION],
      uncomputed: [
        {
          id: 'UC-FR-CGT-PENDING-ROYAL-ASSENT',
          rationale: `Phase 41E Measure 4 (Div 855 TARP expansion + 365-day PAT + >$50M notification + renewables 50% concession) — exposure draft is final but Royal Assent of the implementing Bill not yet confirmed. Entity ${input.entityId} foreign-resident with disposal value $${disposalValue.toDecimalPlaces(0).toString()}${triggersNotification ? ' (TRIGGERS >$50M notification threshold)' : ''}.`,
          citation: STAGE_1_CITATION,
        },
      ],
    };
  }

  throw new Error(
    '[Phase 41E.1] foreignResidentCgtCommencementVerified is true but the Measure 4 mechanic is not yet implemented. Do NOT flip the flag until Stage 2 lands the TARP test + 365-day PAT + renewables concession + retrospective handling (per the published Bill).',
  );
}
