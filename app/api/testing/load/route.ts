/**
 * TEST SCENARIO LOAD API
 *
 * POST /api/testing/load
 * Loads a test scenario into the database
 *
 * Body: TestScenarioInput (JSON)
 *
 * Returns: TestLoadResult
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { TestScenarioLoader } from '@/lib/testing/loader';
import type { TestScenarioInput } from '@/lib/testing/types';

// Fix: G42 — Block testing routes unconditionally in production (CDR compliance)
const isTestingEnabled = process.env.NODE_ENV !== 'production';

export async function POST(request: NextRequest) {
  // Security check
  if (!isTestingEnabled) {
    return NextResponse.json(
      { error: 'Testing API is disabled in production' },
      { status: 403 }
    );
  }

  try {
    const scenario: TestScenarioInput = await request.json();

    // Validate required fields
    if (!scenario.scenarioId || !scenario.name || !scenario.testUser?.email) {
      return NextResponse.json(
        { error: 'Missing required fields: scenarioId, name, testUser.email' },
        { status: 400 }
      );
    }

    // Ensure test user email is clearly marked as test
    if (!scenario.testUser.email.includes('test') && !scenario.testUser.email.includes('@monitrax.test')) {
      return NextResponse.json(
        { error: 'Test user email must contain "test" or use @monitrax.test domain' },
        { status: 400 }
      );
    }

    const loader = new TestScenarioLoader(prisma);
    const result = await loader.loadScenario(scenario);

    return NextResponse.json(result, {
      status: result.success ? 200 : 207, // 207 Multi-Status for partial success
    });
  } catch (error) {
    console.error('Test load error:', error);
    return NextResponse.json(
      {
        error: 'Failed to load test scenario',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/testing/load
 * Returns available fixtures and schema information
 */
export async function GET() {
  if (!isTestingEnabled) {
    return NextResponse.json(
      { error: 'Testing API is disabled in production' },
      { status: 403 }
    );
  }

  return NextResponse.json({
    description: 'Test Scenario Loader API',
    usage: {
      method: 'POST',
      contentType: 'application/json',
      body: 'TestScenarioInput JSON object',
    },
    availableFixtures: [
      'simple-homeowner',
      'property-investor',
      'mixed-portfolio',
      'edge-cases',
    ],
    schemaLocation: '/lib/testing/schemas/test-scenario.schema.json',
    fixturesLocation: '/lib/testing/fixtures/',
  });
}
