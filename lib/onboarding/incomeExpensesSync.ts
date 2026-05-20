/**
 * incomeExpensesSync — Phase 12 Track F.8: onboarding ⇄ real-table two-way
 * sync for the INCOME / EXPENSES domain — the **last** Track F domain.
 *
 * ============================================================================
 * WHAT THIS IS
 * ============================================================================
 * Track F retires the onboarding "draft blob" model. F.8 makes the
 * income/expenses domain read + write the real `Income` + `Expense` tables
 * directly. The wizard's Income & Expenses step captures BOTH lists, so a
 * snapshot holds two arrays (`incomes` + `expenses`) and the diff produces
 * ops for both — but each is a flat entity (F.3-shaped), not an aggregate.
 *
 * ============================================================================
 * SCOPE — GENERAL income / expenses ONLY
 * ============================================================================
 * F.8 owns **general** (non-property, non-loan, non-asset, non-investment)
 * income + expenses. Property-attached income/expenses belong to F.2; asset
 * expenses to F.7; loan/investment-attached rows to other domains.
 *
 * `readIncomeExpenses()` therefore FILTERS — it includes only rows whose
 * `sourceType === 'GENERAL'` AND whose FK link fields are all null
 * (`propertyId` / `investmentAccountId` for income; `propertyId` / `loanId`
 * / `assetId` / `investmentAccountId` for expenses). On write, rows are
 * created with `sourceType: 'GENERAL'`. The diff/sync only ever
 * create/update/delete GENERAL rows — it never touches a property/asset/
 * loan/investment-attached row. This mirrors how F.3 filtered MANUAL-only
 * accounts and F.4 filtered standalone (non-property) loan types.
 *
 * Note: INVESTMENT-type income (`sourceType: 'INVESTMENT'`, linked to an
 * `InvestmentAccount`) is NOT general income — the step does not own it,
 * and `bulk-create` still creates it (section 6 preserved for that case).
 *
 * ============================================================================
 * §12.11 / §5 WRITE CONTRACT
 * ============================================================================
 *  1. CREATE for new income/expense rows (no real id) — POST. Never upsert.
 *  2. UPDATE / DELETE only for rows with a real-table `id`, via the
 *     ownership-guarded per-id API (`where: { id, userId }` server-side).
 *  3. IDEMPOTENT ON RE-ENTRY — `diffIncomeExpenses()` is pure; a no-edit
 *     re-entry diffs to zero ops.
 *  4. AUDIT — the income/expense routes already audit every state-changing
 *     write (generic `CREATE/UPDATE/DELETE`, `entityType: 'Income'` /
 *     `'Expense'`), added in F.2. F.8 introduces NO new audit actions and
 *     NO migration — it reuses the already-audited route surface.
 *
 * ============================================================================
 * BUDGET-VS-ACTUALS INVARIANT (design doc §6.4)
 * ============================================================================
 * The `/api/income` + `/api/expenses` GET routes return each row enriched
 * with transaction-reconciled actuals (`actualFromTransactions`,
 * `monthlyAverageActual`, `budgetAmount`, …) ALONGSIDE the raw budget
 * column `amount`. `readIncomeExpenses()` reads ONLY the raw `amount` — the
 * budget the user enters. The wizard owns the budget; transaction
 * reconciliation independently owns the actuals. The two-way sync touches
 * the budget layer only, so reconciliation is never disturbed.
 *
 * ============================================================================
 * QUALITY GUARDS
 * ============================================================================
 * A row with `amount <= 0` is dropped (matches `bulk-create` sections 6/7,
 * which both skip `amount > 0` only). A persisted row is always kept (even
 * at amount 0) so a real row the user blanked is correctly classified as a
 * delete-candidate via the diff, not silently dropped.
 *
 * `diffIncomeExpenses()` is PURE — the unit-testable idempotency core.
 * `readIncomeExpenses()` / `syncIncomeExpenses()` do the network I/O.
 */

import type {
  Frequency,
  IncomeType,
  SalaryType,
  ExpenseCategory,
  IncomeInput,
  ExpenseInput,
} from '@/components/onboarding/wizard/types';

// ============================================================================
// Snapshot shape
// ============================================================================

/** A general income source as it exists in the real `Income` table. */
export interface IncomeRecord {
  /** Real-table `Income` id once persisted; `undefined` for not-yet-saved. */
  id?: string;
  name: string;
  type: IncomeType;
  amount: number;
  frequency: Frequency;
  /** Only meaningful for `type === 'SALARY'`. */
  salaryType?: SalaryType;
}

/** A general expense as it exists in the real `Expense` table. */
export interface ExpenseRecord {
  /** Real-table `Expense` id once persisted; `undefined` for not-yet-saved. */
  id?: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  frequency: Frequency;
}

