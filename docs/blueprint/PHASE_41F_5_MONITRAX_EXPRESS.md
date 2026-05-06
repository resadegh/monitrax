# Phase 41f.5 — Monitrax Express (lightweight bookkeeping for pre-Xero users)

> **Status:** 🟡 **DRAFT — awaiting Reza sign-off** on the strategic decisions in §10 before any code lands.
> **Estimated effort:** ~5 days, single PR (most components already exist; this is composition + scoping + the Export-for-Accountant CSV).
> **Hard prerequisite:** Phase 41a (`LegalEntity`) ✅, Phase 1–19 (income/expense entry) ✅, Phase 26 (Document Intelligence + receipt OCR) ✅, Phase 41d (Money Flow Sankey) ✅, Phase 41f.1–4 (Xero integration shipped + spec doc §1 positioning).
> **Last updated:** 2026-05-07 — Claude (initial draft).

---

## 1. Strategic positioning

Reza brief 2026-05-07:

> "Can Monitrax by itself act as a mini XERO for the user so they don't need to have both systems, and only send the data to the accountant XERO account for professional tidy up?"

Phase 41f.5 answers this carefully:

**Monitrax does NOT replace Xero.** Building a full bookkeeping operating system is a different category of product (GL + AR + AP + payroll + bank reconciliation + BAS prep + lodgment) — easily 12+ months of focused engineering, with 200+ engineers' worth of competition already running on the same workflows.

**Monitrax DOES offer "Monitrax Express"** — a lightweight bookkeeping-lite tier for users who have a personal Pty Ltd / Sole Trader / Trust **but no Xero subscription yet** (typically: solo / micro-business / hobby investors at small scale; users who today track expenses in a spreadsheet).

The migration story is natural:

| User shape | Monitrax mode |
|---|---|
| No accountant + no Pty Ltd | Personal-name only → already covered by Monitrax core |
| Pty Ltd + no Xero subscription | **Monitrax Express (this PR)** — categorised income/expense per entity + Export-for-Accountant CSV |
| Pty Ltd + Xero subscribed | **Phase 41f.3 connect-flow** — Monitrax CONSUMES Xero, surfaces wealth lens |
| Complex entities + accountant on Xero | **Phase 41f.3 + 41g adviser overlay** — adviser sees the same canonical view |

The user **never has to choose** "do I do bookkeeping in Monitrax or Xero?" — they migrate naturally as their structure complexity grows. Their accountant gets data they can import on day 1.

---

## 2. Scope boundary — what Monitrax Express IS and IS NOT

