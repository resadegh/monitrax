# Monitrax Implementation Plan

> **This is the live, single source of truth for "what is being worked on, what is queued, what is blocked, what changed recently."**
>
> Every session starts here. Every PR that materially changes a workstream updates this file. If a workstream isn't in this file, it isn't real.
>
> See CLAUDE.md §1 (Session Startup Protocol) and §15 (Implementation Plan Protocol) for the rules that govern this document.

**Last updated:** 2026-05-04 — Reza + Claude (**Phase 36 Phase 2a (PR #601) — inline `LoanDetailDialog` on `/dashboard/balances`.** New `components/loans/LoanDetailDialog.tsx` (~620 lines) extracted from `app/dashboard/loans/page.tsx` mirroring the `AccountDetailDialog` pattern: 6-tab structure (Overview / Property / Offset / Expenses / Strategy / Linked), canonical-SSOT calculations (`calculateEffectivePrincipal`, `calculateLVR`, `toAnnual`), AlertDialog confirm-delete sub-flow. Wired on the legacy loans page (parity replacement of the inline dialog) AND on Balances (new — loan rows now open the dialog instead of navigating away). `LoanFormDialog` also opens in edit mode from the Balances detail dialog via a new `editingLoan` state hook. Phase 2c + 2e were no-ops (already done in Phase 1c / sidebar `matchRoutes`); Phase 2b + 2d remain. Up Next #4 reflowed with sub-phase status. Build green. See CHANGELOG_2026_05_04.md. **Earlier today:** PR #600 — IRP WIF appendix (Up Next #6 — closed) — `docs/policy/INCIDENT_RESPONSE_PLAN.md` §10 (Appendix A) captures the five Phase 9 cutover failure modes; Up Next renumbered 7→12 to 6→11.)

---

## Status legend

| Symbol | Meaning |
|---|---|
| 🟢 | Active and healthy |
| 🟡 | Active, in progress, on track |
| 🔴 | Active, stuck or risk flagged — see notes |
| 🚧 | Blocked, awaiting decision or external dependency |
| 📋 | Queued — agreed, not started |
| ❓ | Idea / open question — not committed |
| 🗑️ | Dead code / tech-debt — pending cleanup |
| ↩️ | Reversed decision — preserved here so we don't re-do it |
| ✅ | Recently completed (rolling 30 days) |

---

## 🟡 Active Workstreams

> Sorted by priority. Top of list = work in flight right now.

### 0. Phase 40 — My Guide AI Financial Advice (CFO page redesign)

- **Status:** 🟡 In flight — PR 1 (this PR) ships scenario engine + AI advisor service + API endpoints + page redesign + Tax fold-in
- **Started:** 2026-05-02
- **Owner:** Reza (vision/sign-off) + Claude (code)
- **Last touched:** 2026-05-02
- **Why this matters:** The current `/dashboard/cfo` "Prioritised Actions" tabs are deterministic rule-engine output — a long list of disconnected nudges with no narrative, no scenario projection, no follow-up affordance. Reza's brief: replace it with a real **AI-generated financial advice section** that diagnoses the user's situation, prioritises a way forward, and lets the user explore "what-if" (e.g. *"this property is way negative — what happens to my numbers if I sell it?"*) with concrete deterministic projections. Highest-leverage TRAIL Live-stage surface — closes the gap between Monitrax-the-tracker and Monitrax-the-CFO.

**Hard constraints (non-negotiable):**
- **Zero hallucinated numbers.** AI may *narrate* numbers, never *invent* them. Every figure shown to the user comes from `getMasterFinancialSnapshot()` (canonical) or the deterministic scenario engine. Gemini calls scenarios via function/tool calling — server runs the math, AI narrates the deltas.
- **CDR sanitisation before AI call.** No account numbers, BSBs, transaction-level descriptions, or payee names sent to Gemini. Aggregates only. Per CLAUDE.md §13.3.
- **Existing rule engine retained as deterministic safety net.** `lib/cfo/actionEngine.ts` keeps running — its output is fed into the AI as ground truth and used as fallback if Gemini fails.
- **No calc engine duplication.** Scenarios compose existing primitives where possible; new pure-function scenarios live under `lib/cfo/scenarios/` with single responsibility per file.
- **24h cache** on advice generation (Pro model is expensive — ~AU$0.05–0.15 per advice doc — and snapshots don't change minute-to-minute).
- **Design language** matches Phase 39 (Wealth) + Phase 37 (Budget) — glassmorphic 28px cards, sky/indigo Stage I atmosphere, framer-motion v12 appleEase, full `prefers-reduced-motion`.

**Phases (this PR ships 1–6 + 8):**
- [x] 1 — **Scenario engine.** `lib/cfo/scenarios/` — pure functions: `sellProperty`, `payDownLoan`, `refinanceLoan`, `redirectToOffset`, `cutSpendCategory`, `addInvestment`. Each takes `{ snapshot, params }` and returns `ScenarioResult` (cashflow delta, net worth delta, tax delta, health score delta, narrative-friendly explanation). Composes existing `lib/utils/calculations.ts` primitives.
- [x] 2 — **AI advisor service.** `lib/cfo/aiAdvisor.ts` — orchestrator: fetch snapshot, run rule engine, sanitise into AI-safe context document, call Gemini Pro with strict system prompt + tool definitions, validate every quoted number against snapshot, return structured `AIAdviceDocument`. **Stability rule** added 2026-05-02 per Reza: while a non-expired advice doc exists for the user, return it as-is regardless of fingerprint drift — avoids the surface flickering when transactions get imported. The advice changes only on (a) 24h TTL expiry or (b) explicit user "Refresh" click.
- [x] 3 — **API endpoints.** `POST /api/cfo/advice` (generate or return cached, 24h TTL), `POST /api/cfo/advice/chat` (follow-up Q&A scoped to the advice doc, persisted), `POST /api/cfo/scenarios/run` (run a deterministic scenario, return result with delta projections).
- [x] 4 — **Persistence (Prisma).** New models `AIAdviceDocument` + `AIAdviceChatMessage` with matching migration `prisma/migrations/20260502120000_add_ai_advice_phase_40/migration.sql` (additive — CREATE TABLE only, §12.11 N/A).
- [x] 5 — **UI components.** `components/cfo/AdviceHero.tsx` (glassmorphic stage-aware atmosphere — palette shifts with TRAIL stage, sky/indigo for Invest, sunrise amber for Live, etc.), `AdviceRecommendationCard.tsx` (per-recommendation card with Run-Scenario button + Ask-Follow-Up affordance + inline scenario projection), `AdviceChatThread.tsx` (slide-in side drawer for Q&A), `AIAdviceSection.tsx` (orchestrator owning the data lifecycle).
- [x] 6 — **Page redesign.** `/dashboard/cfo` re-wired: `<AIAdviceSection />` inserted at the TOP as the highlight surface; existing Health Hero + Quick Stats + Insight Tiles + Risk Radar all preserved BELOW as supporting context (per Reza's "keep existing data, this section is amended actions" direction). Old "Prioritised Actions" tabs removed — their findings now feed into the AI advisor as ground truth and surface as recommendations.
- [ ] 7 — **DEFERRED.** Tax fold-in (closes Up Next #9). Defer to a follow-up PR per Phase 37 precedent ("Standalone routes preserved" — `/dashboard/income`, `/dashboard/expenses`, `/dashboard/budget-analysis` are unchanged, full CRUD intact). The cfo page already surfaces the headline tax data via the existing `TaxInsights` tile; the AI advisor naturally references tax data and recommends tax actions. The deeper `/dashboard/tax` route stays alive as a deep-link destination. Re-queued under Up Next #9 with a sharper trigger: "after Phase 40 stabilises, evaluate whether the AI advice surface has made the standalone tax route redundant."
- [x] 8 — **Audit logging.** New action codes `AI_ADVICE_GENERATED`, `AI_ADVICE_CHAT`, `CFO_SCENARIO_RUN`. CDR-safe metadata only via `sanitizeCdrMetadata()` — no balances, no transaction text, no payee names.

**Risk:** Medium. New surface, new persistence (Prisma migration). Mitigations: (a) feature is additive — old action engine keeps running and feeds AI as ground truth; (b) advice generation falls back to deterministic action list if Gemini fails; (c) 24h cache caps Gemini cost; (d) scenario engine is pure functions, fully testable; (e) all CDR sanitisation centralised through one helper before the Gemini call.

**Blocking:** None.

**Supersedes:** Up Next #9 (My Guide simplification + Tax → Actions consolidation). The Tax fold-in is delivered as Phase 40 Phase 7 instead of as a separate session — bundling avoids re-touching the same surface twice. Closes the workstream queued there.

**Closes tech-debt:** #11 (`lib/cfo/trailStage.ts`) — Phase 17 placeholder is now wired up and used by the AI advisor for stage-aware prompt context.

---

### 1. Step 1a — DB authentication via Workload Identity Federation (WIF)

- **Status:** 🟢 **Phase 9 COMPLETE 2026-05-01** — Production now serving 100% of traffic via WIF + Cloud SQL Connector + IAM DB auth. Phase 10 (remove `0.0.0.0/0`) queued for +24h after stability is observed; Phase 11 (remove fallback path) queued for +30d.
- **Started:** 2026-04-30
- **Owner:** Reza (GCP/Vercel ops) + Claude (code)
- **Last touched:** 2026-05-01 (late night) — Cold-start hardening: `getOrInitConnectorClient()` now `.catch`-clears `globalForPrisma.prismaInitPromise` on rejection so a transient init failure (SQL Admin API jitter / STS throttle on cold start) doesn't wedge every subsequent query on the warm function instance for 5-15 min. Surfaced after Phase 9 cutover as "first navigation to a page shows empty data; navigating away and back works" because Vercel routed the retry to a different (healthy) instance. Documented in runbook §3.K. Earlier today: Phase 9 cutover landed via PRs #563 + #564; full doc sync (CLAUDE.md §13.6, CDR matrix §3.2, CDR WIF evidence §7, infrastructure §5.5, MASTER_BLUEPRINT identity stack, Cloud SQL ops, migration appendix, IMPLEMENTATION_PLAN, CHANGELOG_2026_05_01).
- **Why this matters:** Closed CDR `§3.2` DB-tier compliance gap (no long-lived password in env vars; full GCP audit trail under the SA principal; instance auth surface restricted to authenticated IAM identities). Implements CLAUDE.md `§13.6` (production DB accessible only via GCP IAM). Eliminates the long-lived password-in-URL fragility that broke prod on 2026-04-30.

**Phases:**
- [x] 1 — Service account `vercel-monitrax-db@monitrax-479700.iam.gserviceaccount.com` with `Cloud SQL Client` + `Cloud SQL Instance User` roles
- [x] 2 — Cloud SQL IAM user added to `monitrax-db-prod`
- [x] 3 — Postgres grants on `public` schema (CONNECT, USAGE, ALL on tables/sequences, default privileges)
- [x] 4 — Workload Identity Pool `vercel-pool` created in GCP
- [x] 5 — OIDC provider `vercel-oidc` configured with attribute condition `project_id == 'prj_UYQF...'`
- [x] 6 — WIF principal bound to service account (`roles/iam.workloadIdentityUser`)
- [x] 7 — Vercel env vars added (`GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT_EMAIL`, `CLOUD_SQL_CONNECTION_NAME`, `USE_CLOUD_SQL_CONNECTOR=false`); Vercel OIDC enabled at project level
- [x] 8 — **Code PR shipped** — `lib/db.ts` refactor with feature-flag branch + `prisma/schema.prisma` `previewFeatures = ["driverAdapters"]` + new packages (`@google-cloud/cloud-sql-connector`, `@prisma/adapter-pg@^5.22.0`, `pg`) + 6 doc updates + 3 new docs (see CHANGELOG_2026_04_30.md). Build green; default flag `false` so merge is zero-risk.
- [x] 9 — **COMPLETE 2026-05-01.** Production cutover to `USE_CLOUD_SQL_CONNECTOR=true` with full IAM DB auth chain working end-to-end. The cutover surfaced four issues, all resolved within the day:
  1. **OIDC token retrieval (PR #563)** — Vercel delivers the OIDC token as the per-request `x-vercel-oidc-token` HTTP header, NOT as `process.env.VERCEL_OIDC_TOKEN` (that env var only exists at build time / in `vercel env pull` output). Switched to `getVercelOidcToken()` from `@vercel/oidc` and added a Proxy-based lazy init so the auth chain runs inside a request context instead of at module load.
  2. **mTLS handshake / TLS alert 42 (PR #564 + GCP-side fix)** — Server rejected the ephemeral client cert at handshake. Root cause: the SA was never registered as a Cloud IAM **database** user on the instance (Phase 1 had been ✅-ticked but the per-instance `gcloud sql users create ... --type=CLOUD_IAM_SERVICE_ACCOUNT` step was missed). Fixed by creating the user + running `public`-schema GRANTs from Cloud SQL Studio as `monitrax_user`. Documented in `04_WIF_TROUBLESHOOTING.md` §3.G.
  3. **SCRAM no-password / SASL error (PR #564)** — The Cloud SQL Connector wraps the TLS socket but does NOT inject a Postgres-level password. In IAM-auth mode the password pg must send is the SA's OAuth access token; the application has to supply it. Added `password: async () => authClient.getAccessToken()` callback to `pg.Pool` in `buildConnectorPrisma()` so pg fetches a fresh token per connection. Documented in §3.H.
  4. **28P01 / trailing whitespace on `CLOUD_SQL_DB_USER` (PR #564)** — Vercel env var had a trailing space from a copy-paste. Postgres treats `...iam` and `...iam ` as different identifiers. Vercel env var corrected; defensive `.trim()` added on all WIF env-var reads in `lib/db.ts`. Documented in §3.J.
  Pro plan + region pinning to `syd1` confirmed. Separate observation: `/api/health` still routes via Edge → `iad1` despite `vercel.json` `regions: ["syd1"]` (non-blocking; revisit during Phase 10).
- [x] 10 — **CLOSED 2026-05-01 via "Option D" — IAM compensating control documented; `0.0.0.0/0` retained intentionally.** Re-evaluation discovered that removing `0.0.0.0/0` is not as simple as the original plan implied: Cloud SQL Connector with public IP still requires the source IP to be in authorized networks (the connector provides cert-based mTLS *over* the TCP layer the ACL gate-keeps; it does not bypass the ACL). Vercel does not publish a stable egress IP range to whitelist (per Vercel docs); the only stable path is the paid Vercel Static IP add-on (~AU$30-50/mo). Decision: at zero users, the marginal security improvement vs the operational/financial cost is not justified. Without a static credential, the network ACL is no longer protecting anything an attacker could exploit — IAM auth is the controlling boundary. Documented in `CDR_WIF_AUTHENTICATION_EVIDENCE.md` §8 with the explicit migration path to Vercel Static IP + restricted networks when triggered (first paying user / pre-Basiq submission / anomalous connection attempts). Optional one-time annotation: rename the authorized-network entry label to `public-iam-protected-cdr-3.2-doc` so the GCP console makes the intent visible to future operators / auditors.
- [ ] 11 — **Queued for +30d (target ≥ 2026-05-31).** Drop the legacy `buildStandardPrisma()` branch from `lib/db.ts`; remove `DATABASE_URL` from the Vercel **runtime** env scope (keep in **build** env scope so `prisma migrate deploy` keeps working); disable / drop the `monitrax_user` Postgres user.

**Risk:** Low. Feature flag default is `false`, so merging the PR is zero-risk — production keeps using `DATABASE_URL` until the flag is flipped. `DATABASE_URL` stays as fallback through Phase 9.

**Blocking:** None.

**Docs to update on completion (Phase 8):**
- `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md` §3.2 PARTIAL → DONE; mark P1 Auth Proxy item SUPERSEDED
- `docs/architecture/09_INFRASTRUCTURE_AND_DEPLOYMENT.md` §5 — describe WIF + Connector flow
- `docs/blueprint/MASTER_BLUEPRINT.md` line 116 — correct stale "Render" reference; add WIF to identity stack
- `docs/migration/MIGRATION_RENDER_TO_GCP_STEPS.md` — mark legacy; add WIF appendix
- `docs/operational/database/01_CLOUD_SQL_OPERATIONS.md` — deprecate password examples
- `CLAUDE.md` §13.6 — mark IAM-based DB access as implemented
- `prisma/schema.prisma` — add doc comment on `datasource` block

**New docs to create (Phase 8):**
- `docs/operational/security/04_WIF_TROUBLESHOOTING.md` — runbook for token failures, OIDC issuer changes, binding rotation
- `docs/compliance/CDR_WIF_AUTHENTICATION_EVIDENCE.md` — evidence pack for Basiq accreditation (architecture diagram, token flow)
- `docs/changelog/CHANGELOG_2026_04_30.md` — full session entry

---

### 2. Phase 36 — Accounts/Loans page retirement

- **Status:** 🟡 Phase 1c shipped, Phase 2 queued for after WIF lands
- **Started:** 2026-04-29
- **Owner:** Reza (testing) + Claude (code)
- **Last touched:** 2026-04-30 — PR #558 (transient 401 retry on Balances) merged

**Sub-phases:**
- [x] 1 — Inline `AccountDetailDialog` on Balances (PR #552)
- [x] 1b — Inline create/edit form dialogs for accounts and loans (PRs #553/554)
- [x] 1c — `Connect Bank` toolbar button + 2-tile source picker (Import / Manual) for `+ Account` and `+ Loan` (PR #555)
- [x] 1d — Account delete in detail dialog + retry on intermittent 401/5xx (PRs #556, #558)
- [x] 2.0 — **Repoint non-Basiq references** (Home TRAIL banner, `LinkedDataPanel`, `ModuleHealthBlock`, CFO `router.push`, `learnMoreUrl` in cashflow intelligence) from `/dashboard/accounts` → `/dashboard/balances`. Basiq `?action=connect-basiq` / `?action=add` hrefs deliberately untouched (still depend on legacy page; tracked under 2b). Bundled with the home TRAIL banner redesign.
- [ ] 2a — Inline `LoanDetailDialog` on Balances (replaces PR #550's `?focus=` redirect)
- [ ] 2b — Migrate Connect Bank sync/disconnect UI to Balances (currently lives only on `/dashboard/accounts`); once shipped, repoint the remaining `?action=connect-basiq` / `?action=add` hrefs in `BasiqHeroCard`, `DashboardEmptyStateGrid`, `SetupNextActionPanel`
- [ ] 2c — Migrate `TransactionImportDialog`'s `TransactionReviewPanel` flow off the legacy page
- [ ] 2d — Redirect `/dashboard/accounts` and `/dashboard/loans` → `/dashboard/balances`
- [ ] 2e — Sidebar cleanup if any legacy entries still point at old pages

**Risk:** Medium. Phase 2 touches Basiq sync UI which has more state and side effects than the create/edit dialogs.

**Blocking:** Awaiting user testing of Phase 1c/1d in production. **Unblocked 2026-05-01** — WIF Phase 9 cutover is complete and Production DB auth is stable, so Phase 36 Phase 2 can resume next.

**Why this was paused:** WIF (workstream 1) was the higher-priority hardening. With Phase 9 now landed, we can ship the remaining UX migration into a stable, IAM-authenticated DB.

---

### 3. Phase 37 — My Budget IA simplification + premium redesign

- **Status:** 🟢 **PRs 1-5 SHIPPED 2026-05-01** — final 3-tab IA active; new `/dashboard/plan` hub live; Cashflow + Debt Freedom heroes uplifted to TRAIL banner v3 design language. PR 6 (Tax under My Guide) shipped as part of PR 1's sidebar move; PR 7 (telemetry + soft-retire of legacy routes) deferred — see Up Next.
- **Started:** 2026-05-01
- **Owner:** Reza (vision/sign-off) + Claude (code)
- **Last touched:** 2026-05-01 — Mega-PR shipped on `claude/phase-37-full-uplift` (single PR per Reza's request) bundling PRs 1-5 + 6. **Hard constraint honoured: zero calc engines touched, zero APIs touched, zero data sources duplicated.** Every number on every screen sourced from its existing canonical engine.
- **Why this matters:** Eliminated 6-tab decision paralysis in REDUCE stage; default landing now answers "am I OK this month?" (`/cashflow`) instead of opening a "Generate Budget Analysis" config CTA; tax-optimisation strategically aligned to LIVE stage under My Guide; warm-sentence behavioural framing applied to Cashflow + Debt Freedom heroes; new `/dashboard/plan` hub gives users a single, glanceable financial intent surface.

**Phases:**
- [x] 1 — **Sidebar IA.** `components/DashboardLayout.tsx`. My Budget = Cashflow / My Plan / Debt Freedom (3 tabs final). Default landing → `/cashflow`. Tax relocated to My Guide alongside Actions + Health. Existing routes preserved (deep-link compatibility).
- [x] 2 — **Cashflow uplift.** Replaced plain title block with `CashflowHero` glassmorphic banner (rounded-[28px], backdrop-blur-xl, animated mesh gradient that shifts colour with surplus/shortfall sign, framer-motion fade-up sequenced with appleEase 1.4s, full prefers-reduced-motion). Warm-sentence headline ("You're $312 ahead this month — keep going" / "You're $140 short this month — let's find it together"). Same `/api/cashflow/intelligence` endpoint — zero calc changes. Refresh button restyled as glass pill.
- [x] 3 — **New `/dashboard/plan` hub.** Apple-style segmented control (Money In / Money Out / Your Budget) with sliding selection pill (`layoutId` shared between segments) and AnimatePresence cross-fades (blur-in/blur-out, 0.45s). Hero glass card with morphing "$X in · $Y out · $Z surplus/shortfall" sentence. Each section shows a CONDENSED summary (top 5 income sources, top 6 spending categories with animated horizontal bars, 3 budget cards) and a "Manage all →" deep-link to the existing detail page. All data from existing APIs (`/api/cashflow/intelligence`, `/api/income`, `/api/expenses`, `/api/budget-analysis/latest`) called in parallel via `Promise.allSettled`.
- [x] 4 — **Standalone routes preserved.** `/dashboard/income`, `/dashboard/expenses`, `/dashboard/budget-analysis` are unchanged — full CRUD intact. They are the destinations of the "Manage all →" links from `/dashboard/plan`. Zero broken bookmarks. (NB: the original PR 4 plan called for extracting Income/Spending/Budget panels into shared components and embedding them inline. The pragmatic delivery uses condensed-summary + deep-link instead, which preserves all 5,000+ LOC of existing CRUD logic untouched. The IA outcome — single My Plan tab, tab-collapse from 6 → 3 — is identical.)
- [x] 5 — **Debt Freedom uplift.** Replaced PageHeader with `DebtFreedomHero` glassmorphic banner. Aspirational headline: "Debt-free by Oct 2031" with subtle 6s shimmer sweep over the date (collapses to static under reduced motion); fallback warm sentence when no plan computed yet. Two stat pills: interest saved (emerald) + months saved (violet). Numbers sourced from existing `aiAnalysis.projections` + `planResult` state — zero new calculations.
- [x] 6 — **Tax tab under My Guide.** Sidebar-level move shipped as part of PR 1; the existing `/dashboard/tax` route is reachable from My Guide → Tab `Tax`. Page itself unchanged. Future My Guide simplification session (Up Next #9) will fold non-duplicated tax data into the Actions surface and retire the standalone Tax route.
- [ ] 7 — **Telemetry + soft-retire window** for legacy routes (`/dashboard/income`, `/dashboard/expenses`, `/dashboard/budget-analysis`). DEFERRED — see Up Next #10. Routes stay alive as deep-link destinations from `/dashboard/plan`'s "Manage all →" links; soft-retire only makes sense if/when those links also disappear.

**Risk:** Low. Routes preserved — zero broken bookmarks, deep links, marketing URLs, browser history. No `prisma/schema.prisma` change. No destructive Prisma writes. No calc engine modifications. TypeScript clean (`npx tsc --noEmit` passes; only pre-existing tsconfig deprecation warning unrelated to this PR).

**Blocking:** None.

**Follow-up captured for the queued My Guide simplification session (NOT in scope of Phase 37):**
- **Tax → Actions de-duplication** — Reza's observation 2026-05-01 (with screenshots): the My Guide → Actions (`/dashboard/cfo`) page already surfaces a "Tax Position" card with *Estimated Position · Days Until EOFY · Effective Tax Rate · Total Deductions · Property Allocation · Neg-Gearing Benefit · Potential Missed Deductions tags*. The full `/dashboard/tax` page adds *tax-rate breakdown bars · full tax-calculation table (Tax on Income · Medicare Levy · Gross Tax · Net Tax Payable) · per-source income detail · Deductions sub-tab · Super sub-tab · full Recommendations list*. **Decision:** in the upcoming My Guide review session, compare both surfaces, fold non-duplicated tax data into Actions, then retire `/dashboard/tax` entirely. **Hard rule:** no calc duplication — Tax engine stays canonical; Actions just renders its outputs (CLAUDE.md §12.2).

---

### 4. Phase 38 — My Vault (document management uplift)

- **Status:** 🟢 **Phase 38 COMPLETE** — PRs 1 + 2 + 3 + 2.5 + 4 all shipped. My Vault IA · Smart Inbox interactive · Send-to-accountant Share Pass · folder view + toolbar redesign · universal upload migration · tax-status lens · FolderTree visual redesign.
- **Started:** 2026-05-01 (evening)
- **Owner:** Reza (vision/sign-off) + Claude (code)
- **Last touched:** 2026-05-01 — Audit confirmed extensive existing infrastructure (Phase 25 Document Management Engine, Phase 26 Document Intelligence Engine, `/api/documents/upload`, `/api/documents/analyze`, `/api/documents/export` ZIP endpoint, `FolderTree`, `DocumentFolderView`, `AnalysisPreviewCard`, `ExtractionReviewForm`). Phase 38 is mostly UX polish on top — the engines exist, the canonical upload cascade exists, the accountant ZIP endpoint exists. **Hard constraint: zero new calc engines, zero data duplication.**
- **Why this matters:** Documents are evidentiary trail for tax filings, refinancing, insurance claims, depreciation schedules. Reza's brief: *"these documents can be shared with the accountant for tax return activities and they should be very well structured and organised."* Tax-time stress (ATO research: 4–7 hrs hunting docs at EOFY) becomes retrieval relief when the vault is well-organised. Behavioural psychology: each upload = mini completion loop / dopamine hit; FY counter visibility drives engagement spike at exactly the right moment.

**Phases:**
- [x] 1 — **Sidebar IA + visual uplift + Smart Inbox surface (count-only).** Shipped as PR #575 (2026-05-01 evening). Split "Reports" into two top-level items: "My Vault" (`Archive` icon, between My Guide and Reports) + "Reports". `/dashboard/vault` alias redirects to canonical `/dashboard/documents`. Apple-typography hero + glassmorphic Smart Inbox card showing untagged-doc count.
- [ ] 2 — **Smart Inbox interactive + universal upload audit.** **THIS PR.** Smart Inbox card now expandable (Apple-style chevron toggle, AnimatePresence height + opacity reveal). When expanded, shows one row per doc awaiting review with: confidence dot (emerald/amber/rose), document-type badge, AI-extracted summary line ("Officeworks · $42.50 · 2025-03-12"), original filename, and two actions: **Open** (existing signed-URL `/api/documents/[id]` endpoint) + one-tap confirm (existing `/api/documents/analyze/confirm` — picks the highest-confidence suggested action, e.g. "Create expense"). Confirm button shows spinner during the call, doc disappears from inbox on success (refresh fires). All existing endpoints, all existing engines — zero new backend code. **Upload-audit findings**: see [Upload-path audit](#upload-path-audit-2026-05-01) below. Two of three upload codepaths route through Phase 25 DME (canonical); ONE legacy bypass identified (`hooks/useDocumentUpload.ts` → `POST /api/documents` calls `lib/documents/documentService.ts:uploadDocument` directly, skipping the Phase 25 RuleEngine). Affected callers: `components/ExpenseDialog.tsx`, `app/dashboard/expenses/page.tsx`. **Decision in this PR**: do NOT refactor ExpenseDialog or the 2,031-LOC expenses page in PR 2 (too risky for a single PR — would mix in unrelated form changes). Instead, captured as PR 2.5 below + tech-debt row #12 below.
- [ ] 2.5 — **Universal upload migration (focused PR).** Refactor `components/ExpenseDialog.tsx` and `app/dashboard/expenses/page.tsx` to use `useDocumentEngine` (canonical Phase 25 hook) instead of `useDocumentUpload` (legacy Phase 19 hook). Alternative path: refactor the legacy `lib/documents/documentService.ts:uploadDocument` to internally invoke `getDocumentManagementEngine().processUpload()`, so every existing caller benefits without touching the form code. Latter is lower-risk and fix-once-fix-everywhere — preferred. After PR 2.5, every document upload anywhere in the app is guaranteed to flow through the RuleEngine (storage routing, category inference, auto-linking, path generation, AI analysis trigger).
- [x] 3 — **Accountant bundle modal + secure share-link (Option C).** Reza decision 2026-05-01: ship Option C (secure shareable link); Option E (Xero/MYOB push) parked as future expansion. Shipped this PR. New `SharePackage` Prisma model with polymorphic `contentRefs` (Json) + `contentType` enum + `deliveryMethod` enum (extends without migration when Xero/MYOB push lands). Migration `prisma/migrations/20260501112526_add_share_package/migration.sql` (CLAUDE.md §12.12). API routes: `POST /api/share` (create), `GET /api/share` (list owner's shares), `DELETE /api/share/[id]` (revoke — soft, sets `revokedAt`), `GET /api/share/[token]` (PUBLIC read; token IS the credential), `GET /api/share/[token]/download` (PUBLIC ZIP — reuses JSZip layout from `/api/documents/export`), `GET /api/share/[token]/file/[docId]` (PUBLIC single-file streaming). Owner UI: `SendToAccountantDialog` on `/dashboard/documents` (purpose / recipient / expiry / structure → Download ZIP via existing `/api/documents/export`, OR Generate secure link via new `/api/share`). Recipient UI: minimal-aesthetic `/share/[token]` page (no app shell — logo + hero number + Download all + per-document list). Owner management: `/dashboard/settings/shares` (copy-link, view-counter, revoke). Default 30-day expiry; picker for 7 / 30 / 90. CDR audit-logged via `createAuditLog()` with `entityType='SharePackage'` on every CREATE / READ / EXPORT / DELETE. Watermark auto-generated server-side ("Generated from Monitrax · {FY} · {owner name}"). Token = 32 random bytes → 43-char base64url (≈256 bits entropy).
- [x] 2.5 — **Universal upload migration.** Shipped this PR. `hooks/useDocumentUpload.ts` migrated from legacy `POST /api/documents` (which bypassed the Phase 25 RuleEngine) to canonical `POST /api/documents/upload` (DME). New `LINK_FIELD_BY_ENTITY` map + `buildDmeFormData()` helper translate the hook's `links: { entityType, entityId }[]` shape into DME's individual entity form fields (`propertyId`, `expenseId`, `loanId`, etc.). Result: every document uploaded anywhere in the app — including from `ExpenseDialog` and the 2,031-LOC expenses page — now flows through the same canonical engine. No changes to the 2,031-LOC form needed (hook-level fix only). Tech-debt row #12 closed.
- [x] 4 — **Tax-status lens.** Shipped this PR. New "By Tax Status" root in `FolderTree` with three children: **Deductible** / **Non-deductible** / **Untagged**. Counts derived client-side from a new `expenseTaxMap: Map<expenseId, isTaxDeductible>` populated on page mount via `/api/expenses` (existing endpoint — no new API). Helper `getDocumentTaxStatus(doc)` buckets each document: at least one EXPENSE link with `isTaxDeductible === true` → DEDUCTIBLE; falls back to NON_DEDUCTIBLE if any false; UNTAGGED otherwise. Filter wires in via the existing `pathParts[0] === 'tax-status'` check in `filteredDocuments`. **Plus** — FolderTree visual redesign (Apple typography, glass active-row, tabular-nums count badges, top-level lenses rendered as uppercase tracked-out section headers). This was the visual refinement Reza flagged after the PR 3 merge: previously only the wrapping `<aside>` got the glass treatment; the tree internals were untouched. Now every row matches the rest of the page.

#### Upload-path audit (2026-05-01)

Three codepaths exist for file upload to a `Document` row. Two are canonical, one is legacy.

| Codepath | Entry | Routes through Phase 25 DME? | Notes |
|---|---|---|---|
| `POST /api/documents/upload` | `hooks/useDocumentEngine.ts`, direct fetch from `/dashboard/documents`, `DocumentUploadDropzone` | ✅ Yes — `getDocumentManagementEngine().processUpload()` | Canonical. RuleEngine resolves storage, category, links, path. |
| `POST /api/documents/analyze-for-form` | `components/documents/FormDocumentUpload` (used in income / loan / property forms) | ✅ Yes — also creates a Document via DME, then triggers analysis for form auto-fill | Canonical. |
| `POST /api/documents` | `hooks/useDocumentUpload.ts` → `lib/documents/documentService.ts:uploadDocument` | ❌ **No** — calls `uploadDocument()` legacy service directly, bypassing the Phase 25 RuleEngine | Legacy Phase 19 path. Affects: `components/ExpenseDialog.tsx`, `app/dashboard/expenses/page.tsx`. Doc rows still get created (so they appear in the Vault) but without RuleEngine-driven storage selection / auto-categorisation / auto-linking. |

Bank-import codepaths (`components/bank/ImportWizard`, `components/bank/TransactionImportDialog`) hit `POST /api/accounts/[id]/import`, not document endpoints — they're for transaction CSVs, not Document rows. Out of scope for the upload audit.

**Design language constraint:** Same as Phase 37 — extends Home TRAIL banner v3 (glassmorphic 28px cards, `appleEase` 1.4s, framer-motion v12 springs 320/28, AnimatePresence cross-fades, full `prefers-reduced-motion`). Zero new dependencies. Zero new design tokens.

**Risk:** Low. PR 1 = pure presentation layer (hero + Smart Inbox). PR 2 = UI composition over existing components + an audit-and-refactor pass. PR 3 introduces ONE new API route (share-link). No `prisma/schema.prisma` change in any PR. No calc engine changes. No data duplication.

**Blocking:** None.

**What we're explicitly NOT building (already exists per audit 2026-05-01):**
- Upload + auto-categorise + entity-link cascade — `DocumentManagementEngine.processUpload()` (Phase 25, `lib/documents/engine/`)
- OCR + Gemini metadata extraction — `DocumentIntelligenceEngine.analyzeDocument()` (Phase 26)
- ZIP bundle export — `POST /api/documents/export` already supports `financial-year-first` / `entity-first` / `category-first` structures
- AI suggestion accept/edit UI primitives — `AnalysisPreviewCard`, `ExtractionReviewForm` in `components/documents/intelligence/`
- Form auto-fill from receipt — `POST /api/documents/analyze-for-form` + `FormDocumentUpload` component
- Polymorphic entity linking — `DocumentLink` model + `LinkedEntityType` enum (9 entity types)

---

## 📋 Up Next (queued, agreed, not started)

| # | Item | Phase / area | Trigger to start |
|---|---|---|---|
| 1 | **WIF Phase 11** — drop legacy `buildStandardPrisma()` branch from `lib/db.ts`; remove `DATABASE_URL` from runtime env scope (keep build scope so `prisma migrate deploy` works); disable / drop `monitrax_user` | WIF | +30 days after Phase 9 (target ≥ 2026-05-31) |
| 2 | **WIF Phase 12 (conditional)** — switch from `0.0.0.0/0` to Vercel Static IP + restricted authorized networks. Trigger: first paying user OR pre-Basiq-submission OR anomalous connection attempts in Cloud Logging. Migration path documented in `CDR_WIF_AUTHENTICATION_EVIDENCE.md` §8 (~15 min end-to-end) | WIF | Trigger-based (see triggers ↑) |
| 3 | **CMEK (Customer-Managed Encryption Keys)** for Cloud SQL data-at-rest | CDR §3.3 / §5.7 hardening | After Phase 11 lands and is stable |
| 4 | **Phase 36 Phase 2** — full legacy page retirement. Sub-phases: ✅ **2a (this PR)** inline `LoanDetailDialog` on Balances — extracted to `components/loans/LoanDetailDialog.tsx` mirroring `AccountDetailDialog` (Overview / Property / Offset / Expenses / Strategy / Linked tabs; canonical SSOT for `calculateEffectivePrincipal`, `calculateLVR`, `toAnnual`); wired on legacy `/dashboard/loans` (parity replacement of inline) and on `/dashboard/balances` (new — clicking a loan row opens dialog instead of navigating to `/dashboard/loans/{id}`); `LoanFormDialog` now also opens in edit mode from the Balances detail dialog. 📋 **2b** migrate Connect Bank sync/disconnect UI to Balances + repoint Basiq `?action=` hrefs (BasiqHeroCard, DashboardEmptyStateGrid, SetupNextActionPanel). 🟢 **2c (no-op)** TransactionImportDialog already wired on Balances (Phase 1c). 📋 **2d** redirect `/dashboard/accounts` + `/dashboard/loans` + `/dashboard/loans/[id]` → `/dashboard/balances` (`?focus=` preserved for the detail-page deep-link). 🟢 **2e (no-op)** sidebar already targets Balances + has `matchRoutes` for legacy paths. Closes Tech-Debt #9 (residual Basiq `?action=` hrefs) at 2b completion. | UX | NOW UNBLOCKED — WIF Phase 9 stable. **2a shipped (this PR)**; 2b + 2d remain. |
| 5 | **Hard-delete pass** — auth routes (`/api/auth/login`, `/api/auth/register`) + legacy linear-wizard directory (`components/onboarding/linear/`). Both soft-deleted 2026-05-01. Closes Tech-Debt #2 + #10. | Cleanup | **≥ 2026-05-15** if Vercel logs show ZERO `[deprecated-route]` warnings during the soft-delete window |
| 6 | **Apply `connection_limit` via Prisma datasource override (Option α)** instead of URL — only if pool exhaustion still observed after WIF | Perf | Only if needed |
| 7 | **Onboarding wizard PR 3c** — data source hygiene (staleness indicators, upgrade-this-account button, balance age heat-map) | Phase 12 — see `MASTER_BLUEPRINT.md` line 206 | After current hardening sprint |
| 8 | **Tax fold-in into My Guide AI Advice surface** — Phase 40 Phase 7 deferred per Phase 37 "standalone routes preserved" precedent. The AI advice surface already references tax data natively via the advisor; the `/dashboard/tax` page is reachable from the existing TaxInsights tile. **Trigger:** after Phase 40 stabilises (~2 weeks), evaluate whether the AI advice has made the standalone tax route redundant; if yes, redirect `/dashboard/tax` → `/dashboard/cfo` and embed the deeper tax breakdown inside the cfo page. | UX / TRAIL Live stage | After Phase 40 ships and stabilises (~2 weeks observation) |
| 9 | **Phase 37 PR 7 — Telemetry + soft-retire window** for legacy `/dashboard/income`, `/dashboard/expenses`, `/dashboard/budget-analysis` routes. Routes are still actively reached via "Manage all →" deep links from `/dashboard/plan`, so soft-retire is NOT appropriate yet. Reconsider once `/dashboard/plan` adds inline panels and the deep links become optional, OR observed direct traffic to legacy routes drops below threshold. | UX / cleanup | After deep links are removed OR direct-traffic threshold met |
| 10 | **Mobile view redesign & uplift (PARKED 2026-05-02).** Two attempts (sticky-stack v1 PR #587, v2 PR #590) shipped to prod and were reverted; production iOS Safari quirks made sticky-stack unreliable. Full requirements + UX target + attempted approaches + lessons + recommended alternative implementations are documented in `PHASE_39_MY_WEALTH_REDESIGN.md` §4 ("Mobile view redesign & uplift"). **When revisiting:** read §4 in full; do NOT re-attempt sticky-stack with `useScroll/useTransform`; pick from the candidate list (Candidate A: CSS scroll-driven animations is recommended). | UX / mobile polish | When Reza signals readiness |
| 11 | **App-wide v4 tile-pattern propagation** — Phase 39 stays scoped to My Wealth per Reza's 2026-05-02 decision (`PHASE_39_MY_WEALTH_REDESIGN.md` §7). Reusable building blocks (`wealthGlyphs.tsx`, parameterised `InvestmentsHero`, documented tile pattern) are in place if propagation is later approved for My Accounts (Track palette), My Budget categories (Reduce palette), My Safety Net (Anchor palette). **Reopening triggers:** user feedback that other sections feel "left behind", onboarding research, or a brand-level design refresh. | UX / Phase 39 follow-up | Trigger-based — see PHASE_39 §7 |

---

## 🚧 Blocked / Awaiting Decision

> Items that need user input or external dependency resolution before they can move.

| # | Item | Blocked by |
|---|---|---|
| (none right now) | — | — |

---

## ❓ Open Questions (strategic, not yet decided)

| # | Question | Why it matters | Decision |
|---|---|---|---|
| ~~1~~ | ~~Cloud SQL dedicated tier upgrade~~ | | ✅ **DECIDED 2026-05-02** — Cloud SQL upgraded to **Enterprise Plus**. Question closed. (Note: actual tier flag and gcloud command should be reflected in `docs/operational/database/01_CLOUD_SQL_OPERATIONS.md` if not already.) |
| 2 | Should we adopt **Prisma Accelerate** for managed connection pooling + edge cache? | Eliminates need for our own pool tuning. ~AU$30/mo on free tier limits. | **Not adopted** (2026-05-02). Cloud SQL Connector + IAM auth + Enterprise Plus tier covers our pooling needs at current scale. Re-evaluate only if Vercel function instance count grows beyond what WIF token caching handles cleanly. |
| ~~3~~ | ~~Vercel Hobby → Pro upgrade~~ | | ✅ **DECIDED 2026-05-01** — Vercel **upgraded to Pro** (already in place, see Phase 9 cutover record). Question closed. Pro plan enables `vercel.json` `regions: ["syd1"]` pinning + better build minutes; VPC peering option still on the table for the future Cloud SQL Private IP migration (Up Next #2 trigger path). |
| ~~4~~ | ~~Delete legacy `/api/portfolio/snapshot` and `/api/financial-snapshot`~~ | | ✅ **DECIDED 2026-05-02** — Reza delegates execution. Plan: (a) migrate the 3 callers of `/api/portfolio/snapshot` (`app/dashboard/page.tsx:348`, `hooks/useUISyncEngine.ts:282`, `app/api/linkage/health/route.ts:19`) to `/api/master-snapshot`; (b) migrate the 1 caller of `lib/services/financialSnapshot.ts` (`app/api/dashboard/insights/route.ts:101`) to `getMasterFinancialSnapshot()`; (c) delete both routes and the duplicate service in a single PR. Closes Tech Debt #1a + #1b. Trigger: next housekeeping pass. |
| ~~5~~ | ~~Delete legacy `/api/auth/login` and `/api/auth/register`~~ | | ✅ **DECIDED 2026-05-02** — soft-deleted 2026-05-01 (PR #591). Hard-delete confirmed: **after 2026-05-15**, if Vercel production logs show ZERO `[deprecated-route]` warnings during the soft-delete window, hard-delete both files. Closes Tech Debt #2. |

**No new strategic questions open as of 2026-05-02.**

---

## 🗑️ Dead Code / Tech Debt Backlog

> Found during work, NOT yet cleaned up. Each item: where it lives + why it's dead + when to remove.

| # | Item | Location | Why it's dead | Remove when |
|---|---|---|---|---|
| ~~1a~~ | ✅ **RECLASSIFIED 2026-05-02 — NOT a duplicate.** Pre-flight audit during PR #5 cleanup found that `/api/portfolio/snapshot` returns `SnapshotV2` (GRDCS-aware "Snapshot 2.0") while `/api/master-snapshot` returns `MasterFinancialSnapshot`. Different shapes, different scopes: master is the financial-calcs SSOT (Phase 28); portfolio/snapshot is the GRDCS / relational / linkage-health SSOT. Its callers (`/api/linkage/health`, `useUISyncEngine`, dashboard home) consume the GRDCS layer that master does not expose (`linkageHealth`, `moduleCompleteness`, `relationalInsights`, per-entity `_links` / `_meta`). Classification corrected in CLAUDE.md §12.2 (two canonical snapshot SSOTs, not one). Future SSOT consolidation (promoting GRDCS into master, deprecating portfolio/snapshot) is a design call, not a cleanup. | | |
| ~~1b~~ | ✅ **CLOSED 2026-05-02 (PR #598).** `/api/dashboard/insights` migrated from `getFinancialSnapshot()` → `getMasterFinancialSnapshot()` with field-path remapping (`loans.monthlyRepayments` → `quickMetrics.monthlyLoanRepayments`; `accounts.liquidCash` → `quickMetrics.liquidCash`; `healthScore.savingsRate` → `quickMetrics.savingsRate`; `healthScore.debtToIncome` → `healthScore.components.debtToIncome.value`). Deleted: `app/api/financial-snapshot/route.ts`, `lib/services/financialSnapshot.ts`, the legacy re-exports in `lib/services/index.ts`. | | |
| 2 | Server-side auth routes | `app/api/auth/login/route.ts`, `app/api/auth/register/route.ts` | Firebase Auth SDK is the canonical client-side path; these are leftover from before the Feb 2026 cutover (CLAUDE.md §12.4). **Soft-deleted 2026-05-01** — both routes now return 410 Gone with deprecation payload + `console.warn()` for any unexpected hit. | **≥ 2026-05-15** — after Vercel production logs show ZERO `[deprecated-route]` warnings during the soft-delete window, hard-delete both files. If any hit appears, investigate the caller before proceeding. |
| 3 | `lib/onboarding/onboardingEstimateService.ts` | Marked disabled, throws `OnboardingDisabledError`. Per `app/onboarding/page.tsx` it's defence-in-depth for the R12 incident. | Once the bulk-create path has been stable in prod for 90 days (started ~2026-04-29) | ~2026-07-29 |
| 4 | Old changelog files | `docs/changelog/CHANGELOG_2026_04_*.md` × multiple sessions per day | Accumulated >5 daily files in April; harder to scan. | Consolidate into monthly summaries during Phase 36 Phase 2 |
| 5 | Unused `_links` / `_meta` GRDCS fields on entities never rendered | Various API responses (e.g. expense, income items not surfaced in UI) | GRDCS wraps every entity by default; some surfaces never use them | Audit at next architecture review |
| 6 | `DIRECT_URL` env var if it exists in Vercel | Vercel project env vars | If we never run migrations from Vercel runtime, only locally / via `vercel-build`, this might be unused | Audit during WIF Phase 10 cleanup |
| 7 | Server-only re-exports through client-traversed barrels | Pattern audit across `lib/*/index.ts` (uncovered in `lib/portal/index.ts` during WIF Phase 8) | The barrel pattern `export * from './auth'` — where `auth.ts` imports `@/lib/db` — silently pulls Prisma + GCP packages into client bundles via any client component that consumes the barrel for unrelated symbols. Worked by accident pre-WIF because Prisma alone tree-shook out; broke the build the moment `lib/db.ts` added dynamic imports for the connector. Removed in `lib/portal/index.ts` for this PR. | Audit other `lib/*/index.ts` barrels for the same pattern. Remove `export * from './<server-only-file>'` lines if they exist. Track in next housekeeping pass. |
| 8 | `lib/portal/auth.ts` itself | `lib/portal/auth.ts` | Zero callers anywhere in the codebase as of 2026-04-30 (`grep -rn "verifyPortalAccess\|getUserPortalOrganizations\|verifyApiKey"` returns nothing outside the file). Was kept in the barrel re-export but the barrel re-export was also unused. Pure dead code per CLAUDE.md §12.1. | Either delete the file, or wire it up to the portal API routes that should be using it. Audit when portal Phase 32 work resumes. |
| 9 | Remaining `/dashboard/accounts?action=…` hrefs | `components/dashboard/BasiqHeroCard.tsx:181,190`, `components/dashboard/DashboardEmptyStateGrid.tsx:135,136`, `components/setup/SetupNextActionPanel.tsx:90` | Each carries `?action=connect-basiq` or `?action=add` and the action handler currently lives only on `/dashboard/accounts`. Repointing today would break the Basiq Connect flow. Phase 36 Phase 2.0 (this PR) repointed everything else. | Phase 36 Phase 2b — once Connect Bank sync/disconnect UI is ported to `/dashboard/balances`, repoint these hrefs in the same PR. |
| 10 | Legacy linear-wizard directory | `components/onboarding/linear/` (full directory — `LinearWizardContainer.tsx` + `primitives/`, `hooks/`, `design/`, `steps/` subdirs, ~18 files) | Replaced by Phase 12 v2.0 `components/onboarding/wizard/` (grid-based `WizardContainer`). Dead-code audit 2026-05-01 confirmed ZERO importers from outside the directory. **Soft-deleted 2026-05-01** — `@deprecated` JSDoc added to `LinearWizardContainer.tsx`. No runtime change (already unreachable). | **≥ 2026-05-15** — after Reza confirms full app testing without incident, delete the entire `components/onboarding/linear/` directory in a single PR. |
| ~~11~~ | ✅ **CLOSED 2026-05-02** — Phase 40 wires `lib/cfo/trailStage.ts` into the AI advisor for stage-aware prompt context. Re-exported from `lib/cfo/index.ts`. | | | |
| ~~12~~ | ✅ **CLOSED 2026-05-01** — Phase 38 PR 2.5 shipped. `hooks/useDocumentUpload.ts` migrated from legacy `POST /api/documents` to canonical `POST /api/documents/upload` (Phase 25 DME). Solved at the hook layer with a `LINK_FIELD_BY_ENTITY` translation map + `buildDmeFormData()` helper — no edits to the 2,031-LOC `ExpenseDialog` or expenses page. Every upload anywhere in the app now flows through the canonical engine. | | |

---

## ↩️ Reversed Decisions

> Things we tried and rolled back. **Do not re-attempt without explicit user confirmation.** Each entry: what was tried, why reverted, lesson.

| Date | What was tried | Why reverted | Lesson |
|---|---|---|---|
| 2026-04-30 | Append `?connection_limit=1&pool_timeout=20` to `DATABASE_URL` env var on Vercel | Caused 100% of API requests to 401. Prisma's URL parser broke on the combination of unencoded `@`/`%` in the password + new query params. | Don't append to a fragile URL. Either rotate password to URL-safe chars first, OR apply `connection_limit` via Prisma datasource override (Option α). Tracked in Up Next #7. |
| 2026-04-29 | Add `calculateOffsetInterestSavings(offsetBalance, loanAnnualRate)` to `lib/utils/calculations.ts` | User direction: "the calculations and relationships on all the legacy and current pages are correct, so don't create new logics without confirmation … use the existing logics and engines for the new changes." | No new calc engines without explicit go-ahead. Compose existing primitives (`calculateEffectivePrincipal`, `calculateInterestForPeriod`) only when behaviour preservation is verified. |
| 2026-04-29 | Compose offset interest savings as `interestForPeriod(principal, rate, 1) − interestForPeriod(effective, rate, 1)` (would correctly cap savings when `offset >= principal`) | Even though "more correct" in the edge case, behaviour deviates from the legacy `offsetBalance × loanAnnualRate`. User direction: existing math is correct. | Mathematical "correctness" is not the bar. **Preserved behaviour** is. New calc behaviour requires explicit user sign-off. |
| 2026-04-15 | `prisma db push` in Vercel build script | R12 incident — silently dropped legacy tables on every deploy. Lost data risk. | Build scripts NEVER run `db push`. Only `prisma migrate deploy`. Schema changes need a migration file (CLAUDE.md §12.12). |

---

## ✅ Recently Completed (rolling 30 days)

### 2026-05-04
- **Phase 36 Phase 2a (PR #601) — inline `LoanDetailDialog` on Balances.** Extracted the 6-tab loan detail dialog from `app/dashboard/loans/page.tsx` (lines 633–963 of the legacy page) into `components/loans/LoanDetailDialog.tsx` mirroring the `AccountDetailDialog` pattern. Tabs: Overview (principal / rate / annual interest / term + Loan Details card), Property (linked-property card with LVR bar + equity card), Offset (offset balance + interest-savings card + visual `principal − offset = effective` block), Expenses (linked-expenses summary + per-expense cards), Strategy (passes through to `EntityStrategyTab`), Linked (passes through to `LinkedDataPanel`). Footer: Close + optional Delete (with AlertDialog two-step confirmation, mirroring `AccountDetailDialog`) + Edit. Calculations sourced from canonical SSOT (CLAUDE.md §12.2): `calculateEffectivePrincipal`, `calculateLVR` from `lib/utils/calculations.ts`; `toAnnual` from `lib/utils/frequencies.ts`. Wired on the legacy loans page (replacing the inline dialog — clean refactor, zero behaviour change beyond the Delete now using AlertDialog instead of `window.confirm()`) and on Balances (NEW — `LoanRowView` is now a button that opens the dialog inline; the form dialog gains an `editing` mode driven by a new `editingLoan` state hook so detail → edit works). Type widening on `LoanRow` to carry every field the dialog needs (data already present from `/api/loans` — just declared). Dead helpers removed from the legacy page (`convertToAnnual`, `calculateLinkedExpenses` were only used by the now-extracted dialog). Build green. Phase 36 Phase 2c + 2e are no-ops (already complete); 2b (Connect Bank UI migration + Basiq `?action=` href flips) and 2d (redirects) are queued.
- **IRP WIF appendix (PR #600 — closes Up Next #6).** Added `docs/policy/INCIDENT_RESPONSE_PLAN.md` §10 (Appendix A) capturing the five Phase 9 cutover failure modes — OIDC token retrieval (Layer 1), mTLS handshake / TLS alert 42 (Layer 4), SCRAM no-password / SASL (Layer 5), trailing-whitespace `28P01` (Layer 5), cold-start init wedge (Layer 4 init cache) — each with severity, log signature, containment, remediation, and runbook anchor (§3.A–§3.K). Added a 6-step auth-chain reference (Layer 1–6) so the failure-pattern table is read in context. Added §10.4 first-response playbook (confirm layer → rollback vs forward-fix decision → apply runbook step → verify end-to-end including cold-start retest). Added §10.5 CDR-containment escape-hatch for the (unlikely) case where availability failure overlaps with suspected breach. Updated §2 scope and §3 classification table to reference the new appendix; introduced new severity row "HIGH (Availability)" so future operators know auth-chain failures are not data-breach incidents (no NDB clock starts). References table now links to the WIF runbook + WIF compliance evidence pack. Header version bumped to 1.1; `Last revised: 2026-05-04` line added; `Last Updated` footer rewritten. No code change. Build N/A (docs-only).


### 2026-05-02

- **Plan housekeeping (this PR)** — Up Next list reflowed: stale Phase 39.2 / 39.3 / app-wide sticky-stack-replication entries removed; new concrete entries for Phase 36 Phase 2 (unblocked), snapshot-route cleanup, the 2026-05-15 hard-delete pass, mobile-view-parking with revisit triggers, app-wide v4-propagation parking with revisit triggers. Last-updated header collapsed from a wall-of-text into a tight pointer; full PR-level detail lives here in Recently Completed.
- **PR #595 — CLAUDE.md Part 0 + Part 16.** New PART 0 codifying the four-lens advisory mindset (financial adviser / graphic designer / system architect / human-behaviour psychologist) as standing characteristics for every Monitrax session. New PART 16 doc-sync protocol making it non-negotiable that any PR touching design / config / infra / identity / deployment / security / runbook / strategic-decision surfaces updates the matching canonical doc IN THE SAME PR (reviewers reject otherwise). Part 3.1 documentation matrix expanded from 6 → 14 rows. Pre/post-change checklists tightened. Footer bumped to Protocol Version 1.9. §16.7 captures three concrete "past misses" from this session as recognisable failure patterns.
- **PR #594 — Open Questions resolved + Phase 39 propagation parked.** Q1 (Cloud SQL Enterprise Plus shipped), Q2 (Prisma Accelerate not adopted), Q3 (Vercel Pro shipped), Q4 (legacy snapshot routes — execution plan documented), Q5 (auth-route hard-delete confirmed for ≥ 2026-05-15) all closed. New `PHASE_39_MY_WEALTH_REDESIGN.md` §7 captures Reza's call to keep the v4 tile pattern scoped to My Wealth and NOT propagate to other entity-list pages, with verbatim direction + post-mortem rationale + reusable building blocks left in place + revisit triggers. Cloud SQL ops doc updated with Enterprise Plus edition row + benefit note + verification gcloud command.
- **PR #593 — Phase 39.3 Assets redesign + Phase 39 COMPLETE.** `/dashboard/assets` rewired to use the v4 tile pattern with a warm sub-palette family (six per-type tile palettes: VEHICLE amber/orange, ELECTRONICS rose/pink, FURNITURE stone/amber, EQUIPMENT slate/zinc, COLLECTIBLE fuchsia/violet, OTHER orange/amber). New `AssetsHero` + `AssetTile` components. 6 new filled silhouette glyphs added to `wealthGlyphs.tsx` (car / laptop / sofa / wrench / diamond / box) + `AssetGlyph` resolver. Status pill (Sold / Written off) + 75% opacity wrapper for inactive assets. 4-card summary block replaced with single hero. With this, all three pages under My Wealth share a unified v4 visual language.
- **PR #592 — Phase 39.2 Investments redesign.** `/dashboard/investments/accounts` and `/dashboard/investments/holdings` rewired to use the v4 tile pattern. New `InvestmentsHero` (shared, parameterised) + `InvestmentAccountTile` (5 Stage-I sub-palettes: BROKERAGE / SUPERS / FUND / TRUST / ETF_CRYPTO) + `HoldingTile` (4 palettes: SHARE / ETF / MANAGED_FUND / CRYPTO — CRYPTO uses warm amber for the "digital gold" cue). 9 new filled silhouette glyphs added to `wealthGlyphs.tsx`. PageHeader descriptions reworded to warm narratives.
- **Phase 40 PR 1 — My Guide AI Financial Advice STARTED.** Replaced rule-based "Prioritised Actions" on `/dashboard/cfo` with a Gemini-powered advice section grounded in canonical `getMasterFinancialSnapshot()`. New deterministic scenario engine (`lib/cfo/scenarios/` — sellProperty / payDownLoan / refinanceLoan / redirectToOffset / cutSpendCategory / addInvestment). New `lib/cfo/aiAdvisor.ts` orchestrator with strict zero-hallucinated-numbers rule (AI calls scenarios via tool calling; server runs the math). New endpoints `/api/cfo/advice` (24h-cached), `/api/cfo/advice/chat`, `/api/cfo/scenarios/run`. New `AIAdviceDocument` + `AIAdviceChatMessage` Prisma models (additive migration). Tech-debt #11 (`lib/cfo/trailStage.ts`) closed. Phase 7 (Tax fold-in) deferred — re-queued under Up Next #9.
- **Phase 39.1 Properties redesign** — initial My Wealth tile pattern shipped via PRs #582 / #585 / #586 / #591. v1 line-art glyph mock rejected; v2 tonal-atmosphere variant rejected; v3 added per-type hue + filled silhouette; v4 enlarged glyphs + visible hover hue + opaque-mobile bg. Mobile sticky-stack v1 (PR #587) and v2 (PR #590) shipped to prod and reverted via PR #591 with comprehensive `PHASE_39_MY_WEALTH_REDESIGN.md` §4 doc capturing requirements + attempted approaches + 4 candidate alternative implementations for next attempt.
- **Tax fold-in (Phase 40 Phase 7)** — DEFERRED, re-queued as Up Next #9 with explicit ~2-week-stabilisation trigger.

> Older items roll into `docs/changelog/IMPLEMENTATION_CHANGELOG.md`.

### 2026-05-04
- **`architect-mode` skill revised — seven lenses + decision-ready synthesis mandate.** Reza explicitly clarified the operating contract: *"I want you to view every change from multiple lenses ... I always need you to give me an informed and consolidated feedback as well. I want you to help with making decisions based on that."* Three changes to `.claude/skills/architect-mode/SKILL.md`: (1) added a 7th lens — **Security & Compliance Consultant** (CDR/threat-model/privacy/credential-egress), explicitly named because Monitrax is CDR-regulated and security is first-class, not folded into "architect"; (2) added a new **Synthesis section** + 6th operating principle (*"Consolidate, don't enumerate"*) — codifies that the seven lenses are internal cognitive work, not user-facing structure; output is a single synthesised recommendation with the lens reasoning compressed into "Why it matters", with explicit anti-patterns ("From the X lens... From the Y lens..." = banned; "here are three options" = banned); (3) tightened the output structure to require a **single Next Best Action** with Implementation specific enough to act on without further clarification. The skill description was updated to reflect the seven lenses + synthesis mandate (970 chars, within 1024 limit). YAML still subordinates skill to CLAUDE.md (CLAUDE.md wins on conflict); skill subordinates to user explicit instructions (user wins on conflict).

### 2026-05-03
- **Snapshot SSOT cleanup (PR #598)** — closed Tech-Debt #1b and re-classified #1a. Migrated `app/api/dashboard/insights/route.ts` from legacy `getFinancialSnapshot()` → canonical `getMasterFinancialSnapshot()`, with field-path remapping for the four paths that diverge between the two shapes (`loans.monthlyRepayments`, `accounts.liquidCash`, `healthScore.savingsRate`, `healthScore.debtToIncome`). Deleted `app/api/financial-snapshot/route.ts` (zero callers) and `lib/services/financialSnapshot.ts` (zero callers after insights migration). Pruned the legacy re-exports from `lib/services/index.ts` and a stale doc-comment reference in `lib/types/prisma-enums.ts`. Pre-flight audit caught that `/api/portfolio/snapshot` is NOT a duplicate of master — it's the GRDCS / relational SSOT (`SnapshotV2` shape: per-entity `_links` / `_meta`, `linkageHealth`, `moduleCompleteness`, `relationalInsights`). CLAUDE.md §12.2 SSOT table updated with two snapshot rows + a paragraph explaining the two-SSOTs reality so future sessions don't repeat the mis-classification. Build green; no calc engines, DB queries, or schema touched.
- **Project-level skill `pr-prep-checklist` installed at `.claude/skills/pr-prep-checklist/SKILL.md`.** Operationalises the existing CLAUDE.md §16 doc-sync protocol — auto-triggers on PR-preparation cues ("create a PR", "open a PR", "let's merge this", etc.) and walks the §16.5 block step-by-step before allowing `mcp__github__create_pull_request` to fire. Verifies surface-to-doc mapping (§16.3 matrix), `IMPLEMENTATION_PLAN.md` updates (§15), `CHANGELOG` entry (§11), destructive-write checklist (§12.11) where applicable, and schema-with-migration rule (§12.12) where applicable. Trivial PRs (`chore:`, `docs:` typo, `style:` formatting-only) get a one-line confirmation shortcut. Points at CLAUDE.md as the single source of truth — never duplicates rules. CLAUDE.md §16.5 updated with a single-paragraph cross-reference to the skill (purely additive). Closes the gap between "CLAUDE.md mandates §16.5" and "the model actually runs the §16.5 block at PR time."
- **Project-level skill `architect-mode` installed at `.claude/skills/architect-mode/SKILL.md`.** Codifies the multi-disciplinary advisory mode (six lenses: Financial Advisor [AU context], Behavioural Psychologist, Product Architect, UX/UI Designer, Visual Designer, Growth & Marketing Strategist) so future Monitrax sessions don't have to be re-prompted. Extends CLAUDE.md §0 (which had four lenses) by adding Visual Designer + Growth & Marketing Strategist; adds the **One Clear Action principle** and **stage-gated feature exposure**; defines a structured Problem → Why → Solution → Implementation → Risks output for substantive recommendations (deferring to §0.3 "tight answers" for trivial / exploratory questions). Auto-triggers on substantive Monitrax product decisions. Explicitly subordinated to CLAUDE.md (skill never overrides project governance). User-level `~/.claude/skills/skill-security-review` was used to vet the install. **Earlier in the same session:** vetted + installed 60+ skills at user level (16 official Anthropic skills, 7 audited LOW-risk third-party from `composiohq/awesome-claude-skills` @ `48ffe0c`, 37 marketing skills from `coreyhaines31/marketingskills` @ `1bcff9fc` excluding the 3 brand-incompatible ones — `popup-cro`, `paywall-upgrade-cro`, `marketing-psychology`); reviewed and declined `obra/superpowers` (philosophical collision with §0 flexibility tone) and the HIGH-tier `connect-apps-plugin` from awesome-claude-skills (instruction-suppression payload + remote MCP routing). Pin records at `~/.claude/skills/.{anthropic-skills,composio-third-party,marketingskills}-pin`.

### 2026-05-01
- **Phase 39 — My Wealth premium redesign STARTED (Properties shipped).** Reza commissioned a premium glassmorphic redesign of the three pages under My Wealth (Properties, Investments, Assets) to match the new design language already shipped on My Accounts (PR #573) and My Budget (PR #574). Brief: *"Apple-glass tiles with interactive buttons, transitions, animations. Don't make it childish but cool, and engaging. Mobile-first."* Audit covered 5 target pages + 2 reference pages; found `framer-motion` v12, `recharts` v3, `tailwindcss-animate` already in `package.json` (zero new deps). Properties shipped this PR: new `components/properties/PropertiesHero.tsx` (glassmorphic hero — sky/indigo Stage I atmosphere, total portfolio + equity + loans + avg LVR, equity-vs-debt animated bar, type allocation segments) + `components/properties/PropertyTile.tsx` (premium tile — type-aware body for HOME / INVESTMENT / RENTAL, hero current-value with gradient gain pill, equity + LVR row with mini animated LVR bar, investment-only yield + cashflow, linked-data pills, hero gradient CTA). Page wiring kept minimal: hero inserted after `PageHeader`, tile-rendering loop replaced with `<PropertyTile />` calls; all dialogs / list view / filters / data fetching unchanged. Page description reworded from stat-stuffed line to warm narrative *"What you're building — your homes, investments, and rentals."* `prefers-reduced-motion` honoured throughout. New phase doc `PHASE_39_MY_WEALTH_REDESIGN.md`. Investments + Assets queued for Phase 39.2 + 39.3.
- **Home TRAIL banner v3 — premium redesign.** Reza approved v2's interactive functionality but commissioned a v3 visual upgrade with the brief: *"Apple-like, animated transitions, relevant background, world-class — the design of Monitrax should be the selling point."* `components/dashboard/TrailStageIndicator.tsx` rewritten end-to-end on top of framer-motion v12 (already in repo, used by marketing). Zero new dependencies. New design language: glassmorphic card with `28px` rounded corners + `backdrop-blur-xl`; stage-coloured atmospheric mesh-gradient background that morphs across stages with `appleEase` (1.4s); soft-breathing glow halo behind active letter (8s loop); hero-scale `h-16/sm:h-20` letter tiles with gradient-filled type and springy hover (`stiffness: 320, damping: 28`); animated connecting thread that fills from Track to the user's actual stage on first render (1.1s); bespoke per-stage SVG glyphs (eye-aperture for Track, scissors arcs for Reduce, anchor-on-waves for Anchor, self-drawing sparkline for Invest, sunrise for Live) each with stage-specific micro-motion; cross-fade content swaps with blur-out/blur-in via `AnimatePresence mode="wait"` (0.45s); compact "You" pill above the user's actual stage; pill-shaped gradient CTA with sweep-shimmer on hover. Full `prefers-reduced-motion` support — every animation collapses to static. All stage copy sourced verbatim from `TRAIL_FRAMEWORK.md` §2. Documented in `PHASE_36_MY_ACCOUNTS_SIMPLIFICATION.md` §9 (v3 spec); v2 spec preserved below for context.
- **Dead-code audit + soft-delete pass.** Audited 22 surfaces across the wizard/onboarding/marketing/trail-* areas plus re-verified the existing 9 tech-debt items. Findings: (a) tech-debt #1 was inaccurate — `/api/portfolio/snapshot` still has 3 live callers and cannot be deleted until they migrate to `/api/master-snapshot`; split into items #1a + #1b. (b) `lib/services/financialSnapshot.ts` is itself a duplicate of canonical `getMasterFinancialSnapshot()` but is still used by `dashboard/insights` — bundled into #1b. (c) `components/onboarding/linear/` (~18 files) is a complete orphan chain since the v2 wizard rewrite — added as #10. (d) `lib/cfo/trailStage.ts` is a Phase 17 spec placeholder with zero callers — added as #11. Soft-deletes shipped this PR: `/api/auth/login` and `/api/auth/register` now return 410 Gone with `console.warn()` on any hit (so unexpected callers surface in Vercel logs); `LinearWizardContainer.tsx` has an `@deprecated` JSDoc marker pointing at the directory-wide deletion target. Hard-delete window opens 2026-05-15 — Reza will verify production logs and full-app testing first.
- **Step 1a Phase 9 — WIF Production cutover COMPLETE.** Production now serves 100% of traffic via Workload Identity Federation + Cloud SQL Connector + IAM database authentication. Four issues surfaced and resolved within the day: (1) PR #563 — OIDC token reading switched to per-request header via `getVercelOidcToken()` + Proxy lazy init; (2) GCP-side fix — created the missing Cloud IAM database user on the instance + ran `public`-schema GRANTs as `monitrax_user`; (3) PR #564 commit `a29667a` — added `password: async () => authClient.getAccessToken()` callback to `pg.Pool` for IAM-mode Postgres auth; (4) PR #564 commit `34e764c` — defensive `.trim()` on all WIF env vars after a trailing-space copy-paste artifact triggered 28P01. Doc sync: CLAUDE.md §13.6, CDR matrix §3.2, CDR WIF evidence §7 (cutover record), infrastructure §5.5, MASTER_BLUEPRINT identity stack, Cloud SQL ops, migration appendix, IMPLEMENTATION_PLAN, CHANGELOG_2026_05_01, runbook §3.G/§3.H/§3.I/§3.J.
- **Home TRAIL banner redesign (PR #566)** — `components/dashboard/TrailStageIndicator.tsx` rewritten so the T-R-A-I-L letters are real interactive tabs: bigger letters (h-12/h-14), hover previews each stage's full description (sourced from TRAIL_FRAMEWORK §2: headline, narrative, key question), click selects (sticky), second click on the same letter navigates. "You are here" pill marks the user's actual stage. Inline `Open <stage>` CTA button next to the contextual hint. Default render still shows the user's actual stage so non-interacting users see today's behaviour.
- **Phase 36 Phase 2.0 — non-Basiq legacy `/dashboard/accounts` repoint (PR #566)** — `TrailStageIndicator` (Track href), `LinkedDataPanel` (`account` GRDCS add-link), `ModuleHealthBlock` (`accounts` + `offsetAccounts` drill-downs), `app/dashboard/cfo/page.tsx` (Month-End Balance MetricCard `router.push`), `app/api/cashflow/intelligence/route.ts` (Build Emergency Buffer `learnMoreUrl`) all now point at `/dashboard/balances`. Basiq `?action=` hrefs intentionally left in place — they still need the legacy page until Phase 2b ports the Connect Bank UI to Balances. New tech-debt row #9 added to track them.

### 2026-04-30
- **Step 1a Phase 8 (PR #560)** — `lib/db.ts` Cloud SQL Connector branch behind `USE_CLOUD_SQL_CONNECTOR` flag; `previewFeatures = ["driverAdapters"]`; new packages (`@google-cloud/cloud-sql-connector`, `@prisma/adapter-pg@^5.22.0`, `pg`); 6 doc updates (CLAUDE.md §13.6, CDR matrix §3.2, infra §5.5, MASTER_BLUEPRINT, migration appendix, Cloud SQL ops); 3 new docs (`04_WIF_TROUBLESHOOTING.md`, `CDR_WIF_AUTHENTICATION_EVIDENCE.md`, `CHANGELOG_2026_04_30.md`); incidental dead-barrel removal in `lib/portal/index.ts` to unbreak the client bundle. Build green. Default flag value `false` — zero-risk merge.
- **PR #559** — `docs/IMPLEMENTATION_PLAN.md` + CLAUDE.md §15 protocol (the live tracker)
- **Step 1a Phases 4–7** — WIF setup: Workload Identity Pool, OIDC provider, SA binding, Vercel env vars, OIDC federation enabled at project level
- **Cloud SQL instance-level password policy** enabled (12-char min, complexity, reuse interval, disallow username substring)
- **Per-user password policy** for `monitrax_user` and `postgres` (failed-attempt lockout)
- **Cloud SQL resize** `db-f1-micro` → `db-g1-small` (1.7GB RAM) — single biggest perf win
- **PR #558** — Retry transient 401s on Balances (DB-pressure-induced auth context failures)
- **Reverted** — `?connection_limit=1` URL append (broke prod)

### 2026-04-29
- **PR #556** — Account delete in detail dialog (rose Delete button + AlertDialog confirmation) + retry on intermittent /api/loans
- **PR #555** — Connect Bank toolbar button + 2-tile source picker (Phase 36 Phase 1c)
- **PR #554** — Re-merge Phase 1b inline create/edit forms (PR #553 merged into wrong base; cherry-picked to main)
- **PR #553** — `AccountFormDialog` + `LoanFormDialog` extracted (Phase 36 Phase 1b) — `+ Account` and `+ Loan` open inline
- **PR #552** — `AccountDetailDialog` extracted; account row click → inline dialog (Phase 36 Phase 1)
- **PR #551** — Resilient transactions enrichment (split `unified_transactions` JOIN as best-effort)
- **PR #550** — Loan-detail 404 fix + Balances partial-data rendering (`Promise.allSettled` + per-section error hints)
- **PR #549** — `UserPreference` schema-drift migration (taxYear column missing in prod, R12 class)
- **PR #548** — Surface real bulk-create errors (client now reads `details`; server translates Prisma error codes)
- **PR #547** — Required-field gating on wizard (Property purchase date now blocks Continue, not Submit)
- **PR #546** — Bank-import FK violation + UX cleanup; bumped `prisma.$transaction` timeout to 30s; surface submit errors in wizard footer
- **PR #545** — Mobile layout for `OnboardingWelcomeModal` (CTAs always reachable)

---

## 📚 Older history

For changelogs older than 30 days, see:
- `docs/changelog/IMPLEMENTATION_CHANGELOG.md` — rolling activity log
- `docs/changelog/CHANGELOG_YYYY_MM_DD.md` — daily session detail
- `docs/blueprint/MASTER_BLUEPRINT.md` §4 — phase-level status table
- `docs/blueprint/PHASE_*.md` — per-phase implementation notes

---

## How to update this document (rules)

> **Mandatory.** See CLAUDE.md §15 (Implementation Plan Protocol) for full rule text.

1. **Every PR that starts a workstream** adds it to `🟡 Active Workstreams` with all the fields filled in.
2. **Every PR that advances a workstream** ticks off the relevant `[ ]` checkbox(es) in that workstream's phase list and updates `Last touched`.
3. **Every PR that completes a workstream** moves it from `🟡 Active` to `✅ Recently Completed` with the date and PR number.
4. **Every PR that surfaces a tech-debt item** (e.g. removes a duplicate, identifies dead code) adds it to `🗑️ Dead Code / Tech Debt Backlog`.
5. **Every PR that reverts a previous attempt** adds an entry to `↩️ Reversed Decisions` so the same dead-end isn't re-attempted in a future session.
6. **Every PR that introduces an open question** the user hasn't decided adds it to `❓ Open Questions`.
7. **Once a quarter** (or when this file exceeds ~600 lines), recently-completed items older than 30 days are moved to `IMPLEMENTATION_CHANGELOG.md` and removed from this file.
8. **Reviewers reject PRs** that materially change a workstream without updating this file. Same hygiene rule as the changelog.
