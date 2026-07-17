/**
 * Phase 59 — managed-rental reconciliation SUGGESTION service
 * (PHASE_59_MANAGED_RENTAL_INCOME.md §3/§8).
 *
 * Decides whether linking a disbursement to a MANAGED rental stream should
 * fire the suggest-and-confirm card, and builds the card's payload. All
 * arithmetic comes from the ONE engine (`reconcileManagedRental` —
 * lib/calculations/rentalReconciliation.ts, §12.2.1); this service only
 * fetches the stream's context (rule, sibling disbursement dates, existing
 * derived expense) and applies the fire/silent decision:
 *
 *   - no rule, no derived expense, material gap  → FIRST-CONFIRM card
 *   - rule exists, gap within tolerance          → silent (the recurring
 *     derived expense already models the ongoing cost — nothing to create,
 *     nothing to ask; the learn-once promise)
 *   - rule exists, gap outside tolerance         → ANOMALY re-confirm card
 *     (likely a repair — amber, never red)
 *   - derived expense exists but no rule         → silent (already captured,
 *     e.g. via a statement; never nag twice)
 *
 * PERSISTENCE lives in app/api/rental-reconciliation/route.ts (the single
 * locked producer of derived agent-cost rows) — never here.
 */

import { prisma } from '@/lib/db';
import {
  reconcileManagedRental,
  type ManagedRentalReconciliation,
} from '@/lib/calculations/rentalReconciliation';

export interface ManagedRentalSuggestion {
  /** 'confirm' = first-time suggest-and-confirm; 'anomaly' = re-confirm. */
  kind: 'confirm' | 'anomaly';
  incomeStreamId: string;
  transactionId: string;
  streamName: string;
  managingAgentName: string | null;
  propertyId: string | null;
  /** The declared gross as entered (e.g. 650 / WEEKLY). */
  declaredGross: { amount: number; frequency: string };
  /** Declared gross normalised to the disbursement period (e.g. 1300). */
  grossPerPeriod: number;
  /** The net bank credit (e.g. 1100). */
  netDisbursement: number;
  /** The gap for this period (e.g. 200) — the likely deductible cost. */
  gap: number;
  /** The gap annualised at the disbursement cadence (e.g. 5200). */
  gapAnnual: number;
  /** Cadence the numbers above are expressed in (e.g. FORTNIGHTLY). */
  disbursementFrequency: string;
  /** Anomaly only: the stream's usual confirmed gap (rule baseline). */
  baselineGapAmount?: number;
  /** Anomaly only: how far above/below usual this gap is (e.g. 250). */
  anomalyExcess?: number;
}

interface StreamLike {
  id: string;
  name: string;
  type: string;
  amount: number;
  frequency: string;
  rentalMode?: string | null;
  managingAgentName?: string | null;
  propertyId?: string | null;
}

interface TransactionLike {
  id: string;
  amount: number;
  date: Date;
  direction: string;
}

/**
 * Build the card payload for a disbursement just linked to a rental stream —
 * or null when nothing should fire (not managed, not material, learn-once
 * silent, or already captured). Never throws into the link flow: callers
 * treat null as "no card".
 */
