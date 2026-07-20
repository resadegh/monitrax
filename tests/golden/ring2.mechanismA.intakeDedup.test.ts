/**
 * Mechanism A Ratchet (MON-084/085/074/076 — the Calc-SSOT Wall intake-dedup
 * keystone). Runs the REAL link route's `create` action end-to-end and locks:
 *
 *   1. THE INGEUS CLASS (MON-084/074): linking a salary deposit while a
 *      same-signature SALARY row exists UPDATES that ONE row (amount ←
 *      transaction, prior amount preserved as budgetedAmount, lastReconciled
 *      stamped) — the row count does NOT grow. Before this, only
 *      RENT/RENTAL+propertyId had a reuse guard; everything else minted
 *      ("Ingeus Australia" ×3, one job).
 *   2. A GENUINELY NEW SOURCE still mints exactly one row (no over-blocking).
 *   3. THE OVER-MERGE GUARD (the Reza correction): the same merchant on two
 *      DIFFERENT scopes (QBE insurance on property A vs property B) never
 *      converges — two distinct real streams stay two rows.
 *   4. THE BATTERY CLASS (MON-085/MON-037 RC-B): a scopeless expense link
 *      converges into the SCOPED row of the same real cost (cross-scope with
 *      one side scopeless) via the update action — no third battery row.
 *
 * The DB mock here is deliberately LOCAL and mutable (the shared golden
 * factory is read-only by design — "no hidden mini-ORM"): a small, visible
 * scalar-where matcher + in-memory create/update, adequate and honest for
 * exercising this route's write path.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// In-test mutable DB
// ---------------------------------------------------------------------------

type Row = Record<string, any>;

const USER_ID = 'golden-user';
let db: Record<string, Row[]>;
let genSeq = 0;

function freshDb(): Record<string, Row[]> {
  return {
    legalEntity: [{ id: 'le-1', userId: USER_ID, type: 'PERSONAL_NAME', createdAt: new Date('2026-01-01') }],
    income: [
      {
        id: 'i-ingeus', userId: USER_ID, ownerEntityId: 'le-1',
        name: 'Ingeus Australia', type: 'SALARY', amount: 8_500,
        budgetedAmount: null, lastReconciled: null,
        frequency: 'MONTHLY', isRecurring: true, isTaxable: true,
        propertyId: null, investmentAccountId: null,
        createdAt: new Date('2026-02-01'),
      },
      {
        // MON-091 (the Thornland class): a rental stream born MONTHLY while
        // its real payments arrive fortnightly. The scope-singleton reuse
        // must honour an EXPLICITLY confirmed cadence — and never touch the
        // stored one without it.
        id: 'i-rent-lot1', userId: USER_ID, ownerEntityId: 'le-1',
        name: 'Thornland Rent Payment', type: 'RENT', amount: 1_195,
        budgetedAmount: null, lastReconciled: null,
        frequency: 'MONTHLY', isRecurring: true, isTaxable: true,
        propertyId: 'p-lot1', investmentAccountId: null, rentalMode: 'DIRECT',
        createdAt: new Date('2026-02-01'),
      },
    ],
    agentDisbursementRule: [],
    expense: [
      {
        // Distinct real stream: insurance ON property A.
        id: 'e-qbe-a', userId: USER_ID, ownerEntityId: 'le-1',
        name: 'QBE Insurance', vendorName: null, category: 'INSURANCE',
        amount: 1_200, budgetedAmount: null, lastReconciled: null,
        frequency: 'ANNUAL', isRecurring: true,
        propertyId: 'p-a', loanId: null, assetId: null, investmentAccountId: null,
        createdAt: new Date('2026-02-01'),
      },
      {
        // The battery declared on HOME (scoped) — the canonical row the
        // scopeless actual must converge INTO.
        id: 'e-batt-home', userId: USER_ID, ownerEntityId: 'le-1',
        name: 'Battery System', vendorName: null, category: 'MAINTENANCE',
        amount: 11_385, budgetedAmount: null, lastReconciled: null,
        frequency: 'MONTHLY', isRecurring: false,
        propertyId: 'p-home', loanId: null, assetId: null, investmentAccountId: null,
        createdAt: new Date('2026-02-01'),
      },
    ],
    unifiedTransaction: [
      { id: 't-sal', userId: USER_ID, amount: 5_547, date: new Date('2026-07-01'), direction: 'IN', merchantStandardised: 'INGEUS AUSTRALIA PTY LTD', description: 'Salary', incomeId: null, expenseId: null, loanId: null },
      { id: 't-hip', userId: USER_ID, amount: 75, date: new Date('2026-07-02'), direction: 'IN', merchantStandardised: 'Hipcamp', description: 'Hipcamp payout', incomeId: null, expenseId: null, loanId: null },
      { id: 't-qbe-b', userId: USER_ID, amount: 1_210, date: new Date('2026-07-03'), direction: 'OUT', merchantStandardised: 'QBE Insurance', description: 'Insurance premium', incomeId: null, expenseId: null, loanId: null },
      { id: 't-batt', userId: USER_ID, amount: 11_385, date: new Date('2026-07-04'), direction: 'OUT', merchantStandardised: 'Battery', description: 'Battery invoice', incomeId: null, expenseId: null, loanId: null },
      { id: 't-rent-1', userId: USER_ID, amount: 1_195, date: new Date('2026-06-16'), direction: 'IN', merchantStandardised: 'Cienna Pm Trust', description: 'Rent payment', incomeId: null, expenseId: null, loanId: null },
      { id: 't-rent-2', userId: USER_ID, amount: 1_655, date: new Date('2026-06-01'), direction: 'IN', merchantStandardised: 'Cienna Pm Trust', description: 'Rent payment', incomeId: null, expenseId: null, loanId: null },
    ],
  };
}

/** Scalar where matcher: equality, null, `{ in: [...] }`. Visible + tiny. */
function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([k, cond]) => {
    if (cond && typeof cond === 'object' && Array.isArray((cond as Row).in)) {
      return (cond as Row).in.includes(row[k]);
    }
    return row[k] === (cond ?? null) || (cond === undefined ? true : row[k] === cond);
  });
}

