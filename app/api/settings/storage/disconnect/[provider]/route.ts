/**
 * Phase 19.1: Disconnect Storage Provider
 * POST /api/settings/storage/disconnect/[provider] - Remove OAuth connection
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
  google_drive: StorageProviderType.GOOGLE_DRIVE,
  icloud: StorageProviderType.ICLOUD,
  onedrive: StorageProviderType.ONEDRIVE,
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { provider } = await params;
    const providerType = PROVIDER_MAP[provider];

    if (!providerType) {
      return NextResponse.json(
        { error: 'Unknown storage provider' },
        { status: 400 }
      );
    }

    // Get current config
    const config = await prisma.storageProviderConfig.findUnique({
      where: { userId: user.id },
    });

    if (!config || config.provider !== providerType) {
      return NextResponse.json(
        { error: 'Provider not connected' },
        { status: 400 }
      );
    }

    // Delete the storage provider config
    await prisma.storageProviderConfig.delete({
      where: { userId: user.id },
    });

    // Optionally: Revoke OAuth tokens with the provider
    // This would require calling the provider's revoke endpoint
    // For now, we just delete the local config

    return NextResponse.json({
      success: true,
      message: `${provider} disconnected successfully`,
    });
  } catch (error) {
    console.error('Failed to disconnect provider:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect provider' },
      { status: 500 }
    );
  }
}
