/**
 * Phase 41h.0 — Tool: getContributionCapHeadroom
 *
 * Wraps `lib/tax-engine/super/capTracker.ts`. Returns the user's
 * concessional + non-concessional contribution cap headroom for a
 * given financial year.
 *
 * Authority: ITAA 1997 s291-20 (concessional cap), s292-85
 * (non-concessional cap + bring-forward), s291-20(3) (carry-forward
 * for TSB < $500k).
 */

import { trackContributionCapsDecimal, type CapTrackingInputDecimal } from '@/lib/tax-engine/super/capTracker';
import { getTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';
import { serializeDecimalsForJson } from '@/lib/decimal';
import type { TaxAdvisorTool, ToolResult, NumericField, IdentifiedCitation } from '../types';

interface GetContributionCapHeadroomInput {
  financialYear: string;
  concessionalYTD: number;
  nonConcessionalYTD: number;
  totalSuperBalance?: number;
  carryForwardAmounts?: Array<{ financialYear: string; unusedAmount: number }>;
}

export const getContributionCapHeadroomTool: TaxAdvisorTool<GetContributionCapHeadroomInput> = {
  name: 'getContributionCapHeadroom',
  kind: 'FACT_LOOKUP',
  description:
    'Returns the user\'s concessional + non-concessional super contribution cap headroom for the given financial year. FACT_LOOKUP only — does not recommend whether to contribute.',
  inputSchema: {
    type: 'object',
    properties: {
      financialYear: {
        type: 'string',
        description: 'Financial year in "YYYY-YY" format, e.g. "2024-25".',
      },
      concessionalYTD: {
        type: 'number',
        description: 'Concessional contributions made year-to-date (AUD).',
      },
      nonConcessionalYTD: {
        type: 'number',
        description: 'Non-concessional contributions made year-to-date (AUD).',
      },
      totalSuperBalance: {
        type: 'number',
        description: 'Total super balance at 30 June of previous FY (AUD). Affects bring-forward + carry-forward eligibility.',
      },
    },
    required: ['financialYear', 'concessionalYTD', 'nonConcessionalYTD'],
  },
  execute: (input) => {
    // Q-DEC PR 3.D — Decimal engine; per-field `.toNumber()` at the
    // numericFields boundary preserves the AI-facing `number` shape.
    const calcInput: CapTrackingInputDecimal = {
      concessionalYTD: input.concessionalYTD,
      nonConcessionalYTD: input.nonConcessionalYTD,
      totalSuperBalance: input.totalSuperBalance,
      carryForwardAmounts: input.carryForwardAmounts,
    };
    const result = trackContributionCapsDecimal(calcInput, getTaxYearConfig(input.financialYear));

    const citations: IdentifiedCitation[] = [
      {
        id: 'cit-1',
        kind: 'ITAA_1997',
        reference: 'ITAA 1997 s291-20 (concessional contributions cap)',
        lastReviewed: '2026-05-05',
      },
      {
        id: 'cit-2',
        kind: 'ITAA_1997',
        reference: 'ITAA 1997 s291-20(3) (carry-forward — TSB < $500k threshold)',
        lastReviewed: '2026-05-05',
      },
      {
        id: 'cit-3',
        kind: 'ITAA_1997',
        reference: 'ITAA 1997 s292-85 (non-concessional contributions cap)',
        lastReviewed: '2026-05-05',
      },
      {
        id: 'cit-4',
        kind: 'ITAA_1997',
        reference: 'ITAA 1997 s292-85(2) (bring-forward — non-concessional)',
        lastReviewed: '2026-05-05',
      },
    ];

    const numericFields: NumericField[] = [
      {
        path: 'contributionCaps.concessional.cap',
        value: result.concessional.cap.toNumber(),
        unit: 'AUD',
        label: `Concessional cap for ${input.financialYear}`,
        citationIds: ['cit-1'],
      },
      {
        path: 'contributionCaps.concessional.used',
        value: result.concessional.used.toNumber(),
        unit: 'AUD',
        label: 'Concessional contributions made YTD',
        citationIds: ['cit-1'],
      },
      {
        path: 'contributionCaps.concessional.remaining',
        value: result.concessional.remaining.toNumber(),
        unit: 'AUD',
        label: 'Concessional cap headroom remaining',
        citationIds: ['cit-1'],
      },
      {
        path: 'contributionCaps.concessional.carryForwardAvailable',
        value: result.concessional.carryForwardAvailable.toNumber(),
        unit: 'AUD',
        label: 'Carry-forward unused cap available (s291-20(3))',
        citationIds: ['cit-2'],
      },
      {
        path: 'contributionCaps.concessional.totalAvailable',
        value: result.concessional.totalAvailable.toNumber(),
        unit: 'AUD',
        label: 'Total concessional headroom (current cap + carry-forward)',
        citationIds: ['cit-1', 'cit-2'],
      },
      {
        path: 'contributionCaps.nonConcessional.cap',
        value: result.nonConcessional.cap.toNumber(),
        unit: 'AUD',
        label: `Non-concessional cap for ${input.financialYear}`,
        citationIds: ['cit-3'],
      },
      {
        path: 'contributionCaps.nonConcessional.used',
        value: result.nonConcessional.used.toNumber(),
        unit: 'AUD',
        label: 'Non-concessional contributions made YTD',
        citationIds: ['cit-3'],
      },
      {
        path: 'contributionCaps.nonConcessional.remaining',
        value: result.nonConcessional.remaining.toNumber(),
        unit: 'AUD',
        label: 'Non-concessional cap headroom remaining',
        citationIds: ['cit-3'],
      },
      {
        path: 'contributionCaps.nonConcessional.bringForwardCap',
        value: result.nonConcessional.bringForwardCap.toNumber(),
        unit: 'AUD',
        label: 'Non-concessional bring-forward cap (3yr) if eligible',
        citationIds: ['cit-4'],
      },
      {
        path: 'contributionCaps.excessContributionsTax',
        value: result.excessContributionsTax.toNumber(),
        unit: 'AUD',
        label: 'Excess contributions tax (if cap exceeded)',
        citationIds: ['cit-1', 'cit-3'],
      },
    ];

    const narrativeText = [
      `Concessional cap for ${input.financialYear}: $${result.concessional.cap.toNumber().toLocaleString()} (s291-20 [cit:cit-1]).`,
      `Used YTD: $${result.concessional.used.toNumber().toLocaleString()}. Remaining: $${result.concessional.remaining.toNumber().toLocaleString()}.`,
      result.concessional.carryForwardAvailable.gt(0)
        ? `Carry-forward available (TSB < $500k): $${result.concessional.carryForwardAvailable.toNumber().toLocaleString()} (s291-20(3) [cit:cit-2]).`
        : '',
      `Non-concessional cap: $${result.nonConcessional.cap.toNumber().toLocaleString()} (s292-85 [cit:cit-3]). Used YTD: $${result.nonConcessional.used.toNumber().toLocaleString()}.`,
      result.nonConcessional.bringForwardAvailable
        ? `Bring-forward eligible (s292-85(2) [cit:cit-4]) — 3yr bring-forward cap: $${result.nonConcessional.bringForwardCap.toNumber().toLocaleString()}.`
        : '',
    ]
      .filter(Boolean)
      .join(' ');

    const out: ToolResult = {
      toolName: 'getContributionCapHeadroom',
      computedAt: new Date().toISOString(),
      numericFields,
      citations,
      uncomputed: [], // capTracker is a deterministic FY-indexed lookup — no UC flags
      narrativeText,
      raw: serializeDecimalsForJson(result),
    };
    return out;
  },
};
