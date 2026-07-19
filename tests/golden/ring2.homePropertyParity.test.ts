/**
 * NEOAUDIT RING 2 — HOME-shape per-property cashflow PARITY across the three
 * server producers (CLAUDE.md Part 23 Ring 2; §19.4 downstream-parity).
 *
 * WHY THIS EXISTS (MON-035 / MON-036, VR-004): the Chrome Ring-3 run saw the
 * HOME property's Home-dashboard TILE (−$219/mo) disagree with the detail/list
 * page (−$723/mo) by ~$503/mo, while a normal RENTAL (Guildford) matched. The
 * existing parity matrix only exercises an INVESTMENT property with NO
 * transactions and NO one-off expense, so it could never reproduce a
 * HOME-specific divergence. This test closes that gap with a HOME shape
 * ENGINEERED to expose the two most likely divergence vectors:
 *
 *   • a ONE-OFF expense (`isRecurring: false`, $503/mo-equivalent) — if any
 *     producer fails to thread `isRecurring` into the engine it counts the
 *     one-off in its run-rate → exactly the ~$503/mo VR-004 delta;
 *   • a loan with NO `minRepayment` (owner-occupied mortgage) — exercises the
 *     interest-floor path on every producer.
 *
 * THE THREE PRODUCERS (must all land on the SAME per-property number — §12.2.1):
 *   1. the REAL `GET /api/portfolio/snapshot` route  → the Home dashboard tile
 *      (`property.cashflow.monthlyNet`);
 *   2. the REAL `GET /api/properties/[id]` route + the engine → the detail page;
 *   3. the master service `getMasterFinancialSnapshot().properties[]`.
 *
 * Green = the three producers are byte-parity on a HOME shape (the code is
 * one-source-correct; a live divergence is deploy/data, not logic) AND permanent
 * HOME-shape coverage is added (NeoAudit growth, §23.2.6). Red = reproduced —
 * root-cause from the failing leg.
 *
 * Mocked (honest scope, same as the other Ring-2 route tests): `@/lib/auth/guards`
 * injects the authenticated user; `@/lib/db` serves the fixture rows; the
 * detail route's `property.findUnique` hand-attaches FK relations (the golden
 * Proxy serves includes empty by design — no hidden mini-ORM false-green).
 * It does NOT verify rendered pixels (R2-vis) or real user data (R3).
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const USER_ID = vi.hoisted(() => 'home-parity-user');

/**
 * Fixture rows shaped like `fetchAllUserData`'s selects. Two properties:
 *   • p-home     — HOME (owner-occupied): stray RENTAL income, a recurring
 *                  expense, a $503/mo ONE-OFF expense, a loan with NO
 *                  minRepayment (→ interest floor). The adversarial case.
 *   • p-guilford — normal RENTAL with minRepayment set, no one-off. The control
 *                  (VR-004: "Guildford tile ≈ detail").
 * Declared basis (no unifiedTransactions) keeps the expected numbers exact and
 * isolates the one-off / loan-floor threading — the actuals path is Ring-0's.
 *
 * `vi.hoisted` so the (hoisted) `vi.mock('@/lib/db')` factory can read it.
 */
