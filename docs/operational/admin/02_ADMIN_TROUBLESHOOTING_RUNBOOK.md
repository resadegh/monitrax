# Admin Portal Troubleshooting Runbook

**Version:** 1.0
**Created:** 2026-04-12
**Audience:** Admin Portal support team
**Purpose:** Fast reference for common issues and resolutions

---

## Quick Navigation

- [Authentication Issues](#authentication-issues)
- [Admin Portal UI Issues](#admin-portal-ui-issues)
- [GCP Integration Issues](#gcp-integration-issues)
- [CDR Compliance Issues](#cdr-compliance-issues)
- [Performance Issues](#performance-issues)
- [Emergency Procedures](#emergency-procedures)

---

## Authentication Issues

### Issue: "No authentication token provided" on admin portal pages

**Symptoms**: All admin pages show error "No authentication token provided"

**Root cause**: Firebase token not being sent with API requests, or AdminLayoutClient not installing fetch interceptor.

**Resolution**:
1. Verify user is logged in (check sidebar footer for user avatar)
2. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
3. Check browser console for Firebase Auth errors
4. If persists: log out and log back in

**Root cause check (developer)**:
- Check `app/admin/AdminLayoutClient.tsx` — verify global fetch interceptor is installed in useState initializer
- Verify `getFirebaseAuth().currentUser` is not null at time of fetch

### Issue: Login fails with "Invalid email or password"

**Checks**:
1. Verify Firebase Auth user exists (Cloud Shell: `node -e "admin.auth().getUserByEmail(...)..."`)
2. Verify the user has `monitraxAdmin: true` custom claim set
3. Alternatively: verify an `AdminUser` row exists with matching email (fallback path)

**Resolution**:
- If user exists but password is unknown: send password reset via Firebase Auth
- If custom claims missing: run the Cloud Shell claim-setting command (see `04_ADMIN_ONBOARDING_TRAINING.md`)
- If `AdminUser` row missing: ask SUPER_ADMIN to add via admin portal Settings

### Issue: Login fails with "Access denied — admin privileges required"

**Root cause**: User authenticated successfully but doesn't have admin access.

**Resolution**:
1. Verify custom claim: `node -e "admin.auth().getUser('<uid>').then(u => console.log(u.customClaims))"`
2. Expected: `{ monitraxAdmin: true, adminRole: 'SUPER_ADMIN' | 'BILLING_ADMIN' | 'SUPPORT_ADMIN' | 'VIEWER' }`
3. If missing, set via Cloud Shell (Firebase Admin SDK)
4. User must log out and log back in to refresh token

### Issue: MFA challenge not appearing

**Checks**:
1. User has MFA enrolled: check Firebase Console → Authentication → Users
2. User's org has `mfaEnforced: true` OR user role is SUPER_ADMIN/BILLING_ADMIN

**Resolution**:
- If user hasn't enrolled: direct them to `/dashboard/settings/security-mfa` on the main app
- MFA enrollment is handled by Firebase Auth and shared across main app + admin portal

### Issue: Logout 404 error

**Root cause**: Old deployment with broken `<Link href="/admin/logout">` logout.

**Resolution**:
- Ensure latest deployment includes the fix (sidebar uses `signOut()` + redirect)
- Hard refresh browser

---

## Admin Portal UI Issues

### Issue: Page shows "Failed to execute 'json' on 'Response': Unexpected end of JSON input"

**Root cause**: API route returned empty body (usually a serverless function crash on Vercel).

**Resolution**:
1. Check Vercel function logs for the specific endpoint
2. Use diagnostic endpoint: `GET /api/admin/gcp/healthcheck` — verifies env var config without loading GCP SDKs
3. Common causes:
   - Missing env var (GCS_SERVICE_ACCOUNT_KEY not set)
   - GCP SDK package crashed during init
   - Route handler threw uncaught error

**Fixed in PR #476**: All GCP API routes now use bulletproof try/catch and return structured JSON even on failure. If you see this error, it means the old deployment is still live.

### Issue: Dashboard shows "Failed to fetch dashboard data"

**Root cause**: Either fetch interceptor not working OR dashboard API crashed.

**Resolution**:
1. Open browser DevTools → Network tab
2. Find the failing `/api/admin/dashboard` request
3. Check response body for actual error
4. If 401: auth token not being sent (see Auth section above)
5. If 500: check Vercel function logs

### Issue: New sidebar sections not appearing

**Root cause**: Cached old deployment.

**Resolution**:
1. Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
2. Clear browser cache for monitrax.com.au
3. Verify latest deployment on Vercel

### Issue: Logout button doesn't work / wrong page

**Resolution**:
- Click the logout icon in the sidebar footer (bottom-right of user card)
- It calls Firebase `signOut()` and redirects to `/admin/login`
- If stuck: manually navigate to `/admin/login`

---

## GCP Integration Issues

### Issue: Uptime / Errors / Scheduler / Security Findings pages show empty or error

**Diagnostic**: Visit `/api/admin/gcp/healthcheck` (requires admin auth)

Expected response:
```json
{
  "success": true,
  "data": {
    "projectId": "monitrax-479700",
    "hasServiceAccountKey": true,
    "serviceAccountEmail": "monitrax-backend@monitrax-479700.iam.gserviceaccount.com",
    "hasOrgId": true,
    "orgId": "451282880218",
    "hasCronSecret": true
  }
}
```

**If fields are missing**:
- `hasServiceAccountKey: false` → Set `GCS_SERVICE_ACCOUNT_KEY` env var on Vercel
- `projectId: null` → Set `GCP_PROJECT_ID` or `GCS_PROJECT_ID` env var
- `hasOrgId: false` → Set `GCP_ORGANIZATION_ID` env var (for SCC)

### Issue: "Cloud Monitoring SDK failed to load"

**Root cause**: `@google-cloud/monitoring` gRPC runtime failure on Vercel.

**Resolution (short-term)**:
- Click "Open in GCP Console" to view data directly in GCP
- Fall back to GCP Console for Cloud Monitoring operations

**Resolution (long-term, developer)**:
- Replace gRPC client with REST API calls via fetch()
- See `lib/gcp/cloudMonitoring.ts` for migration target

### Issue: Cloud Scheduler shows no jobs

**Checks**:
1. Verify `monitrax-backend` service account has `Cloud Scheduler Admin` role
2. Verify `GCP_SCHEDULER_LOCATION` env var (defaults to `australia-southeast1`)
3. Check GCP Console → Cloud Scheduler → should see `monitrax-cdr-lifecycle` job

**Resolution**:
- Add IAM role in GCP Console (see `03_GCP_SERVICE_OPERATIONS.md`)
- Verify the job exists in the correct region

### Issue: Security Findings shows "SCC requires GCP_ORGANIZATION_ID"

**Root cause**: Missing org ID env var or `monitrax-backend` lacks org-level SCC permission.

**Resolution**:
1. Add `GCP_ORGANIZATION_ID = 451282880218` to Vercel env vars
2. At organization level (not project), grant `monitrax-backend@monitrax-479700.iam.gserviceaccount.com` the `Security Center Findings Viewer` role
3. Redeploy

---

## Chat-Mode Issues (Phase 12 Track E Conversational Onboarding)

> Full operator runbook at `docs/operational/runbooks/07_CONVERSATIONAL_ONBOARDING_TOGGLE.md`. The notes below are the most common admin-portal-side troubleshooting paths.

### Issue: User doesn't see the "Chat with Monitrax" toggle on /onboarding

**Cause:** `CONVERSATIONAL_ONBOARDING` feature flag is OFF (the production default).

**Fix:**
1. Navigate to `/admin/feature-flags`.
2. Find `CONVERSATIONAL_ONBOARDING` → toggle "Enabled" ON.
3. Change propagates instantly on the toggling Vercel instance; warm peers pick it up within ≤30s via the in-process TTL.
4. Verify: open `/onboarding` in an incognito window — pill toggle should appear at the top.

If the flag row is missing entirely, run `npm run seed:feature-flags` once (idempotent — adds at `enabled: false` if missing).

### Issue: User sees "Chat-mode is temporarily unavailable" error banner

**Cause:** `ANTHROPIC_API_KEY` not loaded in the deployed Vercel function. Env vars apply to the **next** deployment, not the running one.

**Fix:**
1. Vercel → Project → Settings → Environment Variables → Production → confirm `ANTHROPIC_API_KEY` is present.
2. **Trigger a redeploy** — push a commit to `main` OR click "Redeploy" on the latest production deployment.
3. Verify via the audit log — look for `ONBOARDING_AGENT_EXTRACTION` with `status: FAILURE` + `metadata.reason: ANTHROPIC_NOT_CONFIGURED` (confirms key missing) vs `status: SUCCESS` (confirms key loaded).

### Issue: User hits 429 "Daily chat limit reached"

**Cause:** Per-user 200-extractions/day cap enforced by `/api/onboarding/chat/extract` via audit-log count over rolling 24h. By design — not a bug.

**Fix:** User switches to form-mode for the rest of the day. Cap resets automatically at 24h. Operationally not expected — a full chat walkthrough is ~30-60 turns.

### Issue: Audit log shows ONBOARDING_AGENT_EXTRACTION with status: FAILURE + reason: SCHEMA_VIOLATION

**Cause:** The LLM returned a tool call but the input failed Zod validation — usually a numeric field came back as a string, or an enum value outside the canonical set.

**Fix:** Note the topic + the user's message + open a follow-up ticket. The system prompts have AU-specific normalisation rules; if a pattern keeps tripping, the prompt in `lib/ai/onboarding-agent/tools/extractWizardStepDelta.ts` needs hardening. The chat client treats this as "could not understand the answer; please rephrase" — user retypes.

## CDR Compliance Issues

### Issue: Consent expiry job not running

**Symptoms**: Expired consents not being cleaned up.

**Checks**:
1. Cloud Scheduler job exists: GCP Console → Cloud Scheduler → `monitrax-cdr-lifecycle`
2. Job is ENABLED (not PAUSED)
3. Last run succeeded (check **Last Attempt Time**)
4. `CRON_SECRET` env var is set on Vercel

**Resolution**:
- If job not running: via admin portal **Cloud Scheduler** page → click "Run Now" to test
- If returning 401: verify `CRON_SECRET` matches the one configured in Cloud Scheduler Authorization header
- If returning 500: check Vercel function logs for `/api/cdr/lifecycle`

### Issue: User reports their CDR data wasn't deleted after revoking consent

**Investigation**:
1. **Audit Logs** → filter by userId + `action=CDR_DATA_DELETED`
2. Check if deletion actually ran
3. Check **CDR Compliance** dashboard → user's Basiq connections status
4. If still showing active: run manual deletion via admin API:
   ```
   POST /api/admin/cdr/consent
   Body: { action: 'delete_user_cdr_data', userId: '<id>' }
   ```
5. Document in ticket + audit log

### Issue: CDR complaint needs OAIC escalation

**Procedure**:
1. Complaint detail page
2. Click **Escalate** action
3. Enter OAIC reference ID (obtain from OAIC)
4. Save
5. Complaint status → `ESCALATED`
6. Also document in `docs/policy/CDR_COMPLAINTS_POLICY.md` records

---

## Performance Issues

### Issue: Admin portal page loads slowly

**Checks**:
1. Check GCP Cloud Monitoring uptime check latency
2. Check browser Network tab for slow API calls
3. Common culprits: large DB queries (audit logs, user lists)

**Resolution**:
- Use pagination (limit=50 or less)
- Use date range filters on audit logs
- For audit logs > 90 days old, use Cloud Logging API directly instead of PostgreSQL

### Issue: API 504 Gateway Timeout

**Root cause**: Vercel serverless function exceeded 10s timeout.

**Resolution**:
- Add pagination/date filters to reduce query size
- Split large operations into smaller batches
- For reporting queries: consider moving to a background job or admin-only endpoint

---

## Emergency Procedures

### Admin Portal Fully Down

**Escalation path**:
1. Check Vercel deployment status (dashboard.vercel.com)
2. Check GCP Cloud SQL status (console.cloud.google.com/sql)
3. Check Firebase Auth status (firebase.google.com/status)
4. Rollback latest Vercel deployment if deployment-related

### Data Breach Detected

**Immediate actions** (per `docs/policy/INCIDENT_RESPONSE_PLAN.md`):
1. Isolate affected systems (disable affected user accounts)
2. Preserve logs (Cloud Logging will retain automatically)
3. Notify Director immediately
4. Start incident log with timestamp
5. Follow full incident response procedure

### Suspected Unauthorized Admin Access

1. **Immediate**: Revoke all admin sessions via Firebase Admin SDK
2. **Immediate**: Rotate all admin passwords
3. **Immediate**: Check audit logs for the suspicious admin ID
4. Notify Director
5. Review Cloud Logging for authentication events

**Commands** (Cloud Shell):
```bash
# Revoke all tokens for a user
node -e "admin.auth().revokeRefreshTokens('<uid>').then(() => console.log('Done'))"

# Disable account
node -e "admin.auth().updateUser('<uid>', { disabled: true }).then(() => console.log('Done'))"
```

### Cloud Scheduler Job Failed (CDR Lifecycle)

**Impact**: Expired consents may not be cleaned up on schedule — potential CDR compliance issue.

**Resolution**:
1. Admin Portal → **Cloud Scheduler** → click **Run Now** to trigger manually
2. Check Vercel function logs for `/api/cdr/lifecycle`
3. If `CRON_SECRET` mismatch: regenerate secret on Vercel + update Cloud Scheduler header
4. If persistent failure: escalate to Director

---

## Calculation Audit — Per-User & Trust-Deed Issues

Phase 41i + 41f.4-extension introduce admin-side audit surfaces and a user-facing trust-deed flow. Common support paths:

### Issue: User reports a wrong number ("my net worth is off")

**Resolution**:
1. Open `/admin/calc-audit` → **Audit this user** card.
2. Paste the user's UUID → click button. (~2-5s.)
3. Read the per-engine outcomes:
   - `OK` everywhere → number is mathematically consistent with the user's input data. The discrepancy is between user expectation and the input data, not engine drift.
   - `FINDING (HIGH)` on `core.netWorth` / `core.incomeAggregator` / etc → physical invariant violation; route to engineering.
   - `FINDING (CRITICAL)` on any adapter → identity violation (e.g. `netWorth != assets - liabilities`); page on-call.
4. For full triage steps + UNCOMPUTED ID reference, see [Per-User Audit Runbook](../calc-audit/per-user-audit-runbook.md).

### Issue: Trust-deed extraction failed or extracted poorly

**Symptoms**: User says "my deed didn't extract" or "it shows the wrong beneficiaries".

**Resolution**:
1. Verify the user's entity is `DISCRETIONARY_TRUST` or `UNIT_TRUST` (the flow doesn't show for other types).
2. Ask the user to check the confidence chips on each rule:
   - **≥0.7 (emerald)** = high confidence; safe to confirm.
   - **<0.7 (amber)** = low confidence; review manually before confirming. Each amber rule shows the verbatim deed text underneath.
3. If extraction returned almost no text:
   - Cause: scanned (image-only) PDF — the text extraction surfaces `UC-TRUST-DEED-SCANNED-PDF` when extracted text < 100 chars.
   - Resolution: ask user to OCR the PDF (e.g. macOS Preview "Export as PDF" with text recognition) and re-upload.
4. If Gemini errored entirely (extraction never completes):
   - Check `GEMINI_API_KEY` env var on Vercel (returns 503 `GEMINI_NOT_CONFIGURED` if missing).
   - Check Vercel function logs for `/api/entities/[id]/trust-deed`.
   - Deed PDFs > 25 MB are rejected with `413 PAYLOAD_TOO_LARGE`.
5. To roll back: have user click **Reject** on the trust-deed page → re-upload.

### Issue: QIF import "completes" but no transactions appear (Gemini 429 / quota)

**Symptoms**: User imports a QIF file, dialog reports success, but the account shows zero
transactions. Import API (`POST /api/accounts/[id]/import`) returns HTTP 200.
First seen 2026-06-10 (and the same upstream class caused the 2026-06-01 import-500 incident, PR #959).

**Mechanism**: AI categorisation is an enrichment, not a gate — when Gemini fails, transactions
fall back to confidence 0 → `requiresManual` → `TransactionReviewQueue` instead of becoming
`UnifiedTransaction` rows. Since 2026-06-10 the failure is loud (error-level logs + amber
"action needed" dialog state); before that it was silent.

**Diagnosis**:
1. Pull prod runtime logs for the import window (`./scripts/vercel-logs.sh latest-runtime` or
   the Vercel MCP `get_runtime_logs` with `query`). Look for:
   - `[Gemini] <model> transient failure … 429 Too Many Requests` → **quota** (this issue)
   - `[aiCategorisation] Gemini NOT CONFIGURED` → `GEMINI_API_KEY` missing from Vercel
     Production runtime scope
   - `403` + `referrer`/`API_KEY` → key restriction problem (see Production Readiness item 13
     rollback note in `IMPLEMENTATION_PLAN.md`)
   - `[import] AI categorisation DEGRADED for account …` → confirms transactions were held
   - 429/404 on a project whose GCP quota page shows NO breaches → **suspect model
     retirement FIRST**: check https://ai.google.dev/gemini-api/docs/deprecations against
     the model IDs in `lib/ai/google/modelConfig.ts` + `lib/ai/gemini.ts`
2. The error class decides the fix — do not guess.

**Resolution (429 quota) — first identify WHICH project the runtime key belongs to, then
whether its paid tier is actually enforced:**

> **2026-06-10 FINAL root cause — TWO stacked failures (four theories total; all recorded
> so the next operator doesn't relive the elimination):**
> (1) "Wrong project key" — disproven (Vercel key IS the Tier-1 `…SWHI` key).
> (2) "Billing/tier not enforced" — disproven (billing account active, quota dashboards green).
> (3) **Real failure A — model retirement:** Google shut down `gemini-2.0-flash` on
> 2026-06-01; fallbacks (`…2.5-flash-preview…`, `gemini-1.5-flash`) were retired even
> earlier. Fixed in code (PR #1048: migration to `gemini-3.5-flash` + live fallbacks;
> ⚠ re-verify lineup before the 2026-10-16 retirement of 2.5-flash/2.5-pro).
> (4) **Real failure B — PREPAID BILLING CREDITS DEPLETED.** The Gemini API billing for the
> project is prepay-based; credits hit $0 (~late May 2026) and every billable request was
> rejected with `429 RESOURCE_EXHAUSTED: "Your prepayment credits are depleted."` —
> regardless of tier, rate limits (1,000 RPM, used ~70), model, or key. NO dashboard
> surfaces this: Spend shows $0 (nothing can bill), Rate Limit shows green, quota pages show
> zero breaches. The error text contains neither "quota" nor a metric name, so log
> keyword-searches for quota terms MISS it. Resolution: AI Studio → https://ai.studio/projects
> → project billing → top up prepaid credits or switch to standard postpaid billing.
> See https://ai.google.dev/gemini-api/docs/billing#prepay.

**The definitive diagnostic (use this FIRST for any unexplained Gemini 429):** run one manual
request with the production key — the response body names the real constraint, which the
Vercel log lines truncate away:

```bash
curl -s -w "\nHTTP %{http_code}\n" -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Say OK"}]}]}' \
  "https://generativelanguage.googleapis.com/v1beta/models/<current-flash-model>:generateContent?key=<KEY>"
```

| 429 body says | Meaning | Fix |
|---|---|---|
| `prepayment credits are depleted` | Prepaid balance $0 | Top up / switch to postpaid (AI Studio billing) |
| `Quota exceeded for quota metric …` | Real rate/quota breach | Check Rate Limit page; pace or batch larger |
| (bare / HTML body) | Edge throttling or retired model | Check deprecations page + model IDs in code |

1. Identify the runtime key: Vercel → monitrax → Settings → Environment Variables →
   `GEMINI_API_KEY` → reveal → compare its ending against the key list in
   [Google AI Studio](https://aistudio.google.com) → API Keys (shows project + billing tier
   per key). If it belongs to a free-tier project, swap to a Monitrax-project key (see step 3).
2. If the key is already in the right project but 429s persist at low request rates:
   - **2a. Read the ENFORCED quota** (ground truth, not the AI Studio label): GCP Console →
     project Monitrax → APIs & Services → Generative Language API → **Quotas & System
     Limits** → "generate content requests per minute" per model. ~10–15 = free-tier
     enforcement despite the Tier-1 label; ~2,000 = real Tier 1 (then suspect per-model
     deprecation throttling instead — check the Usage page's 404 bars and the model names in
     `lib/ai/google/modelConfig.ts` for stale/deprecated entries).
   - **2b. Check billing health**: console.cloud.google.com/billing → billing account status
     **Active** + project `monitrax-479700` listed under its Projects tab. Relink if not.
   - **Server keys must have Application restrictions = None** (HTTP-referrer-restricted keys
     reject server-side calls, which send no Referer — shows up as 403s) **and API
     restrictions = Generative Language API only** (GCP Console → Credentials → the key).
3. If swapping keys: update `GEMINI_API_KEY` in Vercel for **Production AND Preview** scopes →
   redeploy (env changes don't apply to running deployments).
4. Verify: trigger any AI surface (or a QIF import), then (a) Vercel runtime logs show
   `[Gemini] Trying model:` with no failures, and (b) AI Studio → Usage for project Monitrax
   shows successful requests.
5. Optional but recommended: AI Studio → Spend → set a monthly spend cap (e.g. A$25 — never
   $0, which blocks all requests). Categorisation traffic costs cents at current scale
   (gemini-2.0-flash: US$0.075/M input tokens).

**User-side recovery**: held transactions sit in `TransactionReviewQueue` (no UI — known tech
debt, IMPLEMENTATION_PLAN 🗑️ row 31). After quota is fixed, the user re-imports the same file:
the file-hash duplicate guard only blocks `COMPLETED` batches (degraded ones are
`AWAITING_REVIEW`) and row-level duplicate detection only checks created transactions, so the
re-import goes through cleanly.

### Issue: AI features silently degraded across the WHOLE app (Gemini outage)

**Canonical incident:** 2026-06-10 (full elimination record in the QIF-import section above
and `docs/changelog/CHANGELOG_2026_06_10.md`). Gemini was down for ~3 weeks (since ~May 21,
when prepaid credits depleted) and ONE surface for ~9 months (cashflow AI summary, pinned to
`gemini-1.5-flash`, retired Sep 2025) — and nobody noticed, because every surface degraded
gracefully: rule-engine advice, uncategorised-but-imported transactions, skipped summaries.
**Graceful degradation without alerting = silent outage.** Treat any ONE Gemini failure as
a possible total outage until proven otherwise.

**Surfaces that go down together when Gemini fails (all share `GEMINI_API_KEY`):**

| Surface | Failure looks like | Fallback that masks it |
|---|---|---|
| QIF/CSV import smart categorisation | Transactions imported uncategorised / held | Amber "action needed" dialog (post-PR #1048) |
| CFO AI advisor (`/dashboard/cfo`) | Generic advice | Rule engine answers instead |
| Document intelligence | Extraction returns nothing | Manual entry path |
| Trust-deed extractor | Extraction fails | Manual entry path |
| Cashflow AI summary | No narrative summary | Section quietly absent |
| Tax-advisor Gemini provider | Provider error | Depends on provider config |

**NOT affected:** Anthropic-powered surfaces (feedback chat — different provider, different
billing) and every non-AI feature.

**5-minute triage (in order):**
1. **The curl test** (see decision table above) — one call with the production key tells you
   the exact failure class from the response body. This is the single fastest discriminator.
2. **AI Studio → Projects page** (`aistudio.google.com/projects`): the Monitrax row's Status
   column shows **"Prepay required"** when credits are depleted. Also check the billing-tier
   column's account suffix (see trap below).
3. **Vercel runtime logs**: `[Gemini] … transient failure` / `exhausted … attempts` lines at
   error level (post-PR #1048 these are loud).

**Resolution — prepaid credit top-up (and the two traps):**
1. AI Studio → Billing (`aistudio.google.com/billing`) → **Credit balance** card → Buy credits
   (min $10) → **Set up auto-reload** (e.g. reload A$10 below A$2) so it can't recur silently.
2. **TRAP 1 — wrong billing account.** The org has MULTIPLE billing accounts. Credits MUST go
   on the account funding the Monitrax project — ID **019237-E9340D-2959FB** (suffix shown on
   the AI Studio Projects page per row: Monitrax = "Account (…59FB)"). On 2026-06-10 the first
   A$25 went to the Default-Gemini-Project account (…008985) and changed nothing. Verify with
   the curl AFTER topping up — payment-successful ≠ right account.
3. **TRAP 2 — billing permissions.** `admin@monitrax.com.au` may lack IAM on the billing
   account ("You don't have sufficient read permissions…" tooltip). Billing-account IAM is
   SEPARATE from project IAM. Grant: GCP Console (as the account owner — the rayanmehr
   personal Google account held admin on 2026-06-10) → Billing → 019237-E9340D-2959FB →
   Account management → Add principal → `admin@monitrax.com.au` → **Billing Account
   Administrator**. Docs: https://docs.cloud.google.com/billing/docs/how-to/grant-access-to-billing
   Alternative used on 2026-06-10: log in to AI Studio AS the owning account and buy there.
4. Postpay ("Switch to postpay") only unlocks at Tier 3 (~$1,000 cumulative + 30 days) — until
   then, auto-reload IS the prevention.

**Prevention (queued in IMPLEMENTATION_PLAN):** daily AI health probe — Cloud Scheduler
(§12.7) makes one tiny Gemini call per day and alerts on failure, turning "down for 3 weeks"
into "down for 1 day, you got an email."

### Issue: User sees `UC-DEED-…` flag on Tax page

**Resolution**: These are validation alerts — the user's annual trustee resolution doesn't match the CONFIRMED deed. They are NOT engine bugs. Walk the user through the alert via [the Tax page help article](../../help/consumer/your-tax-position.md). The CRITICAL one (`UC-DEED-BENEFICIARY-EXCLUDED`) means the resolution is invalid against the deed and may trigger s100A consequences — recommend they engage their tax agent.

### Issue: Audit harness errored

**Resolution**: API returned `500 AUDIT_HARNESS_ERROR`. See [Per-User Audit Runbook → "When the audit itself fails"](../calc-audit/per-user-audit-runbook.md#when-the-audit-itself-fails) for the symptom→cause matrix.

---

## Contact List

| Issue Type | Contact |
|-----------|---------|
| Portal access issues | Director (admin@monitrax.com.au) |
| Billing disputes | Director |
| CDR compliance emergencies | Director |
| Security incidents | Director + follow INCIDENT_RESPONSE_PLAN.md |
| GCP infrastructure | GCP Console Support |
| Basiq integration | support@basiq.io |
| Calc audit findings (CRITICAL severity) | Director + on-call engineer |
| Trust-deed extraction failures | Director + see runbook above |

---

*Last Updated: 2026-05-07 — added Calc Audit + Trust-Deed sections per PR #707 (41-finishers)*
*Review Schedule: Quarterly or after any major incident*
