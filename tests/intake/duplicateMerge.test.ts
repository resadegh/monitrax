/**
 * Mechanism A PART 2 — duplicate-merge engine (MON-074/076).
 *
 * Grouping must be exactly as conservative as the Part-1 guardrail (same
 * classifier policy): genuine same-source rows cluster; distinct sources that
 * merely share a payer/name-across-scopes never do. The executor must repoint
 * EVERY FK before deleting, and never touch the survivor's own fields.
 */
import { describe, it, expect } from 'vitest';
import {
  findDuplicateGroups,
  executeMerge,
  type MergeableRow,
  type MergeDbClient,
} from '../../lib/intake/duplicateMerge';

const base = {
  frequency: 'MONTHLY',
  isRecurring: true as boolean | null,
  ownerEntityId: 'le-1',
  propertyId: null,
  loanId: null,
  assetId: null,
  investmentAccountId: null,
};

const row = (over: Partial<MergeableRow> & { id: string; name: string; amount: number; createdAt: string }): MergeableRow =>
  ({ ...base, ...over }) as MergeableRow;

describe('findDuplicateGroups — the preview census', () => {
  it('the Ingeus class clusters into ONE group; survivor = oldest; effect = −Σ deleted run-rates', () => {
    const groups = findDuplicateGroups('income', [
      row({ id: 'i-decl', name: 'Ingeus Australia', type: 'SALARY', amount: 8_500, createdAt: '2026-01-01' }),
      row({ id: 'i-frag1', name: 'INGEUS AUSTRALIA PTY LTD', type: 'SALARY', amount: 0, createdAt: '2026-03-01' }),
      row({ id: 'i-frag2', name: 'Ingeus', type: 'SALARY', amount: 5_547, createdAt: '2026-05-01' }),
    ]);
    // 'Ingeus' vs 'Ingeus Australia' → normalised containment; amounts 5,547
    // vs 8,500 differ >10% BUT 'INGEUS AUSTRALIA PTY LTD' normalises EXACTLY
    // to 'ingeus' + 'australia' stripped → seed-exact matches carry the group.
    expect(groups).toHaveLength(1);
    const g = groups[0];
    expect(g.survivorId).toBe('i-decl'); // all scopeless → oldest
    expect(g.mergeIds.sort()).toEqual(['i-frag1', 'i-frag2']);
    // effect: −(0×12 + 5,547×12) — the deleted rows' declared annual run-rate
    expect(g.annualDeclaredEffect).toBe(-(0 * 12 + 5_547 * 12));
  });

  it('the battery class: scoped + scopeless cluster; the SCOPED row survives', () => {
    const groups = findDuplicateGroups('expense', [
      row({ id: 'e-gen1', name: 'Battery', type: 'MAINTENANCE', amount: 11_385, isRecurring: false, createdAt: '2026-02-01' }),
      row({ id: 'e-home', name: 'Battery System', type: 'MAINTENANCE', amount: 11_385, isRecurring: false, propertyId: 'p-home', createdAt: '2026-03-01' }),
      row({ id: 'e-gen2', name: 'Battery Replacement', type: 'MAINTENANCE', amount: 11_385, isRecurring: false, createdAt: '2026-04-01' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].survivorId).toBe('e-home'); // most-specific scope wins
    expect(groups[0].mergeIds.sort()).toEqual(['e-gen1', 'e-gen2']);
    // one-offs contribute 0 to the declared run-rate effect
    expect(groups[0].annualDeclaredEffect).toBe(-0);
  });

  it('OVER-MERGE GUARDS: two different scopes never group; cross-property + scopeless rent never groups', () => {
    expect(
      findDuplicateGroups('expense', [
        row({ id: 'e-a', name: 'QBE Insurance', type: 'INSURANCE', amount: 1_200, propertyId: 'p-a', createdAt: '2026-01-01' }),
        row({ id: 'e-b', name: 'QBE Insurance', type: 'INSURANCE', amount: 1_210, propertyId: 'p-b', createdAt: '2026-02-01' }),
      ]),
    ).toHaveLength(0);

    // Lot-1 vs Lot-2 are DISTINCT real streams (the Reza correction) and a
    // scopeless rental row is never bridged into a scoped one — rent identity
    // IS the property scope (MON-009).
    expect(
      findDuplicateGroups('income', [
        row({ id: 'r-1', name: 'Cienna PM Trust', type: 'RENTAL', amount: 2_600, propertyId: 'p-lot1', createdAt: '2026-01-01' }),
        row({ id: 'r-2', name: 'Cienna PM Trust', type: 'RENTAL', amount: 2_600, propertyId: 'p-lot2', createdAt: '2026-02-01' }),
        row({ id: 'r-3', name: 'Cienna PM Trust', type: 'RENTAL', amount: 2_600, createdAt: '2026-03-01' }),
      ]),
    ).toHaveLength(0);
  });

  it('the Cienna Lot-1 class: rental rows on the SAME property group (scope-singleton), with the rental warning', () => {
    const groups = findDuplicateGroups('income', [
      row({ id: 'r-old', name: 'Cienna Pm Trust Rent Payment', type: 'RENT', amount: 1_651, propertyId: 'p-lot1', createdAt: '2026-01-01' }),
      row({ id: 'r-mid', name: 'Cienna Pm Trust Rent Payment', type: 'RENT', amount: 1_655, propertyId: 'p-lot1', createdAt: '2026-02-01' }),
      row({ id: 'r-new', name: 'Cienna Pm Trust Rent Payment', type: 'RENT', amount: 1_195, propertyId: 'p-lot1', createdAt: '2026-03-01' }),
    ]);
    expect(groups).toHaveLength(1);
    const g = groups[0];
    expect(g.survivorId).toBe('r-old'); // all same scope → oldest declared row
    expect(g.mergeIds.sort()).toEqual(['r-mid', 'r-new']);
    expect(g.annualDeclaredEffect).toBe(-((1_655 + 1_195) * 12));
    expect(g.warnings.some((w) => w.includes('SAME property'))).toBe(true);
  });

  it('different types / different owners never group; singletons are not groups', () => {
    expect(
      findDuplicateGroups('income', [
        row({ id: 'i-1', name: 'Acme', type: 'SALARY', amount: 5_000, createdAt: '2026-01-01' }),
        row({ id: 'i-2', name: 'Acme', type: 'OTHER', amount: 5_000, createdAt: '2026-02-01' }),
        row({ id: 'i-3', name: 'Solo', type: 'SALARY', amount: 1_000, createdAt: '2026-03-01' }),
      ]),
    ).toHaveLength(0);
  });
});

describe('executeMerge — FK repoint + delete, survivor untouched', () => {
  function fakeDb() {
    const calls: Record<string, unknown[]> = {};
    const rec = (model: string, method: string) => (args: unknown) => {
      calls[`${model}.${method}`] = [...(calls[`${model}.${method}`] ?? []), args];
      if (method === 'deleteMany') return Promise.resolve({ count: (args as any).where.id.in.length });
      if (model === 'agentDisbursementRule' && method === 'findMany') return Promise.resolve(rulesResult);
      return Promise.resolve({});
    };
    let rulesResult: Array<{ id: string; incomeStreamId: string }> = [];
    const db = {
      unifiedTransaction: { updateMany: rec('unifiedTransaction', 'updateMany') },
      transaction: { updateMany: rec('transaction', 'updateMany') },
      superContribution: { updateMany: rec('superContribution', 'updateMany') },
      transactionSplit: { updateMany: rec('transactionSplit', 'updateMany') },
      assetServiceRecord: { updateMany: rec('assetServiceRecord', 'updateMany') },
      expense: { updateMany: rec('expense', 'updateMany'), deleteMany: rec('expense', 'deleteMany') },
      income: { deleteMany: rec('income', 'deleteMany') },
      agentDisbursementRule: {
        findMany: rec('agentDisbursementRule', 'findMany'),
        update: rec('agentDisbursementRule', 'update'),
        deleteMany: rec('agentDisbursementRule', 'deleteMany'),
      },
    } as unknown as MergeDbClient;
    return { db, calls, setRules: (r: typeof rulesResult) => { rulesResult = r; } };
  }

  it('income merge repoints unifiedTransaction/transaction/superContribution/derived expenses, then deletes', async () => {
    const { db, calls } = fakeDb();
    const r = await executeMerge(db, 'u1', 'income', 'i-decl', ['i-frag1', 'i-frag2']);
    expect(r.deleted).toBe(2);
    expect(r.droppedDisbursementRule).toBe(false);
    expect((calls['unifiedTransaction.updateMany'][0] as any)).toEqual({
      where: { userId: 'u1', incomeId: { in: ['i-frag1', 'i-frag2'] } },
      data: { incomeId: 'i-decl' },
    });
    expect((calls['expense.updateMany'][0] as any).where).toEqual({ derivedFromIncomeId: { in: ['i-frag1', 'i-frag2'] } });
    expect((calls['income.deleteMany'][0] as any)).toEqual({ where: { userId: 'u1', id: { in: ['i-frag1', 'i-frag2'] } } });
    expect(calls['superContribution.updateMany']).toHaveLength(1);
    expect(calls['transaction.updateMany']).toHaveLength(1);
  });

  it("a sibling's disbursement rule is repointed when the survivor has none; flagged when both exist", async () => {
    const a = fakeDb();
    a.setRules([{ id: 'rule-1', incomeStreamId: 'i-frag1' }]);
    const r1 = await executeMerge(a.db, 'u1', 'income', 'i-decl', ['i-frag1']);
    expect(r1.droppedDisbursementRule).toBe(false);
    expect((a.calls['agentDisbursementRule.update'][0] as any)).toEqual({
      where: { id: 'rule-1' },
      data: { incomeStreamId: 'i-decl' },
    });

    const b = fakeDb();
    b.setRules([
      { id: 'rule-s', incomeStreamId: 'i-decl' },
      { id: 'rule-1', incomeStreamId: 'i-frag1' },
    ]);
    const r2 = await executeMerge(b.db, 'u1', 'income', 'i-decl', ['i-frag1']);
    expect(r2.droppedDisbursementRule).toBe(true);
    expect(b.calls['agentDisbursementRule.update']).toBeUndefined(); // survivor's rule kept
  });

  it('expense merge repoints all four FK tables, then deletes', async () => {
    const { db, calls } = fakeDb();
    const r = await executeMerge(db, 'u1', 'expense', 'e-home', ['e-gen1', 'e-gen2']);
    expect(r.deleted).toBe(2);
    for (const key of [
      'unifiedTransaction.updateMany',
      'transaction.updateMany',
      'transactionSplit.updateMany',
      'assetServiceRecord.updateMany',
    ]) {
      expect(calls[key]).toHaveLength(1);
      expect((calls[key][0] as any).where.expenseId).toEqual({ in: ['e-gen1', 'e-gen2'] });
    }
    expect((calls['expense.deleteMany'][0] as any)).toEqual({ where: { userId: 'u1', id: { in: ['e-gen1', 'e-gen2'] } } });
  });
});

// =============================================================================
// Fix B — merge-with-edit (design 1ebd1ea2; HANDOFF_dedup-accuracy-and-merge-edit
// §Fix B). The survivor's amount/frequency/one-off flag may be corrected as
// part of the merge; executeMerge stays pure and a NO-EDIT merge is
// byte-identical to the pre-Fix-B behaviour.
// =============================================================================
import {
  validateSurvivorEdits,
  applySurvivorEdits,
  VALID_FREQUENCIES,
} from '../../lib/intake/duplicateMerge';

describe('Fix B — validateSurvivorEdits (the request gate)', () => {
  it('absent / empty payloads mean NO edits (byte-identical merge)', () => {
    expect(validateSurvivorEdits(undefined)).toEqual({ edits: null, error: null });
    expect(validateSurvivorEdits(null)).toEqual({ edits: null, error: null });
    expect(validateSurvivorEdits({})).toEqual({ edits: null, error: null });
  });

  it('the QBE correction validates: recurring Monthly → One-off', () => {
    expect(validateSurvivorEdits({ isRecurring: false })).toEqual({
      edits: { isRecurring: false },
      error: null,
    });
  });

  it('the Mate correction validates: One-off → Recurring Monthly', () => {
    expect(validateSurvivorEdits({ isRecurring: true, frequency: 'MONTHLY' })).toEqual({
      edits: { isRecurring: true, frequency: 'MONTHLY' },
      error: null,
    });
  });

  it('an invalid frequency / negative amount / unknown field is rejected whole (never trimmed)', () => {
    expect(validateSurvivorEdits({ frequency: 'DAILY' }).error).toMatch(/frequency/);
    expect(validateSurvivorEdits({ amount: -5 }).error).toMatch(/amount/);
    expect(validateSurvivorEdits({ amount: Number.NaN }).error).toMatch(/amount/);
    expect(validateSurvivorEdits({ name: 'sneaky' }).error).toMatch(/unknown field/);
    expect(validateSurvivorEdits('MERGE').error).toMatch(/object/);
    // every schema Frequency value is accepted
    for (const f of VALID_FREQUENCIES) {
      expect(validateSurvivorEdits({ frequency: f }).error).toBeNull();
    }
  });
});

describe('Fix B — applySurvivorEdits (survivor only, ownership in the WHERE)', () => {
  function editDb() {
    const calls: Record<string, unknown[]> = {};
    const rec = (model: string, method: string) => (args: unknown) => {
      calls[`${model}.${method}`] = [...(calls[`${model}.${method}`] ?? []), args];
      return Promise.resolve({ count: 1 });
    };
    return {
      calls,
      db: {
        income: { updateMany: rec('income', 'updateMany'), deleteMany: rec('income', 'deleteMany') },
        expense: { updateMany: rec('expense', 'updateMany'), deleteMany: rec('expense', 'deleteMany') },
      } as unknown as MergeDbClient,
    };
  }

  it('applies ONLY the present fields, ONLY to {id, userId} — §12.11 guard in the WHERE', async () => {
    const { db, calls } = editDb();
    const applied = await applySurvivorEdits(db, 'u1', 'expense', 'e-qbe', { isRecurring: false });
    expect(applied).toEqual(['isRecurring']);
    expect(calls['expense.updateMany']).toHaveLength(1);
    expect(calls['expense.updateMany'][0]).toEqual({
      where: { id: 'e-qbe', userId: 'u1' },
      data: { isRecurring: false },
    });
    expect(calls['income.updateMany']).toBeUndefined();
  });

  it('income edits hit the income model; amount+frequency together apply both', async () => {
    const { db, calls } = editDb();
    const applied = await applySurvivorEdits(db, 'u1', 'income', 'i-decl', {
      amount: 150,
      frequency: 'MONTHLY',
      isRecurring: true,
    });
    expect(applied.sort()).toEqual(['amount', 'frequency', 'isRecurring']);
    expect(calls['income.updateMany'][0]).toEqual({
      where: { id: 'i-decl', userId: 'u1' },
      data: { amount: 150, frequency: 'MONTHLY', isRecurring: true },
    });
  });

  it('empty edits are a NO-OP — no updateMany call at all (byte-identical merge)', async () => {
    const { db, calls } = editDb();
    const applied = await applySurvivorEdits(db, 'u1', 'expense', 'e-qbe', {});
    expect(applied).toEqual([]);
    expect(calls['expense.updateMany']).toBeUndefined();
  });
});