export interface IncomeExpensesSnapshot {
  incomes: IncomeRecord[];
  expenses: ExpenseRecord[];
}

export const EMPTY_INCOME_EXPENSES_SNAPSHOT: IncomeExpensesSnapshot = {
  incomes: [],
  expenses: [],
};

// ============================================================================
// id helpers
// ============================================================================

/**
 * A real id is a uuid. The wizard mints synthetic ids — `temp_…`
 * (`generateId()`) and `chat-…` (chat mode). `isPersistedId` distinguishes
 * them so the diff classifies a synthetic-id entity as CREATE.
 */
export function isPersistedId(id: string | undefined): boolean {
  if (!id) return false;
  return !id.startsWith('temp_') && !id.startsWith('chat-');
}

// ============================================================================
// READ — `readIncomeExpenses()`
// ============================================================================

interface RawIncome {
  id: string;
  name: string;
  type: IncomeType;
  amount: number;
  frequency: Frequency;
  salaryType: SalaryType | null;
  sourceType: string | null;
  propertyId: string | null;
  investmentAccountId: string | null;
}

interface RawExpense {
  id: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  frequency: Frequency;
  sourceType: string | null;
  propertyId: string | null;
  loanId: string | null;
  assetId: string | null;
  investmentAccountId: string | null;
}

/**
 * A raw income row is GENERAL — owned by the F.8 wizard step — only when
 * its `sourceType` is GENERAL AND it carries no property / investment FK.
 * Property rental income (F.2) and INVESTMENT-type income are excluded.
 */
function isGeneralIncome(row: RawIncome): boolean {
  return (
    (row.sourceType ?? 'GENERAL') === 'GENERAL' &&
    !row.propertyId &&
    !row.investmentAccountId
  );
}

/**
 * A raw expense row is GENERAL — owned by the F.8 wizard step — only when
 * its `sourceType` is GENERAL AND it carries no property / loan / asset /
 * investment FK. Property expenses (F.2) and asset expenses (F.7) are
 * excluded.
 */
function isGeneralExpense(row: RawExpense): boolean {
  return (
    (row.sourceType ?? 'GENERAL') === 'GENERAL' &&
    !row.propertyId &&
    !row.loanId &&
    !row.assetId &&
    !row.investmentAccountId
  );
}

/**
 * Read the user's GENERAL income + expenses from the real tables.
 *
 * GET `/api/income` + GET `/api/expenses` are fetched in parallel. Each
 * endpoint returns `{ data: [...] }` (no `success` envelope) and an empty
 * array for a user with no rows. Both rows are filtered to GENERAL-only
 * (see `isGeneralIncome` / `isGeneralExpense`) and only the raw budget
 * `amount` is read — never the transaction-reconciled actuals (§6.4).
 */
export async function readIncomeExpenses(
  token: string | null,
): Promise<IncomeExpensesSnapshot> {
  const headers: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};
  const [incomeRes, expenseRes] = await Promise.all([
    fetch('/api/income', { headers }),
    fetch('/api/expenses', { headers }),
  ]);
  if (!incomeRes.ok || !expenseRes.ok) {
    throw new Error('Could not load your income and expenses. Please try again.');
  }
  const [incomeJson, expenseJson] = await Promise.all([
    incomeRes.json().catch(() => null),
    expenseRes.json().catch(() => null),
  ]);
  const incomeRows: RawIncome[] = Array.isArray(incomeJson?.data)
    ? incomeJson.data
    : [];
  const expenseRows: RawExpense[] = Array.isArray(expenseJson?.data)
    ? expenseJson.data
    : [];

  return {
    incomes: incomeRows.filter(isGeneralIncome).map((i): IncomeRecord => ({
      id: i.id,
      name: i.name,
      type: i.type,
      // Raw budget column only — never the reconciled actuals (§6.4).
      amount: typeof i.amount === 'number' ? i.amount : 0,
      frequency: i.frequency,
      salaryType: i.salaryType ?? undefined,
    })),
    expenses: expenseRows.filter(isGeneralExpense).map((e): ExpenseRecord => ({
      id: e.id,
      name: e.name,
      category: e.category,
      // Raw budget column only — never the reconciled actuals (§6.4).
      amount: typeof e.amount === 'number' ? e.amount : 0,
      frequency: e.frequency,
    })),
  };
}

// ============================================================================
// DIFF — `diffIncomeExpenses()` — the PURE idempotency core
// ============================================================================

export interface RowOp<T> {
  op: 'create' | 'update' | 'delete';
  /** Real-table id — present for update/delete. */
  id?: string;
  record: T;
}

