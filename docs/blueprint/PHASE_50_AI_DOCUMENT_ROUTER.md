# Phase 50 — AI Document Router

> **Vision (Reza, 2026-06-16):** *every document/receipt should be (a) recognised
> by AI, (b) attached to the correct item/asset OR used to create a new
> item/expense, and (c) filed in the right Vault folder for future
> reporting/extraction.*
>
> TRAIL stage: **Track** (My Accounts) + **Reduce** (My Budget). The router turns
> the passive "My Vault" into an active intake that routes a photo to the right
> place with one confirmation.

This phase builds on the existing engines — it does **not** re-invent them:

- **DME** — Document Management Engine (`lib/documents/engine/`) — upload, storage
  provider abstraction, linking rules.
- **DIE** — Document Intelligence Engine (`lib/documents/intelligence/`) — OCR
  (Vision) + Gemini field extraction.
- **Receipt matcher** (`lib/bookkeeping/receiptMatcher.ts`, Phase 42) — given an
  extracted receipt, finds candidate existing transactions with an AUTO_LINK /
  PICK_FROM / NO_MATCH verdict. **Already complete and live.**

---

## Build phases

### Phase A — Foundation + fix the live scan bug ✅ SHIPPED (PR #1123, 2026-06-16)

1. **Scan recognition fix.** The global "Scan a receipt" only stored to the Vault
   without identifying the photo. Prod logs showed `POST /api/documents/analyze`
   500ing on a fresh upload (reaches OCR then throws). Root cause traced to the
   two-step path (upload → re-read stored file → analyze) being unreliable in
   prod. Rewired `GlobalScanReceipt` to the proven single-step
   `/api/documents/analyze-for-form` (OCRs the in-hand upload, Gemini-maps, files
   as RECEIPT). Recognition now renders vendor/amount/GST/date/category.
2. **`ASSET` is a linkable document type.** Added end-to-end so a receipt can tag
   to a vehicle/asset: `LinkedEntityType.ASSET` (schema + migration + TS mirror),
   `EntityContext.assetId`, upload-route entity map, `useDocumentUpload`
   `LINK_FIELD_BY_ENTITY`, `asset_direct` DME LinkingRule, DocumentList label.

### Phase B — Intelligence + storage (IN PROGRESS)

Two tracks run in parallel.

#### B-storage — move bytes to GCS, with a per-user quota

**Reza decision (2026-06-16): storage = Google Cloud Storage, with a per-user quota.**

Architecture finding (2026-06-16 codebase audit): the storage layer is already
cleanly abstracted behind `IStorageProvider` + a factory
(`lib/documents/storage/factory.ts`). **The GCS provider is production-ready**
for upload/download/signed-URLs, and **the factory auto-selects GCS the moment
three env vars are present** — so the "switch" itself needs no code:

| Env var | Purpose |
|---|---|
| `GCS_PROJECT_ID` | GCP project that owns the bucket |
| `GCS_BUCKET_NAME` | the documents bucket (defaults to `monitrax-documents`) |
| `GCS_SERVICE_ACCOUNT_KEY` | base64-encoded SA JSON (or omit to use ADC/WIF) |

