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

---

## Session: claude/improve-mobile-navigation-zKSTw (Phase 14.6 — TRAIL-as-IA mobile + iPad navigation)

### Changes Made
- **Type:** Feature + design-system standard (responsive IA refactor; new canonical mobile/iPad standard).
- **Scope:** Replaces hamburger-drawer primary navigation on phones with a 5-tab bottom bar mapped to TRAIL stages, adds a horizontal sub-tab pill row, dedicates iPad portrait to the persistent desktop sidebar (breakpoint `lg:` → `md:`), and codifies the three-tier viewport standard in canonical docs so future sessions reference one source.
- **Why:** User pain point — *"if I want to navigate to Activity, I click My Accounts, land on Accounts page, then need to navigate again and click Activity to land there"* (4 taps from a hidden drawer). Behavioural-psychology + UX-designer lens: financial stress already taxes 13 IQ points (Mani et al. 2013); hidden hamburger nav makes the TRAIL journey invisible at the exact moment users need orientation. Apple/Robinhood/Cash App/Up Bank all use persistent bottom tab bars; hamburger is desktop-secondary nav, not mobile-primary nav.

### Files Created
- `lib/navigation/trailNav.tsx` — SSOT for sidebar nav, mobile tab bar items, more-sheet items, TRAIL stage tone tokens, and active-matching helpers (`findActiveNavItem`, `findActiveMobileTab`, `isNavItemActive`).
- `components/shell/MobileTabBar.tsx` — 5-tab bottom navigation (Home · Track · Reduce · Invest · Guide). Apple-glass surface (warm-ivory, backdrop-blur, 1px ring, soft inner highlight), TRAIL-stage tone on active tab, ≥56px tap targets, iOS safe-area-inset, `motion-safe:` honoured.
- `components/shell/SectionTabsRow.tsx` — horizontal scrollable URL-routed pill row for sub-tabs on phones. Renders only when active section has children. Replaces the sidebar-accordion pattern on mobile so sub-tabs are one tap (not two).
- `components/shell/MoreSheet.tsx` — bottom sheet for overflow nav (Safety Net, Household, Vault, Reports, Settings, Sign out). Reuses §15.3 chrome (Esc to close, body-scroll lock, `motion-safe:` slide-in).

### Files Modified
- `components/DashboardLayout.tsx` — imports nav from new SSOT, deletes inline `reachNavItems` + `settingsNavItem` + `NavChild`/`NavItem` interfaces; sidebar visibility flipped from `lg:` (1024px) to `md:` (768px); hamburger drawer + `sidebarOpen` state deleted; mobile header avatar button now opens `<MoreSheet />`; `<MobileTabBar />` mounted as fixed bottom on phones; `<SectionTabsRow />` mounted at top of `<main>`; main content gets `pb-24 md:pb-8` to clear the tab bar.
- `components/shell/index.ts` — re-exports `MobileTabBar`, `SectionTabsRow`, `MoreSheet`.
- `components/bookkeeping/CashQuickAddButton.tsx` — FAB raised to `bottom-24` on phones (`md:bottom-8` desktop unchanged) so it clears the tab bar; modal sheet bottom inset matched.
- `components/bookkeeping/BulkActionToolbar.tsx` — sticky bar raised to `bottom-[64px]` on phones so users can navigate away from bulk-edit mode without dismissing the toolbar first.
- `docs/architecture/02_DESIGN_PRINCIPLES.md` — §4.4 Responsiveness rewritten as the three-tier standard (phone <md / tablet md-lg / desktop ≥lg) pointing to `06_UI_UX_FOUNDATION.md` §12 as canonical.
- `docs/architecture/06_UI_UX_FOUNDATION.md` — §12 fully rewritten as the canonical mobile + iPad navigation standard (anatomy diagram, 5-tab TRAIL mapping, hard rules, breakpoint matrix, acceptance criteria for "mobile-ready"). Reviewers must reject any new mobile surface that re-rolls the bottom-tab-bar/sub-tab-pill/bottom-sheet pattern instead of importing canonical primitives.
- `docs/blueprint/TRAIL_FRAMEWORK.md` — added "TRAIL on Mobile — The Bottom Bar IS the Journey" subsection under §5 ("the framework is the navigation").
- `docs/IMPLEMENTATION_PLAN.md` — new 🟡 Active Workstream "Phase 14.6"; new ↩️ Reversed Decision row preventing future re-introduction of hamburger primary nav on phones.

### Architecture Decisions
- **Anchor folds into MoreSheet on phones, not into a 6th tab.** Apple HIG caps bottom tabs at 5; TRAIL framework's own §5 already de-prioritises Anchor as a primary destination ("tracked through Financial Health score + Guide recommendations, not a dedicated sidebar section"). The fold makes the framework's hierarchy visible in the IA. iPad + desktop continue to see Safety Net as a top-level rail item — the framework adapts to the surface, not the other way around.
- **`md:` (768px) is the desktop-sidebar gate, not `lg:` (1024px).** iPad portrait (810px) is large enough for a persistent 256px rail with 554px content area. Tablet is now a first-class tier. If dense tables surface cramping issues, mitigation is a collapsed-rail variant (`md`–`lg`), not reverting to phone drawer.
- **Sub-tabs URL-routed, not state-only.** `<SectionTabsRow />` renders `<Link>` per pill so sub-tabs are deep-linkable. Many existing section pages still use Radix `<Tabs>` (state-based) — touch-as-you-go migration to URL routes is queued under the same workstream.
- **Same theme on every tier.** Phone, iPad, desktop all consume the same brand tokens (warm-ivory, brand primary, emerald accents), the same glass tile vocabulary (`MetricTile`, `GlassHero`), and the same motion constants (`appleEase` from `components/shell/motion.ts`). Only the nav chrome rearranges. No mobile-only palette, no tablet-only typography stack.
- **No new APIs, no schema change, no CDR surface change.** Pure IA + presentation. Security & Compliance lens (architect-mode skill #7) cleared the change.
- **Hamburger pattern captured in ↩️ Reversed Decisions** so future sessions structurally cannot re-introduce it without explicit user sign-off.

### Build Status
- [x] `npx tsc --noEmit -p .` clean (only the pre-existing tsconfig `baseUrl` deprecation notice).
- [ ] `npm run build` — pending (next step).
- [ ] `npm run lint` — pending (next step).

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern (new shell primitives in `components/shell/`)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [x] operational procedure (responsiveness standard updated; reviewer enforcement added)
- [x] strategic decision (mobile IA: TRAIL-as-tab-bar; hamburger retired on phones)

Docs updated in this PR:
- `docs/architecture/06_UI_UX_FOUNDATION.md:§12` — new canonical mobile + iPad navigation standard (full rewrite).
- `docs/architecture/02_DESIGN_PRINCIPLES.md:§4.4` — three-tier responsiveness contract.
- `docs/blueprint/TRAIL_FRAMEWORK.md:§5` — added "TRAIL on Mobile" subsection.
- `docs/IMPLEMENTATION_PLAN.md` — new 🟡 Phase 14.6 entry; new ↩️ Reversed Decision row.
- `docs/changelog/CHANGELOG_2026_05_08.md` — this entry.

### PR
- Branch: `claude/improve-mobile-navigation-zKSTw`
- Status: pending push.
