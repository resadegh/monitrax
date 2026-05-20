/**
 * propertiesSync — Phase 12 Track F.2: onboarding ⇄ real-table two-way sync
 * for the PROPERTIES domain (the "whole property aggregate").
 *
 * ============================================================================
 * WHAT THIS IS
 * ============================================================================
 * Track F retires the onboarding "draft blob" model in which the wizard
 * staged everything into `UserPreference.onboardingDraft` and only wrote the
 * real entity tables once, at the final `/api/onboarding/bulk-create`. That
 * model meant `/dashboard/properties` showed empty while the wizard held a
 * full property portfolio — a §12.2 SSOT violation.
 *
 * F.2 makes the properties domain read + write the REAL tables directly. Per
 * Reza's 2026-05-20 scope decision the unit is the **whole property
 * aggregate** — a `Property` PLUS its mortgage `Loan`, its rental `Income`
 * and its property `Expense` rows — because the wizard's property card
 * captures all of them together and a user thinks of "a property" as one
 * thing. Re-entering the wizard must reconfirm ALL of a property's data, not
 * half of it.
 *
 * This module is the properties domain's read/diff/write layer. It mirrors
 * `lib/onboarding/householdSync.ts` (F.1) — the canonical pattern — extended
 * from 3 flat household entities to a nested 4-entity aggregate.
 *
 * Scope boundary (F.4 / F.8): the loan / income / expense rows F.2 writes are
 * the ones ATTACHED TO A PROPERTY (the property card's mortgage / rent /
 * expenses). Standalone non-property debts stay F.4's; general non-property
 * income/expenses stay F.8's.
 *
 * ============================================================================
 * WHY IT CALLS THE ENTITY APIs (NOT FRESH PRISMA)
 * ============================================================================
 * The property / loan / income / expense entity APIs already exist and
 * already power the dashboard:
 *   - GET            /api/properties        (includes loans/income/expenses)
 *   - POST           /api/properties
 *   - PUT / DELETE   /api/properties/[id]
 *   - POST           /api/loans,   PUT/DELETE /api/loans/[id]
 *   - POST           /api/income,  PUT/DELETE /api/income/[id]
 *   - POST           /api/expenses, PUT/DELETE /api/expenses/[id]
 *
 * Every per-id route is ownership-guarded — it loads the row and runs
 * `verifyOwnership(row, userId, …)` before any `update` / `delete`. A row
 * owned by a different user is never mutated. That is the §12.11 guarantee we
 * need, so this module **calls those APIs** rather than re-implementing
 * writes. It is a rewire, not new write logic.
 *
 * ============================================================================
 * §12.11 / §5 WRITE CONTRACT — how this module satisfies it
 * ============================================================================
 *  1. CREATE for new entities (no real-table `id`) — POST. Never blind upsert.
 *  2. UPDATE / DELETE only for entities that ALREADY have a real-table `id`,
 *     routed through the per-id entity API whose `verifyOwnership` guard
 *     ensures the caller can only ever touch their own rows.
 *  3. IDEMPOTENT ON RE-ENTRY — `diffProperties()` compares the wizard step's
 *     current state (each entity carries its real-table `id` once saved)
 *     against the snapshot read on step-open:
 *       - in state, no `id`            → CREATE
 *       - in state with `id`, changed  → UPDATE
 *       - in state with `id`, same     → NO-OP (kills duplicates on
 *                                         "re-open + Continue with no edits")
 *       - had `id`, absent from state  → DELETE (hard-delete — design Q-F2)
 *  4. AUDIT — the property entity routes audit every state-changing write via
 *     `createAuditLog()` (added in F.2 alongside this module, since these
 *     routes are now the wizard's SSOT write boundary for properties).
 *
 * ============================================================================
 * QUALITY GUARDS (financial-adviser lens)
 * ============================================================================
 * A $0/0%/0-repayment loan, a $0 rental income or a $0 expense is worse than
 * no row — it pollutes the debt total / LVR / cashflow with false precision.
 * `wizardPropertiesToSnapshot()` therefore DROPS:
 *   - a loan whose `principal <= 0` (a mortgage is defined by its balance)
 *   - rental income whose `amount <= 0`
 *   - any expense whose `amount <= 0`
 * (Same guards `bulk-create` already applied to income/expenses; stricter on
 * loans.) The wizard UI still shows the half-filled row — it is just not
 * persisted until it carries a real number.
 *
 * ============================================================================
 * PURE vs IMPURE
 * ============================================================================
 * `diffProperties()` is PURE — no fetch, no React — and is the unit-testable
 * core of the idempotency guarantee. `readProperties()` / `syncProperties()`
 * do the network I/O. The wizard step consumes all three.
 */

