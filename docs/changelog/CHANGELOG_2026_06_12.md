# Changelog - 2026-06-12

## Session: serene-goodall-6smazx — Phase 49.14 (confidence bands as list filters + the discrepancy fix)

Reza live-test report (2026-06-12, three parts): (1) transactions in the list LOOK confident
(calm category tones) while the card says nothing high/medium remains; (2) "Review low"
shows DIFFERENT items than the list; (3) wants high/medium/low as filters so each band's
transactions + confirmed status are visible and comparable. Plus the simplicity directive:
*"we need to make sure the solution is simple enough for everyone to understand."*

**Root causes found:**
1. **Pill-tint bug** — the Phase 49.12 `uncertain` check had a `> 0` guard, so rows with
   confidenceScore EXACTLY 0 (the AI-fallback rows written during the Gemini outage) never
   took the rose tint — they wore calm category tones and masqueraded as confident. Fixed:
   `confidenceScore !== null && < 0.9 && !userCorrectedCategory`.
2. **Two populations, one band name** — "Review low" listed TransactionReviewQueue items
   (imports not yet in the books) while the main list holds BOOKED low-score transactions
   (outage-era fallback rows). Different tables → different lists → Reza's discrepancy.

**Fix — the confidence bands are now plain list filters (Stitch-first per §18.2.1; design
deliberately SIMPLIFIED to one list + plain words after Reza's directive — screens
84594a33076847f6909990ceffc08e66 → simplified 05d687e487894fd988a904280f47184a, artefact
`.stitch/designs/phase49.14/confidence-lens-desktop-light.{html,png}`):**
- Three chips — High (emerald) / Medium (amber) / Low (rose) — counts now include
  EVERYTHING in the band (queue + booked) so the chip number matches what clicking shows.
- Clicking a band shows: the "New — confirm to add" card (queue items, plain-English header
  replacing the old clinical blurbs) followed by the band-filtered booked list.
- Every booked row in band mode carries a plain status chip: emerald "✓ Confirmed" vs ghost
  "Not confirmed yet" — and any unconfirmed row gets the one-tap "✓ Looks right" confirm
  (previously only uncertain rows had it).
- NEW `confidence=high|medium|low` filter on GET /api/unified-transactions (high ≥0.9,
  medium 0.7–0.9, low <0.7 incl. score-0 fallback rows; NULL = no AI, excluded).
- `getConfidenceSummary` gains txMedium/txLow (booked rows in those score ranges).

### Files Modified
- `app/api/unified-transactions/route.ts` — confidence band filter param
- `lib/bank/bulkConfirm.ts` — txMedium/txLow in the summary
- `app/dashboard/activity/page.tsx` — band chips ×3 with combined counts, band-lens render
  (queue card + filtered booked list), per-row ✓ Confirmed / Not confirmed chips, pill
  score-0 tint fix, plain-English queue header copy
- `.stitch/designs/phase49.14/confidence-lens-desktop-light.{html,png}` — NEW artefact

### Build Status
- [x] tsc clean (after `prisma generate` for the merged audit-enum values)
- [x] Build passes (`npm run build`)

### §17.2 post-merge verification — PR #1081
- Production deploy `dpl_9LdfsWTs9NUBNAVBoWGcopjsYaQa` reached `READY` after ~3 min.
  Runtime logs clean — only pre-existing DEP0169 noise.

---

## Session: gracious-sagan-42r5le — Admin portal: user detail real data + GCP-enforced suspend + full-portal audit

