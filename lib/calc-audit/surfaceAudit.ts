/**
 * Phase 41i.6c — Runtime surface-audit harness.
 *
 * Iterates the registered `SurfaceDescriptor`s for a target user,
 * invokes each canonical source, validates the projection produces
 * a sane value, and persists `CalcAuditFinding` rows (source =
 * `L4_SURFACE_AUDIT`) when:
 *
 *   - The canonical source THROWS for this user (HIGH severity —
 *     the source itself is broken; the rendered tile is wrong).
 *   - The canonical source returns `null` when the descriptor's
 *     `renderConditions` do NOT allow null (MEDIUM severity —
 *     unexpected absence).
 *   - A registered cross-validator (future, optional) returns a
 *     value that exceeds the descriptor's tolerance vs. the canonical
 *     value (HIGH severity — drift between independent derivations).
 *
 * v1 ships path A + B. Cross-validators (path C) are a typed extension
 * point; future PRs add cross-validators per descriptor as the audit
 * coverage matures.
 *
 * Per spec doc PHASE_41I_6_SURFACE_AUDIT.md §8 — the harness re-derives
 * from the canonical source; it does NOT scrape the DOM. The 41i.6b
 * static-analysis pass catches the COMPLEMENTARY bug class (components
 * that bypass the canonical source entirely).
 *
 * Per spec doc §10 — every L4 finding records the full canonical chain
 * (surfaceId / route / canonicalSource / canonicalValue / userId).
 *
 * Idempotent persist via `recordSurfaceFinding`: dedup on
 * `(source: L4_SURFACE_AUDIT, engineName: surfaceId, userId,
 * resolution: OPEN | INVESTIGATING)` — refreshes existing OPEN
 * findings instead of duplicating.
 */

import 'server-only';
import type { CalcAuditFindingSeverity, CalcAuditFinding } from '@prisma/client';
import prisma from '@/lib/db';
import {
  surfaceRegistry,
  exceedsTolerance,
  type SurfaceDescriptor,
} from '@/lib/calc-audit/surfaces';

// =============================================================================
// Types
// =============================================================================

export interface SurfaceAuditOutcome {
  surfaceId: string;
  userId: string;
  /** OK = no finding; FINDING = persisted a CalcAuditFinding row. */
  outcome: 'OK' | 'FINDING' | 'SKIPPED';
  /** When outcome = 'FINDING', the persisted row's id. */
  findingId?: string;
  /** Why we skipped (renderConditions match). */
  skipReason?: 'NULL' | 'ZERO';
  /** Canonical value successfully extracted (when outcome = 'OK' or 'FINDING'). */
  canonicalValue?: number | null;
  /** Severity of the persisted finding. */
  severity?: CalcAuditFindingSeverity;
  /** Summary text persisted on the finding. */
  summary?: string;
  /** Free-text error from canonical source if it threw. */
  errorMessage?: string;
}

export interface FullScanProgress {
  type: 'PROGRESS' | 'DONE' | 'ERROR';
  /** 1-indexed user position in the iteration. */
  userIndex?: number;
  /** Total users planned for the scan. */
  userTotal?: number;
  /** UserId being processed (PROGRESS) or last processed (DONE). */
  userId?: string;
  /** All outcomes for the user that just finished (PROGRESS). */
  outcomes?: SurfaceAuditOutcome[];
  /** Aggregate counts at completion (DONE). */
  totals?: {
    usersScanned: number;
    surfacesScanned: number;
    findingsCreated: number;
    findingsRefreshed: number;
    skipped: number;
    errors: number;
  };
  /** Free-text error message (ERROR). */
  message?: string;
}

// =============================================================================
// Single-user audit
// =============================================================================

/**
 * Run all registered surface audits for `userId` and persist findings.
 * Returns one outcome per descriptor.
 */
export async function runSurfaceAuditForUser(
  userId: string,
  options: { descriptors?: SurfaceDescriptor[] } = {},
): Promise<SurfaceAuditOutcome[]> {
  const descriptors = options.descriptors ?? surfaceRegistry.list();
  const outcomes: SurfaceAuditOutcome[] = [];

  for (const descriptor of descriptors) {
    outcomes.push(await runSingleSurface(descriptor, userId));
  }

  return outcomes;
}

