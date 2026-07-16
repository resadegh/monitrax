/**
 * Phase 59 — Managed-rental reconciliation CONFIRM endpoint
 * (PHASE_59_MANAGED_RENTAL_INCOME.md §3/§8/§9 step 3).
 *
 * POST /api/rental-reconciliation — the user pressed "Yes — record as
 * management & costs" on the suggest-and-confirm card. This route is the
 * SINGLE locked producer of derived agent-cost Expense rows (R1 source-lock,
 * tests/tax/rentalReconciliationSourceLock.test.ts):
 *
 *   action 'confirm'          → recompute the gap server-side via the ONE
 *     engine (never trust client numbers), create the recurring DERIVED
 *     PROPERTY_MANAGEMENT expense (the payload built ONLY by
 *     buildDerivedAgentCostExpense), and — learn-once — upsert the stream's
 *     AgentDisbursementRule so future in-tolerance disbursements auto-derive
 *     silently.
 *   action 'confirm-anomaly'  → record the EXCESS over the stream's usual
 *     gap as a ONE-OFF derived expense (likely a repair; counted once,
 *     MON-037 semantics). The recurring baseline row keeps covering the
 *     usual gap; the rule baseline is NOT silently rebased.
 *
 * The derived row is `isTaxDeductible + propertyId + PROPERTY_MANAGEMENT`,
 * so it flows into the canonical tax position's deductions.property through
 * the EXISTING deductible-expense loop — gross income unchanged (spec §5).
 *
 * Compliance (spec §10): this endpoint records what the USER confirmed. It
 * never rules immediate-vs-capital deductibility — the card's copy stays
 * "usually deductible — confirm with your statement or tax agent."
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { classifyIntake } from '@/lib/intake/classifyIntake';
import { createAuditLog } from '@/lib/security/auditLog';
import {
  reconcileManagedRental,
  buildDerivedAgentCostExpense,
  buildAnomalyExcessExpense,
} from '@/lib/calculations/rentalReconciliation';

interface ConfirmRequest {
  action: 'confirm' | 'confirm-anomaly';
  incomeStreamId: string;
  transactionId: string;
  /** Learn-once switch — "Apply to future [agent] disbursements" (default true). */
  applyToFuture?: boolean;
  /** Optional user label for the anomaly excess (e.g. "Hot water repair"). */
  label?: string;
}

