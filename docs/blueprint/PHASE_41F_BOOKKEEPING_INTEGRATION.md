# Phase 41f — Personal Bookkeeping Integration

> **Status:** 🟢 **APPROVED 2026-05-07** — Reza signed off on D-41F-1 → D-41F-5 + §1.1 scope boundary + §1.2 data-conflict strategy. 41f.0 ✅ PR #690; 41f.1 ✅ PR #691; 41f.2 ✅ PR #692; 41f.3 ✅ PR #693; 41f.4 next.
> **Estimated effort:** ~10 days across 5 sub-PRs (41f.0 design doc → 41f.4 trust-deed parser). +5 days for **Phase 41f.5 Monitrax Express** (separate doc — see §16 + `PHASE_41F_5_MONITRAX_EXPRESS.md`).
> **Hard prerequisite:** Phase 41a (`LegalEntity`) ✅, Phase 41e (`MasterTaxPosition` orchestrator) ✅, Phase 26 (Document Intelligence) ✅. All shipped.
> **Last updated:** 2026-05-07 — §1.1 + §1.2 + §16 added; sign-off ticks flipped.

---

## 1. Strategic positioning

Reza's brief, locked in via `IMPLEMENTATION_PLAN.md` Up Next #30:

> "Monitrax does **NOT** replace Xero — Monitrax **CONSUMES** Xero data and re-presents it through the wealth-strategy lens."

This single sentence constrains the entire phase. We are **not** building accounting software. We are pulling a **snapshot** (Balance Sheet + P&L summary + key metrics) from a user's existing bookkeeping system and re-presenting it inside their **wealth view** so that:

- The user sees their personal Pty Ltd / Sole Trader / Trust / SMSF as a first-class node in their **net-worth** calculation, with real numbers, not user-entered estimates.
- The **Phase 41e tax engine** receives high-confidence inputs for Div 7A (`distributableSurplus`), Div 6E (trust streaming), Div 165 (company loss continuity), Sch 2F (trust loss continuity), GST (BAS labels), and depreciation schedules.
- The user's **wealth-strategy advisor** (Phase 41h) can reason about entity-level performance without the user re-entering data already in Xero.

What we are **NOT** building (always-deferred to PROD):

- Bidirectional sync (write back to Xero)
- Transaction-level data import (only summary-level metrics)
- Multi-tenant Xero support per user (one entity = one tenant connection at v1)
- Custom chart-of-accounts mapping (we accept Xero's defaults at v1)

---

## 1.1 What Phase 41f is NOT — explicit scope boundary

> **Reza confirmation 2026-05-07**: *"I don't want Monitrax to create legal documents. Just storing them and understanding the structure or contents is enough."*

Phase 41f is **storage + understanding only**. Locked in to prevent scope drift in any future sub-PR or follow-up:

| Monitrax DOES | Monitrax DOES NOT |
|---|---|
| Store the user's existing trust deed PDF (Phase 26 vault) | ❌ Generate, draft, or create new trust deeds (that is a solicitor's job) |
| Read + structurally understand the deed (OCR + Gemini extract) | ❌ Provide template trust deeds |
| Surface our reading to the user for confirmation (4-step flow §7) | ❌ Modify the user's uploaded PDF in any way |
| Use the user's CONFIRMED reading as input to OUR tax engine (Phase 41e) | ❌ Issue distribution minutes / resolutions on the user's behalf |
| Pull a Balance Sheet + P&L SNAPSHOT from Xero (read-only) | ❌ Write back to Xero (no bidirectional sync, ever — at least not in 41f scope) |
| Cache the snapshot in `EntityAccountingSnapshot` for tax-engine consumption | ❌ File anything with the ATO, ASIC, or any regulator |
| Surface UNCOMPUTED notes when the AI is unsure ("Clause 5.2 references 'majority quorum' — review with adviser") | ❌ Replace what a solicitor / accountant / tax agent does — these surfaces ROUTE TO the Phase 32C marketplace via Ask-a-Pro CTAs |

**Why this boundary matters.** Creating legal documents requires AFSL / TPB / NCCP licensing Monitrax does not hold (the same D-2 boundary Phase 41h enforces structurally in the AI advisor). Trust-deed parsing is in scope because **reading and understanding what's already there** is fundamentally different from **drafting new clauses**. The 4-step confirm-before-apply flow (§7) is the user-facing contract that "we read it, you confirm it, we use it for OUR tax math — your deed and your solicitor relationship are unchanged."

**Reviewer enforcement.** Any future PR that introduces deed-generation, distribution-minute issuance, regulator-filing, or Xero write-back must be rejected by reviewers and re-scoped through a fresh design doc with explicit Reza sign-off on a new D-41F-N decision. The current §1.1 boundary is non-negotiable for the duration of Phase 41f.

---

## 1.2 Data-conflict strategy — when Xero and Monitrax disagree

> **Reza brief 2026-05-07**: *"For example if we have a transaction that has 2 different categories in the Xero and Monitrax what will be the action ? or any other concerns that you can think of ?"*

**The good news for v1**: Phase 41f.3 (shipped) only pulls **aggregated** data — Balance Sheet totals + P&L summary. There's no transaction-level data, so per-transaction category conflict is **structurally impossible** in 41f's current scope. The strategy below is the locked-in plan for the eventual transaction-level pull (PROD-deferred per §11).

