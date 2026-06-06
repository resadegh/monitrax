/**
 * Phase 41h.0 — Tool: getLandTaxPosition
 *
 * Wraps `lib/tax-engine/landTax/crossStateAggregator.ts`. Returns
 * the user's cross-state land tax position for a multi-property
 * portfolio.
 *
 * Authority: per-state Land Tax Acts (NSW Land Tax Act 1956, VIC
 * Land Tax Act 2005, QLD Land Tax Act 2010, etc.). Citations are
 * lifted directly from the calc engine — never authored by the AI.
 */

import {
  calculateCrossStateLandTaxDecimal,
  type CrossStateLandTaxInput,
} from '@/lib/tax-engine/landTax/crossStateAggregator';
import { serializeDecimalsForJson } from '@/lib/decimal';
import type { TaxAdvisorTool, ToolResult, NumericField, IdentifiedCitation } from '../types';

export const getLandTaxPositionTool: TaxAdvisorTool<CrossStateLandTaxInput> = {
  name: 'getLandTaxPosition',
  kind: 'FACT_LOOKUP',
  description:
    'Returns the user\'s cross-state land tax position. Aggregates within-state, then sums across states (per-state independence). FACT_LOOKUP only — does not recommend whether to sell or restructure.',
  inputSchema: {
    type: 'object',
    properties: {
      ownershipType: {
        type: 'string',
        description: 'Ownership type for the entire portfolio.',
        enum: ['INDIVIDUAL', 'COMPANY', 'DISCRETIONARY_TRUST', 'UNIT_TRUST_FIXED', 'UNIT_TRUST_NON_FIXED', 'SMSF'],
      },
      isForeignOwner: {
        type: 'boolean',
        description: 'Whether the owner is a foreign person under the relevant state\'s definition.',
      },
      properties: {
        type: 'array',
        description: 'Each property to include in the assessment.',
        items: {
          type: 'object',
        },
      },
    },
    required: ['ownershipType', 'isForeignOwner', 'properties'],
  },
  execute: (input) => {
    // Q-DEC PR 3.D — Decimal engine.
    const result = calculateCrossStateLandTaxDecimal(input);

    // Promote calc-engine citations to identified citations the AI may reference.
    const citations: IdentifiedCitation[] = result.citations.map((c, i) => ({
      ...c,
      id: `cit-${i + 1}`,
    }));

    const numericFields: NumericField[] = [
      {
        path: 'landTax.grandTotalTax',
        value: result.grandTotalTax.toNumber(),
        unit: 'AUD',
        label: 'Total land tax (across all states)',
        citationIds: citations.map((c) => c.id),
      },
      {
        path: 'landTax.grandTotalGeneralTax',
        value: result.grandTotalGeneralTax.toNumber(),
        unit: 'AUD',
        label: 'General land tax component',
        citationIds: citations.filter((c) => !c.reference.toLowerCase().includes('foreign') && !c.reference.toLowerCase().includes('trust')).map((c) => c.id),
      },
      {
        path: 'landTax.grandTotalTrustSurcharge',
        value: result.grandTotalTrustSurcharge.toNumber(),
        unit: 'AUD',
        label: 'Trust surcharge component',
        citationIds: citations.filter((c) => c.reference.toLowerCase().includes('trust') || c.reference.toLowerCase().includes('s5a') || c.reference.toLowerCase().includes('s46ib')).map((c) => c.id),
      },
      {
        path: 'landTax.grandTotalForeignSurcharge',
        value: result.grandTotalForeignSurcharge.toNumber(),
        unit: 'AUD',
        label: 'Foreign / absentee owner surcharge component',
        citationIds: citations.filter((c) => c.reference.toLowerCase().includes('foreign') || c.reference.toLowerCase().includes('absentee') || c.reference.toLowerCase().includes('sch 1a') || c.reference.toLowerCase().includes('s46ic')).map((c) => c.id),
      },
      {
        path: 'landTax.statesAssessed',
        value: result.statesAssessed,
        unit: 'COUNT',
        label: 'Number of states with at least one property',
        citationIds: [],
      },
    ];

    // Per-state breakdown.
    for (const a of result.perStateAssessments) {
      numericFields.push({
        path: `landTax.${a.state}.aggregatedValue`,
        value: a.aggregatedValue.toNumber(),
        unit: 'AUD',
        label: `${a.state} aggregated taxable land value (within-state)`,
        citationIds: [],
      });
      numericFields.push({
        path: `landTax.${a.state}.totalTax`,
        value: a.result.totalTax.toNumber(),
        unit: 'AUD',
        label: `${a.state} total land tax`,
        citationIds: citations
          .filter((c) => c.reference.includes(a.state))
          .map((c) => c.id),
      });
      numericFields.push({
        path: `landTax.${a.state}.parcelCount`,
        value: a.parcelCount,
        unit: 'COUNT',
        label: `${a.state} parcel count`,
        citationIds: [],
      });
    }

    const narrativeParts = [
      `Total land tax across ${result.statesAssessed} state(s): $${result.grandTotalTax.toNumber().toLocaleString()}.`,
      ...result.perStateAssessments.map(
        (a) =>
          `${a.state}: $${a.result.totalTax.toNumber().toLocaleString()} on aggregated taxable land value $${a.aggregatedValue.toNumber().toLocaleString()} (${a.parcelCount} parcel${a.parcelCount === 1 ? '' : 's'}).`,
      ),
    ];

    const out: ToolResult = {
      toolName: 'getLandTaxPosition',
      computedAt: new Date().toISOString(),
      numericFields,
      citations,
      uncomputed: result.uncomputed,
      narrativeText: narrativeParts.join(' '),
      raw: serializeDecimalsForJson(result),
    };
    return out;
  },
};
