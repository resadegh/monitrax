/**
 * TEST SCENARIO EXPORT API
 *
 * GET /api/testing/export?userId=xxx&scenarioId=xxx&scenarioName=xxx
 * Exports all calculated values for a test user
 *
 * Query params:
 * - userId: Required - User ID to export data for
 * - scenarioId: Optional - Scenario identifier (default: 'unknown')
 * - scenarioName: Optional - Scenario name (default: 'Unknown Scenario')
 *
 * Returns: TestExportOutput
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { TestScenarioExporter } from '@/lib/testing/exporter';

// Fix: G42 — Block testing routes unconditionally in production (CDR compliance)
const isTestingEnabled = process.env.NODE_ENV !== 'production';

export async function GET(request: NextRequest) {
  // Security check
  if (!isTestingEnabled) {
    return NextResponse.json(
      { error: 'Testing API is disabled in production' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const scenarioId = searchParams.get('scenarioId') || 'unknown';
    const scenarioName = searchParams.get('scenarioName') || 'Unknown Scenario';

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required parameter: userId' },
        { status: 400 }
      );
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const exporter = new TestScenarioExporter(prisma);
    const result = await exporter.exportScenario(userId, scenarioId, scenarioName);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Test export error:', error);
    return NextResponse.json(
      {
        error: 'Failed to export test data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/testing/export
 * Export by email (convenience method)
 *
 * Body: { email: string, scenarioId?: string, scenarioName?: string }
 */
export async function POST(request: NextRequest) {
  if (!isTestingEnabled) {
    return NextResponse.json(
      { error: 'Testing API is disabled in production' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { email, scenarioId = 'unknown', scenarioName = 'Unknown Scenario' } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Missing required field: email' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const exporter = new TestScenarioExporter(prisma);
    const result = await exporter.exportScenario(user.id, scenarioId, scenarioName);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Test export error:', error);
    return NextResponse.json(
      {
        error: 'Failed to export test data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
