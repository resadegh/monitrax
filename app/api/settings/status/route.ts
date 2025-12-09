import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { prisma } from '@/lib/db';

/**
 * GET /api/settings/status
 * Get settings overview status for authenticated user
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

    // Get user with related data
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        mfaEnabled: true,
        mfaMethods: {
          where: { isEnabled: true },
          select: { type: true },
        },
        storageProviderConfig: {
          select: {
            provider: true,
            isActive: true,
          },
        },
        userPreference: {
          select: {
            preferredCurrency: true,
            preferredDateFormat: true,
          },
        },
        documents: {
          select: { id: true },
          take: 1000, // Just to count
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get document storage stats
    const documentCount = user.documents?.length || 0;

    // Calculate storage usage (simplified - in real app, sum file sizes)
    const storageUsed = documentCount * 0.5; // Estimate 0.5MB per document
    const storageLimit = 5120; // 5GB in MB
    const storageUsedPercent = Math.round((storageUsed / storageLimit) * 100);

    // Determine active storage provider
    const activeProvider = user.storageProviderConfig?.provider || 'MONITRAX';

    // Build status response
    const status = {
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
        emailEnabled: true, // Default - would come from preferences
        pushEnabled: false, // Default - would come from preferences
        status: 'ok',
        message: 'Email notifications enabled',
      },
      profile: {
        completeness: 60, // Calculate based on filled fields
        status: 'incomplete',
        message: 'Complete your profile for better experience',
        missingFields: ['avatar', 'bio'],
      },
      preferences: {
        currency: user.userPreference?.preferredCurrency || 'AUD',
        dateFormat: user.userPreference?.preferredDateFormat || 'DD/MM/YYYY',
      },
    };

    return NextResponse.json(status);
  } catch (error) {
    console.error('Settings status error:', error);
    return NextResponse.json(
      { error: 'Failed to get settings status' },
      { status: 500 }
    );
  }
}
