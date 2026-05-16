/**
 * Phase 41E.2 — Tool: getReformedTaxRegimeStatus
 *
 * Returns the per-property regime classification under the 12 May 2026
 * Budget reform. Composes `deriveNegativeGearingRegime` (Phase 41E.1)
 * + the knowledge pack to surface BOTH the structural regime AND the
 * plain-English explanation the AI may paraphrase (HR-2).
 *
 * FACT_LOOKUP only — never recommends sell/hold/restructure.
 *
 * Per `docs/blueprint/PHASE_41E_REFORM_2026_27.md` §10.10 + CLAUDE.md §12.14 FW-4.
 */

import {
  deriveNegativeGearingRegime,
  type NegativeGearingRegime,
} from '@/lib/tax-engine/divisions/negativeGearingRegime';
import { getTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';
import {
  REFORM_CUT_OVER_UTC,
  REFORM_CUT_OVER_AEST_LABEL,
} from '@/lib/tax-engine/config/reformConstants';
import {
  REFORM_KNOWLEDGE_PACK,
  getStatusLabel,
} from '../knowledge/reform-2026-27';
import type {
  TaxAdvisorTool,
  ToolResult,
  NumericField,
  IdentifiedCitation,
} from '../types';

export interface GetReformedTaxRegimeStatusInput {
  /** Property ID for tracing. */
  propertyId: string;
  /** Property type from `Property.type`. */
  propertyType: 'HOME' | 'INVESTMENT' | 'RENTAL';
  /**
   * ISO date string of `Property.acquisitionContractDate`. Nullable —
   * when null, regime returns `UC_PROPERTY_CONTRACT_DATE_UNKNOWN`.
   */
  acquisitionContractDate: string | null;
  /**
   * `Property.isNewBuild`. Nullable — when null + post-cut-over,
   * regime returns `UC_NEW_BUILD_UNCONFIRMED`.
   */
  isNewBuild: boolean | null;
  /** Target FY string, e.g. `"2027-28"`. */
  financialYear: string;
}

/**
 * Plain-English regime label for each variant. Used by the AI in
 * the "Tax treatment" badge narration.
 */
const REGIME_LABEL: Record<NegativeGearingRegime, string> = {
  PRE_REFORM_GRANDFATHERED:
    'Grandfathered — pre-reform rules apply indefinitely',
  POST_REFORM_NEW_BUILD:
    'Post-reform — qualifies as new build (negative gearing still applies)',
  POST_REFORM_RESTRICTED:
    'Post-reform — negative gearing restricted from FY 2027-28',
  UC_PROPERTY_CONTRACT_DATE_UNKNOWN:
    'Acquisition date unknown — confirm to compute regime',
  UC_NEW_BUILD_UNCONFIRMED:
    'Post-12 May 2026 contract — confirm "is this a new build?" to compute regime',
};

export const getReformedTaxRegimeStatusTool: TaxAdvisorTool<GetReformedTaxRegimeStatusInput> = {
  name: 'getReformedTaxRegimeStatus',
  kind: 'FACT_LOOKUP',
  description:
    'Returns the Phase 41E reform regime classification for a single property in a target FY (one of: PRE_REFORM_GRANDFATHERED, POST_REFORM_NEW_BUILD, POST_REFORM_RESTRICTED, UC_PROPERTY_CONTRACT_DATE_UNKNOWN, UC_NEW_BUILD_UNCONFIRMED) along with the commencement date + grandfathering rule + ATO/Treasury citations. FACT_LOOKUP only — does NOT recommend whether to sell, restructure, or change the negative-gearing position.',
  inputSchema: {
    type: 'object',
    properties: {
      propertyId: {
        type: 'string',
        description: 'Stable ID of the property being classified.',
      },
      propertyType: {
        type: 'string',
        description: 'Property type from the Property model.',
        enum: ['HOME', 'INVESTMENT', 'RENTAL'],
      },
      acquisitionContractDate: {
        type: 'string',
        description: 'ISO 8601 contract date (Property.acquisitionContractDate). Empty string when unknown.',
      },
      isNewBuild: {
        type: 'boolean',
        description: 'Property.isNewBuild flag. Pass false if user has not confirmed (the tool will surface UC_NEW_BUILD_UNCONFIRMED via the contract-date branch).',
      },
      financialYear: {
        type: 'string',
        description: 'Target FY string, e.g. "2027-28".',
      },
    },
    required: ['propertyId', 'propertyType', 'financialYear'],
  },
  execute: (input) => {
    const config = getTaxYearConfig(input.financialYear);

    // Parse the contract date (empty string → null).
    const contractDate =
      input.acquisitionContractDate && input.acquisitionContractDate.trim().length > 0
        ? new Date(input.acquisitionContractDate)
        : null;

    const regime = deriveNegativeGearingRegime({
      propertyType: input.propertyType,
      contractDate,
      isNewBuild: input.isNewBuild,
      fy: input.financialYear,
      config,
    });

    const m1Entry = REFORM_KNOWLEDGE_PACK.NEGATIVE_GEARING_NEW_BUILDS_ONLY;
    const m2Entry = REFORM_KNOWLEDGE_PACK.CGT_INDEXATION_PLUS_MIN_RATE;

    const citations: IdentifiedCitation[] = [
      {
        id: 'cit-1',
        kind: 'ITAA_1997',
        reference: 'Div 36 (Phase 41E Measure 1)',
        lastReviewed: m1Entry.lastReviewed,
      },
      {
        id: 'cit-2',
        kind: 'ITAA_1997',
        reference: 's115-100 + Div 114 (Phase 41E Measure 2)',
        lastReviewed: m2Entry.lastReviewed,
      },
    ];

    // Surface the regime as a count-style numeric field so the AI
    // can render the regime label without inventing it. We encode
    // the regime as a discrete integer (0-4) keyed by enum order +
    // include the label in `narrativeText` for paraphrase.
    const REGIME_TO_INT: Record<NegativeGearingRegime, number> = {
      PRE_REFORM_GRANDFATHERED: 0,
      POST_REFORM_NEW_BUILD: 1,
      POST_REFORM_RESTRICTED: 2,
      UC_PROPERTY_CONTRACT_DATE_UNKNOWN: 3,
      UC_NEW_BUILD_UNCONFIRMED: 4,
    };
    const numericFields: NumericField[] = [
      {
        path: `reform.regime.${input.propertyId}`,
        value: REGIME_TO_INT[regime],
        unit: 'COUNT',
        label: `Phase 41E regime code (0=GRANDFATHERED, 1=NEW_BUILD, 2=RESTRICTED, 3=UC_DATE, 4=UC_NEW_BUILD): ${REGIME_LABEL[regime]}`,
        citationIds: ['cit-1'],
      },
      {
        path: `reform.cutOverUtcEpochMs`,
        value: REFORM_CUT_OVER_UTC.getTime(),
        unit: 'COUNT',
        label: `Phase 41E cut-over moment (UTC epoch ms) = ${REFORM_CUT_OVER_AEST_LABEL}`,
        citationIds: ['cit-1', 'cit-2'],
      },
    ];

    const narrativeText = [
      `Property ${input.propertyId} in FY ${input.financialYear}: ${REGIME_LABEL[regime]} [cit:cit-1].`,
      regime === 'PRE_REFORM_GRANDFATHERED'
        ? 'Pre-reform rules apply indefinitely. Negative gearing continues to offset other income; 50% CGT discount continues to apply on disposal.'
        : regime === 'POST_REFORM_NEW_BUILD'
          ? `Post-reform new-build classification. Negative gearing still applies (the reform's safe-harbour for new construction). ${m2Entry.userImpactText}`
          : regime === 'POST_REFORM_RESTRICTED'
            ? `Post-reform restricted. ${m1Entry.userImpactText} ${getStatusLabel(m1Entry.status)} [cit:cit-1].`
            : regime === 'UC_PROPERTY_CONTRACT_DATE_UNKNOWN'
              ? 'Acquisition contract date is missing from the record. Cannot determine grandfathering. Confirming the contract date in property settings unlocks the regime classification.'
              : 'Property contracted after the 12 May 2026 7:30pm AEST cut-over. Whether it qualifies as a new build (and so retains negative gearing) needs user confirmation in property settings.',
    ].join(' ');

    return {
      toolName: 'getReformedTaxRegimeStatus',
      computedAt: new Date().toISOString(),
      numericFields,
      citations,
      uncomputed: [],
      narrativeText,
      raw: {
        regime,
        regimeLabel: REGIME_LABEL[regime],
        propertyId: input.propertyId,
        fy: input.financialYear,
        knowledgePackStatus: m1Entry.status,
      },
    } satisfies ToolResult;
  },
};
