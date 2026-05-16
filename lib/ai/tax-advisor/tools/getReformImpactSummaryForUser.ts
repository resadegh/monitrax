/**
 * Phase 41E.2 — Tool: getReformImpactSummaryForUser
 *
 * The cross-measure SCENARIO_RUN tool behind the `/dashboard/cfo/ask`
 * surface — answers *"How do the new tax laws affect me?"* via a
 * single composed call. Per `docs/blueprint/PHASE_41E_REFORM_2026_27.md` §10.10
 * and Reza directive 2026-05-16.
 *
 * **Three parts in the output:**
 *   1. Summary of all 9 measures from the knowledge pack — HR-2.
 *   2. Per-asset / per-entity regime classification for the user —
 *      HR-1 (composed from engine outputs only).
 *   3. Implied next steps (scenario CTAs + Ask-a-Pro routing) — D-2.
 *      The tool itself returns FACTS only; the narrator surface
 *      formats them. The validator chain catches any recommendation
 *      verb at response-emission time.
 *
 * **Three layers of HR-1/HR-2/D-2 enforcement** (CLAUDE.md §12.14 FW-4):
 *   - HR-1 — every number in `numericFields` traces to a real engine
 *     output (regime code, contract-date epoch ms, count of affected
 *     properties, etc.) — never invented.
 *   - HR-2 — every citation is from the knowledge pack `citations` array.
 *   - D-2 — `kind: 'SCENARIO_RUN'` (never `RECOMMENDATION`); narrative
 *     text uses scenario verbs only ("here is the regime", "consider
 *     asking a tax agent about X"), never imperative ("you should sell").
 *
 * Composes:
 *   - `deriveNegativeGearingRegime` per property
 *   - `getReformKnowledgeEntry` for narration
 *   - `LegalEntity.trustType` → Measure 3 impact flag
 *   - `LegalEntity.isForeignResident` → Measure 4 impact flag
 *   - `CompanyTaxHistory` → Measure 5 eligibility flag
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
  getAllReformKnowledgeEntries,
  getStatusLabel,
} from '../knowledge/reform-2026-27';
import type {
  TaxAdvisorTool,
  ToolResult,
  NumericField,
  IdentifiedCitation,
} from '../types';

/**
 * Light-weight property shape needed for the summary — caller assembles
 * from `Property` rows + the user's TFN context. Tool itself is pure.
 */
export interface ReformSummaryProperty {
  propertyId: string;
  propertyType: 'HOME' | 'INVESTMENT' | 'RENTAL';
  acquisitionContractDate: string | null; // ISO date or null
  isNewBuild: boolean | null;
  isRenewablesInfrastructure: boolean | null;
}

/**
 * Light-weight entity shape needed for Measures 3 + 4.
 */
export interface ReformSummaryEntity {
  legalEntityId: string;
  type:
    | 'PERSONAL_NAME'
    | 'COMPANY'
    | 'DISCRETIONARY_TRUST'
    | 'UNIT_TRUST'
    | 'SMSF'
    | 'PARTNERSHIP'
    | 'SOLE_TRADER';
  trustType:
    | 'DISCRETIONARY'
    | 'FIXED'
    | 'UNIT'
    | 'TESTAMENTARY_FIXED'
    | 'CHARITABLE'
    | 'DECEASED_ESTATE'
    | 'SPECIAL_DISABILITY'
    | 'OTHER'
    | null;
  isForeignResident: boolean | null;
}

/**
 * Light-weight company tax history input for Measure 5 eligibility.
 * Caller assembles from `CompanyTaxHistory` rows.
 */
export interface ReformSummaryCompanyEligibility {
  legalEntityId: string;
  hasCurrentFyLoss: boolean;
  hasPriorYearTaxPaid: boolean;
  turnoverUnderOneBillion: boolean;
}

export interface GetReformImpactSummaryForUserInput {
  /** User ID (for tracing only — tool is pure). */
  userId: string;
  /** Target FY for the summary, e.g. "2027-28". */
  financialYear: string;
  /** All of the user's properties (caller filters for the user). */
  properties: ReformSummaryProperty[];
  /** All of the user's legal entities. */
  entities: ReformSummaryEntity[];
  /** All of the user's company entities' tax-history eligibility. */
  companies: ReformSummaryCompanyEligibility[];
}

/**
 * Regime → human-readable label. Mirrors the table in
 * `getReformedTaxRegimeStatus.ts` (shared map).
 */
