/**
 * Phase 42 PR5 — Tax Pack summary builder.
 *
 * Aggregates transactions for the requested tax-year window into:
 *   1. Per-property P&L blocks (revenue, expenses by category, net)
 *   2. ATO-label totals (rolled up via TaxCategoryMapping)
 *   3. Data-source disclosure (BASIQ vs imported vs manual vs receipt)
 *
 * Per CLAUDE.md §12.3 — composes `getMasterFinancialSnapshot()` for
 * portfolio-level numbers and reads from `unified_transactions` for
 * the per-row attribution. NO new calculation engine.
 *
 * Per CLAUDE.md §1 (Phase 42 hard rule) — output is **data**, not
 * advice. Every figure traces to canonical engines; the export
 * disclaims deductibility ("Your registered tax agent confirms").
 */

import prisma from '@/lib/db';
import type { UnifiedTransaction, Property } from '@prisma/client';
import { getMappingsForCategory, seedSystemMappings } from '../taxCategoryMapping';

export interface TaxPackWindow {
  /** AU FY label e.g. "FY2025-26". */
  label: string;
  /** UTC midnight 1 July (inclusive). */
  start: Date;
  /** UTC midnight 30 June (inclusive). */
  end: Date;
}

export interface TaxPackSummary {
  userId: string;
  generatedAt: Date;
  window: TaxPackWindow;
  /**
   * M3 PR-1 (MON-169): PROPERTY-SCOPED totals — income/expenses attributed to
   * a property, transfers and loan repayments excluded. Everything excluded is
   * COUNTED in `reconciliation` (MON-170: a tax artefact never loses money
   * silently). `transactionCount` here = the included rows.
   */
  totals: {
    incomeGross: number;
    expenseTotal: number;
    netCashflow: number;
    transactionCount: number;
  };
  /** MON-170: the nothing-silent reconciliation — see buildTaxPackSummary. */
  reconciliation: PackReconciliation;
  atoLabels: AtoLabelTotals[];
  perProperty: PerPropertyPL[];
  dataSources: DataSourceDisclosure;
  /** Hard-coded disclaimer surfaced verbatim in every export. */
  disclaimer: string;
}

export interface ExclusionBucket {
  count: number;
  amount: number;
}

/**
 * MON-170 — every transaction in the window lands in EXACTLY ONE of:
 * included · transfers · loanRepayments · notPropertyScoped. The identity
 * `included.count + Σ excluded.count === transactionsTotal` is HARD-ASSERTED
 * in buildTaxPackSummary (a violated identity throws rather than exporting a
 * silently-wrong pack) and printed in every rendering. The labelling
 * counters partition the INCLUDED rows: labelled + noCategory + noAtoMapping.
 */
export interface PackReconciliation {
  transactionsTotal: number;
  included: ExclusionBucket;
  excluded: {
    /** Internal account-to-account moves (isTransfer — actualCashflow.ts convention). */
    transfers: ExclusionBucket;
    /** Loan-linked rows: principal+interest repayments (per-loan interest split = M3.1). */
    loanRepayments: ExclusionBucket;
    /** Rows with no property attribution (salary, personal spend, unlinked rows). */
    notPropertyScoped: ExclusionBucket;
  };
  /** How far the ATO-label rollup reaches into the INCLUDED rows. */
  atoLabelling: {
    labelled: ExclusionBucket;
    noCategory: ExclusionBucket;
    noAtoMapping: ExclusionBucket;
  };
}

export interface AtoLabelTotals {
  atoLabel: string;
  schedule: string | null;
  lineItem: string | null;
  totalAmount: number;
  transactionCount: number;
  /** Optional notes (e.g. "Apportion work vs personal use"). */
  notes: string | null;
}

export interface PerPropertyPL {
  propertyId: string;
  propertyName: string;
  income: { total: number; count: number };
  expenses: { total: number; count: number; byCategory: Array<{ category: string; total: number; count: number }> };
  net: number;
  transactionCount: number;
}

export interface DataSourceDisclosure {
  /** Per-source counts so the accountant can assess provenance. */
  sources: Record<string, number>;
  /** Months that had ≥1 BASIQ-fed transaction (YYYY-MM keys). */
  basiqMonths: string[];
  /** Months that had ≥1 imported (QIF/CSV/OFX) transaction. */
  importedMonths: string[];
  /** Months with manual/cash/receipt rows only. */
  manualOnlyMonths: string[];
}

