# Changelog - 2026-06-17

## Session: vision-key-first-restore-shk180

### Changes Made
- **Type**: Fix
- **Scope**: GCP auth — Vision OCR credential order
- **Root Cause**: The keyless GCS/Vision cutover was shipped before keyless was
  proven in prod, and the working `GCS_SERVICE_ACCOUNT_KEY` was deleted. Prod
  logs from a live receipt upload showed keyless GCS failing with
  `Anonymous caller does not have storage.buckets.get access` (401) — the
  keyless `authClient` is not honoured by `@google-cloud/storage` at runtime
  (cross-package google-auth-library instance). Storage + telemetry are
  key-first, so restoring the key fixes them; but `visionService.ts` was made
  **keyless-first** in #1131, so it would keep using the broken keyless path
  even after the key is restored.
- **Solution**: Flip `visionService.initialize()` back to **key-first**
  (service-account key → keyless WIF → ADC), matching the storage provider and
  the telemetry sinks. A single `GCS_SERVICE_ACCOUNT_KEY` now governs all GCP
  clients consistently. Keyless remains the fallback when no key is set, to be
  re-enabled only once it is verified end-to-end in prod.

### Files Modified
- `lib/documents/intelligence/services/visionService.ts` — key-first auth order + JSDoc

### Build Status
- [x] tsc clean
- [x] `npm run build` passes

### Operator action (Reza)
- Restore `GCS_SERVICE_ACCOUNT_KEY` (Production scope) in Vercel. Merging this PR
  triggers the deploy that picks up the key + the Vision fix together.

### Follow-ups
- "AI didn't recognise my photo" — the per-expense camera/attach button uploads
  with `analyze:false` (files the doc, no OCR by design). AI recognition runs via
  the global **Scan a receipt** flow (`/api/documents/analyze*`). Optional
  follow-up: wire analyze+prefill into the per-item camera path.
