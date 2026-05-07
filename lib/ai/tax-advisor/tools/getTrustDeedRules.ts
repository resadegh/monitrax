/**
 * Phase 41f.4-extension — Tool: getTrustDeedRules
 *
 * Wraps `lib/services/trustDeedRulesService.ts:getConfirmedExtractionForEntity`
 * to expose a trust's CONFIRMED deed rules to the AI advisor as a
 * FACT_LOOKUP. Returns counts (beneficiaries / distribution rules /
 * loan provisions / vesting date) plus structured `raw` payload for
 * the AI to narrate.
 *
 * **Why counts as numericFields, not the rules themselves:**
 * Per HR-1, every number the AI emits must come from `numericFields`.
 * The rules themselves are categorical (PRIMARY / EXCLUDED / etc.) —
 * those go in `narrativeText` + `raw`. The audit-relevant numbers
 * are the counts ("you have 4 named beneficiaries; 1 is excluded;
 * 2 distribution rules apply") so the AI can talk about deed
 * structure without inventing facts about the deed.
 *
 * **Why FACT_LOOKUP, not RECOMMENDATION:**
 * Per D-2, the advisor can never recommend a distribution. This tool
 * only surfaces what the deed says is *allowed*. Whether a particular
 * trustee resolution is wise vs unwise is professional advice (route
 * to Ask-a-Pro).
 *
 * Authority: Div 6/6E ITAA 1936 (trust distribution); Div 7A ITAA 1936
 * (sub-trust UPE); s100A ITAA 1936 (reimbursement agreement).
 */

import 'server-only';
import { getConfirmedExtractionForEntity } from '@/lib/services/trustDeedRulesService';
import type {
  TaxAdvisorTool,
  ToolResult,
  NumericField,
  IdentifiedCitation,
} from '../types';

interface GetTrustDeedRulesInput {
  /** LegalEntity id of the trust. Must be DISCRETIONARY_TRUST or UNIT_TRUST. */
  legalEntityId: string;
}

