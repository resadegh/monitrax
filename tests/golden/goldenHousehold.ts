/**
 * NEOAUDIT RING 2 — the Golden Household "Avalon" (NEOAUDIT.md §8 step 3, CLAUDE.md Part 23 Ring 2).
 *
 * A fully-specified synthetic household whose every headline number is
 * HAND-COMPUTED below (§19.2) — the fixture rows mirror the exact Prisma
 * `select` shapes of `fetchAllUserData` (masterFinancialService.ts:613), so the
 * REAL service runs on them unmodified. If any engine, mapping, or
 * serialization step drifts, the manifest assertions break.
 *
 * Design constraints (all deliberate):
 *  - Salary is `salaryType: 'NET'` — gross = net = amount, PAYG 0. A GROSS
 *    salary would route through `calculateTakeHomePay` (the full PAYG+Medicare
 *    tables), which is NOT hand-computable and is Ring-0's job to verify.
 *  - No transactions → declared basis everywhere (`hasActualData: false`).
 *    The actuals-resolution path is exercised by Ring-0 property tests.
 *  - Amounts chosen so conversions are EXACT (600/wk → 2,600/mo: 600×52/12).
 *
 * ── HAND-COMPUTED MANIFEST (derivations) ───────────────────────────────────
 * Accounts:  A1 TRANSACTIONAL 8,000 + A2 SAVINGS 42,000        = 50,000
 *   liquidCash (LIQUID_ACCOUNT_TYPES = SAVINGS/TRANSACTIONAL/OFFSET/CASH)
 *   = 8,000 + 42,000                                            = 50,000
 * Property:  P1 value 800,000 (purchase 650,000)
 *   Loan L1 (propertyId=P1, INVESTMENT): principal 500,000 @ 6%, min 3,000/mo
 *   equity = 800,000 − 500,000                                  = 300,000
 *   lvr    = 500,000 / 800,000 × 100                            = 62.5
 * Investments: 100 units × currentPrice 50 = 5,000; account cash 2,000 → 7,000
 * Super:     S1 INDUSTRY 120,000 (counted) + S2 SMSF 90,000 (EXCLUDED — its
 *            wealth flows through the entity, Phase 39.5)       = 120,000
 * Personal assets: AS1 ACTIVE 15,000 (counted) + AS2 SOLD 9,999 (EXCLUDED,
 *            MON-013)                                           = 15,000
 * ASSETS  = 800,000 + 50,000 + 7,000 + 120,000 + 15,000         = 992,000
 * LIABILITIES: L1 500,000 (mortgage: type INVESTMENT) + L2 20,000 (personal:
 *            type PERSONAL, no propertyId); creditCards 0       = 520,000
 * NET WORTH = 992,000 − 520,000                                 = 472,000
 *
 * Income (monthly, net): salary 7,800 (NET) + rent 600/wk = 600×52/12 = 2,600
 *   → netTotal = grossTotal                                     = 10,400
 *   (MON-009 rental dedup pools P1's single rental row into one synthetic
 *   MONTHLY 2,600 record — identity here, by construction.)
 * Expenses (monthly, all recurring): groceries 1,200 (ess) + insurance
 *   2,400/yr = 200 (ess) + dining 300 (disc) → essential 1,400, discretionary
 *   300, total                                                  = 1,700
 * Loan repayments (monthly): L1 3,000 + L2 400                  = 3,400
 * CASHFLOW  = 10,400 − 1,700 − 3,400                            = 5,300
 * savingsRate = 5,300 / 10,400 × 100 = 50.9615… → rounds to     50.96
 * keptAfterEssentials = 10,400 − 1,400                          = 9,000
 *
 * P1 cashflow (declared): rent 2,600/mo (31,200/yr); property expenses 0;
 *   loan 3,000/mo (36,000/yr) → monthlyCashflow = 2,600 − 0 − 3,000 = −400
 *   annualRentalIncome 31,200; rentalYield = 31,200/800,000×100 = 3.9
 * Emergency fund (declared burn = recurring 1,700; target 6mo):
 *   monthsCovered = 50,000 / 1,700 = 29.411764…; gap = max(0, 10,200−50,000) = 0
 * Accessibility buckets (Ring-3 I3 tie-out):
 *   liquidToday 50,000 − 0cc = 50,000; accessible 7,000 + 0 = 7,000;
 *   locked = 300,000 + 120,000 + 15,000 − 20,000 = 415,000; Σ = 472,000 ✓
 */

