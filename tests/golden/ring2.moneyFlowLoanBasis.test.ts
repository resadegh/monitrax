/**
 * NEOAUDIT RING 2 — the T2-B seam: `getMoneyFlow`'s `loanCostBasis`
 * (CLAUDE.md Part 23 Ring 2; MON-131 T2-B).
 *
 * TWO CLAIMS, and they pull in opposite directions, which is why both are here:
 *
 *  1. **DECLARED is inert.** The seam ships BEFORE the declaration, so it must
 *     be provably a no-op on the default path — the T1-A scaffold rule. If
 *     adding the parameter shifted a single leaf, the T2-B capture would be
 *     measuring a build that had already moved, and the contract would be
 *     written against the wrong "before".
 *  2. **CANONICAL un-skips what DECLARED drops.** A seam inert on *both* bases
 *     would satisfy claim 1 and be worthless. The fixture therefore carries
 *     the exact shape the defect needs: an interest-only loan with no declared
 *     repayment, which the skip drops to $0 while interest accrues monthly.
 *
 * WHY ITS OWN BOOK. The shared golden household serves the master snapshot's
 * models; `getMoneyFlow` also reads `distributionResolution` and
 * `dividendDistribution`, and its loans/income carry `ownerEntityId: null`, so
 * every per-entity bucket would be empty and the assertions vacuous. Rather
 * than reshape the shared fixture — which every other Ring-2 suite pins —
 * this builds a money-flow book locally via `createGoldenDbFrom`, the
 * extension point the Tier-3 metamorphic suite already established.
 *
 * WHAT THIS DOES NOT DO. It does not predict what the migration moves on live
 * data. The surplus floor (`max(0, income − … − loans − …)`) makes the
 * per-entity effect a property of the data, not of arithmetic — an entity
 * already at zero surplus absorbs nothing. That is the compare relay's job;
 * this verifies the seam's mechanics on known rows.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

const holder = vi.hoisted(() => ({ db: null as unknown as Record<string, unknown> }));
vi.mock('@/lib/db', () => {
  const proxy = new Proxy(
    {},
    {
      get(_t, model: string | symbol) {
        if (typeof model === 'symbol' || model === 'then' || model === 'catch') return undefined;
        const db = holder.db as Record<string, unknown> | null;
        if (!db) throw new Error('[Ring2 T2-B] no active golden db set for this run');
        return db[model];
      },
    },
  );
  return { default: proxy, prisma: proxy };
});

import { getMoneyFlow, type MoneyFlowResult } from '@/lib/services/moneyFlowService';
import { GOLDEN_DB, GOLDEN_USER_ID, createGoldenDbFrom } from './goldenHousehold';

type Rows = Record<string, { id?: string }[]>;

const ENTITY = 'le-golden';

/**
 * The shape the defect needs: interest-only, nothing declared. The old basis
 * skips it outright; the canonical basis floors it to the interest actually
 * accruing — 400,000 × 0.05 ÷ 12 = 1,666.666…/mo → 20,000.00/yr, hand-computed
 * (§19.2), not read back from the engine.
 */
const IO_LOAN = {
  id: 'l-io-flow',
  ownerEntityId: ENTITY,
  name: 'Interest-only, nothing declared',
  principal: 400_000,
  minRepayment: null,
  repaymentFrequency: null,
  interestRateAnnual: 0.05,
  type: 'INVESTMENT',
  isInterestOnly: true,
  propertyId: null,
  offsetAccountId: null,
};
const IO_ANNUAL = 400_000 * 0.05; // 20,000.00

/** A money-flow book: the golden rows, attributed to one entity, plus the
 *  models `getMoneyFlow` reads that the shared fixture does not serve. */
