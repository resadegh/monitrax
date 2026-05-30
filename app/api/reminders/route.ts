import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import {
  computeAllReminders,
  surfacedReminders,
  summariseReminders,
  applyReminderStates,
  visibleReminders,
} from '@/lib/reminders/reminderEngine';

/**
 * GET /api/reminders — unified renewal/reminder feed (Phase 21.5).
 *
 * THIN wrapper (CLAUDE.md §12.3): fetches only the date columns each producer
 * needs, then delegates ALL logic to the canonical reminder engine
 * (`lib/reminders/reminderEngine.ts`) — the single SSOT for reminder
 * computation (§12.2). No urgency/date math lives here.
 *
 * Returns only SURFACED reminders (overdue / due-soon / upcoming) — OK ones
 * that are far out are dropped so the feed stays calm + actionable.
 *
 * CDR (§13.3): consent reminders carry only the institution name + expiry
 * date + a generic label — no balances, transactions, or account numbers.
 */
export const GET = withPermission('entity.read', async (_request, auth) => {
  try {
    // Bill-feed surfacing window (R1 PR3): due within ~a week, or recently
    // overdue — bounded so the high-volume query stays small + indexed.
    const now = new Date();
    const billWindowStart = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
    const billWindowEnd = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);

    const [assets, properties, loans, connections, states, custom, importAgg, accounts, pref, recurring] =
      await Promise.all([
      prisma.asset.findMany({
        where: { userId: auth.userId },
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          vehicleRegistrationExpiry: true,
          vehicleCtpExpiry: true,
          vehicleCtpProvider: true,
          vehicleInsuranceExpiry: true,
          vehicleInsuranceProvider: true,
          warrantyExpiry: true,
        },
      }),
      prisma.property.findMany({
        where: { userId: auth.userId },
        select: {
          id: true,
          name: true,
          councilRatesDueDate: true,
          waterRatesDueDate: true,
          landTaxDueDate: true,
          buildingInsuranceProvider: true,
          buildingInsuranceExpiry: true,
          strataDueDate: true,
          leaseExpiry: true,
          complianceCertExpiry: true,
        },
      }),
      prisma.loan.findMany({
        where: { userId: auth.userId, rateType: 'FIXED', fixedExpiry: { not: null } },
        select: { id: true, name: true, rateType: true, fixedExpiry: true },
      }),
      prisma.basiqConnection.findMany({
        where: { userId: auth.userId, consentExpiresAt: { not: null } },
        select: { id: true, institutionName: true, consentExpiresAt: true },
      }),
      // Tier 2: per-user snooze/dismiss/done state (CLAUDE.md §12.2 — merged by
      // the pure engine, never re-implemented here).
      prisma.reminderState.findMany({
        where: { userId: auth.userId },
        select: { reminderKey: true, dueDate: true, status: true, snoozedUntil: true },
      }),
      // Tier 2: user-created custom reminders (R1 PR2b).
      prisma.reminder.findMany({
        where: { userId: auth.userId },
        select: { id: true, title: true, dueDate: true, note: true },
      }),
      // R7: how current is the imported transaction data (latest batch coverage).
      prisma.importBatch.aggregate({
        where: { userId: auth.userId, status: { in: ['COMPLETED', 'PARTIAL'] } },
        _max: { dateRangeEnd: true },
      }),
      // R7: account sources — only nudge users who rely on manual import.
      prisma.account.findMany({
        where: { userId: auth.userId },
        select: { balanceSource: true, createdAt: true },
      }),
      // PR3: the opt-in gate for the bank-detected bills feed.
      prisma.userPreference.findUnique({
        where: { userId: auth.userId },
        select: { pushBillReminders: true },
      }),
      // PR3: recurring bills due soon (or recently overdue), active + not paused.
      prisma.recurringPayment.findMany({
        where: {
          userId: auth.userId,
          isActive: true,
          isPaused: false,
          nextExpected: { not: null, gte: billWindowStart, lte: billWindowEnd },
        },
        select: {
          id: true,
          merchantStandardised: true,
          expectedAmount: true,
          nextExpected: true,
          pattern: true,
        },
      }),
    ]);

    // R7: a user "relies on manual import" if they have any non-Basiq account.
    const manualAccounts = accounts.filter((a) => a.balanceSource !== 'BASIQ');
    const earliestManualAccountCreatedAt = manualAccounts.reduce<Date | null>(
      (min, a) => (!min || a.createdAt < min ? a.createdAt : min),
      null
    );

    const surfaced = surfacedReminders(
      computeAllReminders({
        assets,
        properties,
        loans,
        connections: connections.map((c) => ({
          id: c.id,
          name: c.institutionName,
          consentExpiresAt: c.consentExpiresAt,
        })),
        custom,
        importCadence: {
          lastImportedThrough: importAgg._max.dateRangeEnd,
          earliestManualAccountCreatedAt,
          hasManualAccounts: manualAccounts.length > 0,
        },
        // PR3: opt-in — only surface bill reminders when the user enabled them
        // (the previously-dead `pushBillReminders` toggle now has a read effect).
        bills: pref?.pushBillReminders
          ? recurring.map((b) => ({
              id: b.id,
              merchant: b.merchantStandardised,
              expectedAmount: b.expectedAmount,
              nextExpected: b.nextExpected,
              pattern: b.pattern,
            }))
          : undefined,
      })
    );

    // Merge user state, then keep only what's still ACTIVE (snoozed/dismissed/
    // done are held back). The merge auto-resets state once a renewal rolls to
    // its next cycle (engine `applyReminderStates`).
    const reminders = visibleReminders(applyReminderStates(surfaced, states));

    return NextResponse.json({
      data: reminders,
      summary: summariseReminders(reminders),
    });
  } catch (error) {
    console.error('Get reminders error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