- Proper keyless: solve the cross-package `authClient` wiring (pass external_account
  config so the SDK's own google-auth-library builds the client), verify in prod
  with the key still present as fallback, then remove the key.

## Session: vision-grpc-rest-fallback-shk180

### Changes Made
- **Type**: Fix (root cause)
- **Scope**: Vision OCR transport
- **Root Cause**: Live prod logs of a receipt scan showed Vision authenticating
  fine with the key (`[Vision] Using service account: monitrax-backend@...`) but
  the OCR call then threw `Error: undefined undefined: undefined` (`code: undefined`,
  gax `note: 'Exception occurred in retry method that was not classified as
  transient'`, stack in gRPC `onReceiveStatus`/`callErrorFromStatus`). This is the
  **gRPC (HTTP/2) transport failing in Vercel's bundled serverless runtime** — the
  request dies before reaching Google. It explains the long-standing "Vision API
  enabled but ZERO traffic" symptom: every call failed at the transport layer
  regardless of key vs keyless auth. NOT an auth/permission/billing problem.
- **Solution**: Construct `ImageAnnotatorClient` with `fallback: true` (REST/HTTP
  transport instead of gRPC) on all three auth branches. Standard fix for Google
  client libraries on serverless.

### Files Modified
- `lib/documents/intelligence/services/visionService.ts` — `fallback: true` on all
  three `new ImageAnnotatorClient(...)` calls + header/inline docs

### Build Status
- [x] tsc clean
- [x] `npm run build` passes

### Follow-up (telemetry — issue #2 "fix properly")
- The GCP **telemetry sinks** (Cloud Logging / Monitoring / Error Reporting /
  Security Command Center / Cloud Scheduler) are ALSO gRPC clients, so they likely
  fail the same way on Vercel even with the key restored. Restoring the key stopped
  the crash/no-op; making them actually FUNCTION needs the same REST transport
  (`fallback: true` / REST client) — tracked as the proper telemetry fix.

## Session: scan-link-asset-property-shk180

### Changes Made
- **Type**: Feature
- **Scope**: Scan-a-receipt → attach to an asset/property; Vault Assets folder
- **Description**: The "Scan a receipt" result screen only offered "Add expense",
  creating a standalone GENERAL expense with no entity link — so a receipt for
  (e.g.) the Toyota Landcruiser asset couldn't be attached to it, and the document
  filed under generic Expenses instead of the asset. Added a "What is this for?"
  selector (assets + properties) to the result screen. On confirm it (a) creates
  the expense with the chosen `assetId`/`propertyId` (the API already accepts these)
  and (b) links the saved document to that entity via `POST /api/documents/[id]/link`,
  so both file under the item. Also added the missing **Assets** branch to the Vault
  FolderTree (issue #3) so the receipt is visible under the asset.

### Files Modified
- `components/documents/GlobalScanReceipt.tsx` — "What is this for?" selector + TargetPill + confirm wiring + JSDoc
- `lib/documents/entityLookup.ts` — `getAllUserEntities` + `lookupEntities` now include assets
- `components/documents/FolderTree.tsx` — `UserEntities.assets`, Car icon, Assets branch

### Stitch (§18.2.1 backfill — code-first, Reza-approved)
- Project 1859462351962811110, screen `20c36c03c45c41ceaa6e3d070c40ba60`
- Artefact: `.stitch/designs/scan-link-asset/result-sheet-what-is-this-for.{html,png}`

### Build Status
- [x] tsc clean
- [x] `npm run build` passes

### Notes
- Document count + entity-path filtering in the documents page are generic
  (`entity:<TYPE>:<id>`), so ASSET works with no page change.
- v1 scope: assets + properties (Reza decision). Loans/investments deferred.

## Session: asset-docs-ai-and-mobile-frame-shk180

### Changes Made
- **Type**: Feature + Fix
- **Scope**: Asset detail — Documents AI recognition + mobile framing
- **Issue 1 (AI vision on asset upload)**: the per-item `DocumentsSection` uploaded
  with no `analyze`, so the asset Documents "Upload document"/"Take photo" never
  ran OCR. Added an opt-in `analyzeOnUpload` prop: when set, the upload passes
  `analyze=true` (single upload, still linked to the asset) and surfaces the
  AI-recognised vendor/amount/date inline with a one-tap "Add as expense for
  <asset>" (creates an expense linked to the asset/property). Enabled on the asset
  detail Documents tab.
- **Issue 2 (mobile framing)**: the detail dialog's KPI tiles used `grid-cols-4`
  (4 columns forced into mobile width → "Depreciation" clipped) and the 5-tab
  `TabsList` overflowed. Fixed: KPI grid is now `grid-cols-2 sm:grid-cols-4`
  (2×2 on mobile), TabsList is `flex w-full justify-start overflow-x-auto`
  (horizontally scrollable). Responsive true-tweak (§18.2.1 code-first).

### Files Modified
- `components/documents/DocumentsSection.tsx` — `analyzeOnUpload` + recognised banner + add-expense
- `app/dashboard/assets/page.tsx` — `analyzeOnUpload` on the asset Documents tab; KPI grid + TabsList responsive

### Stitch (§18.2.1)
- Recognised banner reuses the scan-result "AI recognised → Add expense" vocabulary
  already designed in PR #1136 (project 1859462351962811110, screen
  `20c36c03c45c41ceaa6e3d070c40ba60`). Framing fix is a responsive reflow (true tweak).

### Build Status
- [x] tsc clean
- [x] `npm run build` passes

## Session: asset-detail-mobile-redesign-shk180

### Changes Made
- **Type**: UI/UX redesign (Stitch-first, Reza-approved)
- **Scope**: Asset detail dialog — mobile framing
- **Description**: The asset detail was a desktop `max-w-4xl` dialog that clipped on
  mobile (KPI tiles + tabs overflowed). Reza directed it through Stitch (§18.2.1).
  Generated + approved a mobile design (screen 770abf40f2584174b52db63a4310a34a),
  then converted to React: DialogContent now `overflow-x-hidden p-4 sm:p-6`; the
  header uses a gradient car badge + truncating title; KPI tiles are a new polished
  `KpiTile` glass component (hairline + 3px gradient top-accent + tabular-nums +
  min-w-0/truncate so long numbers never overflow), 2×2 on mobile / 4-across on sm+;
  the TabsList is horizontally scrollable with hidden scrollbar.

### Files Modified
- `app/dashboard/assets/page.tsx` — DialogContent overflow guard, gradient header, KpiTile, scrollable tabs

### Stitch (§18.2.1 — Stitch-first, approved before build)
- Project 1859462351962811110, screen `770abf40f2584174b52db63a4310a34a`
- Artefact: `.stitch/designs/asset-detail-mobile/asset-detail-mobile-dark.{html,png}`

### Build Status
- [x] tsc clean
- [x] `npm run build` passes

### Related diagnosis (no code change here)
- Reza's "AI still not picking uploads": prod logs showed the asset upload at
  05:43 sent `analyze: false` on the #1137 deploy → the client ran a STALE cached
  bundle (pending PWA "Relaunch to update") OR used the expense-row paperclip
  (files-only). Server fix (analyzeOnUpload → analyze=true, DIE uses REST Vision)
  is correct + live. Resolution: relaunch the app, use Documents tab → Upload.

## Session: asset-detail-overflow-fix-shk180

### Changes Made
- **Type**: Fix (mobile layout)
- **Scope**: Asset detail + edit dialogs — horizontal overflow on mobile
- **Root Cause**: The shadcn `DialogContent` is `display:grid`; its grid-item children
  (the KPI grid, the Tabs) carry the default `min-width:auto`, which let them push the
  dialog wider than the phone viewport — so the right KPI column + tabs ran off-screen
  even after the #1138 redesign (the polished tiles rendered, proving the bundle was
  fresh; the overflow was a real layout bug, not a cache issue — there is no service
  worker in the app).