import type {
  PropertyType,
  RateType,
  RepaymentFrequency,
  Frequency,
  ExpenseCategory,
  PropertyInput,
  PropertyLoanInput,
  PropertyExpenseInput,
} from '@/components/onboarding/wizard/types';

// ============================================================================
// Snapshot shape — what `readProperties()` returns and what the wizard holds
// so a later `syncProperties()` can diff against it.
// ============================================================================

/** A property's mortgage as it exists in the real `Loan` table.
 *  `interestRateAnnual` is a PERCENTAGE here (e.g. 6.25) to match the wizard
 *  `PropertyLoanInput`; the real table stores a decimal (0.0625) — the
 *  conversion happens at the read/write boundary, NOT in this shape. */
export interface PropertyLoanRecord {
  /** Real-table `Loan` id once persisted; `undefined` for a not-yet-saved loan. */
  id?: string;
  /** What the user typed in the wizard's "Lender" field. Becomes the real
   *  `Loan.name` on write (the real table has no separate lender column). */
  lender: string;
  principal: number;
  /** PERCENTAGE — e.g. 6.25 means 6.25% p.a. */
  interestRateAnnual: number;
  rateType: RateType;
  isInterestOnly: boolean;
  termMonthsRemaining: number;
  minRepayment: number;
  repaymentFrequency: RepaymentFrequency;
}

/** A property's rental income as it exists in the real `Income` table. */
export interface PropertyIncomeRecord {
  /** Real-table `Income` id once persisted; `undefined` for not-yet-saved. */
  id?: string;
  amount: number;
  frequency: Frequency;
  /** Wizard-only UI sugar — NOT persisted (the real `Income` table has no
   *  tenant column). Carried so the wizard step can round-trip it. */
  tenantName?: string;
}

/** A property expense as it exists in the real `Expense` table. */
export interface PropertyExpenseRecord {
  /** Real-table `Expense` id once persisted; `undefined` for not-yet-saved. */
  id?: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  frequency: Frequency;
}

/** A property as it exists in the real `Property` table, plus its aggregate. */
export interface PropertyRecord {
  /** Real-table `Property` id once persisted; `undefined` for not-yet-saved. */
  id?: string;
  name: string;
  address: string;
  type: PropertyType;
  purchasePrice: number;
  currentValue: number;
  /** ISO date string (yyyy-mm-dd). Required by the entity API on write. */
  purchaseDate?: string;
  /** ISO date string (yyyy-mm-dd). The wizard never edits this — it is read
   *  from the real table and re-sent verbatim; a brand-new property gets
   *  today's date at write time. Excluded from the change-diff. */
  valuationDate?: string;
  /** Phase 41E reform input — see CLAUDE.md §12.14. */
  acquisitionContractDate?: string;
  /** Phase 41E reform input. */
  isNewBuild?: boolean;
  /** Phase 41E reform input. */
  newBuildEvidence?: PropertyInput['newBuildEvidence'];
  /** True when the user has ticked "has a mortgage". A loan is only persisted
   *  when `hasLoan` AND `loan` AND `loan.principal > 0` (see the quality
   *  guards above). */
  hasLoan: boolean;
  loan?: PropertyLoanRecord;
  /** Rental income — only meaningful for INVESTMENT properties. */
  income?: PropertyIncomeRecord;
  expenses: PropertyExpenseRecord[];
}

/** The full properties snapshot — the wizard step's source of truth. */
export interface PropertiesSnapshot {
  properties: PropertyRecord[];
}

/** Empty snapshot — used when the user has no properties yet. */
export const EMPTY_PROPERTIES_SNAPSHOT: PropertiesSnapshot = {
  properties: [],
};

// ============================================================================
// Phase 41E reform cut-over (CLAUDE.md §12.14)
// ============================================================================

/**
 * 7:30pm AEST 12 May 2026 = `2026-05-12T09:30:00Z`. Mirrors
 * `bulk-create`'s constant and `REFORM_CUT_OVER_UTC` in
 * `lib/tax-engine/config/reformConstants.ts`. Used only to decide the
 * `acquisitionContractDate` backfill on write — F.2 stores reform INPUTS,
 * it never applies post-reform MATH (FW-2: no silent post-reform numbers).
 */
const REFORM_CUT_OVER_UTC_MS = Date.UTC(2026, 4, 12, 9, 30, 0);

// ============================================================================
// READ — `readProperties()`
// ============================================================================