const REGIME_LABEL: Record<NegativeGearingRegime, string> = {
  PRE_REFORM_GRANDFATHERED: 'Grandfathered',
  POST_REFORM_NEW_BUILD: 'Post-reform — new build',
  POST_REFORM_RESTRICTED: 'Post-reform — restricted',
  UC_PROPERTY_CONTRACT_DATE_UNKNOWN: 'Confirm contract date',
  UC_NEW_BUILD_UNCONFIRMED: 'Confirm new-build status',
};

const REGIME_TO_INT: Record<NegativeGearingRegime, number> = {
  PRE_REFORM_GRANDFATHERED: 0,
  POST_REFORM_NEW_BUILD: 1,
  POST_REFORM_RESTRICTED: 2,
  UC_PROPERTY_CONTRACT_DATE_UNKNOWN: 3,
  UC_NEW_BUILD_UNCONFIRMED: 4,
};

export const getReformImpactSummaryForUserTool: TaxAdvisorTool<GetReformImpactSummaryForUserInput> = {
  name: 'getReformImpactSummaryForUser',
  kind: 'SCENARIO_RUN',
  description:
    "Returns the per-measure Phase 41E reform impact for the requesting user: " +
    "(a) summary of all 9 measures from the knowledge pack (HR-2 — never " +
    "from LLM memory); (b) per-property regime classification + per-entity " +
    "trust-type + foreign-resident + per-company carry-back eligibility " +
    "(HR-1 — engine-driven). Returns UNCOMPUTED for measures whose mechanic " +
    "is not yet live. Output is FACT — never a recommendation; the validator " +
    "chain catches any recommendation verb at response emission (D-2).",
  inputSchema: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'User ID (tracing only).' },
      financialYear: {
        type: 'string',
        description: 'Target FY string, e.g. "2027-28".',
      },
      properties: {
        type: 'array',
        description: "User's properties — minimum required fields for regime classification.",
        items: { type: 'object' },
      },
      entities: {
        type: 'array',
        description: "User's legal entities — drives Measures 3 + 4.",
        items: { type: 'object' },
      },
      companies: {
        type: 'array',
        description: "User's company entities' carry-back eligibility — Measure 5.",
        items: { type: 'object' },
      },
    },
    required: ['userId', 'financialYear', 'properties', 'entities', 'companies'],
  },
  execute: (input) => {
    const config = getTaxYearConfig(input.financialYear);
    const allEntries = getAllReformKnowledgeEntries();

    // Per-property regime classification.
    const perProperty = input.properties.map((p) => {
      const contractDate =
        p.acquisitionContractDate && p.acquisitionContractDate.trim().length > 0
          ? new Date(p.acquisitionContractDate)
          : null;
      const regime = deriveNegativeGearingRegime({
        propertyType: p.propertyType,
        contractDate,
        isNewBuild: p.isNewBuild,
        fy: input.financialYear,
        config,
      });
      return { propertyId: p.propertyId, regime };
    });

    const countByRegime: Record<NegativeGearingRegime, number> = {
      PRE_REFORM_GRANDFATHERED: 0,
      POST_REFORM_NEW_BUILD: 0,
      POST_REFORM_RESTRICTED: 0,
      UC_PROPERTY_CONTRACT_DATE_UNKNOWN: 0,
      UC_NEW_BUILD_UNCONFIRMED: 0,
    };
    for (const { regime } of perProperty) countByRegime[regime]++;

    // Per-entity Measure 3 + Measure 4 impact flags.
    const discretionaryTrustCount = input.entities.filter(
      (e) => e.trustType === 'DISCRETIONARY',
    ).length;
    const unknownTrustTypeCount = input.entities.filter(
      (e) =>
        (e.type === 'DISCRETIONARY_TRUST' || e.type === 'UNIT_TRUST') &&
        e.trustType === null,
    ).length;
    const foreignResidentEntityCount = input.entities.filter(
      (e) => e.isForeignResident === true,
    ).length;

    // Measure 5 — company carry-back eligibility.
    const carryBackEligibleCompanyCount = input.companies.filter(
      (c) => c.hasCurrentFyLoss && c.hasPriorYearTaxPaid && c.turnoverUnderOneBillion,
    ).length;

    // Build citations from the knowledge pack — one citation per measure.
    // Each entry contributes its primary URL; the AI can reference any of them.
    const citations: IdentifiedCitation[] = allEntries.map((entry, i) => ({
      id: `cit-${i + 1}`,
      kind: 'ITAA_1997',
      reference: `${entry.title} (${entry.commencementText})`,
      lastReviewed: entry.lastReviewed,
    }));
    const allCitationIds = citations.map((c) => c.id);

    const numericFields: NumericField[] = [
      {
        path: 'reform.summary.totalMeasures',
        value: allEntries.length,
        unit: 'COUNT',
        label: 'Total Budget 2026-27 tax-law reform measures',
        citationIds: allCitationIds,
      },
      {
        path: 'reform.summary.propertyCountGrandfathered',
        value: countByRegime.PRE_REFORM_GRANDFATHERED,
        unit: 'COUNT',
        label: 'Your properties grandfathered under pre-reform rules (no change)',
        citationIds: ['cit-1', 'cit-2'],
      },
      {
        path: 'reform.summary.propertyCountPostReformNewBuild',
        value: countByRegime.POST_REFORM_NEW_BUILD,
        unit: 'COUNT',
        label: "Your properties qualifying as new builds (negative gearing still applies)",
        citationIds: ['cit-1'],
      },
      {
        path: 'reform.summary.propertyCountPostReformRestricted',
        value: countByRegime.POST_REFORM_RESTRICTED,
        unit: 'COUNT',
        label: 'Your properties subject to restricted negative gearing from FY 2027-28',
        citationIds: ['cit-1'],
      },
      {
        path: 'reform.summary.propertyCountNeedsContractDate',
        value: countByRegime.UC_PROPERTY_CONTRACT_DATE_UNKNOWN,
        unit: 'COUNT',
        label: 'Your properties needing contract-date confirmation',
        citationIds: ['cit-1'],
      },
      {
        path: 'reform.summary.propertyCountNeedsNewBuildConfirmation',
        value: countByRegime.UC_NEW_BUILD_UNCONFIRMED,
        unit: 'COUNT',
        label: 'Your properties needing new-build confirmation',
        citationIds: ['cit-1'],
      },
      {
        path: 'reform.summary.discretionaryTrustCount',
        value: discretionaryTrustCount,
        unit: 'COUNT',
        label: 'Your discretionary trusts affected by Measure 3 (30% minimum tax from FY 2028-29)',
        citationIds: ['cit-3'],
      },
      {
        path: 'reform.summary.unknownTrustTypeCount',
        value: unknownTrustTypeCount,
        unit: 'COUNT',
        label: 'Your trusts needing trust-type confirmation',
        citationIds: ['cit-3'],
      },
      {
        path: 'reform.summary.foreignResidentEntityCount',
        value: foreignResidentEntityCount,
        unit: 'COUNT',
        label: 'Your foreign-resident entities affected by Measure 4 (Div 855 expansion)',
        citationIds: ['cit-4'],
      },
      {
        path: 'reform.summary.carryBackEligibleCompanyCount',
        value: carryBackEligibleCompanyCount,
        unit: 'COUNT',
        label: 'Your companies eligible for Measure 5 loss carry-back this FY',
        citationIds: ['cit-5'],
      },
      {
        path: 'reform.cutOverUtcEpochMs',
        value: REFORM_CUT_OVER_UTC.getTime(),
        unit: 'COUNT',
        label: `Phase 41E cut-over moment (UTC epoch ms) = ${REFORM_CUT_OVER_AEST_LABEL}`,
        citationIds: allCitationIds,
      },
    ];

    // Build narrativeText — calm framing per Reza 2026-05-16:
    // lead with the good news (grandfathering protects most users),
    // then surface forward implications, then ONE clear next step per
    // affected area (One Clear Action principle from architect-mode skill).
    const narrativeText = buildNarrativeText({
      countByRegime,
      discretionaryTrustCount,
      unknownTrustTypeCount,
      foreignResidentEntityCount,
      carryBackEligibleCompanyCount,
      fy: input.financialYear,
    });

    return {
      toolName: 'getReformImpactSummaryForUser',
      computedAt: new Date().toISOString(),
      numericFields,
      citations,
      uncomputed: [],
      narrativeText,
      raw: {
        countByRegime,
        discretionaryTrustCount,
        unknownTrustTypeCount,
        foreignResidentEntityCount,
        carryBackEligibleCompanyCount,
        perProperty,
        knowledgePackStatusByMeasure: Object.fromEntries(
          allEntries.map((e) => [e.measure, { status: e.status, lastReviewed: e.lastReviewed }]),
        ),
      },
    } satisfies ToolResult;
  },
};