function model(name: string) {
  const rows = () => {
    if (!(name in db)) throw new Error(`[MechA golden] prisma.${name} not served — extend the in-test mock.`);
    return db[name];
  };
  return {
    findFirst: async ({ where, orderBy: _o }: Row = {}) => structuredClone(rows().find((r) => matches(r, where)) ?? null),
    findUnique: async ({ where }: Row) => structuredClone(rows().find((r) => matches(r, where)) ?? null),
    findMany: async ({ where }: Row = {}) => structuredClone(rows().filter((r) => matches(r, where))),
    update: async ({ where, data, include: _i }: Row) => {
      const r = rows().find((x) => matches(x, where));
      if (!r) throw new Error(`[MechA golden] ${name}.update matched no row for ${JSON.stringify(where)}`);
      Object.assign(r, data);
      return structuredClone(r);
    },
    updateMany: async ({ where, data }: Row) => {
      const hit = rows().filter((r) => matches(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    },
    create: async ({ data }: Row) => {
      const r = { id: `gen-${++genSeq}`, ...structuredClone(data) };
      rows().push(r);
      return structuredClone(r);
    },
  };
}

vi.mock('@/lib/db', () => {
  const proxy = new Proxy({}, { get: (_t, m: string | symbol) => (typeof m === 'symbol' || m === 'then' ? undefined : model(String(m))) });
  return { default: proxy, prisma: proxy };
});

vi.mock('@/lib/auth/guards', () => ({
  withPermission: (_permission: string, handler: (req: unknown, auth: unknown, ctx: unknown) => Promise<Response>) =>
    (request: unknown, ctx: unknown) =>
      handler(request, { userId: USER_ID, email: 'golden@household.test', role: 'USER', emailVerified: true }, ctx),
}));

vi.mock('@/lib/security/auditLog', () => ({ createAuditLog: async () => undefined }));

import { NextRequest } from 'next/server';
import { POST as linkPOST } from '@/app/api/transactions/[id]/link/route';

async function callCreate(transactionId: string, body: Row) {
  const req = new NextRequest(`http://localhost/api/transactions/${transactionId}/link`, {
    method: 'POST',
    body: JSON.stringify({ action: 'create', ...body }),
  });
  const res = await (linkPOST as unknown as (r: NextRequest, c: unknown) => Promise<Response>)(
    req,
    { params: Promise.resolve({ id: transactionId }) },
  );
  return { status: res.status, json: await res.json() };
}

beforeEach(() => {
  db = freshDb();
  genSeq = 0;
});

describe('Mechanism A — the intake-dedup keystone (real link route, create action)', () => {
  it('the Ingeus class: a salary link UPDATES the one signature row — no mint', async () => {
    const { status, json } = await callCreate('t-sal', {
      type: 'income', category: 'SALARY', frequency: 'MONTHLY', isRecurring: true,
    });
    expect(status).toBe(200);
    expect(json.success).toBe(true);
    // ONE salary row, updated in place with the :831 update-template semantics.
    expect(db.income.filter((r) => r.type === 'SALARY')).toHaveLength(1);
    const row = db.income.find((r) => r.id === 'i-ingeus')!;
    expect(row.id).toBe('i-ingeus');
    expect(row.amount).toBe(5_547);
    expect(row.budgetedAmount).toBe(8_500); // prior declared amount preserved
    expect(row.lastReconciled).toBeInstanceOf(Date);
    // The transaction is linked to the canonical row.
    expect(db.unifiedTransaction.find((t) => t.id === 't-sal')!.incomeId).toBe('i-ingeus');
    expect(json.created.id).toBe('i-ingeus');
  });

  it('a genuinely new source still mints exactly one row (no over-blocking)', async () => {
    const { status } = await callCreate('t-hip', {
      type: 'income', category: 'OTHER', frequency: 'MONTHLY', isRecurring: false,
    });
    expect(status).toBe(200);
    expect(db.income).toHaveLength(3); // Ingeus + Lot-1 rental + the new Hipcamp row
    const hip = db.income.find((r) => r.name === 'Hipcamp')!;
    expect(hip.name).toBe('Hipcamp');
    // The Ingeus row is untouched.
    expect(db.income.find((r) => r.id === 'i-ingeus')!.amount).toBe(8_500);
  });

  it('OVER-MERGE GUARD: same merchant on TWO different scopes stays two rows (QBE A vs B)', async () => {
    const { status } = await callCreate('t-qbe-b', {
      type: 'expense', category: 'INSURANCE', frequency: 'ANNUAL',
      sourceType: 'PROPERTY', propertyId: 'p-b', name: 'QBE Insurance',
    });
    expect(status).toBe(200);
    const qbeRows = db.expense.filter((e) => e.name.includes('QBE'));
    expect(qbeRows).toHaveLength(2); // A's row + B's NEW row — never merged
    const a = db.expense.find((e) => e.id === 'e-qbe-a')!;
    expect(a.amount).toBe(1_200); // untouched
    expect(a.propertyId).toBe('p-a');
  });

  it('MON-091 (the Thornland class): rental reuse honours an EXPLICITLY confirmed cadence', async () => {
    const { status } = await callCreate('t-rent-1', {
      type: 'income', category: 'RENT', frequency: 'FORTNIGHTLY', isRecurring: true,
      incomeSourceType: 'PROPERTY', propertyId: 'p-lot1',
    });
    expect(status).toBe(200);
    // Scope-singleton: no new row minted; the ONE Lot-1 stream is reused…
    expect(db.income.filter((r) => r.type === 'RENT')).toHaveLength(1);
    const row = db.income.find((r) => r.id === 'i-rent-lot1')!;
    // …and its cadence updates to the user's confirmed FORTNIGHTLY,
    // while the declared amount (the gross plan) is never touched.
    expect(row.frequency).toBe('FORTNIGHTLY');
    expect(row.isRecurring).toBe(true);
    expect(row.amount).toBe(1_195);
    expect(db.unifiedTransaction.find((t) => t.id === 't-rent-1')!.incomeId).toBe('i-rent-lot1');
  });

  it('MON-091 clobber guard: rental reuse WITHOUT an explicit frequency never rewrites the stored cadence', async () => {
    const { status } = await callCreate('t-rent-2', {
      type: 'income', category: 'RENT', isRecurring: true,
      incomeSourceType: 'PROPERTY', propertyId: 'p-lot1',
      // NO frequency — the dialog omits it when the selector was neither
      // detection-prefilled nor touched (a naked default is not a confirmation).
    });
    expect(status).toBe(200);
    const row = db.income.find((r) => r.id === 'i-rent-lot1')!;
    expect(row.frequency).toBe('MONTHLY'); // untouched
    expect(row.amount).toBe(1_195);
    expect(db.unifiedTransaction.find((t) => t.id === 't-rent-2')!.incomeId).toBe('i-rent-lot1');
  });

  it('the battery class: a scopeless link converges INTO the scoped row via the update action', async () => {
    const { status } = await callCreate('t-batt', {
      type: 'expense', category: 'MAINTENANCE', frequency: 'MONTHLY', name: 'Battery',
    });
    expect(status).toBe(200);
    // No third battery row — the scopeless actual reconciled into HOME's row.
    expect(db.expense.filter((e) => e.name.toLowerCase().includes('battery'))).toHaveLength(1);
    const batt = db.expense.find((e) => e.id === 'e-batt-home')!;
    expect(batt.amount).toBe(11_385);
    expect(batt.budgetedAmount).toBe(11_385); // preserved per the update template
    expect(batt.lastReconciled).toBeInstanceOf(Date);
    expect(db.unifiedTransaction.find((t) => t.id === 't-batt')!.expenseId).toBe('e-batt-home');
  });
});
