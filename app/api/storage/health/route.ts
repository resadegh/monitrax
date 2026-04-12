/**
 * Storage Health Check API
 * GET /api/storage/health
 * Returns storage provider status and configuration
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  getStorageProviderFactory,
  isGoogleCloudStorageConfigured,
} from '@/lib/documents/storage';

export const GET = withPermission('settings.read', async () => {
  try {
    const factory = getStorageProviderFactory();

    // Track initialization errors
    let gcsInitError: string | null = null;
    let gcsHealth = false;
    let gcsInfo = null;

    try {
      await factory.initialize();
    } catch (initError) {
      console.error('Factory initialization error:', initError);
      gcsInitError = initError instanceof Error ? initError.message : 'Initialization failed';
    }

    // Get health status for all providers
    const monitraxHealth = await factory.getMonitraxProvider().healthCheck();
    const gcsProvider = factory.getGCSProvider();

    if (gcsProvider && !gcsInitError) {
      try {
        gcsHealth = await gcsProvider.healthCheck();
        if (gcsHealth) {
          gcsInfo = await gcsProvider.getBucketInfo();
        }
      } catch (healthError) {
        console.error('GCS health check error:', healthError);
        gcsInitError = healthError instanceof Error ? healthError.message : 'Health check failed';
      }
    }

    // Determine if GCS is truly available (configured + healthy)
    const gcsConfigured = isGoogleCloudStorageConfigured();
    const gcsReady = gcsConfigured && gcsHealth && !gcsInitError;

    return NextResponse.json({
      success: true,
      storage: {
        configured: {
          monitrax: true,
          googleCloudStorage: gcsConfigured,
        },
        healthy: {
          monitrax: monitraxHealth,
          googleCloudStorage: gcsHealth,
        },
        ready: {
          monitrax: monitraxHealth,
          googleCloudStorage: gcsReady,
        },
        activeProvider: gcsReady ? 'google_cloud_storage' : 'monitrax',
        googleCloudStorage: gcsInfo
          ? {
              bucket: gcsInfo.name,
              location: gcsInfo.location,
              storageClass: gcsInfo.storageClass,
            }
          : null,
        error: gcsInitError,
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
});