export interface IncomeExpensesDiff {
  incomeOps: RowOp<IncomeRecord>[];
  expenseOps: RowOp<ExpenseRecord>[];
}

function incomeEqual(a: IncomeRecord, b: IncomeRecord): boolean {
  return (
    a.name.trim() === b.name.trim() &&
    a.type === b.type &&
    a.amount === b.amount &&
    a.frequency === b.frequency &&
    (a.salaryType ?? null) === (b.salaryType ?? null)
  );
}

function expenseEqual(a: ExpenseRecord, b: ExpenseRecord): boolean {
  return (
    a.name.trim() === b.name.trim() &&
    a.category === b.category &&
    a.amount === b.amount &&
    a.frequency === b.frequency
  );
}

/**
 * Diff a flat list (income OR expenses) between snapshot + current, keyed
 * by real id. A row with no id → CREATE; a removed id → DELETE; a changed
 * row → UPDATE; an unchanged row → NO-OP (idempotency §5.3).
 */
function diffList<T extends { id?: string }>(
  prev: T[],
  curr: T[],
  equal: (a: T, b: T) => boolean,
): RowOp<T>[] {
  const prevById = new Map(
    prev.filter((r) => r.id).map((r) => [r.id as string, r]),
  );
  const currIds = new Set(curr.filter((r) => r.id).map((r) => r.id as string));
  const ops: RowOp<T>[] = [];

  for (const r of curr) {
    if (!r.id || !prevById.has(r.id)) {
      ops.push({ op: 'create', record: { ...r, id: undefined } });
      continue;
    }
    const prevR = prevById.get(r.id) as T;
    if (!equal(prevR, r)) ops.push({ op: 'update', id: r.id, record: r });
    // else: unchanged → NO-OP.
  }
  for (const prevR of prev) {
    if (prevR.id && !currIds.has(prevR.id)) {
      ops.push({ op: 'delete', id: prevR.id, record: prevR });
    }
  }
  return ops;
}

/**
 * Diff the wizard step's CURRENT income/expenses against the step-open
 * snapshot. Re-opening the step and pressing "Continue" with zero edits
 * produces empty op lists — so `syncIncomeExpenses()` writes nothing.
 *
 * PURE — no fetch, no React. This is the unit-testable contract.
 */
export function diffIncomeExpenses(
  snapshot: IncomeExpensesSnapshot,
  current: IncomeExpensesSnapshot,
): IncomeExpensesDiff {
  return {
    incomeOps: diffList(snapshot.incomes, current.incomes, incomeEqual),
    expenseOps: diffList(snapshot.expenses, current.expenses, expenseEqual),
  };
}

// ============================================================================
// WRITE — `syncIncomeExpenses()`
// ============================================================================

export interface IncomeExpensesSyncResult {
  snapshot: IncomeExpensesSnapshot;
}

function incomePayload(i: IncomeRecord): Record<string, unknown> {
  return {
    name: i.name.trim() || i.type,
    type: i.type,
    amount: i.amount,
    frequency: i.frequency,
    // GENERAL — F.8 owns only non-property, non-investment income.
    sourceType: 'GENERAL',
    ...(i.type === 'SALARY' && i.salaryType ? { salaryType: i.salaryType } : {}),
  };
}

function expensePayload(e: ExpenseRecord): Record<string, unknown> {
  return {
    name: e.name.trim() || e.category,
    category: e.category,
    amount: e.amount,
    frequency: e.frequency,
    // GENERAL — F.8 owns only non-property, non-loan, non-asset expenses.
    sourceType: 'GENERAL',
  };
}

async function applyIncomeOp(
  headers: Record<string, string>,
  op: RowOp<IncomeRecord>,
): Promise<void> {
  if (op.op === 'delete') {
    const res = await fetch(`/api/income/${op.id}`, { method: 'DELETE', headers });
    if (!res.ok && res.status !== 404) {
      throw new Error(
        `Could not remove the income "${op.record.name || 'unnamed'}". Please try again.`,
      );
    }
    return;
  }
  if (op.op === 'create') {
    const res = await fetch('/api/income', {
      method: 'POST',
      headers,
      body: JSON.stringify(incomePayload(op.record)),
    });
    if (!res.ok) {
      throw new Error(
        `Could not save the income "${op.record.name || 'unnamed'}". Please try again.`,
      );
    }
    return;
  }
  // update
  const res = await fetch(`/api/income/${op.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(incomePayload(op.record)),
  });
  if (!res.ok) {
    throw new Error(
      `Could not update the income "${op.record.name || 'unnamed'}". Please try again.`,
    );
  }
}

async function applyExpenseOp(
  headers: Record<string, string>,
  op: RowOp<ExpenseRecord>,
): Promise<void> {
  if (op.op === 'delete') {
    const res = await fetch(`/api/expenses/${op.id}`, { method: 'DELETE', headers });
    if (!res.ok && res.status !== 404) {
      throw new Error(
        `Could not remove the expense "${op.record.name || 'unnamed'}". Please try again.`,
      );
    }
    return;
  }
  if (op.op === 'create') {
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers,
      body: JSON.stringify(expensePayload(op.record)),
    });
    if (!res.ok) {
      throw new Error(
        `Could not save the expense "${op.record.name || 'unnamed'}". Please try again.`,
      );
    }
    return;
  }
  // update
  const res = await fetch(`/api/expenses/${op.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(expensePayload(op.record)),
  });
  if (!res.ok) {
    throw new Error(
      `Could not update the expense "${op.record.name || 'unnamed'}". Please try again.`,
    );
  }
}

