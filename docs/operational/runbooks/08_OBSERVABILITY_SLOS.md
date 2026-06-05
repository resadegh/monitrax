# Observability — SLOs & Alert Policies

> **Audience:** Director / BAU support team
> **Owner:** Director (until the team grows)
> **Status:** SLO targets + alert-policy specs defined here. **Wiring the Cloud Monitoring alert policies + notification channels is a Reza-side GCP-console step** — this doc is the spec to wire *to*; the checklist at the bottom (§9) tracks what's actually live.
> **Purpose:** Define what "healthy" means for Monitrax in measurable terms (Service Level Objectives), per route group, and specify exactly which Cloud Monitoring alert policies enforce them — so an alert that fires has a number behind it and a runbook attached.

This is the *application-level* observability doc. The *database-level* counterpart — Cloud SQL CPU/memory/disk/connections/replication — already lives in [`database/03_MONITORING_AND_ALERTS.md`](../database/03_MONITORING_AND_ALERTS.md) and is **not duplicated here**; this doc references it where the two overlap.

---

## 1. The signals we have (and the honest gaps)

Monitrax runs on **Vercel** (Next.js serverless functions) in front of **GCP Cloud SQL**, with auth via **Firebase / GCP Identity Platform**. That stack means our observability signals come from three places, not one:

| Signal source | What it can measure | Status |
|---|---|---|
| **GCP Cloud Monitoring — uptime checks** | Availability + latency of any public HTTP endpoint (`/api/health`, and synthetic canaries against representative route-group endpoints). Alertable in Cloud Monitoring. | `/api/health` check is **live** (see `runbooks/03_HEALTH_CHECKS.md`); per-route-group canaries are **a Reza-side step** (§9). |
| **GCP Cloud Monitoring — Cloud SQL metrics** | DB CPU/memory/disk/connections/up. Alertable. | **Live** — see `database/03_MONITORING_AND_ALERTS.md`. |
| **Vercel Observability / Analytics** | Per-route request count, error rate (4xx/5xx), p50/p75/p99 latency, function duration, cold starts. This is the *richest* per-route source but it lives in Vercel, not GCP. | Vercel's built-in dashboards are **available now**; alerting on them needs Vercel's own alert config (or a log drain → GCP log-based metric — not currently set up). |
| **Cloud Logging (via `createAuditLog` → DB, and Vercel → ???)** | Audit-trail of state-changing actions + `BLOCKED` rows. Vercel function logs are *not* drained to Cloud Logging today. | `AuditLog` table is **live** and queryable; a Vercel→Cloud Logging drain is **not set up** (would enable log-based metrics + unified alerting — a future improvement, noted in §10). |

**The honest position:** for *availability* and *DB health* we have proper alerting. For *per-route error rate and latency* we currently rely on Vercel's dashboards + the synthetic canaries below; a Vercel log drain would close the gap and is the recommended next step (§10). This doc defines the SLOs regardless — you can't manage what you haven't defined, even if some of the measurement is currently manual.

---

## 2. SLO definitions

SLOs are stated as **target / measurement window / error budget**. The window is rolling 30 days unless noted. "Error budget" is the allowed amount of badness — when it's exhausted, treat it as a signal to stop shipping risk and fix reliability.

### 2.1 Availability SLO (whole app)

| | |
|---|---|
| **SLI** | % of `/api/health` uptime-check probes that return `200` with body containing `"healthy"`, over the rolling 30 days. |
| **Target** | **99.5%** (≈ 3h 39m of allowed downtime / 30 days). |
| **Why 99.5%, not 99.9%** | Single-region Cloud SQL + serverless functions + a one-person on-call rotation. 99.9% (43 min/30d) would require multi-region DB + paging + a second responder — not where the product is. 99.5% is honest and still good. Revisit upward at: first ~50 paying users, or when a second on-call person exists. |
| **Error budget** | ~3.6h / 30 days. If a single incident burns more than half of it (≈ 1.8h), the post-incident review must produce a concrete reliability follow-up, not just "fixed it." |