function moneyFlowBook(withIoLoan: boolean): Rows {
  const rows = structuredClone(GOLDEN_DB) as unknown as Rows;
  const attribute = <T extends { ownerEntityId?: unknown }>(arr: T[]) =>
    arr.map((r) => ({ ...r, ownerEntityId: ENTITY }));
  rows.loan = attribute(rows.loan as Array<{ ownerEntityId?: unknown }>) as typeof rows.loan;
  rows.income = attribute(rows.income as Array<{ ownerEntityId?: unknown }>) as typeof rows.income;
  rows.expense = attribute(rows.expense as Array<{ ownerEntityId?: unknown }>) as typeof rows.expense;
  if (withIoLoan) rows.loan = [...rows.loan, IO_LOAN as unknown as { id?: string }];
  rows.distributionResolution = [];
  rows.dividendDistribution = [];
  return rows;
}

const loanLeg = (flow: MoneyFlowResult) =>
  flow.outflows.find((o) => o.label === 'Loan repayments')?.amount ?? 0;

let defaultArg: MoneyFlowResult;
let explicitDeclared: MoneyFlowResult;
let declaredWithIo: MoneyFlowResult;
let canonicalWithIo: MoneyFlowResult;

const run = async (rows: Rows, opts?: { loanCostBasis: 'DECLARED' | 'CANONICAL' }) => {
  holder.db = createGoldenDbFrom(rows) as unknown as Record<string, unknown>;
  return opts ? getMoneyFlow(GOLDEN_USER_ID, undefined, opts) : getMoneyFlow(GOLDEN_USER_ID);
};

beforeAll(async () => {
  defaultArg = await run(moneyFlowBook(false));
  explicitDeclared = await run(moneyFlowBook(false), { loanCostBasis: 'DECLARED' });
  declaredWithIo = await run(moneyFlowBook(true), { loanCostBasis: 'DECLARED' });
  canonicalWithIo = await run(moneyFlowBook(true), { loanCostBasis: 'CANONICAL' });
});

describe('T2-B seam · claim 1 — DECLARED is inert (the scaffold rule)', () => {
  it('passing no options is byte-identical to passing DECLARED — the WHOLE tree', () => {
    // Serialised comparison, not a sampled leaf: the scaffold claim is about
    // the whole shape, and naming leaves would only cover the ones I thought
    // of. Two independent runs over equivalent books, so this is a real
    // comparison rather than an object compared to itself.
    expect(JSON.stringify(defaultArg)).toBe(JSON.stringify(explicitDeclared));
  });

  it('the fixture is not vacuous — the default path really does produce a flow', () => {
    // Without this, claim 1 would pass just as happily on two empty trees.
    expect(defaultArg.isEmpty).toBe(false);
    expect(defaultArg.entities.length).toBeGreaterThan(0);
    expect(loanLeg(defaultArg)).toBeGreaterThan(0);
  });

  it('DECLARED still SKIPS the interest-only loan — the defect is intact until the flip', () => {
    // The assertion that fails if someone "helpfully" fixes the skip before
    // the capture measures it. The contract needs the real before-value.
    expect(loanLeg(declaredWithIo)).toBeCloseTo(loanLeg(defaultArg), 6);
  });
});

describe('T2-B seam · claim 2 — CANONICAL un-skips it', () => {
  it('the interest-only loan reaches the flow at its interest floor', () => {
    expect(loanLeg(canonicalWithIo) - loanLeg(declaredWithIo)).toBeCloseTo(IO_ANNUAL, 2);
  });

  it('the un-skipped cost lands on the OWNING entity, not on the total alone', () => {
    // Per-entity attribution is what T2-B's expectedMoves is declared over, so
    // a change that moved only the aggregate would be the wrong change.
    const owner = canonicalWithIo.entities.find((e) => e.id === ENTITY);
    const ownerBefore = declaredWithIo.entities.find((e) => e.id === ENTITY);
    expect(owner).toBeDefined();
    expect(
      (owner?.outflows['Loan repayments'] ?? 0) - (ownerBefore?.outflows['Loan repayments'] ?? 0),
    ).toBeCloseTo(IO_ANNUAL, 2);
  });

  it('income is untouched — T2-B moves the loan leg only', () => {
    expect(canonicalWithIo.totalIncome).toBeCloseTo(declaredWithIo.totalIncome, 6);
  });
});
