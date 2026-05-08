# Retention Schedulers — GCP Cloud Scheduler Setup

> **Operational runbook for the two cron jobs that enforce
> Monitrax's data-retention obligations.** Both endpoints are built
> and accept `CRON_SECRET`-authenticated calls today; both crons
> need to be **created in GCP Cloud Scheduler** for the obligations
> to be enforced.

**Owner:** Director (Reza)
**Last reviewed:** 2026-05-09
**Source of truth:** this file. CLAUDE.md §13.5, §13.6 + `docs/policy/CDR_DATA_RETENTION_SCHEDULE.md` reference back here.

---

## 1. Why this runbook exists

Two schedulers MUST run for Monitrax to be compliant with its
written retention promises:

1. **CDR consent-expiry sweep** (`monitrax-cdr-lifecycle`) — runs
   `checkConsentExpiry()` daily; deletes CDR data for orgs whose
   consent has expired or been revoked. Required by **CDR Privacy
   Safeguard 12** + Basiq §5.5.
2. **Conversation retention sweep** (`monitrax-conversation-retention-sweep`)
   — runs `sweepExpiredMessages()` daily; hard-deletes
   `ConversationMessage` rows past their 7-year `retentionUntil`.
   Required by Corporations Act §912F (AFSL recordkeeping) + the
   "no indefinite retention" rule in **CLAUDE.md §13.5** /
   `CDR_DATA_RETENTION_SCHEDULE.md` row "Professional conversation
   messages".

Without these schedulers, the data persists forever — that's a
direct compliance failure even though the deletion code is
ready to run.

---

## 2. Prerequisites

| Item | How to verify |
|---|---|
| `CRON_SECRET` env var set on Vercel (production scope) | Vercel → Project → Settings → Environment Variables → search `CRON_SECRET`. Should be a 32+ char random string. Generate via `openssl rand -hex 32` if not yet set. |
| Service account with `Cloud Scheduler Admin` role | Use the same `vercel-monitrax-db@…` SA from WIF if convenient, or create `monitrax-cron@…`. |
| Cloud Scheduler API enabled in `monitrax-479700` GCP project | `gcloud services enable cloudscheduler.googleapis.com --project=monitrax-479700` |
| Production domain — `https://monitrax.com.au` resolving to Vercel | Confirm via `curl -I https://monitrax.com.au` (200 OK) |

---

## 3. Job 1 — CDR consent-expiry sweep

**Endpoint:** `POST https://monitrax.com.au/api/cdr/lifecycle`
**Built:** Phase 35 (already deployed). See `app/api/cdr/lifecycle/route.ts`.

### gcloud setup

```bash
gcloud scheduler jobs create http monitrax-cdr-lifecycle \
  --project=monitrax-479700 \
  --location=australia-southeast1 \
  --schedule="0 2 * * *" \
  --time-zone="UTC" \
  --uri="https://monitrax.com.au/api/cdr/lifecycle" \
  --http-method=POST \
  --headers="Authorization=Bearer ${CRON_SECRET}" \
  --attempt-deadline=300s \
  --description="Daily CDR consent-expiry sweep. CDR Privacy Safeguard 12. See docs/operational/runbooks/05_RETENTION_SCHEDULERS.md"
```

### Console setup (alternative)

GCP Console → Cloud Scheduler → Create Job

| Field | Value |
|---|---|
| Name | `monitrax-cdr-lifecycle` |
| Region | `australia-southeast1` |
| Frequency | `0 2 * * *` |
| Timezone | `UTC` |
| Target type | HTTP |
| URL | `https://monitrax.com.au/api/cdr/lifecycle` |
| HTTP method | POST |
| Auth header — Header name | `Authorization` |
| Auth header — Value | `Bearer <CRON_SECRET>` (paste the actual value) |
| Attempt deadline | 5 minutes |

### What it does, step by step

