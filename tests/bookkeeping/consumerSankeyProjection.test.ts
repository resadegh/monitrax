/**
 * Phase 42 PR6.5 — Tests for the consumer Sankey projection.
 *
 * The projection adapts a MasterFinancialSnapshot into a
 * MoneyFlowResult with a single synthetic entity, suitable for the
 * Phase 41g `<MoneyFlowSankey />` to render. Per CLAUDE.md §12.3 —
 * pure data shaping; no aggregation, no math beyond
 * `surplus = totalIncome - totalOutflowCalculated`.
 */

import { describe, it, expect } from 'vitest';
import { projectSnapshotToMoneyFlow } from '../../components/bookkeeping/ConsumerMoneyFlowSankey';

describe('projectSnapshotToMoneyFlow', () => {
  function snap(over: Parameters<typeof projectSnapshotToMoneyFlow>[0] = {}) {
    return projectSnapshotToMoneyFlow({
      income: {
        annual: {
          primary: { netTotal: 100_000 },
          secondary: { netTotal: 5_000 },
          passive: { netTotal: 8_000 },
          all: { netTotal: 113_000 },
        },
      },
      expenses: {
        annual: {
          essential: { total: 40_000 },
          discretionary: { total: 15_000 },
          all: { total: 55_000 },
        },
      },
      cashflow: { annualLoanRepayments: 24_000 },
      tax: { estimatedTaxPayable: 22_000 },
      ...over,
    });
  }

  it('totalIncome echoes snapshot.income.annual.all.netTotal', () => {
    expect(snap().totalIncome).toBe(113_000);
  });

  it('totalOutflow = tax + essential + discretionary + loans + surplus', () => {
    const flow = snap();
    // 22000 + 40000 + 15000 + 24000 = 101000 → surplus = 113000-101000 = 12000
    expect(flow.totalOutflow).toBe(22_000 + 40_000 + 15_000 + 24_000 + 12_000);
    // Conservation: should equal totalIncome by construction
    expect(flow.totalOutflow).toBe(flow.totalIncome);
  });

  it('surplus is non-negative even when expenses exceed income', () => {
    const flow = projectSnapshotToMoneyFlow({
      income: { annual: { all: { netTotal: 30_000 }, primary: { netTotal: 30_000 } } },
      expenses: { annual: { essential: { total: 50_000 } } },
      tax: { estimatedTaxPayable: 0 },
      cashflow: { annualLoanRepayments: 0 },
    });
    const surplus = flow.entities[0].outflows.Surplus;
    expect(surplus).toBe(0);
  });

  it('produces exactly one synthetic entity labelled "You"', () => {
    const flow = snap();
    expect(flow.entities).toHaveLength(1);
    expect(flow.entities[0].name).toBe('You');
    expect(flow.entities[0].id).toBe('consumer');
  });

  it('filters zero-amount income sources from the legend', () => {
    const flow = snap();
    // Rental is always 0 in the consumer projection
    expect(flow.incomeSources.some((s) => s.label === 'Rental')).toBe(false);
    // Salary + Investment + Other present
    expect(flow.incomeSources.map((s) => s.label).sort()).toEqual(
      ['Investment', 'Other', 'Salary'].sort()
    );
  });

  it('emits an edge per income source → entity', () => {
    const flow = snap();
    const incomeEdges = flow.edges.filter((e) => e.target === 'ent:consumer');
    expect(incomeEdges.length).toBe(flow.incomeSources.length);
    for (const edge of incomeEdges) {
      expect(edge.source.startsWith('src:')).toBe(true);
    }
  });

  it('emits an edge per outflow node from the entity', () => {
    const flow = snap();
    const outEdges = flow.edges.filter((e) => e.source === 'ent:consumer');
    expect(outEdges.length).toBe(flow.outflows.length);
    for (const edge of outEdges) {
      expect(edge.target.startsWith('out:')).toBe(true);
    }
  });

  it('marks isEmpty when totalIncome is 0', () => {
    const flow = projectSnapshotToMoneyFlow({});
    expect(flow.isEmpty).toBe(true);
  });

  it('marks isEmpty when there is income but zero expenses + zero loans', () => {
    const flow = projectSnapshotToMoneyFlow({
      income: { annual: { all: { netTotal: 100_000 } } },
    });
    expect(flow.isEmpty).toBe(true);
  });

  it('renders a complete graph for a typical user', () => {
    const flow = snap();
    expect(flow.isEmpty).toBe(false);
    expect(flow.entities).toHaveLength(1);
    expect(flow.incomeSources.length).toBeGreaterThan(0);
    expect(flow.outflows.length).toBeGreaterThan(0);
    expect(flow.edges.length).toBeGreaterThan(0);
  });
});
