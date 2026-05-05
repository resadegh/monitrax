# Changelog — 2026-05-06

## Session: claude/phase-32c-pr4c-request-lifecycle (Phase 32C PR4c — ProfessionalRequest lifecycle SHIPPED)

### Changes Made
- **Type:** Feature (Demo-Complete Critical Path; closes Up Next #15; closes the marketplace loop end-to-end)
- **Scope:** D2C user → marketplace listing → compose question → submit → adviser inbox → ACCEPT (lead-fee billing intent recorded + ClientLink materialised) / DECLINE / WITHDRAW. The bridge between Phase 32C PR4a (marketplace listings) + PR4b (AskAProfessional picker) and the engagement consent flow.

### Files Created
- `prisma/migrations/20260506100000_add_professional_request_lifecycle/migration.sql` — additive: 5 new `AuditAction` values + 2 new enums (`RequestStatus`, `LeadFeeTier`) + `professional_requests` table + indexes + FKs (`users`.cascade, `professional_listings`.cascade, `organization_members`.SetNull).
- `lib/services/professionalRequestService.ts` — canonical service (~330 lines). `submitRequest` / `listRequestsForUser` / `listInboxForOrg` / `getRequestForOrg` / `acceptRequest` / `declineRequest` / `withdrawRequest`. Status-transition guards. `classifyNetWorthTier` helper. Typed-codes `ProfessionalRequestServiceError` for `NOT_FOUND` / `FORBIDDEN` / `INVALID_STATUS_TRANSITION` / `LISTING_NOT_AVAILABLE` / `ORG_USER_PUBLIC_BLOCKED` / `INCOMPLETE_INPUT` / `PAYLOAD_TOO_LARGE`. Submit-time lead-fee tier resolution from `getMasterFinancialSnapshot()` (failures fall through to EMERGING). 8KB snapshot-context size cap.
- `app/api/professional-requests/route.ts` — D2C list (GET) + submit (POST). `withPermission('report.read')`.
- `app/api/professional-requests/[id]/route.ts` — D2C withdraw (POST). `withPermission('report.read')`.
- `app/api/portal/professional-requests/route.ts` — adviser inbox list (GET). `withPermission('org.read')` + active-membership check. Status-filterable.
- `app/api/portal/professional-requests/[id]/route.ts` — adviser detail (GET) + accept/decline (POST). OWNER/ADMIN/ADVISOR can respond; VIEWER read-only. Action body: `{ action: 'accept' | 'decline', declineReason?, organizationId }`.
- `components/ask-a-pro/ComposeRequestDialog.tsx` — modal with context-aware AI starter prompts (10 contexts × 1-3 starters each), 20-char min question, opt-in "Share my headline metrics" checkbox, sticky header with title + discipline label, body-scroll lock, Esc to close, prefers-reduced-motion-aware via Tailwind `motion-safe:*`. Submit handler hits `/api/professional-requests` POST; on success, navigates to `/dashboard/requests?just=<id>`.
- `app/marketplace/[slug]/ConnectCta.tsx` — client component for the listing-detail Connect CTA. Opens ComposeRequestDialog. Auth-gate fallback: API 401 → dialog falls through to "Create a free Monitrax account" nudge; org-attached user → `ORG_USER_PUBLIC_BLOCKED` 403 → friendly leaky-funnel guardrail message.
- `app/portal/requests/page.tsx` — adviser inbox. Defaults to SUBMITTED filter with badge count. Status-filter pills (Awaiting / Accepted / Declined / Withdrawn / All). Request cards with requester avatar + question preview + lead-fee tier + amount + context label. Click → drill-in.
- `app/portal/requests/[id]/page.tsx` — adviser detail. Question + requester profile (Monitrax member-since date + shared-metrics indicator) + lead-fee panel + accept/decline action bar. Decline requires ≥5-char reason. Accepted requests surface "Open client view" deeplink to existing Phase 32B drill-in. Read-only for VIEWER.
- `app/dashboard/requests/page.tsx` — user-side tracker. Lists submissions with status pills, decline reason inline if rejected, withdraw action for SUBMITTED, `?just=<id>` highlight after submit.

### Files Modified
- `prisma/schema.prisma` — `AuditAction` enum extended with 5 new values (PROFESSIONAL_REQUEST_SUBMITTED/ACCEPTED/DECLINED/WITHDRAWN/EXPIRED); `User` gained `professionalRequests ProfessionalRequest[]`; `ProfessionalListing` gained `requests ProfessionalRequest[]`; `OrganizationMember` gained `respondedRequests ProfessionalRequest[]`; new `ProfessionalRequest` model + `RequestStatus` + `LeadFeeTier` enums appended at end-of-file.
- `lib/services/index.ts` — re-exports the new request-lifecycle service surface (`submitRequest`, `listRequestsForUser`, `listInboxForOrg`, `getRequestForOrg`, `acceptRequest`, `declineRequest`, `withdrawRequest`, `classifyNetWorthTier`, `ProfessionalRequestServiceError`, types).
- `components/ask-a-pro/AskAProfessionalDialog.tsx` — public-scope listing click now opens `ComposeRequestDialog` instead of bare-navigating to `/marketplace/[slug]`. Picker stays open underneath; on submit, navigates to `/dashboard/requests?just=<id>`. PublicScopeView listing card converted from `<Link>` to `<button onPickListing>`. CTA copy updated from "View →" to "Send a question →".
- `components/ask-a-pro/index.ts` — barrel updated to export `ComposeRequestDialog`.
- `app/marketplace/[slug]/page.tsx` — Connect CTA replaced from inline `<Link>` (signup placeholder) with new `<ConnectCta />` client component.
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #15 marked SHIPPED with full summary; new Recently Completed entry prepended for 2026-05-06.
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` — Step 6c updated: end-to-end demo now runs without verbal bridges (compose dialog ships in this PR).

### Architecture Decisions
- **Lead-fee charge as billing intent, not actual charge.** PR4c records `leadFeeChargedAt` at accept-time. PR6 (Stripe test-mode billing) reads this column and creates the actual Stripe Invoice. CLAUDE.md §0 architect lens: keep the data model honest with payment plumbing as a separate gate. Lets PR4c ship without Stripe wired and lets PR6 ship without re-touching the request lifecycle.
- **Lead-fee tier frozen at submit-time.** The listing's per-tier rate (`leadFeeTierEmerging` / `leadFeeTierGrowing` / `leadFeeTierEstablished`) is read at submit and the resolved amount stored on the request. Downstream tier-rate edits on the listing don't retroactively change in-flight requests. Snapshot failures (brand-new user with no data) fall through to EMERGING — keeps submit unblockable; the adviser sees the actual data on accept anyway.
- **Accept transaction.** Lifecycle transition + `OrganizationClient.upsert` (status=INVITED, consentStatus=PENDING) run in a single `prisma.$transaction` so a half-applied state is impossible. The user is invited through the existing consent flow — the engagement only fully starts once they grant consent. This keeps the consent invariant.
- **Idempotent submit.** Duplicate submit on the same listing returns the existing SUBMITTED request rather than creating a second one. Prevents accidental double-submits from impatient users / unreliable networks.
- **Snapshot-context size cap.** `snapshotContextJson` capped at 8KB at the service boundary. Prevents bloat from arbitrary user-pasted JSON; oversized requests rejected with `PAYLOAD_TOO_LARGE`. At v1 the user opts in to a single `{ shareMetrics: true }` flag; richer per-metric toggles defer to a follow-up.
- **Leaky-funnel guardrail at the service boundary.** Org-attached users (any active+granted OrganizationClient) cannot submit public marketplace requests via this surface — service rejects with `ORG_USER_PUBLIC_BLOCKED`. Mirrors the strategic decision in IMPLEMENTATION_PLAN.md Up Next #15 (2026-05-04): orgs pay for Monitrax to be their CRM + comms channel; the platform must not redirect their clients to competitors.
- **Org-attached path uses the existing connection.** Org-attached users (already have a ClientLink) continue to use the placeholder `/portal-message?memberId=<id>` (PR4d wires the in-app conversation thread). PR4c does NOT introduce a parallel request flow for org-attached users — they go through messaging, not picking a new professional.
- **ZERO new dependencies.** Reused existing patterns; the dialog uses Tailwind `motion-safe:*` utilities instead of pulling framer-motion just for two animations.

### Build Status
- [x] `npx tsc --noEmit` — clean, exit 0.
- [x] `npx next build` — green; all 7 new routes registered (`/api/professional-requests`, `/api/professional-requests/[id]`, `/api/portal/professional-requests`, `/api/portal/professional-requests/[id]`, `/dashboard/requests`, `/portal/requests`, `/portal/requests/[id]`).

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern (new `<ComposeRequestDialog />` + adviser inbox card pattern + user-side request tracker)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [x] strategic decision (lead-fee charge modelled as billing intent at accept; tier frozen at submit; idempotent submit; 8KB snapshot-context cap)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md:Up Next #15` — marked SHIPPED with summary.
- `docs/IMPLEMENTATION_PLAN.md:Recently Completed 2026-05-06` — new entry prepended.
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md:Step 6c` — end-to-end demo path now runs without verbal bridges.
- `docs/changelog/CHANGELOG_2026_05_06.md` — this entry.

### Destructive Write Checklist (CLAUDE.md §12.11)
N/A — migration is purely additive (CREATE TYPE / CREATE TABLE / ALTER TYPE ADD VALUE). No `update`, `upsert`, `delete`, `updateMany`, `deleteMany`, or raw SQL `UPDATE`/`DELETE` on existing rows.

The accept flow does call `prisma.organizationClient.upsert()` — but it's the §12.11 SAFE upsert pattern: the `update` branch is a no-op (`update: {}`), so existing OrganizationClient rows are never mutated by this code path. New rows are created with `status: INVITED, consentStatus: PENDING` (the consent invite path); existing rows are left untouched.

### Schema Migration Checklist (CLAUDE.md §12.12)
- [x] `prisma/schema.prisma` modified
- [x] Matching migration at `prisma/migrations/20260506100000_add_professional_request_lifecycle/migration.sql`
- [x] Migration is purely additive
- [x] `npx prisma validate` clean
- [x] `npx prisma generate` clean

### PR
- Branch: `claude/phase-32c-pr4c-request-lifecycle`
- Status: pending push + open