/**
 * Persist the wizard step's GENERAL income + expenses to the real tables.
 *
 *   1. Diff `current` against `snapshot` (pure — see `diffIncomeExpenses`).
 *   2. Apply each income op, then each expense op (CREATE → POST,
 *      UPDATE → PUT, DELETE → DELETE).
 *   3. Re-read and return the fresh snapshot.
 *
 * Every write goes through the already-audited `/api/income` +
 * `/api/expenses` routes — no new audit actions, no migration (F.8).
 *
 * @throws if any individual write fails — the caller surfaces the error.
 */
export async function syncIncomeExpenses(
  token: string | null,
  snapshot: IncomeExpensesSnapshot,
  current: IncomeExpensesSnapshot,
): Promise<IncomeExpensesSyncResult> {
  const diff = diffIncomeExpenses(snapshot, current);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  for (const op of diff.incomeOps) {
    await applyIncomeOp(headers, op);
  }
  for (const op of diff.expenseOps) {
    await applyExpenseOp(headers, op);
  }

  const fresh = await readIncomeExpenses(token);
  return { snapshot: fresh };
}

// ============================================================================
// MAPPERS — bridge the snapshot ⇄ wizard `WizardData.income` / `.expenses`.
// ============================================================================

let syntheticCounter = 0;
function syntheticId(prefix: string): string {
  syntheticCounter += 1;
  return `temp_${prefix}_${Date.now()}_${syntheticCounter}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/**
 * Map a real-table snapshot → the wizard step's `IncomeInput[]`. Real ids
 * become the wizard ids; a not-yet-saved row gets a synthetic `temp_…` id
 * for React keys.
 */
export function snapshotToWizardIncome(
  snapshot: IncomeExpensesSnapshot,
): IncomeInput[] {
  return snapshot.incomes.map((i): IncomeInput => ({
    id: i.id ?? syntheticId('income'),
    name: i.name,
    type: i.type,
    amount: i.amount,
    frequency: i.frequency,
    salaryType: i.salaryType,
  }));
}

/**
 * Map a real-table snapshot → the wizard step's `ExpenseInput[]`.
 */
export function snapshotToWizardExpenses(
  snapshot: IncomeExpensesSnapshot,
): ExpenseInput[] {
  return snapshot.expenses.map((e): ExpenseInput => ({
    id: e.id ?? syntheticId('expense'),
    name: e.name,
    category: e.category,
    amount: e.amount,
    frequency: e.frequency,
  }));
}

/**
 * Map the wizard step's `IncomeInput[]` + `ExpenseInput[]` → an
 * `IncomeExpensesSnapshot` for `diffIncomeExpenses` / `syncIncomeExpenses`.
 *
 * - Synthetic ids drop to `undefined` so the diff classifies them as CREATE.
 * - An UNPERSISTED row with `amount <= 0` is dropped (incomplete in-session
 *   row; matches `bulk-create` sections 6/7 which both skip non-positive
 *   amounts). A PERSISTED row is always kept — a real row the user blanked
 *   stays in the snapshot so the diff can still see + update/keep it.
 */
export function wizardToSnapshotIncomeExpenses(
  income: IncomeInput[],
  expenses: ExpenseInput[],
): IncomeExpensesSnapshot {
  return {
    incomes: income
      .filter((i) => isPersistedId(i.id) || i.amount > 0)
      .map((i): IncomeRecord => ({
        id: isPersistedId(i.id) ? i.id : undefined,
        name: i.name,
        type: i.type,
        amount: i.amount,
        frequency: i.frequency,
        salaryType: i.salaryType,
      })),
    expenses: expenses
      .filter((e) => isPersistedId(e.id) || e.amount > 0)
      .map((e): ExpenseRecord => ({
        id: isPersistedId(e.id) ? e.id : undefined,
        name: e.name,
        category: e.category,
        amount: e.amount,
        frequency: e.frequency,
      })),
  };
}