**The model when transactions land**: **Xero owns the transaction record. Monitrax owns the wealth-strategy lens on top.** They're orthogonal views of the same data, not competing sources of truth.

| Concern | What we DO | What we DON'T do |
|---|---|---|
| Categorisation conflict (Xero says "Office Supplies", Monitrax wealth-lens says "Business · Operations") | Display **both** — `[Xero] Office Supplies` AND `[Wealth lens] Business · Operations`. Same row, two perspectives. | Never overwrite Xero's category. Never silently re-classify. |
| Amount mismatch (rounding, FX) | Use Xero's AUD-equivalent. Surface FX rate + date stamp. | Re-derive amounts from raw FX feeds. |
| Reconciliation status (un-reconciled invoice) | Mark as `UNRECONCILED` in our import; exclude from cashflow tile by default; surface UNCOMPUTED `UC-XERO-UNRECONCILED-EXCLUDED`. | Treat un-reconciled txns as final. |
| Year-end adjustments missing mid-year | Surface UNCOMPUTED `UC-XERO-MID-YEAR-PROVISION` on every snapshot pulled before EOFY rollover. | Pretend mid-year P&L is the final position. |
| User edits a number we imported | Block the edit on imported fields with a tooltip: *"This figure comes from Xero. Disconnect to manually edit, or make the change in Xero."* | Allow silent local override. |

**Provenance is the structural defence**: every imported number stamps `sourceProvider + sourceTenantId + pulledAt + pulledByUserId` (already shipped in the 41f.1 schema + 41f.3 puller). This means we can ALWAYS answer "where did this number come from?" — and the user always sees that source label.

### 1.2.1 Risks logged for the transaction-level scope-up

These are deferred to a future PR (post-41f core); listed here so they're not lost:

| # | Risk | v1 Mitigation | Future scope |
|---|---|---|---|
| 1 | **Multi-currency** (USD invoices on AUD-reported entity) | Pull AUD-equivalent from Xero's report; surface `UC-XERO-MULTI-CCY` if FX activity is detected | Pull both currencies in transaction-level PR |
| 2 | **Custom fiscal year** (calendar year for SMSF; 52-week for retail) | v1 default = AU FY. Add `LegalEntity.fiscalYearEnd` field + per-entity override | Phase 41f.6 follow-up |
| 3 | **Multiple Xero tenants per user** | UC-XERO-MULTI-ENTITY-SAME-TENANT (§9). v1 picks the first; user can disconnect/reconnect | UI to select tenant |
| 4 | **Bank reconciliation status** | Pull only `Reconciled = true` transactions when transactions land; flag un-reconciled separately | Live recon-state polling |
| 5 | **Stale data after Xero change** | Show *"Pulled N hours ago"* + manual Refresh (already shipped 41f.3) | Cloud Tasks scheduled refresh + Xero webhooks |
| 6 | **Rate-limiting** (Xero: 60/min/tenant, 10K/day/app) | 24h `EntityAccountingSnapshot` cache + manual-refresh debounce + exponential backoff in `snapshotPuller` | Per-user request budget tracker |
| 7 | **Year-end accountant adjustments missed** | UNCOMPUTED `UC-XERO-MID-YEAR-PROVISION` whenever pull-date is between Jul 1 and accountant lodgment cutoff | Detect EOFY adjustment journal posts via webhook |
| 8 | **Snapshot becomes stale after disconnect** | Mark snapshot rows with `staleSince: Date` when integration disconnects; tax engine reads stale flag and surfaces UNCOMPUTED rather than silently consuming | Hard-delete option |
| 9 | **Sensitive data in P&L line items** (employee names in payroll) | `sanitizeMetadata()` strips before any audit log; `rawProviderPayload` JSON server-side-only (already shipped 41f.3) | Cloud DLP scan on raw payload before persist |
| 10 | **Tracking categories / cost centres** (Xero feature) | v1 ignores them; surface `UC-XERO-TRACKING-CATEGORIES-IGNORED` if any are present | Phase 41f.7 follow-up if user demand emerges |

---

## 2. The four lenses that drove this design

Per CLAUDE.md §0, every Monitrax design decision is screened through four advisor lenses simultaneously. The design choices below were driven as follows:

| Lens | What it asked | What it locked in |
|---|---|---|
| **Architect** | Does this duplicate the Phase 32 `AccountingIntegration` model? Does it survive being read 6 months from now? | **D-41F-1** — extend the existing model with a discriminator (Option A) rather than fork a new one. Reuses the OAuth + sync-log + entity-mapping infrastructure already shipped for Phase 32. |
| **Financial adviser** | Will the user be financially better off, after-tax + after-fees + after-risk? Are we ever quoting numbers we can't trace to canonical data? | **HR-1 preserved structurally** — every imported number is persisted to a typed `EntityAccountingSnapshot` row with a `sourceProvider` + `sourceTenantId` + `pulledAt` audit trail. The Phase 41h AI advisor's `getEntityTaxPosition` tool consumes from this snapshot, not from raw Xero JSON. |
| **Designer** | Does this look like Apple Wallet or like a settings page? | "**Connect Xero**" verb-CTA on the entity drawer (warm-amber tile, single button, no "OAuth scope explanation" wall-of-text); status-aware ("Connected / Snapshot from 4 hours ago / Refresh"); trust-building copy ("We pull a balance sheet snapshot. Your books stay in Xero."). |
| **Behaviour psychologist** | Does this reduce cognitive tax? Does it reassure? | **D-41F-3** — trust deed parsing runs as a **4-step confirm-before-apply** flow (upload → AI extract → user reviews each rule → user approves). NEVER auto-apply legal-instrument interpretation. |