const ROWS: Record<string, { id?: string }[]> = vi.hoisted(() => ({
  loanTransaction: [], // MON-020/060: master now calls getUserTaxPosition (INTEREST_CHARGED sums)
  // MON-076 Part A: getUserTaxPosition resolves income earners — no household
  // profile here → single-earner degenerate case via the PERSONAL_NAME entity.
  householdProfile: [],
  legalEntity: [{ id: 'le-home', type: 'PERSONAL_NAME', role: 'PERSONAL' }],
  property: [
    { id: 'p-home', ownerEntityId: null, name: 'Home — 5 Cremorne', type: 'HOME', address: '5 Cremorne', currentValue: 900000, purchasePrice: 700000, purchaseDate: new Date('2019-01-01T00:00:00Z') },
    // Second HOME, transaction-backed (actuals basis) — mirrors VR-004.
    { id: 'p-home-act', ownerEntityId: null, name: 'Home (actuals) — 12 Neutral Bay', type: 'HOME', address: '12 Neutral Bay', currentValue: 950000, purchasePrice: 720000, purchaseDate: new Date('2018-01-01T00:00:00Z') },
    { id: 'p-guilford', ownerEntityId: null, name: 'Guildford St', type: 'RENTAL', address: '9 Guildford St', currentValue: 600000, purchasePrice: 500000, purchaseDate: new Date('2021-01-01T00:00:00Z') },
  ] as { id?: string }[],
  loan: [
    // Owner-occupied mortgage with NO minRepayment → engine floors to interest
    // (800,000 × 6% / 12 = 4,000/mo).
    { id: 'l-home', ownerEntityId: null, name: 'Home mortgage', principal: 800000, minRepayment: null, repaymentFrequency: null, interestRateAnnual: 0.06, type: 'HOME', isInterestOnly: false, propertyId: 'p-home', offsetAccountId: null },
    { id: 'l-home-act', ownerEntityId: null, name: 'Home(act) mortgage', principal: 800000, minRepayment: null, repaymentFrequency: null, interestRateAnnual: 0.06, type: 'HOME', isInterestOnly: false, propertyId: 'p-home-act', offsetAccountId: null },
    { id: 'l-guilford', ownerEntityId: null, name: 'Guildford mortgage', principal: 400000, minRepayment: 2500, repaymentFrequency: 'MONTHLY', interestRateAnnual: 0.06, type: 'INVESTMENT', isInterestOnly: false, propertyId: 'p-guilford', offsetAccountId: null },
  ] as { id?: string }[],
  income: [
    // Stray RENTAL income on the HOME (a granny-flat sublet, say): 500/wk →
    // 500 × 52 / 12 = 2,166.6667/mo declared.
    { id: 'i-home-rent', ownerEntityId: null, name: 'Granny flat rent', amount: 500, frequency: 'WEEKLY', type: 'RENTAL', salaryType: null, netAmount: null, grossAmount: null, paygWithholding: null, isTaxable: true, propertyId: 'p-home', investmentAccountId: null, budgetedAmount: null, lastReconciled: null },
    { id: 'i-home-act-rent', ownerEntityId: null, name: 'Granny flat rent (act)', amount: 500, frequency: 'WEEKLY', type: 'RENTAL', salaryType: null, netAmount: null, grossAmount: null, paygWithholding: null, isTaxable: true, propertyId: 'p-home-act', investmentAccountId: null, budgetedAmount: null, lastReconciled: null },
    { id: 'i-guilford-rent', ownerEntityId: null, name: 'Guildford rent', amount: 550, frequency: 'WEEKLY', type: 'RENTAL', salaryType: null, netAmount: null, grossAmount: null, paygWithholding: null, isTaxable: true, propertyId: 'p-guilford', investmentAccountId: null, budgetedAmount: null, lastReconciled: null },
  ] as { id?: string }[],
  expense: [
    // Recurring HOME expense (council rates): 2,400/yr = 200/mo.
    { id: 'e-home-rates', ownerEntityId: null, name: 'Council rates', amount: 2400, frequency: 'ANNUAL', category: 'PROPERTY', isEssential: true, isRecurring: true, isTaxDeductible: true, propertyId: 'p-home', loanId: null, assetId: null, budgetedAmount: null, lastReconciled: null },
    // ONE-OFF HOME expense (battery install): 503/mo-equivalent, isRecurring
    // false → MUST be excluded from the run-rate on EVERY producer. If any
    // producer includes it, that producer is ~$503/mo more negative — the
    // exact VR-004 delta.
    { id: 'e-home-battery', ownerEntityId: null, name: 'Battery install', amount: 503, frequency: 'MONTHLY', category: 'PROPERTY', isEssential: false, isRecurring: false, isTaxDeductible: false, propertyId: 'p-home', loanId: null, assetId: null, budgetedAmount: null, lastReconciled: null },
    // Actuals HOME: recurring rates (transaction-backed) + a one-off with NO
    // transactions (stays declared-excluded).
    { id: 'e-home-act-rates', ownerEntityId: null, name: 'Council rates (act)', amount: 2400, frequency: 'ANNUAL', category: 'PROPERTY', isEssential: true, isRecurring: true, isTaxDeductible: true, propertyId: 'p-home-act', loanId: null, assetId: null, budgetedAmount: null, lastReconciled: null },
    { id: 'e-home-act-battery', ownerEntityId: null, name: 'Battery install (act)', amount: 503, frequency: 'MONTHLY', category: 'PROPERTY', isEssential: false, isRecurring: false, isTaxDeductible: false, propertyId: 'p-home-act', loanId: null, assetId: null, budgetedAmount: null, lastReconciled: null },
    { id: 'e-guilford-rates', ownerEntityId: null, name: 'Guildford rates', amount: 1800, frequency: 'ANNUAL', category: 'PROPERTY', isEssential: true, isRecurring: true, isTaxDeductible: true, propertyId: 'p-guilford', loanId: null, assetId: null, budgetedAmount: null, lastReconciled: null },
  ] as { id?: string }[],
  account: [{ id: 'a-everyday', ownerEntityId: null, name: 'Everyday', type: 'TRANSACTIONAL', currentBalance: 10000, balanceSource: 'MANUAL', balanceLastUpdatedAt: new Date('2026-07-01T00:00:00Z') }],
  investmentHolding: [],
  investmentAccount: [],
  superannuationAccount: [],
  asset: [],
  // ACTUALS basis for the HOME rental + its recurring expense + loan repayments
  // — mirrors VR-004's real (transaction-backed) conditions so the parity proof
  // covers the actuals path, not only declared. The ONE-OFF (e-home-battery)
  // deliberately has NO transactions → it must stay excluded on every producer.
  // Monthly cadence ~30.44 days apart so `calculateMonthlyAverage` reads a clean
  // monthly figure; the exact number isn't hand-asserted (day-span average) —
  // the load-bearing claim is cross-producer PARITY, which the actuals path
  // must also honour (§19.4).
  unifiedTransaction: [
    ...[0, 1, 2, 3, 4, 5].map((k) => ({ id: `tx-rent-${k}`, date: new Date(2026, 0 + k, 3), amount: 2170, direction: 'IN', incomeId: 'i-home-act-rent', expenseId: null, loanId: null, categoryLevel1: 'RENT', isTransfer: false })),
    ...[0, 1, 2, 3, 4, 5].map((k) => ({ id: `tx-rates-${k}`, date: new Date(2026, 0 + k, 12), amount: -205, direction: 'OUT', incomeId: null, expenseId: 'e-home-act-rates', loanId: null, categoryLevel1: 'PROPERTY', isTransfer: false })),
    ...[0, 1, 2, 3, 4, 5].map((k) => ({ id: `tx-loan-${k}`, date: new Date(2026, 0 + k, 1), amount: -4000, direction: 'OUT', incomeId: null, expenseId: null, loanId: 'l-home-act', categoryLevel1: 'LOAN', isTransfer: false })),
  ] as { id?: string }[],
  recurringPayment: [],
  investmentTransaction: [],
  spendingProfile: [],
  depreciationSchedule: [],
}));

