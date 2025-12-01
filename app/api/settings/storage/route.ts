/**
 * Phase 19.1: Storage Settings API
 * GET /api/settings/storage - Get storage configuration
 * POST /api/settings/storage - Update storage settings
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// Local enum to avoid Prisma generation issues
const StorageProviderType = {
  MONITRAX: 'MONITRAX',
  GOOGLE_DRIVE: 'GOOGLE_DRIVE',
  ICLOUD: 'ICLOUD',
  ONEDRIVE: 'ONEDRIVE',
} as const;
type StorageProviderTypeValue = (typeof StorageProviderType)[keyof typeof StorageProviderType];

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's storage provider configuration
    const config = await prisma.storageProviderConfig.findUnique({
      where: { userId: user.id },
    });

    // Get document stats
    const documentStats = await prisma.document.aggregate({
      where: {
        userId: user.id,
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

    if (config) {
      if (config.provider === StorageProviderType.GOOGLE_DRIVE) {
        connectedProviders.push({
          provider: StorageProviderType.GOOGLE_DRIVE,
          connected: true,
          isActive: config.isActive,
          email: (config.config as Record<string, string> | null)?.email,
        });
      }
      if (config.provider === StorageProviderType.ICLOUD) {
        connectedProviders.push({
          provider: StorageProviderType.ICLOUD,
          connected: true,
          isActive: config.isActive,
        });
      }
      if (config.provider === StorageProviderType.ONEDRIVE) {
        connectedProviders.push({
          provider: StorageProviderType.ONEDRIVE,
          connected: true,
          isActive: config.isActive,
          email: (config.config as Record<string, string> | null)?.email,
        });
      }
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
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { autoOrganize, includeDatesInFilenames } = body;

    // Update user preferences (could be stored in a separate table)
    // For now, we'll store in the user's storage config
    const existingConfig = await prisma.storageProviderConfig.findUnique({
      where: { userId: user.id },
    });

    if (existingConfig) {
      await prisma.storageProviderConfig.update({
        where: { userId: user.id },
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
}
