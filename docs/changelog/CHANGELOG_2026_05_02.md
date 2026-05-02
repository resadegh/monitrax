# Changelog — 2026-05-02

## Session: claude/transaction-link-document-attachment — Receipt attachment on transaction categorise

### Outcome

**The "Link Transaction → Create New" modal on `/dashboard/activity` now accepts a receipt/document attachment.** Drop a file, the canonical Phase 25 DME upload runs (storage routing, category inference, auto-link, AI analysis), Phase 26 Gemini extracts vendor/amount/date/category to auto-fill the form fields, and after submit the document is automatically linked to the newly-created expense or income — visible in My Vault with full metadata, accessible from both the entity tab and the Vault directly.

This closes a gap the user flagged this morning while categorising bank transactions: *"there is no document attachment option which I need. This should be used to keep receipts and also to make sure the document will be stored correctly under the right folder in My Vault."*

### Context

Phase 38 PR 2.5 (yesterday, PR #578) migrated `hooks/useDocumentUpload` to the canonical `/api/documents/upload` endpoint via the `buildDmeFormData` translation helper. That migration set up the architectural promise — *every upload anywhere in the app routes through DME and lands in My Vault correctly tagged*. This session realises that promise on one more surface: the transaction categorise modal, which previously had no upload field at all.

The receipt-to-expense-link is the highest-value new behaviour: when you categorise a bank transaction by creating a new Expense, the receipt PDF/photo you drop into the modal becomes a `Document` row + a `DocumentLink(entityType: EXPENSE, entityId: <new>)` row, automatically. The doc appears in My Vault under the expense's filter, under the FY filter, under the category filter, AND when the expense is later included in a Send-to-Accountant share.

### Changes

`components/transactions/TransactionLinkDialog.tsx`:

- **Imports** — added `FormDocumentUpload` + `FieldMapping` type from `@/components/documents/FormDocumentUpload`.
- **State** — new `attachedDocumentId` state. Reset on every dialog open (`useEffect` cleanup) so a doc attached to one transaction never carries over to the next.
- **JSX** — new section between the "Name" input and the "Source Type" dropdown in the Create New tab:
  ```
  Receipt or document
  Optional — drop one and we'll auto-fill below
  [FormDocumentUpload compact dropzone]
  ```
  Uses `formType={isIncome ? 'income' : 'expense'}` so the existing Phase 26 analyzer routes to the correct extractor (the income analyzer pulls source/employer/period; the expense analyzer pulls vendor/amount/date/category).
- **`onFieldsExtracted` handler** — auto-fills `newName` from extracted vendor/payee/source, `newCategory` from extracted category, plus `isTaxDeductible` + `isEssential` heuristics (only when the user is on the GENERAL source type — otherwise the source-type defaults take priority, e.g. PROPERTY/LOAN expenses always start tax-deductible). Auto-fill is **non-destructive**: it only writes to a field if the user hasn't already typed something there.
- **`onDocumentAttached` handler** — captures the `documentId` returned by the analyzer.
- **`handleCreate` linking step** — after `POST /api/transactions/[id]/link` returns `data.created.id` for the new expense/income, we fire a follow-up `POST /api/documents/[attachedDocumentId]/link` with `{ entityType: 'EXPENSE' | 'INCOME', entityId: data.created.id }`. Failure is logged but **non-fatal** — the document is already in the Vault from the upload step; the only thing that fails is the entity association, which the user can re-create from the Vault detail view.

### Why this matches Phase 38 architecture

- **Zero new API endpoints.** Uses existing `/api/documents/analyze-for-form` (FormDocumentUpload's internal call, already canonical Phase 25 DME) + `/api/documents/[id]/link` (Phase 19 link endpoint, already used by every other entity form).
- **Zero data duplication.** One `Document` row, one `DocumentLink` row. Doc visible from My Vault, the new expense detail, and any Send-to-Accountant share that includes that expense.
- **Same canonical engines.** No new RuleEngine work, no new analyzer, no new storage path generator — Phase 25 DME handles all of it.

### Files modified

- `components/transactions/TransactionLinkDialog.tsx` — imports, state, JSX, `handleCreate` link-after-create, dialog-open reset
- `docs/changelog/CHANGELOG_2026_05_02.md` (this file, NEW)

### Build status

- [x] TypeScript: PASS (`npx tsc --noEmit` reports zero errors; only pre-existing tsconfig deprecation warning unrelated to this PR)
- [x] No schema change (CLAUDE.md §12.12 N/A)
- [x] No destructive Prisma writes (CLAUDE.md §12.11 N/A)
- [x] No new APIs or calc engines

### Risk

**Low.** Pure additive UI change in a single component. The new section appears only on the "Create New" tab when neither Transfer nor Investment Contribution toggle is active — exactly the same gating as the existing form fields. The doc link API call is fire-and-forget with try/catch — it cannot break the transaction-create flow. State reset ensures no cross-transaction contamination.

### Side note: Google Maps API error on `/dashboard/properties` detail dialog

User reported the property location map failing with *"Google Maps Platform rejected your request. This API is not activated on your API project."* — this is a GCP Console config issue, not a code issue. Audit confirmed the codebase calls three Maps services: **Maps Embed API** (currently failing — used by `components/google-maps/PropertyMap.tsx` for the iframe), **Geocoding API** (used by `/api/geocode`), **Places API** (used by `/api/places` for address autocomplete). All three need to be enabled in the GCP project; instructions delivered to Reza in-session. **No code change in this PR.** A `docs/operational/` runbook for Google Maps setup is queued as a small follow-up — currently the only doc is the spec at `docs/blueprint/PHASE_20_GOOGLE_MAPS_INTEGRATION.md`.

---

## Session: claude/review-monitrax-docs-Rvkgt — Phase 40: My Guide AI Financial Advice (CFO redesign)

### Outcome

**The `/dashboard/cfo` page now leads with an AI-generated financial advice section powered by Gemini Pro.** The deterministic "Prioritised Actions" tabs that previously dominated the page have been removed; their findings are now consumed by the AI advisor as ground truth and surfaced as narrative-led recommendations. Each recommendation can trigger a deterministic "what-if" scenario (sell a property, refinance a loan, redirect cash to offset, cut a spend category, add an investment, make extra repayments) and the user can ask follow-up questions in a side-drawer chat.

This responds to Reza's brief: replace a long list of disconnected nudges with a real CFO surface that diagnoses the situation, prioritises a way forward, and lets the user explore concrete projections for changes they're considering. Highest-leverage TRAIL Live-stage surface — closes the gap between Monitrax-the-tracker and Monitrax-the-CFO.

### Hard constraints honoured (non-negotiable)

- **Zero hallucinated numbers.** The AI authors prose + structured `evidence` items with `snapshotPath` references; the server resolves each path against the actual `getMasterFinancialSnapshot()` output and ships the resolved numeric value. If a path doesn't resolve, the evidence item is dropped. Numbers in the UI come from one of two deterministic sources: the snapshot (via validated paths) or the scenario engine (pure functions). The AI never writes a number the user sees.
- **CDR sanitisation before AI call** (CLAUDE.md §13.3). The context document sent to Gemini contains aggregates only — no account numbers, no BSBs, no transaction-level descriptions, no payee names. Property and loan names (user-chosen labels) pass through as they're not CDR-protected per the project's classification.
- **Existing rule engine retained as fallback.** `lib/cfo/actionEngine.ts` keeps running. When Gemini fails, `buildFallbackDoc()` constructs a degraded advice doc from the rule engine output so the surface is never empty. The fallback is marked `isFallback: true` and the UI flags it.
- **Stability over freshness** (added 2026-05-02 per Reza's mid-build correction). While a non-expired advice doc exists for the user, return it as-is regardless of snapshot fingerprint drift. Minor data drift (a transaction imported, a balance updated) MUST NOT regenerate the advice. The advice changes only on (a) 24h TTL expiry or (b) explicit user "Refresh" click. Fingerprint becomes a *staleness hint* (`isStale: true`) so the UI can offer a refresh prompt without forcing one.
- **No calc engine duplication.** All scenarios compose existing primitives (`calculateInterestForPeriod`, `calculatePIRepayment`, `calculateEffectivePrincipal`). The advisor reads from canonical `getMasterFinancialSnapshot()`. Auth via `withPermission('report.read', ...)` per §6.1.
- **24h cache** keyed on userId — single cached doc per user at a time, persisted in Prisma. Caps Gemini Pro spend (~AU$0.05–0.15 per advice doc).

### Files added

**Scenario engine — `lib/cfo/scenarios/`:**
- `types.ts` — `ScenarioContext`, `ScenarioResult`, `ScenarioImpact`, `ScenarioWarning`, `LoanView` types.
- `sellProperty.ts` — disposal modelling (gross proceeds − selling costs − loan payoff) with CGT flagged as a warning (handled by canonical tax engine, not duplicated here).
- `payDownLoan.ts` — extra-monthly amortisation walk; reports interest saved + months reduced + cashflow impact.
- `refinanceLoan.ts` — recomputes monthly P&I at new rate via `calculatePIRepayment`; reports monthly + lifetime savings + break-even months.
- `redirectToOffset.ts` — composes `calculateEffectivePrincipal` + `calculateInterestForPeriod` to project monthly/annual interest reduction.
- `cutSpendCategory.ts` — reduces a category from `snapshot.expenses.monthly.byCategory`; projects cashflow, savings rate, and emergency-fund-months impact.
- `addInvestment.ts` — future value of a monthly annuity; flags TRAIL stage mismatch (e.g. Anchor stage user being pushed into Invest stage moves).
- `index.ts` — `runScenario(ctx, request)` dispatcher used by both the API endpoint and the AI advisor's tool-call handler.

**AI advisor service — `lib/cfo/aiAdvisor.ts`:**
- `generateOrFetchAdvice({ userId, forceRegenerate })` — single canonical entry point. Loads canonical snapshot + rule-engine output + per-loan view in parallel, determines TRAIL stage, builds sanitised AI context, calls Gemini Pro with strict system prompt, validates the response (drops any evidence item whose snapshotPath doesn't resolve), persists, returns the document.
- `fingerprintSnapshot()` — stable hash of bucketed snapshot inputs ($1k buckets for net worth, $100 for cashflow). Used as a staleness hint, not a hard cache-bust.
- `buildAIContext()` — exported helper used by the chat endpoint to reconstruct the same context the original advice was grounded in.
- `resolveSnapshotPath()` — dotted-path walker (`cashflow.monthlyCashflow`, `properties[0].lvr`) for the validation pipeline.
- `validateAIResponse()` — drops invalid priorities/categories/stages/scenario-types, validates per-scenario param shapes against the user's actual loans/properties.
- `buildFallbackDoc()` — rule-engine-only advice when Gemini fails; shorter TTL (1h) so we retry sooner.

**Prisma models — `prisma/schema.prisma` + migration:**
- `AIAdviceDocument` — cached advice (userId, fingerprint, trailStage, JSON document, isFallback, expiresAt). Indexes on `(userId, expiresAt)` and `(userId, fingerprint)`.
- `AIAdviceChatMessage` — chat turns scoped to an advice doc, cascade-delete with parent.
- Migration `prisma/migrations/20260502120000_add_ai_advice_phase_40/migration.sql` — additive (CREATE TABLE only, §12.11 destructive-write checklist N/A).
- Relation added to `User.aiAdviceDocuments`.

**API endpoints:**
- `app/api/cfo/advice/route.ts` (GET + POST) — `withPermission('report.read', …)`. Returns the user's current advice doc; supports `forceRegenerate: true` in the body to bypass cache. Audit-logs `AI_ADVICE_GENERATED` with CDR-safe metadata only.
- `app/api/cfo/advice/chat/route.ts` (GET + POST) — GET hydrates page-load chat history; POST sends a user turn, persists it, calls Gemini Flash with the same context + transcript + advice doc, returns the assistant turn. Audit-logs `AI_ADVICE_CHAT`.
- `app/api/cfo/scenarios/run/route.ts` (POST) — runs a single deterministic scenario and returns the projected impact. Audit-logs `CFO_SCENARIO_RUN`.

**UI components — `components/cfo/`:**
- `AdviceHero.tsx` — glassmorphic 28px hero with stage-aware atmospheric mesh gradient (sky/indigo for Invest, sunrise amber for Live, rose for Reduce, teal for Anchor, indigo/sky for Track), slow-breathing glow halo, `appleEase` entry, full `prefers-reduced-motion`. Renders the situation assessment + headline advice + Refresh button + isStale/isFallback indicators.
- `AdviceRecommendationCard.tsx` — per-recommendation card. Priority badge (do_now/upcoming/consider/background) + category + TRAIL stage chips, qualitative narrative reasoning, evidence pills (UI hydrates real numbers from the `value` field), expandable steps list, **Run Scenario** button (gradient CTA) that calls `/api/cfo/scenarios/run` and inlines the projection card with before/after impacts + warnings + assumptions, **Ask follow-up** button that opens the chat drawer pre-filled with the recommendation context.
- `AdviceChatThread.tsx` — slide-in side drawer (max-w-md, glassmorphic backdrop) with conversational UI. Streaming "thinking" pill, autoscroll on new messages, Enter-to-send / Shift+Enter for newline. Persists for the lifetime of the advice doc (24h).
- `AIAdviceSection.tsx` — orchestrating client component. Owns the data lifecycle (fetch advice, run scenarios, send chat, refresh). Renders Hero → Recommendations grid → Watch points + Sharpen-the-advice questions → Chat trigger → ChatThread overlay.

**Page wiring — `app/dashboard/cfo/page.tsx`:**
- Inserted `<AIAdviceSection token={token} />` immediately after the `<PageHeader />` — the headline of the page.
- Removed the old "Prioritised Actions" tabs block (~90 lines). The legacy block is replaced by an explanatory comment in the source for future readers.
- All other page content preserved unchanged: Health Score Hero, Quick Stats Row, Tax Position tile, Loan Opportunities tile, Property Portfolio tile, Investment Portfolio tile, Monthly Progress card, Risk Radar — all retained as supporting context per Reza's "keep the existing data on the page" direction.

**Other:**
- `lib/cfo/index.ts` — re-exports the new advisor + scenarios + TRAIL stage helpers; closes tech-debt #11 (`lib/cfo/trailStage.ts` was a Phase 17 placeholder with zero callers — now wired up).

### Files modified

- `prisma/schema.prisma` — two new models + relation on User.
- `lib/cfo/index.ts` — new public API exports.
- `app/dashboard/cfo/page.tsx` — section insertion + Prioritised Actions removal.
- `docs/IMPLEMENTATION_PLAN.md` — new active workstream Phase 40, supersedes Up Next #8 (now re-queued under that slot for Tax fold-in follow-up), closes tech-debt #11.

### Build status

| Step | Status | Notes |
|------|--------|-------|
| `npx prisma generate` | ✅ PASS | Migration applies cleanly to schema |
| `npx tsc --noEmit` | ✅ PASS | Zero errors |
| `npm run build` | ✅ PASS | 268 pages generated; only pre-existing Google Cloud `retry-request` warning (not introduced by this PR) |

### What was deferred

- **Phase 7 — Tax fold-in.** Per Phase 37 precedent ("Standalone routes preserved" for `/dashboard/income`, `/dashboard/expenses`, `/dashboard/budget-analysis`), `/dashboard/tax` stays alive in this PR. The cfo page already surfaces the headline tax data via the existing `TaxInsights` tile, and the AI advisor naturally references tax data and recommends tax actions. Re-queued under Up Next #8 with a sharper trigger: evaluate after Phase 40 stabilises whether the AI advice surface has made the standalone tax route redundant.

### Why the stability rule matters (Reza's mid-build correction)

The first-pass design fingerprinted the snapshot per request and busted the 24h cache when key inputs changed. That meant: import a new transaction, refresh, see different advice — the surface flickering. Reza flagged this is unacceptable: *"an advise should not dramatically change everytime."* The fix: cache lookup by userId only (regardless of fingerprint match), and the fingerprint becomes a non-blocking staleness hint surfaced in the UI as "your finances have shifted — refresh for an updated take?" The user opts in to refreshes. Same 24h TTL, same anti-cost guarantee, but stable interaction surface. This invariant is preserved server-side in `findFreshCache()` so client behaviour cannot bypass it.

