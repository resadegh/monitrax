/**
 * Phase 41i.3b — Per-user "Audit this user" harness.
 *
 * For a target user, iterate every registered `UserAuditAdapter`,
 * fetch the user's data, run the corresponding `CalcEngine.execute`,
 * and validate output. Persist `CalcAuditFinding` (source:
 * `L3_ON_DEMAND`) on any failure:
 *   - `fetchInput` throws → HIGH severity (data shape broken for user)
 *   - engine `execute` throws → HIGH (engine misbehaves with this data)
 *   - `validateOutput` returns `{ ok: false }` → adapter-specified
 *     severity (default HIGH)
 *
 * Idempotent dedup via `recordUserAuditFinding`: refresh existing
 * OPEN/INVESTIGATING rows scoped to `(source: L3_ON_DEMAND,
 * engineName, userId)` instead of duplicating.
 *
 * Per HR-3 (CLAUDE.md / Phase 41 §1 invariant 11) — admin-only.
 */

import 'server-only';
import type { CalcAuditFinding } from '@prisma/client';
import prisma from '@/lib/db';
import { calcEngineRegistry } from '@/lib/calc-audit/registry';
import { userAuditAdapterRegistry } from './registry';
import type { UserAuditOutcome, UserAuditReport } from './types';

/**
 * Run the per-user audit for `userId` across every registered adapter.
 * Returns one outcome per adapter + aggregate totals.
 */
export async function runUserAudit(userId: string): Promise<UserAuditReport> {
  const startedAt = new Date().toISOString();
  const adapters = userAuditAdapterRegistry.list();
  const outcomes: UserAuditOutcome[] = [];

  for (const adapter of adapters) {
    outcomes.push(await runSingleAdapter(adapter, userId));
  }

  const totals = {
    enginesScanned: outcomes.length,
    findingsCreated: outcomes.filter((o) => o.outcome === 'FINDING').length,
    findingsRefreshed: 0, // distinguishing create vs refresh requires extra tracking; v2.
    skipped: outcomes.filter((o) => o.outcome === 'SKIPPED').length,
    errors: outcomes.filter(
      (o) => o.outcome === 'FINDING' && (o.severity === 'HIGH' || o.severity === 'CRITICAL'),
    ).length,
  };

  return {
    userId,
    startedAt,
    completedAt: new Date().toISOString(),
    outcomes,
    totals,
  };
}

async function runSingleAdapter(
  adapter: ReturnType<typeof userAuditAdapterRegistry.list>[number],
  userId: string,
): Promise<UserAuditOutcome> {
  const engine = calcEngineRegistry.get(adapter.engineName);
  if (!engine) {
    // Adapter exists but matching engine isn't registered — should
    // never happen in practice (bootstrap order ensures both are
    // loaded), but defensive.
    return {
      engineName: adapter.engineName,
      userId,
      outcome: 'SKIPPED',
      skipReason: 'NO_ADAPTER',
    };
  }

  // 1. Fetch input — adapter-specific Prisma query.
  let input: unknown;
  try {
    input = await adapter.fetchInput(userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const finding = await recordUserAuditFinding({
      engineName: adapter.engineName,
      userId,
      severity: 'HIGH',
      summary: `User-audit adapter ${adapter.engineName}: fetchInput threw — ${message.slice(0, 200)}`,
      errorMessage: message.slice(0, 500),
    });
    return {
      engineName: adapter.engineName,
      userId,
      outcome: 'FINDING',
      findingId: finding.id,
      severity: 'HIGH',
      summary: finding.summary,
      errorMessage: message,
    };
  }

  if (input === null) {
    // Adapter says "no data for this user" — skip (not a failure).
    return {
      engineName: adapter.engineName,
      userId,
      outcome: 'SKIPPED',
      skipReason: 'NO_DATA',
    };
  }

  // 2. Run engine.
  let output: unknown;
  try {
    output = await engine.execute(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const finding = await recordUserAuditFinding({
      engineName: adapter.engineName,
      userId,
      severity: 'HIGH',
      summary: `Engine ${adapter.engineName}: execute() threw for user — ${message.slice(0, 200)}`,
      errorMessage: message.slice(0, 500),
    });
    return {
      engineName: adapter.engineName,
      userId,
      outcome: 'FINDING',
      findingId: finding.id,
      severity: 'HIGH',
      summary: finding.summary,
      errorMessage: message,
    };
  }

  // 3. Validate sanity invariants (if adapter provides validateOutput).
  if (adapter.validateOutput) {
    const result = adapter.validateOutput(output);
    if (!result.ok) {
      const severity = result.severity ?? 'HIGH';
      const finding = await recordUserAuditFinding({
        engineName: adapter.engineName,
        userId,
        severity,
        summary: `${adapter.engineName} sanity invariant violated: ${result.reason}`,
        failedAssertions: [
          {
            path: adapter.engineName,
            expected: 'sanity invariant satisfied',
            actual: result.reason,
          },
        ],
      });
      return {
        engineName: adapter.engineName,
        userId,
        outcome: 'FINDING',
        findingId: finding.id,
        severity,
        summary: finding.summary,
      };
    }
  }

  return {
    engineName: adapter.engineName,
    userId,
    outcome: 'OK',
  };
}

// =============================================================================
// Idempotent persist
// =============================================================================

interface RecordUserAuditFindingInput {
  engineName: string;
  userId: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  summary: string;
  failedAssertions?: Array<{ path: string; expected: unknown; actual: unknown }>;
  errorMessage?: string;
}

/**
 * Persists or refreshes a CalcAuditFinding. Dedup pattern matches
 * 41i.3 (`recordDifferentialFindings`) + 41i.6c (`recordSurfaceFinding`)
 * — refresh existing OPEN/INVESTIGATING rows; create new otherwise.
 * Terminal states (FALSE_POSITIVE / FIX_REQUIRED / FIXED) excluded:
 * closed findings cannot be resurrected; new findings are created
 * instead.
 */
export async function recordUserAuditFinding(
  input: RecordUserAuditFindingInput,
): Promise<CalcAuditFinding> {
  const existing = await prisma.calcAuditFinding.findFirst({
    where: {
      source: 'L3_ON_DEMAND',
      engineName: input.engineName,
      userId: input.userId,
      resolution: { in: ['OPEN', 'INVESTIGATING'] },
    },
    select: { id: true },
  });

  const data = {
    source: 'L3_ON_DEMAND' as const,
    engineName: input.engineName,
    userId: input.userId,
    severity: input.severity,
    summary: input.summary,
    failedAssertions:
      input.failedAssertions != null
        ? (input.failedAssertions as unknown as object)
        : undefined,
    errorMessage: input.errorMessage ?? null,
    detectedAt: new Date(),
  };

  if (existing) {
    return prisma.calcAuditFinding.update({
      where: { id: existing.id },
      data,
    });
  }
  return prisma.calcAuditFinding.create({
    data: {
      ...data,
      resolution: 'OPEN',
    },
  });
}
