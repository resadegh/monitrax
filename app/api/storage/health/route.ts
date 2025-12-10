/**
 * Storage Health Check API
 * GET /api/storage/health
 * Returns storage provider status and configuration
 */

import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import {
  getStorageProviderFactory,
  isGoogleCloudStorageConfigured,
} from '@/lib/documents/storage';

export async function GET(request: Request) {
  try {
    // Verify authentication
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const factory = getStorageProviderFactory();
    await factory.initialize();

    // Get health status for all providers
    const monitraxHealth = await factory.getMonitraxProvider().healthCheck();
    const gcsProvider = factory.getGCSProvider();
    const gcsHealth = gcsProvider ? await gcsProvider.healthCheck() : false;
    const gcsInfo = gcsProvider ? await gcsProvider.getBucketInfo() : null;

    return NextResponse.json({
      success: true,
      storage: {
        configured: {
          monitrax: true,
          googleCloudStorage: isGoogleCloudStorageConfigured(),
        },
        healthy: {
          monitrax: monitraxHealth,
          googleCloudStorage: gcsHealth,
        },
        activeProvider: factory.isGCSAvailable() ? 'google_cloud_storage' : 'monitrax',
        googleCloudStorage: gcsInfo
          ? {
              bucket: gcsInfo.name,
              location: gcsInfo.location,
              storageClass: gcsInfo.storageClass,
            }
          : null,
      },
      env: {
        GCS_PROJECT_ID: process.env.GCS_PROJECT_ID ? 'set' : 'not set',
        GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME || 'not set',
        GCS_SERVICE_ACCOUNT_KEY: process.env.GCS_SERVICE_ACCOUNT_KEY ? 'set' : 'not set',
      },
    });
  } catch (error) {
    console.error('Storage health check error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Health check failed',
      },
      { status: 500 }
    );
  }
}
