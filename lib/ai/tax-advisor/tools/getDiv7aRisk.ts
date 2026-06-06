/**
 * Phase 41h.5 — Tool: getDiv7aRisk
 *
 * Wraps `lib/tax-engine/divisions/div7aLoanClassifier.ts`. Returns
 * the Div 7A status of each Pty Ltd loan/advance + aggregate
 * deemed-dividend exposure.
 *
 * Authority: ITAA 1936 Div 7A (s109B-s109ZE), s109N (minimum yearly
 * repayment safe harbour), s109X (sub-trust UPE arrangements per
 * TR 2010/3, PCG 2017/13).
 */

import {
  classifyDiv7ALoansDecimal,
  type Div7ALoanInput,
} from '@/lib/tax-engine/divisions/div7aLoanClassifier';
import { serializeDecimalsForJson } from '@/lib/decimal';
import type {
  TaxAdvisorTool,
  ToolResult,
  NumericField,
  IdentifiedCitation,
} from '../types';

interface GetDiv7aRiskInput {
  loans: Div7ALoanInput[];
}

export const getDiv7aRiskTool: TaxAdvisorTool<GetDiv7aRiskInput> = {
  name: 'getDiv7aRisk',
  kind: 'FACT_LOOKUP',
  description:
    'Returns Div 7A classification for each private-company loan/advance to a shareholder/associate (COMPLIANT / SUB_TRUST_UPE / MRP_SHORTFALL / NO_AGREEMENT / DEEMED_DIVIDEND) + aggregate deemed-dividend exposure. FACT_LOOKUP only — does not recommend whether to refinance, restructure, or repay.',
  inputSchema: {
    type: 'object',
    properties: {
      loans: {
        type: 'array',
        description:
          'Per-loan facts: principal, term, security, repayments to date, agreement-on-file flag.',
        items: { type: 'object' },
      },
    },
    required: ['loans'],
  },
  execute: (input) => {
    // Q-DEC PR 3.D — Decimal engine.
    const result = classifyDiv7ALoansDecimal(input.loans);

    const citations: IdentifiedCitation[] = result.citations.map((c, i) => ({
      ...c,
      id: `cit-${i + 1}`,
    }));
    const allCitationIds = citations.map((c) => c.id);

    const numericFields: NumericField[] = [
      {
        path: 'div7a.totalDeemedDividend',
        value: result.totalDeemedDividend.toNumber(),
        unit: 'AUD',
        label: 'Aggregate deemed-dividend exposure across all loans',
        citationIds: allCitationIds,
      },
      {
        path: 'div7a.loanCount',
        value: result.classifications.length,
        unit: 'COUNT',
        label: 'Number of loans assessed',
        citationIds: [],
      },
      {
        path: 'div7a.compliantLoanCount',
        value: result.classifications.filter((c) => c.status === 'COMPLIANT').length,
        unit: 'COUNT',
        label: 'Loans with COMPLIANT status',
        citationIds: [],
      },
      {
        path: 'div7a.atRiskLoanCount',
        value: result.classifications.filter((c) => c.status !== 'COMPLIANT').length,
        unit: 'COUNT',
        label: 'Loans with non-COMPLIANT status (any breach)',
        citationIds: [],
      },
    ];

    // Per-loan deemed-dividend amounts.
    for (const c of result.classifications) {
      if (c.deemedDividendAmount && c.deemedDividendAmount.gt(0)) {
        numericFields.push({
          path: `div7a.loan.${c.loanId}.deemedDividend`,
          value: c.deemedDividendAmount.toNumber(),
          unit: 'AUD',
          label: `Deemed dividend for loan ${c.loanId} (${c.status})`,
          citationIds: allCitationIds,
        });
      }
    }

    const statusBreakdown: Record<string, number> = {};
    for (const c of result.classifications) {
      statusBreakdown[c.status] = (statusBreakdown[c.status] ?? 0) + 1;
    }
    const statusSummary = Object.entries(statusBreakdown)
      .map(([status, count]) => `${count}× ${status}`)
      .join(', ');

    const narrativeText = [
      `Div 7A classification across ${result.classifications.length} loan(s) [cit:cit-1].`,
      `Highest severity: ${result.highestSeverity}.`,
      statusSummary ? `Breakdown: ${statusSummary}.` : '',
      result.totalDeemedDividend.gt(0)
        ? `Aggregate deemed dividend: $${result.totalDeemedDividend.toNumber().toLocaleString()}.`
        : 'No deemed-dividend exposure — all loans currently compliant or in safe-harbour arrangements.',
    ]
      .filter(Boolean)
      .join(' ');

    const out: ToolResult = {
      toolName: 'getDiv7aRisk',
      computedAt: new Date().toISOString(),
      numericFields,
      citations,
      uncomputed: result.uncomputed ?? [],
      narrativeText,
      raw: serializeDecimalsForJson(result),
    };
    return out;
  },
};
