/**
 * GCS "is configured?" detection — the gate that decides whether the storage
 * factory selects GCS as the default backend.
 *
 * The bug this guards against (2026-06-17): the old gate required
 * GCS_SERVICE_ACCOUNT_KEY, so deleting the key to go keyless silently sent
 * uploads back to the DB. GCS is configured when project+bucket are set AND we
 * can auth via EITHER a key OR the keyless WIF env.
 */

import { describe, it, expect } from 'vitest';
import { computeGcsConfigured } from '@/lib/documents/storage/factory';

const LOC = { GCS_PROJECT_ID: 'monitrax-479700', GCS_BUCKET_NAME: 'monitrax-documents' };
const WIF = {
  GCP_WORKLOAD_IDENTITY_PROVIDER: '//iam.googleapis.com/projects/1/locations/global/workloadIdentityPools/p/providers/v',
  GCP_SERVICE_ACCOUNT_EMAIL: 'vercel-monitrax-db@monitrax-479700.iam.gserviceaccount.com',
};

describe('computeGcsConfigured', () => {
  it('TRUE with project+bucket + keyless WIF env (no key) — the keyless prod path', () => {
    expect(computeGcsConfigured({ ...LOC, ...WIF } as NodeJS.ProcessEnv)).toBe(true);
  });

  it('TRUE with project+bucket + a service-account key (legacy path)', () => {
    expect(computeGcsConfigured({ ...LOC, GCS_SERVICE_ACCOUNT_KEY: 'base64' } as NodeJS.ProcessEnv)).toBe(true);
  });

  it('FALSE when bucket/project are missing even if auth is present', () => {
    expect(computeGcsConfigured({ ...WIF } as NodeJS.ProcessEnv)).toBe(false);
    expect(computeGcsConfigured({ GCS_PROJECT_ID: 'p', ...WIF } as NodeJS.ProcessEnv)).toBe(false);
  });

  it('FALSE when location is set but there is NO auth (no key, no WIF) — local dev', () => {
    expect(computeGcsConfigured({ ...LOC } as NodeJS.ProcessEnv)).toBe(false);
  });

  it('FALSE when only one of the two WIF vars is present', () => {
    expect(computeGcsConfigured({ ...LOC, GCP_SERVICE_ACCOUNT_EMAIL: 'x@y' } as NodeJS.ProcessEnv)).toBe(false);
    expect(computeGcsConfigured({ ...LOC, GCP_WORKLOAD_IDENTITY_PROVIDER: '//iam...' } as NodeJS.ProcessEnv)).toBe(false);
  });
});
