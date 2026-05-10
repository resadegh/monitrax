# Incident Response — Tabletop Exercise Script

> **Audience:** Director / future incident-response team
> **Cadence:** Annual (per [`docs/policy/INCIDENT_RESPONSE_PLAN.md`](../../policy/INCIDENT_RESPONSE_PLAN.md) §8) — run a fresh scenario each year, rotate through the four below
> **Owner:** Director (Incident Commander)
> **Purpose:** Walk the Incident Response Plan against realistic scenarios *before* a real one forces it. A tabletop is a talk-through, not a live test — nobody touches production. The goal is to find the gaps (a missing contact, an ambiguous step, a tool nobody has installed) while it's cheap.

This script complements — does not replace — the two operational docs it exercises:
- [`runbooks/01_INCIDENT_RESPONSE.md`](01_INCIDENT_RESPONSE.md) — the on-call diagnostic runbook (the *what do I type* doc)
- [`docs/policy/INCIDENT_RESPONSE_PLAN.md`](../../policy/INCIDENT_RESPONSE_PLAN.md) — the IRP (the *what are our obligations* doc: classification, containment, notification, NDB clock)

---

## 1. How to run a tabletop

1. **Pick one scenario** (rotate; don't always pick the comfortable one). Block 60–90 minutes.
2. **Read the scenario aloud** — the "Inject" is what you'd actually see; resist the urge to skip to "I know what this is."
3. **Walk the IRP phases in order** (Identification → Containment → Investigation → Remediation → Notification → Recovery). For each phase, say *out loud* what you would do, which command/runbook step you'd use, and who you'd contact. Write it down.
4. **Hit the decision points.** Each scenario has 2–4 `DECISION:` markers. Make the call, note the reasoning. This is the part that exposes gaps.
5. **Note every "I'm not sure" or "wait, where is…".** Those are the deliverables. A tabletop that found nothing was run too gently.
6. **Fill in the After-Action Report (§7).** File follow-ups in the [IMPLEMENTATION_PLAN](../../IMPLEMENTATION_PLAN.md) if any gap is real (a missing runbook step, an out-of-date contact, a tool not installed).
7. **Log it** in the Exercise Log (§8). Update the IRP's "Last revised" line if the exercise changed anything in it.

> **Rule:** if a scenario reveals that the runbook or IRP is wrong/missing something, the *fix to the doc* ships in the same session as the After-Action Report. The whole point of CLAUDE.md §16 is that operational lessons land in the operational docs immediately.

---

## 2. Scenario 1 — CDR data breach (CRITICAL)

**Theme:** the nightmare case. Tests the NDB clock, Basiq notification, containment under pressure.

### Inject

> It's 09:14 on a Tuesday. You're reviewing `/admin/audit-logs` over coffee and notice a run of `cdr_data.read` actions between 02:30–02:50 last night attributed to an admin account — but you didn't log in at 2am, and there's only one admin account. The IP on those rows is not one you recognise. The anomaly-detection job (`runAnomalyDetection()`) did not fire an alert.

### Walk it

| Phase | What you say out loud / write down |
|---|---|
| **1. Identification** | Confirm it's real, not a clock skew or a cron job (cron jobs use the `CRON_SECRET` path, not an admin session — so an admin-attributed `cdr_data.read` at 2am is genuinely anomalous). Pull the exact rows: `GET /api/admin/audit/export` filtered to 02:00–03:00. Classify: **CRITICAL** (unauthorized access to CDR-protected data). Start the incident log (IRP §6 template) with `Date/time detected: now`. |
| **2. Containment** | Revoke all sessions (Admin → Sessions → Revoke all). Disable the admin account if you can do so without locking yourself out — `DECISION: do you have a break-glass path to re-enable admin access?` If not, that's a finding *right now*. Rotate any credentials reachable from an admin session. **`DECISION:` revoke Basiq consent for all users (`POST /api/cdr/consent { action: 'revoke_all' }`) — yes or no?** Reasoning: it stops further CDR ingress but also breaks every user's bank sync; weigh "breach still active" vs "service degraded for everyone." Default: if you cannot prove the breach is contained, revoke. |
| **3. Investigation** | Determine the attack vector — stolen admin password? leaked session token? Firebase compromise? Check `AdminAuditLog`, Firebase Auth sign-in logs, GCP Cloud Logging. Enumerate exactly which users' CDR data was in the rows that were read. Determine whether data was *exfiltrated* (read ≠ exfiltrated, but assume the worst until you can rule it out). |
| **4. Remediation** | Patch the vector (force password reset + MFA; rotate Firebase service-account keys if implicated; tighten the admin-route guard if it was a guard gap). Deploy via emergency hotfix branch → Vercel preview → main. |
| **5. Notification** | **The NDB clock is now running.** OAIC: within 30 days of becoming aware (sooner if practicable) — NDB statement via the OAIC portal (IRP §5, contact in IRP §7). Basiq: **immediately** — `support@basiq.io`, per accreditation terms. Affected consumers: email, as soon as practicable after the assessment. **`DECISION:` is this a "likely to result in serious harm" breach (→ mandatory NDB) or not?** Walk the test; document the reasoning either way. |
| **6. Recovery & review** | Confirm no residual access. Post-incident review within 7 days. Update controls (e.g. add the missing anomaly-detection rule that *should* have caught a 2am bulk read). Update the IRP if a gap was found. |

### Gaps this scenario commonly surfaces
- No break-glass admin path → you can't disable the compromised account without disabling yourself.
- `runAnomalyDetection()` doesn't actually flag "bulk `cdr_data.read` outside business hours" → add the rule.
- Nobody has the OAIC portal bookmarked / knows the NDB statement fields.
- Unclear who decides the "serious harm" question when the team is one person wearing all hats.

---

## 3. Scenario 2 — Production database unreachable (HIGH — Availability)

**Theme:** the app is down, no breach. Tests the WIF auth-chain triage (IRP §10) and the backup/restore path.

### Inject

> It's 16:40. You get a Cloud Monitoring alert: the `/api/health` uptime check has failed 3 consecutive times. You open the app — every page spins forever; the dashboard never loads. Vercel shows the latest deployment as "Ready" (green). The Cloud SQL console shows `monitrax-db-prod` as `RUNNABLE`. So: instance is up, app deploy is fine, but the app can't talk to the DB.

### Walk it

| Phase | What you say out loud / write down |
|---|---|
| **1. Identification** | Classify: **HIGH (Availability)** — full outage, no data-breach indicators (IRP §3 / §10.2). Start the incident log. The 1-hour availability SLA is now ticking. |
| **2. Investigation-first (this class is diagnosis-led)** | Pull recent Vercel function logs + Cloud Logging. Match the error signature against the IRP §10.3 table: is it `VERCEL_OIDC_TOKEN not set` (#1, layer 1)? `TLS_ALERT_BAD_CERTIFICATE` (#2, layer 4)? `SASL: SCRAM ... client password must be a string` (#3, layer 5)? `28P01 password authentication failed for user "...iam "` with a trailing space (#4)? Or "empty data on first load, self-heals" (#5, cold-start wedge)? **`DECISION:` which layer of the auth chain broke?** Don't guess — the symptoms overlap. |
| **3. Containment / rollback decision** | **`DECISION:` forward-fix or roll back to legacy auth?** The rollback is `USE_CLOUD_SQL_CONNECTOR=false` in Vercel Production env → redeploy → `buildStandardPrisma()` resumes using `DATABASE_URL` (IRP §10.4 step 2; runbook `security/04_WIF_TROUBLESHOOTING.md`). Rule of thumb: if the outage is approaching the 1h SLA and the fix isn't ready, roll back. If the fix is a one-line env-var trim or SA grant and reproducible against `monitrax-db-dev`, forward-fix. |
| **4. Remediation** | Apply the matching runbook step (`04_WIF_TROUBLESHOOTING.md` §3.A–§3.K). If the database itself is corrupt (not just unreachable) — different problem: restore from backup per `database/02_BACKUP_AND_RESTORE.md` (PITR clone to just before the corruption, or last automated backup) and switch `DATABASE_URL` in Secret Manager. **`DECISION:` is this "can't connect" or "connected but data is wrong"?** They have completely different remediations. |
| **5. Notification** | **No NDB notification** — availability failure, not a breach (IRP §10.2). If the outage exceeds ~30 min and you have any paying users, a status note to them is courteous, not legally required. If a vendor is implicated (GCP outage, Vercel outage), note their status page in the incident log. |
| **6. Recovery & review** | Verify end-to-end: `/api/health` green, then load `/dashboard` and confirm SSR data renders — and for the cold-start-wedge mode (#5), force a cold start (`vercel deploy --prod` redeploy or 15 min idle) before declaring victory. Post-incident: if this is a *new* failure mode, append a row to IRP §10.3. |

### Gaps this scenario commonly surfaces
- Operator doesn't know `USE_CLOUD_SQL_CONNECTOR=false` is the rollback lever.
- The IRP §10.3 signature table is out of date (a new failure mode fired that isn't in it).
- No clear "is the data corrupt or just unreachable" decision tree → operator wastes time restoring a backup when a 1-line env fix would have done it.
- `cloud-sql-proxy` / `psql` not installed on the operator's machine → can't even check the DB by hand.

---

## 4. Scenario 3 — Authentication provider outage (HIGH)

**Theme:** users can't sign in. Tests vendor-dependency handling and the "is it us or them" diagnosis.

### Inject

> It's 11:00. Three users email within ten minutes: "I can't log in — it just says something went wrong." You try — sign-in fails for you too. The app shell loads (so Vercel + Cloud SQL are fine) but every authenticated API call returns 401 and the Firebase sign-in popup errors out. `https://status.cloud.google.com` shows a yellow indicator on "Identity Platform" in your region.

### Walk it

| Phase | What you say out loud / write down |
|---|---|
| **1. Identification** | Classify: **HIGH** (major feature broken — all users; no data-breach indicators). Distinguish from a *config* problem: if it broke right after a deploy, suspect `GCP_PROJECT_ID` / Firebase config in Vercel env, not a Google outage. Here the status page + "no recent deploy" point at a genuine GCP Identity Platform incident. Start the incident log. |
| **2. Containment** | If it's a Google outage, there is nothing to *contain* on our side — the failure is fully external and we're already failing closed (no auth → no access, which is the safe direction). If instead it's a token-verification bug on our side (stale public-cert cache after a long-idle deploy), a redeploy may clear it — `DECISION: redeploy now, or wait for Google?` Redeploying is cheap and rules out the our-side hypothesis. |
| **3. Investigation** | Confirm the boundary: Firebase Console → Authentication — can you see the user list at all? Vercel logs — what's the actual token-verification error? GCP status page — scope and ETA. Decide: theirs (wait + communicate) vs ours (fix + deploy). |
| **4. Remediation** | If theirs: nothing to fix; track the GCP incident to resolution. If ours: fix the env var / cert-cache issue, deploy via standard PR (hotfix branch if urgent). |
| **5. Notification** | No NDB (no breach). If the outage is more than ~15–20 min, post a brief "sign-in is temporarily unavailable due to an upstream provider issue — your data is safe, we'll update here" notice. **`DECISION:` what's our user-facing channel for a status notice?** If the answer is "we don't have one," that's the finding. |
| **6. Recovery & review** | Once Google resolves (or our fix lands), confirm sign-in works for a fresh session and an existing session. Post-incident: if there's no status-page mechanism, add "stand up a minimal status page / banner" as a follow-up. Consider whether a longer public-cert cache TTL would have avoided an our-side cert-cache stall. |

### Gaps this scenario commonly surfaces
- No user-facing status channel.
- Operator can't quickly tell "GCP outage" from "our Firebase config broke in the last deploy."
- No documented expectation for how long auth can be down before it's worth a public notice.

---

## 5. Scenario 4 — Runaway cost / resource exhaustion (MEDIUM → HIGH)

**Theme:** not a breach, not strictly an outage — a bill spike or a quota wall. Tests cost-control wiring and the connection-exhaustion playbook.

### Inject

> It's 08:00. You get a GCP budget alert: this month's spend is already at 140% of the monthly budget and it's only the 8th. Drilling in, the spike is on Cloud SQL egress + a sustained jump in `database/postgresql/num_backends` (connection count) that started ~36 hours ago and hasn't come down. The app is *up* but `/dashboard` is noticeably slower. There was a deploy 36 hours ago.

### Walk it

| Phase | What you say out loud / write down |
|---|---|
| **1. Identification** | Classify: **MEDIUM** initially (degraded performance + cost overrun, no data impact) — escalate to **HIGH** if connections approach `max_connections` (then it becomes an imminent outage). Start the incident log. Note the deploy 36h ago as the prime suspect. |
| **2. Containment** | Stop the bleeding: identify and kill leaked idle connections (`02_BACKUP_AND_RESTORE.md` is the wrong doc here — use `database/03_MONITORING_AND_ALERTS.md` §"Connection Count High": `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state='idle' AND query_start < now() - interval '10 minutes';`). **`DECISION:` roll back the 36-hours-ago deploy?** If the connection leak correlates with it (new code path not releasing a Prisma client, a missing `await`, a per-request `new PrismaClient()`), rolling back is the fastest containment — Vercel → Deployments → promote the previous. |
| **3. Investigation** | What changed in that deploy? Look for: a route that constructs its own Prisma client instead of importing the singleton from `lib/db.ts`; an N+1 introduced; a `connection_limit` change in `DATABASE_URL`; a new cron firing too often. Cross-check `cost-control/00_VENDOR_INVENTORY.md` — is the spike on the vendor you'd expect, or somewhere surprising (e.g. Gemini/Anthropic token spend, Maps API, GCS egress)? |
| **4. Remediation** | Fix the leak in code (use the `lib/db.ts` singleton; add the missing `await`; cap the cron). Deploy via standard PR. If the *budget* itself was set too low for current real usage, that's a separate, deliberate decision — bump it in the cost-control doc, don't just silence the alert. |
| **5. Notification** | No external notification. Internal: update `cost-control/00_VENDOR_INVENTORY.md` actuals + `01_BUDGET_ALERTS_SETUP.md` if a threshold changed. |
| **6. Recovery & review** | Confirm `num_backends` returns to baseline and spend trajectory flattens. Post-incident: should there be a *hard* connection cap / PgBouncer? Should the budget alert fire at 80% (warning) before 100%? Add follow-ups. |

### Gaps this scenario commonly surfaces
- Budget alerts only fire at/after 100% (too late) — no early-warning at 80%.
- No quick way to see *which* vendor the spike is on.
- A route somewhere bypasses the `lib/db.ts` singleton (that's both this incident's root cause and a CLAUDE.md §12.2 SSOT violation worth a separate cleanup).
- No documented connection ceiling, so "is 80 connections fine or a problem?" has no reference answer.

---

## 6. Cross-scenario decision reference

| Question that comes up in every scenario | Where the answer lives |
|---|---|
| What severity is this? | IRP §3 (and §3's HIGH-Availability row for auth-chain failures) |
| Does the NDB clock start? | Only if CDR data was (or likely was) accessed by an unauthorized party — IRP §5. Availability/cost/auth-outage incidents: **no**. |
| Who do I notify, and when? | IRP §5 (OAIC ≤30d, Basiq immediately, consumers ASAP after assessment) + §7 (contacts) |
| How do I roll back a bad deploy? | Vercel → Deployments → promote previous (runbook `01_INCIDENT_RESPONSE.md` Scenario 3) |
| How do I roll back the DB auth path? | `USE_CLOUD_SQL_CONNECTOR=false` in Vercel Production env → redeploy (IRP §10.4; runbook `security/04_WIF_TROUBLESHOOTING.md`) |
| How do I restore the database? | `database/02_BACKUP_AND_RESTORE.md` (and `runbooks/06_BACKUP_RESTORE_DRILL.md` if you want to practise first) |
| Where's the incident log template? | IRP §6 |

---

## 7. After-Action Report template

Copy this into the incident folder / changelog after each tabletop:

```markdown
## Tabletop After-Action Report — [date]

- **Scenario run:** 1 (CDR breach) / 2 (DB unreachable) / 3 (auth outage) / 4 (runaway cost)
- **Facilitator / participants:** [names]
- **Duration:** [minutes]

### What went well
- ...

### Gaps found
| # | Gap | Severity | Owner | Follow-up (link to IMPLEMENTATION_PLAN entry) |
|---|-----|----------|-------|-----------------------------------------------|
| 1 | ... | ... | ... | ... |

### Decisions made during the walk-through
- [DECISION point] → [the call] → [reasoning]

### Docs updated as a result
- [path:section] — [what changed]

### Next tabletop: [date] — scenario [n]
```

---

## 8. Exercise Log

| Date | Scenario | Facilitator | Gaps found | Docs updated | Next due |
|---|---|---|---|---|---|
| _(template)_ 2026-06-01 | 2 — DB unreachable | Director | _e.g. "operator didn't know the connector-rollback lever"_ | _e.g. "IRP §10.4 — added rollback lever to the first-response checklist"_ | 2027-06-01 (Scenario 3) |

---

## 9. References

| Document | Purpose |
|---|---|
| [`docs/policy/INCIDENT_RESPONSE_PLAN.md`](../../policy/INCIDENT_RESPONSE_PLAN.md) | The IRP — classification, phases, notification, NDB clock, §10 WIF appendix |
| [`runbooks/01_INCIDENT_RESPONSE.md`](01_INCIDENT_RESPONSE.md) | On-call diagnostic runbook (5 scenarios with diagnosis + resolution steps) |
| [`security/04_WIF_TROUBLESHOOTING.md`](../security/04_WIF_TROUBLESHOOTING.md) | The auth-chain runbook (§3.A–§3.K) referenced by Scenario 2 |
| [`database/02_BACKUP_AND_RESTORE.md`](../database/02_BACKUP_AND_RESTORE.md) | Restore procedure referenced by Scenario 2 |
| [`runbooks/06_BACKUP_RESTORE_DRILL.md`](06_BACKUP_RESTORE_DRILL.md) | Quarterly restore drill (Scenario 2's restore path, practised) |
| [`runbooks/08_OBSERVABILITY_SLOS.md`](08_OBSERVABILITY_SLOS.md) | SLO definitions + alert policies — the alerts that would *detect* Scenarios 2 & 4 |
| [`database/03_MONITORING_AND_ALERTS.md`](../database/03_MONITORING_AND_ALERTS.md) | DB-level metrics + the connection-exhaustion playbook (Scenario 4) |
| [`cost-control/00_VENDOR_INVENTORY.md`](../cost-control/00_VENDOR_INVENTORY.md) | Vendor spend SSOT (Scenario 4) |

---

*Last Updated: 2026-05-10 — created as part of the Phase 0 operational-readiness chunk (backup/restore drill + IRP tabletop + observability SLOs).*
