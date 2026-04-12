/**
 * Phase 19.1: Storage Settings API
 * GET /api/settings/storage - Get storage configuration
 * POST /api/settings/storage - Update storage settings
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';

// Local enum to avoid Prisma generation issues
const StorageProviderType = {
  MONITRAX: 'MONITRAX',
  LOCAL_DRIVE: 'LOCAL_DRIVE',
} as const;
type StorageProviderTypeValue = (typeof StorageProviderType)[keyof typeof StorageProviderType];

export const GET = withPermission('settings.read', async (request, auth) => {
  try {
    const userId = auth.userId;

    // Get user's storage provider configuration
    const config = await prisma.storageProviderConfig.findUnique({
      where: { userId },
    });

    // Get document stats
    const documentStats = await prisma.document.aggregate({
      where: {
        userId,
        deletedAt: null,
      },
      _count: true,
      _sum: {
        size: true,
      },
    });

    // Check which providers are connected
    const connectedProviders: {
      provider: StorageProviderTypeValue;
      connected: boolean;
      isActive: boolean;
      email?: string;
    }[] = [
      {
        provider: StorageProviderType.MONITRAX,
        connected: true,
        isActive: !config || config.provider === StorageProviderType.MONITRAX,
      },
    ];

    if (config && config.provider === StorageProviderType.LOCAL_DRIVE) {
      connectedProviders.push({
        provider: StorageProviderType.LOCAL_DRIVE,
        connected: true,
        isActive: config.isActive,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        activeProvider: config?.isActive ? config.provider : 'MONITRAX',
        providers: connectedProviders,
        stats: {
          documentsCount: documentStats._count,
          storageUsed: documentStats._sum.size || 0,
          storageLimit: 1024 * 1024 * 1024, // 1GB for Monitrax
        },
      },
    });
  } catch (error) {
    console.error('Failed to get storage settings:', error);
    return NextResponse.json(
      { error: 'Failed to get storage settings' },
      { status: 500 }
    );
  }
});

export const POST = withPermission('settings.write', async (request, auth) => {
  try {
    const userId = auth.userId;

    const body = await request.json();
    const { autoOrganize, includeDatesInFilenames } = body;

    // Update user preferences (could be stored in a separate table)
    // For now, we'll store in the user's storage config
    const existingConfig = await prisma.storageProviderConfig.findUnique({
      where: { userId },
    });

    if (existingConfig) {
      await prisma.storageProviderConfig.update({
        where: { userId },
        data: {
          config: {
            ...(existingConfig.config as object || {}),
            autoOrganize,
            includeDatesInFilenames,
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Storage settings updated',
    });
  } catch (error) {
    console.error('Failed to update storage settings:', error);
    return NextResponse.json(
      { error: 'Failed to update storage settings' },
      { status: 500 }
    );
  }
});
