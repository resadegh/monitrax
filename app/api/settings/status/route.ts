import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { prisma } from '@/lib/db';

/**
 * GET /api/settings/status
 *
 * Settings overview shown on /dashboard/settings (the General tab).
 *
 * Reads canonical state from user_preferences + users. Prior to the
 * 2026-05-08 settings overhaul this endpoint hardcoded notifications
 * and profile completeness, so the General tab lied to the user about
 * the state of every other tab.
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

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        name: true,
        email: true,
        mobile: true,
        phone: true,
        location: true,
        timezone: true,
        bio: true,
        mfaEnabled: true,
        deletionRequestedAt: true,
        deletionScheduledFor: true,
        trustedContactName: true,
        mfaMethods: {
          where: { isEnabled: true },
          select: { type: true },
        },
        storageProviderConfig: {
          select: { provider: true, isActive: true },
        },
        userPreference: {
          select: {
            preferredCurrency: true,
            preferredDateFormat: true,
            country: true,
            theme: true,
            emailWeeklyDigest: true,
            emailMonthlyReport: true,
            emailAlerts: true,
            emailProductUpdates: true,
            pushCashflowAlerts: true,
            pushSpendingAlerts: true,
            pushGoalUpdates: true,
            pushBillReminders: true,
          },
        },
        documents: {
          select: { id: true },
          take: 1000,
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // ---- Storage ----
    const documentCount = user.documents?.length || 0;
    const storageUsed = documentCount * 0.5; // Estimate 0.5MB / document
    const storageLimit = 5120; // 5GB
    const storageUsedPercent = Math.round((storageUsed / storageLimit) * 100);
    const activeProvider = user.storageProviderConfig?.provider || 'MONITRAX';

    // ---- Notifications ---- (now reads from user_preferences)
    const prefs = user.userPreference;
    const emailEnabled = !!(
      prefs?.emailWeeklyDigest ||
      prefs?.emailMonthlyReport ||
      prefs?.emailAlerts ||
      prefs?.emailProductUpdates
    );
    const pushEnabled = !!(
      prefs?.pushCashflowAlerts ||
      prefs?.pushSpendingAlerts ||
      prefs?.pushGoalUpdates ||
      prefs?.pushBillReminders
    );

    // ---- Profile completeness ---- (real, not hardcoded 60)
    const profileFields = {
      name: !!user.name,
      email: !!user.email,
      mobile: !!user.mobile,
      phone: !!user.phone,
      location: !!user.location,
      bio: !!user.bio,
      timezone: !!user.timezone,
      trustedContact: !!user.trustedContactName,
    };
    const totalFields = Object.keys(profileFields).length;
    const filledFields = Object.values(profileFields).filter(Boolean).length;
    const completeness = Math.round((filledFields / totalFields) * 100);
    const missingFields = Object.entries(profileFields)
      .filter(([, filled]) => !filled)
      .map(([k]) => k);

    // ---- Account lifecycle ----
    const pendingDeletion = !!user.deletionRequestedAt;

    return NextResponse.json({
      security: {
        mfaEnabled: user.mfaEnabled,
        mfaMethods: user.mfaMethods?.map((m: { type: string }) => m.type) || [],
        status: user.mfaEnabled ? 'protected' : 'at_risk',
        message: user.mfaEnabled
          ? 'Two-factor authentication is enabled'
          : 'Enable 2FA to secure your account',
      },
      storage: {
        provider: activeProvider,
        usedMB: Math.round(storageUsed),
        limitMB: storageLimit,
        usedPercent: storageUsedPercent,
        documentsCount: documentCount,
        status: storageUsedPercent > 80 ? 'warning' : 'ok',
        message:
          storageUsedPercent > 80
            ? 'Storage is almost full'
            : `${Math.round(storageUsed)}MB of ${storageLimit / 1024}GB used`,
      },
      notifications: {
        emailEnabled,
        pushEnabled,
        status: emailEnabled || pushEnabled ? 'ok' : 'off',
        message:
          emailEnabled && pushEnabled
            ? 'Email + push notifications enabled'
            : emailEnabled
              ? 'Email notifications enabled'
              : pushEnabled
                ? 'Push notifications enabled'
                : 'No notifications enabled',
      },
      profile: {
        completeness,
        status: completeness >= 80 ? 'complete' : 'incomplete',
        message:
          completeness >= 80
            ? 'Your profile looks great'
            : 'Complete your profile for a better experience',
        missingFields,
      },
      preferences: {
        currency: prefs?.preferredCurrency || 'AUD',
        dateFormat: prefs?.preferredDateFormat || 'DD/MM/YYYY',
        country: prefs?.country || 'AU',
        theme: prefs?.theme || 'system',
      },
      account: {
        pendingDeletion,
        deletionScheduledFor: user.deletionScheduledFor,
      },
    });
  } catch (error) {
    console.error('Settings status error:', error);
    return NextResponse.json(
      { error: 'Failed to get settings status' },
      { status: 500 }
    );
  }
}
