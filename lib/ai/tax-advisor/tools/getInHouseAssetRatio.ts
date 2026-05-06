/**
 * Phase 41h.5 — Tool: getInHouseAssetRatio
 *
 * Wraps `lib/tax-engine/divisions/smsfTriumvirateClassifier.ts`,
 * extracting the in-house asset (Pt 8 SIS Act) portion of the
 * triumvirate result. SMSF trustees must keep in-house asset value
 * within 5% of the fund's total market value (s71-s85 SIS Act).
 *
 * Authority: SIS Act Pt 8 (s71-s85), s71(1)(b) (BRP exception).
 */

import {
  classifySmsfTriumvirate,
  type SmsfTriumvirateInput,
} from '@/lib/tax-engine/divisions/smsfTriumvirateClassifier';
import type {
  TaxAdvisorTool,
  ToolResult,
  NumericField,
  IdentifiedCitation,
} from '../types';

export const getInHouseAssetRatioTool: TaxAdvisorTool<SmsfTriumvirateInput> = {
  name: 'getInHouseAssetRatio',
  kind: 'FACT_LOOKUP',
  description:
    'Returns the SMSF\'s in-house asset (Pt 8 SIS Act) ratio + breach status. The 5% cap is the maximum in-house asset value relative to total fund market value. FACT_LOOKUP only — does not recommend whether to dispose of assets to remediate a breach.',
  inputSchema: {
    type: 'object',
    properties: {
      totalFundValue: {
        type: 'number',
        description: 'Total market value of the SMSF (denominator for the 5% cap).',
      },
      meetsSolePurposeTest: {
        type: 'boolean',
        description: 'Sole purpose test outcome (s62 SIS Act).',
      },
      fyIncome: {
        type: 'number',
        description: 'Fund income for the FY (used by the broader triumvirate calc; not by in-house ratio).',
      },
      hasNonArmsLengthIncome: {
        type: 'boolean',
        description: 'Whether NALI applies (used by NALI calc; not by in-house ratio).',
      },
      inHouseAssets: {
        type: 'array',
        description: 'Per-asset facts: id, market value, BRP exception flag.',
        items: { type: 'object' },
      },
    },
    required: [
      'totalFundValue',
      'meetsSolePurposeTest',
      'fyIncome',
      'hasNonArmsLengthIncome',
    ],
  },
  execute: (input) => {
    const result = classifySmsfTriumvirate(input);
    const ih = result.inHouseAsset;

    // Filter citations to in-house-asset-relevant ones (Pt 8 + BRP).
    const citations: IdentifiedCitation[] = result.citations
      .filter(
        (c) =>
          c.reference.includes('Pt 8') ||
          c.reference.toLowerCase().includes('in-house') ||
          c.reference.includes('BRP') ||
          c.reference.includes('s71') ||
          c.reference.includes('s82') ||
          c.reference.includes('s83') ||
          c.reference.includes('s84') ||
          c.reference.includes('s85'),
      )
      .map((c, i) => ({ ...c, id: `cit-${i + 1}` }));
    // Always include at least one citation — the triumvirate base
    // already cites Pt 8 SIS Act.
    if (citations.length === 0) {
      citations.push({
        id: 'cit-1',
        kind: 'SIS_ACT',
        reference: 'SIS Act Pt 8 (in-house asset)',
        lastReviewed: '2026-05-05',
      });
    }
    const allCitationIds = citations.map((c) => c.id);

    const numericFields: NumericField[] = [
      {
        path: 'smsf.inHouseAsset.value',
        value: ih.inHouseValue,
        unit: 'AUD',
        label: 'Total in-house asset value (BRP excluded)',
        citationIds: allCitationIds,
      },
      {
        path: 'smsf.inHouseAsset.fundValue',
        value: ih.fundValue,
        unit: 'AUD',
        label: 'Total SMSF fund market value',
        citationIds: allCitationIds,
      },
      {
        path: 'smsf.inHouseAsset.capValue',
        value: ih.capValue,
        unit: 'AUD',
        label: '5% cap value (fund value × 0.05)',
        citationIds: allCitationIds,
      },
      {
        path: 'smsf.inHouseAsset.breachAmount',
        value: ih.breachAmount,
        unit: 'AUD',
        label: 'Breach amount (in-house value − cap; floored at 0)',
        citationIds: allCitationIds,
      },
      {
        path: 'smsf.inHouseAsset.breachPercentage',
        value: ih.breachPercentage,
        unit: 'PERCENT',
        label: 'In-house ratio (in-house value / fund value)',
        citationIds: allCitationIds,
      },
    ];

    const narrativeText = [
      `In-house asset ratio: ${(ih.breachPercentage * 100).toFixed(2)}% of fund value [cit:cit-1].`,
      `Status: ${ih.status}.`,
      ih.status === 'BREACH'
        ? `Breach amount: $${ih.breachAmount.toLocaleString()} over the 5% cap. Trustee must prepare a written disposal plan per Pt 8 SIS Act.`
        : ih.status === 'NO_IN_HOUSE_ASSETS'
        ? 'No in-house assets reported.'
        : 'Within the 5% cap — compliant.',
    ].join(' ');

    const out: ToolResult = {
      toolName: 'getInHouseAssetRatio',
      computedAt: new Date().toISOString(),
      numericFields,
      citations,
      uncomputed: result.uncomputed.filter(
        (u) => u.id === 'UC-SMSF-IN-HOUSE-BREACH',
      ),
      narrativeText,
      raw: ih,
    };
    return out;
  },
};