---

## 3. Existing building blocks (verified 2026-05-07)

### 3.1 Schema scaffold — Phase 32 portal

| Surface | Path | Status |
|---|---|---|
| `AccountingProvider` enum | `prisma/schema.prisma:3399` | ✅ Exists. Values: `XERO / MYOB / QUICKBOOKS / SAGE / FRESHBOOKS / WAVE / OTHER`. |
| `AccountingIntegration` model | `prisma/schema.prisma:3706` | ✅ Exists. Org-scoped (`organizationId` non-null, `@@unique([organizationId, provider])`). OAuth fields, sync-tracking fields, `IntegrationSyncLog` + `IntegrationEntityMapping` relations all already wired. |
| `IntegrationSyncDirection` enum | `prisma/schema.prisma:3409` | ✅ `OUTBOUND / INBOUND / BIDIRECTIONAL`. Phase 41f uses **`INBOUND` only**. |
| `IntegrationSyncStatus` enum | `prisma/schema.prisma:3415` | ✅ `PENDING / IN_PROGRESS / COMPLETED / FAILED / PARTIAL`. |

### 3.2 Service stubs — Phase 32 portal

`lib/portal/services/integrations.ts` — `createIntegrationsService(orgId)` exposes:
- `.list()`, `.get()`, `.getAuthUrl()`, `.connect()`, `.disconnect()`, `.updateSettings()`, `.sync()`, `.getSyncStatus()`, `.listSyncLogs()`
- `.xero.getTenants()`, `.xero.selectTenant()`, `.xero.getContacts()`, `.xero.mapClient()`
- `.myob.getCompanyFiles()`, `.myob.selectCompanyFile()`

Phase 41f reuses the orchestration layer and adds a **personal-scope** caller path. The OAuth handshake, token-refresh, and sync-log persistence are all reused as-is.

### 3.3 LegalEntity (Phase 41a) — host for accounting metadata

`prisma/schema.prisma:411` — `LegalEntity` model exists. No `metadata`/`externalIds` field today. Phase 41f does NOT add fields to `LegalEntity` — instead it adds a 1:1 `EntityAccountingSnapshot` table keyed by `legalEntityId`. Keeps `LegalEntity` lean.

### 3.4 Document Intelligence + Gemini — for trust deed parsing

| Module | Path | Phase 41f use |
|---|---|---|
| Vision OCR | `lib/documents/intelligence/services/visionService.ts` | Extract raw text from uploaded trust-deed PDFs (deterministic, audit-trail). |
| Gemini SDK | `lib/ai/gemini.ts` (`getGeminiClient()`) | Structures OCR text into typed `TrustDeedExtractedRules`. NEVER applies them — user confirms each. |
| Tax-advisor Gemini provider | `lib/ai/tax-advisor/providers/geminiProvider.ts` | NOT reused for trust-deed parsing — that provider is gated to the strict tool-calling registry. Phase 41f trust-deed needs free-form structured extraction. New `lib/ai/trust-deed/geminiExtractor.ts` adapter. |

### 3.5 What's NOT in place

- No `xero-node` SDK installed (`package.json`)
- No `intuit-oauth` (QuickBooks) SDK
- No accounting endpoints in `app/api/portal/` or `app/api/`
- No spec doc (this is it)

---

## 4. Architecture decision — D-41F-1: schema scope

Two options for housing personal-entity bookkeeping connections:

### Option A — Extend `AccountingIntegration` with a scope discriminator (RECOMMENDED)

Add nullable `userId` + `legalEntityId` + a new `scope` enum (`ORG | USER_ENTITY`) to the existing model. App-level invariant: exactly one of `(organizationId)` or `(userId + legalEntityId)` is set, enforced by a Postgres `CHECK` constraint.

```prisma
enum AccountingIntegrationScope {
  ORG          // Phase 32 portal — adviser org connecting their own books
  USER_ENTITY  // Phase 41f — consumer user connecting their personal entity's books
}

model AccountingIntegration {
  id    String                      @id @default(uuid())
  scope AccountingIntegrationScope  @default(ORG)

  // Phase 32 — set when scope = ORG
  organizationId String?

  // Phase 41f — set when scope = USER_ENTITY
  userId        String?
  legalEntityId String?

  // ... (existing OAuth + sync fields unchanged)

  // Replaces the old @@unique([organizationId, provider])
  // Two partial unique indexes (raw SQL in the migration since Prisma
  // doesn't natively model `WHERE` clauses on @@unique)
  @@index([organizationId])
  @@index([legalEntityId])
  @@index([userId])
  @@index([provider])
  @@map("accounting_integrations")
}
```

**Migration SQL (additive, but touches existing constraint — §12.11 checklist required):**

