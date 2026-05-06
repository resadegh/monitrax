/**
 * Phase 41i.3 — Calculation Audit Finding service.
 *
 * Persists drift/error events from `runDifferential()` into the
 * `calc_audit_findings` table for admin triage. Provides lifecycle
 * transitions per HR-3 — admin-side workflow that never surfaces
 * to end users.
 *
 * **Dedup semantics**: when `recordDifferentialFindings()` runs, it
 * does NOT create a new finding for an `(engineName, fixtureName)`
 * pair that already has an OPEN or INVESTIGATING finding. Instead,
 * the existing finding's `detectedAt` + `summary` are refreshed so
 * the admin sees the latest occurrence. This prevents queue spam
 * when a single bug causes the same fixture to fail every CI run.
 *
 * **Resolution lifecycle:**
 *   OPEN → INVESTIGATING → (FALSE_POSITIVE | FIX_REQUIRED → FIXED)
 *
 * Reviewers MUST reject any addition that exposes findings to
 * end-user surfaces (HR-3).
 */

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import type {
  CalcAuditFinding,
  CalcAuditFindingResolution,
  CalcAuditFindingSeverity,
  CalcAuditFindingSource,
} from '@prisma/client';
import type { DifferentialReport, FixtureRunResult } from './types';
import { recordAlert } from './alertingService';

// ---------- Recording ----------

interface RecordDifferentialFindingsOptions {
  /** Override severity for FAIL outcomes. Defaults to MEDIUM. */
  failSeverity?: CalcAuditFindingSeverity;
  /** Override severity for ERROR outcomes. Defaults to HIGH. */
  errorSeverity?: CalcAuditFindingSeverity;
}

/**
 * Persist FAIL + ERROR results from a differential report. Skips
 * PASS results (they're not findings). Dedupes against existing
 * OPEN/INVESTIGATING findings for the same (engineName, fixtureName).
 *
 * Returns `{ created, refreshed }` counts so the caller can
 * surface a meaningful confirmation.
 */
export async function recordDifferentialFindings(
  report: DifferentialReport,
  options: RecordDifferentialFindingsOptions = {},
): Promise<{ created: number; refreshed: number }> {
  const failSeverity = options.failSeverity ?? 'MEDIUM';
  const errorSeverity = options.errorSeverity ?? 'HIGH';

  let created = 0;
  let refreshed = 0;

  for (const result of report.results) {
    if (result.status === 'PASS') continue;

    const summary = buildSummary(result);
    const severity = result.status === 'ERROR' ? errorSeverity : failSeverity;

    // Find an existing OPEN/INVESTIGATING finding for this engine + fixture.
    const existing = await prisma.calcAuditFinding.findFirst({
      where: {
        source: 'L1_DIFFERENTIAL',
        engineName: result.engineName,
        fixtureName: result.fixtureName,
        resolution: { in: ['OPEN', 'INVESTIGATING'] },
      },
    });

    if (existing) {
      await prisma.calcAuditFinding.update({
        where: { id: existing.id },
        data: {
          detectedAt: new Date(),
          summary,
          severity,
          failedAssertions: result.failedAssertions
            ? (result.failedAssertions as unknown as Prisma.InputJsonValue)
            : Prisma.DbNull,
          errorMessage: result.errorMessage ?? null,
        },
      });
      refreshed++;
      // Refreshed findings do NOT re-fire alerts — admin already
      // knew about this. Re-firing on every CI run would spam.
    } else {
      const created_finding = await prisma.calcAuditFinding.create({
        data: {
          source: 'L1_DIFFERENTIAL',
          engineName: result.engineName,
          fixtureName: result.fixtureName,
          severity,
          resolution: 'OPEN',
          summary,
          failedAssertions: result.failedAssertions
            ? (result.failedAssertions as unknown as Prisma.InputJsonValue)
            : undefined,
          errorMessage: result.errorMessage,
        },
      });
      created++;
      // Phase 41i.4 — fire-and-forget alert on creation. Severity
      // threshold is enforced inside recordAlert; we don't gate
      // here so the threshold env var is the single tuning knob.
      void recordAlert({ trigger: 'CREATED', finding: created_finding }).catch(
        () => {
          /* alert delivery failures must not block the audit pipeline */
        },
      );
    }
  }

  return { created, refreshed };
}

// ---------- Listing ----------

export interface ListFindingsFilter {
  /** Filter by resolution states (defaults to OPEN + INVESTIGATING). */
  resolutions?: CalcAuditFindingResolution[];
  /** Filter by source. */
  source?: CalcAuditFindingSource;
  /** Filter by engine name. */
  engineName?: string;
  /** Pagination — limit defaults to 100. */
  limit?: number;
  /** Pagination — offset defaults to 0. */
  offset?: number;
}