1. Verifies the `CRON_SECRET` Bearer token (timing-safe compare).
2. Calls `checkConsentExpiry()`:
   - Finds `OrganizationClient` rows with `consentStatus=GRANTED` AND `consentExpiresAt < now()`.
   - Flips them to `EXPIRED`.
   - For each user with no remaining ACTIVE consents, calls `deleteCDRData(userId, 'consent_expired')` — hard-deletes Basiq accounts/transactions/connections.
   - Writes `CDR_CONSENT_EXPIRED` + `CDR_DATA_DELETED` audit rows.
3. Runs audit-log retention enforcement (G44).
4. Runs anomaly detection on the audit log.
5. Returns `{ success, deletionsTriggered, durationMs }`.

### Verification (post-create)

```bash
# Trigger an immediate run (without waiting for 02:00 UTC):
gcloud scheduler jobs run monitrax-cdr-lifecycle \
  --project=monitrax-479700 \
  --location=australia-southeast1
```

Then check:
- Cloud Logging → filter `resource.type="cloud_scheduler_job"` → look for the run with status 200.
- Vercel function logs → `/api/cdr/lifecycle` → should show "Consent expiry check started" and "complete".
- `/admin/scheduler` → cron health page → should show last-run timestamp.

---

## 4. Job 2 — Conversation retention sweep

**Endpoint:** `POST https://monitrax.com.au/api/conversations/retention-sweep`
**Built:** Production-readiness workstream 2026-05-09. See `app/api/conversations/retention-sweep/route.ts` + `lib/services/conversationRetentionService.ts`.

### gcloud setup

```bash
gcloud scheduler jobs create http monitrax-conversation-retention-sweep \
  --project=monitrax-479700 \
  --location=australia-southeast1 \
  --schedule="0 3 * * *" \
  --time-zone="UTC" \
  --uri="https://monitrax.com.au/api/conversations/retention-sweep" \
  --http-method=POST \
  --headers="Authorization=Bearer ${CRON_SECRET}" \
  --attempt-deadline=300s \
  --description="Daily 7-yr conversation message archive sweep. AFSL Corp Act §912F. See docs/operational/runbooks/05_RETENTION_SCHEDULERS.md"
```

**Note:** scheduled at 03:00 UTC — one hour after the CDR cron at
02:00 UTC. They share the database; sequential runs avoid
DB-CPU contention on warm-up.

### What it does, step by step

1. Verifies the `CRON_SECRET` Bearer token.
2. Calls `sweepExpiredMessages()`:
   - Finds `ConversationMessage` rows where `retentionUntil < now()`.
   - Hard-deletes them in batches of 500 (configurable).
   - Caps at 50,000 rows per invocation — runaway protection. If the
     cap is hit, the next cron picks up the remainder.
   - Writes ONE aggregate `CONVERSATION_MESSAGES_PURGED` audit row
     per batch (count + retention-window range only — per-message
     detail can't appear because the content is being purged at
     that instant).
3. Returns `{ success, purged, batches, durationMs, capHit }`.

### First-run characteristics

The very first sweep against a long-history org may purge tens of
thousands of rows from the early Phase 32C PR4d period (2026-05-07
onward). Subsequent runs land on <100 rows/day at steady state.
The 50k cap means the first run might need 2–3 daily invocations
to drain a multi-year backlog — that's acceptable; the 8-year-old
data is no more compliant for waiting another day.

---

## 5. Job 3 — Practice alert engine v1

**Endpoint:** `POST https://monitrax.com.au/api/portal/practice/alerts/generate`
**Built:** Production-readiness chunk 2 — 2026-05-10. See `app/api/portal/practice/alerts/generate/route.ts` + `lib/services/practiceAlertEngine.ts`. Closes Phase 32B PR3 item #9.

### gcloud setup