export const GOLDEN_USER_ID = 'golden-user-avalon';

const NOW = new Date('2026-07-01T00:00:00Z');

/** Rows shaped EXACTLY like fetchAllUserData's selects (one array per model). */
export const GOLDEN_DB = {
  legalEntity: [] as { id: string; name: string; type: string }[],
  expense: [
    { id: 'e-groceries', ownerEntityId: null, name: 'Groceries', amount: 1200, frequency: 'MONTHLY', category: 'GROCERIES', isEssential: true, isRecurring: true, isTaxDeductible: false, propertyId: null, loanId: null, assetId: null, budgetedAmount: null, lastReconciled: null },
    { id: 'e-insurance', ownerEntityId: null, name: 'Home insurance', amount: 2400, frequency: 'ANNUAL', category: 'INSURANCE', isEssential: true, isRecurring: true, isTaxDeductible: false, propertyId: null, loanId: null, assetId: null, budgetedAmount: null, lastReconciled: null },
    { id: 'e-dining', ownerEntityId: null, name: 'Dining out', amount: 300, frequency: 'MONTHLY', category: 'DINING', isEssential: false, isRecurring: true, isTaxDeductible: false, propertyId: null, loanId: null, assetId: null, budgetedAmount: null, lastReconciled: null },
  ],
  income: [
    // NET salary: gross = net = 7,800/mo, PAYG 0 — hand-computable by design.
    { id: 'i-salary', ownerEntityId: null, name: 'Salary', amount: 7800, frequency: 'MONTHLY', type: 'SALARY', salaryType: 'NET', netAmount: null, grossAmount: null, paygWithholding: null, isTaxable: true, propertyId: null, investmentAccountId: null, budgetedAmount: null, lastReconciled: null },
    { id: 'i-rent', ownerEntityId: null, name: 'Rent — Avalon St', amount: 600, frequency: 'WEEKLY', type: 'RENTAL', salaryType: null, netAmount: null, grossAmount: null, paygWithholding: null, isTaxable: true, propertyId: 'p-avalon', investmentAccountId: null, budgetedAmount: null, lastReconciled: null },
  ],
  account: [
    { id: 'a-everyday', ownerEntityId: null, name: 'Everyday', type: 'TRANSACTIONAL', currentBalance: 8000, balanceSource: 'MANUAL', balanceLastUpdatedAt: NOW },
    { id: 'a-savings', ownerEntityId: null, name: 'Savings', type: 'SAVINGS', currentBalance: 42000, balanceSource: 'MANUAL', balanceLastUpdatedAt: NOW },
  ],
  loan: [
    { id: 'l-mortgage', ownerEntityId: null, name: 'Avalon St mortgage', principal: 500000, minRepayment: 3000, repaymentFrequency: 'MONTHLY', interestRateAnnual: 0.06, type: 'INVESTMENT', isInterestOnly: false, propertyId: 'p-avalon', offsetAccountId: null },
    { id: 'l-car', ownerEntityId: null, name: 'Car loan', principal: 20000, minRepayment: 400, repaymentFrequency: 'MONTHLY', interestRateAnnual: 0.08, type: 'PERSONAL', isInterestOnly: false, propertyId: null, offsetAccountId: null },
  ],
  property: [
    { id: 'p-avalon', ownerEntityId: null, name: 'Avalon St', type: 'INVESTMENT', address: '1 Avalon St', currentValue: 800000, purchasePrice: 650000, purchaseDate: new Date('2020-01-01T00:00:00Z') },
  ],
  investmentHolding: [
    { id: 'h-etf', investmentAccount: { ownerEntityId: null }, ticker: 'VAS', units: 100, averagePrice: 40, currentPrice: 50, type: 'ETF' },
  ],
  investmentAccount: [
    { id: 'ia-broker', ownerEntityId: null, cashBalance: 2000 },
  ],
  superannuationAccount: [
    { id: 's-industry', ownerEntityId: null, currentBalance: 120000, fundType: 'INDUSTRY' },
    // SMSF member balance — must be EXCLUDED from the super sum (Phase 39.5).
    { id: 's-smsf', ownerEntityId: null, currentBalance: 90000, fundType: 'SMSF' },
  ],
  asset: [
    { id: 'as-boat', ownerEntityId: null, currentValue: 15000, status: 'ACTIVE' },
    // SOLD — must be EXCLUDED from net worth (MON-013).
    { id: 'as-oldcar', ownerEntityId: null, currentValue: 9999, status: 'SOLD' },
  ],
  unifiedTransaction: [] as never[], // declared basis — no actuals
  recurringPayment: [] as never[], // zero tracked bills — MON-017: scores 0, not full marks
  investmentTransaction: [] as never[], // include-shaped routes read this; none for the golden book
  spendingProfile: [] as never[], // cashflow full-mode reads via findUnique(userId) → null → declared-basis branch
  depreciationSchedule: [] as never[], // report contextBuilder counts these; none for the golden book
  // MON-020/060: getUserTaxPosition (now also called inside the master snapshot)
  // reads INTEREST_CHARGED ledger rows per property loan. None in the golden
  // book — the MON-045 interest leg contributes 0 here by design (it has its
  // own Ring-0 suite); serving the model keeps the fail-loud Proxy honest.
  loanTransaction: [] as never[],
  // MON-076 Part A: getUserTaxPosition resolves income-earning household
  // members (per-person tax partitions). The golden household records no
  // members → findUnique(userId) returns null → the single-earner degenerate
  // case (perMember = [the primary], identical inputs to the household
  // position). The primary resolves via the one PERSONAL_NAME entity below.
  householdProfile: [] as never[],
  legalEntity: [
    { id: 'le-golden', userId: 'golden-user-avalon', type: 'PERSONAL_NAME', role: 'PERSONAL', createdAt: NOW },
  ],
};