const DISCLAIMER =
  'This is a data summary produced by Monitrax. It is NOT tax advice. ' +
  'Your registered tax agent confirms deductibility, applies depreciation ' +
  'rates, and reconciles against statutory records. Monitrax is the user-side ' +
  'tool; Xero / your accountant remain the authoritative bookkeeping system.';

/**
 * Build a `TaxPackWindow` for an AU financial year. Accepts either an
 * FY string ("FY2025-26", "2025-26", "2026") or defaults to the
 * current FY based on today's date.
 */
export function buildAuFyWindow(input?: string): TaxPackWindow {
  const now = new Date();
  let startYear: number;
  if (input) {
    const m = input.match(/(\d{4})/);
    if (!m) throw new Error(`Invalid FY format: ${input}`);
    startYear = Number.parseInt(m[1], 10);
  } else {
    // AU FY runs 1 July → 30 June. Before July → previous FY started.
    startYear = now.getUTCMonth() < 6 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  }
  const start = new Date(Date.UTC(startYear, 6, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(startYear + 1, 6, 1, 0, 0, 0, 0));
  end.setUTCMilliseconds(-1); // 30 June 23:59:59.999
  const label = `FY${startYear}-${String(startYear + 1).slice(-2)}`;
  return { label, start, end };
}

/**
 * Build the canonical Tax Pack summary for a user + window.
 *
 * Steps:
 *   1. Seed system tax mappings (idempotent; cheap on second call).
 *   2. Fetch all `unified_transactions` in the window for this user.
 *   3. Aggregate per-property P&L + ATO label totals.
 *   4. Compute data-source disclosure (BASIQ vs QIF vs MANUAL vs RECEIPT).
 *
 * Pure-ish — only reads from DB; no writes (the seed step idempotently
 * creates registry rows but never mutates user data).
 */
export async function buildTaxPackSummary(
  userId: string,
  window: TaxPackWindow
): Promise<TaxPackSummary> {
  // Idempotent system seeds — harmless on repeat calls.
  await seedSystemMappings(userId);

  const transactions = await prisma.unifiedTransaction.findMany({
    where: {
      userId,
      date: { gte: window.start, lte: window.end },
    },
    orderBy: { date: 'asc' },
  });

  const properties = await prisma.property.findMany({
    where: { userId },
    select: { id: true, name: true },
  });
  const propertyById = new Map(properties.map((p) => [p.id, p]));

  // ---- classification (MON-169/170) ----
  // Every row lands in exactly one class, in this precedence order:
  //   1. transfer      — isTransfer === true (the actualCashflow.ts:111
  //                      convention: internal moves are neither spend nor
  //                      income; Phase 51 loan-ledger confirms also set it)
  //   2. loanRepayment — loanId linked (principal+interest repayment; the
  //                      plain link/update loan actions set loanId WITHOUT
  //                      isTransfer, so this class is checked independently)
  //   3. notPropertyScoped — no propertyId stamp (salary, personal spend,
  //                      unlinked rows; the pack is property-scoped per the
  //                      M3 brief §A scope ruling)
  //   4. included      — property-scoped income/expense rows: THE pack rows.
  // NOTE: object literals, deliberately NOT a `const bucket = () => …` helper —
  // the census splits function units on arrow-consts, and a helper here mints
  // a phantom producer unit that swallows the classification code below
  // (the PR-2 `basisChip`/`loanCost` lesson; never reseed a rise).
  const transfers = { count: 0, amount: 0 };
  const loanRepayments = { count: 0, amount: 0 };
  const notPropertyScoped = { count: 0, amount: 0 };
  const includedBucket = { count: 0, amount: 0 };
  const included: UnifiedTransaction[] = [];
  for (const tx of transactions) {
    const abs = Math.abs(tx.amount);
    if (tx.isTransfer === true) {
      transfers.count++;
      transfers.amount += abs;
    } else if (tx.loanId) {
      loanRepayments.count++;
      loanRepayments.amount += abs;
    } else if (!tx.propertyId) {
      notPropertyScoped.count++;
      notPropertyScoped.amount += abs;
    } else {
      includedBucket.count++;
      includedBucket.amount += abs;
      included.push(tx);
    }
  }

  // THE identity (MON-170): included + Σexcluded = total. A violation means
  // the classifier double-counted or dropped a row — fail LOUD (§12.8), never
  // export a silently-wrong tax artefact. Locked by Ring-0 fixtures.
  const classifiedTotal =
    includedBucket.count + transfers.count + loanRepayments.count + notPropertyScoped.count;
  if (classifiedTotal !== transactions.length) {
    throw new Error(
      `Tax pack reconciliation identity violated: included ${includedBucket.count} + ` +
        `transfers ${transfers.count} + loanRepayments ${loanRepayments.count} + ` +
        `notPropertyScoped ${notPropertyScoped.count} !== total ${transactions.length}`
    );
  }

  // ---- totals (property-scoped — MON-169) ----
  let incomeGross = 0;
  let expenseTotal = 0;
  for (const tx of included) {
    if (tx.direction === 'IN') incomeGross += Math.abs(tx.amount);
    else expenseTotal += Math.abs(tx.amount);
  }

  // ---- per-property (over the included rows only) ----
  const propertyMap = new Map<string, PerPropertyPL>();
  for (const tx of included) {
    if (!tx.propertyId) continue;
    const property = propertyById.get(tx.propertyId);
    if (!property) continue;
    let entry = propertyMap.get(tx.propertyId);
    if (!entry) {
      entry = {
        propertyId: tx.propertyId,
        propertyName: property.name,
        income: { total: 0, count: 0 },
        expenses: { total: 0, count: 0, byCategory: [] },
        net: 0,
        transactionCount: 0,
      };
      propertyMap.set(tx.propertyId, entry);
    }
    entry.transactionCount++;
    if (tx.direction === 'IN') {
      entry.income.total += Math.abs(tx.amount);
      entry.income.count++;
    } else {
      entry.expenses.total += Math.abs(tx.amount);
      entry.expenses.count++;
      const catLabel = tx.categoryLevel1 ?? 'Uncategorised';
      let catEntry = entry.expenses.byCategory.find((c) => c.category === catLabel);
      if (!catEntry) {
        catEntry = { category: catLabel, total: 0, count: 0 };
        entry.expenses.byCategory.push(catEntry);
      }
      catEntry.total += Math.abs(tx.amount);
      catEntry.count++;
    }
    entry.net = entry.income.total - entry.expenses.total;
  }

  // ---- ATO label totals ----
  // For each transaction, look up its category's tax mappings
  // (preferring user overrides over system seeds), then attribute
  // the ABSOLUTE amount to each label (M2.6 #48: the code uses
  // Math.abs — this comment previously claimed SIGNED). A transaction can map to
  // multiple labels (rare but legitimate — split across schedules).
  const atoTotals = new Map<string, AtoLabelTotals>();

  // Pre-resolve category id for each transaction's (level1, level2)
  // triple so we can batch the mapping lookups.
  const distinctTriples = new Set<string>();
  for (const tx of included) {
    if (!tx.categoryLevel1) continue;
    distinctTriples.add(`${tx.categoryLevel1}|${tx.categoryLevel2 ?? ''}|${tx.subcategory ?? ''}`);
  }
  const categoryIdByTriple = new Map<string, string>();
  if (distinctTriples.size > 0) {
    const registryRows = await prisma.canonicalCategoryRegistry.findMany({
      where: { userId },
    });
    for (const row of registryRows) {
      categoryIdByTriple.set(
        `${row.level1}|${row.level2 ?? ''}|${row.subcategory ?? ''}`,
        row.id
      );
    }
  }

  // Resolve each distinct category's mappings ONCE (was per-transaction — an
  // N+1 the Ring-3 run flagged; depth-sweep item 12).
  const mappingsByCategoryId = new Map<
    string,
    Awaited<ReturnType<typeof getMappingsForCategory>>
  >();
  for (const categoryId of new Set(categoryIdByTriple.values())) {
    mappingsByCategoryId.set(categoryId, await getMappingsForCategory(userId, categoryId));
  }

  // MON-170: every row that fails to reach a label is COUNTED, never dropped.
  const labelled = { count: 0, amount: 0 };
  const noCategory = { count: 0, amount: 0 };
  const noAtoMapping = { count: 0, amount: 0 };
  for (const tx of included) {
    const abs = Math.abs(tx.amount);
    if (!tx.categoryLevel1) {
      noCategory.count++;
      noCategory.amount += abs;
      continue;
    }
    const triple = `${tx.categoryLevel1}|${tx.categoryLevel2 ?? ''}|${tx.subcategory ?? ''}`;
    const categoryId = categoryIdByTriple.get(triple);
    const mappings = categoryId ? (mappingsByCategoryId.get(categoryId) ?? []) : [];
    if (!categoryId || mappings.length === 0) {
      noAtoMapping.count++;
      noAtoMapping.amount += abs;
      continue;
    }
    labelled.count++;
    labelled.amount += abs;
    for (const mapping of mappings) {
      let entry = atoTotals.get(mapping.atoLabel);
      if (!entry) {
        entry = {
          atoLabel: mapping.atoLabel,
          schedule: mapping.schedule,
          lineItem: mapping.lineItem,
          totalAmount: 0,
          transactionCount: 0,
          notes: mapping.notes,
        };
        atoTotals.set(mapping.atoLabel, entry);
      }
      entry.totalAmount += Math.abs(tx.amount);
      entry.transactionCount++;
    }
  }

  // Labelling identity over the included rows (same fail-loud rule).
  if (labelled.count + noCategory.count + noAtoMapping.count !== included.length) {
    throw new Error(
      `Tax pack labelling identity violated: labelled ${labelled.count} + ` +
        `noCategory ${noCategory.count} + noAtoMapping ${noAtoMapping.count} !== ` +
        `included ${included.length}`
    );
  }

  // ---- data sources ----
  const sourceCounts: Record<string, number> = {};
  const basiqMonthSet = new Set<string>();
  const importedMonthSet = new Set<string>();
  const manualMonthSet = new Set<string>();
  for (const tx of transactions) {
    sourceCounts[tx.source] = (sourceCounts[tx.source] ?? 0) + 1;
    const monthKey = `${tx.date.getUTCFullYear()}-${String(tx.date.getUTCMonth() + 1).padStart(2, '0')}`;
    if (tx.source === 'BASIQ') basiqMonthSet.add(monthKey);
    else if (tx.source === 'QIF' || tx.source === 'CSV' || tx.source === 'OFX') importedMonthSet.add(monthKey);
    else manualMonthSet.add(monthKey);
  }
  const manualOnlyMonths = Array.from(manualMonthSet).filter(
    (m) => !basiqMonthSet.has(m) && !importedMonthSet.has(m)
  );

  return {
    userId,
    generatedAt: new Date(),
    window,
    totals: {
      incomeGross,
      expenseTotal,
      netCashflow: incomeGross - expenseTotal,
      transactionCount: included.length,
    },
    reconciliation: {
      transactionsTotal: transactions.length,
      included: includedBucket,
      excluded: { transfers, loanRepayments, notPropertyScoped },
      atoLabelling: { labelled, noCategory, noAtoMapping },
    },
    atoLabels: Array.from(atoTotals.values()).sort((a, b) =>
      a.atoLabel.localeCompare(b.atoLabel)
    ),
    perProperty: Array.from(propertyMap.values()).sort((a, b) =>
      a.propertyName.localeCompare(b.propertyName)
    ),
    dataSources: {
      sources: sourceCounts,
      basiqMonths: Array.from(basiqMonthSet).sort(),
      importedMonths: Array.from(importedMonthSet).sort(),
      manualOnlyMonths: manualOnlyMonths.sort(),
    },
    disclaimer: DISCLAIMER,
  };
}

/**
 * Fetch the transactions for the Tax Pack export. Pulled out so the
 * CSV exporter and the future XLSX/PDF exporters all share one
 * canonical query — per CLAUDE.md §12.3.
 */
export async function fetchTaxPackTransactions(
  userId: string,
  window: TaxPackWindow
): Promise<UnifiedTransaction[]> {
  return prisma.unifiedTransaction.findMany({
    where: {
      userId,
      date: { gte: window.start, lte: window.end },
    },
    orderBy: { date: 'asc' },
  });
}

export const TAX_PACK_DISCLAIMER = DISCLAIMER;
