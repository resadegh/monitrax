/**
 * Phase 41i.5 — L2 anomaly detection.
 *
 * Periodic scan over the existing `CalcAuditFinding` history that
 * surfaces **temporal patterns** humans miss when looking at the
 * point-in-time dashboard:
 *
 *   1. **High-frequency engines** — an engine producing more than
 *      N findings in the last `lookbackDays` window. Suggests the
 *      engine is structurally unstable and needs deeper review,
 *      not just per-finding triage.
 *   2. **Regression after stable period** — an engine that had
 *      zero findings for `stablePeriodDays` then suddenly started
 *      producing them. Suggests a recent code change broke a
 *      previously-stable surface.
 *
 * Both patterns are surfaced as new `L2_ANOMALY` findings (created
 * via the existing `findingService` so they flow through the same
 * lifecycle + alerting pipeline).
 *
 * **Invocation pattern:** designed for Cloud Scheduler — the
 * `POST /api/admin/calc-audit/anomaly-scan` endpoint accepts
 * either an admin session OR a Cloud Scheduler service account
 * with the right OIDC token. See
 * `docs/operational/calc-audit/cloud-scheduler-setup.md`.
 *
 * **HR-3 alignment:** anomalies surface in the existing admin
 * portal's findings queue. There is NO user-facing surface — same
 * as L1 + L3.
 *
 * **Why this works at zero scale:** the scan operates on existing
 * CalcAuditFinding history (which any environment has from the
 * moment L1 fires for the first time). It does NOT require
 * per-user calc output data — that's L3's domain. So 41i.5 ships
 * useful from day 1, not gated on production user volume.
 */

import 'server-only';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import type {
  CalcAuditFinding,
  CalcAuditFindingSeverity,
} from '@prisma/client';

// ---------- Defaults (tunable per-call) ----------

const DEFAULT_LOOKBACK_DAYS = 7;
const DEFAULT_HIGH_FREQUENCY_THRESHOLD = 5;
const DEFAULT_STABLE_PERIOD_DAYS = 30;
const DEFAULT_REGRESSION_GAP_DAYS = 14;

// ---------- Public types ----------

export interface AnomalyScanInput {
  /** How far back to look for findings. Default 7 days. */
  lookbackDays?: number;
  /** Engines with > this many findings in the lookback window flagged as high-frequency. */
  highFrequencyThreshold?: number;
  /**
   * For regression detection: how long an engine must be quiet
   * before a sudden new finding is considered a regression. Default 30 days.
   */
  stablePeriodDays?: number;
  /**
   * For regression detection: only fire when the gap between the
   * most-recent prior finding and the new one is at least this long.
   * Default 14 days.
   */
  regressionGapDays?: number;
}

export type AnomalyKind = 'HIGH_FREQUENCY' | 'REGRESSION_AFTER_STABLE_PERIOD';

export interface DetectedAnomaly {
  kind: AnomalyKind;
  engineName: string;
  /** When the pattern was detected (always now()). */
  detectedAt: Date;
  /** Plain-English summary for the admin queue. */
  summary: string;
  /** Severity assigned by the detector — calibrated per pattern. */
  severity: CalcAuditFindingSeverity;
  /** Structured detail for the admin (findings count, dates, etc). */
  evidence: Record<string, unknown>;
}

export interface AnomalyScanReport {
  scanId: string;
  startedAt: Date;
  completedAt: Date;
  lookbackDays: number;
  /** Total findings considered in the scan. */
  findingsScanned: number;
  /** Anomalies detected in this scan. */
  anomalies: DetectedAnomaly[];
  /** New L2_ANOMALY records created (excludes dedupes). */
  recordsCreated: number;
}

// ---------- Implementation ----------

/**
 * Run an anomaly scan. Pure read operations on the findings table
 * + writes for new L2_ANOMALY records when patterns are detected.
 *
 * **Dedup**: a HIGH_FREQUENCY anomaly for the same engine within
 * the same lookback window is NOT recorded twice. The scan looks
 * for an existing OPEN/INVESTIGATING L2_ANOMALY finding for
 * `(engineName, kind)` and refreshes its detection time + summary
 * instead of creating a duplicate.
 */