// Hand-computed HOME cashflow (declared, one-off EXCLUDED):
//   rent 2,166.6667 − rates 200 − loan(interest floor) 4,000 = −2,033.3333/mo
const HOME_EXPECTED_MONTHLY = 500 * 52 / 12 - 200 - (800000 * 0.06 / 12);
// Guildford (declared): rent 2,383.3333 − rates 150 − loan 2,500 = −266.6667/mo
const GUILFORD_EXPECTED_MONTHLY = 550 * 52 / 12 - 150 - 2500;

vi.mock('@/lib/db', async () => {
  const { createGoldenDbFrom } = await import('./goldenHousehold');
  const base = createGoldenDbFrom(ROWS) as Record<string, unknown>;
  // The detail route needs the property's REAL FK relations to feed the engine
  // (createGoldenDbFrom serves includes empty by design). Hand-attach them.
  const withRelations = (id?: string) => {
    const p = (ROWS.property as Array<Record<string, unknown>>).find((r) => r.id === id);
    if (!p) return null;
    return {
      ...p,
      userId: USER_ID,
      heroImageMime: null,
      loans: (ROWS.loan as Array<Record<string, unknown>>).filter((l) => l.propertyId === id),
      income: (ROWS.income as Array<Record<string, unknown>>).filter((i) => i.propertyId === id),
      expenses: (ROWS.expense as Array<Record<string, unknown>>).filter((e) => e.propertyId === id),
      depreciationSchedules: [] as never[],
    };
  };
  const db = new Proxy(
    {},
    {
      get(_t, model: string | symbol) {
        if (typeof model === 'symbol') return (base as never)[model];
        if (model === 'property') {
          const baseProp = base.property as Record<string, unknown>;
          return {
            ...baseProp,
            findUnique: async ({ where }: { where: { id?: string } }) => structuredClone(withRelations(where?.id)),
            // The portfolio/snapshot route now enriches via property.findMany's
            // income/expenses/loans relations (the §12.2.1 consolidation) — so the
            // mock must populate those includes, exactly as prod Prisma does
            // (createGoldenDbFrom serves includes EMPTY by default). This is what
            // makes the Home-tile path exercise the SAME assembler as detail.
            findMany: async () =>
              (ROWS.property as Array<{ id?: string }>).map((p) => structuredClone(withRelations(p.id))),
          };
        }
        return (base as Record<string, unknown>)[model];
      },
    },
  );
  return { default: db, prisma: db };
});