interface RawLoan {
  id: string;
  name: string;
  principal: number;
  interestRateAnnual: number; // decimal in the DB
  rateType: RateType;
  isInterestOnly: boolean;
  termMonthsRemaining: number;
  minRepayment: number;
  repaymentFrequency: RepaymentFrequency;
}
interface RawIncome {
  id: string;
  type: string;
  amount: number;
  frequency: Frequency;
}
interface RawExpense {
  id: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  frequency: Frequency;
}
interface RawProperty {
  id: string;
  name: string;
  address: string | null;
  type: PropertyType;
  purchasePrice: number;
  purchaseDate: string | null;
  currentValue: number;
  valuationDate: string | null;
  acquisitionContractDate: string | null;
  isNewBuild: boolean | null;
  newBuildEvidence: PropertyInput['newBuildEvidence'] | null;
  loans?: RawLoan[];
  income?: RawIncome[];
  expenses?: RawExpense[];
}

/** Strip a DB DateTime string to yyyy-mm-dd, or `undefined`. */
function toDateInput(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return String(value).split('T')[0];
}

/**
 * Read the user's properties from the real tables.
 *
 * Mirrors the call `/dashboard/properties` makes: a single GET to
 * `/api/properties`, which `include`s loans + income + expenses. The
 * endpoint returns `{ data: [...] }` (no `success` envelope) and an empty
 * array for a user with no properties (NOT a 404).
 *
 * Aggregate mapping decisions:
 *   - `loan`   — the FIRST loan on the property. The wizard models one
 *                mortgage per property; if the real table somehow holds a
 *                second loan it is left untouched (the diff only manages the
 *                loan that was in the snapshot).
 *   - `income` — the first RENTAL-type income (the wizard only ever creates
 *                rental income for investment properties).
 *   - `expenses` — every property expense.
 *
 * Loan interest rate is converted DB-decimal → wizard-percentage here.
 */