| ✓ Monitrax Express DOES | ✗ Monitrax Express DOES NOT |
|---|---|
| Categorised income + expense entry per LegalEntity (already shipped Phase 1–19; Phase 41a's entity layer made it entity-aware) | Double-entry general ledger (Xero / MYOB territory) |
| Personal P&L summary (Phase 41d Money Flow Sankey already does this — 41f.5 surfaces it on entity detail) | AR / AP / customer + supplier ledgers |
| Receipt OCR linkage to expense rows (Phase 26 vault already does this) | Payroll calculation / STP submission |
| Recurring-transaction model (already shipped) | Bank reconciliation matching (Basiq feed → invoice rows) |
| **NEW: Per-entity P&L + BS rendered on entity detail** (composes existing aggregator services per LegalEntity) | BAS preparation / lodgment to ATO |
| **NEW: "Export for accountant" CSV bundle** — categorised entries + receipts + BS + P&L summaries the accountant can import into Xero | Inventory / manufacturing / project costing |
| **NEW: "Pre-Xero mode" badge** on entities without an active integration; flips when 41f.2 OAuth lands | Multi-currency invoicing |

**Why this scope is the right cut**:

- Most bookkeeping mechanics (GL / AR / AP / payroll / bank rec / BAS) require **daily attention** — they're operating-system-level features. Monitrax users who have those needs go to Xero anyway.
- The **wealth-strategy lens** is Monitrax's moat. Express extends the lens to small entities without Xero, NOT toward Xero feature-parity.
- The CSV export is the **smallest possible bridge** to a real accountant — they import once at EOFY (or quarterly), do the actual book closing, and the user gets the wealth lens in between.

---

## 3. The four lenses that drove this scope

| Lens | What it asked | What it locked in |
|---|---|---|
| **Architect** | Reuse what's already shipped. Don't build a parallel bookkeeping engine. | 95% of the work is **composition** — Phases 1–19 + 41a + 41d + 26 already provide the data; 41f.5 surfaces them per entity + adds the CSV export. |
| **Financial adviser** | Real bookkeeping needs daily attention. The "send to accountant for tidy-up" framing breaks if the data isn't reconciled. | CSV export is **explicit about its scope** — categorised data + receipts; the accountant still does bank rec + journal entries + BAS. The CSV is a *feeder*, not a substitute. |
| **Designer** | Restraint over richness. Don't make `/dashboard/entities/[id]` look like Xero. | Express surface is a **single new tab on entity detail** — `Books` — not a sprawling new IA. Two sub-tabs: P&L and BS. Export button is a single CTA. |
| **Behaviour psychologist** | Users who CAN'T do their own books shouldn't be made to feel they SHOULD. Users who CAN need just enough. | Copy is "simple bookkeeping for your own records — your accountant still tidies up." Never "replace your accountant." Never "save on tax." |

---

## 4. Architecture decision — D-41F.5-1: Storage model for Express transactions

**Question**: where do Express bookkeeping entries live? Options:

| Option | Approach | Tradeoff |
|---|---|---|
| **A** | Reuse the existing `Income` + `Expense` Prisma models (already entity-aware via Phase 41a's `legalEntityId` FK). Add a `bookkeepingClassification` field for Express-mode enrichment. | Reuses ALL existing UI + service layer + audit + Phase 26 receipt linkage. Schema additions are tiny. **Recommended.** |
| **B** | New `ExpressLedgerEntry` model. | Forks a parallel transaction model. Doubles the audit + service layer. Drift inevitable. |

**Recommendation: Option A.** The Phase 1–19 transaction layer already supports per-entity scoping (Phase 41a). Express adds a small enrichment field (`bookkeepingClassification: BUSINESS_INCOME | BUSINESS_EXPENSE | OWNER_DRAW | etc.`) plus the CSV-export logic. Zero parallel infrastructure.

---

## 5. Sub-PR sequence (1 PR, ~5 days)

| Sub-PR | Scope | Days |
|---|---|---|
| **41f.5** | Schema enrichment (additive — `Income.bookkeepingClassification` + `Expense.bookkeepingClassification` enum columns; `LegalEntity.expressMode` boolean default `true` for non-Xero entities). New `lib/services/expressBookkeepingService.ts` — composes existing income/expense aggregators per entity to produce a P&L summary + BS-from-snapshot. New API route `GET /api/entities/[id]/express/summary` (P&L + BS for an entity). New API route `GET /api/entities/[id]/express/export?format=csv` (streams CSV bundle: categorised entries, receipt URLs, summary tables). New "Books" tab on `/dashboard/entities/[id]` with Express mode (renders P&L + BS + Export button) OR Connected mode (renders the existing 41f.3 SnapshotCard). 9 tests covering the express service composition + CSV export shape + per-entity scoping + classification enum. | 5 |

**Note**: 41f.5 is a single PR rather than a sub-sequence because most of it is composition. The schema is additive and tiny; the service layer is thin; the UI is one new tab.

---

## 6. New schema additions (additive — single migration)

```prisma
enum BookkeepingClassification {
  BUSINESS_INCOME    // Operating revenue (sales, services)
  BUSINESS_EXPENSE   // Operating expense (rent, utilities, supplies)
  COGS               // Cost of goods sold
  OWNER_DRAW         // Director / member fund withdrawal
  OWNER_CONTRIBUTION // Personal funds put into the entity
  CAPITAL_PURCHASE   // Asset acquired (carries through to depreciation later)
  TAX_PAYMENT        // BAS / income tax / PAYG
  TRANSFER           // Inter-entity / inter-account movement (not P&L)
  PERSONAL           // Genuinely personal expense run through the entity (flagged for accountant attention)
  UNCLASSIFIED       // Default — not yet categorised
}

// Phase 41f.5 — Express bookkeeping enrichment
model Income {
  // ... existing fields unchanged
  bookkeepingClassification BookkeepingClassification @default(UNCLASSIFIED)
}

model Expense {
  // ... existing fields unchanged
  bookkeepingClassification BookkeepingClassification @default(UNCLASSIFIED)
}

model LegalEntity {
  // ... existing fields unchanged
  // True when no AccountingIntegration is connected; flips to false when
  // 41f.2 OAuth lands a row. Drives the entity-detail "Books" tab variant.
  expressMode Boolean @default(true)
}
```

**Migration safety (CLAUDE.md §12.11)**: pure column additions with sane defaults. No row mutations. No constraint relaxation. Pre-flight expected: every existing Income/Expense row defaults to `UNCLASSIFIED`; every existing LegalEntity defaults to `expressMode = true`.

---

## 7. CSV export shape (Export for accountant)

The export bundle is a single ZIP (or downloadable CSV — D-41F.5-2 below decides). Contents:

```
monitrax-express-{entitySlug}-{fiscalPeriod}/
├── 01-income.csv            # Date, Description, Amount, Category, BookkeepingClass, ReceiptId
├── 02-expense.csv           # Date, Description, Amount, Category, BookkeepingClass, ReceiptId, GstAmount
├── 03-summary-pnl.csv       # Single-row P&L summary with totals per BookkeepingClass
├── 04-summary-bs.csv        # Single-row BS summary (assets/liabilities/equity) — manual entry or imported from connected accounts
├── 05-receipts/             # All receipt PDFs/images linked from rows
│   ├── {receiptId}.pdf
│   └── {receiptId}.jpg
├── 06-categorisation-rules.json   # User's recurring-categorisation rules so the accountant can audit logic
└── README.md                # Plain-English explainer for the accountant: scope of Monitrax Express, what's included, what the accountant still owns (bank rec, journal entries, BAS, lodgment)
```

The README.md content is canonical (templated); the rest is data-driven.

---

## 8. Architecture decisions requiring sign-off (D-41F.5-1 → D-41F.5-4)

| # | Decision | Recommendation | Open / Confirmed |
|---|---|---|---|
| **D-41F.5-1** | Storage model — extend Income/Expense (Option A) or new ExpressLedgerEntry model (Option B) | **Option A**. Reuses everything; minimal schema; no drift risk. | OPEN |
| **D-41F.5-2** | Export format — single multi-file ZIP, or sequential CSV downloads? | **Single ZIP**. Accountants want one download, one folder, one place to look. ZIP-encoder is in stdlib (`yauzl` for read; for write, Node 20+ has experimental `node:zlib` — actually use the `archiver` package which is small + permissive license). | OPEN — depends on whether you want zero-new-deps or a 30KB dep. If zero-new-deps: streamed multi-CSV download with a manifest file. |
| **D-41F.5-3** | When does `LegalEntity.expressMode` flip to false? | **When the 41f.2 callback successfully persists an `AccountingIntegration` row for this entity** + the integration's `isConnected = true`. Disconnecting flips it back to `true` (so the user can keep using Express until they re-connect). | OPEN |
| **D-41F.5-4** | What about entities marked `personal_name`? | **Don't show the Books tab on PERSONAL_NAME entities.** Express is for OPERATING / HOLDING / INVESTMENT / SUPERANNUATION roles. Personal-name doesn't have a P&L distinct from the user's overall cashflow. | OPEN |

---

## 9. UNCOMPUTED register (v1)

| Code | Rule | Reason |
|---|---|---|
| `UC-EXPRESS-NO-RECEIPT` | Expense entry has no linked receipt | Surface as a soft warning on the Express UI; encourages user to attach receipts before EOFY export. |
| `UC-EXPRESS-UNCLASSIFIED` | Entry's `bookkeepingClassification` is `UNCLASSIFIED` | Excluded from the per-class summary; surfaced as a queue ("12 entries need a category before export"). |
| `UC-EXPRESS-NO-BANK-RECONCILIATION` | Express does not reconcile entries against bank feed | Notice on the Books tab + in the CSV README. Reconciliation is the accountant's job. |
| `UC-EXPRESS-NO-BAS-CALCULATION` | Express tracks GST per row but does not produce a lodgable BAS | Notice on the Books tab + in the CSV README. BAS prep is the accountant's job. |
| `UC-EXPRESS-NO-DEPRECIATION-SCHEDULE` | Capital purchases are flagged but not auto-depreciated | Phase 41e.7 handles depreciation rules; Express CSV exports the raw acquisition; the accountant computes depreciation. |
| `UC-EXPRESS-CROSS-ENTITY-TRANSFER` | A transfer between two of the user's entities | Flagged separately — these net to zero across entities and shouldn't double-count in P&L. |

---

## 10. CDR / privacy considerations

Same posture as Phase 41f core (spec doc §10) — Express doesn't introduce new data classes:

- Income/expense rows already governed by standard Privacy Act 1988 (not CDR).
- Receipts in Phase 26 vault already encrypted at rest.
- CSV export is a streaming download; no server-side cache; per-request audit log.
- Export bundle never sent to third parties without user click; the user is the source of distribution to their accountant.

---

## 11. Reza sign-off block

Tick each before 41f.5 starts:

- [ ] **D-41F.5-1** confirmed: extend Income/Expense (Option A) — single migration, additive
- [ ] **D-41F.5-2** confirmed: export format (ZIP via `archiver` dep, OR streamed multi-CSV with manifest — your preference)
- [ ] **D-41F.5-3** confirmed: `expressMode` flips on 41f.2 OAuth success; flips back on disconnect
- [ ] **D-41F.5-4** confirmed: Books tab hidden on PERSONAL_NAME entities (only OPERATING / HOLDING / INVESTMENT / SUPERANNUATION)
- [ ] **UNCOMPUTED v1 register** approved (6 items in §9)
- [ ] **Single-PR scope** approved (~5 days; most work is composition of existing infrastructure)
- [ ] **§12.11 destructive-write checklist** acknowledged: pure column additions with sane defaults; no row mutations; no constraint relaxation
- [ ] **Strategic positioning** confirmed: Monitrax Express is a feeder to the accountant's Xero, NOT a substitute for the accountant

---

## 12. Out of scope (deferred to PROD or future phase)

- **Bank reconciliation** — the user's bank feed (Basiq) is consumed for transaction capture; Express does NOT match feed entries to invoices. The accountant does that in Xero.
- **BAS preparation / lodgment** — Express tracks GST per row; the BAS aggregation is shipped in Phase 41e.16 (already SHIPPED) but lodgment to ATO is deferred to PROD.
- **STP / payroll** — out of scope. Use Xero / MYOB / KeyPay.
- **Inventory / manufacturing / project costing** — out of scope.
- **Multi-currency invoicing** — out of scope.
- **Receipt → entry auto-creation** — Phase 26 vault has receipts; auto-creating Income/Expense rows from receipts is queued separately under Phase 26 follow-ups.
- **Migrate-to-Xero wizard** — when a user grows past Express and wants to move to Xero, we offer the CSV export to the accountant, NOT a direct Xero data-push. (Direct push requires bidirectional sync — explicitly out of Phase 41f scope per §1.1.)

---

## 13. Build risks + mitigations

| Risk | Mitigation |
|---|---|
| User mistakes Express for "real bookkeeping" → relies on it for ATO compliance | Notice copy on every Express surface + README.md in the export bundle: *"Express produces categorised records for your accountant. Bank reconciliation, journal entries, depreciation, and BAS lodgment remain your accountant's responsibility."* |
| Accountant rejects the CSV format (incompatible with Xero / MYOB import) | Ship Xero-compatible CSV at v1 (Xero's documented import format). MYOB-compatible variant ships when 41f's MYOB integration lands (v2). |
| Bookkeeping classification confusion (user puts personal expense as BUSINESS_EXPENSE) | UI tooltip on each classification + the `PERSONAL` value lets the accountant see what was flagged for their attention. |
| `expressMode` flip race (user connects Xero just as they tap Export) | The export reads `expressMode` once at request start; if the integration connects mid-request the export reflects pre-connect state. User can re-export after connect. |

---

## 14. Approval status

🟡 **DRAFT — awaiting Reza sign-off.**

Once §11 ticks are complete, this doc moves to **APPROVED** and 41f.5 starts. Ships after 41i.6 closes (per the cross-doc sequence in `IMPLEMENTATION_PLAN.md` Active Workstream §5).