What this track delivers in code (the parts that AREN'T just config):

- [x] **Per-user storage quota (SSOT) — ✅ shipped (PR #1124).**
  `lib/documents/storage/storageQuota.ts`. Drift-free: usage is **computed** from
  `SUM(Document.size) WHERE deletedAt IS NULL`, never a maintained counter that
  could desync. Backend-independent (counts DB bytea + GCS the same). Default
  allowance **2 GiB** with a per-user override hook for later (paid tiers /
  household pooling). Enforced at the single upload chokepoint
  (`DocumentManagementEngine.processUpload`) **and** the legacy
  `documentService.uploadDocument` path (the scan), so no path bypasses it.
  `/api/documents/upload` maps the quota breach to **HTTP 413** (client
  condition), not a 500. 7 unit tests.
- [x] **Keyless WIF auth for GCS — ✅ shipped this PR.** New canonical
  `lib/gcp/wifAuthClient.ts` mints impersonated SA access tokens from the Vercel
  OIDC token (the same passwordless identity the DB uses — §13.6, no static
  credential). The GCS provider's `initialize` now: key if `GCS_SERVICE_ACCOUNT_KEY`
  is set (legacy) → else keyless WIF if the WIF env vars are present → else ADC
  (local dev). **No service-account key needed in prod.**
- [x] **GCS-aware download — ✅ shipped this PR.** `/api/documents/download` is now
  provider-aware: it verifies the (provider-agnostic) HMAC signature, looks up the
  `Document` by `storagePath`, and **streams the bytes from the right backend** (DB
  bytea or GCS). Because keyless credentials can't sign a native v4 URL locally,
  the read-URL policy (new SSOT `lib/documents/storage/readUrl.ts`) routes keyless
  GCS reads through this streaming route — and the bytes never leave via a public
  signed URL, which is the better CDR posture. A native GCS signed URL is still
  used when a service-account key is present. 4 unit tests.
- [ ] **(Optional) migrate existing inline docs.** Decide migrate-vs-leave for
  documents already stored as `fileContent` bytea. Leaning *leave* — the
  retrieval path (`getDocumentContent`) already branches on `storageProvider`, so
  old DB docs keep working while new uploads go to GCS. A backfill job is only
  needed to reclaim the bytea bloat, and can run later.

> **⛔ Operator provisioning (Reza only — I can't from the session). KEYLESS route
> chosen — the code is keyless-ready, so this is now just THREE steps, no secrets:**
> 1. **Create the bucket** — `monitrax-documents`, region `australia-southeast1`
>    (matches Cloud SQL `syd1`), uniform bucket-level access, CMEK per §13.9 P1.
>    `gcloud storage buckets create gs://monitrax-documents --location=australia-southeast1 --uniform-bucket-level-access --project=monitrax-479700`
> 2. **Grant the existing runtime SA** (`$GCP_SERVICE_ACCOUNT_EMAIL`, already used
>    by the DB) `roles/storage.objectAdmin` **on the bucket** (least privilege):
>    `gcloud storage buckets add-iam-policy-binding gs://monitrax-documents --member="serviceAccount:<SA_EMAIL>" --role=roles/storage.objectAdmin`
> 3. **Set 2 non-secret env vars** in Vercel (Production): `GCS_PROJECT_ID=monitrax-479700`,
>    `GCS_BUCKET_NAME=monitrax-documents`. **Do NOT set `GCS_SERVICE_ACCOUNT_KEY`** —
>    the keyless WIF env vars (`GCP_WORKLOAD_IDENTITY_PROVIDER` + `GCP_SERVICE_ACCOUNT_EMAIL`)
>    are already set for the DB and the GCS client now reuses them.
>
> Once set, the factory switches new uploads to GCS automatically (no signing-IAM
> needed — reads stream through `/api/documents/download`). The residual
> `/api/documents/analyze` 500 is tracked as a **separate diagnostic** (Phase A
> traced it to the two-step analyze path, not confirmed as a GCS issue) — to be
> fixed from live logs, not assumed resolved by GCS.
> **Doc-sync done in the keyless PR:** `09_INFRASTRUCTURE_AND_DEPLOYMENT.md` updated.
> When provisioned, also note the bucket + IAM binding in
> `docs/operational/security/02_IAM_AND_PERMISSIONS.md` + §13.9.

#### B-intelligence — attach-to-existing, not just create

The receipt matcher already exists; what's net-new is surfacing **attach** as a
first-class outcome alongside **create**, always with user confirmation.

- [ ] **`ATTACH_TO_*` confirm actions** in `/api/documents/analyze/confirm`:
  `ATTACH_TO_EXPENSE`, `ATTACH_TO_PROPERTY`, `ATTACH_TO_LOAN`, `ATTACH_TO_ASSET`,
  `ATTACH_TO_TRANSACTION` (the confirm flow has only `CREATE_*` today). Each
  creates a `DocumentLink` (multi-link is already supported by the
  `@@unique([documentId, entityType, entityId])` shape).
- [ ] **Entity-picker endpoint(s)** — search/list expenses, properties, loans,
  assets, transactions scoped by `ownerEntityId`, returning id + label + amount +
  date for disambiguation.
- [ ] **Owning-legal-entity linking** — every entity already carries
  `ownerEntityId` (Phase 41/47). The attach flow should surface/scope by the
  owning legal entity so a business receipt files under the right structure.
- [ ] **Scan-UI "attach vs create" branch** — `GlobalScanReceipt` result stage
  gains an "Attach to an existing item" choice + a picker. **§18.2.1 STRICT:
  this is a new section-level composition → Stitch FIRST**, then React. (Phase A
  deliberately kept the single "Add expense" CTA.)
- [ ] **Always-confirm** — the matcher's `PICK_FROM` verdict surfaces candidates
  for the user to confirm; never silent-links below AUTO_LINK confidence.

### Phase C — Per-item Documents + Tax-pack

- [~] Per-item **Documents** sections on Asset Spotlight detail pages (Stitch
  design already generated under `.stitch/designs/asset-documents/`).
  **Shipped for Properties, Investments, Assets** (reusable `components/documents/DocumentsSection.tsx`
  — upload + mobile camera + list/view/delete; uploads link to the item AND file under the
  item's folder via the new `asset_path` rule; bypasses the AI path so it works while Vision is down).
  **Pulled forward from Phase C** after Reza flagged the gap (upload was missing on every wealth item).
  **Super deferred** — needs a `SUPER` `LinkedEntityType` + migration. Full light/mobile Stitch variants to backfill.
- [x] **AI recognition on the per-item upload (`analyzeOnUpload`)** — runs OCR on upload, surfaces the
  recognised vendor/amount/date inline, **auto-renames** the file to a meaningful name ("QBE Insurance -
  2026-06-18.jpg"), and offers a one-tap **"Add as expense"** with **server-side dedup** (`dedupeReceipt`
  — same entity+amount+vendor returns the existing expense, never a duplicate) + a **doc↔expense link**.
  **Propagated to Assets, Properties, and Investment accounts** (2026-06-17). For investments the expense
  action is hidden (no asset/property-style expense), but OCR + auto-rename still apply. Per-expense
  **delete** added on the Assets Expenses tab; Properties/Investments don't yet render a per-expense list
  on their detail pages (those expenses live in `/dashboard/expenses`) — list parity is a follow-up.
- [ ] **Tax-pack export** + ATO 5-year retention.
- [ ] Renewal-date tie-in (insurance/rego docs surface their renewal).

---

## Phase D — Document intelligence/judgement layer (extends the existing DME + DIE — NOT a new engine)

> **Driver (Reza, 2026-06-17):** *"There should be some level of ai and smarts for documents management engine to avoid such issues … maybe it's a good time to think and build it based on the app requirements."* Surfaced after duplicate expenses piled up from re-uploading the same receipt. The point is broader than dedup: the engine should **reason about documents**, not just route bytes.
>
> **Single-engine compliance (CLAUDE.md §12.3 / §6.4 — Reza challenge 2026-06-17):** this is **not** a second/competing engine and there is **no "DME 2.0" rewrite**. Monitrax has exactly **one** Document Management Engine (filing: routing/linking/foldering) and **one** Document Intelligence Engine (reading: OCR/classification/extraction) — *separate concerns, one implementation each* — the same "two SSOTs, not duplication" distinction CLAUDE.md §12.2 draws for the master vs portfolio snapshots. Phase D adds the missing **judgement** behaviour **inside those existing single engines** (dedup at the one `processUpload` chokepoint; reconciliation as pure functions the DIE/confirm flow calls). It *reinforces* single-engine — one canonical place per concern — rather than competing with it.

### D.0 What we already have (don't rebuild)

| Layer | Today | File |
|---|---|---|
| **DME** (management — *filing*) | Upload routing, storage-provider abstraction, per-entity `DocumentLink` creation with cascade, category assignment, deterministic path/folder rules, tag generation, quota | `lib/documents/engine/*` |
| **DIE** (intelligence — *reading*) | OCR (Vision, REST transport), document-type classification (keyword/regex/label + filename hint), pattern extraction (receipt/invoice) + AI extraction (Gemini), confidence + low-confidence flags, type-specific **suggested actions** (`CREATE_EXPENSE`, `CREATE_LOAN`, `SET_REMINDER`, …) | `lib/documents/intelligence/*` |
| **Router (Phase 50)** | analyze→confirm pipeline, per-item Documents upload (`analyzeOnUpload`), auto-rename from recognition, receipt→expense with **server-side dedup** | `app/api/documents/*`, `components/documents/*`, `app/api/expenses` |

**The gap is not OCR or extraction — it's _judgement_.** Neither engine asks: *"have I seen this document before? does this duplicate an existing record? am I confident enough to act, or should I ask? where does this truly belong?"* Phase D adds that judgement behaviour **into the existing single engines** (it does not spawn a new one).

### D.1 The five intelligence capabilities (in priority order)

1. **Duplicate detection (document-level).** ✅ **D.1 SHIPPED (2026-06-17).** `processUpload` now SHA-256-hashes the file bytes, stores the hash on `Document.contentHash` (migration `20260617150000_add_document_content_hash`, additive + nullable), and **before storing** looks up `(userId, contentHash)`. On a match it does NOT create a second Document — it adds any new entity links to the existing one (`createMany … skipDuplicates`) and returns it flagged `duplicate: true`; the upload route skips re-analysis and the client shows "you already uploaded this — linked it here". The guard sits at the single DME chokepoint so the per-item upload path inherits it. **Remaining gap (D.1.1 follow-up):** the legacy scan path `documentService.uploadDocument` (global "Scan a receipt" → analyze-for-form) doesn't funnel through `processUpload`, so it doesn't yet share the dedup — funnel it through the DME (or extract a shared `dedupeByHash()` helper) so there's ONE dedup, not two. Content-fingerprint (vendor+amount+date) dedup for *near*-duplicates (re-scan at a different angle → different bytes) is a later refinement on top of the exact-hash match.
2. **Record reconciliation (cross-entity dedup).** ✅ **D.2 SHIPPED (2026-06-18).** New canonical `lib/documents/intelligence/reconcile/reconcileSuggestedAction.ts` — before the document-confirm flow writes an expense / income / loan from a `CREATE_*` action, it asks the reconciler whether a matching record already exists (same user + amount + vendor/name, scoped to the linked property/loan/asset for expenses; +type for income; +principal for loans). On a match the confirm route links the document to the EXISTING record (`reconciled: true` in the response) instead of writing a duplicate, and skips the receipt-matcher so no duplicate transaction is synthesised. SSOT — the single place 'is this document's record already in the system?' is decided, so no confirm path can silently duplicate. 7 unit tests. (Generalises D.1's record-level sibling, the `/api/expenses` `dedupeReceipt` guard.)
3. **Confidence-gated autonomy.** ✅ **D.3 SSOT SHIPPED (2026-06-18); auto-execution REJECTED by the autonomy decision.** New canonical `lib/documents/intelligence/confidencePolicy.ts` — ONE place for the thresholds (AUTO ≥0.9, CONFIRM ≥0.7, ASK <0.7) + the autonomy band, replacing the 0.9/0.7 magic numbers duplicated across `GlobalScanReceipt`/`AnalysisPreviewCard`/`ExtractionReviewForm` (§12.3). Includes the **earned-autonomy** TRAIL-stage downgrade (Track/Reduce users never AUTO). 6 tests. **The AUTO band is now a *display/priority* cue only — it does NOT trigger a silent write.** Per the 2026-06-18 autonomy decision (Decisions log), auto-EXECUTION is **rejected, not deferred**: the user always confirms (and can edit). The sanctioned convenience is **bulk-approve** (approve many AUTO-band items at once, each still an explicit editable confirm) — a separate Stitch-first UI follow-up (Smart Inbox), not a background writer.
4. **Smart routing + foldering.** ✅ **D.4 SHIPPED (2026-06-18) — suggest-only.** New canonical `lib/documents/intelligence/learnedRouting.ts` + `VendorEntityHint` table (migration `20260618090000_add_vendor_entity_hints`). When a user attaches a recognised document from a vendor to a routable entity (asset/property/loan/investment account), we record a `(userId, vendorKey, entityType, entityId)` hint and increment its `count`. The next document from the same vendor **pre-selects** that entity in the scan flow's "What is this for?" selector (with a quiet "Suggested for you" cue). **Per the autonomy decision it never auto-applies** — the user always confirms and can change the selection. Recording lives at two chokepoints (the `/api/documents/[id]/link` API + the analyze/confirm route), reading via `GET /api/documents/vendor-hint?vendor=`. Rules-based vendor→entity table as planned (§12.7 — the simple table over a model); 14 unit tests. **Backfill note:** the pre-selection is a cue *within* the already-approved "What is this for?" section (a true tweak per §18.2.1), not a new section-level composition — no Stitch pass required.
5. **Lifecycle intelligence.** ✅ **D.5b SHIPPED (2026-06-18) — retention clock; D.5a SHIPPED (2026-06-19) — renewal → reminder.**
   - **D.5b — retention clock ✅:** new pure `lib/documents/intelligence/retentionClock.ts` — `computeRetentionStatus(date, category)` applies the ATO 5-year rule (5 years after the END of the document's financial year, the conservative/defensible reading) to tax-substantiation categories only (RECEIPT/INVOICE/TAX/STATEMENT). Returns `RETAIN | ARCHIVE_SAFE | NO_CLOCK` + a warm label + `retainUntil`. Surfaced (computed, not stored — SSOT) on the `/api/documents` list response; `DocumentList` shows a quiet "Safe to archive" pill on `ARCHIVE_SAFE` docs only. **Advice only — never auto-archives** (autonomy decision + financial-adviser lens: never nudge binning a record the ATO might still want; contracts/leases/insurance/PDS get NO_CLOCK because they have ongoing relevance). 10 tests.
   - **D.5a — renewal/expiry extraction → reminder engine ✅ SHIPPED (Stitch-first, 2026-06-19):** the reminder engine (`lib/reminders/reminderEngine.ts`) already projects renewals from dates the user owns. D.5a adds the suggest→confirm surface that feeds it. **Extraction:** added an optional `expiryDate` field to the scan flow's form-autofill extraction (`analyze-for-form` `DEFAULT_EXPENSE_FIELDS`) — populated only for policy/registration/warranty docs, null for ordinary receipts. **Surface (Reza: "in the scan flow"):** when the global "Scan a receipt" flow recognises a renewal date, after the expense save it shows the new `RenewalReminderCard` (Stitch-first, §18.2.1) — a calm sky→teal "safety-net" card; the date is **pre-filled but editable**, the user explicitly taps "Set reminder" or "Not now" (never silent). **Write target (v1 decision):** creates a **custom `Reminder`** via the existing `POST /api/reminders/custom` — a **CREATE, not an update**, so no existing asset row is clobbered (§12.11-safe); `computeCustomReminders()` in the same engine projects it into the bell + RenewalsCard with the 30-day window. Writing directly into the typed entity column (`Asset.vehicleInsuranceExpiry` etc., which yields a typed "Vehicle insurance" reminder) is a **v2** — it needs a safe partial-update endpoint first (a naive partial PUT would null sibling expiry fields). No schema change. 4 Stitch variants + 6 tests.
   - Stale-duplicate cleanup suggestions: later refinement on top of D.1's content-hash.

### D.2 Architecture (where each piece lives — SSOT)

- **Dedup + fingerprint:** new `lib/documents/engine/dedup/` (hash + fingerprint), called from `DocumentManagementEngine.processUpload()` **before** the storage write. Returns `{ duplicateOf?: documentId }`.
- **Reconciliation:** `lib/documents/intelligence/reconcile/` — pure functions taking a suggested action + the user's existing records, returning `create | link-existing | ask`. No DB writes (engines stay pure, §6.4); the confirm route applies the verdict.
- **Confidence policy:** a single `lib/documents/intelligence/confidencePolicy.ts` (thresholds + TRAIL-stage modifiers) — the ONE place the autonomy thresholds live, so they're tunable and testable.
- **Routing memory:** a `VendorEntityHint` table (vendor → most-linked entity), updated on every confirmed link; read by `LinkingRules`. Migration required (§12.12).
- **No new endpoint** — these slot into the existing upload/analyze/confirm routes (§12.4 API hygiene).

### D.3 Phased build (each shippable, each behind the existing flow)

| Step | Scope | Risk |
|---|---|---|
| **D.1** | Document-level dedup (hash + fingerprint) in `processUpload` — the direct answer to Reza's report | Low — read-before-write guard |
| **D.2** | Generalise the receipt→expense dedup into `reconcileSuggestedAction()` (covers loan/income too) | Low — extends shipped logic |
| **D.3** | `confidencePolicy.ts` + wire the analyze/confirm flow to it (auto / confirm / ask bands) | Medium — UX + tests |
| **D.4** ✅ | `VendorEntityHint` learned routing (migration + suggest-only pre-select) — SHIPPED 2026-06-18 | Medium — schema + heuristic |
| **D.5** | Lifecycle (renewal extraction → reminders, retention clock) | Medium — ties to reminder engine |

### D.4/D.5 status

D.1 ✅, D.1.1 ✅ (scan/form path now funnels through the DME dedup chokepoint), D.2 ✅, D.3 ✅ (SSOT; auto-exec rejected per autonomy decision), **D.4 ✅ (suggest-only learned routing)**, **D.5b ✅ (retention clock — advisory)**, **D.6 ✅ (bulk-approve Smart Inbox)**, **D.5a ✅ (renewal → reminder, Stitch-first)**. The Phase D engine-intelligence layer is complete. Remaining (lower-priority, carried): Tax-pack export + ATO retention (Phase C), and the D.5a v2 (typed entity-column write, once a safe partial-update endpoint exists).

### D.1.1 — scan/form path funnelled through the DME dedup chokepoint ✅ (2026-06-18)

`/api/documents/analyze-for-form` (the global "Scan a receipt" + form-autofill upload path) called the **legacy** `documentService.uploadDocument()`, which has no content-hash dedup — so scanning the same receipt twice stored a duplicate, bypassing the D.1 chokepoint. Rewired that one call to the canonical **`DocumentManagementEngine.processUpload()`** (via `createUploadContext`, `source` mapped from the form type → `EXPENSE_FORM`/`INCOME_FORM`/`LOAN_FORM`/`PROPERTY_FORM`). The scan path now inherits the `(userId, contentHash)` dedup + the per-user storage-quota enforcement for free; a byte-identical re-scan returns the existing document. Only `documentId` is consumed downstream (the unused `signedUrl`→`storageUrl` swap is inert). No schema change (migration `20260617150000` already added `contentHash`). The other legacy caller (`/api/documents` POST, deprecated since Phase 38 PR2.5) is left as-is — out of scope, low traffic.

### D.6 — bulk-approve Smart Inbox ✅ (Stitch-first, 2026-06-18)

The sanctioned autonomy convenience from the 2026-06-18 decision. The existing inline Smart Inbox (Phase 38 PR2, one-tap-per-row) was **replaced** (§12.1 — not duplicated) by a dedicated `components/documents/SmartInbox.tsx` that adds: (1) **multi-select** with the D.3 **AUTO band pre-selected** (earned-autonomy convenience); (2) per-row **inline edit** of the AI's findings (vendor/amount/date/category) — Reza's "the option to edit the AI findings should always be there"; (3) a **"Approve N selected"** bulk action that loops the SAME SSOT confirm path (`handleConfirmAnalysis` → `POST /api/documents/analyze/confirm`) once per item, so D.2 reconciliation + the receipt-matcher run per item — **no batch shortcut, no silent/background writes**; (4) the approved **Track glass** design (sky→indigo mesh header, glass card, emerald/amber/slate confidence pills from `confidencePolicy`). No new endpoint (§12.4) — reads the same `/api/documents` analysis payload the page already had. Lives as the inbox surface in **My Vault / Documents** (Reza placement decision). 6 tests pin the autonomy contract. **Stitch-first (§18.2.1, §18.7.2 4-variant matrix):** desktop light `ded7fd42483e4944978eaec88e2d283e` · desktop dark `939521f984694b55984d3c423c28003a` · mobile light `6ae7b7cb73874bae82e5d1d751d284b2` · mobile dark `da7e1e4903c34517b0b26e79a32f74e8` (project `1859462351962811110`; artefacts `.stitch/designs/phase50-smart-inbox/`). Removed dead code: the inline inbox JSX + `summariseExtractedData`/`confidenceTone`/`formatActionLabel` page helpers.

---

## Completeness review (delivered to Reza 2026-06-16) — sequenced into B/C

HEIC handling (iPhone), duplicate-receipt detection, owning-legal-entity linking +
multi-link, ATO 5yr retention + Tax-pack export, renewal-date tie-in, per-item
Documents sections everywhere, security/PII (encryption, no-log, purge-on-
deletion), storage-at-scale (→ B-storage / GCS), delete/unlink/version lifecycle.

## Decisions log

| Date | Decision | Rationale |
|---|---|---|
| 2026-06-16 | **Storage = GCS, with per-user quota** | Move bytes off the DB (bytea bloat), scale, and likely fix the analyze 500. Quota bounds growth on both backends. |
| 2026-06-16 | **Household = shared finances incl. documents** | Multi-*user* household accounts don't exist yet. If/when added, all household finances (documents included) are shared — no per-document privacy. No work now; direction settled. |
| 2026-06-16 | **Default quota = 2 GiB** | Generous for a personal receipt/statement vault while bounding unbounded bytea growth; per-user override hook deferred to paid-tier work. |
| 2026-06-16 | **GCS auth = keyless WIF (drop the static key)** | Reuse the DB's passwordless identity (`vercel-monitrax-db`) — no static credential (§13.6). The legacy `monitrax-backend` key path stays supported as a fallback/rollback. |
| **2026-06-18** | **AUTONOMY MODEL — AI always suggests, the user ALWAYS confirms (and can edit). No silent auto-execution.** (Reza, load-bearing.) | Reza, on D.3/D.4: *"I agree and want the user to confirm any ai recognition, user can always have the option to bulk approve if they feel the ai is doing good but the confirmation and the option for user to edit the ai findings should always be there"* and *"learned routing is great however again the user should always confirm."* **Consequences:** (1) D.3 — the AUTO band stays a *display/priority* cue only; auto-EXECUTION (writing a record without confirmation) is **rejected, not merely deferred**. (2) D.4 — learned routing **pre-selects/suggests** the entity; it never auto-applies a link. (3) **Bulk-approve** is the only sanctioned convenience — a user who trusts the AI can approve many items at once, but each item is still an explicit, editable confirmation (no background writes). Behaviour-psychology lens: trust is earned and the human stays in the loop; financial-adviser lens: no number lands on a user's books without their explicit say-so. |

---

## ⚠️ Storage backend — how it resolves, and how to roll back (READ BEFORE TOUCHING GCS ENV VARS)

> Added 2026-06-16. The document storage backend is selected at runtime from env
> vars + IAM. This section is the **operational reference** for the GCS cutover so
> a future session (or 2am operator) can diagnose "why are uploads going to the
> wrong place?" and roll back fast.

### The two questions the code asks

**1. Is GCS configured?** (`computeGcsConfigured`, `lib/documents/storage/factory.ts`)
GCS is the default backend when **both**:
- `GCS_PROJECT_ID` **and** `GCS_BUCKET_NAME` are set (WHERE), **and**
- **either** `GCS_SERVICE_ACCOUNT_KEY` is set (key auth) **or**
  `GCP_WORKLOAD_IDENTITY_PROVIDER` + `GCP_SERVICE_ACCOUNT_EMAIL` are set (keyless WIF — HOW).

If not configured → the factory falls back to **Monitrax (Postgres bytea)**. No error; uploads just land in the DB.

> **History/foot-gun:** before 2026-06-16 this check **required the key**, so
> deleting the key to go keyless silently sent uploads back to the DB. Fixed so it
> accepts keyless WIF. If you see uploads going to the DB after removing the key,
> confirm you're on a build that includes `computeGcsConfigured` (this PR onward).

**2. How does GCS authenticate?** (`GoogleCloudStorageProvider.initialize`)
Resolution order:
1. `GCS_SERVICE_ACCOUNT_KEY` present → **key** auth (impersonates `monitrax-backend`).
2. else keyless WIF env present → **keyless** (`lib/gcp/wifAuthClient.ts`, impersonates `vercel-monitrax-db` — the DB's identity).
3. else → **ADC** (local dev / gcloud).

### IAM required per auth mode (on the `monitrax-documents` bucket)
- **Keyless:** `vercel-monitrax-db@…` needs `roles/storage.objectUser` (object CRUD **+** `buckets.get` for the init preflight). Granted 2026-06-16.
- **Key:** `monitrax-backend@…` has `roles/storage.objectAdmin` + `Storage Admin` (legacy, still in place).

### The zero-downtime cutover sequence (key → keyless)
1. Merge the `computeGcsConfigured` fix (this PR) — **no behaviour change** while the key is still set (key path wins).
2. Grant `vercel-monitrax-db` → `roles/storage.objectUser` on the bucket. (Done 2026-06-16.)
3. **Delete `GCS_SERVICE_ACCOUNT_KEY` from Vercel** → redeploy. Now `computeGcsConfigured` is still true (via WIF), and `initialize` takes the keyless branch.
4. Verify (below).

### Verify it worked (from prod logs)
On the next upload/scan, look for in the runtime logs:
- `[StorageFactory] GCS Configuration: … serviceAccountKey: 'NOT SET (keyless WIF used if available)', keylessWif: 'available', isConfigured: true`
- `[GCS] Using keyless Workload Identity Federation auth`
- the new `Document` row's `storageProvider = GOOGLE_CLOUD_STORAGE` (not `MONITRAX`).

### Failure modes & fixes

| Symptom | Likely cause | Fix / rollback |
|---|---|---|
| Uploads land in the **DB** after removing the key | Build predates `computeGcsConfigured`, OR a WIF env var missing | Confirm this PR is deployed; confirm `GCP_WORKLOAD_IDENTITY_PROVIDER` + `GCP_SERVICE_ACCOUNT_EMAIL` are set |
| GCS upload/init **403 / permission denied** | `vercel-monitrax-db` missing `objectUser` on the bucket | Grant `roles/storage.objectUser` (Step 2) |
| `Bucket … does not exist` on init | `GCS_BUCKET_NAME` wrong, or SA lacks `buckets.get` | Fix the var, or ensure the role is `objectUser` (includes `buckets.get`), not bare `objectAdmin` |
| Keyless token errors (`OIDC token` / STS / impersonation) | WIF chain issue (same as the DB) | See `docs/operational/security/04_WIF_TROUBLESHOOTING.md` — identical mechanism |
| **EMERGENCY ROLLBACK** — GCS broken, need it working NOW | any of the above | **Re-add `GCS_SERVICE_ACCOUNT_KEY`** (the `monitrax-backend` base64 key) in Vercel + redeploy → instantly reverts to the known-good key path. Then debug keyless offline. |

> The key path is the **safety net**: re-adding `GCS_SERVICE_ACCOUNT_KEY` always restores the previously-working behaviour, because `initialize` checks the key first. Keep the `monitrax-backend` key recoverable until keyless is proven in prod.
