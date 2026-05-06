/**
 * Phase 41h.5 — Tool: getCgtExposure
 *
 * Wraps `lib/tax-engine/divisions/capitalLossNetting.ts`. Returns
 * the user's net assessable capital gain after applying the s100-50
 * loss-netting order + s115-100 CGT discount + Div 102-A assessable
 * net CG calculation.
 *
 * Authority: ITAA 1997 Div 102-A (assessable net capital gain),
 * s100-50 (netting order), s115-100 (50% / 33⅓% discount).
 */

import {
  applyCapitalLossNetting,
  type CapitalLossNettingInput,
} from '@/lib/tax-engine/divisions/capitalLossNetting';
import type {
  TaxAdvisorTool,
  ToolResult,
  NumericField,
  IdentifiedCitation,
} from '../types';

export const getCgtExposureTool: TaxAdvisorTool<CapitalLossNettingInput> = {
  name: 'getCgtExposure',
  kind: 'FACT_LOOKUP',
  description:
    'Returns the user\'s net assessable capital gain (after s100-50 loss-netting + s115-100 discount + Div 102-A net CG calculation) for a list of CGT events. FACT_LOOKUP only — does not recommend whether to realise gains or losses.',
  inputSchema: {
    type: 'object',
    properties: {
      entityType: {
        type: 'string',
        description: 'Eligible entity type for CGT.',
        enum: ['INDIVIDUAL', 'TRUST', 'COMPANY', 'SMSF'],
      },
      events: {
        type: 'array',
        description: 'CGT events for the FY (sales, disposals, CGT events A1+).',
        items: { type: 'object' },
      },
      isComplying: {
        type: 'boolean',
        description: 'For SMSF: whether the fund is complying (drives 33⅓% vs 0% discount).',
      },
      isForeignResident: {
        type: 'boolean',
        description: 'For individuals: foreign-resident status (no 50% discount on gains accrued post-2012-05-08).',
      },
    },
    required: ['entityType', 'events'],
  },
  execute: (input) => {
    const result = applyCapitalLossNetting(input);

    const citations: IdentifiedCitation[] = result.citations.map((c, i) => ({
      ...c,
      id: `cit-${i + 1}`,
    }));
    const allCitationIds = citations.map((c) => c.id);
    const div115Citations = citations
      .filter(
        (c) =>
          c.reference.includes('Div 115') ||
          c.reference.includes('s115') ||
          c.reference.includes('discount'),
      )
      .map((c) => c.id);

    const numericFields: NumericField[] = [
      {
        path: 'cgt.totalNominalGains',
        value: result.totalNominalGains,
        unit: 'AUD',
        label: 'Total nominal capital gains (sum of all positive events)',
        citationIds: allCitationIds,
      },
      {
        path: 'cgt.totalCurrentYearLosses',
        value: result.totalCurrentYearLosses,
        unit: 'AUD',
        label: 'Total current-year capital losses',
        citationIds: allCitationIds,
      },
      {
        path: 'cgt.totalPriorYearLosses',
        value: result.totalPriorYearLosses,
        unit: 'AUD',
        label: 'Carry-forward losses available from prior FYs',
        citationIds: allCitationIds,
      },
      {
        path: 'cgt.netGainBeforeDiscount',
        value: result.netGainBeforeDiscount,
        unit: 'AUD',
        label: 'Net gain after s100-50 loss netting (before discount)',
        citationIds: allCitationIds,
      },
      {
        path: 'cgt.assessableNetCapitalGain',
        value: result.assessableNetCapitalGain,
        unit: 'AUD',
        label: 'Assessable net capital gain (Div 102-A — flows to taxable income)',
        citationIds: allCitationIds,
      },
    ];

    if (result.discountResult) {
      numericFields.push({
        path: 'cgt.discountAmount',
        value: result.discountResult.discountAmount,
        unit: 'AUD',
        label: 'CGT discount applied',
        citationIds: div115Citations,
      });
      numericFields.push({
        path: 'cgt.discountRate',
        value: result.discountResult.discountRate,
        unit: 'RATIO',
        label: 'Applicable discount rate (0.5 / 0.333 / 0)',
        citationIds: div115Citations,
      });
    }

    const narrativeText = [
      `Net assessable capital gain: $${result.assessableNetCapitalGain.toLocaleString()} [cit:cit-1].`,
      result.netGainBeforeDiscount > 0
        ? `Pre-discount net gain: $${result.netGainBeforeDiscount.toLocaleString()} after applying $${result.totalCurrentYearLosses.toLocaleString()} current-year + $${result.totalPriorYearLosses.toLocaleString()} prior-year losses (s100-50 ordering).`
        : 'No net assessable gain — losses absorbed all gains for the FY.',
    ].join(' ');

    const out: ToolResult = {
      toolName: 'getCgtExposure',
      computedAt: new Date().toISOString(),
      numericFields,
      citations,
      uncomputed: result.uncomputed ?? [],
      narrativeText,
      raw: result,
    };
    return out;
  },
};