/**
 * Declared kind of each Prisma `include` relation the Ring-2 routes touch:
 * 'many' → resolves to `[]`, 'one' → resolves to `null`.
 *
 * DELIBERATELY EMPTY, NOT FK-resolved. The Ring-2 route tests assert the
 * HEADLINE canonical figures (net worth, totals) which the routes compute from
 * the TOP-LEVEL golden arrays via the canonical engines — never from these
 * nested includes. Leaving the includes empty keeps the mock simple and
 * verifiable (no hidden mini-ORM that could itself be buggy and produce a false
 * green). The trade-off is explicit and honest: a Ring-2 test on this harness
 * does NOT verify the GRDCS `_links`/`_meta` relational layer (that needs real
 * FK-resolved fixtures — a later, separate harness capability).
 *
 * Any include key NOT declared here THROWS (same fail-loud discipline as the
 * model-level Proxy) — so a route reading a new relation forces an explicit
 * decision, never a silent guess.
 */
export const INCLUDE_KINDS: Record<string, 'many' | 'one'> = {
  'property.loans': 'many', 'property.income': 'many', 'property.expenses': 'many', 'property.depreciationSchedules': 'many',
  'loan.property': 'one', 'loan.offsetAccount': 'one', 'loan.expenses': 'many',
  'account.linkedLoan': 'one',
  'income.property': 'one', 'income.investmentAccount': 'one',
  'expense.property': 'one', 'expense.loan': 'one', 'expense.investmentAccount': 'one', 'expense.asset': 'one',
  'investmentAccount.holdings': 'many', 'investmentAccount.transactions': 'many', 'investmentAccount.incomes': 'many', 'investmentAccount.expenses': 'many',
  'investmentHolding.investmentAccount': 'one', 'investmentHolding.transactions': 'many',
  'investmentTransaction.investmentAccount': 'one', 'investmentTransaction.holding': 'one',
  'asset.expenses': 'many', 'asset.valueHistory': 'many',
};

