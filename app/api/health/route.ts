import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// Pin to Sydney + Node runtime + dynamic rendering so the function never
// drifts to iad1 or gets edge-optimised. WIF + Cloud SQL IAM auth requires
// the Node runtime (request-context AsyncLocalStorage isn't populated for
// Edge — vercel#12071) and the connector adds ~300-700ms of cold-start
// latency that's only tolerable in the same region as the DB (syd1).
// Observed 2026-05-01: GCP uptime check showed this route running in iad1
// despite the project-level region default of syd1 — root caused to no
// per-route override on a simple handler.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'syd1';

// Bounded retry around the connectivity probe so a single unlucky probe —
// cold-start auth-chain jitter (OIDC→STS→IAM Credentials), a momentary
// connection-pool contention window (Postgres 53300), or a transient connect
// blip — doesn't flip the route to 503 and page a false P0. This does NOT
// mask a real outage: the GCP A1 alert requires ~2 consecutive minutes of
// failed probes (see runbooks/08_OBSERVABILITY_SLOS.md §3 A1), and a genuine
// 2-min DB-unreachable window fails every attempt of every probe regardless.
// It only absorbs sub-second transients that the alarm should never page on.
//
// Kept deliberately tight (2 attempts, one short backoff): worst-case added
// latency on the failure path is ~150ms, well inside the uptime-check timeout,
// and the lib/db.ts TLS-handshake retry still handles cert-rotation transients
// underneath this. Context: the 2026-06-02 03:32 AEST transient P0 that
// self-recovered (docs/changelog/CHANGELOG_2026_06_03.md).
const HEALTH_PROBE_ATTEMPTS = 2;
const HEALTH_PROBE_BACKOFF_MS = 150;

export async function GET() {
  let lastError: unknown;

  for (let attempt = 1; attempt <= HEALTH_PROBE_ATTEMPTS; attempt++) {
    try {
      // Test database connectivity
      await prisma.$queryRaw`SELECT 1`;

      return NextResponse.json({
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      lastError = error;
      if (attempt < HEALTH_PROBE_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, HEALTH_PROBE_BACKOFF_MS));
      }
    }
  }

  // Every attempt failed — this is a sustained DB-connectivity failure, not a
  // single-probe transient. Surface it as 503 so the A1 alert can do its job.
  console.error(`Health check failed after ${HEALTH_PROBE_ATTEMPTS} attempts:`, lastError);
  return NextResponse.json(
    {
      status: 'unhealthy',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    },
    { status: 503 }
  );
}
