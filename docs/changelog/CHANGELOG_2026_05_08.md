# Changelog — 2026-05-08

## Session: claude/review-monitrax-settings-LL4bQ (Settings overhaul — trust-breaking fixes + missing controls)

### Changes Made
- **Type:** Fix + Feature — settings audit follow-through. Closes 12 trust-breaking gaps surfaced by the 2026-05-08 review across consumer / admin / portal settings.
- **Scope:** Consumer `/dashboard/settings/*`, Org Portal `/portal/settings`, two new account-lifecycle endpoints, schema migration adding 9 columns + 5 enum values.

### Trust-breaking fixes (top of list — these were lying to users today)
- **Delete Account** wired end-to-end. Was a `<Button>` with no `onClick`. Now soft-deletes with a 30-day grace period (Privacy Act APP 11.2 + CDR §3.2), audit-logged, cancellable from the same surface.
- **`/api/settings/status`** stopped lying. Was hardcoding `emailEnabled: true` / `pushEnabled: false` / `completeness: 60`. Now reads `UserPreference` notification flags + computes profile completeness from filled fields.
- **Appearance** stopped silently dropping toggles. The previous PUT only persisted currency / dateFormat / country; theme / showCents / compactMode / financialYearStart were dropped. All four now persist via new `UserPreference` columns; `next-themes` syncs to the persisted choice on load.
- **API Keys page** replaced with honest "Coming with Phase 32B" placeholder. Was a pure mock generating UUIDs client-side and pretending they were real keys.
- **Billing page** replaced with honest "Free during early access" placeholder. Was hardcoded "Pro $19.99/mo active" with fake invoices.
- **Storage page** dead `<Switch defaultChecked />` toggles replaced with an honest "what we do today" list. The toggles had no `onCheckedChange` and saved nothing.
- **Categorisation** API surface (Phase 29) finally has a UI. New `/dashboard/settings/categorization` consumes `/api/settings/categorization` — auto-accept threshold, review threshold, learning + reasoning toggles, learning stats card.
- **Bank connections** moved into Settings as a dedicated `/dashboard/settings/connections` page. Reuses existing `/api/basiq/connections` + DELETE endpoint — no new server logic. Disconnecting a bank is a Settings operation now, not buried on `/dashboard/accounts`.
- **Data export (right to portability)** new `GET /api/account/export` returns a JSON document of every row the user owns. New "Download my data" card on the Privacy & CDR page.
- **Trusted contact** new section + `PUT/GET /api/account/trusted-contact`. Optional second-line contact, never auto-shared. Phase 32B advisor handover will read it only with explicit consent.
- **`/portal/settings`** finally exists. Mounts the previously-orphaned `OrganizationSettings` component (333 lines, zero importers) on a real route. Wired to `GET / PATCH /api/portal/organizations/[orgId]`. Sidebar link ungated — every member can see, server enforces `canUpdateOrganization` for writes.

### Settings IA + warm-language pass (CLAUDE.md §14)
- Header renamed `Settings → My Settings`.
- Sidebar regrouped from one flat list into five mental-model groups: **Me / My money data / Privacy & safety / My notifications / My plan**.
- Behavioural-psychology lens (Mani et al. 2013): grouping reduces the cognitive cost of finding the right control. Visual surface unchanged — Phase 39 GlassHero pass queued separately.

### Files Created
- `prisma/migrations/20260513100000_settings_overhaul/migration.sql` — additive: 5 new `AuditAction` values + 4 new `user_preferences` columns + 7 new `users` columns + 1 partial index on `users.deletionScheduledFor`.
- `app/api/account/delete-request/route.ts` — GET / POST / DELETE soft-delete lifecycle.
- `app/api/account/export/route.ts` — GET JSON data export.
- `app/api/account/trusted-contact/route.ts` — GET / PUT trusted-contact CRUD.
- `app/dashboard/settings/categorization/page.tsx` — Phase 29 UI consumer.
- `app/dashboard/settings/connections/page.tsx` — Basiq connections management.
- `app/dashboard/settings/trusted-contact/page.tsx` — Trusted contact form.
- `app/portal/settings/page.tsx` — Mounts `OrganizationSettings`.

