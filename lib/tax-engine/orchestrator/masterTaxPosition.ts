/**
 * Phase 41e.17 — MasterTaxPosition orchestrator.
 *
 * Closes Phase 41e. Wires every preceding sub-PR into one entity-
 * aware result + AFSL footer envelope.
 *
 * Per `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11. This
 * is the canonical replacement for `buildTaxSummary()` (the old
 * single-entity adapter) for callers that need a household-wide
 * view across multiple entities + cross-cutting state taxes + GST.
 *
 * **Architecture:**
 *
 *   1. Per-entity dispatch — calls `calculateEntityTaxPosition()`
 *      from the existing entity router. The router already wires
 *      Phase 41e.0/1/2/3/4/5/6/8/11 into its dispatch (CGT discount,
 *      capital loss netting, trust distribution, SMSF caps + Div 293,
 *      Div 6E streaming, s100A facts, Div 7A loans, negative gearing,
 *      SMSF triumvirate). Per-entity income tax + CGT come back from
 *      this call.
 *
 *   2. Cross-cutting modules — land tax (cross-state aggregator),
 *      stamp duty (per-transaction), GST (BAS for the whole entity
 *      portfolio if applicable). These are invoked once per
 *      `MasterTaxPosition` build, not per entity.
 *
 *   3. Per-entity advanced overlays — Div 152 SBC, PSI, FTE/IEE,
 *      trust loss rules, company loss rules. v1 takes optional
 *      per-entity inputs and decorates the matching `EntityTaxPosition`
 *      with the overlay's citations + UNCOMPUTED flags. The overlays
 *      do not modify the entity's `result` number — that's a v2
 *      decision (the rules can deny loss deductions or attribute PSI
 *      to individuals, both of which change the underlying tax,
 *      but v1 surfaces the rule outcome rather than re-computing).
 *
 *   4. Citation + UNCOMPUTED aggregation — de-duped across every
 *      module that ran.
 *
 *   5. Boundary footer envelope — calls `renderBoundaryFootnote`
 *      from the boundaries module so the consumer surface (UI / API)
 *      gets a structured AFSL/TPB/NCCP footer ready to render.
 *
 * **Determinism:** the orchestrator is pure. Same inputs → same
 * output. No DB calls. No side effects.
 */

import type {
  AuthorityCitation,
  EntityTaxFacts,
  EntityTaxPosition,
  FYReference,
  MasterTaxPosition,
  UncomputedFlag,
} from '../types';
import { calculateEntityTaxPosition } from '../entity/entityTaxRouter';
import {
  calculateCrossStateLandTax,
  type CrossStateLandTaxInput,
  type CrossStateLandTaxResult,
} from '../landTax/crossStateAggregator';
import {
  calculateStampDuty,
  getStampDutyConfig,
  type StampDutyInput,
  type StampDutyResult,
} from '../stampDuty/stateStampDuty';
import {
  calculateGst,
  type GstInput,
  type GstResult,
} from '../gst/gstCalculator';
import {
  applyTrustLossRules,
  type TrustLossInput,
  type TrustLossResult,
} from '../divisions/trustLossRules';
import {
  applyCompanyLossRules,
  type CompanyLossInput,
  type CompanyLossResult,
} from '../divisions/companyLossRules';
import {
  validateTrustDistributionAgainstDeed,
  type TrustDeedValidationResult,
} from '../divisions/trustDeedValidation';
import { renderBoundaryFootnote, type BoundaryFootnote } from '../boundaries';
import type { AustralianState } from '../landTax/stateLandTax';
import type { TrustDeedExtraction } from '@/lib/integrations/trust-deed/types';

export interface StampDutyTransaction {
  /** Caller's stable id (typically the property's GRDCS id). */
  transactionId: string;
  state: AustralianState;
  input: Omit<StampDutyInput, 'purchaserType'> & {
    purchaserType?: StampDutyInput['purchaserType'];
  };
}