- **Solution**: On both the detail dialog and the edit dialog, set an explicit
  `w-[calc(100vw-1rem)]` (tailwind-merge overrides the base width) + `overflow-x-hidden`
  + `[&>*]:min-w-0` (every direct grid child may shrink, so none can force the dialog
  wide). Also fixed the edit form's vehicle-details row from `grid-cols-3` →
  `grid-cols-1 sm:grid-cols-3` (3 cramped columns on mobile).

### Files Modified
- `app/dashboard/assets/page.tsx` — detail + edit DialogContent width/min-w guards; vehicle-details grid responsive

### Build Status
- [x] tsc clean
- [x] `npm run build` passes

## Session: doc-recognise-crash-filename-shk180

### Changes Made
- **Type**: Fix (crash + mobile layout)
- **Scope**: Per-item Documents — AI-recognised banner + document row
- **Issue 1 (page crash, React error #31)**: clicking "Upload document" on the asset
  Documents tab crashed the page ("Something went wrong"). Root cause: the upload
  route's `analysis.extractedData` stores fields as the engine's `ExtractedField`
  shape (`{ value, confidence }`); `pickField` returned the whole object, and the
  recognised banner rendered it directly → "Objects are not valid as a React child".
  Fix: `pickField` now unwraps `.value` and never returns an object/array (only
  primitives are safe to render).
- **Issue 2 (filename truncated to "I…")**: in `DocumentList` the filename shared one
  row with the 4 action buttons, so on mobile it was squeezed to a single character.
  Fix: the filename now gets its own full-width line; metadata + compact icon-buttons
  (h-8 w-8) share the line below it.

### Files Modified
- `components/documents/DocumentsSection.tsx` — `pickField` unwraps ExtractedField + rejects objects
- `components/documents/DocumentList.tsx` — filename on its own line; compact action buttons

### Build Status
- [x] tsc clean
- [x] `npm run build` passes

## Session: doc-ai-autorename-shk180

### Changes Made
- **Type**: Feature
- **Scope**: Per-item Documents — auto-rename on AI recognition
- **Description**: Reza feedback (recognition now works): the uploaded file kept its
  camera name ("IMG_6615.JPG"). On a successful `analyzeOnUpload` recognition,
  `DocumentsSection` now auto-renames the document to a meaningful AI-derived name
  — `"{vendor} - {date}.{ext}"` (e.g. "QBE Insurance - 2026-06-18.jpg"), falling
  back to the document type when no vendor. Uses the existing `PATCH
  /api/documents/[id]` `rename` action; best-effort (a rename failure never breaks
  the upload). Helps the Vault file-storage structure organise by what the
  document IS.

### Files Modified
- `components/documents/DocumentsSection.tsx` — `buildSuggestedName` + `prettyType` helpers; auto-rename after recognition; header note

### Build Status
- [x] tsc clean
- [x] `npm run build` passes

## Session: asset-expense-delete-doclink-shk180

### Changes Made
- **Type**: Fix (SSOT / data integrity) + Feature
- **Scope**: Receipt → expense dedup + linkage + per-expense delete
- **Root Cause (Reza)**: "Add as expense" created a standalone expense with no link
  to the document and no dedup, so uploading several photos of the same receipt and
  adding each made duplicate expense rows; deleting the duplicate documents then left
  orphaned expenses (non-SSOT).
- **Solution**:
  1. **Server-side dedup (SSOT)** — `/api/expenses` POST gains an opt-in `dedupeOnAsset`
     flag: when set with an `assetId`, it returns any existing expense with the same
     asset + amount + vendor/name (`duplicate: true`) instead of creating another.
     Manual entry omits the flag and is unaffected.
  2. **Doc↔expense link** — `addExpenseFromRecognised` links the document to the created
     (or existing) expense via `POST /api/documents/[id]/link`, so the receipt and the
     expense are joined and traceable.
  3. **Per-expense delete** on the asset Expenses tab (was edit+attach only) so duplicates
     can be cleaned up. Manual, confirmed (Reza decision: no auto-cascade on doc delete).
  4. **Frequency** — receipts default to `ANNUAL` not `MONTHLY` (MONTHLY 12×'d a one-off
     in cashflow). True one-off support flagged as a follow-up (Frequency enum has no ONE_OFF).
  5. Recognised banner shows "already exists — linked this receipt to it" on a dedup hit.

### Files Modified
- `app/api/expenses/route.ts` — `dedupeOnAsset` guard (findFirst → return existing)
- `components/documents/DocumentsSection.tsx` — dedupeOnAsset + ANNUAL + doc→expense link + notice
- `app/dashboard/assets/page.tsx` — per-expense delete button + handleDeleteExpense

### Build Status
- [x] tsc clean
- [x] `npm run build` passes

## Session: dme-ai-propagate-dedup-shk180

### Changes Made
- **Type**: Feature (propagation) + Design doc
- **Scope**: AI-on-upload propagated to Properties + Investments; generalised dedup; DME 2.0 design
- **Propagation**: `analyzeOnUpload` is now on the Properties detail (`properties/[id]`)
  and Investment-account detail (`investments/accounts/[id]`) Documents sections, not
  just Assets — so uploads there OCR + auto-rename, and (properties) offer "Add as
  expense" with dedup. Investments skip the expense action (no asset/property-style
  expense) but still OCR + auto-rename.