export async function readProperties(token: string | null): Promise<PropertiesSnapshot> {
  const res = await fetch('/api/properties', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error('Could not load your properties. Please try again.');
  }
  const json = await res.json().catch(() => null);
  const rows: RawProperty[] = Array.isArray(json?.data) ? json.data : [];

  return {
    properties: rows.map((p): PropertyRecord => {
      const firstLoan = p.loans?.[0];
      const rentalIncome = (p.income ?? []).find(
        (i) => i.type === 'RENTAL' || i.type === 'RENT',
      );
      return {
        id: p.id,
        name: p.name,
        address: p.address ?? '',
        type: p.type,
        purchasePrice: typeof p.purchasePrice === 'number' ? p.purchasePrice : 0,
        currentValue: typeof p.currentValue === 'number' ? p.currentValue : 0,
        purchaseDate: toDateInput(p.purchaseDate),
        valuationDate: toDateInput(p.valuationDate),
        acquisitionContractDate: toDateInput(p.acquisitionContractDate),
        isNewBuild: p.isNewBuild ?? undefined,
        newBuildEvidence: p.newBuildEvidence ?? undefined,
        hasLoan: !!firstLoan,
        loan: firstLoan
          ? {
              id: firstLoan.id,
              // Real table has no lender column — the loan name carries it.
              lender: firstLoan.name,
              principal: firstLoan.principal,
              // DB stores a decimal (0.0625); the wizard works in percent.
              interestRateAnnual: round2(firstLoan.interestRateAnnual * 100),
              rateType: firstLoan.rateType,
              isInterestOnly: firstLoan.isInterestOnly,
              termMonthsRemaining: firstLoan.termMonthsRemaining,
              minRepayment: firstLoan.minRepayment,
              repaymentFrequency: firstLoan.repaymentFrequency,
            }
          : undefined,
        income: rentalIncome
          ? {
              id: rentalIncome.id,
              amount: rentalIncome.amount,
              frequency: rentalIncome.frequency,
            }
          : undefined,
        expenses: (p.expenses ?? []).map(
          (e): PropertyExpenseRecord => ({
            id: e.id,
            name: e.name,
            category: e.category,
            amount: e.amount,
            frequency: e.frequency,
          }),
        ),
      };
    }),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ============================================================================
// DIFF — `diffProperties()` — the PURE idempotency core
// ============================================================================

/** One create/update/delete on a nested child entity (loan/income/expense). */
export interface ChildOp<T> {
  op: 'create' | 'update' | 'delete';
  /** Real-table id — present for update/delete, absent for create. */
  id?: string;
  record: T;
}

/** One create/update/delete on a property and its whole aggregate. */
export interface PropertyOp {
  op: 'create' | 'update' | 'delete';
  /** Real-table `Property` id — present for update/delete, absent for create. */
  id?: string;
  record: PropertyRecord;
  /** For `update`: whether any `Property` scalar field changed (→ issue a
   *  PUT). Always `true` for `create`/`delete`. */
  coreChanged: boolean;
  loanOps: ChildOp<PropertyLoanRecord>[];
  incomeOps: ChildOp<PropertyIncomeRecord>[];
  expenseOps: ChildOp<PropertyExpenseRecord>[];
}

export interface PropertiesDiff {
  /** Only properties that actually need a write appear here. A no-edit
   *  re-entry produces `propertyOps: []` → `syncProperties` does nothing. */
  propertyOps: PropertyOp[];
}

/** The real `Loan.name` a record will be written with — derived from the
 *  wizard "Lender" field. Used both on write and in the change-diff. */
function loanName(loan: PropertyLoanRecord): string {
  return loan.lender.trim() || 'Mortgage';
}

function propertyCoreEqual(a: PropertyRecord, b: PropertyRecord): boolean {
  return (
    a.name.trim() === b.name.trim() &&
    a.address.trim() === b.address.trim() &&
    a.type === b.type &&
    a.purchasePrice === b.purchasePrice &&
    a.currentValue === b.currentValue &&
    (a.purchaseDate || '') === (b.purchaseDate || '') &&
    (a.acquisitionContractDate || '') === (b.acquisitionContractDate || '') &&
    (a.isNewBuild ?? null) === (b.isNewBuild ?? null) &&
    (a.newBuildEvidence ?? null) === (b.newBuildEvidence ?? null)
    // valuationDate is intentionally excluded — the wizard never edits it.
  );
}

function loanEqual(a: PropertyLoanRecord, b: PropertyLoanRecord): boolean {
  return (
    loanName(a) === loanName(b) &&
    a.principal === b.principal &&
    a.interestRateAnnual === b.interestRateAnnual &&
    a.rateType === b.rateType &&
    a.isInterestOnly === b.isInterestOnly &&
    a.termMonthsRemaining === b.termMonthsRemaining &&
    a.minRepayment === b.minRepayment &&
    a.repaymentFrequency === b.repaymentFrequency
  );
}

function incomeEqual(a: PropertyIncomeRecord, b: PropertyIncomeRecord): boolean {
  return a.amount === b.amount && a.frequency === b.frequency;
}

function expenseEqual(a: PropertyExpenseRecord, b: PropertyExpenseRecord): boolean {
  return (
    a.name.trim() === b.name.trim() &&
    a.category === b.category &&
    a.amount === b.amount &&
    a.frequency === b.frequency
  );
}

/** Diff a single optional child (loan or income) between snapshot + current. */
function diffSingleChild<T extends { id?: string }>(
  prev: T | undefined,
  curr: T | undefined,
  equal: (a: T, b: T) => boolean,
): ChildOp<T>[] {
  if (!prev && !curr) return [];
  if (!prev && curr) {
    // New child — strip any defensive id so it is unambiguously a CREATE.
    return [{ op: 'create', record: { ...curr, id: undefined } }];
  }
  if (prev && !curr) {
    return prev.id ? [{ op: 'delete', id: prev.id, record: prev }] : [];
  }
  // Both present.
  const p = prev as T;
  const c = curr as T;
  if (!c.id) {
    // Current child has no id — it never persisted. Replace: delete the old,
    // create the new. (Rare — the wizard keeps ids across edits.)
    const ops: ChildOp<T>[] = [{ op: 'create', record: { ...c, id: undefined } }];
    if (p.id) ops.unshift({ op: 'delete', id: p.id, record: p });
    return ops;
  }
  if (c.id !== p.id) {
    // Different persisted child — delete old, the new one is its own UPDATE.
    return [
      { op: 'delete', id: p.id as string, record: p },
      ...(equal(p, c) ? [] : [{ op: 'update' as const, id: c.id, record: c }]),
    ];
  }
  return equal(p, c) ? [] : [{ op: 'update', id: c.id, record: c }];
}

/** Diff an array of children (expenses) between snapshot + current, keyed by id. */
function diffChildArray<T extends { id?: string }>(
  prev: T[],
  curr: T[],
  equal: (a: T, b: T) => boolean,
): ChildOp<T>[] {
  const prevById = new Map(prev.filter((x) => x.id).map((x) => [x.id as string, x]));
  const currIds = new Set(curr.filter((x) => x.id).map((x) => x.id as string));
  const ops: ChildOp<T>[] = [];
  for (const c of curr) {
    if (!c.id) {
      ops.push({ op: 'create', record: c });
      continue;
    }
    const p = prevById.get(c.id);
    if (!p) {
      ops.push({ op: 'create', record: { ...c, id: undefined } });
      continue;
    }
    if (!equal(p, c)) ops.push({ op: 'update', id: c.id, record: c });
  }
  for (const p of prev) {
    if (p.id && !currIds.has(p.id)) {
      ops.push({ op: 'delete', id: p.id, record: p });
    }
  }
  return ops;
}

/**
 * Diff the wizard step's CURRENT property portfolio against the snapshot read
 * on step-open. This is the function that makes re-entry idempotent:
 * re-opening the step and clicking "Continue" with zero edits produces
 * `propertyOps: []` — so `syncProperties()` performs ZERO writes and no
 * duplicate rows can appear.
 *
 * PURE — no fetch, no React. This is the unit-testable contract.
 *
 * @param snapshot  the portfolio as it was when the step opened
 * @param current   the portfolio as the user has it now in the step
 */
export function diffProperties(
  snapshot: PropertiesSnapshot,
  current: PropertiesSnapshot,
): PropertiesDiff {
  const snapshotById = new Map(
    snapshot.properties.filter((p) => p.id).map((p) => [p.id as string, p]),
  );
  const currentIds = new Set(
    current.properties.filter((p) => p.id).map((p) => p.id as string),
  );

  const propertyOps: PropertyOp[] = [];

  for (const p of current.properties) {
    if (!p.id || !snapshotById.has(p.id)) {
      // New property (no id) — or an id the snapshot doesn't know (defensive).
      // CREATE the property and every child it carries.
      propertyOps.push({
        op: 'create',
        record: { ...p, id: undefined },
        coreChanged: true,
        loanOps: p.loan ? [{ op: 'create', record: { ...p.loan, id: undefined } }] : [],
        incomeOps: p.income
          ? [{ op: 'create', record: { ...p.income, id: undefined } }]
          : [],
        expenseOps: p.expenses.map((e) => ({
          op: 'create' as const,
          record: { ...e, id: undefined },
        })),
      });
      continue;
    }
    // Existing property — diff core + each child.
    const prev = snapshotById.get(p.id) as PropertyRecord;
    const coreChanged = !propertyCoreEqual(prev, p);
    const loanOps = diffSingleChild(prev.loan, p.loan, loanEqual);
    const incomeOps = diffSingleChild(prev.income, p.income, incomeEqual);
    const expenseOps = diffChildArray(prev.expenses, p.expenses, expenseEqual);
    if (coreChanged || loanOps.length || incomeOps.length || expenseOps.length) {
      propertyOps.push({
        op: 'update',
        id: p.id,
        record: p,
        coreChanged,
        loanOps,
        incomeOps,
        expenseOps,
      });
    }
    // else: nothing changed → NO-OP (idempotency §5.3).
  }

  // Properties in the snapshot the user removed → DELETE the whole aggregate.
  for (const prev of snapshot.properties) {
    if (prev.id && !currentIds.has(prev.id)) {
      propertyOps.push({
        op: 'delete',
        id: prev.id,
        record: prev,
        coreChanged: true,
        // Children are hard-deleted first so no orphan loan/income/expense
        // rows are left behind (Loan→Property is onDelete:SetNull, so
        // deleting the property alone would orphan the mortgage).
        loanOps: prev.loan?.id
          ? [{ op: 'delete', id: prev.loan.id, record: prev.loan }]
          : [],
        incomeOps: prev.income?.id
          ? [{ op: 'delete', id: prev.income.id, record: prev.income }]
          : [],
        expenseOps: prev.expenses
          .filter((e) => e.id)
          .map((e) => ({ op: 'delete' as const, id: e.id, record: e })),
      });
    }
  }

  return { propertyOps };
}

// ============================================================================
// WRITE — `syncProperties()`
// ============================================================================

export interface PropertiesSyncResult {
  /** The portfolio as it now exists in the real tables (re-read after writes). */
  snapshot: PropertiesSnapshot;
}

/** Map a `PropertyType` → the `LoanType` used for a property mortgage. */
function loanTypeForProperty(type: PropertyType): 'HOME' | 'INVESTMENT' {
  return type === 'HOME' ? 'HOME' : 'INVESTMENT';
}

/**
 * Persist the wizard step's property portfolio to the real tables.
 *
 * Algorithm:
 *   1. Diff `current` against `snapshot` (pure — see `diffProperties`).
 *   2. For each property op, in order:
 *      - CREATE — POST the property, capture its real id, then POST every
 *        child (loan / income / expense) with that `propertyId`.
 *      - UPDATE — PUT the property if its core changed, then apply each
 *        child op (POST create / PUT update / DELETE delete).
 *      - DELETE — delete every child first (avoids orphaned loan/income/
 *        expense rows), then DELETE the property.
 *   3. Re-read and return the fresh snapshot so the caller can re-seed the
 *      step state with real-table ids (making the NEXT Continue idempotent).
 *
 * @throws if any individual write fails — the caller surfaces the error and
 *         the user can retry. Retry is safe: already-applied writes left
 *         their ids in the re-read snapshot, so the next diff sees them.
 */
export async function syncProperties(
  token: string | null,
  snapshot: PropertiesSnapshot,
  current: PropertiesSnapshot,
): Promise<PropertiesSyncResult> {
  const diff = diffProperties(snapshot, current);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  for (const op of diff.propertyOps) {
    if (op.op === 'delete') {
      await deletePropertyAggregate(headers, op);
    } else if (op.op === 'create') {
      await createPropertyAggregate(headers, op);
    } else {
      await updatePropertyAggregate(headers, op);
    }
  }

  const fresh = await readProperties(token);
  return { snapshot: fresh };
}

/** POST a new property + all of its children. */
async function createPropertyAggregate(
  headers: Record<string, string>,
  op: PropertyOp,
): Promise<void> {
  const res = await fetch('/api/properties', {
    method: 'POST',
    headers,
    body: JSON.stringify(propertyPayload(op.record)),
  });
  if (!res.ok) {
    throw new Error(
      `Could not save the property "${op.record.name || 'unnamed'}". Please try again.`,
    );
  }
  const created = (await res.json().catch(() => null)) as { id?: string } | null;
  const propertyId = created?.id;
  if (!propertyId) {
    throw new Error('The property was saved but returned no id — please retry.');
  }
  // All children of a brand-new property are creates.
  for (const loanOp of op.loanOps) {
    await applyLoanOp(headers, loanOp, propertyId, op.record.type);
  }
  for (const incomeOp of op.incomeOps) {
    await applyIncomeOp(headers, incomeOp, propertyId, op.record.name);
  }
  for (const expenseOp of op.expenseOps) {
    await applyExpenseOp(headers, expenseOp, propertyId, op.record.type);
  }
}

/** PUT a changed property core (if any) + apply each child op. */
async function updatePropertyAggregate(
  headers: Record<string, string>,
  op: PropertyOp,
): Promise<void> {
  const propertyId = op.id as string;
  if (op.coreChanged) {
    const res = await fetch(`/api/properties/${propertyId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(propertyPayload(op.record)),
    });
    if (!res.ok) {
      throw new Error(
        `Could not update the property "${op.record.name || 'unnamed'}". Please try again.`,
      );
    }
  }
  for (const loanOp of op.loanOps) {
    await applyLoanOp(headers, loanOp, propertyId, op.record.type);
  }
  for (const incomeOp of op.incomeOps) {
    await applyIncomeOp(headers, incomeOp, propertyId, op.record.name);
  }
  for (const expenseOp of op.expenseOps) {
    await applyExpenseOp(headers, expenseOp, propertyId, op.record.type);
  }
}

/** DELETE every child, then the property itself (hard-delete — Q-F2). */
async function deletePropertyAggregate(
  headers: Record<string, string>,
  op: PropertyOp,
): Promise<void> {
  for (const loanOp of op.loanOps) {
    await applyLoanOp(headers, loanOp, op.id as string, op.record.type);
  }
  for (const incomeOp of op.incomeOps) {
    await applyIncomeOp(headers, incomeOp, op.id as string, op.record.name);
  }
  for (const expenseOp of op.expenseOps) {
    await applyExpenseOp(headers, expenseOp, op.id as string, op.record.type);
  }
  const res = await fetch(`/api/properties/${op.id}`, { method: 'DELETE', headers });
  // 404 = already gone (retry after a partial success) — treat as success.
  if (!res.ok && res.status !== 404) {
    throw new Error(
      `Could not remove the property "${op.record.name || 'unnamed'}". Please try again.`,
    );
  }
}

/** Build the `/api/properties` POST/PUT body, applying the Phase 41E
 *  cut-over backfill (CLAUDE.md §12.14) — identical rule to bulk-create:
 *  pre-cut-over purchases auto-fill `acquisitionContractDate := purchaseDate`
 *  (unambiguously grandfathered); post-cut-over use the user-confirmed value
 *  or null. F.2 stores reform INPUTS only — no post-reform math (FW-2). */
function propertyPayload(p: PropertyRecord): Record<string, unknown> {
  const purchaseDate = p.purchaseDate || new Date().toISOString().slice(0, 10);
  const purchaseMs = new Date(purchaseDate).getTime();
  const isPostCutOver =
    !Number.isNaN(purchaseMs) && purchaseMs > REFORM_CUT_OVER_UTC_MS;
  const acquisitionContractDate = p.acquisitionContractDate
    ? p.acquisitionContractDate
    : isPostCutOver
      ? null // user didn't confirm — engine surfaces the UNCOMPUTED code
      : purchaseDate; // pre-cut-over → grandfathered
  return {
    name: p.name.trim() || 'Property',
    type: p.type,
    address: p.address.trim() || null,
    purchasePrice: p.purchasePrice,
    purchaseDate,
    currentValue: p.currentValue,
    valuationDate: p.valuationDate || new Date().toISOString(),
    acquisitionContractDate,
    isNewBuild: isPostCutOver ? (p.isNewBuild ?? null) : null,
    newBuildEvidence: isPostCutOver ? (p.newBuildEvidence ?? null) : null,
  };
}

async function applyLoanOp(
  headers: Record<string, string>,
  loanOp: ChildOp<PropertyLoanRecord>,
  propertyId: string,
  propertyType: PropertyType,
): Promise<void> {
  if (loanOp.op === 'delete') {
    const res = await fetch(`/api/loans/${loanOp.id}`, { method: 'DELETE', headers });
    if (!res.ok && res.status !== 404) {
      throw new Error('Could not remove the mortgage. Please try again.');
    }
    return;
  }
  const body = {
    name: loanName(loanOp.record),
    type: loanTypeForProperty(propertyType),
    propertyId,
    principal: loanOp.record.principal,
    // Wizard works in percent; the real table stores a decimal.
    interestRateAnnual: loanOp.record.interestRateAnnual / 100,
    rateType: loanOp.record.rateType,
    isInterestOnly: loanOp.record.isInterestOnly,
    termMonthsRemaining: loanOp.record.termMonthsRemaining || 360,
    minRepayment: loanOp.record.minRepayment,
    repaymentFrequency: loanOp.record.repaymentFrequency,
  };
  if (loanOp.op === 'create') {
    const res = await fetch('/api/loans', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Could not save the mortgage. Please try again.');
  } else {
    const res = await fetch(`/api/loans/${loanOp.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Could not update the mortgage. Please try again.');
  }
}

async function applyIncomeOp(
  headers: Record<string, string>,
  incomeOp: ChildOp<PropertyIncomeRecord>,
  propertyId: string,
  propertyName: string,
): Promise<void> {
  if (incomeOp.op === 'delete') {
    const res = await fetch(`/api/income/${incomeOp.id}`, { method: 'DELETE', headers });
    if (!res.ok && res.status !== 404) {
      throw new Error('Could not remove the rental income. Please try again.');
    }
    return;
  }
  const body = {
    name: `Rent - ${propertyName.trim() || 'property'}`,
    type: 'RENTAL',
    sourceType: 'PROPERTY',
    propertyId,
    amount: incomeOp.record.amount,
    frequency: incomeOp.record.frequency,
  };
  if (incomeOp.op === 'create') {
    const res = await fetch('/api/income', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Could not save the rental income. Please try again.');
  } else {
    const res = await fetch(`/api/income/${incomeOp.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Could not update the rental income. Please try again.');
  }
}

async function applyExpenseOp(
  headers: Record<string, string>,
  expenseOp: ChildOp<PropertyExpenseRecord>,
  propertyId: string,
  propertyType: PropertyType,
): Promise<void> {
  if (expenseOp.op === 'delete') {
    const res = await fetch(`/api/expenses/${expenseOp.id}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok && res.status !== 404) {
      throw new Error('Could not remove a property expense. Please try again.');
    }
    return;
  }
  const body = {
    name: expenseOp.record.name.trim() || expenseOp.record.category,
    category: expenseOp.record.category,
    amount: expenseOp.record.amount,
    frequency: expenseOp.record.frequency,
    propertyId,
    sourceType: 'PROPERTY',
    // Investment-property expenses are tax-deductible (mirrors bulk-create).
    isTaxDeductible: propertyType === 'INVESTMENT',
  };
  if (expenseOp.op === 'create') {
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Could not save a property expense. Please try again.');
  } else {
    const res = await fetch(`/api/expenses/${expenseOp.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Could not update a property expense. Please try again.');
  }
}

// ============================================================================
// MAPPERS — bridge `PropertiesSnapshot` ⇄ wizard `WizardData.properties`.
// ============================================================================

/**
 * A real `Property` / `Loan` / `Income` / `Expense` id is a uuid. The wizard
 * mints synthetic ids — `temp_…` (`generateId()`) and `chat-prop-…` /
 * `chat-…` (chat mode). `isPersistedId` distinguishes the two so the diff
 * classifies a synthetic-id entity as CREATE.
 */
export function isPersistedId(id: string | undefined): boolean {
  if (!id) return false;
  return !id.startsWith('temp_') && !id.startsWith('chat-');
}

let syntheticCounter = 0;
function syntheticId(prefix: string): string {
  syntheticCounter += 1;
  return `temp_${prefix}_${Date.now()}_${syntheticCounter}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/**
 * Map a real-table snapshot → the wizard step's `PropertyInput[]`. Real-table
 * ids become the wizard ids (so the step's edit/delete logic, keyed on `id`,
 * Just Works AND the diff on Continue can tell saved rows from new ones). A
 * not-yet-saved entity gets a synthetic `temp_…` id for React keys.
 */
export function snapshotToWizardProperties(snapshot: PropertiesSnapshot): PropertyInput[] {
  return snapshot.properties.map((p): PropertyInput => ({
    id: p.id ?? syntheticId('prop'),
    name: p.name,
    address: p.address,
    type: p.type,
    purchasePrice: p.purchasePrice,
    currentValue: p.currentValue,
    purchaseDate: p.purchaseDate,
    acquisitionContractDate: p.acquisitionContractDate,
    isNewBuild: p.isNewBuild,
    newBuildEvidence: p.newBuildEvidence,
    hasLoan: p.hasLoan,
    loan: p.loan
      ? {
          id: p.loan.id ?? syntheticId('loan'),
          name: p.loan.lender,
          lender: p.loan.lender,
          principal: p.loan.principal,
          interestRateAnnual: p.loan.interestRateAnnual,
          rateType: p.loan.rateType,
          isInterestOnly: p.loan.isInterestOnly,
          termMonthsRemaining: p.loan.termMonthsRemaining,
          minRepayment: p.loan.minRepayment,
          repaymentFrequency: p.loan.repaymentFrequency,
        }
      : undefined,
    income: p.income
      ? {
          id: p.income.id ?? syntheticId('inc'),
          type: 'RENTAL',
          amount: p.income.amount,
          frequency: p.income.frequency,
          tenantName: p.income.tenantName,
        }
      : undefined,
    expenses: p.expenses.map((e): PropertyExpenseInput => ({
      id: e.id ?? syntheticId('exp'),
      name: e.name,
      category: e.category,
      amount: e.amount,
      frequency: e.frequency,
    })),
  }));
}

/**
 * Map the wizard step's `PropertyInput[]` → a `PropertiesSnapshot` for
 * `diffProperties` / `syncProperties`. Synthetic (not-yet-saved) ids are
 * dropped to `undefined` so the diff classifies them as CREATE.
 *
 * Applies the quality guards (see the file header): a loan with
 * `principal <= 0`, rental income with `amount <= 0`, and any expense with
 * `amount <= 0` are dropped — a $0 row is false precision, worse than none.
 *
 * An in-session property card that is NOT yet persisted AND has no
 * `purchaseDate` is also dropped — `purchaseDate` is the one genuinely
 * required `Property` field, so an incomplete new card is left in-session
 * (not persisted with a fabricated date). A property that already has a
 * real id is always kept, so blanking a required field can never silently
 * DELETE a persisted property.
 */
export function wizardPropertiesToSnapshot(properties: PropertyInput[]): PropertiesSnapshot {
  return {
    properties: properties
      .filter((p) => isPersistedId(p.id) || !!p.purchaseDate?.trim())
      .map((p): PropertyRecord => {
      const loan =
        p.hasLoan && p.loan && p.loan.principal > 0
          ? mapWizardLoan(p.loan)
          : undefined;
      const income =
        p.type === 'INVESTMENT' && p.income && p.income.amount > 0
          ? {
              id: isPersistedId(p.income.id) ? p.income.id : undefined,
              amount: p.income.amount,
              frequency: p.income.frequency,
              tenantName: p.income.tenantName,
            }
          : undefined;
      return {
        id: isPersistedId(p.id) ? p.id : undefined,
        name: p.name,
        address: p.address,
        type: p.type,
        purchasePrice: p.purchasePrice,
        currentValue: p.currentValue,
        purchaseDate: p.purchaseDate,
        acquisitionContractDate: p.acquisitionContractDate,
        isNewBuild: p.isNewBuild,
        newBuildEvidence: p.newBuildEvidence,
        hasLoan: !!loan,
        loan,
        income,
        expenses: p.expenses
          .filter((e) => e.amount > 0)
          .map((e): PropertyExpenseRecord => ({
            id: isPersistedId(e.id) ? e.id : undefined,
            name: e.name,
            category: e.category,
            amount: e.amount,
            frequency: e.frequency,
          })),
      };
    }),
  };
}

function mapWizardLoan(loan: PropertyLoanInput): PropertyLoanRecord {
  return {
    id: isPersistedId(loan.id) ? loan.id : undefined,
    lender: loan.lender,
    principal: loan.principal,
    interestRateAnnual: loan.interestRateAnnual,
    rateType: loan.rateType,
    isInterestOnly: loan.isInterestOnly,
    termMonthsRemaining: loan.termMonthsRemaining,
    minRepayment: loan.minRepayment,
    repaymentFrequency: loan.repaymentFrequency,
  };
}