export interface MasterTaxPositionInput {
  userId: string;
  fy: FYReference;
  entities: EntityTaxFacts[];
  /**
   * Cross-state land tax. Single call across the whole household.
   * The aggregator handles within-state aggregation + across-state
   * independence. Pass `null` / `undefined` to skip.
   */
  landTax?: CrossStateLandTaxInput;
  /**
   * Stamp duty transactions for the FY. Each transaction is
   * independently assessed against its state's config. Pass empty
   * array or undefined to skip.
   */
  stampDutyTransactions?: StampDutyTransaction[];
  /** GST input for the household. Pass `undefined` to skip GST. */
  gst?: GstInput;
  /**
   * Per-entity trust loss inputs (Sch 2F ITAA 1936). Keyed by
   * `entityId`. Only applies to entities of type DISCRETIONARY_TRUST,
   * UNIT_TRUST, or PARTNERSHIP (where the partnership is a trust
   * facade — caller's responsibility to gate).
   */
  trustLossByEntity?: Record<string, TrustLossInput>;
  /**
   * Per-entity company loss inputs (Div 165 ITAA 1997). Keyed by
   * `entityId`. Only applies to entities of type COMPANY.
   */
  companyLossByEntity?: Record<string, CompanyLossInput>;
  /**
   * Phase 41f.4-extension — CONFIRMED trust-deed rules per entity.
   * Keyed by `entityId`. When provided alongside a trust entity's
   * `trustDistribution`, the orchestrator runs
   * `validateTrustDistributionAgainstDeed` and decorates citations +
   * UNCOMPUTED with deed-based mismatches (excluded beneficiaries,
   * fixed-share drift, sub-trust UPE presence).
   *
   * Read path: `lib/services/trustDeedRulesService.ts:getConfirmedRulesForEntity`.
   * Caller is responsible for filtering by CONFIRMED status — this
   * orchestrator trusts the input.
   */
  confirmedDeedRulesByEntity?: Record<string, TrustDeedExtraction>;
}

export interface CrossCuttingTaxResult {
  landTax?: CrossStateLandTaxResult;
  stampDuty?: {
    perTransaction: Array<{
      transactionId: string;
      state: AustralianState;
      result: StampDutyResult;
    }>;
    total: number;
  };
  gst?: GstResult;
  /** Per-entity loss-rule overlays. */
  trustLossByEntity?: Record<string, TrustLossResult>;
  companyLossByEntity?: Record<string, CompanyLossResult>;
  /** Phase 41f.4-extension — per-entity trust-deed validation overlays. */
  trustDeedValidationByEntity?: Record<string, TrustDeedValidationResult>;
}

/**
 * Extended `MasterTaxPosition` with the 41e.17 cross-cutting block.
 * The base shape comes from `lib/tax-engine/types.ts`; we add
 * `crossCutting` + `boundary` here without mutating the base type.
 */
export interface MasterTaxPositionV2 extends MasterTaxPosition {
  /** 41e.17 — household-wide modules that span entities. */
  crossCutting?: CrossCuttingTaxResult;
  /** AFSL/TPB/NCCP boundary footer envelope ready for UI render. */
  boundary: BoundaryFootnote;
  /** List of every Phase 41e module that contributed to this position. */
  modulesInvoked: string[];
}

/**
 * Build the household-wide MasterTaxPosition.
 *
 * Pipeline:
 *   1. Per-entity dispatch (entityTaxRouter)
 *   2. Cross-cutting modules (land tax, stamp duty, GST)
 *   3. Per-entity loss-rule overlays
 *   4. Aggregate totals + citations + UNCOMPUTED
 *   5. Build boundary footer envelope
 */
