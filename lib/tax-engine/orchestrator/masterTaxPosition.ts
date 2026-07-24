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
import {
  classifyPsi,
  type PsiInput,
  type PsiClassificationResult,
} from '../divisions/psiClassifier';
import {
  classifyFteIeeDistributions,
  type FteIeeInput,
  type FteIeeClassificationResult,
} from '../divisions/fteIeeClassifier';
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
   * Neo-G4 P1 (MON-097) — per-entity PSI inputs (ITAA 1997 Part 2-42).
   * Keyed by `entityId`. The classifier is the ONE producer of the PSI
   * determination (§12.2.1); the overlay reports attribution + restricts
   * per its citations/UNCOMPUTED flags. NOTE (STEP-0 census 2026-07-24):
   * Monitrax does not yet CAPTURE these inputs anywhere (no schema fields,
   * no assembler mapping) — until a capture feature ships, this input can
   * only be exercised by tests/tools; absent input = overlay skipped =
   * byte-identical output.
   */
  psiByEntity?: Record<string, PsiInput>;
  /**
   * Neo-G4 P2 (MON-098) — per-entity FTE/IEE distribution facts
   * (ITAA 1936 Sch 2F). Keyed by `entityId` (the FTE-electing trust).
   * The classifier is the ONE producer of the FTDT / TFN-withholding
   * determination (§12.2.1). NOTE (STEP-0 census 2026-07-24): capture is
   * PARTIAL — `hasFamilyTrustElection` + per-beneficiary gross
   * distributions exist (DistributionResolution → entityTaxFactsAssembler),
   * but the Sch 2F `relationship`, `hasQuotedTfn`, and `coveredByIee`
   * beneficiary facts are not captured anywhere yet — until that capture
   * ships, this input can only be exercised by tests/tools; absent input
   * = overlay skipped = byte-identical output.
   */
  fteIeeByEntity?: Record<string, FteIeeInput>;
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
  /** Neo-G4 P1 (MON-097) — per-entity PSI classification overlay. */
  psiByEntity?: Record<string, PsiClassificationResult>;
  /** Neo-G4 P2 (MON-098) — per-entity FTE/IEE (FTDT + TFN-withholding) overlay. */
  fteIeeByEntity?: Record<string, FteIeeClassificationResult>;
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

  // 3.6 Neo-G4 P1 (MON-097): PSI overlay — the previously-unwired step-3
  // engine. Per-entity, exactly like the loss-rule overlays: run the ONE
  // classifier, surface attribution + citations + UNCOMPUTED. The engine's
  // own UC-PSI-DEDUCTION-RESTRICTIONS flag governs the s86-60 net calc
  // (caller-computed in a future sub-PR — never silently defaulted here).
  if (input.psiByEntity) {
    crossCutting.psiByEntity = {};
    for (const [entityId, psiInput] of Object.entries(input.psiByEntity)) {
      crossCutting.psiByEntity[entityId] = classifyPsi(psiInput);
    }
    modulesInvoked.push('psiClassifier');
  }

  // 3.7 Neo-G4 P2 (MON-098): FTE/IEE overlay — the second previously-unwired
  // step-3 engine. Per-entity (the FTE-electing trust), exactly like PSI:
  // run the ONE classifier, surface FTDT (47%, Sch 2F s271-15) + TFN
  // withholding (47%, ITAA 1936 Pt VA) + citations + UNCOMPUTED. The rate
  // lives in the engine (FAMILY_TRUST_DISTRIBUTION_TAX_RATE / per-input
  // override) — never re-hard-coded here (§12.14). A naked default is NOT a
  // classification: uncaptured facts arrive as UNCOMPUTED flags, never zeroed.
  if (input.fteIeeByEntity) {
    crossCutting.fteIeeByEntity = {};
    for (const [entityId, fteInput] of Object.entries(input.fteIeeByEntity)) {
      crossCutting.fteIeeByEntity[entityId] = classifyFteIeeDistributions(fteInput);
    }
    modulesInvoked.push('fteIeeClassifier');
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
  if (crossCutting.psiByEntity) {
    for (const r of Object.values(crossCutting.psiByEntity)) {
      ingestCitations(r.citations);
      ingestUncomputed(r.uncomputed);
    }
  }
  if (crossCutting.fteIeeByEntity) {
    for (const r of Object.values(crossCutting.fteIeeByEntity)) {
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

// ============================================================================
// Q-DEC PR 3.A — Decimal sibling
// ============================================================================

import { Decimal } from '@/lib/decimal';
import {
  calculateEntityTaxPositionDecimal,
  type EntityTaxPositionDecimal,
} from '../entity/entityTaxRouter';
import {
  calculateCrossStateLandTaxDecimal,
  type CrossStateLandTaxResultDecimal,
} from '../landTax/crossStateAggregator';
import {
  calculateStampDutyDecimal,
  type StampDutyResultDecimal,
} from '../stampDuty/stateStampDuty';
import {
  calculateGstDecimal,
  type GstResultDecimal,
} from '../gst/gstCalculator';
import {
  applyTrustLossRulesDecimal,
  type TrustLossResultDecimal,
} from '../divisions/trustLossRules';
import {
  applyCompanyLossRulesDecimal,
  type CompanyLossResultDecimal,
} from '../divisions/companyLossRules';

export interface CrossCuttingTaxResultDecimal {
  landTax?: CrossStateLandTaxResultDecimal;
  stampDuty?: {
    perTransaction: Array<{
      transactionId: string;
      state: AustralianState;
      result: StampDutyResultDecimal;
    }>;
    total: Decimal;
  };
  gst?: GstResultDecimal;
  trustLossByEntity?: Record<string, TrustLossResultDecimal>;
  companyLossByEntity?: Record<string, CompanyLossResultDecimal>;
  /** Neo-G4 P1 — PSI overlay; categorical + one reported dollar figure,
   *  reuses the Float result type (the trustDeedValidation precedent). */
  psiByEntity?: Record<string, PsiClassificationResult>;
  /** Neo-G4 P2 — FTE/IEE overlay; reported dollar figures (FTDT/withholding), reuses the Float result type. */
  fteIeeByEntity?: Record<string, FteIeeClassificationResult>;
  /** Phase 41f.4 deed-validation overlay — categorical (citations + UNCOMPUTED only); reuses Float result type. */
  trustDeedValidationByEntity?: Record<string, TrustDeedValidationResult>;
}

export interface MasterTaxPositionDecimal {
  userId: string;
  fy: FYReference;
  entities: EntityTaxPositionDecimal[];
  totals: {
    assessableIncome: Decimal;
    taxableIncome: Decimal;
    netTax: Decimal;
    paygWithheld: Decimal;
    estimatedRefund: Decimal;
  };
  crossCutting?: CrossCuttingTaxResultDecimal;
  authoritySources: AuthorityCitation[];
  uncomputed: UncomputedFlag[];
  boundary: BoundaryFootnote;
  modulesInvoked: string[];
  computedAt: string;
}

/**
 * Decimal sibling of `buildMasterTaxPosition`. Same pipeline; each
 * downstream engine call is the `*Decimal` sibling. Totals aggregation
 * stays in Decimal. Categorical overlays (trust-deed validation) reuse
 * the Float result type since their numeric leaves are absent —
 * citations + UNCOMPUTED only.
 *
 * Deferred from PR 2.D.3d per the scope decision: the composer-tier
 * Decimal sibling has no marginal benefit until downstream engines AND
 * the entity router are Decimal-capable. The entity router Decimal
 * sibling ships in the same PR as this one.
 */
export function buildMasterTaxPositionDecimal(
  input: MasterTaxPositionInput,
): MasterTaxPositionDecimal {
  const modulesInvoked: string[] = ['entityTaxRouter'];
  const zero = new Decimal(0);

  // 1. Per-entity dispatch — Decimal path.
  const entities: EntityTaxPositionDecimal[] = input.entities.map((facts) =>
    calculateEntityTaxPositionDecimal(facts),
  );

  // 2. Cross-cutting modules — each on Decimal path.
  const crossCutting: CrossCuttingTaxResultDecimal = {};

  if (input.landTax && input.landTax.properties.length > 0) {
    crossCutting.landTax = calculateCrossStateLandTaxDecimal(input.landTax);
    modulesInvoked.push('crossStateLandTax');
  }

  if (input.stampDutyTransactions && input.stampDutyTransactions.length > 0) {
    const perTransaction: NonNullable<CrossCuttingTaxResultDecimal['stampDuty']>['perTransaction'] = [];
    let total = zero;
    for (const tx of input.stampDutyTransactions) {
      const config = getStampDutyConfig(tx.state);
      const stampInput: StampDutyInput = {
        purchaserType: 'INDIVIDUAL',
        ...tx.input,
      };
      const result = calculateStampDutyDecimal(stampInput, config);
      perTransaction.push({
        transactionId: tx.transactionId,
        state: tx.state,
        result,
      });
      total = total.plus(result.totalDuty);
    }
    crossCutting.stampDuty = { perTransaction, total };
    modulesInvoked.push('stampDuty');
  }

  if (input.gst) {
    crossCutting.gst = calculateGstDecimal(input.gst);
    modulesInvoked.push('gst');
  }

  // 3. Per-entity loss-rule overlays.
  if (input.trustLossByEntity) {
    crossCutting.trustLossByEntity = {};
    for (const [entityId, lossInput] of Object.entries(input.trustLossByEntity)) {
      crossCutting.trustLossByEntity[entityId] = applyTrustLossRulesDecimal(lossInput);
    }
    modulesInvoked.push('trustLossRules');
  }

  if (input.companyLossByEntity) {
    crossCutting.companyLossByEntity = {};
    for (const [entityId, lossInput] of Object.entries(input.companyLossByEntity)) {
      crossCutting.companyLossByEntity[entityId] = applyCompanyLossRulesDecimal(lossInput);
    }
    modulesInvoked.push('companyLossRules');
  }

  // 3.5 Trust-deed validation overlay (categorical — Float result reused).
  if (input.confirmedDeedRulesByEntity) {
    crossCutting.trustDeedValidationByEntity = {};
    let ranAtLeastOnce = false;
    for (const facts of input.entities) {
      const deed = input.confirmedDeedRulesByEntity[facts.entityId];
      if (!deed) continue;
      const result = validateTrustDistributionAgainstDeed(facts, deed);
      if (result.citations.length > 0 || result.uncomputed.length > 0) {
        crossCutting.trustDeedValidationByEntity[facts.entityId] = result;
      }
      ranAtLeastOnce = true;
    }
    if (ranAtLeastOnce) modulesInvoked.push('trustDeedValidation');
  }

  // 3.6 Neo-G4 P1 (MON-097): PSI overlay — mirror of the Float wiring.
  // The classifier is pure number math on plain inputs; its single dollar
  // figure is reported (not folded into Decimal totals), so the Float
  // result type is reused (the trustDeedValidation precedent).
  if (input.psiByEntity) {
    crossCutting.psiByEntity = {};
    for (const [entityId, psiInput] of Object.entries(input.psiByEntity)) {
      crossCutting.psiByEntity[entityId] = classifyPsi(psiInput);
    }
    modulesInvoked.push('psiClassifier');
  }

  // 3.7 Neo-G4 P2 (MON-098): FTE/IEE overlay — mirror of the Float wiring.
  // The classifier is pure number math on plain inputs; its dollar figures
  // (FTDT / TFN withholding) are reported, not folded into Decimal totals,
  // so the Float result type is reused (the trustDeedValidation/PSI precedent).
  if (input.fteIeeByEntity) {
    crossCutting.fteIeeByEntity = {};
    for (const [entityId, fteInput] of Object.entries(input.fteIeeByEntity)) {
      crossCutting.fteIeeByEntity[entityId] = classifyFteIeeDistributions(fteInput);
    }
    modulesInvoked.push('fteIeeClassifier');
  }
  // 4. Aggregate household totals from entities — Decimal arithmetic.
  let assessableIncome = zero;
  let taxableIncome = zero;
  let netTax = zero;
  let paygWithheld = zero;

  for (const entity of entities) {
    // PERSONAL_NAME / SOLE_TRADER result shape — TaxPositionResultDecimal.
    // Other entity types: result either has no `tax` block or is null;
    // totals aggregate only what's present, mirroring the Float behaviour.
    const r = entity.result as
      | {
          tax?: { assessableIncome?: Decimal; taxableIncome?: Decimal; netTax?: Decimal };
          paygWithheld?: Decimal;
        }
      | null
      | undefined;
    if (r && typeof r === 'object') {
      if (r.tax?.assessableIncome) assessableIncome = assessableIncome.plus(r.tax.assessableIncome);
      if (r.tax?.taxableIncome) taxableIncome = taxableIncome.plus(r.tax.taxableIncome);
      if (r.tax?.netTax) netTax = netTax.plus(r.tax.netTax);
      if (r.paygWithheld) paygWithheld = paygWithheld.plus(r.paygWithheld);
    }
  }

  const estimatedRefund = paygWithheld.minus(netTax);

  // 4b. Aggregate citations + UNCOMPUTED.
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
  if (crossCutting.psiByEntity) {
    for (const r of Object.values(crossCutting.psiByEntity)) {
      ingestCitations(r.citations);
      ingestUncomputed(r.uncomputed);
    }
  }
  if (crossCutting.fteIeeByEntity) {
    for (const r of Object.values(crossCutting.fteIeeByEntity)) {
      ingestCitations(r.citations);
      ingestUncomputed(r.uncomputed);
    }
  }

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
