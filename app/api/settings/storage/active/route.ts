/**
 * Phase 19.1: Set Active Storage Provider
 * POST /api/settings/storage/active - Set the active storage provider
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

const PROVIDER_MAP: Record<string, StorageProviderTypeValue> = {
  monitrax: StorageProviderType.MONITRAX,
  google_drive: StorageProviderType.GOOGLE_DRIVE,
  icloud: StorageProviderType.ICLOUD,
  onedrive: StorageProviderType.ONEDRIVE,
};

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { providerId } = body;

    if (!providerId) {
      return NextResponse.json(
        { error: 'Provider ID is required' },
        { status: 400 }
      );
    }

    const providerType = PROVIDER_MAP[providerId];

    if (!providerType) {
      return NextResponse.json(
        { error: 'Unknown storage provider' },
        { status: 400 }
      );
    }

    // If switching to Monitrax, just deactivate any external provider
    if (providerType === StorageProviderType.MONITRAX) {
      const existingConfig = await prisma.storageProviderConfig.findUnique({
        where: { userId: user.id },
      });

      if (existingConfig) {
        await prisma.storageProviderConfig.update({
          where: { userId: user.id },
          data: { isActive: false },
        });
      }

      return NextResponse.json({
        success: true,
        activeProvider: 'MONITRAX',
      });
    }

    // Check if the provider is connected
    const config = await prisma.storageProviderConfig.findUnique({
      where: { userId: user.id },
    });

    if (!config || config.provider !== providerType) {
      return NextResponse.json(
        { error: 'Provider not connected. Please connect it first.' },
        { status: 400 }
      );
    }

    // Set as active
    await prisma.storageProviderConfig.update({
      where: { userId: user.id },
      data: { isActive: true },
    });

    return NextResponse.json({
      success: true,
      activeProvider: providerType,
    });
  } catch (error) {
    console.error('Failed to set active provider:', error);
    return NextResponse.json(
      { error: 'Failed to set active provider' },
      { status: 500 }
    );
  }
}