```sql
-- 1. Add the scope discriminator + nullable user-scope columns
ALTER TABLE accounting_integrations
  ADD COLUMN scope TEXT NOT NULL DEFAULT 'ORG',
  ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN legal_entity_id TEXT REFERENCES legal_entities(id) ON DELETE CASCADE;

-- 2. Make organizationId nullable (was previously NOT NULL)
ALTER TABLE accounting_integrations
  ALTER COLUMN organization_id DROP NOT NULL;

-- 3. Drop the old unique constraint
DROP INDEX IF EXISTS accounting_integrations_organizationId_provider_key;

-- 4. Add per-scope partial unique indexes
CREATE UNIQUE INDEX accounting_integrations_org_provider_uniq
  ON accounting_integrations (organization_id, provider)
  WHERE scope = 'ORG';

CREATE UNIQUE INDEX accounting_integrations_entity_provider_uniq
  ON accounting_integrations (legal_entity_id, provider)
  WHERE scope = 'USER_ENTITY';

-- 5. XOR invariant via CHECK constraint
ALTER TABLE accounting_integrations
  ADD CONSTRAINT accounting_integration_scope_check
  CHECK (
    (scope = 'ORG'
       AND organization_id IS NOT NULL
       AND user_id IS NULL
       AND legal_entity_id IS NULL)
    OR
    (scope = 'USER_ENTITY'
       AND organization_id IS NULL
       AND user_id IS NOT NULL
       AND legal_entity_id IS NOT NULL)
  );

-- 6. Indexes for the new columns
CREATE INDEX accounting_integrations_user_id_idx ON accounting_integrations (user_id);
CREATE INDEX accounting_integrations_legal_entity_id_idx ON accounting_integrations (legal_entity_id);
```

**§12.11 destructive-write checklist (filled in advance):**
1. `where` clause matches: N/A — pure ALTER TABLE / CREATE INDEX (no row updates).
2. Columns overwritten / rows deleted: none.
3. Guard ensuring this only mutates rows I created: N/A — schema only. Verified via `SELECT COUNT(*) FROM accounting_integrations` pre-flight (expected: 0 rows in dev/prod since no Phase 32 portal user has connected accounting yet — confirmed by zero references in `lib/portal/services/integrations.ts` callers shipping outside the stub layer).

**Pros (Option A):**
- Reuses Phase 32 OAuth + sync-log + entity-mapping infrastructure verbatim
- Single canonical caller pattern (the polymorphic identifier passes through one service)
- Schema migration is additive; no row mutations
- Future Phase 32 portal advisers can offer "connect this client's bookkeeping for me" using the same model with `legalEntityId` set

**Cons (Option A):**
- Slight cognitive load on readers — one model now has two scopes
- The XOR check constraint adds a new failure mode (if a buggy insert sets neither or both scopes, the row rejects). Mitigation: app-level constructor (`createAccountingIntegrationFor*Scope`) enforces the invariant before insert.

### Option B — New `EntityAccountingIntegration` model

A dedicated user-scope model. `legalEntityId` + provider unique pair. No `organizationId` field at all.

**Pros:** Cleaner per-row scope (every row is unambiguously one shape).
**Cons:** Duplicates ~95% of the Phase 32 schema (OAuth fields, sync fields, sync-log relation, entity-mapping relation). Two services drift over time. Two migration paths every time we touch OAuth scoping. Reviewers in 6 months don't know which model to use for adviser-on-behalf-of-client connections (a PROD-stage requirement).

**Decision: Option A, RECOMMENDED.** Cleaner reuse + future-proof for adviser-impersonation use case + minimal migration risk (zero existing rows).

---

## 5. Sub-PR sequence (5 PRs, ~10 days)

| Sub-PR | Scope | Estimated days | Ships independently? |
|---|---|---|---|
| **41f.0** | This design doc + Reza sign-off block. **You are reading 41f.0.** No code; doc-only PR for sign-off. | 1 | ✅ Yes — isolated doc |
| **41f.1** | Schema migration (Option A) + new `EntityAccountingSnapshot` model + Prisma client update + UNCOMPUTED register entries. **No service or UI changes** — pure schema. | 1 | ✅ Yes — additive, gated by §12.11 + §12.12 |
| **41f.2** | Xero OAuth + connect surface. New `lib/integrations/xero/` module (oauth helper, token-refresh scheduler, tenant resolver). New `/dashboard/entities/[id]/connect-bookkeeping` page (the "Connect Xero" surface). New `/api/entities/[id]/accounting/oauth/[start\|callback]` routes. Persists OAuth tokens to `AccountingIntegration` (USER_ENTITY scope). NO data import yet. | 3 | ✅ Yes — connect-only flow; integration sits idle until 41f.3 |
| **41f.3** | Snapshot import pipeline. New `lib/integrations/xero/snapshotPuller.ts` (BS + P&L + distributable-surplus calc per s109Y). New `EntityAccountingSnapshot` write path (idempotent on `(legalEntityId, fiscalPeriod)` — overwrites stale snapshots). New entity-detail UI surface rendering BS + P&L + key ratios + "Last refreshed N hours ago" + manual refresh button. **Wires distributable-surplus into Phase 41e.6 Div 7A classifier** as the canonical input (replaces user-entered estimate). | 3 | ✅ Yes — needs 41f.1 + 41f.2 merged |
| **41f.4** | Trust deed parser. New `lib/integrations/trust-deed/` (Vision OCR + Gemini structurer). New `TrustDeedExtractedRules` Prisma model. New `/dashboard/entities/[id]/trust-deed/upload` 4-step UI (upload → extract → user-confirms-each-rule → apply). Wires confirmed rules into Phase 41e.4 (Div 6E streaming) + Phase 41e.5 (s100A zone classifier). | 2-3 | ✅ Yes — independent of 41f.2/3 (different file pathway) |

