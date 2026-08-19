/**
 * M3 PR-1 Ring-0 — the D-12 pack's property-scoped reconciliation
 * (MON-169: transfers/loan repayments out of the totals; MON-170: nothing
 * silent — every exclusion counted, the identity asserted).
 *
 * Worked example (§19.2), hand-computed:
 *   t1 IN  $500  P1, category "Rental income" (mapped)   → included, labelled
 *   t2 OUT $200  P1, category "Repairs" (no ATO mapping) → included, noAtoMapping
 *   t3 OUT $150  P1, no category                         → included, noCategory
 *   t4 OUT $1000 isTransfer                              → excluded.transfers
 *   t5 OUT $300  loanId L1                               → excluded.loanRepayments
 *   t6 IN  $2000 no propertyId (salary)                  → excluded.notPropertyScoped
 *   t7 OUT $50   isTransfer AND loanId                   → transfers (precedence)
 *
 *   totals: incomeGross 500 · expenseTotal 350 · included 3
 *   identity: 3 + 2 + 1 + 1 = 7 ✓
 *
 * Coverage: proves the classifier, the identity, the label-coverage counters
 * and the per-property rollup on fixtures. Does NOT prove the rendered
 * XLSX/PDF or live-data behaviour — that is the RING3_M3_PACK_FIX.md run.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => {
  const mock = {
    unifiedTransaction: { findMany: vi.fn() },
    property: { findMany: vi.fn() },
    canonicalCategoryRegistry: { findMany: vi.fn() },
  };
  return { prisma: mock, default: mock };
});
vi.mock('@/lib/bookkeeping/taxCategoryMapping', () => ({
  seedSystemMappings: vi.fn(async () => {}),
  getMappingsForCategory: vi.fn(async (_userId: string, categoryId: string) =>
    categoryId === 'cat-rental'
      ? [{ atoLabel: 'Rent income', schedule: null, lineItem: null, notes: null }]
      : []
  ),
}));

import { buildTaxPackSummary, buildAuFyWindow } from '@/lib/bookkeeping/taxPack/summary';
import prismaMocked from '@/lib/db';

const mockPrisma = prismaMocked as unknown as {
  unifiedTransaction: { findMany: ReturnType<typeof vi.fn> };
  property: { findMany: ReturnType<typeof vi.fn> };
  canonicalCategoryRegistry: { findMany: ReturnType<typeof vi.fn> };
};

const tx = (over: Record<string, unknown>) => ({
  id: Math.random().toString(36).slice(2),
  userId: 'u1',
  date: new Date('2025-08-01T00:00:00Z'),
  amount: 0,
  direction: 'OUT',
  categoryLevel1: null,
  categoryLevel2: null,
  subcategory: null,
  propertyId: null,
  loanId: null,
  incomeId: null,
  expenseId: null,
  isTransfer: false,
  source: 'CSV',
  ...over,
});

const FIXTURE = [
  tx({ direction: 'IN', amount: 500, propertyId: 'P1', categoryLevel1: 'Rental income' }),
  tx({ amount: -200, propertyId: 'P1', categoryLevel1: 'Repairs' }),
  tx({ amount: -150, propertyId: 'P1' }),
  tx({ amount: -1000, isTransfer: true }),
  tx({ amount: -300, loanId: 'L1' }),
  tx({ direction: 'IN', amount: 2000 }),
  tx({ amount: -50, isTransfer: true, loanId: 'L1' }),
];

beforeEach(() => {
  mockPrisma.unifiedTransaction.findMany.mockResolvedValue(FIXTURE);
  mockPrisma.property.findMany.mockResolvedValue([{ id: 'P1', name: 'Cremorne' }]);
  mockPrisma.canonicalCategoryRegistry.findMany.mockResolvedValue([
    { id: 'cat-rental', level1: 'Rental income', level2: null, subcategory: null },
    { id: 'cat-repairs', level1: 'Repairs', level2: null, subcategory: null },
  ]);
});

describe('MON-169/170 — pack reconciliation', () => {
  it('property-scopes the totals: transfers, loan repayments and non-property rows are OUT', async () => {
    const s = await buildTaxPackSummary('u1', buildAuFyWindow('FY2025-26'));
    expect(s.totals.incomeGross).toBe(500);
    expect(s.totals.expenseTotal).toBe(350);
    expect(s.totals.netCashflow).toBe(150);
    expect(s.totals.transactionCount).toBe(3);
  });

  it('counts every exclusion with dollars and holds the identity (MON-170)', async () => {
    const s = await buildTaxPackSummary('u1', buildAuFyWindow('FY2025-26'));
    const r = s.reconciliation;
    expect(r.transactionsTotal).toBe(7);
    expect(r.included).toEqual({ count: 3, amount: 850 });
    expect(r.excluded.transfers).toEqual({ count: 2, amount: 1050 });
    expect(r.excluded.loanRepayments).toEqual({ count: 1, amount: 300 });
    expect(r.excluded.notPropertyScoped).toEqual({ count: 1, amount: 2000 });
    expect(
      r.included.count +
        r.excluded.transfers.count +
        r.excluded.loanRepayments.count +
        r.excluded.notPropertyScoped.count
    ).toBe(r.transactionsTotal);
  });

  it('a transfer that is also loan-linked lands in transfers ONLY (single-class precedence)', async () => {
    const s = await buildTaxPackSummary('u1', buildAuFyWindow('FY2025-26'));
    expect(s.reconciliation.excluded.transfers.count).toBe(2); // t4 + t7
    expect(s.reconciliation.excluded.loanRepayments.count).toBe(1); // t5 only
  });

  it('labelling partitions the included rows: labelled + noCategory + noAtoMapping', async () => {
    const s = await buildTaxPackSummary('u1', buildAuFyWindow('FY2025-26'));
    const c = s.reconciliation.atoLabelling;
    expect(c.labelled).toEqual({ count: 1, amount: 500 });
    expect(c.noCategory).toEqual({ count: 1, amount: 150 });
    expect(c.noAtoMapping).toEqual({ count: 1, amount: 200 });
    expect(s.atoLabels).toHaveLength(1);
    expect(s.atoLabels[0]).toMatchObject({ atoLabel: 'Rent income', totalAmount: 500 });
  });

  it('per-property P&L covers included rows only, with Uncategorised bucketed (never dropped)', async () => {
    const s = await buildTaxPackSummary('u1', buildAuFyWindow('FY2025-26'));
    expect(s.perProperty).toHaveLength(1);
    const p = s.perProperty[0];
    expect(p.propertyName).toBe('Cremorne');
    expect(p.income.total).toBe(500);
    expect(p.expenses.total).toBe(350);
    expect(p.expenses.byCategory.map((c) => c.category).sort()).toEqual([
      'Repairs',
      'Uncategorised',
    ]);
    expect(p.transactionCount).toBe(3);
  });
});
