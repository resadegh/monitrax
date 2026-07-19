/**
 * Mechanism A PART 2 — the Reza-gated duplicate-merge engine
 * (MON-074/076; docs/architecture/CALC_SSOT_WALL.md "Mechanism A").
 *
 * The Part-1 guardrail (#1458) stops NEW mints. This module handles the
 * ALREADY-minted live duplicates (Ingeus ×3, battery ×3): it produces the
 * per-group PREVIEW (the live row-level census the brief mandates — which
 * groups are genuine same-source duplicates vs distinct sources that merely
 * share a payer) and executes a merge ONLY for a group the user explicitly
 * confirmed. NOTHING here runs automatically — the API route requires an
 * explicit per-group confirmation payload, and the admin UI is a
 * click-per-group surface (§12.11).
 *
 * Grouping uses THE one classifier policy (`classifyIntake` 'source-signature'
 * — same identity + scope-compatibility rule as the Part-1 guardrail), so the
 * preview can never propose a merge the guardrail wouldn't have prevented:
 * two differently-scoped rows (QBE on property A vs B, Lot-1 vs Lot-2 rent)
 * never appear in one group.
 *
 * Merge semantics (visible + deliberate):
 *   - SURVIVOR: the most-specific row wins (non-null scope preferred), then
 *     the oldest — the declared/canonical original.
 *   - Every FK on the merged siblings is REPOINTED to the survivor before the
 *     siblings are deleted: UnifiedTransaction / Transaction /
 *     SuperContribution (income), UnifiedTransaction / Transaction /
 *     TransactionSplit / AssetServiceRecord (expense), plus
 *     Expense.derivedFromIncomeId and the Phase-59 AgentDisbursementRule
 *     (repointed only when the survivor has none — a conflicting rule is
 *     surfaced in the preview, never silently dropped without saying so).
 *   - The survivor's OWN fields are NOT changed — the merge removes phantom
 *     siblings; it never rewrites the canonical row's declared values.
 *
 * Effect math reads the canonical run-rate producers (annualRunRate — Wall
 * B2), never inline frequency arithmetic (§12.2.1 / source-lock).
 */

import { classifyIntake } from '@/lib/intake/classifyIntake';
import { annualRunRate } from '@/lib/utils/frequencies';

// =============================================================================
// Types
// =============================================================================

export interface MergeableRow {
  id: string;
  name: string;
  type?: string | null; // income type / expense category
  amount: number;
  frequency: string;
  isRecurring?: boolean | null;
  ownerEntityId?: string | null;
  propertyId?: string | null;
  loanId?: string | null;
  assetId?: string | null;
  investmentAccountId?: string | null;
  createdAt: Date | string;
}

export interface DuplicateGroup {
  /** Stable id for the group (survivor id — unique per group). */
  groupId: string;
  kind: 'income' | 'expense';
  /** The income type / expense category the group shares. */
  type: string;
  survivorId: string;
  rows: MergeableRow[];
  /** Row ids that would be deleted (everything except the survivor). */
  mergeIds: string[];
  /** Σ annual declared run-rate of the rows that would be DELETED — the net
   *  effect on the declared gross (the survivor is not changed). One-off rows
   *  contribute 0 by the canonical run-rate rule. */
  annualDeclaredEffect: number;
  /** Human-readable cautions (e.g. a Phase-59 disbursement-rule conflict). */
  warnings: string[];
}

export function scopeKeyOf(row: MergeableRow): string | null {
  return row.propertyId ?? row.loanId ?? row.investmentAccountId ?? row.assetId ?? null;
}

// =============================================================================
// Grouping (pure — callers fetch)
// =============================================================================

/**
 * Cluster rows of ONE kind into duplicate groups using the Part-1 signature
 * policy. Pure and deterministic: rows are processed oldest-first; each row
 * either joins the first existing group whose SEED it signature-matches, or
 * seeds a new group. Rental income (RENT/RENTAL) is deliberately excluded —
 * its identity is property-scoped (MON-009) and per-property rental streams
 * are governed by scope-singleton, not cross-scope merging.
 */
export function findDuplicateGroups(
  kind: 'income' | 'expense',
  rows: MergeableRow[],
): DuplicateGroup[] {
  const eligible = rows
    .filter((r) => !(kind === 'income' && (r.type === 'RENT' || r.type === 'RENTAL')))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Partition by (type, ownerEntityId) first — the non-name half of the
  // signature — then let the classifier decide name+scope compatibility.
  const byTypeOwner = new Map<string, MergeableRow[]>();
  for (const r of eligible) {
    const key = `${r.type ?? ''}::${r.ownerEntityId ?? ''}`;
    byTypeOwner.set(key, [...(byTypeOwner.get(key) ?? []), r]);
  }

  const groups: DuplicateGroup[] = [];
  for (const bucket of byTypeOwner.values()) {
    const clusters: MergeableRow[][] = [];
    for (const row of bucket) {
      const home = clusters.find((cluster) => {
        const seed = cluster[0];
        const match = classifyIntake({
          kind,
          source: 'MANUAL',
          declaredFrequency: 'MONTHLY', // irrelevant to stream matching
          streamPolicy: 'source-signature',
          candidate: { name: row.name, amount: row.amount, scopeKey: scopeKeyOf(row) },
          existingRows: [
            { id: seed.id, name: seed.name, amount: seed.amount, scopeKey: scopeKeyOf(seed) },
          ],
        }).streamMatch;
        return match !== null;
      });
      if (home) home.push(row);
      else clusters.push([row]);
    }

    for (const cluster of clusters) {
      if (cluster.length < 2) continue; // not a duplicate group
      // Survivor: most specific scope first (non-null), then oldest.
      const survivor =
        cluster.find((r) => scopeKeyOf(r) !== null) ?? cluster[0];
      const mergeRows = cluster.filter((r) => r.id !== survivor.id);
      groups.push({
        groupId: survivor.id,
        kind,
        type: String(cluster[0].type ?? ''),
        survivorId: survivor.id,
        rows: cluster,
        mergeIds: mergeRows.map((r) => r.id),
        annualDeclaredEffect: -mergeRows.reduce((sum, r) => sum + annualRunRate(r), 0),
        warnings: [],
      });
    }
  }
  return groups;
}

