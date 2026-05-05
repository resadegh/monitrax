# Changelog — 2026-05-09 — DEMO-COMPLETE

## Session: claude/phase-32c-demo-complete (PR6b + #33 + #34 SHIPPED — demo-complete state achieved)

### Changes Made
- **Type:** Feature × 3 — bundled demo-complete final ship
- **Scope:** Phase 32C PR6b (lead-fee invoicing) + Pitch fixture seed (#33) + Pitch playbook final pass (#34). Closes the last three critical-path items. **Build is now demo-complete end-to-end.**

### PR6b — Lead-fee invoicing

#### Files Created
- `prisma/migrations/20260509100000_add_lead_fee_invoice/migration.sql` — additive: 5 new columns on `professional_requests` + new `LeadFeeStatus` enum.
- `app/api/portal/billing/invoices/route.ts` — GET org-scoped lead-fee invoice history.

#### Files Modified
- `prisma/schema.prisma` — `ProfessionalRequest` gained `stripeInvoiceId UNIQUE`, `leadFeeStatus`, `leadFeeInvoiceUrl`, `leadFeePaidAt`, `leadFeeFailedAt` columns + new `LeadFeeStatus` enum (PENDING_CREATE / PENDING_PAYMENT / PAID / FAILED / VOIDED).
- `lib/services/stripeBillingService.ts` — extended with `createLeadFeeInvoiceForRequest` (idempotent on `stripeInvoiceId`; falls through to PENDING_CREATE in dev/demo without keys; in PROD creates Stripe InvoiceItem + Invoice, finalises immediately, persists `stripeInvoiceId` + `hosted_invoice_url`); `handleInvoicePaid` + `handleInvoiceFailed` webhook dispatchers (route by `monitrax_request_id` metadata so subscription invoices and lead-fee invoices don't collide); `listLeadFeeInvoicesForOrg` for the billing UI.
- `lib/services/professionalRequestService.ts` — `acceptRequest` now also calls `createLeadFeeInvoiceForRequest` after the conversation auto-create. Same best-effort pattern: failure does NOT roll back accept (billing intent already in `leadFeeChargedAt`); ops can re-run idempotently.
- `lib/services/index.ts` — re-exports `createLeadFeeInvoiceForRequest` + `listLeadFeeInvoicesForOrg`.
- `app/portal/billing/page.tsx` — replaced "PR6b is next" placeholder with `<LeadFeeInvoiceHistory />` component (status pills, AU$ amount, Stripe-hosted invoice URL per row, friendly empty-state).

### #33 — Lighthouse pitch fixture seed

#### Files Created
- `prisma/seed-lighthouse.ts` (~1100 LOC) — idempotent fixture seed.
  - **Smithfield Wealth Advisers** Org + Reza PORTAL_OWNER + APPROVED ProfessionalListing + active Practice StripeSubscription
  - **Sarah Kim** — TRACK stage; 1 property + Sarah Kim Pty Ltd; SUBMITTED request waiting for live-Accept demo
  - **David Mei + Emma Liu** — REDUCE stage; 5 entities + 4 properties + 4 loans (PPR fixed-expiry in 14 days = refinance alert); ACCEPTED request + conversation with 3 sample messages
  - **Olivia Novak** — INVEST stage; 5 entities (Holdings + Discretionary Trust + Unit Trust + SMSF + Personal); 5 properties; the entity-tree moat-screenshot demo
- Idempotent via deterministic IDs (`lh-<archetype>-<entity-type>-<index>`); `--reset` flag for clean re-seeds.

#### Files Modified
- `package.json` — added `npm run seed:lighthouse`.

### #34 — Pitch playbook final pass

#### Files Modified
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` — flipped from SCAFFOLD to DEMO-COMPLETE.
  - Header rewritten with pre-flight check (run seed; open browser windows; verify SUBMITTED + ACTIVE + APPROVED).
  - Step 0 (adviser pain) populated with category playbook + 90-second listening protocol.
  - Step 1 (Practice dashboard) verbatim narration tightened to use seeded fixture data.
  - Step 6c (Connect path) end-to-end (PR4c shipped).
  - Step 7 (conversation thread) end-to-end (PR4d shipped).
  - Step 7b (billing + plan tiers) end-to-end (PR6a/b shipped).
  - Footer flags remaining TO BE WRITTEN markers as explicitly POST-pitch artefacts.

### Architecture Decisions
- **Lead-fee invoice creation hooked into `acceptRequest` AFTER the inner transaction commits** — same best-effort pattern as the conversation auto-create. Failure doesn't roll back accept; the billing intent is already recorded; ops can re-run idempotently. CLAUDE.md §0 architect lens: payment plumbing is a separate gate from lifecycle transitions.
- **Idempotent on `stripeInvoiceId` UNIQUE** — `createLeadFeeInvoiceForRequest` returns the existing invoice id if already set, prevents double-charging on retries.
- **Webhook dispatchers route by metadata, not by id pattern** — `monitrax_request_id` on the InvoiceItem + Invoice metadata is the canonical lookup; subscription invoices don't carry it, so the dispatchers cleanly separate the two paths.
- **Seed uses deterministic IDs + upserts everywhere** — re-runs are safe; demo URLs stay stable across browser sessions; `--reset` cascade-deletes for clean re-seeds when schema shifts.
- **Three-archetype seed scope** — 1 property archetype + 4-entity family + 5-entity HNW. Covers the full TRAIL stage spectrum (TRACK / REDUCE / INVEST) without bloat.
- **Pre-existing engagement state on David, not Sarah** — Sarah's request stays SUBMITTED for the live-Accept demo (the visceral "click Accept and watch the engagement materialise" moment); David's already has conversation depth so Step 7 can demonstrate thread richness without composing live.

### Build Status
- [x] `npx tsc --noEmit` — clean, exit 0.
- [x] `npx next build` — green; new `/api/portal/billing/invoices` route registered (alongside the existing PR6a routes).

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern (`<LeadFeeInvoiceHistory />` component — status pill colour vocabulary)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [x] security / CDR posture (lead-fee invoice creation is best-effort post-transaction with idempotent retry; webhook handlers update `leadFeeStatus` from Stripe events)
- [ ] operational procedure
- [x] strategic decision (PR6 split a/b shipped together; pitch fixture archetype scope; playbook demo-complete vs post-pitch markers)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md:Up Next #18` — PR6 (a + b) marked SHIPPED in full.
- `docs/IMPLEMENTATION_PLAN.md:Up Next #33` — Lighthouse pitch fixture seed marked SHIPPED.
- `docs/IMPLEMENTATION_PLAN.md:Up Next #34` — Pitch playbook final pass marked SHIPPED.
- `docs/IMPLEMENTATION_PLAN.md:Recently Completed 2026-05-09` — DEMO-COMPLETE entry prepended.
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` — flipped to DEMO-COMPLETE state.
- `docs/changelog/CHANGELOG_2026_05_09.md` — this entry.

### Destructive Write Checklist (CLAUDE.md §12.11)
N/A for the migration (additive only — ALTER TABLE ADD COLUMN nullable + CREATE TYPE). The seed script uses upserts everywhere with deterministic IDs; the update branch on every upsert is intentionally minimal (only updates fields that should refresh on re-seed); existing Org/User rows that share the deterministic ID are recognised as the same row and refreshed. The `--reset` flag does cascade-delete (User.delete cascades to all owned rows + Conversation participants + ProfessionalRequest + ClientLink etc.) but the userIds are explicitly the seeded lighthouse-demo users, never live data.

### Schema Migration Checklist (CLAUDE.md §12.12)
- [x] `prisma/schema.prisma` modified
- [x] Matching migration at `prisma/migrations/20260509100000_add_lead_fee_invoice/migration.sql`
- [x] Migration is purely additive (no `DROP`, no `ALTER ... DROP COLUMN`, no `TRUNCATE`, no `ADD COLUMN NOT NULL` without default backfill — all new columns are nullable)
- [x] `npx prisma validate` clean
- [x] `npx prisma generate` clean

### PR
- Branch: `claude/phase-32c-demo-complete`
- Status: pending push + open
