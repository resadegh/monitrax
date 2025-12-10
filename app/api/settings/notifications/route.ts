import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { prisma } from '@/lib/db';

/**
 * GET /api/settings/notifications
 * Get user notification preferences
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get or create user preferences
    let preferences = await prisma.userPreference.findUnique({
      where: { userId: auth.userId },
    });

    if (!preferences) {
      preferences = await prisma.userPreference.create({
        data: {
          userId: auth.userId,
        },
      });
    }

    return NextResponse.json({
      email: {
        weeklyDigest: preferences.emailWeeklyDigest,
        monthlyReport: preferences.emailMonthlyReport,
        alerts: preferences.emailAlerts,
        productUpdates: preferences.emailProductUpdates,
      },
      push: {
        cashflowAlerts: preferences.pushCashflowAlerts,
        spendingAlerts: preferences.pushSpendingAlerts,
        goalUpdates: preferences.pushGoalUpdates,
        billReminders: preferences.pushBillReminders,
      },
    });
  } catch (error) {
    console.error('Get notification settings error:', error);
    return NextResponse.json(
      { error: 'Failed to get notification settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/notifications
 * Update user notification preferences
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { email, push } = body;

    // Build update data
    const updateData: Record<string, boolean> = {};

    if (email) {
      if (typeof email.weeklyDigest === 'boolean') {
        updateData.emailWeeklyDigest = email.weeklyDigest;
      }
      if (typeof email.monthlyReport === 'boolean') {
        updateData.emailMonthlyReport = email.monthlyReport;
      }
      if (typeof email.alerts === 'boolean') {
        updateData.emailAlerts = email.alerts;
      }
      if (typeof email.productUpdates === 'boolean') {
        updateData.emailProductUpdates = email.productUpdates;
      }
    }

    if (push) {
      if (typeof push.cashflowAlerts === 'boolean') {
        updateData.pushCashflowAlerts = push.cashflowAlerts;
      }
      if (typeof push.spendingAlerts === 'boolean') {
        updateData.pushSpendingAlerts = push.spendingAlerts;
      }
      if (typeof push.goalUpdates === 'boolean') {
        updateData.pushGoalUpdates = push.goalUpdates;
      }
      if (typeof push.billReminders === 'boolean') {
        updateData.pushBillReminders = push.billReminders;
      }
    }

    // Update or create preferences
    const preferences = await prisma.userPreference.upsert({
      where: { userId: auth.userId },
      update: updateData,
      create: {
        userId: auth.userId,
        ...updateData,
      },
    });

    return NextResponse.json({
      success: true,
      notifications: {
        email: {
          weeklyDigest: preferences.emailWeeklyDigest,
          monthlyReport: preferences.emailMonthlyReport,
          alerts: preferences.emailAlerts,
          productUpdates: preferences.emailProductUpdates,
        },
        push: {
          cashflowAlerts: preferences.pushCashflowAlerts,
          spendingAlerts: preferences.pushSpendingAlerts,
          goalUpdates: preferences.pushGoalUpdates,
          billReminders: preferences.pushBillReminders,
        },
      },
    });
  } catch (error) {
    console.error('Update notification settings error:', error);
    return NextResponse.json(
      { error: 'Failed to update notification settings' },
      { status: 500 }
    );
  }
}