async function runSingleSurface(
  descriptor: SurfaceDescriptor,
  userId: string,
): Promise<SurfaceAuditOutcome> {
  // 1. Invoke canonical source.
  let sourceResult: unknown;
  try {
    sourceResult = await descriptor.invokeCanonicalSource(userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const finding = await recordSurfaceFinding({
      surfaceId: descriptor.surfaceId,
      userId,
      severity: 'HIGH',
      summary: `Canonical source threw for ${descriptor.surfaceId}: ${descriptor.canonicalSource.service}:${descriptor.canonicalSource.method}`,
      failedAssertions: [
        {
          path: descriptor.canonicalSource.fieldPath,
          expected: 'a value',
          actual: `Error: ${message.slice(0, 300)}`,
        },
      ],
      errorMessage: message.slice(0, 500),
    });
    return {
      surfaceId: descriptor.surfaceId,
      userId,
      outcome: 'FINDING',
      findingId: finding.id,
      severity: 'HIGH',
      summary: finding.summary,
      errorMessage: message,
    };
  }

  // 2. Extract the rendered value.
  let canonicalValue: number | null;
  try {
    canonicalValue = descriptor.extractRenderedValue(sourceResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const finding = await recordSurfaceFinding({
      surfaceId: descriptor.surfaceId,
      userId,
      severity: 'HIGH',
      summary: `extractRenderedValue threw for ${descriptor.surfaceId}: ${descriptor.canonicalSource.fieldPath}`,
      failedAssertions: [
        {
          path: descriptor.canonicalSource.fieldPath,
          expected: 'a number or null',
          actual: `Error: ${message.slice(0, 300)}`,
        },
      ],
      errorMessage: message.slice(0, 500),
    });
    return {
      surfaceId: descriptor.surfaceId,
      userId,
      outcome: 'FINDING',
      findingId: finding.id,
      severity: 'HIGH',
      summary: finding.summary,
      errorMessage: message,
    };
  }

  // 3. Apply renderConditions — skip when null/zero matches.
  if (canonicalValue === null) {
    if (descriptor.renderConditions?.skipWhenNull) {
      return {
        surfaceId: descriptor.surfaceId,
        userId,
        outcome: 'SKIPPED',
        skipReason: 'NULL',
        canonicalValue: null,
      };
    }
    // Null when not allowed → MEDIUM finding.
    const finding = await recordSurfaceFinding({
      surfaceId: descriptor.surfaceId,
      userId,
      severity: 'MEDIUM',
      summary: `Canonical source returned null for ${descriptor.surfaceId} (${descriptor.canonicalSource.fieldPath}) — descriptor does not allow null`,
      failedAssertions: [
        {
          path: descriptor.canonicalSource.fieldPath,
          expected: 'a number',
          actual: 'null',
        },
      ],
    });
    return {
      surfaceId: descriptor.surfaceId,
      userId,
      outcome: 'FINDING',
      findingId: finding.id,
      severity: 'MEDIUM',
      summary: finding.summary,
      canonicalValue: null,
    };
  }

  if (canonicalValue === 0 && descriptor.renderConditions?.skipWhenZero) {
    return {
      surfaceId: descriptor.surfaceId,
      userId,
      outcome: 'SKIPPED',
      skipReason: 'ZERO',
      canonicalValue: 0,
    };
  }

  // 4. Cross-validator (future hook). For v1 — no descriptor has one,
  // and the canonical extraction succeeded with a sane value. Record
  // success path silently (no finding).
  // Future PRs add `descriptor.crossValidate(userId, sourceResult)` to
  // independently re-derive the value and call `exceedsTolerance` to
  // produce a HIGH-severity drift finding.

  return {
    surfaceId: descriptor.surfaceId,
    userId,
    outcome: 'OK',
    canonicalValue,
  };
}

// =============================================================================
// Full Scan (admin-triggered)
// =============================================================================

export interface RunFullScanOptions {
  /** Limit to N users (default: all). Useful for smoke-testing. */
  userLimit?: number;
  /** Optional descriptor filter (default: all 10 v1 descriptors). */
  descriptorIds?: string[];
}

/**
 * Async-generator full-scan. Yields progress events the caller streams
 * to the admin UI as NDJSON. Per spec doc §10 — admin sees a per-user
 * counter + ETA + cancel affordance (cancel ships in v2).
 */
export async function* runSurfaceAuditFullScan(
  options: RunFullScanOptions = {},
): AsyncGenerator<FullScanProgress> {
  const allDescriptors = surfaceRegistry.list();
  const descriptors =
    options.descriptorIds && options.descriptorIds.length > 0
      ? allDescriptors.filter((d) => options.descriptorIds!.includes(d.surfaceId))
      : allDescriptors;

  if (descriptors.length === 0) {
    yield {
      type: 'ERROR',
      message: 'No matching surface descriptors. Check descriptorIds filter.',
    };
    return;
  }

  // Iterate users — for v1 we scan every user. Production-scale will
  // add per-tenant batching + scheduled cron (deferred to PROD).
  const users = await prisma.user.findMany({
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    ...(options.userLimit ? { take: options.userLimit } : {}),
  });

  const totals = {
    usersScanned: 0,
    surfacesScanned: 0,
    findingsCreated: 0,
    findingsRefreshed: 0,
    skipped: 0,
    errors: 0,
  };

  for (let i = 0; i < users.length; i++) {
    const userId = users[i].id;
    const outcomes = await runSurfaceAuditForUser(userId, { descriptors });
    totals.usersScanned += 1;
    totals.surfacesScanned += outcomes.length;
    for (const o of outcomes) {
      if (o.outcome === 'FINDING') {
        if (o.severity === 'HIGH' || o.severity === 'CRITICAL') totals.errors += 1;
        else totals.findingsCreated += 1;
      } else if (o.outcome === 'SKIPPED') {
        totals.skipped += 1;
      }
    }

    yield {
      type: 'PROGRESS',
      userIndex: i + 1,
      userTotal: users.length,
      userId,
      outcomes,
    };
  }

  yield { type: 'DONE', totals };
}

// =============================================================================
// Persist (idempotent)
// =============================================================================

interface RecordSurfaceFindingInput {
  surfaceId: string;
  userId: string;
  severity: CalcAuditFindingSeverity;
  summary: string;
  failedAssertions?: Array<{ path: string; expected: unknown; actual: unknown }>;
  errorMessage?: string;
}

/**
 * Persists or refreshes a CalcAuditFinding. Dedup pattern matches
 * 41i.3 (`recordDifferentialFindings`) — refresh existing OPEN/
 * INVESTIGATING rows; create new otherwise. Engineering goal: a
 * scheduled re-run for a user with persistent issues should NOT
 * spam the queue.
 */
export async function recordSurfaceFinding(
  input: RecordSurfaceFindingInput,
): Promise<CalcAuditFinding> {
  const existing = await prisma.calcAuditFinding.findFirst({
    where: {
      source: 'L4_SURFACE_AUDIT',
      engineName: input.surfaceId,
      userId: input.userId,
      resolution: { in: ['OPEN', 'INVESTIGATING'] },
    },
    select: { id: true },
  });

  const data = {
    source: 'L4_SURFACE_AUDIT' as const,
    engineName: input.surfaceId,
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