**Sequencing rule:** 41f.0 must merge before 41f.1; 41f.1 must merge before 41f.2 (needs schema); 41f.2 must merge before 41f.3 (needs OAuth). 41f.4 can ship in parallel with 41f.2/3 because trust deed parsing has no dependency on the Xero OAuth module.

---

## 6. New schema additions (Phase 41f.1 will ship these)

### 6.1 `EntityAccountingSnapshot` (new table)

Caches the latest BS + P&L + key metrics per `(legalEntityId, fiscalPeriod)`. Idempotent on overwrite.

```prisma
model EntityAccountingSnapshot {
  id            String        @id @default(uuid())
  legalEntityId String
  legalEntity   LegalEntity   @relation(fields: [legalEntityId], references: [id], onDelete: Cascade)

  // Provenance
  sourceProvider    AccountingProvider
  sourceTenantId    String              // Xero tenant ID, MYOB company file
  pulledAt          DateTime            @default(now())
  pulledByUserId    String              // Audit trail — who triggered the pull

  // Period
  fiscalPeriod      String              // "FY24-25" or "2024-Q4" or "2025-01"
  periodStartDate   DateTime
  periodEndDate     DateTime

  // Balance Sheet (top-level only — no transaction detail)
  totalAssets         Decimal             @db.Decimal(18, 2)
  totalLiabilities    Decimal             @db.Decimal(18, 2)
  totalEquity         Decimal             @db.Decimal(18, 2)
  cashAndEquivalents  Decimal?            @db.Decimal(18, 2)
  tradeReceivables    Decimal?            @db.Decimal(18, 2)
  inventoryValue      Decimal?            @db.Decimal(18, 2)
  fixedAssetsNet      Decimal?            @db.Decimal(18, 2)
  tradePayables       Decimal?            @db.Decimal(18, 2)
  shortTermDebt       Decimal?            @db.Decimal(18, 2)
  longTermDebt        Decimal?            @db.Decimal(18, 2)
  retainedEarnings    Decimal?            @db.Decimal(18, 2)

  // P&L Summary
  revenue             Decimal             @db.Decimal(18, 2)
  costOfGoodsSold     Decimal?            @db.Decimal(18, 2)
  operatingExpenses   Decimal             @db.Decimal(18, 2)
  netProfitBeforeTax  Decimal             @db.Decimal(18, 2)
  taxExpense          Decimal?            @db.Decimal(18, 2)
  netProfitAfterTax   Decimal             @db.Decimal(18, 2)
  depreciation        Decimal?            @db.Decimal(18, 2)
  interest            Decimal?            @db.Decimal(18, 2)

  // Tax-engine inputs (computed at pull time, not stored as raw Xero data)
  distributableSurplus  Decimal?  @db.Decimal(18, 2)  // s109Y for Div 7A — only set for COMPANY entities
  trustNetIncome        Decimal?  @db.Decimal(18, 2)  // s95 for Div 6E — only set for trust entities
  smsfMemberBalances    Json?                          // for SMSF — array of {memberId, totalBalance, accumulationBalance, pensionBalance}

  // Raw payload for forensic / debug / re-derivation if our shape changes
  rawProviderPayload    Json

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([legalEntityId, fiscalPeriod])
  @@index([legalEntityId])
  @@index([sourceProvider])
  @@index([pulledAt])
  @@map("entity_accounting_snapshots")
}
```

### 6.2 `TrustDeedExtractedRules` (new table — for 41f.4)

```prisma
model TrustDeedExtractedRules {
  id            String        @id @default(uuid())
  legalEntityId String
  legalEntity   LegalEntity   @relation(fields: [legalEntityId], references: [id], onDelete: Cascade)

  // Provenance
  uploadedDocumentId String              // FK to existing Document model
  extractedAt        DateTime            @default(now())
  extractorVersion   String              // "gemini-2.0-flash@2026-05" — for re-extraction tracking
  extractedByUserId  String

  // Approval lifecycle (4-step flow per D-41F-3)
  status             TrustDeedRuleStatus  @default(EXTRACTED)
  // EXTRACTED → user reviewed but not yet confirmed
  // CONFIRMED  → user approved each rule, applied to tax engine
  // REJECTED   → user rejected the extraction; will not feed into tax engine
  confirmedAt        DateTime?
  rejectedAt         DateTime?
  rejectionReason    String?

  // Extracted rules — typed JSON. Validated against Zod schema at write time.
  beneficiaries          Json   // Array of {name, type: PRIMARY|GENERAL|DEFAULT, percentageEntitlement?, conditions?}
  distributionRules      Json   // Array of {type: DISCRETIONARY|PROPORTIONATE|FIXED, ...}
  vestingDate            DateTime?
  trusteePower           Json?  // {appointor, removalRights, etc.}
  loanProvisions         Json?  // For Div 7A — sub-trust UPE clauses
  uncomputedNotes        Json   // Array of clauses Gemini flagged as "I'm unsure"

  // Forensic
  rawExtractorPayload    Json   // Full Gemini response for re-derivation if our schema changes

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([legalEntityId])
  @@index([status])
  @@map("trust_deed_extracted_rules")
}

enum TrustDeedRuleStatus {
  EXTRACTED
  CONFIRMED
  REJECTED
}
```

