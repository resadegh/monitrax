/**
 * TESTING FRAMEWORK API
 *
 * Main entry point for the Monitrax testing framework.
 *
 * GET /api/testing
 * Returns API documentation and status
 *
 * POST /api/testing
 * Run a complete test cycle: reset -> load -> export
 *
 * Body: TestScenarioInput (JSON)
 * Returns: { loadResult, exportResult }
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { runTestScenario, verifyOutputs } from '@/lib/testing';
import type { TestScenarioInput } from '@/lib/testing/types';

// Only allow in development/test environments
const isTestingEnabled = process.env.NODE_ENV !== 'production' ||
  process.env.ENABLE_TESTING_API === 'true';

/**
 * GET /api/testing
 * Returns API documentation
 */
export async function GET() {
  const enabled = isTestingEnabled;

  return NextResponse.json({
    name: 'Monitrax Testing Framework',
    version: '1.0',
    enabled,
    description: 'Automated testing framework for external AI verification',
    endpoints: {
      'GET /api/testing': 'This documentation',
      'POST /api/testing': 'Run complete test cycle (reset -> load -> export)',
      'POST /api/testing/load': 'Load a test scenario',
      'GET /api/testing/export': 'Export all calculated values',
      'DELETE /api/testing/reset': 'Reset test data',
    },
    workflow: [
      '1. Create test scenario JSON following the schema',
      '2. POST to /api/testing with the scenario',
      '3. Receive all calculated outputs in response',
      '4. Compare outputs against expected values externally',
    ],
    availableFixtures: [
      'simple-homeowner - Basic scenario with 1 property, 1 loan',
      'property-investor - Multiple investment properties with depreciation',
      'mixed-portfolio - Properties + investments + multiple income streams',
      'edge-cases - High LVR, IO loans, credit cards, CGT scenarios',
    ],
    schemaLocation: '/lib/testing/schemas/test-scenario.schema.json',
    fixturesLocation: '/lib/testing/fixtures/',
    calculatedOutputs: [
      'netWorth - Total assets, liabilities, net worth breakdown',
      'cashflow - Income, expenses, loan repayments, savings rate',
      'gearing - Portfolio LVR, debt-to-income, per-property LVR',
      'propertyMetrics - Per-property yields, equity, cashflow',
      'loanMetrics - Per-loan interest, effective principal, offset savings',
      'investmentMetrics - Holdings, cost base, unrealised gains',
      'depreciation - DIV40/DIV43 annual depreciation',
      'linkageHealth - GRDCS completeness, orphan detection',
      'insights - Risk signals, warnings, opportunities',
      'taxExposure - Taxable income, deductions, franking credits',
    ],
  });
}

/**
 * POST /api/testing
 * Run a complete test cycle
 */
export async function POST(request: NextRequest) {
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

    // Run complete test cycle
    const { loadResult, exportResult } = await runTestScenario(scenario, prisma);

    // Verify against expected outputs if provided
    let verification = null;
    if (scenario.expectedOutputs) {
      verification = verifyOutputs(exportResult, scenario.expectedOutputs);
    }

    return NextResponse.json({
      success: loadResult.success,
      loadResult,
      exportResult,
      verification,
    });
  } catch (error) {
    console.error('Test cycle error:', error);
    return NextResponse.json(
      {
        error: 'Failed to run test cycle',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
