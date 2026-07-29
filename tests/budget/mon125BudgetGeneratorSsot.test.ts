/**
 * MON-125 / MON-126 — the budget generator consumes the CANONICAL producers,
 * never raw rows (VR-040: it was the FOURTH uncanonical expense producer —
 * 132 one-offs annualised forever + interest-only loans at $0 → a
 * recommended budget of $62,530/mo against $41,303/mo income).
 *
 * Six locks (the Matrix brief §6):
 *  1. ONE-OFF GATE — a $50,000 one-off contributes $0/mo to committed; only
 *     the recurring run-rate + canonical loan costs remain.
 *  2. INTEREST-ONLY LOAN — minRepayment 0 with linked repayments contributes
 *     its ACTUAL cost, never $0.
 *  3. FALLBACK ORDER — actuals → declared minRepayment → interest floor,
 *     asserted in all three directions on the REAL resolver.
 *  4. CROSS-PRODUCER PARITY — the route's totals ≡ the canonical lib
 *     producers (aggregateExpenses on the recurring basis + the loan
 *     resolver) on the same fixture. The lock that stops a fifth producer.
 *  5. INCOME SANITY — a budget above monthly net income sets the explicit
 *     flag; a budget below it does not.
 *  6. TOPOLOGY — the route imports the canonical producers and carries no
 *     raw `toMonthly` money math; the source-lock exception debt for this
 *     file is PAID (no entries remain); master's byCategory feed is gated to
 *     the recurring basis (MON-126).
 *
 * Coverage (precise): exercises the REAL route handler (benchmark path —
 * Gemini mocked off) with an in-memory db, the real loan resolver, and the
 * source topology. Does NOT verify the AI path's prompt content, the
 * rendered page, or live numbers (the Matrix's Ring-3 VR-041 owns those).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const TEST_USER = 'u-mon125';

// ── fixtures (hoisted — the vi.mock factories close over them) ─────────────
const h = vi.hoisted(() => {
  const EXPENSES = [
  // recurring essential $100/mo
  { id: 'e-ins', name: 'Insurance', category: 'Insurance', amount: 100, frequency: 'MONTHLY', isEssential: true, isRecurring: true, vendorName: null },
  // the MON-125 class: a one-off stored MONTHLY — counted ONCE, never a run-rate
  { id: 'e-batt', name: 'Battery', category: 'Home', amount: 50_000, frequency: 'MONTHLY', isEssential: true, isRecurring: false, vendorName: null },
  // recurring discretionary $200/mo
  { id: 'e-gym', name: 'Gym', category: 'Health', amount: 200, frequency: 'MONTHLY', isEssential: false, isRecurring: true, vendorName: null },
];

const LOANS = [
  // interest-only, minRepayment 0, WITH linked repayments → actuals
  { id: 'l-io-tx', name: 'IO with actuals', principal: 300_000, interestRateAnnual: 0.06, minRepayment: 0, repaymentFrequency: 'MONTHLY' },
  // interest-only, minRepayment 0, NO repayments → interest floor ($1,000/mo)
  { id: 'l-io-floor', name: 'IO floored', principal: 200_000, interestRateAnnual: 0.06, minRepayment: 0, repaymentFrequency: 'MONTHLY' },
  // P&I declared $2,000/mo, no linked repayments → declared
  { id: 'l-pi', name: 'P&I declared', principal: 400_000, interestRateAnnual: 0.055, minRepayment: 2000, repaymentFrequency: 'MONTHLY' },
];

// 12 monthly repayments of $1,200 on the 1st (positive; the resolver abs()es)
  const IO_TXS = Array.from({ length: 12 }, (_, i) => ({
    date: new Date(Date.UTC(2026, i, 1)),
    amount: 1200,
    loanId: 'l-io-tx',
  }));
  const state = {
    mockMonthlyIncome: 1_000_000, // per-test override
    createdAnalyses: [] as Array<Record<string, unknown>>,
  };
  const prismaMock = {
  budgetAnalysis: {
    findFirst: async () => null,
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const row = { id: `ba-${state.createdAnalyses.length + 1}`, analysisDate: new Date(), ...data };
      state.createdAnalyses.push(row);
      return row;
    },
    update: async () => { throw new Error('AI path must not run in this suite'); },
    findUnique: async () => { throw new Error('AI path must not run in this suite'); },
  },
  householdProfile: {
    findUnique: async () => ({
      id: 'hp-1', userId: 'u-mon125', isComplete: true,
      adultsCount: 2, childrenCount: 0, childrenAges: [], petsCount: 0, petTypes: [],
      carsCount: 1, lifestylePreference: 'MODERATE', diningOutFrequency: 'RARELY', hobbiesWithCosts: [],
    }),
  },
  expense: { findMany: async () => EXPENSES },
  loan: { findMany: async () => LOANS },
  unifiedTransaction: { findMany: async () => IO_TXS },
  };
  return { EXPENSES, LOANS, IO_TXS, state, prismaMock };
});

const { EXPENSES, LOANS, IO_TXS, state } = h;

vi.mock('@/lib/db', () => ({ default: h.prismaMock, prisma: h.prismaMock }));
vi.mock('@/lib/auth/guards', () => ({
  withPermission:
    (_p: string, handler: (req: unknown, auth: unknown, ctx: unknown) => Promise<Response>) =>
    (request: unknown, ctx: unknown) =>
      handler(request, { userId: TEST_USER, email: 'mon125@test', role: 'USER', emailVerified: true }, ctx),
}));
vi.mock('@/lib/ai/google', () => ({
  isGeminiConfigured: () => false, // benchmark path — deterministic, no AI
  generateGeminiJSONCompletion: async () => { throw new Error('unreachable'); },
  GEMINI_MODELS: { FINANCIAL_ADVISOR: 'mock' },
}));
vi.mock('@/lib/services/masterFinancialService', () => ({
  getMasterFinancialSnapshot: async () => ({
    quickMetrics: { monthlyIncome: h.state.mockMonthlyIncome },
  }),
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/budget-analysis/generate/route';
import { resolveLoanMonthlyCost } from '@/lib/calculations/propertyCashflow';
import { aggregateExpenses } from '@/lib/calculations/expenseAggregator';
import { monthlyRunRate } from '@/lib/utils/frequencies';

const generate = async () => {
  const res = await POST(
    new NextRequest('http://localhost/api/budget-analysis/generate', {
      method: 'POST',
      body: JSON.stringify({ forceRegenerate: true }),
      headers: { 'Content-Type': 'application/json' },
    }),
    undefined as never,
  );
  return { status: res.status, json: await res.json() };
};

// The canonical expectations, derived from the producers — not from targets.
const expectedLoanCosts = () => ({
  actuals: resolveLoanMonthlyCost(LOANS[0], IO_TXS),
  floored: resolveLoanMonthlyCost(LOANS[1], []),
  declared: resolveLoanMonthlyCost(LOANS[2], []),
});

beforeEach(() => {
  state.createdAnalyses.length = 0;
  state.mockMonthlyIncome = 1_000_000;
});

describe('MON-125 · lock 1+2 — one-off gate + interest-only loans through the route', () => {
  it('committed = recurring essential + canonical loans; the $50,000 one-off contributes $0/mo', async () => {
    const { status, json } = await generate();
    expect(status).toBe(200);
    const { actuals, floored, declared } = expectedLoanCosts();
    const expectedLoans = actuals.monthly + floored.monthly + declared.monthly;

    expect(json.data.committed.essentialExpenses).toBe(100); // NOT 50,100
    expect(json.data.committed.loanRepayments).toBeCloseTo(expectedLoans, 6);
    expect(json.data.committed.total).toBeCloseTo(100 + expectedLoans, 6);
    expect(json.data.discretionaryTracked.total).toBe(200);
  });

  it('the IO loan with linked repayments contributes its ACTUAL cost (never $0), with the basis labelled', async () => {
    const { json } = await generate();
    const { actuals } = expectedLoanCosts();
    expect(actuals.usedActuals).toBe(true);
    expect(actuals.monthly).toBeGreaterThan(0);

    const loanItems = json.data.committed.breakdown.categories['Loan Repayments'].items;
    const io = loanItems.find((i: { name: string }) => i.name === 'IO with actuals');
    expect(io.monthlyAmount).toBeCloseTo(actuals.monthly, 6);
    expect(io.basis).toBe('from linked repayments');

    const floored = loanItems.find((i: { name: string }) => i.name === 'IO floored');
    expect(floored.monthlyAmount).toBeCloseTo(200_000 * 0.06 / 12, 6); // $1,000 interest floor
    expect(floored.basis).toBe('interest cost (no repayment linked or set)');
  });
});

describe('MON-125 · lock 3 — fallback order on the REAL resolver', () => {
  it('actuals win when linked repayments exist', () => {
    const r = resolveLoanMonthlyCost(LOANS[0], IO_TXS);
    expect(r.usedActuals).toBe(true);
    expect(r.flooredToInterest).toBe(false);
    expect(r.monthly).toBeGreaterThan(0);
    expect(r.monthly).not.toBeCloseTo(300_000 * 0.06 / 12, 2); // not the floor
  });

  it('declared minRepayment when no actuals exist', () => {
    const r = resolveLoanMonthlyCost(LOANS[2], []);
    expect(r.usedActuals).toBe(false);
    expect(r.flooredToInterest).toBe(false);
    expect(r.monthly).toBe(2000);
  });

  it('interest floor when neither exists — an IO loan can never cost $0', () => {
    const r = resolveLoanMonthlyCost(LOANS[1], []);
    expect(r.flooredToInterest).toBe(true);
    expect(r.monthly).toBeCloseTo(200_000 * 0.06 / 12, 6);
  });
});

describe('MON-125 · lock 4 — cross-producer parity (the fifth-producer stopper)', () => {
  it('route totals ≡ the canonical lib producers on the same fixture', async () => {
    const { json } = await generate();
    // The canonical expense producer on the SAME recurring basis master uses:
    const recurring = EXPENSES.filter((e) => e.isRecurring !== false);
    const libAggregation = aggregateExpenses(recurring, 'monthly');
    expect(json.data.committed.essentialExpenses + json.data.discretionaryTracked.total)
      .toBeCloseTo(libAggregation.total, 6);
    // And per-row: the route's basis is exactly monthlyRunRate (one-off → 0).
    expect(monthlyRunRate(EXPENSES[1])).toBe(0);
    expect(EXPENSES.reduce((s, e) => s + monthlyRunRate(e), 0)).toBe(300);
  });
});

describe('MON-125 · lock 5 — a budget above income announces itself', () => {
  it('income below the budget → exceedsIncome true, income stated', async () => {
    state.mockMonthlyIncome = 50;
    const { json } = await generate();
    expect(json.data.incomeSanity.exceedsIncome).toBe(true);
    expect(json.data.incomeSanity.monthlyNetIncome).toBe(50);
  });

  it('income above the budget → no flag', async () => {
    state.mockMonthlyIncome = 1_000_000;
    const { json } = await generate();
    expect(json.data.incomeSanity.exceedsIncome).toBe(false);
  });
});

describe('MON-125/126 · lock 6 — topology: the producers are canonical and the debt is PAID', () => {
  it('the route imports the canonical producers and no raw toMonthly money math', () => {
    const src = readFileSync(join(process.cwd(), 'app/api/budget-analysis/generate/route.ts'), 'utf8');
    expect(src).toContain('monthlyRunRate');
    expect(src).toContain('resolveLoanCostsForUser');
    expect(src).not.toMatch(/from '@\/lib\/utils\/frequencies'.*toMonthly|toMonthly.*from '@\/lib\/utils\/frequencies'/);
    expect(src).not.toMatch(/toMonthly\(/);
    expect(src).not.toMatch(/loan\.minRepayment\s*&&/); // the raw $0-IO pattern
  });

  it('the source-lock exception debt for the route is deleted, not grown', () => {
    const audit = JSON.parse(
      readFileSync(join(process.cwd(), '.audit/source-lock-exceptions.json'), 'utf8'),
    );
    const mine = audit.entries.filter(
      (e: { file: string }) => e.file === 'app/api/budget-analysis/generate/route.ts',
    );
    expect(mine).toEqual([]);
  });

  it("MON-126: master's byCategory feed is gated to the recurring basis", () => {
    const src = readFileSync(join(process.cwd(), 'lib/services/masterFinancialService.ts'), 'utf8');
    expect(src).toMatch(
      /aggregateExpensesByCategory\(\s*expenses\.filter\(e => e\.isRecurring !== false\)/,
    );
  });
});
