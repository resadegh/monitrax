/**
 * Portal Alert Sweep — shared runner (Phase 32B PR3 #9a + post-#9b polish).
 *
 * The cron endpoint (`POST /api/portal/alerts/sweep`) and the admin
 * "run sweep now" endpoint (`POST /api/admin/portal-alert-sweep`) both
 * call `runPortalAlertSweep()`. The two routes differ only in *auth*
 * (CRON_SECRET vs admin session) — the work itself lives here so there
 * is exactly one implementation (CLAUDE.md §12.2 SSOT).
 *
 * What a sweep does — for each `Organization` (optionally filtered to
 * one) → for each `OrganizationClient` with `status = ACTIVE` and
 * `consentStatus = GRANTED`:
 *   1. Compute the client's canonical financial snapshot
 *      (`getMasterFinancialSnapshot(clientUserId)` — full snapshot;
 *      scope filtering is applied at the *trigger* level, see step 3,
 *      so the org never sees an alert derived from data the client
 *      didn't share).
 *   2. Derive the current TRAIL stage + a small `AlertEngineSnapshot`
 *      projection.
 *   3. Run the pure engine (`computeAlerts`) with
 *      `enabledTriggers = professionTriggers ∩ scopeAllowedTriggers(client.accessScopes)`.
 *   4. Persist:
 *        - upsert ACTIVE `ClientAlert` rows for each computed alert
 *          (a DISMISSED row is left alone — sticky while the
 *          condition holds);
 *        - flip ACTIVE/DISMISSED rows whose condition has cleared to
 *          RESOLVED (re-arms: the next time the condition holds, a
 *          fresh ACTIVE row is created);
 *        - upsert the `ClientSnapshotMarker` — `lastHealthScore` /
 *          `lastTrailStage` are the baseline the delta triggers
 *          (HEALTH_DROP / TRAIL_ADVANCED) read next run; the values it
 *          had going in roll into `previousHealthScore` /
 *          `previousTrailStage` so the Practice hero KPI strip can show
 *          a "change since last sweep" delta without a history table.
 *
 * `dryRun` computes everything and writes nothing (admin preview).
 * `organizationId` limits the sweep to one org (testing / backfill).
 *
 * CLAUDE.md §13.4 (CRON_SECRET pattern, in the calling route) + §13.3
 * (alerts + the marker carry aggregates only — no raw CDR data).
 */