vi.mock('@/lib/auth/guards', () => ({
  withPermission:
    (_permission: string, handler: (req: unknown, auth: unknown, params: unknown) => Promise<Response>) =>
    (request: unknown, params: unknown) =>
      handler(request, { userId: USER_ID, email: 'home@parity.test', role: 'USER', emailVerified: true }, params),
}));

vi.mock('@/lib/security/auditLog', () => ({ createAuditLog: async () => undefined }));

import { NextRequest } from 'next/server';
import { getMasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import { computePropertyCashflow } from '@/lib/calculations/propertyCashflow';
import { GET as portfolioGET } from '@/app/api/portfolio/snapshot/route';
import { GET as propertyGET } from '@/app/api/properties/[id]/route';

interface Producers { tile: number; detail: number; master: number }
const collected: Record<string, Producers> = {};
// MON-036: rental yield across the same producers (yield = annualRent/value —
// derives from the SAME engine, so parity here follows from cashflow parity).
const yields: Record<string, Producers> = {};

async function detailCashflow(id: string) {
  const json = await (
    await propertyGET(new NextRequest(`http://localhost/api/properties/${id}`), { params: Promise.resolve({ id }) })
  ).json();
  return computePropertyCashflow({
    income: json.income,
    expenses: json.expenses,
    loans: json.loans,
    transactions: json.linkedTransactions,
  });
}

beforeAll(async () => {
  const portfolio = await (await portfolioGET(new NextRequest('http://localhost/api/portfolio/snapshot'), undefined as never)).json();
  const master = await getMasterFinancialSnapshot(USER_ID);

  for (const p of ROWS.property as Array<{ id: string; currentValue: number }>) {
    const id = p.id;
    const tileProp = portfolio.properties.find((x: { id: string }) => x.id === id);
    const masterProp = master.properties.find((x: { id: string }) => x.id === id);
    const cf = await detailCashflow(id);
    collected[id] = {
      tile: tileProp.cashflow.monthlyNet,
      detail: cf.monthlyCashflow,
      master: masterProp.monthlyCashflow,
    };
    yields[id] = {
      tile: tileProp.rentalYield,
      // The list/detail page computes yield inline as annualRent/value×100.
      detail: Math.round((cf.annualRent / p.currentValue) * 100 * 100) / 100,
      master: Math.round(masterProp.rentalYield * 100) / 100,
    };
  }
});

describe('Ring 2 — HOME-shape per-property cashflow parity (MON-035/036)', () => {
  it('HOME: the three producers agree (Home tile == detail == master)', () => {
    const { tile, detail, master } = collected['p-home'];
    expect(tile, `Home tile ${tile} vs detail ${detail}`).toBeCloseTo(detail, 2);
    expect(master, `master ${master} vs detail ${detail}`).toBeCloseTo(detail, 2);
  });

  it('HOME: all three land on the hand-computed manifest (one-off EXCLUDED, loan floored to interest)', () => {
    const { tile, detail, master } = collected['p-home'];
    for (const [name, v] of [['tile', tile], ['detail', detail], ['master', master]] as const) {
      expect(v, `${name} = ${v}, expected ${HOME_EXPECTED_MONTHLY} (parity to a WRONG number is not a pass)`).toBeCloseTo(HOME_EXPECTED_MONTHLY, 2);
    }
  });

  it('HOME: the $503/mo one-off is NOT in the run-rate on ANY producer (VR-004 delta guard)', () => {
    // If a producer counted the one-off it would be ~503/mo MORE negative.
    const withOneOff = HOME_EXPECTED_MONTHLY - 503;
    for (const [name, v] of Object.entries(collected['p-home'])) {
      expect(Math.abs(v - withOneOff), `${name} appears to include the one-off ($503/mo)`).toBeGreaterThan(1);
    }
  });

  it('HOME (ACTUALS basis, transaction-backed — mirrors VR-004): the three producers agree', () => {
    const { tile, detail, master } = collected['p-home-act'];
    expect(tile, `Home tile ${tile} vs detail ${detail} (actuals path)`).toBeCloseTo(detail, 2);
    expect(master, `master ${master} vs detail ${detail} (actuals path)`).toBeCloseTo(detail, 2);
    // The one-off (no transactions) stays excluded even on the actuals property:
    // rent(actual ~2,170) − rates(actual ~205) − loan(4,000) ≈ −2,035, NOT
    // ~$503 more negative.
    expect(Math.abs(detail - (HOME_EXPECTED_MONTHLY - 503)), 'actuals HOME appears to include the one-off').toBeGreaterThan(1);
  });

  it('CONTROL — Guildford (normal RENTAL) also agrees across the three producers', () => {
    const { tile, detail, master } = collected['p-guilford'];
    expect(tile).toBeCloseTo(detail, 2);
    expect(master).toBeCloseTo(detail, 2);
    expect(detail).toBeCloseTo(GUILFORD_EXPECTED_MONTHLY, 2);
  });

  it('MON-036 — rental YIELD is equal across Home tile / detail / master for every property', () => {
    // Yield derives from the same engine's annualRent; parity here is the
    // MON-036 claim (VR-004 saw 0.12 / 0.9 across surfaces for HOME).
    for (const id of Object.keys(yields)) {
      const { tile, detail, master } = yields[id];
      expect(tile, `${id}: tile yield ${tile} vs detail ${detail}`).toBeCloseTo(detail, 2);
      expect(master, `${id}: master yield ${master} vs detail ${detail}`).toBeCloseTo(detail, 2);
    }
  });
});

/**
 * THE RATCHET (§23.2.2, Ring-1 source-lock) — the honest guard for the VR-005
 * Stage-4 FAIL. The value-parity above cannot catch a WHERE-clause/fetch
 * difference (the golden DB mock ignores WHERE — that's exactly why the earlier
 * reproduction gave a false pass). The real bug CLASS was: the portfolio/snapshot
 * route had its OWN inline per-property transaction fetch (`unifiedTransaction`)
 * + `propertyTx` filter — a §12.2.1 DUPLICATE of `enrichPropertiesWithActuals` —
 * which drifted from the enricher on live HOME data. This source-lock fails the
 * build if a second inline producer is ever re-introduced.
 */
describe('MON-035/036 Ratchet — portfolio/snapshot has ONE per-property cashflow producer', () => {
  const routeSrc = readFileSync(
    resolve(__dirname, '../../app/api/portfolio/snapshot/route.ts'),
    'utf8',
  );

  it('per-property cashflow is assembled by the canonical enricher (enrichPropertiesWithActuals)', () => {
    expect(routeSrc).toMatch(/enrichPropertiesWithActuals\(/);
  });

  it('the route does NOT re-fetch transactions inline (no second producer)', () => {
    // The enricher owns the reconciled-transaction fetch; the route must not do
    // its own `unifiedTransaction.findMany` for per-property cashflow.
    expect(routeSrc).not.toMatch(/unifiedTransaction\.findMany/);
  });
});