export async function scanForAnomalies(
  input: AnomalyScanInput = {},
): Promise<AnomalyScanReport> {
  const lookbackDays = input.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const highFreqThreshold =
    input.highFrequencyThreshold ?? DEFAULT_HIGH_FREQUENCY_THRESHOLD;
  const stableDays = input.stablePeriodDays ?? DEFAULT_STABLE_PERIOD_DAYS;
  const regressionGap = input.regressionGapDays ?? DEFAULT_REGRESSION_GAP_DAYS;

  const startedAt = new Date();
  const scanId = `scan_${startedAt.toISOString()}_${Math.random().toString(36).slice(2, 8)}`;
  const lookbackStart = new Date(
    startedAt.getTime() - lookbackDays * 24 * 60 * 60 * 1000,
  );

  // 1. Pull the lookback-window findings (excluding L2_ANOMALY itself
  //    so the scan doesn't recurse on its own output).
  const recent = await prisma.calcAuditFinding.findMany({
    where: {
      detectedAt: { gte: lookbackStart },
      source: { in: ['L1_DIFFERENTIAL', 'L3_ON_DEMAND'] },
    },
    orderBy: { detectedAt: 'desc' },
  });

  const anomalies: DetectedAnomaly[] = [];

  // 2. Pattern A — HIGH_FREQUENCY: count findings per engine.
  const findingsByEngine = new Map<string, CalcAuditFinding[]>();
  for (const f of recent) {
    const arr = findingsByEngine.get(f.engineName) ?? [];
    arr.push(f);
    findingsByEngine.set(f.engineName, arr);
  }

  for (const [engineName, findings] of findingsByEngine) {
    if (findings.length > highFreqThreshold) {
      anomalies.push({
        kind: 'HIGH_FREQUENCY',
        engineName,
        detectedAt: startedAt,
        summary: `${engineName} produced ${findings.length} findings in the last ${lookbackDays} days (threshold: ${highFreqThreshold}). Suggests structural instability rather than a one-off bug.`,
        severity: findings.length > highFreqThreshold * 2 ? 'HIGH' : 'MEDIUM',
        evidence: {
          findingCount: findings.length,
          lookbackDays,
          threshold: highFreqThreshold,
          firstDetected: findings[findings.length - 1]?.detectedAt.toISOString(),
          lastDetected: findings[0]?.detectedAt.toISOString(),
        },
      });
    }
  }

  // 3. Pattern B — REGRESSION_AFTER_STABLE_PERIOD: for each engine
  //    with findings in the lookback window, check whether it had
  //    a long quiet period before that.
  const stableStart = new Date(
    startedAt.getTime() - stableDays * 24 * 60 * 60 * 1000,
  );

  for (const [engineName, findings] of findingsByEngine) {
    // Earliest finding in the lookback window.
    const earliestRecent = findings[findings.length - 1];
    if (!earliestRecent) continue;

    // Find the most-recent finding BEFORE the lookback window.
    const priorFinding = await prisma.calcAuditFinding.findFirst({
      where: {
        engineName,
        detectedAt: { lt: lookbackStart },
        source: { in: ['L1_DIFFERENTIAL', 'L3_ON_DEMAND'] },
      },
      orderBy: { detectedAt: 'desc' },
    });

    const wasStable = !priorFinding || priorFinding.detectedAt < stableStart;
    const gapDays = priorFinding
      ? (earliestRecent.detectedAt.getTime() - priorFinding.detectedAt.getTime()) /
        (24 * 60 * 60 * 1000)
      : Infinity;

    if (wasStable && gapDays >= regressionGap) {
      anomalies.push({
        kind: 'REGRESSION_AFTER_STABLE_PERIOD',
        engineName,
        detectedAt: startedAt,
        summary: priorFinding
          ? `${engineName} had no findings for ${Math.round(gapDays)} days, then started producing findings on ${earliestRecent.detectedAt.toISOString().slice(0, 10)}. Suggests a recent code change broke a previously-stable surface.`
          : `${engineName} has its first-ever findings in the last ${lookbackDays} days. New regression or first-deploy behaviour.`,
        severity: 'HIGH',
        evidence: {
          firstNewFinding: earliestRecent.detectedAt.toISOString(),
          previousFinding: priorFinding?.detectedAt.toISOString() ?? null,
          gapDays: Number(gapDays.toFixed(1)),
        },
      });
    }
  }

  // 4. Persist anomalies as L2_ANOMALY findings. Dedup against
  //    existing OPEN/INVESTIGATING L2_ANOMALY records for the same
  //    (engineName, kind) — refresh instead of duplicate.
  let recordsCreated = 0;

  for (const anomaly of anomalies) {
    const fixtureName = anomaly.kind; // Stable composite key

    const existing = await prisma.calcAuditFinding.findFirst({
      where: {
        source: 'L2_ANOMALY',
        engineName: anomaly.engineName,
        fixtureName,
        resolution: { in: ['OPEN', 'INVESTIGATING'] },
      },
    });

    if (existing) {
      await prisma.calcAuditFinding.update({
        where: { id: existing.id },
        data: {
          detectedAt: anomaly.detectedAt,
          severity: anomaly.severity,
          summary: anomaly.summary,
          failedAssertions: serialiseEvidence(anomaly.evidence),
        },
      });
    } else {
      await prisma.calcAuditFinding.create({
        data: {
          source: 'L2_ANOMALY',
          engineName: anomaly.engineName,
          fixtureName,
          severity: anomaly.severity,
          resolution: 'OPEN',
          summary: anomaly.summary,
          failedAssertions: serialiseEvidence(anomaly.evidence),
        },
      });
      recordsCreated++;
    }
  }

  return {
    scanId,
    startedAt,
    completedAt: new Date(),
    lookbackDays,
    findingsScanned: recent.length,
    anomalies,
    recordsCreated,
  };
}