import prisma from '@/lib/db';
import { getMasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import { getPracticeProfessionConfig } from '@/lib/portal/practice/professionConfig';
import { determineTrailStage } from '@/lib/cfo/trailStage';
import {
  computeAlerts,
  scopeAllowedTriggers,
  ALL_ENGINE_TRIGGER_KINDS,
  type AlertEngineSnapshot,
  type AlertEnginePriorState,
  type AlertTriggerKind,
  type TrailStageLetter,
} from '@/lib/portal/alerts/alertEngine';
import { log } from '@/lib/utils/logger';

export interface PortalAlertSweepOptions {
  dryRun?: boolean;
  organizationId?: string;
}

export interface PortalAlertSweepResult {
  success: true;
  orgsProcessed: number;
  clientsProcessed: number;
  clientsSkipped: number;
  alertsCreated: number;
  alertsUpdated: number;
  alertsResolved: number;
  durationMs: number;
  dryRun: boolean;
  errors: { organizationClientId: string; message: string }[];
}

/** Cast the canonical snapshot down to the engine's minimal input + the derived TRAIL stage. */
function projectSnapshot(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  snapshot: any,
): { engineSnapshot: AlertEngineSnapshot; trailStage: TrailStageLetter } {
  const monthlyCashflow: number = snapshot.quickMetrics?.monthlyCashflow ?? 0;
  const monthlyIncome: number = snapshot.quickMetrics?.monthlyIncome ?? 0;
  const monthlyExpenses: number = snapshot.quickMetrics?.monthlyExpenses ?? 0;
  const emergencyFundMonths: number = snapshot.emergencyFund?.monthsCovered ?? 0;
  const propertyPortfolioValue: number = snapshot.propertyPortfolioValue ?? 0;
  const propertyPortfolioEquity: number = snapshot.propertyPortfolioEquity ?? 0;
  const mortgageBalance: number = snapshot.netWorth?.liabilities?.mortgages ?? 0;
  const healthScore: number = snapshot.healthScore?.score ?? 0;

  const trailStage = determineTrailStage({
    hasAccounts: (snapshot.counts?.accounts ?? 0) > 0,
    monthlyCashflow,
    emergencyFundMonths,
    hasInvestments: (snapshot.counts?.investments ?? 0) > 0,
    healthScore,
  }) as TrailStageLetter;

  return {
    engineSnapshot: {
      monthlyCashflow,
      monthlyIncome,
      monthlyExpenses,
      emergencyFundMonths,
      propertyPortfolioValue,
      propertyPortfolioEquity,
      mortgageBalance,
      healthScore,
      trailStage,
    },
    trailStage,
  };
}

export async function runPortalAlertSweep(
  opts: PortalAlertSweepOptions = {},
): Promise<PortalAlertSweepResult> {
  const startedAt = Date.now();
  const dryRun = opts.dryRun === true;

  const result: PortalAlertSweepResult = {
    success: true,
    orgsProcessed: 0,
    clientsProcessed: 0,
    clientsSkipped: 0,
    alertsCreated: 0,
    alertsUpdated: 0,
    alertsResolved: 0,
    durationMs: 0,
    dryRun,
    errors: [],
  };

  const orgs = await prisma.organization.findMany({
    where: opts.organizationId ? { id: opts.organizationId } : undefined,
    select: { id: true, profession: true },
  });

  for (const org of orgs) {
    result.orgsProcessed += 1;
    const config = getPracticeProfessionConfig(org.profession);
    // Only the engine-computable subset of this profession's triggers.
    const professionTriggers: AlertTriggerKind[] = ALL_ENGINE_TRIGGER_KINDS.filter((k) =>
      (config.alertTriggers as readonly string[]).includes(k),
    );

    const clients = await prisma.organizationClient.findMany({
      where: { organizationId: org.id, status: 'ACTIVE', consentStatus: 'GRANTED' },
      select: { id: true, userId: true, accessScopes: true, alertMarker: true },
    });

    for (const client of clients) {
      // Trigger set for this client = profession triggers ∩ scope-allowed triggers.
      const scopeTriggers = scopeAllowedTriggers(client.accessScopes);
      const enabledTriggers = professionTriggers.filter((k) => scopeTriggers.has(k));

      if (enabledTriggers.length === 0) {
        // Nothing computable for this client — auto-resolve any leftover rows.
        result.clientsSkipped += 1;
        if (!dryRun) {
          const r = await prisma.clientAlert.updateMany({
            where: { organizationClientId: client.id, status: { in: ['ACTIVE', 'DISMISSED'] } },
            data: { status: 'RESOLVED', resolvedAt: new Date() },
          });
          result.alertsResolved += r.count;
        }
        continue;
      }

      try {
        const snapshot = await getMasterFinancialSnapshot(client.userId);
        const { engineSnapshot } = projectSnapshot(snapshot);
        const prior: AlertEnginePriorState | null = client.alertMarker
          ? {
              healthScore: client.alertMarker.lastHealthScore,
              trailStage: (client.alertMarker.lastTrailStage as TrailStageLetter | null) ?? null,
            }
          : null;

        const computed = computeAlerts({ snapshot: engineSnapshot, prior, enabledTriggers });
        const computedKinds = new Set(computed.map((a) => a.triggerKind));
        result.clientsProcessed += 1;

        if (!dryRun) {
          // Upsert ACTIVE rows for each computed alert. DISMISSED rows
          // are left untouched (sticky while the condition holds).
          for (const alert of computed) {
            const existing = await prisma.clientAlert.findUnique({
              where: {
                organizationClientId_triggerKind: {
                  organizationClientId: client.id,
                  triggerKind: alert.triggerKind,
                },
              },
            });
            if (existing?.status === 'DISMISSED') {
              continue; // sticky — adviser cleared it; don't re-surface while condition holds
            }
            if (existing) {
              await prisma.clientAlert.update({
                where: { id: existing.id },
                data: {
                  severity: alert.severity,
                  headline: alert.headline,
                  body: alert.body,
                  context: alert.context,
                  primaryActionLabel: alert.primaryActionLabel,
                  payload: alert.payload,
                  status: 'ACTIVE',
                  resolvedAt: null,
                  detectedAt: existing.status === 'ACTIVE' ? existing.detectedAt : new Date(),
                },
              });
              result.alertsUpdated += 1;
            } else {
              await prisma.clientAlert.create({
                data: {
                  organizationId: org.id,
                  organizationClientId: client.id,
                  triggerKind: alert.triggerKind,
                  severity: alert.severity,
                  headline: alert.headline,
                  body: alert.body,
                  context: alert.context,
                  primaryActionLabel: alert.primaryActionLabel,
                  payload: alert.payload,
                  status: 'ACTIVE',
                },
              });
              result.alertsCreated += 1;
            }
          }

          // Resolve any ACTIVE/DISMISSED rows whose condition has cleared.
          const stale = await prisma.clientAlert.findMany({
            where: {
              organizationClientId: client.id,
              status: { in: ['ACTIVE', 'DISMISSED'] },
              triggerKind: { notIn: Array.from(computedKinds) },
            },
            select: { id: true },
          });
          if (stale.length > 0) {
            const r = await prisma.clientAlert.updateMany({
              where: { id: { in: stale.map((s) => s.id) } },
              data: { status: 'RESOLVED', resolvedAt: new Date() },
            });
            result.alertsResolved += r.count;
          }

          // Upsert the marker. `last*` is the baseline next run's delta
          // triggers (HEALTH_DROP / TRAIL_ADVANCED) read; the values it
          // had going in are rolled into `previous*` so the Practice hero
          // can show a "change since last sweep" delta. Roll-forward:
          // previous := last (from `client.alertMarker`), then
          // last := current.
          await prisma.clientSnapshotMarker.upsert({
            where: { organizationClientId: client.id },
            create: {
              organizationClientId: client.id,
              lastHealthScore: engineSnapshot.healthScore,
              lastTrailStage: engineSnapshot.trailStage,
              lastSweptAt: new Date(),
            },
            update: {
              previousHealthScore: client.alertMarker?.lastHealthScore ?? null,
              previousTrailStage: client.alertMarker?.lastTrailStage ?? null,
              lastHealthScore: engineSnapshot.healthScore,
              lastTrailStage: engineSnapshot.trailStage,
              lastSweptAt: new Date(),
            },
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push({ organizationClientId: client.id, message });
        log.error(
          '[portal-alert-sweep] client failed',
          err instanceof Error ? err : null,
          { organizationClientId: client.id, message },
        );
      }
    }
  }

  result.durationMs = Date.now() - startedAt;
  log.info('[portal-alert-sweep] done', {
    orgs: result.orgsProcessed,
    clients: result.clientsProcessed,
    skipped: result.clientsSkipped,
    created: result.alertsCreated,
    updated: result.alertsUpdated,
    resolved: result.alertsResolved,
    durationMs: result.durationMs,
    dryRun,
    errorCount: result.errors.length,
  });

  return result;
}
