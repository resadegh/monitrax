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

export async function GET() {
  try {
    // Test database connectivity
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