### Files Modified
- `prisma/schema.prisma` — `AuditAction` enum +5 values, `User` +7 columns, `UserPreference` +4 columns.
- `app/api/settings/status/route.ts` — read real notification + profile state from `UserPreference` + `User`.
- `app/api/settings/appearance/route.ts` — persist theme / showCents / compactMode / financialYearStart / taxYear.
- `app/dashboard/settings/appearance/page.tsx` — expose Country + Tax year, persist all toggles, sync `next-themes` to the server-side choice.
- `app/dashboard/settings/security/page.tsx` — wired Delete Account flow, deletion-state banner, cancellation.
- `app/dashboard/settings/privacy/page.tsx` — added Download my data card calling `/api/account/export`.
- `app/dashboard/settings/api-keys/page.tsx` — full rewrite as honest placeholder.
- `app/dashboard/settings/billing/page.tsx` — full rewrite as honest placeholder.
- `app/dashboard/settings/storage/page.tsx` — replaced dead toggles with documentation card; removed unused Switch / Label / Separator imports.
- `app/dashboard/settings/layout.tsx` — rename to "My Settings", regroup nav into 5 groups, add new sub-pages.
- `components/portal/layout/PortalSidebar.tsx` — ungate Settings link (page now exists).

### Architecture decisions
- **30-day soft-delete over hard-delete.** Privacy Act APP 11.2 doesn't mandate immediate deletion; the 30-day grace gives users a reversible action without compromising the right. Hard-deletion + CDR purge happens out-of-band on the scheduled date via Cloud Scheduler (queued separately). The route only flips the timer + audit-trails.
- **`/api/account/export` runs synchronously.** Acceptable at current per-user data shape. If a user accumulates years of transactions the document grows past ~50MB, queue this to Cloud Tasks + Cloud Storage signed URL — documented inline in the route file.
- **Trusted contact never auto-shared.** Schema-level field; explicit consent always required to surface it to a Phase 32B advisor. No automated email / nudge on save.
- **Settings IA changed without visual surface change.** Grouping the nav is a behavioural-psychology fix, not a designer fix. The Phase 39 GlassHero repaint of Settings is a separate workstream and shouldn't be bundled.

### CLAUDE.md §12.11 destructive write checklist
Operations in this PR that touch existing rows:
- `app/api/account/delete-request/route.ts:POST` — `prisma.user.update` setting deletionRequestedAt + deletionScheduledFor.
- `app/api/account/delete-request/route.ts:DELETE` — `prisma.user.update` clearing deletionRequestedAt + deletionScheduledFor.
- `app/api/account/trusted-contact/route.ts:PUT` — `prisma.user.update` writing trusted-contact columns.
- `app/api/settings/appearance/route.ts:PUT` — `prisma.userPreference.upsert` writing appearance columns.

