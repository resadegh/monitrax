/**
 * Phase 47 Stage E1 — per-entity report section tests.
 *
 * Pins the pure section builder: progressive disclosure (hidden below 2
 * entities), the position table + totals, the optional tax column, and
 * the deduped caveat-notes block (which surfaces AD-2 ownership flags).
 */

import { describe, it, expect } from 'vitest';
import { buildEntityBreakdownSections } from '@/lib/reports/generators/entityBreakdownSection';
import type { ReportContext, EntityReportData, TableSection, TextSection } from '@/lib/reports/types';

function entity(over: Partial<EntityReportData>): EntityReportData {
  return {
    entityId: 'e1',
    entityName: 'Reza',
    entityType: 'PERSONAL_NAME',
    entityTypeLabel: 'You',
    netWorth: 100_000,
    assets: 120_000,
    liabilities: 20_000,
    monthlyCashflow: 2_000,
    holdingsCount: 3,
    tax: null,
    ...over,
  };
}

function ctx(entityBreakdown: EntityReportData[] | undefined): ReportContext {
  return {
    userId: 'u1',
    periodStart: new Date(),
    periodEnd: new Date(),
    netWorth: 0,
    totalAssets: 0,
    totalLiabilities: 0,
    cashflowRunway: 0,
    healthScore: 0,
    counts: {
      properties: 0, loans: 0, accounts: 0, investments: 0,
      incomes: 0, expenses: 0, depreciationSchedules: 0,
    },
    entityBreakdown,
  };
}

describe('E1 — buildEntityBreakdownSections: progressive disclosure', () => {
  it('returns nothing when there is no breakdown', () => {
    expect(buildEntityBreakdownSections(ctx(undefined), 7)).toHaveLength(0);
  });
  it('returns nothing for a single-entity household (flat view restates totals)', () => {
    expect(buildEntityBreakdownSections(ctx([entity({})]), 7)).toHaveLength(0);
  });
});

describe('E1 — buildEntityBreakdownSections: position table', () => {
  const sections = buildEntityBreakdownSections(
    ctx([
      entity({ entityId: 'e1', entityName: 'Reza', netWorth: 100_000, monthlyCashflow: 2_000, holdingsCount: 3 }),
      entity({ entityId: 'e2', entityName: 'Renew Trust', entityType: 'DISCRETIONARY_TRUST', entityTypeLabel: 'Family trust', netWorth: 250_000, monthlyCashflow: 1_000, holdingsCount: 2 }),
    ]),
    7,
  );
  const table = sections[0] as TableSection;

  it('renders one table at the given start order', () => {
    expect(table.type).toBe('table');
    expect(table.id).toBe('entity-breakdown');
    expect(table.order).toBe(7);
    expect(table.rows).toHaveLength(2);
  });
  it('carries the warm type label per entity', () => {
    expect(table.rows[1].type).toBe('Family trust');
  });
  it('totals net worth + cashflow + holdings (additivity)', () => {
    expect(table.totals).toMatchObject({ netWorth: 350_000, cashflow: 3_000, holdings: 5 });
  });
  it('omits the tax column when no entity has a tax status', () => {
    expect(table.columns.some((c) => c.key === 'tax')).toBe(false);
    expect(sections).toHaveLength(1); // no notes block either
  });
});

describe('E1 — buildEntityBreakdownSections: tax column + caveat notes', () => {
  const sections = buildEntityBreakdownSections(
    ctx([
      entity({ entityId: 'e1', entityName: 'Reza', tax: { computed: true, caveats: [] } }),
      entity({
        entityId: 'e2',
        entityName: 'Renew Trust',
        entityTypeLabel: 'Family trust',
        tax: {
          computed: false,
          caveats: [
            { id: 'UC-OWNERSHIP-SPLIT', rationale: 'Co-owned assets were split per legal interest (TR 93/32).' },
            { id: 'UC-CGT-PARCEL-ID', rationale: 'Capital gains matched FIFO.' },
          ],
        },
      }),
      entity({
        entityId: 'e3',
        entityName: 'Sarah',
        entityTypeLabel: 'A person',
        tax: {
          computed: false,
          // duplicate id across entities — should dedupe in the notes block
          caveats: [{ id: 'UC-OWNERSHIP-SPLIT', rationale: 'Co-owned assets were split per legal interest (TR 93/32).' }],
        },
      }),
    ]),
    7,
  );
  const table = sections[0] as TableSection;
  const notes = sections[1] as TextSection;

  it('includes the tax column when any entity has a tax status', () => {
    expect(table.columns.some((c) => c.key === 'tax')).toBe(true);
    expect(table.rows[0].tax).toBe('Computed');
    expect(table.rows[1].tax).toBe('2 notes — see below');
    expect(table.rows[2].tax).toBe('1 note — see below');
  });
  it('emits a notes block with DISTINCT caveat rationales', () => {
    expect(notes.type).toBe('text');
    expect(notes.id).toBe('entity-tax-notes');
    expect(notes.order).toBe(8);
    // UC-OWNERSHIP-SPLIT appears on two entities but dedupes to one note.
    expect(notes.annotations).toHaveLength(2);
    expect(notes.annotations?.some((a) => a.includes('TR 93/32'))).toBe(true);
  });
});