### Changes Made
- **Type**: Fix + Feature + Cleanup
- **Scope**: Admin portal user management (`/admin/users/[userId]`), Identity Platform admin module, subscription API
- **Root Cause**: The Phase 33 user-detail page shipped as scaffold and was never wired — it rendered a hardcoded `mockUser` ("John Smith") regardless of which user was clicked, and Suspend/Impersonate/Update Subscription were `console.log` stubs. The ADMIN_PORTAL_COMPLETION_PLAN mock-data inventory only listed top-level pages, so the detail page slipped through when the list pages migrated to real data. Separately, "suspension" had no enforcement anywhere: nothing in the consumer app reads `UserSubscription.status`, so even a wired DB flag would have been cosmetic.
- **Solution**:
  1. Rewired `app/admin/users/[userId]/page.tsx` to the existing `GET /api/admin/users/:userId` — real profile, entity counts, subscription, org memberships; loading/error/retry states; mock data and the fabricated activity feed deleted (an honest smaller page beats a fake-rich one); Impersonate button removed (no backend exists — queued for its own design pass).
  2. Suspend/reactivate enforced at the IAM authority per Reza's directive ("portal is used as a UI but IAM and IDM is done through GCP"): new `setIdentityDisabledByEmail()` in `lib/auth/identityPlatformAdmin.ts` (Identity Platform Admin REST `accounts:update {disableUser}`, same WIF impersonation chain + `roles/firebaseauth.admin` grant as the right-to-erasure executor). The subscription PATCH disables/enables the GCP identity FIRST and only then mirrors `UserSubscription.status`; if the identity call fails the route returns 502 and writes nothing. Lockout: sign-in + refresh blocked immediately; already-issued ID tokens expire ≤1h (stateless JWKS verification — deliberately no per-request revocation query, §12.10 + the 2026-05-20 pool incident).
  3. Audit: `USER_SUSPENDED` / `USER_REACTIVATED` actions with the Identity Platform outcome in metadata; 404 added when the target user doesn't exist.
  4. §12.1 dead code: `lib/admin/services/` deleted entirely (8 files — client fetch-wrapper layer with zero importers, calling endpoints that don't exist, e.g. `POST .../suspend`). §12.2: the users list page's local `TIER_MRR` map replaced with canonical `USER_TIER_LIMITS[].monthlyPrice`.

### Full admin portal dummy-data audit (same session, Reza request)
Audited every page under `app/admin/**` against `app/api/admin/**`:
- **REAL (22+ pages):** login/MFA, dashboard, analytics, audit-logs (+compliance/export), billing, users list, organizations list, security, settings, feature flags (incl. create modal), CDR compliance, GCP security-findings / errors / uptime / scheduler, support + support/logs, feedback, marketplace listings (+detail), AI advisor demo, calc-audit. All actions wired to live endpoints.
- **Gaps found (queued in IMPLEMENTATION_PLAN Up Next):**
  - `/admin/organizations/[orgId]` — fully mock ("Acme Accounting", 3 stub handlers, `page.tsx:20-67`); backend GET/PATCH + license routes exist → frontend wiring only.
  - `POST /api/admin/users/[userId]/impersonate` does not exist — `/admin/support/impersonate` calls it and 404s. Needs a design pass (audit/CDR implications) before building.

### Files Modified
- `app/admin/users/[userId]/page.tsx` — full rewrite: mock → real API data + wired suspend/reactivate/tier-change
- `app/admin/users/page.tsx` — local `TIER_MRR` → canonical `USER_TIER_LIMITS`
- `app/api/admin/users/[userId]/subscription/route.ts` — user-existence check (404), IAM-authority-first suspend/reactivate orchestration, richer audit actions
- `lib/auth/identityPlatformAdmin.ts` — `setIdentityDisabledByEmail()` + scope/suspension-semantics header docs
- `lib/admin/index.ts` — header note updated for the services deletion
- `lib/admin/services/*` — DELETED (8 files, orphaned)

### Documentation Updated
- `docs/operational/security/01_AUTHENTICATION.md` — new § User Suspension (Admin Portal)
- `docs/operational/security/02_IAM_AND_PERMISSIONS.md` — `roles/firebaseauth.admin` row + least-privilege custom role now includes `firebaseauth.users.update`
- `docs/blueprint/ADMIN_PORTAL_COMPLETION_PLAN.md` — mock-data inventory corrected + 2026-06-12 re-audit note
- `docs/blueprint/PHASE_33_ADMIN_PORTAL.md` — Phase 33.3 status updated
- `docs/IMPLEMENTATION_PLAN.md` — Recently Completed entry + Up Next row for the remaining gaps

### Build Status
- [x] Build passes (`npm run build`)
- [x] Changed files lint clean (repo lint baseline of 99 pre-existing errors unchanged)
- [ ] Tests — no test suite covers the admin portal pages (pre-existing)

### Destructive writes (§12.11)
- `prisma.userSubscription.upsert` in the subscription PATCH (pre-existing operation, modified in this PR) — see the PR body checklist. No schema change; no migration needed.

### Commit History
| Hash | Message |
|------|---------|
| ecbc5f3 | fix(admin): wire user detail page to real data + GCP-enforced suspend |
