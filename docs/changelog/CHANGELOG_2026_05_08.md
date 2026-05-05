# Changelog — 2026-05-08

## Session: claude/phase-32c-pr6a-stripe-subscriptions (Phase 32C PR6a — Stripe test-mode subscription wiring SHIPPED)

### Changes Made
- **Type:** Feature (Demo-Complete Critical Path; closes Up Next #18 at demo-complete scope; PR6b will follow with lead-fee invoicing)
- **Scope:** Org subscription tiers wired end-to-end through Stripe Checkout + webhook reconciliation. Studio / Practice self-serve via Stripe; Enterprise sales-led via mailto. Live mode + dunning + lead-fee invoicing defer to PROD / PR6b.

### Files Created
- `prisma/migrations/20260508100000_add_stripe_billing/migration.sql` — additive: 7 new `AuditAction` values + 2 new enums (`SubscriptionStatus`, `BillingPlanTier`) + 3 tables + indexes + FKs.
- `lib/services/stripeBillingService.ts` — canonical service (~390 lines). `getOrCreateCustomer`, `createCheckoutSession`, `constructAndVerifyWebhookEvent`, `handleWebhookEvent` (idempotent dispatch), `mirrorSubscription`, `markSubscriptionCancelled`, `getSubscriptionStatus`, `getCustomerForOrg`, `cancelAtPeriodEnd`, `resumeSubscription`, `isStripeConfigured`. Typed-codes `StripeBillingServiceError`. Lazy Stripe client construction.
- `app/api/portal/billing/route.ts` — GET status (subscription + customer + resolvedPlanTier).
- `app/api/portal/billing/subscribe/route.ts` — POST PORTAL_OWNER-only Stripe Checkout session creation.
- `app/api/portal/billing/cancel/route.ts` — POST cancel-at-period-end.
- `app/api/portal/billing/resume/route.ts` — POST revoke scheduled cancellation.
- `app/api/stripe/webhooks/route.ts` — POST Stripe webhook receiver. NO auth gate (signature verification IS the auth). Reads raw body via `request.text()` BEFORE parsing per Stripe spec.
- `app/portal/billing/page.tsx` — Org-side billing page. Current-plan card + 3 plan tiles + cancel/resume actions + success/cancelled checkout banners + NOT_CONFIGURED notice.

### Files Modified
- `prisma/schema.prisma` — `AuditAction` extended with 7 new values (BILLING_*); reverse relations added on `Organization` (`stripeCustomer`, `stripeSubscription`); 3 new models + 2 new enums appended at end-of-file.
- `lib/services/index.ts` — re-exports the new Stripe service surface.
- `lib/portal/planTier.ts` — appended `resolvePlanTierForOrg(orgId)` async function that reads live StripeSubscription first (TRIALING/ACTIVE/PAST_DUE = entitled, honouring Stripe's 3-day grace window), falls through to legacy `OrganizationPortalSettings.plan` only when no subscription exists.
- `package.json` — added `stripe@22.1.0`.
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #18 marked SHIPPED with summary; new Recently Completed entry prepended for 2026-05-08.
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` — Step 7b populated with subscription flow demo path.

### Architecture Decisions
- **`BillingPlanTier` is a NEW enum** (STUDIO/PRACTICE/ENTERPRISE) rather than renaming the legacy `OrganizationPlan` enum (STARTER/PROFESSIONAL/BUSINESS/ENTERPRISE). Reason: enum rename in Postgres is supported (`ALTER TYPE ... RENAME VALUE`) but BUSINESS has no clean 3-tier target — collapsing into PRACTICE would be a destructive merge requiring §12.11 user-confirmation. The new enum on the new table sidesteps this entirely; the planTier.ts mapping shadow handles the legacy fallback. Legacy enum rename remains queued for a future PR.
- **Period start/end read from Stripe items array** (`item.current_period_start`), not subscription level. Stripe's 2025-09-30 API moved this; the change is forward-compatible — we fall back to subscription-level fields via narrowing cast.
- **Webhook signature verification IS the auth mechanism.** The route has no `withPermission` gate. Raw body via `request.text()` BEFORE parsing per Stripe spec. 4xx on signature mismatch (Stripe retries on 5xx, not 4xx); 5xx on dispatch failure so Stripe retries with backoff.
- **Lazy Stripe client construction.** `isStripeConfigured()` returns false when `STRIPE_SECRET_KEY` is unset; UI renders friendly notice instead of crashing in dev/demo. Live-mode flag mirrored from Stripe onto every customer + subscription so post-Basiq cutover is a single keyspace change.
- **`resolvePlanTierForOrg` is async + Prisma-aware.** Existing sync `mapPlanToTier(legacyPlan)` callers are NOT migrated in this PR — the route-layer switch happens in PR6b alongside lead-fee invoicing to keep scope tight.
- **PORTAL_OWNER-only billing actions.** Mirrors the marketplace-listing-submit anti-poaching guardrail from PR4a. Commercial decisions belong to the Org owner.
- **ZERO new dependencies beyond `stripe` itself.** No `@stripe/stripe-js` — Stripe-hosted Checkout means we don't render Stripe Elements client-side at v1. UI uses existing PracticeGlassCard tokens.

### Build Status
- [x] `npx tsc --noEmit` — clean, exit 0.
- [x] `npx next build` — green; all 6 new routes registered (`/api/portal/billing`, `/api/portal/billing/subscribe`, `/api/portal/billing/cancel`, `/api/portal/billing/resume`, `/api/stripe/webhooks`, `/portal/billing`).

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern (new `/portal/billing` plan-tile pattern with Recommended pill + status pill colour vocabulary)
- [x] application config (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_STUDIO_PRICE_ID`, `STRIPE_PRACTICE_PRICE_ID`, `BILLING_SUCCESS_URL`, `BILLING_CANCEL_URL` env vars introduced)
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [x] security / CDR posture (signature-verified webhook receiver; PORTAL_OWNER-only billing surface; audit row for every webhook event; PROD-deferred hardening list documented)
- [ ] operational procedure
- [x] strategic decision (BillingPlanTier as new enum vs legacy rename; lazy Stripe client; resolvePlanTierForOrg async; PR6b scope split for lead-fee invoicing)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md:Up Next #18` — marked SHIPPED with summary.
- `docs/IMPLEMENTATION_PLAN.md:Recently Completed 2026-05-08` — new entry prepended.
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md:Step 7b` — subscription flow demo path populated.
- `docs/changelog/CHANGELOG_2026_05_08.md` — this entry.

### Destructive Write Checklist (CLAUDE.md §12.11)
N/A — additive migration only (CREATE TYPE / CREATE TABLE / ALTER TYPE ADD VALUE). The webhook handler does call `prisma.stripeSubscription.upsert` on subscription mirroring — but the upsert is the §12.11 SAFE pattern: rows are uniquely keyed by `stripeSubscriptionId` (Stripe's id, not ours), and the update branch only touches columns mirrored from Stripe (status / planTier / period / cancelAtPeriodEnd). No user-entered data is at risk; Stripe is the canonical source.

### Schema Migration Checklist (CLAUDE.md §12.12)
- [x] `prisma/schema.prisma` modified
- [x] Matching migration at `prisma/migrations/20260508100000_add_stripe_billing/migration.sql`
- [x] Migration is purely additive (no `DROP`, no `ALTER ... DROP COLUMN`, no `TRUNCATE`)
- [x] `npx prisma validate` clean
- [x] `npx prisma generate` clean

### PR
- Branch: `claude/phase-32c-pr6a-stripe-subscriptions`
- Status: pending push + open
