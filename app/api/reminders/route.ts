import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import {
  computeAllReminders,
  surfacedReminders,
  summariseReminders,
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
    const [assets, properties, loans, connections] = await Promise.all([
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
    ]);

    const reminders = surfacedReminders(
      computeAllReminders({
        assets,
        properties,
        loans,
        connections: connections.map((c) => ({
          id: c.id,
          name: c.institutionName,
          consentExpiresAt: c.consentExpiresAt,
        })),
      })
    );

    return NextResponse.json({
      data: reminders,
      summary: summariseReminders(reminders),
    });
  } catch (error) {
    console.error('Get reminders error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