---

## 7. Trust deed parsing flow — D-41F-3 (4-step confirm-before-apply)

A trust deed is a legal instrument. AI extraction is a starting point, not a source of truth. The user MUST confirm each rule before any tax-engine consumes it.

```
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: Upload                                                  │
│  PDF → Document model (Phase 26 vault) → kicks off OCR          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: Extract                                                 │
│  OCR text → Gemini structurer → TrustDeedExtractedRules row     │
│  (status = EXTRACTED)                                            │
│                                                                  │
│  UNCOMPUTED flags surface anywhere Gemini was unsure:            │
│  - "Clause 5.2 references 'majority quorum' — review with       │
│     adviser; we did not interpret this rule."                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Step 3: User reviews                                            │
│  - Each beneficiary listed with confidence score                │
│  - Each distribution rule shown plain-English                   │
│  - User can edit / strike / accept each rule individually       │
│  - User reads UNCOMPUTED notes verbatim                         │
│  - "Send to my adviser" affordance (Phase 32C marketplace)      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Step 4: Confirm + apply                                         │
│  - User clicks "Confirm and apply"                              │
│  - status = CONFIRMED                                            │
│  - Tax engine reads TrustDeedExtractedRules at calculation      │
│    time (NOT before — engine is pure; rules are an input)       │
│  - Audit log: TRUST_DEED_RULES_CONFIRMED                        │
└─────────────────────────────────────────────────────────────────┘
```

**Reza note:** if you push back on the 4-step flow as too heavy, the alternative is a 2-step (upload → auto-apply with revert affordance). I'd push back hard on that — a trust deed misinterpretation has tax + legal blast radius. The 4-step costs the user ~5 minutes once per deed and protects against a misread that propagates into Div 6E streaming for years.

---

## 8. Strategic decisions requiring sign-off (D-41F-1 through D-41F-5)

| # | Decision | My recommendation | Open / Confirmed |
|---|---|---|---|
| **D-41F-1** | Schema scope: extend `AccountingIntegration` with discriminator (Option A) or new `EntityAccountingIntegration` model (Option B) | **Option A** — reuses Phase 32 infrastructure, additive migration, future-proofs adviser-impersonation. | OPEN |
| **D-41F-2** | SDK scope at v1: Xero only? MYOB stub? QuickBooks stub? | **Xero only at v1.** MYOB + QuickBooks → v2 (the existing enum keeps them open; UI can show "MYOB — Coming soon" tile). Reza's positioning quote names Xero specifically. | OPEN |
| **D-41F-3** | Trust deed flow: 4-step confirm-before-apply, or 2-step auto-apply-with-revert? | **4-step.** Trust deed misinterpretation has tax + legal blast radius; the friction is the feature. | OPEN |
| **D-41F-4** | Where does imported P&L data render at v1? Entity detail page only, or also surface in Money Flow Sankey (Phase 41d)? | **Entity detail only at v1.** Sankey integration → v2. Avoids Phase 41d Sankey re-think under time pressure. | OPEN |
| **D-41F-5** | Distributable surplus → Div 7A classifier — auto-feed (with audit log + per-loan override), or require user confirmation per FY? | **Auto-feed with audit log + per-loan override.** Keeps the engine flowing; user friction only when they want to override. | OPEN |

---

## 9. UNCOMPUTED register (v1)

Items where Phase 41f explicitly does NOT compute and surfaces an UNCOMPUTED flag:

| Code | Rule | Reason |
|---|---|---|
| `UC-XERO-DEFERRED-TAX` | Deferred tax assets/liabilities not derived from Xero snapshot | Xero P&L doesn't expose deferred-tax detail; would require chart-of-accounts mapping (PROD scope). |
| `UC-XERO-RELATED-PARTY` | Related-party transactions in BS not flagged | Xero does not natively classify related-party; user-flagged in v2. |
| `UC-DIV7A-DISTRIBUTABLE-SURPLUS-ESTIMATE` | `distributableSurplus` computed as `retained earnings + current year profit − prior franking debits` (s109Y simplified) | Full s109Y requires off-Xero data (franking account balance from prior FY tax returns); v1 surfaces best-estimate with caveat. |
| `UC-TRUST-DEED-CLAUSE-AMBIGUOUS` | Specific deed clause Gemini could not unambiguously structure | Surfaced verbatim to user; user reads + decides; never auto-fed. |
| `UC-TRUST-DEED-VESTING-DATE-MISSING` | Vesting date not extractable from PDF | Common in older deeds; user enters manually if known. |
| `UC-TRUST-DEED-AMENDMENT-CHAIN` | Multiple amendment deeds not stitched | v1 reads one deed at a time; user uploads the latest. |
| `UC-MYOB-NOT-AVAILABLE` | User has MYOB but only Xero is supported at v1 | Surfaces "MYOB integration coming soon" with a "Notify me" affordance. |
| `UC-XERO-MULTI-ENTITY-SAME-TENANT` | One Xero tenant containing multiple legal entities the user owns | v1 maps one Xero tenant to one `LegalEntity`; user reconciles manually if their tenant carries multiple entities. |

