# Changelog — 2026-06-05

## Session: monitoring-alerts-review-jlnHl (cont.) — root-cause the recurring /api/health P0 false-pages

### Type
Operational root-cause + doc correction (no code change). Doc-only PR.

### Symptom
Recurring GCP P0 SMS — `[P0] Monitrax — /api/health uptime check failing`,
`host=monitrax.com.au ... below 0.01` — firing every ~5–7 min during the
2026-06-05 ~21:52 / 22:00 / 22:07 AEST window (and earlier isolated pages).

### Root cause (live-diagnosed, §17.3 discipline)
**The A1 uptime check targets the apex `monitrax.com.au`, which 308-redirects
to the canonical `www.monitrax.com.au`.** The check has a `"healthy"` content
match; it evaluates the `308 "Redirecting..."` body, which does not contain
`"healthy"`, so it records failures and (across 6 regions) flaps → repeated
false P0s.

- **The app is 100% healthy.** Replicating the GCP check (apex host, follow
  redirects) = **30/30 healthy over 60s** *during* the live incident.
  `www.monitrax.com.au/api/health` = `200 {"status":"healthy",...}` on every
  probe. `monitrax.com.au/api/health` (no redirect follow, as the check sees
  it) = `308 "Redirecting..."`.
- **Why it started:** the uptime check was created 2026-05-19 against the apex,
  when the apex served `/api/health` directly. `www` later became canonical
  (Firebase auth-domain work) and the apex began 308-redirecting. The Cloud
  Scheduler jobs were migrated to `www` at that time (IMPLEMENTATION_PLAN
  Observability rows 2–3 — "the apex redirects and turned POST→GET → 405"), but
  the uptime check was missed.
- **PR #976 (health-route retry) is unrelated.** It's harmless but cannot help:
  the apex 308 is an edge-level redirect that never reaches the function.

### Fix (Reza-side — GCP config; hostname of an existing uptime check is NOT editable)
1. GCP Console → Monitoring → Uptime Checks → delete the apex
   `Monitrax API Health Check`.
2. Recreate it against **Hostname `www.monitrax.com.au`**, Path `/api/health`,
   HTTPS/443, contains `"healthy"`, 1-min frequency, all 6 regions.
3. Repoint alert policy **A1**'s condition to the new check (or
   `host=www.monitrax.com.au`).
4. Recommended hardening: bump the A1 trigger to **3 consecutive failures**
   (kills any residual single-probe flap without masking a real >3-min outage).
5. Instant interim relief while doing the above: **snooze A1 for ~1h** (safe —
   the app is verified healthy), then unsnooze once the new check is green.

### Files Modified (docs only)
- `docs/operational/runbooks/03_HEALTH_CHECKS.md` — uptime-check setup now
  targets `www` with a CRITICAL callout explaining the apex-redirect trap.
- `docs/operational/runbooks/08_OBSERVABILITY_SLOS.md` — A1 row corrected to
  `www` host + 3-consecutive-failure trigger.
- `docs/IMPLEMENTATION_PLAN.md` — Observability row 5 annotated with the
  root-cause correction + fix.
- `docs/changelog/CHANGELOG_2026_06_05.md` — this entry.

### Doc-sync (CLAUDE.md §16)
Surfaces changed: [x] operational procedure (new failure mode + corrected
runbook). No code/config/infra/identity/security-posture change in this repo —
the fix is a GCP-console action recorded here for Reza.
Docs updated: `03_HEALTH_CHECKS.md`, `08_OBSERVABILITY_SLOS.md`,
`IMPLEMENTATION_PLAN.md`, this changelog.

### Build status
- N/A — documentation only, no source changed.

### PR
- Branch: `claude/fix-uptime-check-apex-redirect-jlnHl`
- Status: Draft
