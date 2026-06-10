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
2. The error class decides the fix — do not guess.

**Resolution (429 quota)**:
1. The key lives in GCP project `Monitrax` (org `monitrax.com.au`). Free-tier Gemini quota is
   ~15 requests/min for flash models; one QIF import fires one request per 20 transactions.
2. Upgrade the project to paid-tier Gemini quota: confirm a billing account is linked to the
   project (GCP Console → Billing), then in [Google AI Studio](https://aistudio.google.com) →
   API keys → the key's plan should show **Paid** (if "Free", click Set up Billing / Upgrade
   for that project).
3. Verify: GCP Console → APIs & Services → **Generative Language API** → Quotas — requests/min
   for `gemini-2.0-flash` should be in the thousands, not 15.
4. Optional but recommended: set a billing budget alert (e.g. AU$10/mo) — categorisation
   traffic costs cents at current scale (gemini-2.0-flash: US$0.075/M input tokens).
5. Do NOT rotate the key or touch the 2026-05-19 key restrictions — they are unrelated to 429s.

**User-side recovery**: held transactions sit in `TransactionReviewQueue` (no UI — known tech
debt, IMPLEMENTATION_PLAN 🗑️ row 31). After quota is fixed, the user re-imports the same file:
the file-hash duplicate guard only blocks `COMPLETED` batches (degraded ones are
`AWAITING_REVIEW`) and row-level duplicate detection only checks created transactions, so the
re-import goes through cleanly.

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