---

## 10. CDR / privacy considerations (CLAUDE.md Part 13)

| Concern | How it's handled |
|---|---|
| **Is Xero data CDR-regulated?** | No — Xero accounting data is NOT under the CDR open-banking regime (which covers banks + super + telco). It is general business data subject to standard Privacy Act 1988 protections + Xero's own ToS. Treat as **non-CDR business data** for handling purposes. |
| **PII leakage** | Imported Xero data may carry employee names (payroll), supplier names (AP), customer names (AR) — all treated as **standard PII**. Audit logs sanitised through `sanitizeMetadata()`; never logged in plain text. |
| **Trust deed PDF** | Often contains beneficiary names, TFNs, addresses. Stored encrypted-at-rest in Cloud Storage (existing Phase 26 vault infrastructure). Gemini API call sends OCR text; CLAUDE.md §13.3 sanitisation removes any explicit TFN before transmission. |
| **OAuth token storage** | Persisted in `AccountingIntegration.accessToken` / `refreshToken` — `@db.Text` columns are CMEK-encrypted at the Cloud SQL layer (existing Phase 9 infrastructure). Token refresh runs server-side; token never sent to client. |
| **Disconnect** | User can disconnect at any time → soft-delete the `AccountingIntegration` row + revoke the Xero refresh token via Xero API. Snapshot history retained (the data is now historical record, not live link); user can hard-delete via "Delete all bookkeeping data for this entity" affordance. |
| **Right to erasure** | Cascading delete from `LegalEntity` flows through `EntityAccountingSnapshot` + `TrustDeedExtractedRules` (both have `onDelete: Cascade`). |

---

## 11. Out of scope (deferred to v2 / PROD)