/**
 * Attach the requested `include` relations to a row as empty `[]` / `null`
 * (per INCLUDE_KINDS). Nested includes need no recursion — an empty parent
 * relation has no children to attach.
 */
function applyInclude(model: string, row: Record<string, unknown>, include: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row };
  for (const [key, spec] of Object.entries(include)) {
    if (!spec) continue;
    const kind = INCLUDE_KINDS[`${model}.${key}`];
    if (!kind) {
      throw new Error(
        `[Ring2 golden] unmapped include relation ${model}.${key} — declare it in INCLUDE_KINDS (goldenHousehold.ts) as 'many' or 'one'.`,
      );
    }
    out[key] = kind === 'many' ? [] : null;
  }
  return out;
}

/**
 * A `@/lib/db`-shaped mock over the golden rows. A Proxy that THROWS on any
 * model the golden DB doesn't serve — so a new query in a service/route fails
 * a Ring-2 test loudly (extend the fixture) instead of silently returning
 * undefined. `findUnique`/`findFirst` honour `where.id` so ownership/404
 * paths stay live.
 */
export function createGoldenDb() {
  return createGoldenDbFrom(GOLDEN_DB as unknown as Record<string, { id?: string }[]>);
}

/**
 * Build a `@/lib/db`-shaped mock over an ARBITRARY GOLDEN_DB-shaped rows object.
 * Identical fail-loud Proxy to {@link createGoldenDb}, but over rows passed in —
 * used by the Tier-3 metamorphic suite (NEOAUDIT.md §2 Tier 3), which runs the
 * REAL snapshot on a PERTURBED clone of the golden rows and compares the two
 * runs. No shared module constant, so each run is independent.
 */
export function createGoldenDbFrom(rowsByModel: Record<string, { id?: string }[]>) {
  const models = rowsByModel;
  return new Proxy(
    {},
    {
      get(_target, model: string | symbol) {
        if (typeof model === 'symbol' || model === 'then' || model === 'catch') return undefined;
        if (!(model in models)) {
          throw new Error(
            `[Ring2 golden] prisma.${String(model)} queried — not served by the golden DB. Extend tests/golden/goldenHousehold.ts.`,
          );
        }
        const rows = models[model];
        const withInc = (r: Record<string, unknown> | null, include?: Record<string, unknown>) =>
          r && include ? applyInclude(model, r, include) : r;
        return {
          findMany: async (args?: { include?: Record<string, unknown> }) =>
            structuredClone(rows).map((r) => withInc(r as Record<string, unknown>, args?.include)),
          findUnique: async ({ where, include }: { where: { id?: string }; include?: Record<string, unknown> }) =>
            withInc(structuredClone(rows.find((r) => r.id === where?.id) ?? null) as Record<string, unknown> | null, include),
          findFirst: async ({ include }: { include?: Record<string, unknown> } = {}) =>
            withInc(structuredClone(rows[0] ?? null) as Record<string, unknown> | null, include),
          // The golden book is single-user, so every `where: { userId }` (or a
          // related `{ property: { userId } }`) matches ALL rows of the model —
          // rows.length is the faithful count. (Not a general WHERE evaluator;
          // adequate + honest for a single-household fixture.)
          count: async () => rows.length,
          // Minimal faithful groupBy (used by getUserTaxPosition's per-loan
          // INTEREST_CHARGED sums): groups rows by the single `by` key and
          // sums the requested _sum fields, honouring a `where.<key>.in`
          // filter + `where.kind`. Extend if a caller needs more.
          groupBy: async (args: { by: string[]; where?: Record<string, unknown>; _sum?: Record<string, boolean> }) => {
            const key = args.by[0];
            let filtered = rows as Record<string, unknown>[];
            const where = (args.where ?? {}) as Record<string, any>;
            for (const [f, cond] of Object.entries(where)) {
              if (cond && typeof cond === 'object' && Array.isArray(cond.in)) {
                filtered = filtered.filter((r) => cond.in.includes(r[f]));
              } else if (typeof cond !== 'object') {
                filtered = filtered.filter((r) => r[f] === cond);
              }
            }
            const groups = new Map<unknown, Record<string, unknown>>();
            for (const r of filtered) {
              const g = groups.get(r[key]) ?? { [key]: r[key], _sum: Object.fromEntries(Object.keys(args._sum ?? {}).map((f) => [f, 0])) };
              for (const f of Object.keys(args._sum ?? {})) {
                (g._sum as Record<string, number>)[f] += Number(r[f] ?? 0);
              }
              groups.set(r[key], g);
            }
            return [...groups.values()];
          },
        };
      },
    },
  );
}

