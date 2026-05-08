/**
 * Practice Alert Engine v1 — Production Readiness chunk 2.
 *
 * Replaces the `LIGHTHOUSE_ALERTS` demo fixture with real triggers
 * derived from per-client snapshot deltas. Closes Phase 32B PR3
 * item #9.
 *
 * **Trigger set (v1, all 5):**
 *   - `TRAIL_ADVANCED` — TRAIL stage progressed forward (milestone)
 *   - `HEALTH_DROP` — Health score fell >10 points in 30 days (critical)
 *   - `CASHFLOW_NEGATIVE` — Cashflow turned negative this period (critical)
 *   - `EMERGENCY_FUND_LOW` — Emergency fund fell below 1 month (critical)
 *   - `LVR_REFINANCE_WINDOW` — Average LVR crossed below 80% (opportunity)
 *
 * **Pipeline per client (called once daily by Cloud Scheduler):**
 *   1. Fetch current `MasterFinancialSnapshot` via canonical service
 *      (with viewerContext so service-layer scope filtering applies).
 *   2. Load most-recent prior `PracticeClientHealthSnapshot` (yesterday).
 *   3. Load ~30-day-old `PracticeClientHealthSnapshot` for HEALTH_DROP.
 *   4. Evaluate each of the 5 triggers — only fire on TRANSITIONS
 *      (e.g. cashflow flipped from positive to negative) so the
 *      adviser inbox doesn't spam every day for every still-low
 *      emergency fund.
 *   5. For each fired trigger: if no OPEN PracticeAlert exists for
 *      that (client, triggerKind), create one. Idempotent.
 *   6. Auto-close existing OPEN alerts whose underlying condition no
 *      longer holds.
 *   7. Persist today's snapshot for tomorrow's delta.
 *
 * **CDR safety (CLAUDE.md §13.3):**
 *   The `triggerSnapshot` JSON column carries aggregate numbers only
 *   (cashflow $X, health score N, LVR %) — never transaction text,
 *   account numbers, payee names, or BSBs. The service-layer scope
 *   filter (Phase 32B PR3) already runs inside
 *   `getMasterFinancialSnapshot()` for org-attached views, so the
 *   numbers we see here are already scope-filtered.
 *
 * **Why daily, not real-time:**
 *   - Snapshots churn intra-day from transaction syncs; daily cadence
 *     filters noise.
 *   - Cloud Scheduler is the simplest cron primitive with audit
 *     guarantees; webhooks add delivery-failure complexity that v1
 *     doesn't need.
 *   - Adviser inbox-fatigue is real (CLAUDE.md §0 behaviour-psychology
 *     lens) — one digest per day, not 17.
 *
 * See `docs/operational/runbooks/05_RETENTION_SCHEDULERS.md` (will be
 * extended in this PR with the alert-engine cron config).
 */