export function buildMasterTaxPosition(
  input: MasterTaxPositionInput,
): MasterTaxPositionV2 {
  const modulesInvoked: string[] = ['entityTaxRouter'];

  // 1. Per-entity dispatch.
  const entities: EntityTaxPosition[] = input.entities.map((facts) =>
    calculateEntityTaxPosition(facts),
  );

  // 2. Cross-cutting modules.
  const crossCutting: CrossCuttingTaxResult = {};

  if (input.landTax && input.landTax.properties.length > 0) {
    crossCutting.landTax = calculateCrossStateLandTax(input.landTax);
    modulesInvoked.push('crossStateLandTax');
  }

  if (input.stampDutyTransactions && input.stampDutyTransactions.length > 0) {
    const perTransaction: NonNullable<CrossCuttingTaxResult['stampDuty']>['perTransaction'] = [];
    let total = 0;
    for (const tx of input.stampDutyTransactions) {
      const config = getStampDutyConfig(tx.state);
      const stampInput: StampDutyInput = {
        purchaserType: 'INDIVIDUAL',
        ...tx.input,
      };
      const result = calculateStampDuty(stampInput, config);
      perTransaction.push({
        transactionId: tx.transactionId,
        state: tx.state,
        result,
      });
      total += result.totalDuty;
    }
    crossCutting.stampDuty = { perTransaction, total };
    modulesInvoked.push('stampDuty');
  }

  if (input.gst) {
    crossCutting.gst = calculateGst(input.gst);
    modulesInvoked.push('gst');
  }

  // 3. Per-entity loss-rule overlays.
  if (input.trustLossByEntity) {
    crossCutting.trustLossByEntity = {};
    for (const [entityId, lossInput] of Object.entries(input.trustLossByEntity)) {
      crossCutting.trustLossByEntity[entityId] = applyTrustLossRules(lossInput);
    }
    modulesInvoked.push('trustLossRules');
  }

  if (input.companyLossByEntity) {
    crossCutting.companyLossByEntity = {};
    for (const [entityId, lossInput] of Object.entries(input.companyLossByEntity)) {
      crossCutting.companyLossByEntity[entityId] = applyCompanyLossRules(lossInput);
    }
    modulesInvoked.push('companyLossRules');
  }

  // 3.5 Trust-deed validation overlay (Phase 41f.4-extension).
  if (input.confirmedDeedRulesByEntity) {
    crossCutting.trustDeedValidationByEntity = {};
    let ranAtLeastOnce = false;
    for (const facts of input.entities) {
      const deed = input.confirmedDeedRulesByEntity[facts.entityId];
      if (!deed) continue;
      const result = validateTrustDistributionAgainstDeed(facts, deed);
      // Only persist non-empty results (skip non-trust entities).
      if (result.citations.length > 0 || result.uncomputed.length > 0) {
        crossCutting.trustDeedValidationByEntity[facts.entityId] = result;
      }
      ranAtLeastOnce = true;
    }
    if (ranAtLeastOnce) modulesInvoked.push('trustDeedValidation');
  }

  // 4. Aggregate household totals from entities + citations + UNCOMPUTED.
  let assessableIncome = 0;
  let taxableIncome = 0;
  let netTax = 0;
  let paygWithheld = 0;

  for (const entity of entities) {
    const r = entity.result as
      | {
          tax?: { assessableIncome?: number; taxableIncome?: number; netTax?: number };
          paygWithheld?: number;
        }
      | null
      | undefined;
    if (r && typeof r === 'object') {
      assessableIncome += r.tax?.assessableIncome ?? 0;
      taxableIncome += r.tax?.taxableIncome ?? 0;
      netTax += r.tax?.netTax ?? 0;
      paygWithheld += r.paygWithheld ?? 0;
    }
  }

  const estimatedRefund = paygWithheld - netTax;

  // 4b. Aggregate citations + UNCOMPUTED across every source.
  const citationKey = (c: AuthorityCitation) => `${c.kind}|${c.reference}`;
  const seenCit = new Set<string>();
  const authoritySources: AuthorityCitation[] = [];
  const seenUc = new Set<string>();
  const uncomputed: UncomputedFlag[] = [];

  const ingestCitations = (cs: AuthorityCitation[] | undefined) => {
    if (!cs) return;
    for (const c of cs) {
      const k = citationKey(c);
      if (!seenCit.has(k)) {
        seenCit.add(k);
        authoritySources.push(c);
      }
    }
  };
  const ingestUncomputed = (us: UncomputedFlag[] | undefined) => {
    if (!us) return;
    for (const u of us) {
      if (!seenUc.has(u.id)) {
        seenUc.add(u.id);
        uncomputed.push(u);
      }
    }
  };

  for (const entity of entities) {
    ingestCitations(entity.citations);
    ingestUncomputed(entity.uncomputed);
  }
  if (crossCutting.landTax) {
    ingestCitations(crossCutting.landTax.citations);
    ingestUncomputed(crossCutting.landTax.uncomputed);
  }
  if (crossCutting.stampDuty) {
    for (const tx of crossCutting.stampDuty.perTransaction) {
      ingestCitations(tx.result.citations);
      ingestUncomputed(tx.result.uncomputed);
    }
  }
  if (crossCutting.gst) {
    ingestCitations(crossCutting.gst.citations);
    ingestUncomputed(crossCutting.gst.uncomputed);
  }
  if (crossCutting.trustLossByEntity) {
    for (const r of Object.values(crossCutting.trustLossByEntity)) {
      ingestCitations(r.citations);
      ingestUncomputed(r.uncomputed);
    }
  }
  if (crossCutting.companyLossByEntity) {
    for (const r of Object.values(crossCutting.companyLossByEntity)) {
      ingestCitations(r.citations);
      ingestUncomputed(r.uncomputed);
    }
  }
  if (crossCutting.trustDeedValidationByEntity) {
    for (const r of Object.values(crossCutting.trustDeedValidationByEntity)) {
      ingestCitations(r.citations);
      ingestUncomputed(r.uncomputed);
    }
  }

  // 5. Boundary footer envelope.
  const boundary = renderBoundaryFootnote({
    citations: authoritySources,
    uncomputed,
    fyLabel: input.fy.financialYear ?? 'current FY',
  });

  return {
    userId: input.userId,
    fy: input.fy,
    entities,
    totals: {
      assessableIncome,
      taxableIncome,
      netTax,
      paygWithheld,
      estimatedRefund,
    },
    crossCutting:
      Object.keys(crossCutting).length > 0 ? crossCutting : undefined,
    authoritySources,
    uncomputed,
    boundary,
    modulesInvoked,
    computedAt: new Date().toISOString(),
  };
}
