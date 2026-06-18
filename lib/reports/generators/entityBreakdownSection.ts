/**
 * Phase 47 Stage E1 — per-entity report section (Entity Ownership Fabric).
 *
 * Renders `ReportContext.entityBreakdown` as a report section pair: a
 * per-entity net-position table (name + type badge + net worth + monthly
 * cashflow + holdings + tax status) and, when any entity carries tax
 * caveats, a notes block listing them. Consumed by the financial-overview
 * and tax-time generators (E1 spec). Presentational only — every number
 * is SSOT (master snapshot `byEntity`); tax status is the engine's honest
 * caveat list, never a fabricated tax dollar.
 */

import type { ReportContext, AnyReportSection } from '../types';
import { createTableSection } from './index';

/**
 * Build the per-entity section(s). Returns an empty array when there is
 * no breakdown or only a single entity (a one-entity household is the
 * flat view — a per-entity table would just restate the totals; the
 * progressive-disclosure rule, §4A Stage A consequence 4 mirror).
 * `startOrder` positions the section after the report's existing ones.
 */
export function buildEntityBreakdownSections(
  context: ReportContext,
  startOrder: number,
): AnyReportSection[] {
  const entities = context.entityBreakdown;
  if (!entities || entities.length < 2) return [];

  const sections: AnyReportSection[] = [];

  // --- The per-entity position table -----------------------------------
  const includeTax = entities.some((e) => e.tax !== null);
  const columns = [
    { key: 'entity', label: 'Entity', format: 'text' as const, align: 'left' as const },
    { key: 'type', label: 'Type', format: 'text' as const, align: 'left' as const },
    { key: 'netWorth', label: 'Net Position', format: 'currency' as const, align: 'right' as const },
    { key: 'cashflow', label: 'Cashflow /mo', format: 'currency' as const, align: 'right' as const },
    { key: 'holdings', label: 'Holdings', format: 'number' as const, align: 'center' as const },
    ...(includeTax
      ? [{ key: 'tax', label: 'Tax position', format: 'text' as const, align: 'left' as const }]
      : []),
  ];

  const rows = entities.map((e) => ({
    entity: e.entityName,
    type: e.entityTypeLabel,
    netWorth: e.netWorth,
    cashflow: e.monthlyCashflow,
    holdings: e.holdingsCount,
    ...(includeTax ? { tax: taxStatusLabel(e.tax) } : {}),
  }));

  sections.push(
    createTableSection(
      'entity-breakdown',
      'Per-Entity Breakdown',
      startOrder,
      columns,
      rows,
      {
        netWorth: entities.reduce((sum, e) => sum + e.netWorth, 0),
        cashflow: entities.reduce((sum, e) => sum + e.monthlyCashflow, 0),
        holdings: entities.reduce((sum, e) => sum + e.holdingsCount, 0),
      },
    ),
  );

  // --- Caveat notes (distinct rationales across entities) --------------
  const caveats = new Map<string, string>();
  for (const e of entities) {
    for (const c of e.tax?.caveats ?? []) caveats.set(c.id, c.rationale);
  }
  if (caveats.size > 0) {
    sections.push({
      id: 'entity-tax-notes',
      title: 'Per-Entity Tax Notes',
      order: startOrder + 1,
      visible: true,
      type: 'text',
      content:
        'Some per-entity tax positions carry assumptions or could not be fully computed. ' +
        'These are listed below in plain English — they are never replaced with a guessed number. ' +
        'Confirm anything marked here with your registered tax agent.',
      annotations: [...caveats.values()],
    });
  }

  return sections;
}

function taxStatusLabel(tax: { computed: boolean; caveats: Array<unknown> } | null): string {
  if (!tax) return '—';
  if (tax.computed) return 'Computed';
  const n = tax.caveats.length;
  return n === 1 ? '1 note — see below' : `${n} notes — see below`;
}