export const getTrustDeedRulesTool: TaxAdvisorTool<GetTrustDeedRulesInput> = {
  name: 'getTrustDeedRules',
  kind: 'FACT_LOOKUP',
  description:
    "Returns the CONFIRMED trust-deed rules for a trust entity (beneficiaries, distribution rules, loan provisions, vesting date). FACT_LOOKUP only — surfaces what the deed allows; never recommends a distribution. Returns no data if the entity has no CONFIRMED deed (the user has not uploaded + confirmed one).",
  inputSchema: {
    type: 'object',
    properties: {
      legalEntityId: {
        type: 'string',
        description: 'Stable LegalEntity id of the trust to look up.',
      },
    },
    required: ['legalEntityId'],
  },
  execute: async (input) => {
    const extraction = await getConfirmedExtractionForEntity(input.legalEntityId);

    const citations: IdentifiedCitation[] = [
      {
        id: 'cit-1',
        kind: 'ITAA_1936',
        reference: 'Div 6 (trust distributions)',
        lastReviewed: '2026-05-07',
      },
      {
        id: 'cit-2',
        kind: 'ITAA_1936',
        reference: 's100A (reimbursement agreement)',
        lastReviewed: '2026-05-07',
      },
      {
        id: 'cit-3',
        kind: 'ITAA_1936',
        reference: 'Div 7A (s109N sub-trust UPE)',
        lastReviewed: '2026-05-07',
      },
    ];
    const allCitationIds = citations.map((c) => c.id);

    if (!extraction) {
      // No CONFIRMED deed — surface UNCOMPUTED instead of inventing structure.
      return {
        toolName: 'getTrustDeedRules',
        computedAt: new Date().toISOString(),
        numericFields: [
          {
            path: 'trustDeed.beneficiaryCount',
            value: 0,
            unit: 'COUNT',
            label: 'Number of CONFIRMED beneficiaries on file',
            citationIds: ['cit-1'],
          },
          {
            path: 'trustDeed.distributionRuleCount',
            value: 0,
            unit: 'COUNT',
            label: 'Number of CONFIRMED distribution rules on file',
            citationIds: ['cit-1'],
          },
        ],
        citations,
        uncomputed: [
          {
            id: `UC-TRUST-DEED-NOT-CONFIRMED-${input.legalEntityId}`,
            rationale:
              'No CONFIRMED trust deed on file for this entity. The user has either not uploaded a deed or has not confirmed the extracted rules in the 4-step review flow.',
          },
        ],
        narrativeText:
          'No CONFIRMED trust deed is on file for this entity. The user can upload one at /dashboard/entities/[id]/trust-deed.',
        raw: { hasConfirmedDeed: false },
      } satisfies ToolResult;
    }

    const beneficiaryCount = extraction.beneficiaries.length;
    const excludedCount = extraction.beneficiaries.filter(
      (b) => b.type === 'EXCLUDED',
    ).length;
    const primaryCount = extraction.beneficiaries.filter(
      (b) => b.type === 'PRIMARY',
    ).length;
    const distributionRuleCount = extraction.distributionRules.length;
    const loanProvisionCount = extraction.loanProvisions?.length ?? 0;
    const hasSubTrustUpe =
      extraction.loanProvisions?.some((p) => p.type === 'SUB_TRUST_UPE') ??
      false;

    const numericFields: NumericField[] = [
      {
        path: 'trustDeed.beneficiaryCount',
        value: beneficiaryCount,
        unit: 'COUNT',
        label: 'Number of CONFIRMED beneficiaries on file',
        citationIds: ['cit-1'],
      },
      {
        path: 'trustDeed.primaryBeneficiaryCount',
        value: primaryCount,
        unit: 'COUNT',
        label: 'Number of PRIMARY beneficiaries',
        citationIds: ['cit-1'],
      },
      {
        path: 'trustDeed.excludedBeneficiaryCount',
        value: excludedCount,
        unit: 'COUNT',
        label: 'Number of EXCLUDED beneficiaries (cannot receive distributions)',
        citationIds: ['cit-1', 'cit-2'],
      },
      {
        path: 'trustDeed.distributionRuleCount',
        value: distributionRuleCount,
        unit: 'COUNT',
        label: 'Number of CONFIRMED distribution rules',
        citationIds: ['cit-1'],
      },
      {
        path: 'trustDeed.loanProvisionCount',
        value: loanProvisionCount,
        unit: 'COUNT',
        label: 'Number of CONFIRMED loan provisions in the deed',
        citationIds: ['cit-3'],
      },
    ];

    const ruleTypeCounts: Record<string, number> = {};
    for (const r of extraction.distributionRules) {
      ruleTypeCounts[r.type] = (ruleTypeCounts[r.type] ?? 0) + 1;
    }
    const ruleSummary = Object.entries(ruleTypeCounts)
      .map(([type, n]) => `${n} ${type.toLowerCase()}`)
      .join(', ');

    const narrativeParts: string[] = [
      `This trust has ${beneficiaryCount} CONFIRMED beneficiaries [cit:cit-1]: ${primaryCount} primary, ${excludedCount} excluded.`,
    ];
    if (distributionRuleCount > 0) {
      narrativeParts.push(`The deed specifies ${distributionRuleCount} distribution rule(s) (${ruleSummary}).`);
    } else {
      narrativeParts.push('The deed does not specify any structured distribution rules — distributions default to discretionary allocation.');
    }
    if (hasSubTrustUpe) {
      narrativeParts.push(
        'The deed includes SUB_TRUST_UPE loan provisions [cit:cit-3]; Div 7A sub-trust path applies if any beneficiary has an unpaid present entitlement to this trust.',
      );
    }
    if (extraction.vestingDate) {
      narrativeParts.push(`Trust vests on ${extraction.vestingDate}.`);
    }

    return {
      toolName: 'getTrustDeedRules',
      computedAt: new Date().toISOString(),
      numericFields,
      citations,
      uncomputed: extraction.uncomputedNotes.map((n) => ({
        id: `UC-DEED-${n.id}`,
        rationale: n.rationale,
      })),
      narrativeText: narrativeParts.join(' '),
      raw: {
        hasConfirmedDeed: true,
        beneficiaries: extraction.beneficiaries,
        distributionRules: extraction.distributionRules,
        loanProvisions: extraction.loanProvisions,
        vestingDate: extraction.vestingDate,
        hasSubTrustUpe,
      },
    } satisfies ToolResult;
  },
};