### 2.2 Latency SLO (per route group)

Measured as **p95 server response time** (Vercel function duration, excludes client network). Targets differ by route group because a Sankey recompute is legitimately slower than a health ping.

| Route group | Representative routes | p95 target | p99 target | Notes |
|---|---|---|---|---|
| **System / health** | `/api/health` | **300 ms** | 800 ms | `SELECT 1`, with a bounded 2-attempt / 150 ms-backoff retry (2026-06-03) so single-probe transients don't false-page A1. A slow *success* still means DB latency; a 503 now means both attempts failed (sustained). |
| **Auth & session** | `/api/firebase-init`, admin login paths | **500 ms** | 1.2 s | Token verification + a small DB read. |
| **Core financial read** | `/api/master-snapshot`, `/api/dashboard/*`, `/api/financial-health`, `/api/cashflow`, `/api/budget-analysis`, `/api/safety-net`, `/api/money-flow`, `/api/portfolio/snapshot` | **1.2 s** | 2.5 s | The master snapshot fans out across many tables. This is the route group users *feel* — it's the dashboard. |
| **Entity & ledger CRUD** | `/api/accounts`, `/api/loans`, `/api/properties`, `/api/investments`, `/api/assets`, `/api/income`, `/api/expenses`, `/api/transactions`, `/api/unified-transactions`, `/api/recurring-payments`, `/api/entities`, `/api/household-*` | **800 ms** | 1.8 s | Mostly single-table reads/writes. |
| **CDR / banking** | `/api/cdr/*`, `/api/basiq/*`, `/api/bank/*` | **2.0 s** | 5.0 s | Some of these call Basiq; latency partly outside our control. The `/api/cdr/lifecycle` cron is exempt (it's a batch job, not user-facing). |
| **AI advisor** | `/api/ai/*`, `/api/ai-advisor/*`, `/api/cfo/*`, `/api/ask-a-pro/*` | **8.0 s** | 20 s | LLM round-trips. Streamed responses — measure time-to-first-byte separately if streaming; the 8s target is for non-streamed completions. |
| **Portal (B2B2C)** | `/api/portal/*`, `/api/professional-requests/*`, `/api/marketplace/*`, `/api/share/*` | **1.2 s** | 2.5 s | Adviser-facing equivalents of the consumer dashboard. The `/api/portal/alerts/sweep` cron is exempt (batch). |
| **Conversations & docs** | `/api/conversations/*`, `/api/documents/*`, `/api/storage/*` | **1.0 s** | 2.5 s | Document upload routes (`/api/storage/upload`, trust-deed PDF) are exempt from the p95 target — they're bounded by file size, not by us. |
| **Billing** | `/api/stripe/*` | **1.0 s** | 2.5 s | The Stripe webhook handler must be fast (Stripe retries on slow responses). |
| **Cron / system** | `/api/cdr/lifecycle`, `/api/conversations/retention-sweep`, `/api/portal/alerts/sweep`, `/api/admin/calc-audit/full-scan` | n/a (batch) | n/a | Not user-facing; they have their own `maxDuration` ceilings (300s) and their own success/failure logging. Alert on *failure* (non-2xx / didn't run), not on latency. |

### 2.3 Error-rate SLO (per route group)

Measured as **% of requests returning 5xx** (server errors), rolling 30 days. **4xx is excluded** — a 401 on an expired token or a 403 on a permission denial is the system working correctly. (The exception: a *spike* in 401s/403s is worth alerting on as a possible attack — see §3 alert policy A6.)

| Route group | 5xx error-rate target | Notes |
|---|---|---|
| System / health | **< 0.1%** | A 5xx here means the DB is down — it's also caught by the availability SLO. |
| Auth & session | **< 0.5%** | |
| Core financial read | **< 0.5%** | The dashboard. A 5xx here is a blank screen for a user. |
| Entity & ledger CRUD | **< 0.5%** | A 5xx on a write may mean lost user input — high-touch. |
| CDR / banking | **< 2.0%** | Higher tolerance because Basiq can fail; but a *sustained* climb means *our* integration is broken, not Basiq's blip. |
| AI advisor | **< 2.0%** | LLM providers rate-limit and occasionally 5xx; the route should degrade gracefully (return a "try again" message, not a 500) — a real 5xx here is a bug. |
| Portal (B2B2C) | **< 0.5%** | |
| Conversations & docs | **< 0.5%** | |
| Billing | **< 0.1%** | A 5xx on the Stripe webhook can drop a subscription event → revenue/state mismatch. The `StripeWebhookEvent` dedupe table mitigates, but the bar is still strict. |
| Cron / system | **0 failed runs** | Each cron must complete successfully on its schedule. A skipped or failed run is a P2 (CDR lifecycle / retention sweeps are compliance-relevant). |

---

## 3. Cloud Monitoring alert policies (app-level)

Create these in **Monitoring → Alerting → Create Policy**, project `monitrax-prod`. Each has a **runbook link** so the responder isn't starting from zero. (The Cloud-SQL-level policies — CPU/memory/disk/connections — are specified separately in [`database/03_MONITORING_AND_ALERTS.md`](../database/03_MONITORING_AND_ALERTS.md) §"Recommended Alert Policies"; don't duplicate them.)

| ID | Name | Condition | Severity | Notify | Runbook |
|---|---|---|---|---|---|
| **A1** | App down — health check | Uptime check on `https://www.monitrax.com.au/api/health` (the **`www` canonical host** — the apex 308-redirects and breaks the `"healthy"` content match; see `runbooks/03_HEALTH_CHECKS.md`) fails 3 consecutive times (≥ 1 min interval) | **Critical** (P0) | PagerDuty/SMS + Email + Slack `#ops` | `runbooks/01_INCIDENT_RESPONSE.md` Scenario 1 (DB unreachable) + IRP §10 |
| **A2** | App slow — health check latency | `/api/health` uptime-check request latency > 1.5 s for 5 min | Warning (P2) | Email + Slack `#ops` | `database/03_MONITORING_AND_ALERTS.md` (DB latency playbook) |
| **A3** | Core dashboard slow | Synthetic canary against `/api/master-snapshot` (authenticated) p95 > 2.5 s for 10 min | Warning (P2) | Email + Slack `#ops` | `database/03_MONITORING_AND_ALERTS.md` (slow-query checks) + check for an N+1 introduced by a recent deploy |
| **A4** | Elevated 5xx — any route group | 5xx rate > 2% of requests for 5 min (per route group; from a Vercel log drain → log-based metric, *or* from Vercel's own alerting until the drain exists) | **High** (P1) | Email + Slack `#ops` | `runbooks/01_INCIDENT_RESPONSE.md` Scenario 3 (API 500s) — first check: was there a deploy in the last hour? If yes, roll it back. |
| **A5** | Stripe webhook failing | 5xx rate on `/api/stripe/webhook` > 0% over a 10-min window, OR no successful webhook in 24h when subscriptions exist | **High** (P1) | Email + Slack `#ops` | Check `StripeWebhookEvent.processingError`; Stripe Dashboard → Webhooks → recent deliveries; re-drive failed events |
| **A6** | Auth-failure / blocked-access spike | Count of `AuditLog` rows with `status='BLOCKED'` (or a spike in 401/403 from the log-based metric) > 50 in 10 min | **High** (P1 — possible attack) | Email + Slack `#ops` | IRP §2 Containment + `runbooks/07_IRP_TABLETOP_EXERCISE.md` Scenario 1 |
| **A7** | Cron didn't run / failed | For each of `monitrax-cdr-lifecycle`, `monitrax-conversation-retention-sweep`, `monitrax-portal-alert-sweep`: no successful invocation within (schedule + 2h grace), or last invocation returned non-2xx | High (P1 for CDR-lifecycle / retention; P2 for alert-sweep) | Email + Slack `#ops` | `runbooks/05_RETENTION_SCHEDULERS.md` |
| **A8** | Error-budget burn (availability) | Availability SLO 30-day burn rate indicates the error budget will be exhausted before the window ends (fast-burn: >14.4× over 1h; slow-burn: >6× over 6h) | Warning (P2) escalating | Email + Slack `#ops` | This doc §2.1 — stop shipping risk; do a reliability review |
| **A9** | Budget overrun | GCP budget alert: monthly spend > 80% (warning) / > 100% (critical) of budget | Warning → Critical | Email | `runbooks/07_IRP_TABLETOP_EXERCISE.md` Scenario 4 + `cost-control/01_BUDGET_ALERTS_SETUP.md` |
| **A10** | Anthropic API health (Phase 33g.2 feedback chat + Phase 12 Track E onboarding chat) | P95 latency on `POST /api/onboarding/chat/extract` or `POST /api/portal/feedback/[id]/reply` > 3s for 10 min, OR daily Anthropic token spend trending > 80% of $50/mo cap | Warning (P2) | Email | `runbooks/07_CONVERSATIONAL_ONBOARDING_TOGGLE.md` §7 (cost monitoring) + `cost-control/00_VENDOR_INVENTORY.md` Anthropic row. console.anthropic.com cap is the structural safety net; this alert surfaces trend awareness before hitting the cap. |

> **Notification channels** — set up once in **Monitoring → Alerting → Edit notification channels**: (1) Email to the Director, (2) Slack `#ops` webhook, (3) an SMS/PagerDuty channel for P0/P1 only. Reference the channel IDs in every policy above. Until the SMS/PagerDuty channel exists, P0/P1 go to Email + Slack — document that gap in §9.

### Example: create the health-check alert policy via gcloud

```bash
# A1 — App down (uptime check must already exist; see runbooks/03_HEALTH_CHECKS.md §"Cloud Monitoring Uptime Check")
gcloud alpha monitoring policies create \
  --project=monitrax-prod \
  --display-name="Monitrax — App down (/api/health)" \
  --notification-channels="<EMAIL_CHANNEL_ID>","<SLACK_CHANNEL_ID>","<PAGER_CHANNEL_ID>" \
  --combiner=OR \
  --condition-display-name="Health check failing" \
  --condition-filter='resource.type="uptime_url" AND metric.type="monitoring.googleapis.com/uptime_check/check_passed" AND metric.labels.check_id="<HEALTH_CHECK_ID>"' \
  --aggregation='{"alignmentPeriod":"60s","perSeriesAligner":"ALIGN_FRACTION_TRUE"}' \
  --condition-threshold-comparison=COMPARISON_LT \
  --condition-threshold-value=1 \
  --condition-threshold-duration=120s \
  --documentation-content="App is failing its health check. Runbook: docs/operational/runbooks/01_INCIDENT_RESPONSE.md Scenario 1. If error signature matches IRP §10.3, follow that. Rollback lever: USE_CLOUD_SQL_CONNECTOR=false in Vercel Production env → redeploy."
```

Repeat the pattern for A2–A9 (adjust `--condition-filter`, comparison, threshold, duration). For SLO-burn-rate alerts (A8), use Cloud Monitoring's native **SLO + burn-rate alert** feature (Monitoring → SLOs → Create SLO) rather than a raw threshold policy — it does the multi-window burn math for you.

---

## 4. Synthetic canaries (the per-route-group probes)

Cloud Monitoring uptime checks can only hit *public* endpoints, and most route groups need an authenticated session. Two options to cover them:

1. **Public health probes per concern** — add lightweight, *unauthenticated* health sub-endpoints (e.g. `/api/health` already covers DB; consider `/api/health/auth` that verifies the Firebase Admin SDK can mint a token without exposing anything). Cheap, but only proves "the dependency is reachable," not "a real user flow works."
2. **Authenticated synthetic monitor** (recommended for the dashboard path) — a Cloud Monitoring **Synthetic Monitor** (a Cloud Function that runs Playwright) that logs in as a dedicated synthetic test user and loads `/dashboard`, asserting the Money Story hero rendered with numbers. This is the only thing that catches "auth works, DB works, but the snapshot endpoint 500s and the dashboard is blank." Scope it to one synthetic user; that user holds *synthetic* data only (CLAUDE.md §13.6 — no real CDR data in a test account).

Until a synthetic monitor exists, the per-route-group latency/error SLOs (§2.2, §2.3) are measured from **Vercel's own per-route analytics**, reviewed as part of the weekly health check (`runbooks/03_HEALTH_CHECKS.md` "Monitoring Schedule") rather than alerted on in real time. That's the current honest state — §9 tracks closing it.

---

## 5. Dashboards

Create one **Cloud Monitoring dashboard** ("Monitrax — Service Health") with these tiles, so the daily/weekly check is one screen:

1. `/api/health` uptime — % passing, last 24h + last 30d (the availability SLI).
2. `/api/health` request latency — p50/p95/p99, last 24h.
3. Cloud SQL CPU + memory + connections — last 24h (pulled from the DB metrics; same data as `database/03_MONITORING_AND_ALERTS.md`).
4. Cron invocations — last successful run timestamp for each of the 3 crons (A7).
5. `AuditLog` `status='BLOCKED'` count — last 24h (the A6 signal).
6. (Once the Vercel log drain exists) per-route-group 5xx rate + p95 latency.
7. GCP spend vs budget — month-to-date (A9).

Vercel's own "Observability" / "Analytics" tabs are the complementary view for per-route detail until #6 is wired.

---

## 6. Review cadence

| Activity | Frequency | Owner | Where |
|---|---|---|---|
| Glance at the Service Health dashboard | Daily (business hours) | BAU/Director | This doc §5 |
| Review per-route latency + 5xx in Vercel analytics; note anything trending toward an SLO breach | Weekly | BAU/Director | Vercel Observability |
| Review SLO attainment (availability, latency, error-rate) vs targets; note error-budget burn | Monthly | Director | This doc §2 |
| Re-evaluate SLO *targets* (raise availability target? tighten a latency target?) | Quarterly, and at growth milestones (first ~50 paying users) | Director | This doc §2 |
| Confirm alert notification channels still work (send a test alert) | Quarterly | Director | This doc §3 |
| Tabletop a detection-and-response scenario (Scenarios 2 & 4 exercise these alerts) | Annual | Director | `runbooks/07_IRP_TABLETOP_EXERCISE.md` |

---

## 7. When an SLO is breached (not just an alert — the *budget* is gone)

An individual alert is "something's wrong now." An SLO breach is "we've been less reliable than we promised, over a month." Different response:

1. **Stop shipping risk.** No non-trivial deploys until the reliability issue behind the breach is understood and fixed. (For a one-person team this is a self-imposed discipline, not a process gate — but it's the right call.)
2. **Root-cause it.** Which incidents burned the budget? Was it one big outage or death-by-a-thousand-cuts (chronic slowness, intermittent 5xx)?
3. **Produce a concrete reliability follow-up** in `IMPLEMENTATION_PLAN.md` — e.g. "add the missing index on `UnifiedTransaction.userId+createdAt` that caused the snapshot p95 regression", or "move the Stripe webhook to a faster path", or "drop the cold-start wedge by ...".
4. **Reset the conversation, not the budget.** Don't quietly lower the SLO target to make the breach disappear. Lowering a target is a deliberate, documented decision (with reasoning) — not a way to dodge a bad month.

---

## 8. References

| Document | Purpose |
|---|---|
| [`database/03_MONITORING_AND_ALERTS.md`](../database/03_MONITORING_AND_ALERTS.md) | DB-level metrics + Cloud SQL alert policies + slow-query checks (the DB half of observability — not duplicated here) |
| [`runbooks/03_HEALTH_CHECKS.md`](03_HEALTH_CHECKS.md) | Manual health-check procedures + the `/api/health` uptime-check setup |
| [`runbooks/01_INCIDENT_RESPONSE.md`](01_INCIDENT_RESPONSE.md) | On-call diagnostic runbook (the runbook links in §3 point here) |
| [`runbooks/07_IRP_TABLETOP_EXERCISE.md`](07_IRP_TABLETOP_EXERCISE.md) | Tabletop scenarios — Scenarios 2 & 4 exercise these alerts |
| [`docs/policy/INCIDENT_RESPONSE_PLAN.md`](../../policy/INCIDENT_RESPONSE_PLAN.md) | IRP — severity classification the alert severities map to |
| [`runbooks/05_RETENTION_SCHEDULERS.md`](05_RETENTION_SCHEDULERS.md) | The 3 cron jobs alert A7 watches |
| [`cost-control/01_BUDGET_ALERTS_SETUP.md`](../cost-control/01_BUDGET_ALERTS_SETUP.md) | Budget-alert setup (alert A9) |

---

## 9. Live status — what's wired vs spec-only

| Item | Status |
|---|---|
| `/api/health` uptime check (5-min, alerts on 2 failures) | ✅ Live (per `runbooks/03_HEALTH_CHECKS.md`) — confirm it's still configured |
| Cloud SQL metric alerts (CPU/memory/disk/connections) | ✅ Spec'd in `database/03_MONITORING_AND_ALERTS.md` — confirm policies exist in the console |
| Notification channels (Email / Slack `#ops` / SMS-or-PagerDuty) | ☐ Reza-side — Email likely exists; Slack + SMS/PagerDuty TBC |
| Alert policies A1–A9 (this doc §3) | ☐ Reza-side — create in Cloud Monitoring; A1/A2/A9 are quick wins, A4/A6 need a log source |
| Vercel → Cloud Logging log drain (enables per-route 5xx/latency log-based metrics + unified alerting) | ☐ Reza-side — recommended next step (see §10) |
| Authenticated synthetic monitor (Playwright → load `/dashboard` as a synthetic user) | ☐ Reza-side — closes the "auth+DB up but dashboard blank" gap |
| Cloud Monitoring SLO objects + burn-rate alerts (A8) | ☐ Reza-side — use Monitoring → SLOs |
| "Monitrax — Service Health" dashboard (this doc §5) | ☐ Reza-side — assemble from the tiles listed |

> **For Reza:** the highest-leverage three, in order: (1) confirm A1 + A9 are live and notifying you (covers "app down" and "bill blew up" — the two that hurt most); (2) set up the Vercel log drain so A4/A6 become real-time instead of weekly-eyeball; (3) the authenticated synthetic monitor for the dashboard path. Everything else is incremental.

---

## 10. Future improvements (noted, not blocking)

- **Vercel log drain → GCP Cloud Logging** — unifies app logs with infra logs, enables log-based metrics for per-route 5xx/latency, and makes A4/A6 real-time. The single biggest observability upgrade available. (Vercel supports log drains on Pro; we're on Pro.)
- **Error Reporting** — once Vercel logs reach Cloud Logging, GCP Error Reporting auto-groups exceptions and alerts on *new* error signatures (CLAUDE.md §13.9 lists it as a P1 CDR-compliance service). Currently we have no automated exception grouping.
- **Distributed tracing** — for the AI advisor and master-snapshot paths (the slow ones), OpenTelemetry spans would show whether the time is in our code, the DB, or an external API. Not needed yet; revisit if p95s drift up.
- **Real-User Monitoring (RUM)** — Vercel Speed Insights / Web Vitals gives the *client-side* picture (TTFB, LCP, CLS) that server-side latency SLOs miss. Cheap to enable; do it when there's a real user base to measure.

---

*Last Updated: 2026-05-10 — created as part of the Phase 0 operational-readiness chunk (backup/restore drill + IRP tabletop + observability SLOs).*