For each operation:
1. **`where` clause matches:** every operation uses `{ id: auth.userId }` or `{ userId: auth.userId }` — only the requesting user's own row.
2. **Columns overwritten / rows deleted:** Only fields the user explicitly sent on PUT (gated on `xxx !== undefined`); deletion timer fields on POST/DELETE; trusted-contact fields on PUT (clobbering the user's own previous trusted-contact entry, which is the desired behaviour).
3. **Guard ensuring this only mutates rows I created:** `auth.userId` comes from the verified bearer token, never from the request body. The user can only ever flag their OWN row.

User confirmation: NOT REQUIRED — the user is the data subject mutating their own row. Reza authorised the workstream verbally on 2026-05-08 ("Yes fix them all and give me a PR url to merge").

### CLAUDE.md §12.12 schema-change deploy
- `prisma/schema.prisma` modified.
- Matching migration `prisma/migrations/20260513100000_settings_overhaul/migration.sql` committed in the same PR.
- Migration is purely additive: `ALTER TYPE ADD VALUE` x5 + `ADD COLUMN` x11 + `CREATE INDEX` x1. No DROP / ALTER COLUMN / TRUNCATE.
- Defaults on new NOT NULL columns match the previous hardcoded GET return values so existing rows behave identically (`theme='system'`, `showCents=true`, `compactMode=false`, `financialYearStart='07-01'`).

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [x] visual design system / component pattern — settings IA regrouped + nav warm-language rename
- [ ] application config
- [ ] GCP infrastructure
- [x] identity / auth — account-deletion lifecycle + trusted-contact entity-link
- [ ] deployment / build
- [x] security / CDR posture — right-to-erasure soft-delete, right-to-portability JSON export, audit-action enum extended
- [ ] operational procedure
- [x] strategic decision — Settings IA contract documented as 5-group mental model

Docs updated in this PR:
- `docs/architecture/06_UI_UX_FOUNDATION.md` — appended Settings IA contract (5-group structure, warm-language rule applied).
- `docs/architecture/03_DATA_MODEL.md` — appended User + UserPreference column additions.
- `docs/blueprint/PHASE_19_DOCUMENT_MANAGEMENT.md` — appended note that Settings overhaul shipped trust-breaking fixes; original Phase 19.1 settings catalogue now reflects current reality.
- `docs/IMPLEMENTATION_PLAN.md` — new active-workstream entry + closes 5 dead-code rows + closes Categorization-orphan + portal-settings-orphan opens.
- `docs/changelog/CHANGELOG_2026_05_08.md` — this entry (prepended).

### Build Status
- TypeScript compilation: pending verification before push.
- Vercel preview will run `prisma migrate deploy` against `monitrax-db-dev`; successful preview = green migration.

---

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

---

## Session: claude/improve-mobile-navigation-zKSTw (Phase 14.6 v2 — post-merge polish)

### Changes Made
- **Type:** Fix + Enhancement (UX touchups on top of Phase 14.6 v1).
- **Scope:** Two fixes from user testing of PR #723 + one design tightening.

### Fixes
1. **Active-tab not highlighted on TRAIL pages.** `findActiveMobileTab` was iterating tabs in order and using a plain prefix match — Home's matchRoute `/dashboard` was prefix-matching every dashboard sub-route (e.g. `/dashboard/balances`), so the Home tab was winning the highlight on Track/Reduce/Invest/Guide pages. Fixed by special-casing `/dashboard` as exact-only AND changing the algorithm to longest-prefix-match (so a more-specific matchRoute always beats a shorter one). Off-tab routes (Safety Net, Vault, Reports, Settings) now return `undefined` → no tab is highlighted, which is the correct semantic ("you're in More territory, no primary tab applies").
2. **Sub-tab pill row scrolled with page content.** Made `<SectionTabsRow />` sticky at `top-14` (just below the fixed mobile header) with a frosted Apple-glass background (`bg-background/85 backdrop-blur-xl`) and a hairline divider. Sub-tabs now stay accessible while the user scrolls long pages — a one-tap switch is always available.

### Design Tightening
3. **Active tab now reads unambiguously as active.** The original `bg-{tone}-50` pill background was too subtle against the warm-ivory app theme — slate-100/amber-50/etc. blended into the background. Replaced with: (a) vivid stage-tone text colour (`text-{tone}-600 dark:text-{tone}-400`); (b) bolder font on active label; (c) crisper icon stroke on active (`stroke-[2.25px]` vs `stroke-[1.75px]`); (d) a 3px-tall, 28px-wide stage-tone accent stripe at the top edge of the active tab — Apple-Wallet/Apple-Music style indicator. Inactive tabs stay `text-muted-foreground/80`. Theme tokens unchanged; the change is purely how active state composes the existing tones.

### Files Modified
- `lib/navigation/trailNav.tsx` — `findActiveMobileTab` rewritten with longest-prefix-match + `/dashboard` exact-only special case; returns `MobileTabBarItem | undefined`. `TRAIL_STAGE_TONES` shape changed: dropped `activeBg` + `activeRing`; added `accent` for the stripe colour. `activeText` strengthened to vivid `text-{tone}-600 / dark:text-{tone}-400`.
- `components/shell/MobileTabBar.tsx` — handles `undefined` activeTab; renders the stage-tone top accent stripe on the active tab; uses bolder icon stroke + bolder label on active; drops the bg pill.
- `components/shell/SectionTabsRow.tsx` — sticky `top-14` on mobile with frosted backdrop-blur background + hairline bottom divider.

### Build Status
- [x] `npx tsc --noEmit` clean
- [x] `npm run build` clean

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [x] visual design system / component pattern (active-state treatment refined)
- [ ] application config / GCP / identity / deployment / security / strategic decision

Docs updated:
- `docs/changelog/CHANGELOG_2026_05_08.md` — this entry. (No design-doc rewrite needed — the active-state treatment substitutes one tone-token shape for another within the same canonical primitives; the §12 standard, breakpoint contract, and SSOT files remain accurate.)

---

## Session: claude/phase-14-6-segmented-zKSTw (Phase 14.6 v3 — segmented control sub-tabs)

### Changes Made
- **Type:** UX refinement on top of Phase 14.6 v1 (#723) + v2 polish (#724).
- **Scope:** Replace the scrolling-pill sub-tab pattern with a fixed iOS-style segmented control anchored below the brand header. Reads as a "header control," not as scrolled page content.
- **Why:** Reza testing on phone — even with `sticky top-14`, the pills read as scrolled content rather than as a header. iOS Settings / Apple Music / iOS Stocks all use a segmented control for in-page navigation. Three-to-four children fit cleanly at 100% width with equal-width segments — no horizontal scroll, no truncation, no thinking.

### Files Modified
- `components/shell/SectionTabsRow.tsx` — full rewrite. Now renders a fragment of (1) a fixed `top-14 z-30 h-14` Apple-glass band containing an iOS segmented-control track (`grid auto-cols-fr grid-flow-col`, `rounded-xl bg-muted/50 ring-1`), and (2) an in-flow `h-14 md:hidden` spacer so subsequent content doesn't render under the fixed bar. Active segment uses an elevated white-ish chip (`bg-background shadow-sm ring-1`) with TRAIL stage-tone text via `TRAIL_STAGE_TONES`.
- `docs/architecture/06_UI_UX_FOUNDATION.md` §12 — anatomy diagram updated to show the segmented control band; §12.2 phone layout description rewritten; §12.5 hard rules refined (sub-tab tap target ≥36px; new rule "sub-tab navigation is a fixed segmented control, not scrolling pills"); §12.7 + §12.8 updated to reference segments rather than pills; reviewer-rejection clause refined.

### Architecture Decisions
- **Fixed positioning, not sticky.** `position: sticky` requires no transform/filter ancestors and a tall-enough scroll container — fragile on iOS Safari with the URL-bar reflow. Fixed positioning at `top-14` just *cannot* scroll away.
- **Single cohesive control, not three pills.** Apple's segmented control is the canonical iOS pattern for in-page navigation. Three-to-four equal-width segments fit 100% page width without scroll. If a future section ever needs >4 sub-tabs, the right move is reducing the section, not reaching for a scroll affordance.
- **Stage-tone text on active segment, not stage-tone fill.** The active segment is an elevated white-ish chip (Apple-style); colour identity comes from the text colour (`text-{tone}-600 dark:text-{tone}-400`). Filling the chip with stage colour would feel heavy at this size.
- **In-flow spacer pairs with fixed bar.** Standard pattern — fixed elements are out of flow, so a sibling spacer reserves the same vertical space inside `<main>`. Avoids hard-coding `pt-[7rem]` on `<main>` (which would add dead space on Home where the bar isn't rendered).

### Build Status
- [x] `npx tsc --noEmit -p .` clean
- [x] `npm run lint:financial-surfaces` clean (28 grandfathered, no new)
- [x] `npm run build` clean

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern (sub-tab pattern: pills → segmented control)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [ ] strategic decision

Docs updated in this PR:
- `docs/architecture/06_UI_UX_FOUNDATION.md:§12` — anatomy diagram + sub-tab description + hard rules updated for segmented control.
- `docs/changelog/CHANGELOG_2026_05_08.md` — this entry.

### PR
- Branch: `claude/phase-14-6-segmented-zKSTw` (branched from `claude/phase-14-6-polish-zKSTw` so #724's matcher + active-state fixes carry along).
- Status: pending push.
- Supersedes: PR #724 (when this merges, #724 can be closed).

---

## Session: claude/phase-14-6-anchor-zKSTw (Phase 14.6 v4 — full TRAIL on the bottom bar)

### Changes Made
- **Type:** UX refinement on top of #723 v1 / #724 v2 / #725 v3.
- **Scope:** Promote My Safety Net (Anchor stage) from MoreSheet to a primary tab on the mobile bottom bar. The bar now renders Home + all five TRAIL stages: Home · Track · Reduce · Anchor · Invest · Guide.
- **Why:** Reza directive 2026-05-08 — *"My Safety Net is sitting under the hamburger bar and not like the other pages. Can we add that one to the rest as well so have all TRAIL steps on the main page?"* The earlier 5-tab cap (Apple HIG) hid one of the five TRAIL stages from the bottom bar, breaking the visual symmetry of the journey at the exact moment users need orientation. The desktop sidebar already had Safety Net as a top-level rail entry; mobile now matches.

### Files Modified
- `lib/navigation/trailNav.tsx` — added `anchor` entry to `mobileTabBarItems` between `reduce` and `invest` (preserves TRAIL stage order T → R → A → I → L). `MobileTabBarItem.key` union extended with `'anchor'`. Removed Safety Net from `mobileMoreItems` since it's no longer a More-sheet destination.
- `components/shell/MobileTabBar.tsx` — `grid-cols-5` → `grid-cols-6`.
- `docs/architecture/06_UI_UX_FOUNDATION.md` §12 — anatomy diagram updated to show six tabs; §12.4 stage table includes Anchor row; §12.5 hard rules — replaced the "≤5 (Apple HIG cap is hard)" rule with "the bar size is locked at 6 (Home + 5 TRAIL stages); growing past 6 is forbidden without a TRAIL framework update."
- `docs/blueprint/TRAIL_FRAMEWORK.md` §5 — "TRAIL on Mobile" subsection rewritten: 6 tabs, full T-R-A-I-L visible end-to-end, explicit override of the prior "Anchor folds into MoreSheet" framing.

### Architecture Decisions
- **Web app, not native iOS app.** Apple HIG suggests ≤5 tabs on native iOS tab bars. Monitrax is a web app rendered in Safari — the constraint doesn't bind. The TRAIL framework's integrity (all five stages visible end-to-end) wins over the native ceiling.
- **6 is now the locked bar size.** The TRAIL framework has exactly five stages plus Home; any 7th destination must replace an existing tab (with framework-level justification) or live in MoreSheet. Reviewers must reject any PR that grows the bar past 6 without a `TRAIL_FRAMEWORK.md` update signed off by Reza.
- **TRAIL §5's "Anchor is tracked through Health" framing is preserved.** That sentence describes how Anchor is *computed*, not whether it deserves a destination. The Safety Net page surfaces the Anchor-stage data (Emergency Fund, Bills On Time, Safety Score) and has always existed at `/dashboard/safety-net`. The mobile bar now matches the desktop sidebar's posture toward it.

### Build Status
- [x] `npx tsc --noEmit -p .` clean
- [x] `npm run build` clean

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern (mobile bottom bar grew 5 → 6)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [x] strategic decision (TRAIL_FRAMEWORK §5 mobile interpretation: Anchor is now a primary tab)

Docs updated in this PR:
- `docs/architecture/06_UI_UX_FOUNDATION.md:§12` — anatomy + stage table + hard rules updated for 6-tab bar.
- `docs/blueprint/TRAIL_FRAMEWORK.md:§5` — "TRAIL on Mobile" subsection rewritten.
- `docs/changelog/CHANGELOG_2026_05_08.md` — this entry.

### PR
- Branch: `claude/phase-14-6-anchor-zKSTw` (branched from `claude/phase-14-6-segmented-zKSTw` so #725's work comes along).
- Status: pending push.
- Supersedes: #724 (closed) + #725 (close on merge of this).

---

## Session: claude/phase-14-6-stage-colors-zKSTw (Phase 14.6 v5 — colour psychology applied to TRAIL stages)

### Changes Made
- **Type:** Design-system refinement on top of #723 v1 / #724 v2 / #725 v3 / #735 v4.
- **Scope:** Apply colour psychology to each TRAIL stage so the stage colour carries through icons (active and inactive), the sub-tab segmented control bar background, and the desktop sidebar icon containers. Track changes from slate (emotionally neutral) to sky blue (trust + clarity + awareness — psychology-aligned with the stage's purpose).
- **Why:** Reza directive 2026-05-08 — *"trail steps need to have their own dedicated colour, that also need to reflect on the icons as well. The colour psychology should be used to select the colours and they should be used to remind the user of the stage. Even a hue background colour should be the same as each trail stage."*

### Stage Colour Palette (Colour Psychology Rationale)
- **T — Track: Sky blue** — trust, calm, clarity, no-judgment awareness. Universal "I trust this" colour in fintech (Stripe, Mercury, Wealthfront). Sky specifically: open, visible, nothing hidden. (Was slate — emotionally neutral, didn't carry the awareness semantic.)
- **R — Reduce: Amber** — action, energy, decisive movement. (Unchanged.)
- **A — Anchor: Indigo** — depth, stability, anchored security. (Unchanged.)
- **I — Invest: Emerald** — growth, prosperity, abundance. (Unchanged.)
- **L — Live: Violet** — aspiration, freedom, transcendence. (Unchanged.)

### Files Modified
- `lib/navigation/trailNav.tsx` — `TRAIL_STAGE_TONES` shape extended from `{ activeText, accent }` to `{ activeText, inactiveIcon, accent, bgTint }`. Track switched from slate to sky. Each tone now exposes a muted-icon variant for inactive state and a subtle `bg-{tone}-50/70` tint for stage-specific chrome. Comprehensive JSDoc with the colour psychology table.
- `components/shell/MobileTabBar.tsx` — both icon AND label of TRAIL tabs now use the stage tone at ALL times. Inactive uses `inactiveIcon` (muted hue at 55% opacity); active uses `activeText` (full saturation). Home (no stage) keeps brand-primary fallback.
- `components/shell/SectionTabsRow.tsx` — segmented-control bar background switched from neutral `bg-background/85` to stage-tone `bgTint` (sky-50 on Track, amber-50 on Reduce, etc.). The chrome itself reads as belonging to the stage.
- `components/DashboardLayout.tsx` — desktop sidebar icon container fills with the stage tone when active (`bg-{tone}-500 text-white`); when inactive it shows the muted stage hue (`bg-muted/40 text-{tone}-500/55`). The TRAIL stage badge ([T]/[R]/[A]/[I]/[L]) follows the same pattern. Stage-less items (Home, Household, Vault, Reports) keep brand-primary treatment.
- `docs/architecture/06_UI_UX_FOUNDATION.md` §12.4 — table extended with Hue + colour psychology Why columns; "where the stage colour appears" section added covering all 5 surface points (active icon, inactive icon, accent stripe, sub-tab bar background, sidebar icon container).
- `docs/blueprint/TRAIL_FRAMEWORK.md` §5 — mobile table extended with Hue column; new paragraph documenting the colour-psychology principle and its consistent application across surfaces.

### Architecture Decisions
- **Stage colour shows on inactive icons too**, not just active. Reza directive: "reflect on the icons as well." Inactive carries the stage hue at 55% opacity so the user always sees the stage identity; active pops via full saturation + bolder weight + top accent stripe.
- **Sub-tab bar background takes the active section's stage tint**, not a neutral chrome. Reza directive: "even a hue background colour should be the same as each trail stage." Subtle (50-70% opacity over backdrop-blur) so it reads as belonging to the stage without overpowering — Apple-restraint.
- **Bottom mobile bar background stays neutral.** It contains all 6 stages' icons; tinting the whole bar would force one stage colour to dominate. Each tab carries its own colour via icon + label; the bar chrome stays neutral.
- **Desktop sidebar icon containers fill with stage colour** when active. Stronger treatment than mobile because the sidebar item is larger and the user's eye expects a more pronounced active state at desktop scale.

### Build Status
- [x] `npx tsc --noEmit -p .` clean
- [x] Pending: `npm run build` (next step)

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern (TRAIL stage colour palette + cross-surface application)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [x] strategic decision (Track stage colour: slate → sky for psychology alignment; cross-surface colour identity rule)

Docs updated in this PR:
- `docs/architecture/06_UI_UX_FOUNDATION.md:§12.4` — stage colour palette + psychology table + cross-surface application list.
- `docs/blueprint/TRAIL_FRAMEWORK.md:§5` — mobile table extended with Hue column + cross-surface principle.
- `docs/changelog/CHANGELOG_2026_05_08.md` — this entry.

### PR
- Branch: `claude/phase-14-6-stage-colors-zKSTw` (branched from `claude/phase-14-6-anchor-zKSTw` so #735's 6-tab work comes along).
- Status: pending push.
- Supersedes: #724, #725, #735 (close on merge of this).