/** The hand-computed expected outputs (derivations in the header). */
export const EXPECTED = {
  assets: { properties: 800_000, accounts: 50_000, investments: 7_000, superannuation: 120_000, personalAssets: 15_000, total: 992_000 },
  liabilities: { mortgages: 500_000, personalLoans: 20_000, creditCards: 0, total: 520_000 },
  netWorth: 472_000,
  propertyEquity: 300_000,
  liquidCash: 50_000,
  cashflow: { monthlyNetIncome: 10_400, monthlyExpenses: 1_700, monthlyLoanRepayments: 3_400, monthlyCashflow: 5_300, savingsRate: 50.96 },
  expensesMonthly: { total: 1_700, essential: 1_400, discretionary: 300 },
  keptAfterEssentials: 9_000,
  emergencyFund: { monthsCovered: 50_000 / 1_700, gap: 0, targetMonths: 6, monthlyExpenses: 1_700 },
  property: { equity: 300_000, lvr: 62.5, annualRentalIncome: 31_200, monthlyCashflow: -400, rentalYield: 3.9, loanBalance: 500_000 },
  portfolio: { value: 800_000, equity: 300_000 },
  counts: { expenses: 3, income: 2, accounts: 2, loans: 2, properties: 1, investments: 1 },
  buckets: { liquidToday: 50_000, accessible: 7_000, lockedLongTerm: 415_000 },
  // Safety Net (MON-017 engine on canonical inputs, zero tracked bills):
  //   emergencyFund dim = min(29.4117…/6 × 40, 40) = 40
  //   bills = 0 (zero tracked bills is NOT full marks)
  //   noNewDebt = 15 (known placeholder) · cashflow = 15 (5,300 > 0)
  //   → total 70, grade BUILDING (60–79)
  safetyNet: { total: 70, grade: 'BUILDING', monthsCoveredRounded: 29.4, monthlySurplus: 5_300, weeksToTarget: 0 },
  // Cashflow route LITE mode (crude fallback: raw toMonthly sums, no dedup/tax).
  //   totalBalance    = 8,000 + 42,000                             = 50,000
  //   monthlyIncome   = 7,800 (salary) + 2,600 (rent 600/wk ×52/12) = 10,400
  //   monthlyExpenses = 1,200 + 200 (2,400/yr) + 300               = 1,700
  //   netCashflow30   = 10,400 − 1,700                             = 8,700
  //   withdrawableCash= max(0, 50,000 − 1,700×3)                   = 44,900
  //   breakEvenDay    = ceil(1,700 / (10,400/30)) = ceil(4.90)     = 5
  cashflowLite: {
    totalIncome30: 10_400, totalExpenses30: 1_700, netCashflow30: 8_700,
    monthlyBurnRate: 1_700, threeMonthBurnRate: 5_100, withdrawableCash: 44_900, breakEvenDay: 5,
  },
};