```bash
gcloud scheduler jobs create http monitrax-practice-alert-engine \
  --project=monitrax-479700 \
  --location=australia-southeast1 \
  --schedule="0 4 * * *" \
  --time-zone="UTC" \
  --uri="https://monitrax.com.au/api/portal/practice/alerts/generate" \
  --http-method=POST \
  --headers="Authorization=Bearer ${CRON_SECRET}" \
  --attempt-deadline=300s \
  --description="Daily Practice alert engine v1 — generates real alerts from per-client snapshot deltas. See docs/operational/runbooks/05_RETENTION_SCHEDULERS.md §5"
```

**Note:** scheduled at 04:00 UTC — one hour after the conversation
sweep at 03:00 UTC, two hours after the CDR cron at 02:00 UTC. Same
DB; sequential runs avoid CPU contention on warm-up.

### What it does, step by step

1. Verifies the `CRON_SECRET` Bearer token.
2. For every `Organization` with at least one ACTIVE+GRANTED `OrganizationClient`:
   - For each ACTIVE client:
     - Fetches current snapshot via `getMasterFinancialSnapshot()` with the org's `viewerContext` (service-layer scope filter applies).
     - Loads most-recent prior `PracticeClientHealthSnapshot` (yesterday's fingerprint).
     - Loads ~30-day-old fingerprint (for `HEALTH_DROP`).
     - Evaluates the 5 v1 triggers (`TRAIL_ADVANCED` / `HEALTH_DROP` / `CASHFLOW_NEGATIVE` / `EMERGENCY_FUND_LOW` / `LVR_REFINANCE_WINDOW`). Triggers fire only on TRANSITIONS — adviser inbox doesn't repeat the same alert daily.
     - Idempotently creates `PracticeAlert` rows (skips dup OPEN per (client, triggerKind)).
     - Auto-closes existing OPEN alerts whose underlying condition no longer holds.
     - Persists today's fingerprint for tomorrow's delta.
3. Returns aggregate counts per the `AggregateGenerationResult` shape.

### Demo / first-run characteristics

The engine produces **zero alerts on first run** for any client because
delta detection requires at least one prior snapshot. That's expected:
- Day 1: writes the first `PracticeClientHealthSnapshot` row per
  active client.
- Day 2 onward: compares to prior + emits real alerts on transitions.
- Day 30 onward: `HEALTH_DROP` becomes evaluatable (needs 30-day
  history).

The dashboard's `LIGHTHOUSE_ALERTS` fixture continues to render until
the engine produces real alerts — keeps the pitch demo intact during
the warm-up window.

### Manual trigger (dev / staging)

To manually run the engine outside the daily cron schedule:

```bash
curl -X POST https://monitrax.com.au/api/portal/practice/alerts/generate \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

Useful for: warming up the snapshot history on a fresh deploy,
debugging a specific org by running with an isolated dataset, or
re-running after a broken cron tick.

---

## 6. Job 4 — Stripe webhook reconciliation (FUTURE)

Reserved for the post-Stripe-live-mode hardening. Not yet built.
When ready, add a third job here that calls a yet-to-be-built
endpoint reconciling local `StripeSubscription` against
`stripe.subscriptions.list()` to catch missed webhooks.

---

## 7. Reza's Tier-1 GCP-console todo (production hardening)

These are GCP-console actions that aren't in the code path. Track
them off this runbook so they don't fall through the cracks.

### CMEK (Customer-Managed Encryption Keys) on Cloud SQL

- **Why:** CDR best-practice for data-at-rest encryption (queued in
  Up Next #3). Default Google-managed encryption is technically
  compliant, but CMEK is what auditors expect from a CDR ADR/CDR
  Provider.
- **How:**
  1. Cloud KMS → create keyring `monitrax-cmek-prod` in
     `australia-southeast1`.
  2. Create symmetric key `cloud-sql-encryption` with 90-day rotation.
  3. Grant the Cloud SQL service account
     (`service-<project-number>@gcp-sa-cloud-sql.iam.gserviceaccount.com`)
     the `Cloud KMS CryptoKey Encrypter/Decrypter` role on the key.
  4. Cloud SQL → Edit instance → Encryption → switch from "Google-
     managed" to "Customer-managed" → pick the key.
  5. **This forces a brief downtime** (~2-5 minutes for instance
     restart). Schedule for the maintenance window.
- **Effort:** ~1 hour of Reza-time in the console + the maintenance window.

### Cloud Armor (WAF / DDoS protection)

- **Why:** CDR §3 surface protection. Required for accreditation.
- **How:**
  1. Cloud Armor → Create policy `monitrax-prod`.
  2. Default action: ALLOW.
  3. Add WAF rules: `evaluatePreconfiguredWaf('xss-v33-stable')`,
     `evaluatePreconfiguredWaf('sqli-v33-stable')`,
     `evaluatePreconfiguredWaf('rce-stable')` (initially in
     PREVIEW mode for 2 weeks to surface false positives).
  4. Add rate-limit rule: 100 req/min/IP on `/api/*`, deny over
     threshold.
  5. **Vercel pin:** Cloud Armor sits in front of Vercel via a
     custom HTTPS load balancer fronting the Vercel domain — see
     [Vercel + Cloud Armor pattern](https://vercel.com/docs/edge-network/security)
     when ready.
- **Effort:** ~1-2 days. The 2-week PREVIEW window is the slow part.

### Security Command Center (Premium)

- **Why:** CDR §3 surface monitoring + automated vulnerability
  scanning + organisation-wide compliance posture dashboard.
- **How:** GCP Console → Security Command Center → enable Premium
  tier on the `monitrax-479700` project. ~AU$0.05/asset/hour at
  current scale (~100 assets ≈ AU$120/month).
- **Effort:** ~30 minutes to enable + ~2 hours to triage initial
  findings (most will be informational on a clean GCP project).

---

## 8. When things go wrong

### Cloud Scheduler job is failing (non-200 response)

1. Check Cloud Scheduler → Jobs → the failing job → "Logs" tab.
2. Common causes:
   - `401 UNAUTHORIZED` — `CRON_SECRET` env var changed on Vercel
     but scheduler still has old value. Update via console or
     `gcloud scheduler jobs update http <name> --update-headers="Authorization=Bearer <new-secret>"`.
   - `500 SERVER_ERROR` — endpoint is throwing. Check Vercel
     function logs at the same timestamp.
   - Timeout — first sweep against a long-history org may need
     more than one cron tick. The `capHit` flag in the response
     signals this is benign; subsequent runs drain.

### Cron didn't run at all today

1. Cloud Scheduler → Jobs → the job → check "Last run" timestamp.
2. If older than expected, check Cloud Scheduler quota +
   `monitrax-479700` project billing status.
3. As a manual stopgap, trigger immediately:
   `gcloud scheduler jobs run <name> --location=australia-southeast1`.

### Conversation sweep purged way more than expected

1. Pull the audit rows: query `AuditLog WHERE action =
   'CONVERSATION_MESSAGES_PURGED' AND timestamp > <today>`.
2. Each row's metadata shows the count + retention window. If the
   purge looks anomalous (e.g. messages from last week instead of
   2019), STOP THE SWEEP — pause the Cloud Scheduler job and
   investigate before the next run.
3. There's no "undelete" — purges are intentional hard-deletes.
   Restore from the most recent automated Cloud SQL backup if
   needed (PITR window per `02_BACKUP_AND_RESTORE.md`).

---

## 9. Compliance evidence

For Basiq accreditation submission, screenshot:
- Cloud Scheduler → Jobs → both jobs showing `ENABLED`.
- A successful run log for each (Cloud Logging filter:
  `resource.type="cloud_scheduler_job" AND
  resource.labels.job_id IN ("monitrax-cdr-lifecycle",
  "monitrax-conversation-retention-sweep")`).
- `AuditLog` query showing recent `CDR_DATA_DELETED` +
  `CONVERSATION_MESSAGES_PURGED` rows.

These three artefacts demonstrate the **enforcement** of the
retention promises in `CDR_DATA_RETENTION_SCHEDULE.md` — the
policy + the proof, paired.
