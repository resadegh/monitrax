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
