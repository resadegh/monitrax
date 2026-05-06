/**
 * Phase 41h.0 — Tool: getEntityTaxPosition
 *
 * Wraps `lib/tax-engine/entity/entityTaxRouter.ts` →
 * `calculateEntityTaxPosition()`. Returns the per-entity income
 * tax + (optional) CGT position with full citation chain.
 *
 * Authority: ITAA 1997 s4-10 (income tax assessable amount), Div 1-6
 * (deductions), Div 115 (CGT discount via the entity router's
 * dispatch), Div 6/6E (trust distributions), s291-20 (super caps for
 * SMSF entities). Citations come from the calc engine.
 */

import {
  calculateEntityTaxPosition,
} from '@/lib/tax-engine/entity/entityTaxRouter';
import type { EntityTaxFacts } from '@/lib/tax-engine/types';
import type { TaxAdvisorTool, ToolResult, NumericField, IdentifiedCitation } from '../types';

export const getEntityTaxPositionTool: TaxAdvisorTool<EntityTaxFacts> = {
  name: 'getEntityTaxPosition',
  kind: 'FACT_LOOKUP',
  description:
    'Returns the income tax + CGT position for a single entity (PERSONAL_NAME / SOLE_TRADER / COMPANY / DISCRETIONARY_TRUST / UNIT_TRUST / SMSF / PARTNERSHIP) for the given financial year. FACT_LOOKUP only — does not recommend tax-saving actions.',
  inputSchema: {
    type: 'object',
    properties: {
      entityId: {
        type: 'string',
        description: 'Stable id of the entity to assess.',
      },
      entityType: {
        type: 'string',
        description: 'Legal entity type.',
        enum: [
          'PERSONAL_NAME',
          'SOLE_TRADER',
          'PARTNERSHIP',
          'COMPANY',
          'DISCRETIONARY_TRUST',
          'UNIT_TRUST',
          'SMSF',
        ],
      },
      financialYear: {
        type: 'string',
        description: 'Financial year in "YYYY-YY" format.',
      },
    },
    required: ['entityId', 'entityType', 'financialYear'],
  },
  execute: (input) => {
    const position = calculateEntityTaxPosition(input);

    // Promote calc-engine citations to identified citations.
    const citations: IdentifiedCitation[] = position.citations.map((c, i) => ({
      ...c,
      id: `cit-${i + 1}`,
    }));
    const allCitationIds = citations.map((c) => c.id);

    // Extract canonical numeric fields from `position.result`. The
    // result shape varies by entity type; PERSONAL_NAME / SOLE_TRADER
    // returns `{ tax: { assessableIncome, taxableIncome, netTax }, paygWithheld, estimatedRefund, ... }`.
    // For other entity types, `result` may be `null` (UNCOMPUTED) — in
    // that case we surface only the UNCOMPUTED flags + 0 numericFields.
    const numericFields: NumericField[] = [];
    const r = position.result as
      | {
          tax?: { assessableIncome?: number; taxableIncome?: number; netTax?: number };
          paygWithheld?: number;
          estimatedRefund?: number;
        }
      | null
      | undefined;

    if (r && typeof r === 'object') {
      if (typeof r.tax?.assessableIncome === 'number') {
        numericFields.push({
          path: `entity.${input.entityId}.assessableIncome`,
          value: r.tax.assessableIncome,
          unit: 'AUD',
          label: `${input.entityType} assessable income for ${input.fy.label}`,
          citationIds: allCitationIds,
        });
      }
      if (typeof r.tax?.taxableIncome === 'number') {
        numericFields.push({
          path: `entity.${input.entityId}.taxableIncome`,
          value: r.tax.taxableIncome,
          unit: 'AUD',
          label: `${input.entityType} taxable income for ${input.fy.label}`,
          citationIds: allCitationIds,
        });
      }
      if (typeof r.tax?.netTax === 'number') {
        numericFields.push({
          path: `entity.${input.entityId}.netTax`,
          value: r.tax.netTax,
          unit: 'AUD',
          label: `${input.entityType} net tax payable`,
          citationIds: allCitationIds,
        });
      }
      if (typeof r.paygWithheld === 'number') {
        numericFields.push({
          path: `entity.${input.entityId}.paygWithheld`,
          value: r.paygWithheld,
          unit: 'AUD',
          label: 'PAYG withheld YTD',
          citationIds: allCitationIds,
        });
      }
      if (typeof r.estimatedRefund === 'number') {
        numericFields.push({
          path: `entity.${input.entityId}.estimatedRefund`,
          value: r.estimatedRefund,
          unit: 'AUD',
          label: 'Estimated refund (or balance owing)',
          citationIds: allCitationIds,
        });
      }
    }

    const cgt = position.cgtResult as
      | { netCapitalGain?: number; discountAmount?: number }
      | null
      | undefined;
    if (cgt && typeof cgt === 'object') {
      if (typeof cgt.netCapitalGain === 'number') {
        numericFields.push({
          path: `entity.${input.entityId}.netCapitalGain`,
          value: cgt.netCapitalGain,
          unit: 'AUD',
          label: `${input.entityType} net capital gain after netting + discount`,
          citationIds: citations.filter((c) => c.reference.includes('Div 115') || c.reference.includes('s115') || c.reference.includes('Div 102')).map((c) => c.id),
        });
      }
      if (typeof cgt.discountAmount === 'number') {
        numericFields.push({
          path: `entity.${input.entityId}.cgtDiscountAmount`,
          value: cgt.discountAmount,
          unit: 'AUD',
          label: 'CGT discount applied (Div 115)',
          citationIds: citations.filter((c) => c.reference.includes('Div 115') || c.reference.includes('s115')).map((c) => c.id),
        });
      }
    }

    const narrativeParts: string[] = [];
    if (numericFields.length > 0) {
      narrativeParts.push(
        `${input.entityType} (${input.entityId}) tax position for ${input.fy.label}.`,
      );
      const ti = numericFields.find((n) => n.path.endsWith('.taxableIncome'));
      const nt = numericFields.find((n) => n.path.endsWith('.netTax'));
      if (ti && nt) {
        narrativeParts.push(
          `Taxable income $${ti.value.toLocaleString()}, net tax $${nt.value.toLocaleString()} [cit:cit-1].`,
        );
      }
    } else {
      narrativeParts.push(
        `${input.entityType} (${input.entityId}) tax position is UNCOMPUTED for ${input.fy.label} — see uncomputed flags.`,
      );
    }

    const out: ToolResult = {
      toolName: 'getEntityTaxPosition',
      computedAt: new Date().toISOString(),
      numericFields,
      citations,
      uncomputed: position.uncomputed,
      narrativeText: narrativeParts.join(' '),
      raw: position,
    };
    return out;
  },
};