export async function buildManagedRentalSuggestion(args: {
  userId: string;
  income: StreamLike;
  transaction: TransactionLike;
}): Promise<ManagedRentalSuggestion | null> {
  const { userId, income, transaction } = args;

  const isRental = income.type === 'RENT' || income.type === 'RENTAL';
  if (!isRental || income.rentalMode !== 'MANAGED') return null;
  if (transaction.direction !== 'IN') return null;
  if (!(income.amount > 0)) return null;

  try {
    const [rule, siblingTxns, existingDerived] = await Promise.all([
      prisma.agentDisbursementRule.findUnique({
        where: { incomeStreamId: income.id },
      }),
      prisma.unifiedTransaction.findMany({
        where: { userId, incomeId: income.id },
        select: { date: true },
        orderBy: { date: 'desc' },
        take: 12,
      }),
      prisma.expense.findFirst({
        where: { userId, derivedFromIncomeId: income.id, derived: true, isRecurring: true },
        select: { id: true },
      }),
    ]);

    const reconciliation: ManagedRentalReconciliation = reconcileManagedRental({
      declaredGrossAmount: income.amount,
      declaredGrossFrequency: income.frequency as never,
      netDisbursementAmount: transaction.amount,
      disbursementFrequency: (rule?.cadence as never) ?? null,
      disbursementDates: [transaction.date, ...siblingTxns.map((t: { date: Date }) => t.date)],
      rule: rule
        ? { baselineGapAmount: rule.baselineGapAmount, tolerancePct: rule.tolerancePct }
        : null,
    });

    if (rule) {
      // Learn-once: within tolerance → silent auto-derive (the recurring
      // derived row already models the cost). Outside → anomaly re-confirm.
      if (!reconciliation.anomaly) return null;
      return {
        kind: 'anomaly',
        incomeStreamId: income.id,
        transactionId: transaction.id,
        streamName: income.name,
        managingAgentName: income.managingAgentName ?? null,
        propertyId: income.propertyId ?? null,
        declaredGross: { amount: income.amount, frequency: income.frequency },
        grossPerPeriod: reconciliation.grossPerDisbursementPeriod,
        netDisbursement: transaction.amount,
        gap: reconciliation.gap,
        gapAnnual: reconciliation.gapAnnual,
        disbursementFrequency: reconciliation.disbursementFrequency,
        baselineGapAmount: rule.baselineGapAmount,
        anomalyExcess: reconciliation.anomalyExcess,
      };
    }

    // No rule yet: fire the first confirm only on a material gap that isn't
    // already captured (e.g. by a statement-derived row).
    if (!reconciliation.material || existingDerived) return null;

    return {
      kind: 'confirm',
      incomeStreamId: income.id,
      transactionId: transaction.id,
      streamName: income.name,
      managingAgentName: income.managingAgentName ?? null,
      propertyId: income.propertyId ?? null,
      declaredGross: { amount: income.amount, frequency: income.frequency },
      grossPerPeriod: reconciliation.grossPerDisbursementPeriod,
      netDisbursement: transaction.amount,
      gap: reconciliation.gap,
      gapAnnual: reconciliation.gapAnnual,
      disbursementFrequency: reconciliation.disbursementFrequency,
    };
  } catch (err) {
    // The card is an enhancement — never break the link flow over it.
    console.error('[managedRentalService] suggestion build failed:', err);
    return null;
  }
}

/**
 * MON-080 D1 — the RETROACTIVE suggestion: reconcile a stream's ALREADY-linked
 * disbursements. Fired (a) by the income PUT when a stream transitions to
 * MANAGED (the natural order — link deposits first, mark managed later) and
 * (b) by GET /api/rental-reconciliation for the income-page nudge-chip claim
 * path. The most recent linked IN deposit stands as the representative
 * disbursement (the confirm endpoint recomputes against it — same single
 * producer, §12.2.1); its siblings supply the cadence evidence. All the
 * fire/silent guards of `buildManagedRentalSuggestion` apply unchanged —
 * including the `existingDerived` idempotency guard (never double-create).
 */
export async function buildRetroactiveManagedRentalSuggestion(args: {
  userId: string;
  income: StreamLike;
}): Promise<ManagedRentalSuggestion | null> {
  const { userId, income } = args;
  try {
    const latest = await prisma.unifiedTransaction.findFirst({
      where: { userId, incomeId: income.id, direction: 'IN' },
      select: { id: true, amount: true, date: true, direction: true },
      orderBy: { date: 'desc' },
    });
    if (!latest) return null; // nothing linked yet — the link flow will ask

    return buildManagedRentalSuggestion({ userId, income, transaction: latest });
  } catch (err) {
    console.error('[managedRentalService] retroactive suggestion failed:', err);
    return null;
  }
}
