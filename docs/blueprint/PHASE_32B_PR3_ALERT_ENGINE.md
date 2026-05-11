# Phase 32B PR3 #9 — Real Alert Engine

> **Status:** ✅ **COMPLETE.** #9a (PR #745) — schema + pure engine + tests + cron sweep. #9b (this PR) — org-scoped `GET /api/portal/alerts` + `POST /api/portal/alerts/[id]/dismiss` + Practice dashboard wiring + dismiss affordance.
> **Closes:** Phase 32B PR3 item #9 — the last PR3 item. (Item #10 — profession-aware scope presets — shipped in PR #743.)
> **Effort:** #9a ~3 days · #9b ~1 day (delivered).
> **Last updated:** 2026-05-10 — Reza + Claude (post-#9b polish part 1: admin "run sweep now" shipped — see §6b).
>
> **Post-#9b polish:** ① admin "run sweep now" button — **✅ shipped** (see §6b). ② recompute the hero KPI strip from real client+alert data — **📋 still queued, not blocking** (needs a `GET /api/portal/clients` endpoint carrying per-client aggregates — health score + TRAIL stage + active-alert count — *plus* a real product decision about what the Practice client-book table shows for an org with a sparse sweep history, since the table's financial columns can't be filled from the alert/marker rows alone).

---

## 1. What this replaces

The Practice dashboard's "needs attention today" alert stream
(`components/portal/practice/PracticeAlertStream.tsx`) currently renders
`LIGHTHOUSE_ALERTS` — a hand-authored demo fixture in
`lib/portal/practice/lighthouseDataset.ts`. Great for the lighthouse
pitch; useless for a real adviser with real clients. PR #9 makes the
alert stream compute from real client snapshot data.

The fixture stays — it remains the storybook/E2E fixture and the
empty-state preview an org sees before it has onboarded a real client
(per the fixture's own header note).

---

## 2. Five v1 triggers

| Trigger | Severity | Condition | Stateful? |
|---|---|---|---|
| `CASHFLOW_NEGATIVE` | critical | monthly net cashflow < 0 | no |
| `EMERGENCY_FUND_LOW` | critical | emergency-fund coverage < 1 month | no |
| `LVR_REFINANCE_WINDOW` | opportunity | 0 < portfolio LVR < 80% AND usable equity ≥ $20k | no |
| `HEALTH_DROP` | critical | prior health score − current ≥ 10 points | **yes** — needs `ClientSnapshotMarker.lastHealthScore` |
| `TRAIL_ADVANCED` | milestone | current TRAIL stage later than prior stage | **yes** — needs `ClientSnapshotMarker.lastTrailStage` |

The two stateful triggers gracefully no-op when no prior marker exists
(first-ever sweep for a client) — "advanced from nothing" / "dropped
from nothing" aren't meaningful.

All thresholds are constants in `lib/portal/alerts/alertEngine.ts`
(`HEALTH_DROP_THRESHOLD = 10`, `LVR_REFINANCE_CEILING = 80`,
`LVR_MIN_USABLE_EQUITY_AUD = 20_000`) — single source of truth.

---

## 3. Architecture (#9a — this PR)

| Layer | What | File |
|---|---|---|
| **Schema** | `ClientAlert` model (one live row per `(organizationClientId, triggerKind)`; status `ACTIVE` / `DISMISSED` / `RESOLVED`; aggregate-only `payload` JSON) + `ClientSnapshotMarker` model (prior `lastHealthScore` / `lastTrailStage` for the delta triggers) + `ClientAlertStatus` enum + relations on `OrganizationClient`. Hand-written additive migration `20260513110000_phase_32b_pr3_alert_engine`. | `prisma/schema.prisma`, `prisma/migrations/.../migration.sql` |
| **Pure engine** | `computeAlerts({ snapshot, prior?, enabledTriggers }) → ComputedAlert[]` — takes a minimal `AlertEngineSnapshot` projection (NOT the full `MasterFinancialSnapshot`, for decoupling + testability), the optional prior-sweep state, and the trigger kinds this org's profession surfaces. Plus `scopeAllowedTriggers(grantedScopes) → Set<AlertTriggerKind>` — gates the trigger set down to "what this client actually shared" (`FULL` → everything; `FINANCIAL`/`TRANSACTIONS` → cashflow/emergency/health/trail; `PROPERTIES`/`LOANS` → LVR). Pure — no DB, no fetch, no `Date.now()` side effects. | `lib/portal/alerts/alertEngine.ts` |
| **Tests** | 20+ unit tests pinning each trigger condition, the thresholds, the stateful-graceful-no-op behaviour, the `enabledTriggers` gating, and the canonical kind-ordering. | `tests/portal/alerts/alertEngine.test.ts` |
| **Cron runner** | `POST /api/portal/alerts/sweep` — `Authorization: Bearer <CRON_SECRET>` (timing-safe; unauthorised → `BLOCKED` audit row, mirroring the CDR/conversation crons). For each org → for each `ACTIVE` + `GRANTED` client → `getMasterFinancialSnapshot(clientUserId)` → project → `computeAlerts` with `enabledTriggers = professionTriggers ∩ scopeAllowedTriggers(client.accessScopes)` → persist (upsert ACTIVE rows; leave DISMISSED rows alone while the condition holds; flip ACTIVE/DISMISSED → RESOLVED when the condition clears, which re-arms; upsert the marker). Optional body `{ dryRun?, organizationId? }`. Returns 200 even when nothing changed. | `app/api/portal/alerts/sweep/route.ts` |

### Why the cron uses the full snapshot, not a `viewerContext`

`getMasterFinancialSnapshot(userId, viewerContext)` validates that the
calling *seat* owns the client link — there is no "seat" in a cron
sweep. So the sweep computes the **full** snapshot (no `viewerContext`)
and applies the consent gate at the **trigger** level: it only runs a
trigger if `scopeAllowedTriggers(client.accessScopes)` permits it, so
the org never ends up with an alert (headline/body/context/payload)
derived from data the client didn't share. The audit posture: the
sweep is a system batch job, not an interactive professional drill-in,
so it does not write `ClientAccessLog` rows — only the `BLOCKED`
unauthorised-hit case writes an `AuditLog` row (same as the other crons).

### Dismissal semantics

- Sweep run: condition holds, row is `DISMISSED` → leave it (sticky — the adviser cleared it; don't re-surface while it's still true).
- Sweep run: condition clears, row is `DISMISSED` or `ACTIVE` → flip to `RESOLVED` + set `resolvedAt`. This **re-arms** the trigger — the next time the condition holds, a fresh `ACTIVE` row is created.
- The adviser-facing `GET` (in #9b) returns only `ACTIVE` rows, so `DISMISSED` / `RESOLVED` rows are invisible to the dashboard regardless.

### Privacy (CLAUDE.md §13.3)

`ClientAlert.payload` carries **aggregate context numbers only** —
health delta, monthly cashflow, LVR, usable equity, stage letters. No
raw CDR transactions, no per-account balances. The `body` / `context`
strings are likewise aggregate-derived.

---

## 4. GCP Cloud Scheduler config (Reza-side console step)

```
Name:     monitrax-portal-alert-sweep
Schedule: 0 4 * * *  (daily 04:00 UTC — after the CDR retention crons at 02:00 / 03:00)
Target:   POST https://<domain>/api/portal/alerts/sweep
Headers:  { "Authorization": "Bearer <CRON_SECRET>" }
```

Until the scheduler is wired, the engine + endpoint are dormant — no
alerts are computed. Manual invocation (curl with the bearer token, or
the admin UI in a future PR) works for testing / backfill.

---

## 5. Acceptance criteria (#9a)

- [x] `ClientAlert` + `ClientSnapshotMarker` + `ClientAlertStatus` added to `schema.prisma` with a matching additive migration file (CLAUDE.md §12.12).
- [x] `lib/portal/alerts/alertEngine.ts` — pure `computeAlerts` + `scopeAllowedTriggers`; all thresholds are constants in-file; full JSDoc.
- [x] `tests/portal/alerts/alertEngine.test.ts` — every trigger condition + thresholds + stateful-no-op + gating + ordering pinned.
- [x] `POST /api/portal/alerts/sweep` — `CRON_SECRET` auth (timing-safe), per-org per-client loop, scope-gated triggers, upsert/resolve/re-arm persistence, marker upsert, `dryRun` + `organizationId` body options.
- [x] No raw CDR data in any persisted alert field (§13.3).
- [x] Migration is purely additive — `CREATE TYPE` / `CREATE TABLE` / `CREATE INDEX` / `ADD CONSTRAINT` only; §12.11 destructive-write checklist N/A by structural argument.

---

## 6. #9b — wiring (✅ shipped)

| Item | Status | Detail |
|---|---|---|
| **`GET /api/portal/alerts?organizationId=…`** | ✅ | `withPermission('org.read', …)` + inline active-membership check (mirrors `/api/portal/conversations`). Returns the org's `ACTIVE` `ClientAlert` rows projected to the `DemoAlert` shape (`{ id, clientId, triggerKind, severity, headline, body, context, primaryActionLabel, detectedAt }`) + a thin client-summary array (`{ id, initials, name }`); client names resolved with a single follow-up `prisma.user.findMany` (no `user` relation on `OrganizationClient`). `payload` column NOT returned (privacy — §13.3). `clientId == organizationClientId == clients[].id` so the component's lookup map works unchanged. |
| **`POST /api/portal/alerts/[id]/dismiss`** | ✅ | `withPermission<RouteContext>('org.update', …)` + active-membership check against the alert's org. Sets `status = DISMISSED`, `dismissedAt = now`, `dismissedByMemberId = caller's OrganizationMember.id`. Idempotent on an already-DISMISSED row; 409 on a RESOLVED row. |
| **`PracticeAlertStream` — `onDismiss?` + dismiss affordance** | ✅ | New optional `onDismiss?: (alertId) => void`; when present each alert row gets a "Dismiss" link under the primary-action button. `clients` prop narrowed `DemoClient[]` → `AlertClientSummary = Pick<DemoClient,'id'|'initials'|'name'>` (the stream never touches the financial fields). `AlertClientSummary` re-exported from the practice index. |
| **Practice dashboard wiring** | ✅ | `/portal/dashboard` `useEffect` fetches `GET /api/portal/alerts` for the current org; `realAlerts === null` ⇒ fixture-preview mode (the `LIGHTHOUSE_ALERTS` fixture, kept as the empty-state placeholder); a non-empty real array ⇒ swaps to live data + passes `onDismiss` (optimistic-remove + refetch). |
| **`computeKpis` real input** | 📋 post-#9b | The hero KPI strip stays on the fixture for #9b — recomputing it needs the real client book (health scores etc.), not just alerts. Lands with the client-book wiring (see §6b). |
| **Admin "run sweep now"** | ✅ shipped | See §6b. |

---

## 6b. Post-#9b polish — part 1: admin "run sweep now" (✅ shipped)

The Cloud Scheduler job (`monitrax-portal-alert-sweep`, `0 4 * * *` UTC) is a Reza-side console step; until it's wired, the engine never runs and the Practice dashboard shows the fixture preview. This makes the sweep invokable on demand from the admin portal — also useful for a one-off recompute after onboarding a new client, or a dry-run preview without touching any rows.

| Item | Status | Detail |
|---|---|---|
| **`lib/portal/alerts/sweepRunner.ts`** | ✅ | The sweep core extracted out of the cron route into `runPortalAlertSweep({ dryRun?, organizationId? }): Promise<PortalAlertSweepResult>`. One implementation; the cron route and the admin route are now thin auth wrappers around it (CLAUDE.md §12.2 SSOT). Behaviour unchanged from #9a. |
| **`POST /api/portal/alerts/sweep`** (refactored) | ✅ | Now just: CRON_SECRET timing-safe auth + `BLOCKED`-audit-on-fail + parse `{dryRun,organizationId}` body → `runPortalAlertSweep(...)` → return the result. |
| **`POST /api/admin/portal-alert-sweep`** | ✅ | New. `verifyAdminGCPAuth` + `role === 'SUPER_ADMIN'` (mirrors `/api/admin/run-seed`). Body `{ dryRun?, organizationId? }` → `runPortalAlertSweep(...)`. Writes an `AuditLog` row (`action: 'UPDATE'`, `entityType: 'PortalAlertSweep'`, `metadata: { trigger: 'admin-manual', adminEmail, dryRun, counts… }`) on success and on failure. Returns `{ ...PortalAlertSweepResult, runBy }`. `maxDuration = 300`. |
| **Admin UI** | ✅ | New "Portal alert sweep" `AdminCard` on `/admin/scheduler` (below the Cloud Scheduler jobs table; rendered independently of the GCP-Scheduler-API availability since it calls our endpoint directly). Has a **"Dry run"** checkbox (default on — safest first action), a **"Preview sweep" / "Run sweep now"** button (label flips with the checkbox), an amber "writes ClientAlert rows for all orgs" hint when dry-run is off, and a result panel showing the counts (orgs / clients processed / skipped / alerts created·updated·resolved / errors) + duration + run-by + the first 10 per-client errors if any. |

> **Still queued (post-#9b part 2):** the hero KPI strip + client-book table on real data. This needs a new `GET /api/portal/clients` endpoint returning per-client aggregates (health score + TRAIL stage + active-alert count — read cheaply from `OrganizationClient` + `ClientSnapshotMarker` + `ClientAlert`, no live snapshot) **and** a product decision: the `PracticeClientBookTable` shows financial columns (net worth, cashflow, LVR…) that can't be filled from the alert/marker rows, so for real orgs the client-book either needs a leaner shape (health / stage / last-contact + a "view client →" link) or the endpoint has to compute fuller per-client snapshots (slower; re-exposes financial aggregates on the practice landing → `ClientAccessLog` rows per client, CDR-sensitive). Worth an architect-mode pass before building.

---

## 7. Future (v2 — not scoped)

- More triggers: `INCOME_DROPPED`, `PROPERTY_ADDED`, `TAX_POSITION_CHANGED`, `BAS_DUE` (the fixture already has the kinds; the engine doesn't compute them yet).
- Per-org trigger configuration (an org turns specific triggers on/off, or tunes thresholds).
- Per-client mute (suppress all alerts for a client temporarily).
- Real-time alerting (webhook on snapshot change) instead of daily batch — only if signal demands it.

---

## 8. References

- `lib/portal/practice/lighthouseDataset.ts` — the fixture this replaces (and which stays as the empty-state preview).
- `lib/portal/practice/professionConfig.ts` — per-profession default trigger sets (`getPracticeProfessionConfig`).
- `lib/cfo/trailStage.ts` — `determineTrailStage` (the sweep uses it to derive the current TRAIL stage for the `TRAIL_ADVANCED` trigger).
- `lib/portal/alerts/sweepRunner.ts` — the shared sweep core (`runPortalAlertSweep`) the cron route and the admin route both call.
- `app/api/conversations/retention-sweep/route.ts` — the cron pattern the cron endpoint mirrors (`CRON_SECRET` + timing-safe + `BLOCKED` audit).
- `app/api/admin/run-seed/route.ts` — the admin-auth pattern `POST /api/admin/portal-alert-sweep` mirrors (`verifyAdminGCPAuth` + `role === 'SUPER_ADMIN'`).
- `docs/blueprint/PHASE_32_ENTERPRISE_PORTAL.md` — Phase 32 status table.
- CLAUDE.md §13.3 (CDR data sanitisation), §13.4 (CRON_SECRET pattern), §12.11 (destructive-write checklist), §12.12 (schema-migration protocol), §16 (doc-sync).