export const POST = withPermission('expense.write', async (request, auth) => {
  try {
    const userId = auth.userId;
    const body: ConfirmRequest = await request.json();

    if (!body.incomeStreamId || !body.transactionId || !body.action) {
      return NextResponse.json(
        { error: 'action, incomeStreamId and transactionId are required' },
        { status: 400 },
      );
    }

    const [income, transaction, rule] = await Promise.all([
      prisma.income.findFirst({ where: { id: body.incomeStreamId, userId } }),
      prisma.unifiedTransaction.findFirst({ where: { id: body.transactionId, userId } }),
      prisma.agentDisbursementRule.findUnique({ where: { incomeStreamId: body.incomeStreamId } }),
    ]);

    if (!income) return NextResponse.json({ error: 'Income stream not found' }, { status: 404 });
    if (!transaction) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    if (income.rentalMode !== 'MANAGED') {
      return NextResponse.json(
        { error: 'Reconciliation applies to managed rental streams only' },
        { status: 400 },
      );
    }

    // Recompute server-side via the ONE engine — the client's numbers are
    // display-only, never persisted (§12.2.1).
    const siblingTxns = await prisma.unifiedTransaction.findMany({
      where: { userId, incomeId: income.id },
      select: { date: true },
      orderBy: { date: 'desc' },
      take: 12,
    });
    const reconciliation = reconcileManagedRental({
      declaredGrossAmount: income.amount,
      declaredGrossFrequency: income.frequency,
      netDisbursementAmount: transaction.amount,
      disbursementFrequency: rule?.cadence ?? null,
      disbursementDates: [transaction.date, ...siblingTxns.map((t: { date: Date }) => t.date)],
      rule: rule
        ? { baselineGapAmount: rule.baselineGapAmount, tolerancePct: rule.tolerancePct }
        : null,
    });

    const ctx = {
      userId,
      ownerEntityId: income.ownerEntityId,
      incomeStreamId: income.id,
      propertyId: income.propertyId,
      managingAgentName: income.managingAgentName,
    };

    if (body.action === 'confirm') {
      if (!reconciliation.material) {
        return NextResponse.json(
          { error: 'The gap is not material — nothing to record' },
          { status: 400 },
        );
      }

      // Never mint a sibling: one recurring derived row per stream.
      const existing = await prisma.expense.findFirst({
        where: { userId, derivedFromIncomeId: income.id, derived: true, isRecurring: true },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'This stream already has a derived agent-cost expense' },
          { status: 409 },
        );
      }

      const payload = buildDerivedAgentCostExpense(ctx, reconciliation);

      // MON-078: recurrence + cadence via the ONE intake classifier — the
      // engine's resolved disbursement cadence is the declared input.
      const intake = classifyIntake({
        kind: 'expense',
        source: 'TRANSACTION_LINK',
        declaredFrequency: payload.frequency,
        declaredIsRecurring: payload.isRecurring,
      });

      const expense = await prisma.expense.create({
        data: { ...payload, frequency: intake.frequency, isRecurring: intake.isRecurring },
      });

      // Learn-once (spec §3): remember this stream's confirmed gap so future
      // in-tolerance disbursements auto-derive silently. §12.11 note: the
      // upsert's update branch can only match THIS stream's rule row
      // (incomeStreamId is unique), and rule rows are created exclusively by
      // this route — no user-entered data can be clobbered.
      let savedRule = rule;
      if (body.applyToFuture !== false) {
        savedRule = await prisma.agentDisbursementRule.upsert({
          where: { incomeStreamId: income.id },
          create: {
            userId,
            incomeStreamId: income.id,
            expectedGrossPerPeriod: reconciliation.grossPerDisbursementPeriod,
            cadence: reconciliation.disbursementFrequency,
            baselineGapAmount: reconciliation.gap,
          },
          update: {
            expectedGrossPerPeriod: reconciliation.grossPerDisbursementPeriod,
            cadence: reconciliation.disbursementFrequency,
            baselineGapAmount: reconciliation.gap,
          },
        });
      }

      // Audit the state change (§12.5); no CDR/financial values in metadata (§13.3).
      void createAuditLog({
        userId,
        action: 'CREATE',
        status: 'SUCCESS',
        entityType: 'Expense',
        entityId: expense.id,
        metadata: { derived: true, source: 'RECONCILIATION', learnOnce: body.applyToFuture !== false },
      });

      return NextResponse.json({
        success: true,
        expense,
        rule: savedRule,
        message: 'Recorded as management & costs — it will appear in your deductions',
      });
    }

    // action === 'confirm-anomaly'
    if (!reconciliation.anomaly || reconciliation.anomalyExcess <= 0) {
      return NextResponse.json(
        { error: 'No anomalous excess to record for this disbursement' },
        { status: 400 },
      );
    }

    const excessPayload = buildAnomalyExcessExpense(ctx, reconciliation, body.label);
    const intake = classifyIntake({
      kind: 'expense',
      source: 'TRANSACTION_LINK',
      declaredFrequency: excessPayload.frequency,
      declaredIsRecurring: excessPayload.isRecurring, // one-off — counted once
    });
    const expense = await prisma.expense.create({
      data: { ...excessPayload, frequency: intake.frequency, isRecurring: intake.isRecurring },
    });

    void createAuditLog({
      userId,
      action: 'CREATE',
      status: 'SUCCESS',
      entityType: 'Expense',
      entityId: expense.id,
      metadata: { derived: true, source: 'RECONCILIATION', anomaly: true },
    });

    return NextResponse.json({
      success: true,
      expense,
      message: 'One-off cost recorded — it will appear in your deductions',
    });
  } catch (error) {
    console.error('Rental reconciliation confirm error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
