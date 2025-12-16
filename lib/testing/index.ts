/**
 * MONITRAX TESTING FRAMEWORK
 * Comprehensive testing utilities for automated verification
 *
 * @module lib/testing
 *
 * Usage:
 * 1. Load a test scenario: POST /api/testing/load with scenario JSON
 * 2. Export calculated values: GET /api/testing/export?userId=xxx
 * 3. Reset test data: DELETE /api/testing/reset?userId=xxx
 *
 * For external AI verification:
 * - Load test fixtures with known input values
 * - Export all calculated outputs
 * - Compare against expected values independently
 */

// Types
export * from './types';

// Normalizer (for flexible input format)
export { normalizeScenario, type FlexibleScenarioInput } from './normalizer';

// Loader
export { TestScenarioLoader, loadTestScenario, loadTestScenarioFromFile } from './loader';

// Exporter
export { TestScenarioExporter, exportTestScenario } from './exporter';

// Reset
export {
  TestScenarioReset,
  resetTestUser,
  resetTestUserByEmail,
  deleteTestUser,
} from './reset';

// =============================================================================
// FIXTURE PATHS
// =============================================================================

/**
 * Available test fixtures
 */
export const FIXTURES = {
  SIMPLE_HOMEOWNER: 'simple-homeowner',
  PROPERTY_INVESTOR: 'property-investor',
  MIXED_PORTFOLIO: 'mixed-portfolio',
  EDGE_CASES: 'edge-cases',
} as const;

/**
 * Get fixture path
 */
export function getFixturePath(fixture: keyof typeof FIXTURES | string): string {
  const fixtureName = typeof fixture === 'string' && fixture in FIXTURES
    ? FIXTURES[fixture as keyof typeof FIXTURES]
    : fixture;
  return `${process.cwd()}/lib/testing/fixtures/${fixtureName}.json`;
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

import { PrismaClient } from '@prisma/client';
import type { TestScenarioInput, TestLoadResult, TestExportOutput, TestResetResult } from './types';
import type { FlexibleScenarioInput } from './normalizer';
import { TestScenarioLoader } from './loader';
import { TestScenarioExporter } from './exporter';
import { TestScenarioReset } from './reset';

/**
 * Run a complete test cycle: reset -> load -> export
 * Accepts flexible input format (with IDs or name-based references)
 */
export async function runTestScenario(
  scenario: TestScenarioInput | FlexibleScenarioInput,
  prisma?: PrismaClient
): Promise<{
  loadResult: TestLoadResult;
  exportResult: TestExportOutput;
}> {
  const client = prisma || new PrismaClient();

  try {
    // Reset existing data for this test user
    const resetter = new TestScenarioReset(client);
    const existingUserId = await resetter.findTestUser(scenario.testUser.email);
    if (existingUserId) {
      await resetter.resetUser(existingUserId);
    }

    // Load the scenario
    const loader = new TestScenarioLoader(client);
    const loadResult = await loader.loadScenario(scenario);

    if (!loadResult.success) {
      throw new Error(`Failed to load scenario: ${loadResult.errors.map(e => e.error).join(', ')}`);
    }

    // Export the results
    const exporter = new TestScenarioExporter(client);
    const exportResult = await exporter.exportScenario(
      loadResult.userId,
      scenario.scenarioId,
      scenario.name
    );

    return { loadResult, exportResult };
  } finally {
    if (!prisma) {
      await client.$disconnect();
    }
  }
}

/**
 * Run a test scenario from a fixture file
 */
export async function runTestScenarioFromFile(
  fixturePath: string,
  prisma?: PrismaClient
): Promise<{
  loadResult: TestLoadResult;
  exportResult: TestExportOutput;
}> {
  const fs = await import('fs/promises');
  const content = await fs.readFile(fixturePath, 'utf-8');
  const scenario: TestScenarioInput = JSON.parse(content);
  return runTestScenario(scenario, prisma);
}

/**
 * Verify expected outputs against actual
 */
export function verifyOutputs(
  actual: TestExportOutput,
  expected: TestScenarioInput['expectedOutputs'],
  tolerance: number = 0.01
): {
  passed: boolean;
  failures: Array<{ field: string; expected: number; actual: number; difference: number }>;
} {
  const failures: Array<{ field: string; expected: number; actual: number; difference: number }> = [];

  if (!expected) {
    return { passed: true, failures: [] };
  }

  // Check net worth
  if (expected.netWorth) {
    if (expected.netWorth.totalAssets !== undefined) {
      const diff = Math.abs(actual.calculatedOutputs.netWorth.totalAssets - expected.netWorth.totalAssets);
      if (diff / expected.netWorth.totalAssets > tolerance) {
        failures.push({
          field: 'netWorth.totalAssets',
          expected: expected.netWorth.totalAssets,
          actual: actual.calculatedOutputs.netWorth.totalAssets,
          difference: diff,
        });
      }
    }
    if (expected.netWorth.totalLiabilities !== undefined) {
      const diff = Math.abs(actual.calculatedOutputs.netWorth.totalLiabilities - expected.netWorth.totalLiabilities);
      if (diff / expected.netWorth.totalLiabilities > tolerance) {
        failures.push({
          field: 'netWorth.totalLiabilities',
          expected: expected.netWorth.totalLiabilities,
          actual: actual.calculatedOutputs.netWorth.totalLiabilities,
          difference: diff,
        });
      }
    }
    if (expected.netWorth.netWorth !== undefined) {
      const diff = Math.abs(actual.calculatedOutputs.netWorth.netWorth - expected.netWorth.netWorth);
      if (diff / Math.abs(expected.netWorth.netWorth) > tolerance) {
        failures.push({
          field: 'netWorth.netWorth',
          expected: expected.netWorth.netWorth,
          actual: actual.calculatedOutputs.netWorth.netWorth,
          difference: diff,
        });
      }
    }
  }

  // Check gearing
  if (expected.gearing) {
    if (expected.gearing.portfolioLVR !== undefined) {
      const diff = Math.abs(actual.calculatedOutputs.gearing.portfolioLVR - expected.gearing.portfolioLVR);
      if (diff > tolerance) {
        failures.push({
          field: 'gearing.portfolioLVR',
          expected: expected.gearing.portfolioLVR,
          actual: actual.calculatedOutputs.gearing.portfolioLVR,
          difference: diff,
        });
      }
    }
  }

  // Check cashflow
  if (expected.cashflow) {
    if (expected.cashflow.monthlyNetCashflow !== undefined) {
      const diff = Math.abs(
        actual.calculatedOutputs.cashflow.monthlyNetCashflow - expected.cashflow.monthlyNetCashflow
      );
      const base = Math.abs(expected.cashflow.monthlyNetCashflow) || 1;
      if (diff / base > tolerance) {
        failures.push({
          field: 'cashflow.monthlyNetCashflow',
          expected: expected.cashflow.monthlyNetCashflow,
          actual: actual.calculatedOutputs.cashflow.monthlyNetCashflow,
          difference: diff,
        });
      }
    }
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}