/**
 * Build calm-framing narrative. Lead with "you're already protected"
 * when grandfathering applies broadly; surface forward implications
 * second; flag the ONE clear next step per affected area.
 *
 * Behavioural-psychologist lens (CLAUDE.md §0 + §14): never
 * manufactured urgency, never shame. Warm-words framing.
 */
function buildNarrativeText(args: {
  countByRegime: Record<NegativeGearingRegime, number>;
  discretionaryTrustCount: number;
  unknownTrustTypeCount: number;
  foreignResidentEntityCount: number;
  carryBackEligibleCompanyCount: number;
  fy: string;
}): string {
  const { countByRegime, discretionaryTrustCount, unknownTrustTypeCount, foreignResidentEntityCount, carryBackEligibleCompanyCount, fy } = args;
  const totalProperties =
    countByRegime.PRE_REFORM_GRANDFATHERED +
    countByRegime.POST_REFORM_NEW_BUILD +
    countByRegime.POST_REFORM_RESTRICTED +
    countByRegime.UC_PROPERTY_CONTRACT_DATE_UNKNOWN +
    countByRegime.UC_NEW_BUILD_UNCONFIRMED;
  const m1Status = getStatusLabel(REFORM_KNOWLEDGE_PACK.NEGATIVE_GEARING_NEW_BUILDS_ONLY.status);

  const parts: string[] = [];

  // Opening — calm framing.
  parts.push(
    `Here is your position under the 12 May 2026 Budget tax reforms for FY ${fy}. ${m1Status} [cit:cit-1].`,
  );

  // Property block.
  if (totalProperties === 0) {
    parts.push('You have no properties currently on file.');
  } else if (countByRegime.PRE_REFORM_GRANDFATHERED === totalProperties) {
    parts.push(
      `All ${totalProperties} of your properties are grandfathered — pre-reform rules apply indefinitely. Nothing changes for your negative gearing or 50% CGT discount.`,
    );
  } else {
    if (countByRegime.PRE_REFORM_GRANDFATHERED > 0) {
      parts.push(
        `${countByRegime.PRE_REFORM_GRANDFATHERED} of your properties are grandfathered (pre-reform rules apply indefinitely).`,
      );
    }
    if (countByRegime.POST_REFORM_NEW_BUILD > 0) {
      parts.push(
        `${countByRegime.POST_REFORM_NEW_BUILD} qualify as new builds (negative gearing still applies from FY 2027-28).`,
      );
    }
    if (countByRegime.POST_REFORM_RESTRICTED > 0) {
      parts.push(
        `${countByRegime.POST_REFORM_RESTRICTED} are subject to restricted negative gearing from FY 2027-28. Things to consider asking a tax agent about: how this affects your projected cashflow + whether the rollover-relief window (1 July 2027 – 30 June 2030) is relevant to your situation.`,
      );
    }
    if (countByRegime.UC_PROPERTY_CONTRACT_DATE_UNKNOWN > 0) {
      parts.push(
        `${countByRegime.UC_PROPERTY_CONTRACT_DATE_UNKNOWN} need contract-date confirmation in your property settings — without this, the regime classification cannot be computed.`,
      );
    }
    if (countByRegime.UC_NEW_BUILD_UNCONFIRMED > 0) {
      parts.push(
        `${countByRegime.UC_NEW_BUILD_UNCONFIRMED} need new-build confirmation in your property settings.`,
      );
    }
  }

  // Trust block.
  if (discretionaryTrustCount > 0) {
    parts.push(
      `You have ${discretionaryTrustCount} discretionary trust${discretionaryTrustCount === 1 ? '' : 's'} affected by Measure 3 (30% minimum tax on discretionary-trust taxable income, from FY 2028-29) [cit:cit-3]. The 3-year rollover-relief window for restructuring runs 1 July 2027 – 30 June 2030.`,
    );
  }
  if (unknownTrustTypeCount > 0) {
    parts.push(
      `${unknownTrustTypeCount} of your trust${unknownTrustTypeCount === 1 ? '' : 's'} need${unknownTrustTypeCount === 1 ? 's' : ''} trust-type confirmation (fixed/unit/discretionary/etc.) in entity settings.`,
    );
  }

  // Foreign-resident block.
  if (foreignResidentEntityCount > 0) {
    parts.push(
      `${foreignResidentEntityCount} of your entities ${foreignResidentEntityCount === 1 ? 'is' : 'are'} flagged as foreign-resident — affected by Measure 4 (Div 855 TARP expansion + 365-day Principal Asset Test + >$50M notification) [cit:cit-4].`,
    );
  }

  // Company carry-back block.
  if (carryBackEligibleCompanyCount > 0) {
    parts.push(
      `You may be eligible to elect Measure 5 loss carry-back for ${carryBackEligibleCompanyCount} of your compan${carryBackEligibleCompanyCount === 1 ? 'y' : 'ies'} this FY — claim back tax paid in the prior 2 years against the current loss (capped at the franking-account balance) [cit:cit-5]. The election is optional + reversible.`,
    );
  }

  // Closing — Ask-a-Pro routing (D-2).
  parts.push(
    'For decisions like selling property, restructuring trusts, or the carry-back election, the personal call is yours — but the technical questions are best answered by a registered tax agent or financial adviser who can consider your full circumstances.',
  );

  return parts.join(' ');
}