import { prisma } from '@/lib/db';
import { getMasterFinancialSnapshot, type MasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import { determineTrailStage, type TrailStage as ConsumerTrailStage } from '@/lib/cfo/trailStage';
import { log } from '@/lib/utils/logger';
import type { PracticeAlertTriggerKind, PracticeAlertSeverity } from '@prisma/client';

// =============================================================================
// CONSTANTS — fingerprint thresholds
// =============================================================================
// All thresholds in one place so a future tuning PR is single-touch.
// Per CLAUDE.md §6.4, engines MUST be pure — these constants are the
// contract.

const HEALTH_DROP_THRESHOLD = 10;     // Δ > this triggers (HEALTH_DROP)
const HEALTH_DROP_WINDOW_DAYS = 30;
const EMERGENCY_FUND_LOW_MONTHS = 1.0;
const LVR_REFINANCE_THRESHOLD = 0.80;

// =============================================================================
// TYPES
// =============================================================================

type PracticeTrailStage = 'TRACK' | 'REDUCE' | 'ANCHOR' | 'INVEST' | 'LIVE';

const STAGE_ORDER: PracticeTrailStage[] = ['TRACK', 'REDUCE', 'ANCHOR', 'INVEST', 'LIVE'];

const STAGE_FROM_CONSUMER: Record<ConsumerTrailStage, PracticeTrailStage> = {
  T: 'TRACK',
  R: 'REDUCE',
  A: 'ANCHOR',
  I: 'INVEST',
  L: 'LIVE',
};

interface SnapshotFingerprint {
  trailStage: PracticeTrailStage;
  healthScore: number;
  monthlyCashflow: number;
  monthlyIncome: number;
  emergencyFundMonths: number;
  averageLvr: number | null;
}

interface FiredAlertSpec {
  triggerKind: PracticeAlertTriggerKind;
  severity: PracticeAlertSeverity;
  headline: string;
  body: string;
  context: string;
  primaryActionLabel: string;
  triggerSnapshot: Record<string, unknown>;
}

export interface PerClientGenerationResult {
  organizationClientId: string;
  fingerprintCaptured: boolean;
  alertsCreated: number;
  alertsAutoClosed: number;
  triggersFired: PracticeAlertTriggerKind[];
}

export interface OrgGenerationResult {
  organizationId: string;
  clientsProcessed: number;
  clientsErrored: number;
  alertsCreated: number;
  alertsAutoClosed: number;
}

export interface AggregateGenerationResult {
  organizationsProcessed: number;
  clientsProcessed: number;
  alertsCreated: number;
  alertsAutoClosed: number;
  durationMs: number;
}

// =============================================================================
// CORE — fingerprint a snapshot
// =============================================================================

/**
 * Project a `MasterFinancialSnapshot` to the small set of fields the
 * alert engine uses. Pure — no DB calls, no side effects.
 */
export function fingerprintSnapshot(
  snapshot: MasterFinancialSnapshot,
): SnapshotFingerprint {
  const consumerStage = determineTrailStage({
    hasAccounts: snapshot.counts.accounts > 0,
    monthlyCashflow: snapshot.quickMetrics.monthlyCashflow,
    emergencyFundMonths: snapshot.emergencyFund.monthsCovered,
    hasInvestments: snapshot.counts.investments > 0,
    healthScore: snapshot.healthScore.score,
  });

  // Average LVR across owned properties — null when client has no
  // loans (LVR is undefined in that case; not a refinance target).
  const propertiesWithLvr = snapshot.properties.filter((p) => p.lvr > 0);
  const averageLvr = propertiesWithLvr.length === 0
    ? null
    : propertiesWithLvr.reduce((sum, p) => sum + p.lvr, 0) / propertiesWithLvr.length;

  return {
    trailStage: STAGE_FROM_CONSUMER[consumerStage],
    healthScore: snapshot.healthScore.score,
    monthlyCashflow: snapshot.quickMetrics.monthlyCashflow,
    monthlyIncome: snapshot.quickMetrics.monthlyIncome,
    emergencyFundMonths: snapshot.emergencyFund.monthsCovered,
    averageLvr,
  };
}

// =============================================================================
// TRIGGER EVALUATION
// =============================================================================

/**
 * Evaluate all 5 triggers against the current vs prior fingerprints.
 * Pure — no DB, no side effects. Returns the alerts that SHOULD be
 * OPEN given the data; the persistence layer dedupes against existing.
 */
export function evaluateTriggers(
  current: SnapshotFingerprint,
  yesterday: SnapshotFingerprint | null,
  thirtyDaysAgo: SnapshotFingerprint | null,
): FiredAlertSpec[] {
  const fired: FiredAlertSpec[] = [];

  // ---- TRAIL_ADVANCED ----
  if (yesterday) {
    const prevIdx = STAGE_ORDER.indexOf(yesterday.trailStage);
    const currIdx = STAGE_ORDER.indexOf(current.trailStage);
    if (currIdx > prevIdx) {
      fired.push({
        triggerKind: 'TRAIL_ADVANCED',
        severity: 'MILESTONE',
        headline: `Advanced from ${yesterday.trailStage} to ${current.trailStage}`,
        body: `Client moved to TRAIL stage ${current.trailStage}. Worth a check-in to acknowledge the milestone and orient them to the next stage's focus.`,
        context: `Stage ${yesterday.trailStage} → ${current.trailStage}`,
        primaryActionLabel: 'Send acknowledgement',
        triggerSnapshot: {
          previousStage: yesterday.trailStage,
          currentStage: current.trailStage,
        },
      });
    }
  }

  // ---- HEALTH_DROP ----
  if (thirtyDaysAgo) {
    const delta = current.healthScore - thirtyDaysAgo.healthScore;
    if (delta < -HEALTH_DROP_THRESHOLD) {
      fired.push({
        triggerKind: 'HEALTH_DROP',
        severity: 'CRITICAL',
        headline: `Health score dropped ${Math.abs(delta)} points in 30 days`,
        body: `Health score fell from ${thirtyDaysAgo.healthScore} to ${current.healthScore}. Likely drivers worth investigating: cashflow change, debt growth, emergency fund erosion.`,
        context: `Health ${current.healthScore} ↓${Math.abs(delta)}`,
        primaryActionLabel: 'Review drivers',
        triggerSnapshot: {
          windowDays: HEALTH_DROP_WINDOW_DAYS,
          healthScore30dAgo: thirtyDaysAgo.healthScore,
          healthScoreNow: current.healthScore,
          delta,
        },
      });
    }
  }

  // ---- CASHFLOW_NEGATIVE ----
  // Fire only on TRANSITION from non-negative to negative — avoids
  // daily spam while a chronically-negative cashflow situation
  // persists. Adviser will see the OPEN alert until they acknowledge
  // or until cashflow flips back positive (auto-close).
  const cashflowJustTurnedNegative =
    current.monthlyCashflow < 0 &&
    (yesterday === null || yesterday.monthlyCashflow >= 0);
  if (cashflowJustTurnedNegative) {
    fired.push({
      triggerKind: 'CASHFLOW_NEGATIVE',
      severity: 'CRITICAL',
      headline: 'Cashflow turned negative',
      body: `Monthly cashflow flipped from ${formatAud(yesterday?.monthlyCashflow ?? 0)} to ${formatAud(current.monthlyCashflow)}. Worth reviewing recent expense growth and income changes.`,
      context: `Cashflow ${formatAud(current.monthlyCashflow)}/mo`,
      primaryActionLabel: 'Open spending review',
      triggerSnapshot: {
        previousMonthlyCashflow: yesterday?.monthlyCashflow ?? null,
        currentMonthlyCashflow: current.monthlyCashflow,
      },
    });
  }

  // ---- EMERGENCY_FUND_LOW ----
  // Fire only on TRANSITION below 1 month. New clients with no prior
  // snapshot AND already-low fund don't fire on day 1 — adviser
  // already knows from onboarding. Subsequent drift below threshold
  // does fire.
  const emergencyJustDroppedLow =
    current.emergencyFundMonths < EMERGENCY_FUND_LOW_MONTHS &&
    yesterday !== null &&
    yesterday.emergencyFundMonths >= EMERGENCY_FUND_LOW_MONTHS;
  if (emergencyJustDroppedLow) {
    fired.push({
      triggerKind: 'EMERGENCY_FUND_LOW',
      severity: 'CRITICAL',
      headline: 'Emergency fund dropped below 1 month',
      body: `Emergency fund coverage fell from ${yesterday!.emergencyFundMonths.toFixed(1)} months to ${current.emergencyFundMonths.toFixed(1)} months. Anchor stage at risk.`,
      context: `Emergency ${current.emergencyFundMonths.toFixed(1)}mo`,
      primaryActionLabel: 'Open Anchor plan',
      triggerSnapshot: {
        previousMonths: yesterday!.emergencyFundMonths,
        currentMonths: current.emergencyFundMonths,
      },
    });
  }

  // ---- LVR_REFINANCE_WINDOW ----
  // Fire on transition: LVR was >= 80% (refi locked out / penalty
  // territory) and is now < 80% (refi window opens — better rates
  // available). Only relevant for clients with loans.
  const lvrJustEnteredRefiWindow =
    current.averageLvr !== null &&
    current.averageLvr < LVR_REFINANCE_THRESHOLD &&
    yesterday !== null &&
    yesterday.averageLvr !== null &&
    yesterday.averageLvr >= LVR_REFINANCE_THRESHOLD;
  if (lvrJustEnteredRefiWindow) {
    const lvrPct = (current.averageLvr! * 100).toFixed(1);
    fired.push({
      triggerKind: 'LVR_REFINANCE_WINDOW',
      severity: 'OPPORTUNITY',
      headline: 'LVR crossed below 80% — refinance opportunity',
      body: `Average LVR is now ${lvrPct}%. Below 80% unlocks better lender pricing tiers (no LMI penalty band, broader product set).`,
      context: `LVR ${lvrPct}%`,
      primaryActionLabel: 'Open refinance comparison',
      triggerSnapshot: {
        previousLvr: yesterday!.averageLvr,
        currentLvr: current.averageLvr,
      },
    });
  }

  return fired;
}

/**
 * Inverse of `evaluateTriggers` — returns the trigger kinds whose
 * underlying condition is no longer true given the current
 * fingerprint. The persistence layer uses this to auto-close stale
 * OPEN alerts.
 */
export function evaluateAutoCloseConditions(
  current: SnapshotFingerprint,
  thirtyDaysAgo: SnapshotFingerprint | null,
): PracticeAlertTriggerKind[] {
  const closeable: PracticeAlertTriggerKind[] = [];

  // CASHFLOW_NEGATIVE auto-closes when cashflow returns to non-negative.
  if (current.monthlyCashflow >= 0) {
    closeable.push('CASHFLOW_NEGATIVE');
  }

  // EMERGENCY_FUND_LOW auto-closes when fund recovers above 1 month.
  if (current.emergencyFundMonths >= EMERGENCY_FUND_LOW_MONTHS) {
    closeable.push('EMERGENCY_FUND_LOW');
  }

  // LVR_REFINANCE_WINDOW auto-closes when LVR climbs back above 80%
  // (window closes — refi no longer advantageous).
  if (current.averageLvr !== null && current.averageLvr >= LVR_REFINANCE_THRESHOLD) {
    closeable.push('LVR_REFINANCE_WINDOW');
  }

  // HEALTH_DROP auto-closes when 30-day health drop is no longer
  // exceeding the threshold (recovery).
  if (thirtyDaysAgo) {
    const delta = current.healthScore - thirtyDaysAgo.healthScore;
    if (delta >= -HEALTH_DROP_THRESHOLD) {
      closeable.push('HEALTH_DROP');
    }
  }

  // TRAIL_ADVANCED is a milestone — it doesn't "stop being true." Adviser
  // acknowledges manually. Never auto-closed.

  return closeable;
}

// =============================================================================
// PERSISTENCE — generate alerts for one client
// =============================================================================

interface ClientGenerationContext {
  organizationId: string;
  organizationClientId: string;
  clientUserId: string;
  /** OrganizationMember.id of the assigned adviser, when set. */
  seatId: string;
  /** Granted access scopes — passed verbatim into viewerContext. */
  accessScopes: import('@prisma/client').DataAccessScope[];
}

/**
 * Generate alerts for ONE client. Used by the cron + the admin trigger.
 * Idempotent: re-running with the same DB state and no fingerprint
 * change produces zero new alerts.
 */
export async function generateAlertsForClient(
  ctx: ClientGenerationContext,
): Promise<PerClientGenerationResult> {
  // 1. Pull current snapshot via the canonical service. viewerContext
  //    triggers the service-layer scope filter — we only see what the
  //    consent grants. (The OrganizationClient lookup happens inside
  //    the service via `seatId + clientUserId`; we don't pass the
  //    OC.id directly per the ViewerContext type contract.)
  const currentSnapshot = await getMasterFinancialSnapshot(ctx.clientUserId, {
    seatId: ctx.seatId,
    clientUserId: ctx.clientUserId,
    accessScopes: ctx.accessScopes,
  });

  const currentFingerprint = fingerprintSnapshot(currentSnapshot);

  // 2. Most-recent prior snapshot (yesterday for transition triggers).
  const yesterdaySnapshot = await prisma.practiceClientHealthSnapshot.findFirst({
    where: { organizationClientId: ctx.organizationClientId },
    orderBy: { capturedAt: 'desc' },
  });

  const yesterdayFingerprint: SnapshotFingerprint | null = yesterdaySnapshot
    ? {
        trailStage: yesterdaySnapshot.trailStage as PracticeTrailStage,
        healthScore: yesterdaySnapshot.healthScore,
        monthlyCashflow: yesterdaySnapshot.monthlyCashflow,
        monthlyIncome: yesterdaySnapshot.monthlyIncome,
        emergencyFundMonths: yesterdaySnapshot.emergencyFundMonths,
        averageLvr: yesterdaySnapshot.averageLvr,
      }
    : null;

  // 3. ~30-day-old snapshot (for HEALTH_DROP). We pull the snapshot
  //    captured *closest to* 30 days ago — `desc` from a 35-day cutoff
  //    gives "the most recent snapshot still within the comparison
  //    window." Falls back to null when the client is younger than
  //    30 days in the system (HEALTH_DROP simply doesn't fire then).
  const thirtyDaysAgoCutoff = new Date();
  thirtyDaysAgoCutoff.setDate(thirtyDaysAgoCutoff.getDate() - HEALTH_DROP_WINDOW_DAYS);

  const thirtyDaysAgoSnapshot = await prisma.practiceClientHealthSnapshot.findFirst({
    where: {
      organizationClientId: ctx.organizationClientId,
      capturedAt: { lte: thirtyDaysAgoCutoff },
    },
    orderBy: { capturedAt: 'desc' },
  });

  const thirtyDaysAgoFingerprint: SnapshotFingerprint | null = thirtyDaysAgoSnapshot
    ? {
        trailStage: thirtyDaysAgoSnapshot.trailStage as PracticeTrailStage,
        healthScore: thirtyDaysAgoSnapshot.healthScore,
        monthlyCashflow: thirtyDaysAgoSnapshot.monthlyCashflow,
        monthlyIncome: thirtyDaysAgoSnapshot.monthlyIncome,
        emergencyFundMonths: thirtyDaysAgoSnapshot.emergencyFundMonths,
        averageLvr: thirtyDaysAgoSnapshot.averageLvr,
      }
    : null;

  // 4. Evaluate triggers + auto-close conditions.
  const fired = evaluateTriggers(currentFingerprint, yesterdayFingerprint, thirtyDaysAgoFingerprint);
  const closeable = evaluateAutoCloseConditions(currentFingerprint, thirtyDaysAgoFingerprint);

  // 5. Persist — within a single transaction so a partial failure
  //    leaves a coherent state (no half-created alerts + no captured
  //    fingerprint without alerts).
  const result = await prisma.$transaction(async (tx) => {
    let alertsCreated = 0;
    let alertsAutoClosed = 0;
    const triggersFired: PracticeAlertTriggerKind[] = [];

    // 5a. Auto-close stale OPEN alerts whose condition no longer holds.
    if (closeable.length > 0) {
      const closedResult = await tx.practiceAlert.updateMany({
        where: {
          organizationClientId: ctx.organizationClientId,
          status: 'OPEN',
          triggerKind: { in: closeable },
        },
        data: {
          status: 'AUTO_CLOSED',
          resolvedAt: new Date(),
          resolvedReason: 'condition_no_longer_holds',
        },
      });
      alertsAutoClosed = closedResult.count;
    }

    // 5b. Idempotent create — only fire if no OPEN alert with the same
    //     (client, triggerKind) already exists. Prevents the daily cron
    //     from creating a duplicate of an alert the adviser hasn't
    //     acknowledged yet.
    for (const spec of fired) {
      const existing = await tx.practiceAlert.findFirst({
        where: {
          organizationClientId: ctx.organizationClientId,
          triggerKind: spec.triggerKind,
          status: 'OPEN',
        },
        select: { id: true },
      });
      if (existing) continue;

      await tx.practiceAlert.create({
        data: {
          organizationId: ctx.organizationId,
          organizationClientId: ctx.organizationClientId,
          triggerKind: spec.triggerKind,
          severity: spec.severity,
          status: 'OPEN',
          headline: spec.headline,
          body: spec.body,
          context: spec.context,
          primaryActionLabel: spec.primaryActionLabel,
          triggerSnapshot: spec.triggerSnapshot as never, // Json
        },
      });
      alertsCreated += 1;
      triggersFired.push(spec.triggerKind);
    }

    // 5c. Persist today's fingerprint for tomorrow's delta. Always
    //     write even when nothing fired — the chain is the source of
    //     truth for HEALTH_DROP's 30-day comparison.
    await tx.practiceClientHealthSnapshot.create({
      data: {
        organizationClientId: ctx.organizationClientId,
        trailStage: currentFingerprint.trailStage,
        healthScore: currentFingerprint.healthScore,
        monthlyCashflow: currentFingerprint.monthlyCashflow,
        monthlyIncome: currentFingerprint.monthlyIncome,
        emergencyFundMonths: currentFingerprint.emergencyFundMonths,
        averageLvr: currentFingerprint.averageLvr,
      },
    });

    return { alertsCreated, alertsAutoClosed, triggersFired };
  });

  return {
    organizationClientId: ctx.organizationClientId,
    fingerprintCaptured: true,
    alertsCreated: result.alertsCreated,
    alertsAutoClosed: result.alertsAutoClosed,
    triggersFired: result.triggersFired,
  };
}

// =============================================================================
// BATCH — generate for an entire organisation
// =============================================================================

/**
 * Run the engine across every active OrganizationClient owned by an
 * org. Used by the daily cron + admin "regenerate now" trigger.
 *
 * Errors per client are logged + counted — they don't halt the batch.
 * Adviser inbox staying live is more important than every client
 * succeeding on every run.
 */
export async function generateAlertsForOrganization(
  organizationId: string,
): Promise<OrgGenerationResult> {
  const activeClients = await prisma.organizationClient.findMany({
    where: {
      organizationId,
      status: 'ACTIVE',
      consentStatus: 'GRANTED',
    },
    select: {
      id: true,
      userId: true,
      assignedToMemberId: true,
      accessScopes: true,
      organizationId: true,
    },
  });

  let alertsCreated = 0;
  let alertsAutoClosed = 0;
  let clientsProcessed = 0;
  let clientsErrored = 0;

  for (const client of activeClients) {
    // Need a seatId for the viewer context. If no specific assigned
    // member, use a sentinel value — the viewerContext check is
    // (organizationClientId+accessScopes), seatId is for the
    // ClientAccessLog row but the engine doesn't write one.
    const seatId = client.assignedToMemberId ?? `system-engine-${organizationId}`;

    try {
      const r = await generateAlertsForClient({
        organizationId,
        organizationClientId: client.id,
        clientUserId: client.userId,
        seatId,
        accessScopes: client.accessScopes,
      });
      alertsCreated += r.alertsCreated;
      alertsAutoClosed += r.alertsAutoClosed;
      clientsProcessed += 1;
    } catch (err) {
      clientsErrored += 1;
      log.error('[practice-alert-engine] per-client failure', err as Error, {
        organizationId,
        organizationClientId: client.id,
      });
    }
  }

  return {
    organizationId,
    clientsProcessed,
    clientsErrored,
    alertsCreated,
    alertsAutoClosed,
  };
}

/**
 * Top-level cron entry — runs the engine across every org with at
 * least one active client.
 */
export async function generateAlertsForAllOrganizations(): Promise<AggregateGenerationResult> {
  const start = Date.now();
  log.info('[practice-alert-engine] cron started');

  // Find orgs that have at least one ACTIVE+GRANTED client. Skip orgs
  // with zero active clients — no work to do.
  // Note: `OrganizationClient` has no Prisma `@relation` to
  // `Organization` (only the FK column), so we query OrganizationClient
  // directly and distinct-on `organizationId`.
  const activeClientRows = await prisma.organizationClient.findMany({
    where: {
      status: 'ACTIVE',
      consentStatus: 'GRANTED',
    },
    select: { organizationId: true },
    distinct: ['organizationId'],
  });
  const activeOrgs = activeClientRows.map((r) => ({ id: r.organizationId }));

  let organizationsProcessed = 0;
  let clientsProcessed = 0;
  let alertsCreated = 0;
  let alertsAutoClosed = 0;

  for (const org of activeOrgs) {
    const result = await generateAlertsForOrganization(org.id);
    organizationsProcessed += 1;
    clientsProcessed += result.clientsProcessed;
    alertsCreated += result.alertsCreated;
    alertsAutoClosed += result.alertsAutoClosed;
  }

  const aggregate: AggregateGenerationResult = {
    organizationsProcessed,
    clientsProcessed,
    alertsCreated,
    alertsAutoClosed,
    durationMs: Date.now() - start,
  };

  log.info('[practice-alert-engine] cron complete', aggregate as never);

  return aggregate;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatAud(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const absStr = Math.abs(Math.round(amount)).toLocaleString('en-AU');
  return `${sign}$${absStr}`;
}