function serialiseEvidence(
  evidence: Record<string, unknown>,
): Prisma.InputJsonValue {
  // Keep the stored shape as a flat object — admin portal renders
  // these as a simple key/value list in the finding card.
  return JSON.parse(JSON.stringify(evidence)) as Prisma.InputJsonValue;
}

// Exported for tests.
export {
  DEFAULT_LOOKBACK_DAYS,
  DEFAULT_HIGH_FREQUENCY_THRESHOLD,
  DEFAULT_STABLE_PERIOD_DAYS,
  DEFAULT_REGRESSION_GAP_DAYS,
};

// ============================================================
// Pure-logic helpers (extracted for unit testing without Prisma)
// ============================================================

/**
 * Detect HIGH_FREQUENCY anomalies given an in-memory finding set.
 * Pure function — no DB. Used by both `scanForAnomalies` and the
 * test suite.
 */
export function detectHighFrequencyPatterns(
  findings: ReadonlyArray<Pick<CalcAuditFinding, 'engineName' | 'detectedAt'>>,
  options: {
    lookbackDays: number;
    threshold: number;
    detectedAt: Date;
  },
): DetectedAnomaly[] {
  const byEngine = new Map<string, typeof findings[number][]>();
  for (const f of findings) {
    const arr = byEngine.get(f.engineName) ?? [];
    arr.push(f);
    byEngine.set(f.engineName, arr);
  }

  const out: DetectedAnomaly[] = [];
  for (const [engineName, list] of byEngine) {
    if (list.length > options.threshold) {
      // Sort by detectedAt asc to get first/last.
      const sorted = [...list].sort(
        (a, b) => a.detectedAt.getTime() - b.detectedAt.getTime(),
      );
      out.push({
        kind: 'HIGH_FREQUENCY',
        engineName,
        detectedAt: options.detectedAt,
        summary: `${engineName} produced ${list.length} findings in the last ${options.lookbackDays} days (threshold: ${options.threshold}). Suggests structural instability rather than a one-off bug.`,
        severity: list.length > options.threshold * 2 ? 'HIGH' : 'MEDIUM',
        evidence: {
          findingCount: list.length,
          lookbackDays: options.lookbackDays,
          threshold: options.threshold,
          firstDetected: sorted[0]!.detectedAt.toISOString(),
          lastDetected: sorted[sorted.length - 1]!.detectedAt.toISOString(),
        },
      });
    }
  }
  return out;
}

/**
 * Detect REGRESSION_AFTER_STABLE_PERIOD given recent + prior
 * finding samples. Pure function — no DB.
 */
export function detectRegressionPattern(
  earliestRecent: { detectedAt: Date },
  priorFinding: { detectedAt: Date } | null,
  options: {
    engineName: string;
    lookbackDays: number;
    stablePeriodDays: number;
    regressionGapDays: number;
    detectedAt: Date;
  },
): DetectedAnomaly | null {
  const stableStart = new Date(
    options.detectedAt.getTime() - options.stablePeriodDays * 24 * 60 * 60 * 1000,
  );
  const lookbackStart = new Date(
    options.detectedAt.getTime() - options.lookbackDays * 24 * 60 * 60 * 1000,
  );

  // Prior finding must be older than the lookback window for this
  // helper's contract; the caller already filters to that.
  if (priorFinding && priorFinding.detectedAt >= lookbackStart) return null;

  const wasStable = !priorFinding || priorFinding.detectedAt < stableStart;
  const gapDays = priorFinding
    ? (earliestRecent.detectedAt.getTime() - priorFinding.detectedAt.getTime()) /
      (24 * 60 * 60 * 1000)
    : Infinity;

  if (!wasStable || gapDays < options.regressionGapDays) return null;

  return {
    kind: 'REGRESSION_AFTER_STABLE_PERIOD',
    engineName: options.engineName,
    detectedAt: options.detectedAt,
    summary: priorFinding
      ? `${options.engineName} had no findings for ${Math.round(gapDays)} days, then started producing findings on ${earliestRecent.detectedAt.toISOString().slice(0, 10)}. Suggests a recent code change broke a previously-stable surface.`
      : `${options.engineName} has its first-ever findings in the last ${options.lookbackDays} days. New regression or first-deploy behaviour.`,
    severity: 'HIGH',
    evidence: {
      firstNewFinding: earliestRecent.detectedAt.toISOString(),
      previousFinding: priorFinding?.detectedAt.toISOString() ?? null,
      gapDays: Number(gapDays.toFixed(1)),
    },
  };
}