export async function listFindings(
  filter: ListFindingsFilter = {},
): Promise<{ findings: CalcAuditFinding[]; total: number }> {
  const where: Prisma.CalcAuditFindingWhereInput = {};
  if (filter.resolutions && filter.resolutions.length > 0) {
    where.resolution = { in: filter.resolutions };
  } else {
    where.resolution = { in: ['OPEN', 'INVESTIGATING'] };
  }
  if (filter.source) where.source = filter.source;
  if (filter.engineName) where.engineName = filter.engineName;

  const [findings, total] = await Promise.all([
    prisma.calcAuditFinding.findMany({
      where,
      orderBy: { detectedAt: 'desc' },
      take: filter.limit ?? 100,
      skip: filter.offset ?? 0,
    }),
    prisma.calcAuditFinding.count({ where }),
  ]);

  return { findings, total };
}

/**
 * Return aggregate counts grouped by resolution. Used by the admin
 * dashboard tile.
 */
export async function getFindingCountsByResolution(): Promise<
  Record<CalcAuditFindingResolution, number>
> {
  const grouped = await prisma.calcAuditFinding.groupBy({
    by: ['resolution'],
    _count: { _all: true },
  });
  const result: Record<CalcAuditFindingResolution, number> = {
    OPEN: 0,
    INVESTIGATING: 0,
    FALSE_POSITIVE: 0,
    FIX_REQUIRED: 0,
    FIXED: 0,
  };
  for (const row of grouped) {
    result[row.resolution] = row._count._all;
  }
  return result;
}

// ---------- Lifecycle transitions ----------

const ALLOWED_TRANSITIONS: Record<CalcAuditFindingResolution, CalcAuditFindingResolution[]> = {
  OPEN: ['INVESTIGATING', 'FALSE_POSITIVE', 'FIX_REQUIRED'],
  INVESTIGATING: ['FALSE_POSITIVE', 'FIX_REQUIRED', 'OPEN'],
  FIX_REQUIRED: ['FIXED', 'INVESTIGATING'],
  FALSE_POSITIVE: ['INVESTIGATING'], // can re-open if mistakenly dismissed
  FIXED: ['INVESTIGATING'], // can re-open if regression
};

export class FindingTransitionError extends Error {
  constructor(
    message: string,
    public code: 'NOT_FOUND' | 'INVALID_TRANSITION',
  ) {
    super(message);
    this.name = 'FindingTransitionError';
  }
}

interface UpdateFindingResolutionInput {
  findingId: string;
  toResolution: CalcAuditFindingResolution;
  resolvedBy: string;
  adminNotes?: string;
}

export async function updateFindingResolution(
  input: UpdateFindingResolutionInput,
): Promise<CalcAuditFinding> {
  const existing = await prisma.calcAuditFinding.findUnique({
    where: { id: input.findingId },
  });
  if (!existing) {
    throw new FindingTransitionError(
      `Finding ${input.findingId} not found`,
      'NOT_FOUND',
    );
  }

  const allowed = ALLOWED_TRANSITIONS[existing.resolution] ?? [];
  if (!allowed.includes(input.toResolution)) {
    throw new FindingTransitionError(
      `Invalid transition: ${existing.resolution} → ${input.toResolution}. Allowed: ${allowed.join(', ')}`,
      'INVALID_TRANSITION',
    );
  }

  const isTerminal =
    input.toResolution === 'FALSE_POSITIVE' ||
    input.toResolution === 'FIXED';

  const updated = await prisma.calcAuditFinding.update({
    where: { id: input.findingId },
    data: {
      resolution: input.toResolution,
      adminNotes: input.adminNotes ?? existing.adminNotes,
      resolvedAt: isTerminal ? new Date() : existing.resolvedAt,
      resolvedBy: isTerminal ? input.resolvedBy : existing.resolvedBy,
    },
  });

  // Phase 41i.4 — escalation alert when a finding is moved to
  // FIX_REQUIRED. Fire-and-forget. No alert on FIXED / FALSE_POSITIVE
  // (admin chose to close — no need to re-notify).
  if (input.toResolution === 'FIX_REQUIRED') {
    void recordAlert({
      trigger: 'ESCALATED_TO_FIX_REQUIRED',
      finding: updated,
    }).catch(() => {
      /* fire-and-forget */
    });
  }

  return updated;
}

// ---------- Helpers ----------

function buildSummary(result: FixtureRunResult): string {
  const head = `${result.engineName}::${result.fixtureName} [${result.status}]`;
  if (result.status === 'ERROR') {
    return `${head} engine threw: ${result.errorMessage ?? 'unknown error'}`;
  }
  if (result.failedAssertions && result.failedAssertions.length > 0) {
    return `${head} failed assertions: ${result.failedAssertions.join('; ')}`;
  }
  return head;
}

export { ALLOWED_TRANSITIONS };