- **Dedup generalised**: `/api/expenses` dedup flag renamed to `dedupeReceipt`
  (`dedupeOnAsset` kept as a back-compat alias) and now matches on whichever entity
  link is present (asset / property / loan / investment account), not just asset.
- **Design**: new **Phase D — AI-powered DME 2.0** section in `PHASE_50_AI_DOCUMENT_ROUTER.md`
  — five intelligence capabilities (document-level dedup, record reconciliation,
  confidence-gated autonomy, learned routing, lifecycle), architecture (SSOT placement),
  and a phased build (D.1–D.5). Recommends starting with D.1 (document-level hash dedup).

### Files Modified
- `app/api/expenses/route.ts` — generalised dedup (`dedupeReceipt` + dynamic entity link)
- `components/documents/DocumentsSection.tsx` — sends `dedupeReceipt`
- `app/dashboard/properties/[id]/page.tsx` — `analyzeOnUpload`
- `app/dashboard/investments/accounts/[id]/page.tsx` — `analyzeOnUpload`
- `docs/blueprint/PHASE_50_AI_DOCUMENT_ROUTER.md` — Phase D design + Phase C update

### Build Status
- [x] tsc clean
- [x] `npm run build` passes

### Deferred (documented in Phase D + Phase C)
- Document-level dedup (hash) — the real fix at source; **recommended next (D.1)**.
- Per-expense list parity on Properties/Investments detail pages.
- Confidence-gated autonomy, learned routing, lifecycle intelligence (D.3–D.5).

## Session: dme-d1-document-dedup-shk180

### Changes Made
- **Type**: Feature (DME intelligence — D.1) + Governance clarification
- **Scope**: Document-level dedup at the single DME chokepoint
- **Governance (Reza challenge)**: clarified there is ONE DME + ONE DIE (separate
  concerns, not competing) — the "DME 2.0 / two engines" wording was misleading and
  was corrected in `PHASE_50_AI_DOCUMENT_ROUTER.md` (Phase D now "extends the existing
  single DME + DIE — NOT a new engine", with a §12.3/§6.4 compliance note).
- **D.1 (document dedup)**: `DocumentManagementEngine.processUpload` now SHA-256-hashes
  the file bytes and, BEFORE storing, looks up `(userId, contentHash)`. On a byte-identical
  match it returns the existing document flagged `duplicate` (adding any new entity links
  via `createMany … skipDuplicates`) instead of storing a second copy. The upload route
  skips re-analysis on a duplicate; `DocumentsSection` shows "you already uploaded this —
  linked it here". Single chokepoint = every per-item upload path inherits it.

### Files Modified
- `prisma/schema.prisma` — `Document.contentHash String?` + `@@index([userId, contentHash])`
- `prisma/migrations/20260617150000_add_document_content_hash/migration.sql` — additive (ADD COLUMN + CREATE INDEX)
- `lib/documents/engine/types.ts` — `EngineResult.duplicate?`
- `lib/documents/engine/DocumentManagementEngine.ts` — hash + dedup + `toEngineDocument` mapper (DRY)
- `app/api/documents/upload/route.ts` — surfaces `duplicate`, skips re-analysis on dup
- `components/documents/DocumentsSection.tsx` — "already uploaded" notice, skips recognition on dup

### Schema change (§12.12) + destructive-write (§12.11)
- Matching migration present (`20260617150000_add_document_content_hash`). Additive,
  nullable column + index — **no DROP / ALTER DROP / NOT NULL backfill**. Non-destructive.

### Build Status
- [x] tsc clean
- [x] `npm run build` passes

### Deferred (D.1.1)
- Funnel the legacy scan path (`documentService.uploadDocument`) through the DME (or a
  shared `dedupeByHash()` helper) so the global "Scan a receipt" flow shares the ONE dedup.
- Near-duplicate (content-fingerprint) detection on top of exact-hash.