- **Bidirectional sync** (writing back to Xero — invoice creation, payment reconciliation)
- **Transaction-level data** (only summary BS + P&L at v1; transactions stay in Xero)
- **MYOB integration** (Reza's positioning names Xero; MYOB = v2)
- **QuickBooks integration** (smaller AU market; v2)
- **Multi-tenant Xero per entity** (one tenant = one entity at v1)
- **Custom chart-of-accounts mapping** (Xero defaults at v1)
- **Real-time webhook sync from Xero** (polling at v1; webhooks = PROD)
- **Adviser-impersonation flow** (Phase 32 portal adviser connecting client books on behalf — D-41F-1 keeps the schema future-proof for this; UI = PROD)
- **Trust deed amendment chain** (one deed at a time at v1; UC-TRUST-DEED-AMENDMENT-CHAIN flag)
- **Money Flow Sankey integration** (entity detail only at v1; Sankey = v2 per D-41F-4)
- **Cloud Tasks scheduled refresh** (manual refresh at v1; auto-refresh via Cloud Scheduler = PROD)

---

## 12. Reza sign-off block — ✅ APPROVED 2026-05-07

All ticks confirmed via Reza's "go with your recommendations" 2026-05-07 + deed-flow scope confirmation 2026-05-07 + data-conflict strategy + Monitrax Express scope confirmation 2026-05-07.

- [x] **D-41F-1** confirmed: extend `AccountingIntegration` with scope discriminator (Option A) — shipped 41f.1 PR #691
- [x] **D-41F-2** confirmed: Xero only at v1; MYOB + QuickBooks → v2
- [x] **D-41F-3** confirmed: 4-step trust deed flow (upload → extract → review → apply) — reinforced by §1.1 scope-boundary
- [x] **D-41F-4** confirmed: imported P&L renders on entity detail only at v1; Sankey = v2 — shipped 41f.3 PR #693
- [x] **D-41F-5** confirmed: distributable surplus auto-feeds Div 7A with audit log + per-loan override — shipped 41f.3 PR #693
- [x] **CDR posture** confirmed: Xero data treated as non-CDR business data + standard Privacy Act 1988
- [x] **UNCOMPUTED v1 register** approved (8 items in §9)
- [x] **Sub-PR sequence** approved (5 PRs, ~10 days; +5 days for 41f.5 Monitrax Express follow-up)
- [x] **§12.11 destructive-write checklist** acknowledged for the 41f.1 schema migration — shipped PR #691
- [x] **§1.1 scope boundary** confirmed: storage + understanding only; no legal-document generation; no Xero write-back; no regulator-filing
- [x] **§1.2 data-conflict strategy** confirmed: Xero owns transactions; Monitrax owns wealth lens; provenance + UNCOMPUTED for ambiguous cases; 10-row risk register logged for transaction-level scope-up
- [x] **§16 Monitrax Express follow-up** confirmed: Phase 41f.5 captured in `PHASE_41F_5_MONITRAX_EXPRESS.md` for users without Xero subscription

---

## 13. Build risks + mitigations

| Risk | Mitigation |
|---|---|
| Xero rate-limiting on snapshot pull | Exponential backoff in `xero/snapshotPuller.ts`; 24-hour cache TTL on `EntityAccountingSnapshot`; manual-refresh button is debounced. |
| Trust-deed Gemini hallucination | 4-step user confirmation is the primary defence; Gemini also returns confidence per rule; rules below 0.7 confidence default to UNCOMPUTED. |
| OAuth token expiry mid-operation | Token-refresh runs as a server-side helper that wraps every Xero API call; refresh failure → flag the integration as `connectionError = "TOKEN_EXPIRED"` and prompt user to reconnect. |
| Schema migration failure on prod | Migration is additive + the XOR check constraint catches malformed inserts. Rollback plan: drop the new columns + recreate the original `@@unique([organizationId, provider])`. |
| Phase 32 portal flow breakage from schema change | All Phase 32 callers go through `lib/portal/services/integrations.ts` — that file gets a single-line update to set `scope: 'ORG'` when creating new integrations. Existing rows get a `scope = 'ORG'` default in the migration. |
| Distributable surplus mismatch with user's accountant's calc | UC-DIV7A-DISTRIBUTABLE-SURPLUS-ESTIMATE flag surfaces the calc method + invites user to override. Per-loan override (D-41F-5) is the escape valve. |

---

## 14. Test plan (per sub-PR)

| Sub-PR | Test focus |
|---|---|
| **41f.1** | Migration applies cleanly on a fresh DB; XOR check rejects malformed inserts; both partial unique indexes hold; existing Phase 32 callers still function. |
| **41f.2** | OAuth start URL well-formed; callback persists tokens; token-refresh helper handles expiry; disconnect revokes Xero refresh. |
| **41f.3** | Snapshot pull idempotent on `(legalEntityId, fiscalPeriod)`; distributable-surplus calc matches s109Y simplified formula; Div 7A classifier integration end-to-end (user has loan + entity has surplus → classifier reads surplus). |
| **41f.4** | OCR text → Gemini extractor returns Zod-valid `TrustDeedExtractedRules`; status transitions EXTRACTED → CONFIRMED only via 4-step UI; rejected rules never feed tax engine; Phase 41e.4 Div 6E streaming reads from CONFIRMED rules only. |

---

## 15. Approval status

🟢 **APPROVED 2026-05-07.** Sub-PRs 41f.0 → 41f.3 ✅ shipped (PRs #690 / #691 / #692 / #693). 41f.4 (trust-deed parser) is the last sub-PR closing Phase 41f core. After 41f.4, **Phase 41f.5 Monitrax Express** (separate doc) ships next per the sequence in §16 + `IMPLEMENTATION_PLAN.md` Active Workstream §5.

---

## 16. Phase 41f.5 follow-up — Monitrax Express

> **Spec:** `docs/blueprint/PHASE_41F_5_MONITRAX_EXPRESS.md` (this PR).

**Strategic positioning (Reza brief 2026-05-07):**

> "Can Monitrax by itself act as a mini XERO for the user so they don't need to have both systems, and only send the data to the accountant XERO account for professional tidy up?"

**Locked-in answer (full rationale in the 41f.5 spec doc):**

- **Monitrax does NOT replace Xero.** Building a full bookkeeping operating system is a different category — 12+ months of focused engineering against 200+ Xero engineers. Replacing Xero crowds out the wealth-strategy moat.
- **Monitrax DOES offer "Monitrax Express"** — lightweight bookkeeping-lite tier for users who have a personal Pty Ltd / Sole Trader / Trust **but no Xero subscription yet**. Scope: per-entity P&L summary + categorised income/expense (already shipped Phases 1–19 + 41a + 41d) + receipt OCR linkage (Phase 26 already does this) + **NEW: Export-for-Accountant CSV bundle** + **NEW: "Pre-Xero mode" badge** that flips when 41f.2 OAuth lands an integration.

**The migration story:**

| User shape | Monitrax mode |
|---|---|
| No accountant + no Pty Ltd | Personal-name only — already covered by Monitrax core |
| Pty Ltd + no Xero subscription | **Monitrax Express (41f.5)** — categorised income/expense per entity + Export-for-Accountant CSV |
| Pty Ltd + Xero subscribed | **41f.3 connect-flow** ✅ shipped — Monitrax CONSUMES Xero, surfaces wealth lens |
| Complex entities + accountant on Xero | **41f.3 + 41g adviser overlay** ✅ shipped |

The user **never has to choose** "do I do bookkeeping in Monitrax or Xero?" — they migrate naturally as their structure complexity grows. Their accountant gets data they can import on day 1.

**Out of scope for 41f.5** (still PROD-deferred):
- Bank reconciliation
- BAS preparation / lodgment
- STP / payroll
- Inventory / manufacturing / project costing
- Multi-currency invoicing
- Direct Xero write (the user exports CSV; no API push)

**Sequence**: 41f.4 (trust-deed parser, the last sub-PR closing 41f core) → 41i.6 (surface-level audit, the trustworthiness commitment) → 41f.5 (Monitrax Express). Shipping 41i.6 before 41f.5 means Monitrax Express's new surfaces (Books tab + P&L + BS render) get audit coverage from day 1.

See `PHASE_41F_5_MONITRAX_EXPRESS.md` for the full design.
