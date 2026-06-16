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

- [ ] Per-item **Documents** sections on Asset Spotlight detail pages (Stitch
  design already generated under `.stitch/designs/asset-documents/`).
- [ ] **Tax-pack export** + ATO 5-year retention.
- [ ] Renewal-date tie-in (insurance/rego docs surface their renewal).

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