// =============================================================================
// Merge execution (transactional; caller supplies the client)
// =============================================================================

/** The narrow prisma surface the executor needs (works with a $transaction client). */
export interface MergeDbClient {
  unifiedTransaction: { updateMany: (args: unknown) => Promise<unknown> };
  transaction: { updateMany: (args: unknown) => Promise<unknown> };
  superContribution: { updateMany: (args: unknown) => Promise<unknown> };
  transactionSplit: { updateMany: (args: unknown) => Promise<unknown> };
  assetServiceRecord: { updateMany: (args: unknown) => Promise<unknown> };
  expense: {
    updateMany: (args: unknown) => Promise<unknown>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
  };
  income: { deleteMany: (args: unknown) => Promise<{ count: number }> };
  agentDisbursementRule: {
    findMany: (args: unknown) => Promise<Array<{ id: string; incomeStreamId: string }>>;
    update: (args: unknown) => Promise<unknown>;
    deleteMany: (args: unknown) => Promise<unknown>;
  };
}

export interface MergeResult {
  deleted: number;
  /** True when a merged sibling's AgentDisbursementRule was dropped because
   *  the survivor already had one (surfaced, never silent). */
  droppedDisbursementRule: boolean;
}

/**
 * Repoint every FK from the merged siblings to the survivor, then delete the
 * siblings. MUST run inside a transaction. The caller has already verified
 * ownership AND re-derived the group server-side (never trusts client ids).
 */
export async function executeMerge(
  db: MergeDbClient,
  userId: string,
  kind: 'income' | 'expense',
  survivorId: string,
  mergeIds: string[],
): Promise<MergeResult> {
  let droppedDisbursementRule = false;

  if (kind === 'income') {
    await db.unifiedTransaction.updateMany({
      where: { userId, incomeId: { in: mergeIds } },
      data: { incomeId: survivorId },
    });
    await db.transaction.updateMany({
      where: { incomeId: { in: mergeIds } },
      data: { incomeId: survivorId },
    });
    await db.superContribution.updateMany({
      where: { incomeId: { in: mergeIds } },
      data: { incomeId: survivorId },
    });
    // Phase 59 derived agent-fee expenses follow their stream.
    await db.expense.updateMany({
      where: { derivedFromIncomeId: { in: mergeIds } },
      data: { derivedFromIncomeId: survivorId },
    });
    // AgentDisbursementRule is @unique per stream: repoint a sibling's rule
    // only when the survivor has none; otherwise it dies with the sibling
    // (cascade) — reported to the caller.
    const rules = await db.agentDisbursementRule.findMany({
      where: { incomeStreamId: { in: [survivorId, ...mergeIds] } },
    });
    const survivorRule = rules.find((r) => r.incomeStreamId === survivorId);
    const siblingRules = rules.filter((r) => r.incomeStreamId !== survivorId);
    if (!survivorRule && siblingRules.length > 0) {
      await db.agentDisbursementRule.update({
        where: { id: siblingRules[0].id },
        data: { incomeStreamId: survivorId },
      });
      if (siblingRules.length > 1) droppedDisbursementRule = true;
    } else if (survivorRule && siblingRules.length > 0) {
      droppedDisbursementRule = true;
    }
    const { count } = await db.income.deleteMany({
      where: { userId, id: { in: mergeIds } },
    });
    return { deleted: count, droppedDisbursementRule };
  }

  await db.unifiedTransaction.updateMany({
    where: { userId, expenseId: { in: mergeIds } },
    data: { expenseId: survivorId },
  });
  await db.transaction.updateMany({
    where: { expenseId: { in: mergeIds } },
    data: { expenseId: survivorId },
  });
  await db.transactionSplit.updateMany({
    where: { expenseId: { in: mergeIds } },
    data: { expenseId: survivorId },
  });
  await db.assetServiceRecord.updateMany({
    where: { expenseId: { in: mergeIds } },
    data: { expenseId: survivorId },
  });
  const { count } = await db.expense.deleteMany({
    where: { userId, id: { in: mergeIds } },
  });
  return { deleted: count, droppedDisbursementRule };
}
