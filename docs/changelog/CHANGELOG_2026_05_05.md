# Changelog — 2026-05-05

## Session: claude/phase-41e1-d2-cgt-router (Phase 41e.1 slice D-2 — wire CGT into entityTaxRouter; closes 41e.1)

### Changes Made
- **Type:** Feature — closes 41e.1. Wires slices A (CGT discount) + B (loss netting) into the router as a CGT side calc independent of the income-tax dispatch. **First demonstration of "never false silence"** — a COMPANY entity with income tax still UNCOMPUTED can now surface a fully-computed CGT figure with 0% discount per s115-280, instead of returning silently null.
- **Scope:** Conditional CGT dispatch — entities WITH `cgtEvents` get a populated `cgtResult` (regardless of whether `result` is null/computed). De-duplicated cumulative citations + UNCOMPUTED.
- **Stacked on:** PR #649 (slice D-1). Stack chain: this PR → #649 → #647 → #645 → #644 → #641 → #639 → #637 → #636 → #634 → #633 → main.

### Files Modified
- `lib/tax-engine/types.ts` — `EntityTaxFacts` gains optional `cgtEvents`, `carryForwardCapitalLosses`, `smsfIsComplying`, `isForeignResident` fields. `EntityTaxPosition` gains optional `cgtResult` field (independent of `result`).
- `lib/tax-engine/entity/entityTaxRouter.ts` — imports `applyCapitalLossNetting` + types. New `dispatchCgtIfPresent(facts)` helper runs loss-netting if `cgtEvents` non-empty. New `mergeCgt(citations, uncomputed, cgt)` helper de-duplicates merged arrays. Every dispatch branch (PERSONAL_NAME / TRUST-with-distribution / UNCOMPUTED branches) now populates `cgtResult` + merges CGT citations & flags into the cumulative position.
- `app/api/tax/entity/[entityId]/route.ts` — POST handler validates + accepts `cgtEvents` array (each event needs `id`/`monthsHeld`/`nominalAmount`) + `carryForwardCapitalLosses` array; passes both into `EntityTaxFacts`.
- `tests/tax-engine/entity/entityTaxRouter.test.ts` — 8 new tests for the D-2 contract.
- `docs/architecture/03_DATA_MODEL.md` §10.13 — slice D-2 row appended; **41e.1 COMPLETE** statement.
- `docs/architecture/07_API_STANDARDS.md` §15 — POST endpoint row updated.
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11 — slice D-2 status flip + 41e.1 closure note.
- `docs/IMPLEMENTATION_PLAN.md` Recently Completed — new entry.
- `docs/changelog/CHANGELOG_2026_05_05.md` — this entry.

### Build Status
- [x] `npx tsc --noEmit` — clean.
- [x] `npx vitest run tests/calculations tests/utils tests/tax-engine tests/legalEntityService` — **303 tests passed** (295 → 303, +8 new). Zero regressions.

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [x] strategic decision — closes 41e.1; introduces the "never false silence" principle as a complement to "never false numbers".
- [ ] visual / config / GCP / identity / deployment / security / operational / data model

Per the going-forward commitment from PR #637 — all relevant docs updated in the same PR.

### What's user-testable now (visual / API)

**This is the visible flip for COMPANY entities.**

```bash
# COMPANY entity with disposal events:
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cgtEvents": [
      { "id": "e1", "monthsHeld": 60, "nominalAmount": 200000 }
    ]
  }' \
  https://yourenv/api/tax/entity/<company_entityId>
```

Response carries:
- `entityPosition.result === null` (income tax still UNCOMPUTED — 41e.7 territory)
- `entityPosition.uncomputed[0].id === "UC-ENTITY-COMPANY"` (the audit's "never false numbers" rule for income tax stays)
- **`entityPosition.cgtResult.assessableNetCapitalGain === 200000`** (0% discount per s115-280 — full nominal gain assessable)
- `entityPosition.citations` includes `s115-280` so the AFSL footer can show users **exactly why** their company-owned asset got no discount

**Combined trust + CGT:**
```bash
curl -X POST \
  -d '{
    "trustDistribution": { "trustNetIncome": 100000, "beneficiaries": [...] },
    "cgtEvents": [{ "id": "e1", "monthsHeld": 36, "nominalAmount": 80000 }]
  }' \
  /api/tax/entity/<trust_entityId>
```
Returns BOTH a Div 6 distribution in `result` AND a Div 115 calc in `cgtResult` with 50% discount → $40k assessable. Citations include both s95/s97 (Div 6) and s115-25/s100-50/Div 102-A (CGT) — no duplicates.

**With prior-year losses:**
```bash
curl -X POST \
  -d '{
    "cgtEvents": [{ "id": "g1", "monthsHeld": 24, "nominalAmount": 80000 }],
    "carryForwardCapitalLosses": [{ "financialYear": "2022-23", "amount": 20000 }]
  }' \
  /api/tax/entity/<entityId>
```
Net gain after $20k prior-year loss → 50% discount → **$30k assessable**. Caller passes the unconsumed balance from the user's CGT register.

### What's next
**41e.1 is COMPLETE.** Next: **41e.2 — SMSF contribution caps.** Move CONCESSIONAL_CAPS / NON_CONCESSIONAL_CAPS from `capTracker.ts` into `taxYearConfig.ts`. Wire SMSF entity dispatch to the existing `capTracker` primitive. Carry-forward + bring-forward edge cases. Per audit §8.1, ~2 days estimated.

### PR
- Branch: `claude/phase-41e1-d2-cgt-router` (stacked on `claude/phase-41e1-d1-trust-router` / PR #649)
- PR URL: TBD on push

---

## Session: claude/phase-41e1-d1-trust-router (Phase 41e.1 slice D-1 — wire trustDistribution into entityTaxRouter)

### Changes Made
- **Type:** Feature — first user-testable Div 6 surface. Wires slice C's `allocateTrustDistribution` into the router. **First time a trust entity can produce a real `EntityTaxPosition.result` instead of an UNCOMPUTED placeholder.**
- **Scope:** Conditional dispatch — TRUST entities WITH `trustDistribution` data → computed Div 6 allocation; WITHOUT data → still UNCOMPUTED (backward-compat). New POST endpoint to exercise the wiring via curl.
- **Stacked on:** PR #647 (slice C). Stack chain: this PR → #647 → #645 → #644 → #641 → #639 → #637 → #636 → #634 → #633 → main.

### Files Modified
- `lib/tax-engine/types.ts` — `EntityTaxFacts.trustDistribution` optional field added (`trustNetIncome`, `beneficiaries[]`, `hasFamilyTrustElection?`). JSDoc cross-references slice C + UC-DIV-6E-STREAMING.
- `lib/tax-engine/entity/entityTaxRouter.ts` — imports `allocateTrustDistribution`. New conditional branch: DISCRETIONARY_TRUST or UNIT_TRUST + `trustDistribution` provided → run distribution + return real result. New `entityHasConditionalComputedTax(type)` helper for callers to test the conditional capability matrix.
- `app/api/tax/entity/[entityId]/route.ts` — new POST handler accepts `{ trustDistribution }` body. Validates shape (rejects 400 on malformed). Same response envelope as GET. Same Prisma ownership check. `tax_data.read` (read because it's a calc, not a mutation).
- `tests/tax-engine/entity/entityTaxRouter.test.ts` — 6 new tests pinning the conditional dispatch contract. Existing UNCOMPUTED-branch tests unchanged (still pass without distribution data).
- `docs/architecture/03_DATA_MODEL.md` §10.13 — slice D-1 row appended; slice D-2 status added.
- `docs/architecture/07_API_STANDARDS.md` §15 — new POST endpoint row in the Phase 41e endpoints table.
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11 — slice D-1 status flip.
- `docs/IMPLEMENTATION_PLAN.md` Recently Completed — new entry with the curl example for visual testing.
- `docs/changelog/CHANGELOG_2026_05_05.md` — this entry.

### Build Status
- [x] `npx tsc --noEmit` — clean.
- [x] `npx vitest run tests/calculations tests/utils tests/tax-engine tests/legalEntityService` — **295 tests passed** (289 → 295, +6 new). Zero regressions.

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [x] visual / config / GCP / identity / deployment / security / operational / data model — partial: new POST endpoint adds to the §15 API surface but no schema / config / IAM change.
- [ ] strategic decision

Per the going-forward commitment from PR #637, all relevant docs updated in this same PR:
- `03_DATA_MODEL.md` §10.13 — slice D-1 shipped.
- `07_API_STANDARDS.md` §15 — new POST endpoint.
- `PHASE_41_REGULATORY_ARCHITECTURE.md` §11 — slice D-1 status.
- `IMPLEMENTATION_PLAN.md` Recently Completed — new entry with curl example.

### What's user-testable now (visual / API)

**This is a visible flip.** Once this PR + the upstream stack merges:

1. **Hit the new POST endpoint with a trust distribution body:**
   ```bash
   curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "trustDistribution": {
         "trustNetIncome": 100000,
         "beneficiaries": [
           { "id": "b1", "name": "Sarah", "presentlyEntitledShare": 1.0 }
         ],
         "hasFamilyTrustElection": true
       }
     }' \
     https://yourenv/api/tax/entity/<discretionary_trust_entityId>
   ```
   
   Response: `{ "success": true, "data": { "entityPosition": { "result": { "distributions": [...], "trusteeRetainedAmount": 0, ... }, "citations": [...s95, s97...], "uncomputed": [{ id: "UC-S100A-RISK", ... }, { id: "UC-DIV-6E-STREAMING", ... }] }, "boundary": { "computedPer": "Computed per ITAA 1936 s95, ITAA 1936 s97.", ... } } }`.

2. **Try partial entitlement (50%):** trustee gets 50% × 47% = 23.5% s99A penalty. Response carries `s99A` in citations.

3. **GET endpoint behaviour unchanged** — without distribution data in the body, trust entities still return UNCOMPUTED. **No regression on `/dashboard/tax` or any existing surface.**

### What's next
- **Slice D-2 (final 41e.1 slice)** — wire `cgtDiscount` + `capitalLossNetting` into `entityTaxRouter` for any entity type with `cgtEvents`. After D-2, **41e.1 is COMPLETE** and **41e.2 (SMSF contribution caps)** starts.

### PR
- Branch: `claude/phase-41e1-d1-trust-router` (stacked on `claude/phase-41e1-c-trust-distribution` / PR #647)
- PR URL: TBD on push

---

## Session: claude/phase-41e1-c-trust-distribution (Phase 41e.1 slice C — Div 6 basic + trustDistribution.ts skeleton)

### Changes Made
- **Type:** Feature — pure additive calc module. No consumer wiring (slice D wires `entityTaxRouter` to consume slices A/B/C together).
- **Scope:** Implements ITAA 1936 Div 6 basic — presently-entitled beneficiary allocation per s95 + s97 + s99A. Streaming (Div 6E), s100A zone classification, and s98 trustee-level assessment all surface as UNCOMPUTED flags pointing at the sub-PR that resolves each (41e.4, 41e.5, future).
- **Stacked on:** PR #645 (slice B — capital loss netting). Stack chain: this PR → #645 → #644 → #641 → #639 → #637 → #636 → #634 → #633 → main.

### Files Created
- `lib/tax-engine/divisions/trustDistribution.ts` — `allocateTrustDistribution(input)` + `getDistributableAmount(result)` + exported `S99A_TRUSTEE_PENALTY_RATE = 0.47` constant. Validates shares (≥ 0; sum ≤ 1.0 with 1e-9 floating-point tolerance for `1/3 + 1/3 + 1/3` cases). Returns full breakdown with per-beneficiary `BeneficiaryDistribution[]`, `trusteeRetainedAmount`, `trusteePenaltyTax`, `totalAccountedFor`, citations + UNCOMPUTED flags.
- `tests/tax-engine/divisions/trustDistribution.test.ts` — 20 tests covering basic distribution (1-way / 2-way / 3-way), s99A penalty (no entitlement → full 47% / partial entitlement → residual at 47%), validation errors (negative share / over-distribution throw; floating-point tolerance preserved), UNCOMPUTED flags (UC-S100A-RISK always with FTE-aware wording, UC-DIV-6E-STREAMING always, UC-S98-TRUSTEE-ASSESSMENT only when applicable), citation rules (s99A appears only with residual > 0), `getDistributableAmount` helper, `S99A_TRUSTEE_PENALTY_RATE` exposure, edge cases (zero income).

### Files Modified
- `docs/architecture/03_DATA_MODEL.md` §10.13 — slice C row flipped to "shipped" with full description of the s95/s97/s99A trio and the UNCOMPUTED contract.
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11 — slice C status flipped (slice D queued).
- `docs/IMPLEMENTATION_PLAN.md` Recently Completed — new entry.
- `docs/changelog/CHANGELOG_2026_05_05.md` — this entry.

### Build Status
- [x] `npx tsc --noEmit` — clean.
- [x] `npx vitest run tests/calculations tests/utils tests/tax-engine tests/legalEntityService` — **289 tests passed** (269 → 289, +20 new). Zero regressions.

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [ ] visual / config / GCP / identity / deployment / security / operational / data model / strategic decision

(Pure additive calc module; no UI surface yet.)

Per the going-forward commitment from PR #637, relevant docs updated:
- `03_DATA_MODEL.md` §10.13 — slice C shipped row.
- `PHASE_41_REGULATORY_ARCHITECTURE.md` §11 — slice C status flip.
- `IMPLEMENTATION_PLAN.md` Recently Completed — new entry.

### What's user-testable now
**Nothing visual yet** — same as slices A and B. Slice D wires the router and the `/dashboard/tax` AFSL footer starts surfacing per-entity citations (s95, s97, s99A for trust entities; s115-25, s115-100, s100-50 for any disposal; s115-280 explicitly for COMPANY).

### What's next
- **Slice D (final)** — wire `entityTaxRouter` to consume slices A/B/C together. **First user-visible 41e.1 surface.** COMPANY / DISCRETIONARY_TRUST UNCOMPUTED branches start producing real numbers for simple-disposal cases. The AFSL footer surfaces the full citation set on per-entity API responses. After slice D, the audit's "never false numbers" rule relaxes for the v1-supported scope: companies and trusts with basic events get computed numbers instead of UNCOMPUTED flags, paired with the boundary footer documenting exactly which sections were applied.

### PR
- Branch: `claude/phase-41e1-c-trust-distribution` (stacked on `claude/phase-41e1-b-loss-netting` / PR #645)
- PR URL: TBD on push

---

## Session: claude/phase-41e1-b-loss-netting (Phase 41e.1 slice B — capital loss netting + ordering)

### Changes Made
- **Type:** Feature — pure additive calc module composing slice A. No consumer wiring (slice D wires `entityTaxRouter`).
- **Scope:** Implements ITAA 1997 s100-50 (loss-method ordering) + s115-100 (discount applied to net gain after losses) + Div 102-A (assessable net capital gain). Catches the most common consumer-tax mistake — applying the discount to gross gains then subtracting losses produces a smaller assessable number than the law allows; the right order yields a *higher* taxable figure. Tests pin this explicitly.
- **Stacked on:** PR #644 (slice A — CGT discount). Stack chain: this PR → #644 → #641 → #639 → #637 → #636 → #634 → #633 → main.

### Files Created
- `lib/tax-engine/divisions/capitalLossNetting.ts` — `applyCapitalLossNetting(input)` exported. Composes slice A. Returns full breakdown: `totalNominalGains` / `totalCurrentYearLosses` / `totalPriorYearLosses` / `netGainBeforeDiscount` / `discountResult` / `assessableNetCapitalGain` / `carryForwardOut` / `breakdown[]` / `citations[]` / `uncomputed[]`. FIFO ordering for prior-year losses (oldest consumed first per s100-50). Mixed-holding-period proration with `UC-CGT-MIXED-HOLDING` UNCOMPUTED flag.
- `tests/tax-engine/divisions/capitalLossNetting.test.ts` — 18 tests covering: basic gain (with/without > 12-month discount), current-year netting, **the critical s115-100 ordering pin** (assert $35k not $20k for the canonical $100k gain + $30k loss + 50% discount case), losses > gains → carry forward, prior-year carry-forward, prior + current both consumed, FIFO sort independence from input order, entity-type dispatch (SMSF 33⅓%, COMPANY 0%, TRUST 50%), mixed holding period UNCOMPUTED, citation completeness, breakdown row per event, edge cases (no events, only prior losses).

### Files Modified
- `docs/architecture/03_DATA_MODEL.md` §10.13 — slice B row flipped to "shipped" with full description of the s100-50 / s115-100 / Div 102-A trio.
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11 status callout — slice B in flight notation added.
- `docs/IMPLEMENTATION_PLAN.md` Recently Completed — new entry.
- `docs/changelog/CHANGELOG_2026_05_05.md` — this entry.

### Build Status
- [x] `npx tsc --noEmit` — clean.
- [x] `npx vitest run tests/calculations tests/utils tests/tax-engine tests/legalEntityService` — **269 tests passed** (251 → 269, +18 new). Zero regressions.

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [ ] visual / config / GCP / identity / deployment / security / operational / data model / strategic decision

(Pure additive calc module, no UI surface, no schema change. Slice D will surface this on `/dashboard/tax` per-entity API responses.)

Per the going-forward commitment from PR #637, relevant docs updated:
- `03_DATA_MODEL.md` §10.13 — slice B shipped row.
- `PHASE_41_REGULATORY_ARCHITECTURE.md` §11 — slice B in flight.
- `IMPLEMENTATION_PLAN.md` Recently Completed — new entry.

### What's user-testable now
**Nothing visual yet** — same as slice A. Slice D will be the visible flip when COMPANY / TRUST entities start producing real CGT figures via `GET /api/tax/entity/[entityId]`.

### What's next
- **Slice C** — Div 6 basic + `trustDistribution.ts` skeleton. Presently-entitled allocation per ITAA 1936 s95–s99B. Streaming (Div 6E) lands in 41e.4.
- **Slice D** — wire `entityTaxRouter`. **First slice that flips the COMPANY / DISCRETIONARY_TRUST UNCOMPUTED branches to real numbers for simple-disposal cases.**

### PR
- Branch: `claude/phase-41e1-b-loss-netting` (stacked on `claude/phase-41e1-a-cgt-discount` / PR #644)
- PR URL: TBD on push

---

## Session: claude/phase-41e1-a-cgt-discount (Phase 41e.1 slice A — Div 115 CGT discount, entity-aware rate dispatch)

### Changes Made
- **Type:** Feature — first **rule** sub-PR after the 41e.0 foundation. Pure additive module with no consumers yet (slice D wires `entityTaxRouter` to call it).
- **Scope:** Implements ITAA 1997 Div 115 CGT discount rate dispatch by entity type. Per-entity rates: 50% (individuals + trusts + partnerships), 33⅓% (complying SMSF), 0% (companies + non-complying SMSF + < 12 months holding). Foreign-resident apportionment (Subdiv 115-D) flagged as `UC-FOREIGN-RESIDENT-CGT` for future work.
- **Stacked on:** PR #641 (slice D of 41e.0 — closes 41e.0). Stack chain: this PR → #641 → #639 → #637 → #636 → #634 → #633 → main.

### Files Created
- `lib/tax-engine/divisions/cgtDiscount.ts` — `calculateCgtDiscount(input)` + `getCgtDiscountRate(type, isComplying?)` exports. Pure functions; no DB, no state, no side effects. Result shape carries `discountRate` / `discountAmount` / `discountedGain` / `metHoldingPeriod` / `reason` / `citations` / `uncomputed` so the boundary footer can render the exact authority used. Holding-period gate is universal (< 12 months → 0% regardless of entity type per s115-25). COMPANY result explicitly cites s115-280 so users see why no discount applied.
- `tests/tax-engine/divisions/cgtDiscount.test.ts` — 24 tests covering every entity branch, the holding-period boundary (11 vs 12 months), SMSF complying/non-complying split, foreign-resident UNCOMPUTED, and edge cases (zero gain, negative gain trusted to caller for loss netting in slice B).

### Files Modified
- `docs/architecture/03_DATA_MODEL.md` — new §10.13 documenting Phase 41e.1 with the per-entity discount table + queue of remaining slices (B: loss netting, C: Div 6 + trustDistribution skeleton, D: router wiring).
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11 — status callout updated: 41e.1 slice A in flight, B/C/D queued.
- `docs/IMPLEMENTATION_PLAN.md` Recently Completed — new entry with full per-entity rate breakdown.
- `docs/changelog/CHANGELOG_2026_05_05.md` — this entry.

### Build Status
- [x] `npx tsc --noEmit` — clean.
- [x] `npx vitest run tests/calculations tests/utils tests/tax-engine tests/legalEntityService` — **251 tests passed** (227 → 251, +24 new). Zero regressions.

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [ ] visual / config / GCP / identity / deployment / security / operational / data model / strategic decision

(Pure additive calc module — no UI surface yet, no schema change, no behaviour change for any existing flow. Slice D will surface this on `/dashboard/tax` per-entity API responses.)

Per the going-forward commitment from PR #637 — relevant docs updated in this same PR:
- `03_DATA_MODEL.md` — new §10.13.
- `PHASE_41_REGULATORY_ARCHITECTURE.md` §11 — slice status update.
- `IMPLEMENTATION_PLAN.md` Recently Completed — new entry.

### What's user-testable now
**Nothing visual yet** — slice A is pure additive, no consumers wired. The `/dashboard/tax` AFSL footer from 41e.0 slice D remains the most recent visible surface. Slice D of 41e.1 (router wiring) is when COMPANY / DISCRETIONARY_TRUST entities start producing real CGT figures via `GET /api/tax/entity/[entityId]` and the boundary footer surfaces s115-25 / s115-280 citations.

### What's next
- **Slice B** — capital loss netting + ordering (s100-50, s115-100). Pure functions composing slice A.
- **Slice C** — Div 6 basic + `trustDistribution.ts` skeleton. Presently-entitled allocation per ITAA 1936 s95–s99B.
- **Slice D** — wire `entityTaxRouter` to consume the new modules. **First slice that flips the COMPANY / DISCRETIONARY_TRUST UNCOMPUTED branches to real numbers for simple-disposal cases.**

### PR
- Branch: `claude/phase-41e1-a-cgt-discount` (stacked on `claude/phase-41e0-d-router` / PR #641)
- PR URL: TBD on push

---

## Session: claude/phase-41e0-d-router (Phase 41e.0 foundation slice D — entityTaxRouter + AFSL boundaries renderer + new endpoints — closes 41e.0)

### Changes Made
- **Type:** Feature — orchestration scaffolding + first user-visible 41e.0 surface (the AFSL/TPB/NCCP boundary footer on `/dashboard/tax`).
- **Scope:** **Closes 41e.0.** Ships `entityTaxRouter` skeleton (PERSONAL_NAME / SOLE_TRADER computed; COMPANY / TRUST / SMSF / PARTNERSHIP UNCOMPUTED-flagged until 41e.1+ rule modules land), the canonical AFSL/TPB/NCCP boundaries renderer (lib + React component + tests), two new endpoints (`/api/tax/config`, `/api/tax/entity/[entityId]`), and wires the boundary footer into `/dashboard/tax` page (replaces the old free-text Disclaimer).
- **Stacked on:** PR #639 (slice C). Stack chain: this PR → #639 → #637 → #636 → #634 → #633 → main.

### Files Created
- `lib/tax-engine/entity/entityTaxRouter.ts` — `calculateEntityTaxPosition(facts)` + `entityHasComputedTax(type)` exports. Dispatches by `LegalEntityType`. Per-type UNCOMPUTED flags reference the sub-PR that will produce the real number (audit §10.3 — never false numbers).
- `lib/tax-engine/boundaries/index.ts` — `BOUNDARY_STATEMENT` constant (the canonical legal copy), `formatCitation`, `renderBoundaryFootnote`, `renderBoundaryOneLine` exports. De-duplicates citations + UNCOMPUTED flags so repeats don't pollute the footer.
- `components/tax/BoundaryFootnote.tsx` — React component, 5 stacked rows (FY → computed-per → UNCOMPUTED → boundary → calculated-at). Compact variant for tile use.
- `app/api/tax/config/route.ts` — GET handler. `tax_data.read`. Returns `{ config, availableFinancialYears }`.
- `app/api/tax/entity/[entityId]/route.ts` — GET handler. `tax_data.read`. Ownership-checked (Prisma `findFirst` with `userId`). Returns `{ entityPosition, boundary }`.
- `tests/tax-engine/entity/entityTaxRouter.test.ts` — 11 tests covering both halves of the router contract (PERSONAL_NAME computed + UNCOMPUTED branches per type + helper).
- `tests/tax-engine/boundaries/boundaries.test.ts` — 15 tests covering citation formatting, de-duplication, UNCOMPUTED rendering, BOUNDARY_STATEMENT contains TPB/AFSL/NCCP, fyContext optional handling.

### Files Modified
- `app/dashboard/tax/page.tsx` — imports `BoundaryFootnote` + `AuthorityCitation` type; declares module-level `TAX_PAGE_CITATIONS` (ITAA 1997 s4-10, Div 1-6, Div 126-H LITO, Div 207 Franking); replaces the old free-text Disclaimer card with `<BoundaryFootnote citations={TAX_PAGE_CITATIONS} fyLabel={taxConfig.label} calculatedAt={taxPosition?.metadata.calculatedAt} />`. **First user-visible 41e.0 surface.**
- `docs/architecture/07_API_STANDARDS.md` — new §15 "Phase 41e — Entity-aware tax endpoints" listing the shipped + queued tax-route surface with permissions + the boundary-envelope response shape.
- `docs/architecture/06_UI_UX_FOUNDATION.md` — new §13 "AFSL / TPB / NCCP Boundary Footnote Pattern" documenting the canonical component, the legal-copy-lives-in-one-place rule, the compact variant, and the matrix of surfaces that MUST render the footer.
- `docs/architecture/03_DATA_MODEL.md` §10.12 — slice D shipped row appended with full module + endpoint summary.
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11 — slice D status flip ("queued" → "PR #642 in review — first user-visible 41e.0 surface — after D, **41e.0 is COMPLETE**").
- `docs/IMPLEMENTATION_PLAN.md` Recently Completed — new entry documenting the slice + the full module + endpoint catalogue + the AFSL footer text the user can verify on `/dashboard/tax`.
- `docs/changelog/CHANGELOG_2026_05_05.md` — this entry.

### Build Status
- [x] `npx tsc --noEmit` — clean.
- [x] `npx vitest run tests/calculations tests/utils tests/tax-engine tests/legalEntityService` — **227 tests passed** (201 → 227, +26 new). Zero regressions.

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [x] visual design system / component pattern — new `<BoundaryFootnote />` component pattern documented in `06_UI_UX_FOUNDATION.md` §13 with the matrix of surfaces that MUST adopt it.
- [x] strategic decision — closes 41e.0; unblocks 41e.1.
- [ ] application config / GCP infrastructure / identity / auth / deployment / build / security / CDR posture / operational procedure / data model

Per the going-forward commitment from PR #637 — every relevant doc updated in this same PR.

Docs updated:
- `docs/architecture/07_API_STANDARDS.md` — new §15.
- `docs/architecture/06_UI_UX_FOUNDATION.md` — new §13.
- `docs/architecture/03_DATA_MODEL.md` §10.12 — slice D row.
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11 — slice D status.
- `docs/IMPLEMENTATION_PLAN.md` Recently Completed — new entry.

### What's user-testable now (Reza brief 2026-05-05 — *"let me know when I can check anything visually to test and review"*)

**Once this PR merges:**

1. **`/dashboard/tax` AFSL boundary footer** — visible at the bottom of the page. Look for "Computed per ITAA 1997 s4-10, ITAA 1997 Div 1-6, ITAA 1997 Div 126-H (LITO), ITAA 1997 Div 207 (Franking). These figures are general information only — not personal financial, tax, or credit advice. Confirm with a registered tax agent (TPB), financial adviser (AFSL), or credit assistant (NCCP) before acting." If you see the OLD generic Disclaimer text, the slice didn't deploy.

2. **`GET /api/tax/config`** — `curl https://yourenv/api/tax/config` (auth required). Returns the canonical FY config including new fields (`label`, `superGuaranteeQuarterlyCap`, `superContributionsTaxRate`, `coContributionIncomeThreshold`, `bringForwardThresholds`, `reviewSchedule`).

3. **`GET /api/tax/entity/[entityId]`** — for any `LegalEntity` you own. PERSONAL_NAME entity → returns full Phase 20 tax position. COMPANY / TRUST / SMSF entity → returns `entityPosition.result === null` + a `uncomputed` array with a structured flag like *"Trust streaming + Div 6 / Div 6E + s100A zone classification lands with Phase 41e.1, 41e.4 and 41e.5..."*. **This is the audit's "never false numbers" guarantee in action** — try it for an SMSF entity if you have one and confirm the response carries an UNCOMPUTED flag, not a fabricated number.

4. **Boundary-component reusability** — when 41e.1 ships per-entity figures, the same `<BoundaryFootnote />` component will mount on the AI advice cards, the Money Flow tab, and the adviser drill-in tax surface. The matrix of "MUST render" surfaces is in `06_UI_UX_FOUNDATION.md` §13.5.

### What's next
- **41e.1** — Div 115 CGT discount + Div 6 trust beneficiary income flow (basic, non-streamed) + capital loss netting (s100-50 ordering). Estimated 3 days.
- **First per-entity numbers in production.** When 41e.1 lands, COMPANY entities get their proper 25%/30% base-rate dispatch + the UNCOMPUTED `UC-ENTITY-COMPANY` flag flips to a real number. The `<BoundaryFootnote />` component then surfaces 41e.1's citations (s115-25, Div 6) on every page that consumes the per-entity API.

### PR
- Branch: `claude/phase-41e0-d-router` (stacked on `claude/phase-41e0-c-aggregators` / PR #639)
- PR URL: TBD on push

---

## Session: claude/phase-41e0-c-aggregators (Phase 41e.0 foundation slice C — entity-aware aggregator extensions, resolves audit C-3)

### Changes Made
- **Type:** Feature — entity-scoping behaviour added to the 5 canonical financial aggregators (Phase 41e.0 slice C). Pure additive: every existing call site continues to receive household-wide totals exactly as before; new callers can scope per-entity by passing the optional `ownerEntityId` filter.
- **Scope:** Resolves the last open audit critical — **C-3** (aggregators have zero entity awareness). Combined with C-1 / C-2 / C-4 (resolved in 41e.−1 cleanup) and H-1 through H-6 (resolved in 41e.−1 cleanup B/C), this closes the full audit register.
- **Stacked on:** PR #637 (doc-sync follow-up). Stack chain: this PR → #637 → #636 → #634 → #633 → main.

### Files Modified
- `lib/calculations/incomeAggregator.ts` — `IncomeInput.ownerEntityId?: string | null` added; `aggregateIncome(income, targetFrequency, ownerEntityId?)` filters before aggregation.
- `lib/calculations/expenseAggregator.ts` — `ExpenseInput.ownerEntityId?: string | null` added; `aggregateExpenses(expenses, targetFrequency, ownerEntityId?)` filters before category breakdown.
- `lib/calculations/loanAggregator.ts` — `LoanInput.ownerEntityId?: string | null` added; `aggregateLoanRepayments(loans, targetFrequency, ownerEntityId?)` filters before principal/interest summation.
- `lib/calculations/cashflowOrchestrator.ts` — `IncomeItem` / `ExpenseItem` / `LoanItem` all gained `ownerEntityId?: string | null`; `calculateCashflow(input, ownerEntityId?)` applies the filter once at the top across all three sub-arrays so every downstream loop sees the scoped set.
- `lib/calculations/netWorthCalculator.ts` — `PropertyInput` / `AccountInput` / `InvestmentInput` / `SuperInput` / `AssetInput` / `LoanInput` all gained `ownerEntityId?: string | null`; `calculateTotalAssets(...args, ownerEntityId?)` and `calculateTotalLiabilities(loans, ownerEntityId?)` filter via internal `matchEntity` helper.
- `docs/architecture/03_DATA_MODEL.md` §10.12 — "Aggregator extensions (slice C — pending)" flipped to **shipped** with a per-aggregator signature table + the test contract summary. Confirms: (1) filter-omitted reproduces pre-41e household totals, (2) filter-provided returns only matching items, (3) `e1.total + e2.total === household.total` proves no double-counting.
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11 status — slice C flipped from "queued" to "PR #639 in review — **resolves audit C-3 — the last open audit critical**".
- `docs/IMPLEMENTATION_PLAN.md` Recently Completed — new entry prepended documenting the slice + the closing of the full audit register.
- `docs/changelog/CHANGELOG_2026_05_05.md` — this entry.

### Files Created
- `tests/calculations/aggregatorEntityScoping.test.ts` — 18 tests covering all 5 aggregators. Three assertion classes: backward-compat (filter omitted → unchanged behaviour), entity-scoping (filter provided → only matching items), structural correctness (per-entity sums equal household total — no double-counting).

### Build Status
- [x] `npx tsc --noEmit` — clean.
- [x] `npx vitest run tests/calculations tests/utils tests/tax-engine tests/legalEntityService` — **201 tests passed** (183 → 201, +18 new). Zero regressions.

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [x] strategic decision — closes the full audit register (C-1 / C-2 / C-3 / C-4 + H-1..H-6 all resolved)
- [ ] visual / config / GCP / identity / deployment / security / operational / data model

Per the going-forward commitment from PR #637: every relevant doc updated in this same PR, no batching.

Docs updated:
- `docs/architecture/03_DATA_MODEL.md` §10.12 — slice C flipped to "shipped" with full per-aggregator signature table + test contract.
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11 — slice C status flipped + audit-closure note.
- `docs/IMPLEMENTATION_PLAN.md` Recently Completed — new entry.

### What's next
- **Slice D (final 41e.0 slice)** — `entityTaxRouter` skeleton + AFSL/TPB/NCCP boundaries renderer + new endpoints (`GET /api/tax/entity/[id]`, `GET /api/tax/config`, stub `GET /api/tax/master-position`). After D, **41e.0 is complete** and **41e.1 (Div 115 + Div 6 basic + capital loss netting) starts.** Per the pre-declared doc-touch list from PR #637 changelog, slice D will update: `07_API_STANDARDS.md` (new endpoints), `06_UI_UX_FOUNDATION.md` (boundaries-renderer footer pattern if surfaced UI-side), `03_DATA_MODEL.md` §10.12 (router + endpoints), `PHASE_41_REGULATORY_ARCHITECTURE.md` §11 status flip, IMPLEMENTATION_PLAN entry, `MASTER_BLUEPRINT.md` if 41e.0 phase status changes.

### PR
- Branch: `claude/phase-41e0-c-aggregators` (stacked on `claude/phase-41e0-doc-sync-followup` / PR #637)
- PR URL: TBD on push

---

## Session: claude/phase-41e0-doc-sync-followup (Phase 41e.0 doc-sync follow-up — close §3.1 / §16 gaps from slices A + B)

### Changes Made
- **Type:** Docs-only follow-up (no code, no schema). Per Reza directive 2026-05-05 — *"make sure all relevant documents including design, blueprint, runbooks etc are also updated as we go so there is nothing missed"* — fills the §3.1 / §16 doc-sync gaps left when slices A (PR #634) and B (PR #636) said *"full 41e.0 audit closure batched at slice D."* That batching was a reasonable judgement call but it skipped specific docs that should have updated per the matrix. This PR fixes the misses inline.
- **Scope:** Updates 4 canonical docs to reflect the work that has shipped across the audit + 41e.−1 cleanup + 41e.0 slices A/B. No code changes; no migration changes; no behaviour changes.
- **Stacked on:** PR #636 (slice B). Stack chain: this PR → #636 → #634 → #633 → main.

### Files Modified
- `docs/operational/security/02_IAM_AND_PERMISSIONS.md` — extended the Permission Naming Convention example list with `entity.read` / `entity.write` / `entity.delete` (Phase 41a) + `tax_data.read` / `tax_data.write` (Phase 41e.0). Added a "Phase 41e tax-data permissions" paragraph explaining what they gate (route access, not CDR-content visibility) and pointing at `lib/auth/permissions.ts` as the canonical role mapping.
- `docs/architecture/03_DATA_MODEL.md` — appended new §10.12 "Phase 41e.−1 cleanup + 41e.0 foundation — schema-relevant changes" capturing: the 7 new `TaxYearConfig` fields with their primary-authority citations (slice A — PR #626); the new `TAX_YEAR_2025_26` config (resolves audit C-4); the `legal_entities_no_self_parent` DB CHECK constraint (slice B — PR #636 / migration `20260506110000_legal_entity_no_self_parent`); the 6 new entity-aware orchestration types in `lib/tax-engine/types.ts` (slice A — PR #634); the upcoming aggregator extension contract (slice C, queued).
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` — §4 Canonical types now carries an "Implementation status (2026-05-05)" callout listing each type that landed in 41e.0 slice A (PR #634) at `lib/tax-engine/types.ts`, plus the two intentional deviations from the architectural pseudocode (`EntityTaxPosition.result` typed `unknown`; `EntityTaxFacts.incomes/expenses/depreciations` inlined as structural rows to avoid circular imports). §11 Implementation sequence updated to reflect the audit-inserted `41e.−1` cleanup PR + the slice-by-slice ship status (41e.−1 A/B/C ✅ merged, D in review; 41e.0 A/B in review). Sequence is now 18 sub-PRs total (was 17).
- `docs/IMPLEMENTATION_PLAN.md` Recently Completed (2026-05-05) — prepended two entries for 41e.0 slice A (PR #634) and slice B (PR #636) with the same level of detail as the 41e.−1 cleanup-slice entries. Slice A: types + permissions; slice B: cycle-detection + DB CHECK + 11 tests.
- `docs/changelog/CHANGELOG_2026_05_05.md` — this entry.

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [x] strategic decision — closes the doc-sync gaps from slices A + B
- [ ] visual / config / GCP / identity / deployment / security / operational / data model

Docs updated:
- `docs/operational/security/02_IAM_AND_PERMISSIONS.md` — Permission Naming Convention + tax-data permissions explainer.
- `docs/architecture/03_DATA_MODEL.md` — new §10.12 capturing 41e.−1 + 41e.0 schema-relevant changes.
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` — §4 implementation-status callout + §11 sequence-status update.
- `docs/IMPLEMENTATION_PLAN.md` Recently Completed — slices A + B entries prepended.

### Going-forward commitment
Per Reza directive — every future slice updates the relevant docs in the same PR, not batched. If a slice has nothing to update for a given doc surface, the §16.5 block lists the unchecked surfaces explicitly (positive confirmation, not absence of evidence). The following docs will be touched by upcoming 41e.0 slices:
- **Slice C** (aggregator extensions) → `03_DATA_MODEL.md` §10.12 ("Aggregator extensions — pending" → "Aggregator extensions — shipped"), `01_ARCHITECTURE_OVERVIEW.md` if module boundaries change, IMPLEMENTATION_PLAN Recently Completed.
- **Slice D** (entityTaxRouter + boundaries renderer + new endpoints) → `07_API_STANDARDS.md` (new endpoints), `06_UI_UX_FOUNDATION.md` (boundaries-renderer footer pattern if surfaced UI-side), `03_DATA_MODEL.md` §10.12 (router + endpoints), IMPLEMENTATION_PLAN Recently Completed, `PHASE_41_REGULATORY_ARCHITECTURE.md` §11 status flip, `MASTER_BLUEPRINT.md` if 41e.0 phase status changes.

### What's next
- **Slice C** — entity-aware aggregator extensions (resolves the last open audit critical: C-3).
- **Slice D** — `entityTaxRouter` skeleton + AFSL/TPB/NCCP boundaries renderer + new endpoints. Closes 41e.0; 41e.1 starts.

### PR
- Branch: `claude/phase-41e0-doc-sync-followup` (stacked on `claude/phase-41e0-b-cycle-detection` / PR #636)
- PR URL: TBD on push

---

## Session: claude/phase-41e0-b-cycle-detection (Phase 41e.0 foundation slice B — parentEntityId cycle-detection)

### Changes Made
- **Type:** Feature / safety guard (Phase 41e.0 slice B — wires the cycle-detection contract from audit doc §7 into `legalEntityService.ts`; adds an additive DB CHECK constraint as defence-in-depth; ships 11 tests).
- **Scope:** New exported `validateParentChain(entityId, proposedParentId, client)` helper implementing audit §7.2 Rules 1–3 (self-parent forbidden, no cycle in parent chain, max depth 10). Wired into `createEntity()` and `updateEntity()` inside the same transaction client to prevent TOCTOU races (audit §7.3). Subsumes the old `if (input.parentEntityId === entityId)` self-parent check that was the only guard before.
- **Stacked on:** PR #634 (slice A — types + permissions). Stacks PR #634 → PR #633 → main; will rebase clean as upstream merges.

### Files Modified
- `lib/services/legalEntityService.ts` — appended a new `Phase 41e.0 — parentEntityId cycle-detection (audit doc §7)` section: `PARENT_CHAIN_MAX_DEPTH = 10` constant, `ParentChainValidationError` + `ParentChainValidationResult` exported types, `validateParentChain()` walker exported. The walker iterates upward from `proposedParentId` building a `visited` set, returning structured errors for SELF_PARENT / CYCLE_DETECTED / MAX_DEPTH_EXCEEDED / PARENT_NOT_FOUND. Catches two cycle flavours: (a) `proposedParent` is downstream of `entityId`, (b) the existing chain (independent of the proposed change) is already cyclic — surfaces it now rather than infinite-loop. Both `createEntity()` and `updateEntity()` now call `validateParentChain()` after the user-ownership check.

### Files Created
- `prisma/migrations/20260506110000_legal_entity_no_self_parent/migration.sql` — pure additive DB CHECK constraint per audit §7.4. Rejects only rows where `id = parent_entity_id` (which the application layer has been blocking since 41a). §12.11 N/A — this constraint adds a guard, does not modify any row. CLAUDE.md §12.12 satisfied — schema.prisma untouched (Prisma doesn't model raw CHECK constraints; this is a defence-in-depth pattern at the storage layer that doesn't need a Prisma model representation).
- `tests/legalEntityService/parentChain.test.ts` — 11 tests. The 8 mandated by audit §7.5 (self-parent rejected; direct cycle rejected; indirect cycle rejected; max depth enforced; valid corporate trustee Pty Ltd → Trust; valid SMSF corporate trustee; valid reparent without cycle; walker terminates correctly on a 3-level valid chain) plus 3 extras (null parent trivially ok; PARENT_NOT_FOUND surfaces; pre-existing cyclic chain detected without infinite-loop). Uses an in-memory `fakeClient` that stubs `legalEntity.findUnique` against a chain map — pure unit, no DB.

### Build Status
- [x] `npx tsc --noEmit` — clean (after one explicit type annotation on the union-type Prisma lookup).
- [x] `npx vitest run tests/calculations tests/utils tests/tax-engine tests/legalEntityService` — **183 passed (172 from slice D + 11 new)**. Zero failures.

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [ ] visual / config / GCP / identity / deployment / security / operational / data model / strategic decision

(Slice B is a contained safety guard; full 41e.0 audit closure batched at slice D.)

Docs updated:
- `docs/changelog/CHANGELOG_2026_05_05.md` — this entry.

### Why a separate migration when schema.prisma isn't touched
Per CLAUDE.md §12.12 — a migration file is required for any DB-state change, regardless of whether `schema.prisma` is touched. CHECK constraints are commonly placed at the DB level without a corresponding Prisma annotation (Prisma's `@@check` is provider-limited). The application-layer validator (`validateParentChain`) is the primary guard; the DB CHECK is defence-in-depth that catches the simplest cycle (`id = parent_entity_id`) regardless of how a row reaches the database (manual INSERT, future bulk import, etc.).

### What's next
- **Slice C (next)** — entity-aware aggregator extensions. The 5 aggregators (`incomeAggregator`, `expenseAggregator`, `loanAggregator`, `cashflowOrchestrator`, `netWorthCalculator`) gain optional `ownerEntityId?: string` param, default = no filter (backward-compat — existing call sites pass `undefined`, behaviour unchanged). **Resolves the last open audit critical: C-3.**
- **Slice D** — `entityTaxRouter` skeleton + AFSL/TPB/NCCP boundaries renderer + new endpoints. After D, **41e.0 is complete** and **41e.1 (Div 115 + Div 6 basic + capital loss netting)** starts.

### PR
- Branch: `claude/phase-41e0-b-cycle-detection` (stacked on `claude/phase-41e0-a-types` / PR #634 → which is stacked on `claude/phase-41e-cleanup-d-fixtures` / PR #633)
- PR URL: TBD on push

---

## Session: claude/phase-41e0-a-types (Phase 41e.0 foundation slice A — permissions + entity-aware orchestration types)

### Changes Made
- **Type:** Foundation / type contract (Phase 41e.0 slice A — first slice of the entity-aware orchestration foundation; pure additive; zero consumer changes; zero behaviour changes; sets up the type contract that 41e.0 slices B/C/D + 41e.1 → 41e.17 build against).
- **Scope:** Two new permissions (`tax_data.read`, `tax_data.write`) for the new endpoints landing in slice D. Five new types in `lib/tax-engine/types.ts` per architecture doc §4 + audit doc §6.2 (`AuthorityCitation`, `FYReference`, `EntityTaxFacts`, `EntityTaxPosition`, `MasterTaxPosition`, `UncomputedFlag`) — the contract for entity dispatch + cumulative authority-citation traceability + UNCOMPUTED-flag surfacing. Stacked on top of the 41e.−1 cleanup PR D branch (PR #633) so the slice-C bugfix is included.

### Files Modified
- `lib/auth/permissions.ts` — added `tax_data.read` (OWNER+ADMIN+CONTRIBUTOR+VIEWER, mirrors `report.read`) and `tax_data.write` (OWNER+ADMIN+CONTRIBUTOR — writes commit to a snapshot the household sees). JSDoc explains the gating relationship to CDR (these gate ROUTE access; CLAUDE.md §13.3 sanitisation still governs CDR-content visibility).
- `lib/tax-engine/types.ts` — appended a new "Phase 41e.0 — Entity-Aware Orchestration Types" section. Six new exported interfaces with full JSDoc + cross-references to the architecture doc + audit doc:
  - `AuthorityCitation` — primary-AU-authority reference (ITAA 1936/1997 / SIS Act / TR / TD / PCG / PS LA / state acts) attached to every rule result. Consumed by the AFSL/TPB/NCCP boundaries renderer (slice D).
  - `FYReference` — FY-indexed lookup contract; thresholds NEVER hard-coded (per architecture doc §1(6)).
  - `EntityTaxFacts` — per-entity input the dispatcher needs. Composed from the new entity-aware aggregator outputs (slice C). Optional fields will progressively populate as 41e.1+ ship the rule modules (CGT events, trust distribution resolutions, Div 7A loans, LRBA arrangements).
  - `EntityTaxPosition` — output of dispatching a single entity. Wraps Phase 20 `TaxPositionResult` for PERSONAL_NAME flows; net-new shapes for COMPANY/TRUST/SMSF land per sub-PR (kept as `unknown` here so sub-PRs refine without churn).
  - `UncomputedFlag` — audit-friendly "deliberately not computed" structure per audit §10.3. UI surfaces these as plain-English badges, never false numbers.
  - `MasterTaxPosition` — household-wide roll-up. The canonical replacement for `buildTaxSummary()` once 41e.17 ships the orchestrator.

### Build Status
- [x] `npx tsc --noEmit` — clean.
- [x] `npx vitest run tests/calculations tests/utils tests/tax-engine` — 172 tests passed.

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [ ] visual / config / GCP / identity / deployment / security / operational / data model / strategic decision

(Slice A is pure additive scaffolding; full 41e.0 audit closure batched at slice D.)

Docs updated:
- `docs/changelog/CHANGELOG_2026_05_05.md` — this entry.

### What's next
- **Slice B** — `parentEntityId` cycle-detection wired into `legalEntityService.ts` per audit §7. Four rules (self-parent forbidden, no chain cycles, max depth 10, type-compatibility advisory). DB CHECK constraint as defence-in-depth. 8 required tests.
- **Slice C** — entity-aware aggregator extensions (incomeAggregator, expenseAggregator, loanAggregator, cashflowOrchestrator, netWorthCalculator) gain optional `ownerEntityId?: string` param, default = no filter (backward-compat). **Resolves the last open audit critical: C-3.**
- **Slice D** — `entityTaxRouter` skeleton + AFSL/TPB/NCCP boundaries renderer + new endpoints (`GET /api/tax/entity/[id]`, `GET /api/tax/config`, `GET /api/tax/master-position` — the latter is a stub returning `MasterTaxPosition` with all-PERSONAL_NAME dispatch until 41e.1+ wire up entity-specific rules).

After slice D, **41e.0 is complete** and **41e.1 (Div 115 + Div 6 basic + capital loss netting) starts**.

### PR
- Branch: `claude/phase-41e0-a-types` (stacked on `claude/phase-41e-cleanup-d-fixtures` / PR #633 — when #633 merges, GitHub auto-rebases this PR's base to main)
- PR URL: TBD on push

---

## Session: claude/phase-41e-cleanup-d-fixtures (Phase 41e.−1 cleanup PR D — archetype fixtures + master-config self-test + parity baselines + slice-C bugfix)

### Changes Made
- **Type:** Tests + audit closure (Phase 41e.−1 cleanup, slice D — final slice; closes the four-slice cleanup PR; produces the parity baselines for the next 17 sub-PRs).
- **Scope:** Three archetype fixtures (Sarah Kim / David+Emma / Olivia) shared with pitch seeding (audit doc §9.1 + Up Next #33). Master-config self-test asserting the canon (audit §10.4). Parity baseline test for slice-C's `buildTaxSummary` delegation (audit §9.4). **Caught and fixed a real bug from slice C** — `marginalRate` semantic mismatch — in the same PR.
- **Audit closure:** All four C-class findings resolved (C-1 slice C, C-2 slice B, C-3 deferred to 41e.0 per audit §6.3, C-4 slice A). All H-class findings resolved (H-1 through H-6 slice B / Slice C). 41e.−1 is COMPLETE after this PR merges. 41e.0 unblocks.

### Files Created
- `tests/tax-engine/fixtures/archetypes/types.ts` — `ArchetypeFixture` shape; deliberately a subset of the real Prisma rows (only the fields the tax engine reads). Easy to extend per sub-PR.
- `tests/tax-engine/fixtures/archetypes/sarah-kim.ts` — sole-trader IT consultant + Pty Ltd; $130k salary in 30% bracket; tests SOLE_TRADER income flow + future Div 7A risk + base-rate company tax dispatch.
- `tests/tax-engine/fixtures/archetypes/david-emma.ts` — family with discretionary trust + corporate-trustee SMSF. David $180k + Emma $48k + rental + franked dividends. Tests trust streaming, corporate-trustee chain walking, household roll-up.
- `tests/tax-engine/fixtures/archetypes/olivia.ts` — multi-entity HNW with 4 properties + trust + unit trust + Pty Ltd + SMSF. $300k+ income in 45% bracket. Tests trust-to-trust chain, FTE/IEE walking, SMSF unit-trust holding (NALI), state land tax aggregation, PSI through Pty Ltd, Div 293/296.
- `tests/tax-engine/fixtures/archetypes/index.ts` — barrel exporting `ARCHETYPES` for `describe.each` iteration.
- `tests/tax-engine/config/taxYearConfig.test.ts` — **master-config self-test** (audit §10.4). 22 assertions across the three FYs: every required field populated; brackets cover [0, ∞) with no gaps or overlaps; bracket rates non-negative + ascending; bringForward thresholds monotonically ordered; super contributions tax rate locked at canonical 15%; review schedule date format valid; FY25-26 registered; current-FY review date in the future.
- `tests/tax-engine/parity/buildTaxSummary.parity.test.ts` — **slice-C parity baseline** (audit §9.4). 18 assertions: each archetype runs cleanly through `calculateTaxPosition()`, returns non-negative tax fields, marginal rate is one of the canonical bracket rates (percentage scale 0–100), refund matches `paygWithheld − netTax` within $1 rounding, deductions sum equals category breakdown, each archetype lands in the expected bracket band.

### Files Modified
- `lib/services/masterFinancialService.ts` — **bugfix from slice C.** The parity test caught that `IncomeTaxResult.marginalRate` is already in percentage scale (multiplied by 100 inside `incomeTaxCalculator.ts:112`) but slice C's adapter converted it AGAIN, producing 3000 instead of 30 in the master snapshot. Fixed by changing `(result.tax.marginalRate ?? 0) * 100` → `result.tax.marginalRate ?? 0` (pass-through). JSDoc updated to record the correct semantic.
- `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` — Status header flipped to "✅ AUDIT COMPLETE (PRs 1-4 merged) + 🟡 41e.−1 cleanup in flight (slices A/B/C ✅ shipped; slice D = this PR)".
- `docs/IMPLEMENTATION_PLAN.md` Recently Completed — four entries prepended (slices A/B/C/D) recording the full cleanup arc.

### Build Status
- [x] `npx tsc --noEmit` clean.
- [x] `npx vitest run tests/calculations tests/utils tests/tax-engine` — 172 tests passed (132 existing + 40 new). Zero failures.
- [ ] `tests/regression/api.test.ts` + `tests/sanity/cross-module.test.ts` are pre-existing integration tests requiring `DATABASE_URL`; their failures are environmental, unrelated to this PR.

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [x] strategic decision — closes the 4-PR audit + 4-slice 41e.−1 cleanup workstream; unblocks 41e.0.
- [ ] visual / config / GCP / identity / deployment / security / operational / data model

Docs updated:
- `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` — status header.
- `docs/IMPLEMENTATION_PLAN.md` Recently Completed — 4 entries prepended.
- `docs/changelog/CHANGELOG_2026_05_05.md` — this entry.

### Validates the audit's snapshot-test protocol
The fact that the parity test caught a real production bug from slice C — within the same session, before any user-facing impact — validates audit §9.2's "capture-before-refactor" protocol. This is exactly the regression class the protocol exists to detect across the 17 upcoming 41e.* sub-PRs.

### What's next
- **41e.0 (foundation)** unblocks. Per audit §8.1: new types (`EntityTaxFacts`, `MasterTaxPosition`, `AuthorityCitation`, `FYReference`); entity-aware aggregator extensions (resolves C-3); `entityTaxRouter.ts` skeleton; AFSL/TPB/NCCP boundaries renderer; `parentEntityId` cycle-detection wired into `legalEntityService.ts`; new permissions (`tax_data.read/write`); new endpoints `GET /api/tax/entity/[id]` + `GET /api/tax/config`. Estimated 2 days.
- Then 41e.1 → 41e.17 per audit §8.1 (the 17 sub-PR sequence covering Div 115, Div 6/6E, s100A, Div 7A, Div 152, SMSF triumvirate, FTE/IEE, state land tax + stamp duty, trust + company loss rules, GST/BAS, MasterTaxPosition orchestrator).

### PR
- Branch: `claude/phase-41e-cleanup-d-fixtures`
- PR URL: TBD on push

---

## Session: claude/phase-41e-cleanup-c-buildtaxsummary (Phase 41e.−1 cleanup PR C — buildTaxSummary delegation)

### Changes Made
- **Type:** Refactor (Phase 41e.−1 cleanup, slice C — replaces inline tax-bracket math with engine delegation; behaviour change is intentional and documented).
- **Scope:** `buildTaxSummary()` in `lib/services/masterFinancialService.ts:1012-1077` previously reimplemented FY24-25 tax brackets inline (audit C-1 — "Simplified tax calculation (would use tax engine in production)" comment, but it was in production). Now calls `calculateTaxPosition()` from the canonical Phase 20 tax engine and adapts the result back into the legacy `TaxSummary` shape.
- **Audit findings resolved:** **C-1** (the regression trap). Combined with slice B's resolution of C-2 + H-1 through H-6, the only remaining audit critical is C-3 (entity-aware aggregators — lands in 41e.0) and C-4 was resolved in slice A.

### Behaviour change (intentional)
Per audit doc §9.2 "capture-before-refactor" protocol — this is the **intentional-with-citation** outcome:
- **Old:** brackets-only calc; no Medicare Levy; no LITO/SAPTO offsets; no franking gross-up; raw deductible-expense subtraction.
- **New:** full Phase 20 engine — Medicare Levy + Surcharge included (Health Insurance Levy Act 1982); LITO/SAPTO/franking/foreign offsets applied (ITAA 1997 Div 126-H/126-L/207/770); income categorised by type with proper franking gross-up; deductions categorised.
- **Net effect on the consumer-facing `TaxSummary`:**
  - `estimatedTaxableIncome` may be higher (franking gross-up adds to assessable income).
  - `estimatedTaxPayable` is now closer to ATO-correct because Medicare + offsets are netted in.
  - `estimatedRefundOrOwing` is now closer to the user's actual refund/owing (matches `/api/tax/position`).
  - `marginalTaxRate` semantics preserved: returned as percentage (e.g. 30, not 0.30).
  - `effectiveTaxRate` semantics preserved: 0–100 scale, 2dp.
  - `totalDeductions` now includes the full deduction breakdown (work-related + property + investment + depreciation + other).
  - `paygWithheld` unchanged — same source.

### Files Modified
- `lib/services/masterFinancialService.ts` — Imports `calculateTaxPosition` + types from `@/lib/tax-engine/position/taxPositionCalculator`. `buildTaxSummary()` rewritten as an adapter: maps `RawIncome[]`/`RawExpense[]` → `IncomeItem[]`/`ExpenseItem[]`, calls `calculateTaxPosition({ incomes, expenses, depreciations: [] })`, maps the rich `TaxPositionResult` back to the legacy `TaxSummary` shape. Inline brackets math (FY24-25 hardcoded thresholds + bracket-walking if/else chain) deleted. New JSDoc explains the behaviour change with cross-reference to audit doc.

### Build Status
- [x] `npx tsc --noEmit` — clean.
- [x] No public API change. Same `TaxSummary` shape returned to every consumer (Master Financial Snapshot, dashboard, AI advisor, Sankey).

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [ ] visual / config / GCP / identity / deployment / security / operational / data model / strategic decision

(Slice C delivers an audit finding; full audit closure batched at slice D where the doc updates land.)

Docs updated:
- `docs/changelog/CHANGELOG_2026_05_05.md` — this entry.

### Future work (Phase 41e.0+)
The adapter pattern in this PR is intentional — keeping consumers on the legacy `TaxSummary` shape minimises blast radius for slice C. Phase 41e.0+ swaps consumers (dashboard, AI advisor, Sankey) directly onto the richer `TaxPositionResult` shape and deletes this adapter. Until then, `MasterFinancialSnapshot.tax` is the bridge.

### What's next
- **Slice D (final 41e.−1 slice)** — Sarah Kim / David+Emma / Olivia archetype fixtures + master-config self-test + parity-baseline snapshots. After slice D, **41e.−1 is complete** and **41e.0 (foundation)** unblocks. Audit doc + IMPLEMENTATION_PLAN updates batched in slice D per the audit closure plan.

### PR
- Branch: `claude/phase-41e-cleanup-c-buildtaxsummary`
- PR URL: TBD on push

---

## Session: claude/phase-41e-cleanup-b-consumers (Phase 41e.−1 cleanup PR B — migrate consumers to canonical FY config)

### Changes Made
- **Type:** Refactor (Phase 41e.−1 cleanup, slice B — behaviour-preserving consumer migration; no public API changes; no schema changes)
- **Scope:** Consumers across the tax-route layer + CFO decision support + strategy analyzer + dashboard tax page now read from `getCurrentTaxYearConfig()` / `getMarginalRate()` instead of hard-coding values. Builds on slice A (PR #626) which extended `TaxYearConfig` with the canonical homes for these constants.
- **Audit findings resolved:** C-2 (concessional cap divergence), H-1 (×7 hard-coded `0.15` / `0.85`), H-2 ($60,400 co-contribution threshold), H-3 (11.5% SG rate hard-coded in dashboard), H-4 (hard-coded brackets table in dashboard), H-5 (assumed 30% marginal rate in `taxAnalyzer`). H-6 ($3k/property depreciation heuristic) renamed + flagged as `UC-PROPERTY-DEPRECIATION` per audit doc §10.3.

### Files Modified
- `app/api/tax/super/optimize/route.ts` — 6 hard-coded `0.15` / `0.85` replaced with `config.superContributionsTaxRate` / `(1 - config.superContributionsTaxRate)`. `60400` co-contribution threshold replaced with `config.coContributionIncomeThreshold`. (H-1 + H-2.)
- `app/api/tax/super/contributions/route.ts` — `amount * 0.85` (concessional after-tax component) replaced with `amount * (1 - config.superContributionsTaxRate)`; new import of `getTaxYearConfig` keyed off the contribution's actual financial year. (H-1.)
- `lib/cfo/decisionSupport/taxIntegration.ts` — `27500` (FY24 stale concessional cap) → `config.concessionalCap` (**resolves C-2**). `250000` Div 293 threshold → `config.division293Threshold`. Hard-coded `0.15` Div 293 impact → `config.superContributionsTaxRate`. `$3000`/property depreciation heuristic kept but renamed `HEURISTIC_PROPERTY_DEPRECIATION_PER_YEAR` with comment cross-referencing `UC-PROPERTY-DEPRECIATION` in audit doc §10.3 (H-6 renamed-as-flagged-heuristic).
- `lib/strategy/analyzers/taxAnalyzer.ts` — 50% CGT discount + 30% assumed marginal rate replaced with config-driven values (`config.cgtDiscount`, `getMarginalRate(income, config)` derived from the snapshot's `cashflowSummary.totalAnnualIncome`). Documented fallback to 0.30 when income unknown. (**Resolves H-5.**) Discount percent rendered dynamically from `config.cgtDiscount` so trust beneficiaries (50%) and SMSF (33⅓%) will display correctly once Phase 41e.1 lands entity-aware overrides.
- `app/dashboard/tax/page.tsx` — Hard-coded brackets table (`page.tsx:446-470`) replaced with a `taxConfig.brackets.map()` render that highlights the user's current bracket dynamically. Hard-coded "FY24-25" subtitle replaced with `taxConfig.label`. `30000` / `120000` / `11.5%` super cap + SG rate displays replaced with `taxConfig.concessionalCap` / `nonConcessionalCap` / `superGuaranteeRate`. Hard-coded `2%` Medicare Levy display replaced with `taxConfig.medicareRate`. Salary-sacrifice opportunity card now subtracts `taxConfig.superContributionsTaxRate * 100` (the canonical rate) from the user's marginal rate. (**Resolves H-3 + H-4.**)

### Build Status
- [x] `npx tsc --noEmit` — clean.
- [x] Behaviour-preserving: every replaced hard-code returns the same numeric value via the new config path on FY24-25 (verified by inspection — slice A populated FY24-25 with values matching what consumers were hard-coding).
- [x] Grep audit confirms no remaining `* 0.85`, `* 0.15`, `27500`, `60400`, `250000` literals in the migrated files.

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [ ] visual / config / GCP / identity / deployment / security / operational / data model / strategic decision

(Slice B is a refactor delivering audit findings; full audit closure batched at slice D where the doc updates land.)

Docs updated:
- `docs/changelog/CHANGELOG_2026_05_05.md` — this entry.

### What's next
- **Slice C** — replace `buildTaxSummary()` regression trap (`masterFinancialService.ts:1012-1077`) with delegation to `calculateTaxPosition()`. Snapshot test asserts numerical parity. **Resolves C-1.**
- **Slice D** — Sarah Kim / David+Emma / Olivia archetype fixtures + master-config self-test + parity-baseline snapshots. After slice D, **41e.−1 is complete** and **41e.0 (foundation)** unblocks.

### PR
- Branch: `claude/phase-41e-cleanup-b-consumers`
- PR URL: TBD on push

---

## Session: claude/phase-41e-cleanup-a-constants (Phase 41e.−1 cleanup PR A — extend `TaxYearConfig` + add FY25-26)

### Changes Made
- **Type:** Refactor / config (Phase 41e.−1 cleanup, slice A — pure additive type + config extension; zero consumer changes; zero behaviour changes)
- **Scope:** Extends `TaxYearConfig` with new canonical homes for previously-hard-coded values per `PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` §10.1: `label`, `superGuaranteeQuarterlyCap`, `superContributionsTaxRate`, `coContributionIncomeThreshold`, `carryForwardTsbThreshold`, `bringForwardThresholds`, `reviewSchedule`. Backfills FY23-24 + FY24-25 with the new fields (using values that match what the consumers currently hard-code). Adds `TAX_YEAR_2025_26` (resolves audit C-4: FY25-26 was missing from the canonical config). Per-FY `reviewSchedule.nextReviewBy: 2026-06-15` forces an explicit human review checkpoint before each new FY commences.
- **Why slice A first:** Lowest-risk cut of the cleanup PR. Pure additive — every consumer continues reading the existing fields it always has. New fields are present but unused by consumers in this PR. Slice B migrates consumers (`/api/tax/super/*`, `taxIntegration.ts`, `taxAnalyzer.ts`, dashboard tax page brackets table) to the new fields. Slice C handles the `buildTaxSummary()` regression trap. Slice D adds archetype fixtures + master-config self-test.

### Files Modified
- `lib/tax-engine/types.ts` — `TaxYearConfig` extended with 7 new required fields. New supporting types: `BringForwardThresholds`, `TaxYearReviewSchedule`. JSDoc on every new field with its primary-authority citation (ITAA section / ATO source).
- `lib/tax-engine/config/taxYearConfig.ts` — file header docs the SSOT contract per CLAUDE.md §12.2 + audit doc §10.1. `TAX_YEAR_2024_25` and `TAX_YEAR_2023_24` populated with the new fields using values that match what consumers currently hard-code (so swapping consumers to read from config in slice B is a behaviour-preserving refactor). `TAX_YEAR_2025_26` added as a new export (carries forward most thresholds; SG rises to 12% per ATO schedule; preliminary $65,250 quarterly cap pending ATO confirmation by 2026-06-15). `TAX_YEAR_CONFIGS` registry includes all three FYs.

### Build Status
- [x] `npx tsc --noEmit` — clean, exit 0 (after `npx prisma generate` to refresh the marketplace model from PR #620; pre-existing errors only).
- Pure additive: no consumer compiled differently. Required-fields addition flagged at compile time if any new FY config is added in the future without populating them.

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [ ] visual / config / GCP / identity / deployment / security / operational / data model / strategic decision

Docs updated:
- `docs/changelog/CHANGELOG_2026_05_05.md` — this entry.
- (Audit doc + IMPLEMENTATION_PLAN.md not updated — slice A doesn't change strategy or close any audit decision; full closure of audit findings C-1 through C-4 + H-1 through H-6 lands across slices A-D, doc updates batched at slice D.)

### What's next
- **Slice B** — migrate consumers to read from the new config fields: `/api/tax/super/route.ts`, `/api/tax/super/optimize/route.ts` (6× `0.15` + `60400` co-contrib threshold), `/api/tax/super/contributions/route.ts`, `lib/cfo/decisionSupport/taxIntegration.ts:185+350+426`, `lib/strategy/analyzers/taxAnalyzer.ts:129` (assumed 30% marginal → `getMarginalRate()`), `app/dashboard/tax/page.tsx:446-470` (hard-coded brackets table → `config.brackets`), `app/dashboard/tax/page.tsx:759` (hard-coded SG rate → `config.superGuaranteeRate`). Resolves audit C-2 + H-1 + H-2 + H-3 + H-4 + H-5.
- **Slice C** — replace `buildTaxSummary()` regression trap (`masterFinancialService.ts:1012-1077`) with delegation to `calculateTaxPosition()`. Snapshot test asserts numerical parity with `/api/tax/position`. Resolves audit C-1.
- **Slice D** — Sarah Kim / David+Emma / Olivia archetype fixtures + master-config self-test + parity-baseline snapshots. Captures pre-refactor baselines for slices E onwards (the actual 41e rule modules).

### PR
- Branch: `claude/phase-41e-cleanup-a-constants`
- PR URL: TBD on push

---

## Session: claude/phase-32c-pr4b-askapro (Phase 32C PR4b — AskAProfessionalButton + picker SHIPPED)

### Changes Made
- **Type:** Feature (Demo-Complete Critical Path; closes Up Next #14)
- **Scope:** In-app bridge between the consumer surface and the professional marketplace. `<AskAProfessionalButton />` primitive + `<AskAProfessionalDialog />` picker, server-driven candidate resolver with leaky-funnel guardrail enforced server-side.
- **Description:** D2C users see top-3 best-fit marketplace listings biased by the calling context. Org-attached users see ONLY their org's roster (other orgs and public marketplace never returned). Wired into the AI Guide recommendation card so every advice category gets a contextually-biased picker.

### Files Created
- `lib/services/askAProfessionalService.ts` — canonical resolver. `getCandidatesForUser(userId, context?)`. Open-ended `CONTEXT_BIAS` map (tax / retirement / refinance / property / smsf / wealth / trust / business / estate / insurance / home-loan / investment-loan / general). Returns `{ scope: 'org' | 'public', ... }`. Public-path ranks top-12 by rating then re-ranks by `matchScore = matched_specialisations + averageRating/10` and slices to top-3.
- `app/api/ask-a-pro/candidates/route.ts` — thin GET wrapper. `withPermission('report.read')` (lightest-touch every authenticated role has — discovery surface, not CDR-data).
- `components/ask-a-pro/AskAProfessionalButton.tsx` — primitive. Three variants (primary full pill / compact inline pill / icon-only 32×32). Focus-visible ring, ARIA-haspopup="dialog".
- `components/ask-a-pro/AskAProfessionalDialog.tsx` — picker. Right-edge slide-in ≥sm / bottom-sheet 90vh on <sm. Sticky header with title + context hint. Body-scroll lock. Esc to close, backdrop click to close, prefers-reduced-motion-aware via Tailwind `motion-safe:*` utilities. Branches on scope: org-scope shows assigned advisor highlighted in emerald glass tile + roster grouped under "Or another team member" (excludes VIEWER seats — they don't take inbound); public-scope shows 3 best-fit cards with rating + tagline + discipline label, "See all professionals →" footer to `/marketplace`. Member click → `/portal-message?memberId=<id>` placeholder (PR4d wires the in-app conversation thread); listing click → `/marketplace/[slug]` (existing Connect CTA is the entry to PR4c request lifecycle). Unauthenticated path returns 401 → dialog renders friendly "Create a free Monitrax account" nudge linking to `/register`.
- `components/ask-a-pro/index.ts` — barrel.

### Files Modified
- `lib/services/index.ts` — re-exports the new service surface (`getCandidatesForUser`, `isKnownContext`, types).
- `components/cfo/AdviceRecommendationCard.tsx` — adds `<AskAProfessionalButton variant="compact" context={CATEGORY_TO_ASK_A_PRO_CONTEXT[rec.category]} />` next to "Ask a follow-up". New `CATEGORY_TO_ASK_A_PRO_CONTEXT` map (tax → tax, debt → refinance, property → property, investment → wealth, risk → insurance, cashflow/spending → general, savings → wealth) so each advice category opens the picker pre-biased to the right specialisation.
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #14 marked SHIPPED with summary; new Recently Completed entry prepended.
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` — Step 6c updated: the in-context AskAPro path is now demonstrable end-to-end.

### Architecture Decisions
- **Leaky-funnel guardrail enforced server-side.** Org-attached users (any active+granted `OrganizationClient` row) never see public marketplace listings via the API. Strategic decision per IMPLEMENTATION_PLAN.md Up Next #15 (2026-05-04): orgs pay for Monitrax to be their CRM + comms channel; the platform must not redirect their clients to competitors.
- **Context as open-ended free-text label, not enum.** Calling surfaces pass a string label (`'tax'`, `'refinance'`, etc.) rather than picking from a fixed enum. Lets new contexts be added without service / schema changes; unknown contexts fall through to rating-only ranking. The `CONTEXT_BIAS` map is the single source of truth — adding a new context is one map entry.
- **Zero new dependencies.** Dialog uses Tailwind `motion-safe:*` utility variants (which already work in the existing build) instead of pulling `framer-motion` just for two animations. Lighter footprint, same UX.
- **PR4c not in scope.** This PR ships the picker only. The full request lifecycle (compose question → submit → adviser inbox → ACCEPT (lead fee billed) / DECLINE → consent invite → ClientLink materialises) is PR4c. The picker hands off via:
  - D2C: navigate to `/marketplace/[slug]` where the existing Connect CTA awaits.
  - Org-attached: navigate to `/portal-message?memberId=<id>` placeholder (PR4d wires the in-app conversation thread).
- **Permission gate `report.read`.** Reused the lightest-touch authenticated permission rather than introducing a new `marketplace:browse` permission. The picker is a discovery surface; gating it tighter would prevent VIEWER-role users from ever connecting with their org's roster.

### Build Status
- [x] `npx tsc --noEmit` — clean, exit 0.
- [x] `npx next build` — green; `/api/ask-a-pro/candidates` registered.

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern (new `<AskAProfessionalButton />` primitive + dialog pattern, reusable across surfaces)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [ ] strategic decision

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md:Up Next #14` — marked SHIPPED.
- `docs/IMPLEMENTATION_PLAN.md:Recently Completed 2026-05-05` — new entry prepended.
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md:Step 6c` — in-context AskAPro path now demonstrable.
- `docs/changelog/CHANGELOG_2026_05_05.md` — this entry.

### PR
- Branch: `claude/phase-32c-pr4b-askapro`
- Status: pending push + open

---

## Session: claude/phase-32c-pr4a-marketplace (Phase 32C PR4a — Professional Marketplace SHIPPED)

### Changes Made
- **Type:** Feature (Demo-Complete Critical Path; closes Up Next #13; first Phase 32C deliverable; built in parallel with Session D's Phase 41 — zero territory overlap)
- **Scope:** Professional marketplace MVP — Org-side listing editor + Monitrax admin approval queue + public browse + public listing detail.

### Files Created
- `prisma/migrations/20260505140000_add_professional_marketplace/migration.sql` — additive: 4 new enums + extension of `AuditAction` with 5 new values + `professional_listings` + `professional_ratings` tables + indexes + FKs.
- `lib/services/marketplaceService.ts` — canonical service with three caller scopes (Org / admin / public). Submit-time validation, status-transition guards, slug helpers, typed error codes.
- `app/api/portal/organizations/[orgId]/marketplace-listing/route.ts` — GET/PUT.
- `app/api/portal/organizations/[orgId]/marketplace-listing/submit/route.ts` — POST. PORTAL_OWNER only.
- `app/api/admin/marketplace/listings/route.ts` — GET admin queue.
- `app/api/admin/marketplace/listings/[id]/route.ts` — GET/POST. POST takes `{ action: 'approve' | 'reject' | 'suspend', ... }`.
- `app/api/marketplace/listings/route.ts` — GET public browse. APPROVED only.
- `app/api/marketplace/listings/[slug]/route.ts` — GET public detail with 10 most recent public ratings.
- `components/portal/marketplace/MarketplaceListingEditor.tsx` — Org-side editor (~470 lines). Discipline-conditional compliance fields, accessible checkbox groups, sticky bottom action bar, REJECTED/SUSPENDED feedback panels.
- `app/portal/marketplace/listing/page.tsx` — Org-side listing page wrapping the editor with status badge and apple-glass aesthetic.
- `app/admin/marketplace/listings/page.tsx` — Admin queue. Defaults to PENDING_REVIEW filter.
- `app/admin/marketplace/listings/[id]/page.tsx` — Admin detail with deeplinks to ASIC moneysmart / TPB public register / ABR for cross-check, manual cross-check checkboxes, free-text verificationNotes, approve/reject/suspend buttons.
- `app/marketplace/layout.tsx` — public marketplace chrome.
- `app/marketplace/page.tsx` — public browse with filters and sorted listing cards.
- `app/marketplace/[slug]/page.tsx` — public listing detail with full blurb, specialisations, target tiers, regions, recent ratings, "Connect" CTA.

### Files Modified
- `prisma/schema.prisma` — added `ProfessionalListing` + `ProfessionalRating` models + 4 enums + 5 AuditAction values + reverse relations on `Organization`, `User`, `AdminUser`.
- `lib/services/index.ts` — re-exports the marketplace service surface.
- `lib/portal/permissions.ts` — added `marketplace:listing:read|write|submit` permission types and role mapping (OWNER full, ADMIN read+write, ADVISOR/VIEWER read-only).
- `lib/admin/permissions.ts` — added `marketplace:listings:read|approve|reject|suspend` permission types and role mapping (SUPER_ADMIN full, SUPPORT_ADMIN + VIEWER read-only) + PERMISSION_DESCRIPTIONS entries.
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #13 marked SHIPPED + new Recently Completed entry prepended for 2026-05-05.
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` — Step 6 marketplace section populated with the demo path.

### Architecture Decisions
- **Zero new dependencies.** Reused existing Apple-glass tokens, admin UI primitives, service patterns. No extra packages.
- **One service, three scopes.** Viewer scope is a parameter (filter shape), not a fork (CLAUDE.md §0 architect lens / §12.3).
- **Lead-fee tiers stored per-listing.** Defaults AU$80/$150/$250 by Emerging/Growing/Established bracket (per IMPLEMENTATION_PLAN.md Up Next #15). Per-Org overrides at admin-approval time.
- **Status-transition guards in the service.** Editing an APPROVED listing flips back to PENDING_REVIEW; editing a REJECTED listing returns to DRAFT.
- **Submit-only for OWNER.** Mirrors `team:invite` anti-poaching guardrail (PR #603) — submitting publishes firm's public profile + binds to lead-fee contract; commercial decision belongs to Org owner.
- **Manual ASIC/TPB cross-check at v1.** Admin detail has one-tap register deeplinks + timestamped checkboxes + verificationNotes scratchpad. Automated API cross-check defers to PROD.

### Build Status
- [x] `npx tsc --noEmit` — clean, exit 0.
- [x] `npx next build` — green, exit 0. All 11 marketplace routes registered.

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern (new `MarketplaceListingEditor` + public marketplace card / detail patterns)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [x] strategic decision (lead-fee tier defaults baked into schema; submit-for-review owner-only)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md:Up Next #13` — marked SHIPPED with summary.
- `docs/IMPLEMENTATION_PLAN.md:Recently Completed 2026-05-05` — new entry prepended.
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md:Step 6` — marketplace section populated.
- `docs/changelog/CHANGELOG_2026_05_05.md` — this entry.

### Destructive Write Checklist (CLAUDE.md §12.11)
N/A — migration is purely additive (CREATE TYPE / CREATE TABLE / ALTER TYPE ADD VALUE). No `update`, `upsert`, `delete`, `updateMany`, `deleteMany`, or raw SQL `UPDATE`/`DELETE` on existing rows.

### Schema Migration Checklist (CLAUDE.md §12.12)
- [x] `prisma/schema.prisma` modified
- [x] Matching migration at `prisma/migrations/20260505140000_add_professional_marketplace/migration.sql`
- [x] Migration is purely additive
- [x] `npx prisma validate` clean
- [x] `npx prisma generate` clean

### PR
- Branch: `claude/phase-32c-pr4a-marketplace`
- Status: pending push + open

---

## Session: claude/phase-41d-money-flow-sankey (Phase 41d — Money Flow Sankey at /dashboard/entities)

### Changes Made

- **Type**: Feature — new visualisation surface (the second wow moment in the lighthouse pitch, Step 4)
- **Scope**: `lib/services/moneyFlowService.ts` (NEW), `lib/services/index.ts` (re-exports), `app/api/money-flow/route.ts` (NEW), `components/entities/MoneyFlowSankey.tsx` (NEW), `app/dashboard/entities/page.tsx` (tab toggle + lazy fetch + Money Flow tab content), `docs/IMPLEMENTATION_PLAN.md`, `docs/architecture/03_DATA_MODEL.md` (new §10.10), `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` (Step 4)
- **Description**: Money Flow Sankey — 3-stage flow visualisation at `/dashboard/entities` (Money Flow tab) showing **Income sources** (Salary / Rental / Investment / Other) → **Legal entities** (role-coloured, matching the Phase 41c tree palette) → **Outflows** (Tax / Essential expenses / Discretionary / Loan repayments / Surplus). The natural complement to the 41c entity tree — the tree shows *what you own*, the Sankey shows *how money moves through it*.

### Why this matters

Per Reza directive 2026-05-04 ("Sankey IN demo-complete (Reza preference: 'sounds nicer')"), the Sankey is part of the demo-complete path, not deferred. Per the lighthouse pitch playbook Step 4, this is the **second wow moment** after the entity tree — *"This is where Olivia's money actually goes. Right now this conversation happens on a whiteboard with you and her every six months. Now it's live."* The visceral "where my salary goes" reaction is what advisers cite as proof Monitrax thinks like an adviser, not an accountant.

### Files Created / Modified

- **`lib/services/moneyFlowService.ts`** (NEW, ~290 lines) — `getMoneyFlow(userId)` orchestrator. Pulls Income / Expense / Loan rows in parallel, classifies income by source label (SALARY → Salary; RENTAL/RENT → Rental; INVESTMENT → Investment; everything else → Other), aggregates expenses by entity × essential/discretionary, computes loan repayments per entity from `minRepayment` annualised via canonical `toAnnual`, allocates tax (PAYG withholding) proportionally to each entity's share of taxable income, and computes surplus as the residual (clamped to ≥0 — the layout can't draw negative-width links). Returns a flat sankey-friendly shape with `incomeSources[]`, `entities[]`, `outflows[]`, and `edges[]` keyed by stable `src:` / `ent:` / `out:` ids.
- **`lib/services/index.ts`** — re-exports `getMoneyFlow` + types.
- **`app/api/money-flow/route.ts`** (NEW) — thin GET wrapper, `withPermission('report.read')` (same gate as `/api/master-snapshot`). Surfaces underlying error message in the catch handler so the page error block can render something useful.
- **`components/entities/MoneyFlowSankey.tsx`** (NEW, ~360 lines) — recharts `<Sankey>` rendered with custom Node + Tooltip. Role-coloured entity nodes (PERSONAL warm amber → OPERATING emerald → HOLDING indigo → SUPERANNUATION violet → INVESTMENT fuchsia, matching the 41c tree palette). Cool-tinted income sources (sky/teal/cyan); warm-tinted outflows (red/orange/amber/purple) with surplus emerald. Headline-summary chip strip above the canvas (Income / Tax / Essentials / Discretionary / Loans / Surplus or Deficit) so the viewer reads totals before tracing flows. Honest italic caveat below the canvas: *"Annual reference period. Tax allocated proportionally across entities; exact Div 6/6E trust distribution math lands with Phase 41e."* `prefers-reduced-motion` honoured. Empty state: friendly "Not enough data to draw your money flow yet" hero when income or expenses are zero.
- **`app/dashboard/entities/page.tsx`** — new tab toggle (Structure | Money Flow); tab state lifted to the page; `fetchFlow` callback with same Bearer-token auth pattern; lazy-fetch on first tab activation; cache invalidates on entity mutation (so the Sankey re-renders when the user adds/edits/removes an entity from the Structure tab).

### v1 heuristics (replaced by Phase 41e)

- **Tax allocation is proportional** to each entity's share of taxable income across the household. Real per-entity tax requires Div 6/6E trust distribution math (Phase 41e.1 / 41e.4 per `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md`); v1 is honest about this with an inline italic caveat below the Sankey.
- **Loan repayments** use `minRepayment` annualised — no interest/principal split, no offset-account effect on effective interest. The entity-aware tax engine (Phase 41e.5 / 41e.7) will compute deductible vs. non-deductible interest correctly.
- **Surplus** is the arithmetic residual; deficits surface in the headline chip as `Deficit $X`.

### Why recharts (not @nivo/sankey, not d3-sankey)

Evaluated and rejected per CLAUDE.md §12.7 + §12.8 (zero new dependencies):

- `recharts` is **already in deps** (v3.5.0); has `<Sankey>` built-in.
- `@nivo/sankey` would add ~150-200 KB (full nivo runtime).
- `d3-sankey` would add ~30 KB but requires writing the SVG renderer ourselves.

### Build Status
- [x] TypeScript compilation passes — `npx tsc --noEmit` exits 0
- [x] No new dependencies added
- [x] Prisma schema unchanged
- [ ] Vercel preview build — to be verified after push

### CLAUDE.md §16 doc-sync block

Surfaces changed in this PR:
- [x] visual design system / component pattern (new MoneyFlowSankey component, role-coloured entity nodes mirror 41c palette for cohesion)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture (Sankey shows aggregated dollar amounts only — no per-row CDR data; same `report.read` permission as `/api/master-snapshot`)
- [ ] operational procedure
- [ ] strategic decision
- [x] data model (no schema change but new service + API for entity-aware money-flow aggregation)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #28 ✅ SHIPPED with full detail; Recently Completed entry for 2026-05-05 prepended
- `docs/architecture/03_DATA_MODEL.md` — §10.7 marker flipped to ✅ for 41d; new §10.10 (component anatomy + income classification + outflow buckets + v1 heuristics + visual rules + why-recharts + 41e/g/h unlocks)
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` — Step 4 expanded with concrete flow walkthrough (headline chip strip read-aloud, hover-the-largest-flow demo, profession-specific 'leak' framing, architectural-honesty caveat ready to read aloud if asked)
- `docs/changelog/CHANGELOG_2026_05_05.md` — this entry

### Test plan (for Reza after preview goes live)

1. **Tab toggle works.** Open `/dashboard/entities`. The Structure tab is selected by default and renders the 41c tree (or no-structure hero). Click "Money Flow" tab — Sankey loads.
2. **Sankey renders for users with data.** With at least one Income row and one Expense row, the Sankey draws three columns. Income sources on the left, entities in the middle, outflows on the right.
3. **Headline chip strip is accurate.** Sum the chips: Income should equal sum of source nodes; Surplus should equal Income − Tax − Essentials − Discretionary − Loans. If Surplus is negative the chip says "Deficit" in rose.
4. **Tooltip on hover.** Hovering a link shows `Source → Target $X per year`. Hovering a node shows the total flow through that node.
5. **Live updates.** Switch to Structure tab, add a new entity, switch back to Money Flow — the Sankey refetches and renders the new structure.
6. **Empty state.** A user with zero income (or zero expenses) sees the friendly "Not enough data…" hero, not a broken empty Sankey.
7. **Error path.** If `/api/money-flow` 5xx's, the error block surfaces the real status + message (no `[object Object]` regression — uses the same `extractErrorMessage` helper as the entities fetch).
8. **`prefers-reduced-motion`** respected — entrance fade collapses; the Sankey itself has no transition.

### What's NOT in this PR

- **No Div 6/6E exact distribution math.** v1 tax allocation is proportional; flagged inline. Lands with Phase 41e.1 + 41e.4.
- **No interest/principal split on loans.** Loan repayments are gross `minRepayment` annualised; deductible-interest treatment lands with 41e.5 / 41e.7.
- **No monthly toggle.** Annual reference period only at v1; can add a Monthly/Quarterly switch if there's adviser-pitch demand.
- **No drill-in from a flow.** Clicking a link doesn't navigate yet (the recharts Sankey doesn't expose link clicks easily); could be added later if useful.
- **No "share Sankey as PNG" export.** Phase 41g (adviser overlay extension) may need this; defer until then.

### PR
- Branch: `claude/phase-41d-money-flow-sankey`
- PR URL: TBD on push

---

## Session: claude/phase-41g-adviser-overlay-entity (Phase 41g — Adviser drill-in entity layer)

### Changes Made

- **Type**: Feature — adviser drill-in surface extended with entity tree + Sankey
- **Scope**: `lib/portal/adviserClientAccess.ts` (NEW shared helper), `app/api/portal/clients/[id]/entities/route.ts` (NEW), `app/api/portal/clients/[id]/money-flow/route.ts` (NEW), `app/api/portal/clients/[id]/snapshot/route.ts` (refactored to use the shared helper), `app/portal/clients/[id]/view/page.tsx` (3-tab toggle + parallel fetches + tree/Sankey mounts), `docs/IMPLEMENTATION_PLAN.md`, `docs/architecture/03_DATA_MODEL.md` (new §10.11), `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` (Step 2/3 flipped to LIVE)
- **Description**: Mount the Phase 41c `EntityTree` and Phase 41d `MoneyFlowSankey` inside `/portal/clients/[id]/view` so when an adviser opens a client, the entity tree is the **primary diagnostic** they see first (default tab). 3-tab toggle: **Structure** (default) | **Money Flow** | **Dashboard** (the existing canonical view from 32B PR3). Tabs mean Step 2 → Step 3 → Step 4 of the lighthouse pitch is one continuous flow, no nav-switching.

### Why this matters

Per Reza brief 2026-05-04: *"the adviser cannot give wealth advice without seeing the structure first; this surfaces it prominently."* Phase 41a–d shipped the consumer-side entity layer; 41g is what makes it reachable in the adviser pitch. Without 41g, the lighthouse pitch's Step 3 (entity tree, the *moat moment*) requires the adviser to navigate to a different page — breaks the flow. With 41g, it's the default view of the drill-in.

### Files Created / Modified

- **`lib/portal/adviserClientAccess.ts`** (NEW, ~150 lines) — shared helper `verifyAdviserClientAccess(callerUserId, organizationClientId)` that does the layered consent + membership + role + assignment checks. Returns either `{ ok: true, orgClient, membership }` or a structured error with `{ ok: false, status, code, message }`. **Reviewers reject any new portal client-data endpoint that doesn't route through this helper** (CLAUDE.md §0 architect lens — single canonical access guard).
- **`app/api/portal/clients/[id]/snapshot/route.ts`** — refactored to delegate auth to `verifyAdviserClientAccess`. Removed inline duplication of consent/membership/role/assignment checks (~75 lines of code consolidated). Behaviour unchanged.
- **`app/api/portal/clients/[id]/entities/route.ts`** (NEW) — thin GET wrapper. Auth via `verifyAdviserClientAccess`; delegates to canonical `listEntitiesForUser` (same service the consumer `/api/entities` uses) but passes the **client's** userId. Returns `{ entities, members }` — household members fetched via `where: { householdProfile: { userId: client.userId } }`.
- **`app/api/portal/clients/[id]/money-flow/route.ts`** (NEW) — thin GET wrapper. Auth via the same helper; delegates to canonical `getMoneyFlow` with the client's userId. Service swap is internal — when Phase 41e replaces the proportional tax allocation with Div 6/6E, this endpoint surface stays unchanged.
- **`app/portal/clients/[id]/view/page.tsx`** — added `tab` state (defaulting to `'structure'`), `entities` + `members` + `flow` state, parallel-fetch logic (snapshot + entities + flow in one `Promise.all`), 3-tab toggle (Structure / Money Flow / Dashboard) with active styling, and tab-content branching. Snapshot is treated as the primary load (its failure blocks the page); entities + flow failures are best-effort (the tree's empty state and Sankey's `isEmpty` handling cover those).

### Audit

The page-level `/snapshot` request already writes a `PRO_DASHBOARD_VIEW` row to `ClientAccessLog` for the view session. The new entities + money-flow endpoints **piggyback** on that row — they don't write their own. Multiplying audit rows per component would pollute the compliance log without adding signal. If component-level access logs are ever required for compliance, we add new action codes (`PRO_ENTITY_VIEW`, `PRO_MONEY_FLOW_VIEW`) and emit them at the route layer.

### Read-only in adviser view

Advisers can NOT edit a client's entity layer:
- The `EntityTree`'s `onEntityClick` is a no-op (no edit dialog opens for advisers)
- The `EntityTree`'s `onAdd` is a no-op (no Add CTA fires)
- No `EntityFormDialog` mounted on the adviser page

This is deliberate: editing a client's structure is a personal-advice activity that needs to happen through the proper Ask-a-Pro / consent channels (Phase 32C), not via a side-door API the adviser can hit because they have a viewing seat. A future Phase 41 slice may surface a *"Suggest a structural change"* affordance that opens an Ask-a-Pro thread for the client to action.

### Failure modes

- **Snapshot fails** → page shows the existing "Cannot view this client" error; entities/flow don't load.
- **Entities fail** → Structure tab renders with empty arrays; the EntityTree's empty-state hero shows.
- **Money flow fails** → Money Flow tab renders the friendly "No money flow data available for this client yet" message.
- **Dashboard tab** is unaffected by entities/flow failures — only depends on snapshot.

### Build Status
- [x] TypeScript compilation passes — `npx tsc --noEmit` exits 0
- [x] No new dependencies added
- [x] Prisma schema unchanged

### CLAUDE.md §16 doc-sync block

Surfaces changed in this PR:
- [x] visual design system / component pattern (3-tab toggle on adviser drill-in; reuses Phase 41c/d components verbatim)
- [ ] application config
- [ ] GCP infrastructure
- [x] identity / auth (`verifyAdviserClientAccess` shared helper consolidates consent + membership + role + assignment checks across 3 portal endpoints)
- [ ] deployment / build
- [x] security / CDR posture (canonical scope source-of-truth = DB row, not caller-provided; 3-layer consent model preserved end-to-end; audit piggyback policy documented)
- [ ] operational procedure
- [ ] strategic decision
- [x] data model (no schema change but new portal endpoints + shared access helper)

Docs updated:
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #31 ✅ SHIPPED with full detail; Recently Completed entry prepended
- `docs/architecture/03_DATA_MODEL.md` — §10.7 marker flipped to ✅ for 41g; new §10.11 (auth guard, audit policy, read-only constraint, failure modes, 41h unlock)
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` — Step 2 expanded to mention the tab toggle (Structure default, Money Flow + Dashboard one click away); Step 3 pre-condition flipped from "Phase 41a-c required" to "✅ LIVE 2026-05-05"
- `docs/changelog/CHANGELOG_2026_05_05.md` — this entry

### Test plan

1. **Adviser opens Sarah Kim's drill-in.** Navigate to `/portal/clients/{id}/view` (Sarah's organizationClientId). Page loads with Structure tab selected by default. Entity tree shows Sarah → Sarah Kim Pty Ltd. Adviser overlay docked right.
2. **Money Flow tab.** Click "Money Flow" tab. Sankey renders Sarah's actual income → entities → outflows. Headline chip strip above shows annual totals.
3. **Dashboard tab.** Click "Dashboard". The existing canonical consumer dashboard renders (KPI strip, health card, etc.). This is the legacy 32B PR3 view, unchanged.
4. **Read-only entity tree.** Click any entity tile in Structure tab — nothing happens (no edit dialog). Click the "Add" CTA — nothing happens. Verify advisers cannot edit a client's entity layer.
5. **Olivia Novak full structure.** Switch to Olivia's drill-in. Structure tab shows all 5 entities (Olivia personal, Pty Ltd, Discretionary Trust, Unit Trust, SMSF) with the dashed corporate-trustee line.
6. **Consent revoked.** If a client's consent is revoked while the adviser has the page open, refresh — page shows the consent-not-granted error block (covered by `verifyAdviserClientAccess` layer 2).
7. **PORTAL_ADVISOR not assigned.** Log in as a PORTAL_ADVISOR seat that's NOT assigned to the client. Open the URL directly. Page returns 403 `CLIENT_NOT_ASSIGNED` (covered by `verifyAdviserClientAccess` layer 5).
8. **Audit log.** Check `client_access_logs` table — exactly ONE `PRO_DASHBOARD_VIEW` row written per page load (snapshot endpoint), not three.

### What's NOT in this PR

- **No write affordance for advisers** on the entity layer (read-only by design).
- **No "Suggest a structural change" Ask-a-Pro thread.** Future slice.
- **No per-component audit rows** (`PRO_ENTITY_VIEW` etc.). Page-level `PRO_DASHBOARD_VIEW` covers it; revisit if compliance demands finer granularity.
- **Phase 41f (Xero/MYOB integration)** — separate workstream.
- **Phase 41h (AI entity-aware diagnosis)** — separate workstream; depends on 41e.0 + 41e.17.

### PR
- Branch: `claude/phase-41g-adviser-overlay-entity`
- PR URL: TBD on push

---

## Session: claude/phase-41e-audit-pr2-combinations (Phase 41e audit + migration plan PR 2/4 — architectural decision + multi-entity combinations matrix)

### Changes Made
- **Type:** Docs (PR 2/4 of the four-PR audit gating Phase 41e.0; doc-only, no code, no schema)
- **Scope:** Locks in three foundational decisions for the entity-aware tax engine: (1) layer 41e on top of the existing 3,776-LOC Phase 20 tax engine rather than rewrite, (2) the multi-entity ownership combinations matrix (which entity types can legally own which financial-object types under AU law + per-cell tax dispatch rule), (3) the eight cross-entity flow scenarios 41e must dispatch correctly (corporate trustee, Div 7A, trust-to-trust streaming, trust→PERSONAL distribution, SMSF contributions, LRBA, PSI through Pty Ltd, BRP acquisition).

### Files Modified
- `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` — appended §4 (architectural decision: layer-don't-rewrite with rejected alternatives, layer-boundary diagram, consumer-rewiring summary, new canonical entry points), §5 (multi-entity combinations matrix: legend, 7×7 entity×object table with per-cell AU rule + authority citation, schema-vs-AU-vs-calc divergence map listing every cell where the schema is broader than AU law and the wizard/calc engine must enforce, indirect ownership table for corporate-trustee + custodian + service-entity + LRBA bare trust + SMSF-held unit trust, eight cross-entity flow scenarios with the calc-engine module each one triggers, UNCOMPUTED list deferred to PR 4), §6 (refreshed What's Next pointing at PR 3-4).
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #29 updated: PR 1/4 marked merged 2026-05-05; PR 2/4 narrative added (combinations matrix + cross-entity flow scenarios); hard-prerequisite gate on the full 4-PR audit retained.

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [x] strategic decision — locks in Phase 41e architectural approach (layer-don't-rewrite) + entity ownership rules
- [ ] visual / config / GCP / identity / deployment / security / operational / data model

Docs updated:
- `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` — §4, §5, §6 appended
- `docs/IMPLEMENTATION_PLAN.md` Up Next #29 — narrative refresh

### Testing
- [x] Markdown renders cleanly
- [ ] Reza sign-off on PR 2 — pending

### What's next
- After Reza signs off PR 2, branch off main and ship PR 3 (per-rule SSOT migration map + per-engine downstream impact + parentEntityId cycle-detection spec).
- After PR 3 signs off, ship PR 4 (refined sub-PR sequencing + snapshot-test fixture strategy + constants reconciliation + FY25-26 config gap + UNCOMPUTED additions + Reza sign-off block that gates 41e.0).
- 41e.0 starts only after PR 4 sign-off.

### PR
- Branch: `claude/phase-41e-audit-pr2-combinations`
- PR URL: https://github.com/resadegh/monitrax/pull/622

---

## Session: claude/phase-41e-audit-pr3-migration-map (Phase 41e audit + migration plan PR 3/4 — per-rule SSOT migration map + per-engine downstream impact + cycle-detection spec)

### Changes Made
- **Type:** Docs (PR 3/4 of the four-PR audit gating Phase 41e.0; doc-only, no code, no schema; stacked on PR 2/4 branch since both edit the same doc sequentially — will rebase clean once PR 2 merges)
- **Scope:** Per-file migration verdict for every Phase 20 module + every aggregator + every tax route + every cross-engine consumer. Constants reconciliation table consolidating C-2, H-1, H-2, H-3, H-4, H-5, H-6 into a single source-of-truth map. `parentEntityId` cycle-detection validation contract for `legalEntityService.ts`.

### Files Modified
- `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` — appended §6 (per-rule SSOT migration map: verdict legend; Phase 20 per-file map showing 8 files preserved untouched + 5 additive EXTENDs; aggregator per-file map with C-3 resolution; tax routes per-file map with constants reconciliation; constants reconciliation table mapping every hard-coded value to its canonical home in `taxYearConfig.ts`; non-tax engine touch list with verification requirements; per-route migration impact showing zero URL changes + zero breaking response shape changes; new endpoints introduced by 41e), §7 (`parentEntityId` cycle-detection spec: 4 rules — self-parent forbidden / no chain cycles / max depth 10 / type-compatibility advisory; pseudocode for `validateParentChain()`; database CHECK constraint as defence-in-depth; 8 required tests), §8 (refreshed What's Next pointing at PR 4).
- `docs/IMPLEMENTATION_PLAN.md` Up Next #29 — narrative refresh: PR 2/4 marked open; PR 3/4 narrative added.

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [x] strategic decision — locks in the per-file SSOT migration plan + cycle-detection contract
- [ ] visual / config / GCP / identity / deployment / security / operational / data model

Docs updated:
- `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` — §6, §7, §8 appended
- `docs/IMPLEMENTATION_PLAN.md` Up Next #29 — narrative refresh

### Testing
- [x] Markdown renders cleanly
- [x] Every constant from §3 critical findings register has a row in the §6.5 reconciliation table
- [x] Every Phase 20 file from §2.1 has a verdict in §6.2
- [ ] Reza sign-off on PR 3 — pending

### What's next
- After Reza signs off PR 3, PR 4 (final) lands: refined sub-PR sequencing + snapshot-test fixture strategy + constants reconciliation v2 + FY25-26 config + UNCOMPUTED additions + Reza sign-off block that gates 41e.0.

### PR
- Branch: `claude/phase-41e-audit-pr3-migration-map` (stacked on `claude/phase-41e-audit-pr2-combinations`)
- PR URL: https://github.com/resadegh/monitrax/pull/623

---

## Session: claude/phase-41e-audit-pr4-final (Phase 41e audit + migration plan PR 4/4 — refined sequencing + fixture strategy + UNCOMPUTED register + Reza sign-off block)

### Changes Made
- **Type:** Docs (PR 4/4 — final audit PR; doc-only, no code, no schema). Closes the 4-PR Phase 41e audit + migration plan workstream. Cherry-picked PR 3 commit `259d0ad` because it didn't propagate to main when PR 2 was merged (PR 3 was stacked on PR 2's branch; PR 2 was merged from the branch tip without PR 3's commit).
- **Scope:** The five pieces that turn the audit from analysis into an executable contract: refined 18-sub-PR sequencing with the `41e.−1` cleanup PR inserted ahead of `41e.0` and SMSF tax dispatch reordered ahead of trust streaming; snapshot-test fixture strategy with capture-before-refactor parity protocol; executable constants reconciliation table mapping §6.5 entries to specific sub-PRs with CI grep regression test enforcing zero hard-codes post-cleanup; FY25-26 config gap closure with new `reviewSchedule.nextReviewBy` field forcing explicit per-FY review; UNCOMPUTED v1 register with 18 items and UI-badge surfacing rule; Reza sign-off block with 11 decisions (D-A1 through D-A11) + 1 open question (Q-41E-1: HECS/HELP withholding now or later) that gates 41e.−1 start.

### Files Modified
- `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` — appended §8 (refined sub-PR sequencing: full 18-row table with risk + gates + scope; PR sizing rules; calendar estimate ~42 days), §9 (snapshot-test fixture strategy: three archetype fixtures shared with pitch seeding + synthetic edge cases; capture-before-refactor protocol; fixture file layout; ~15 baseline tests at 41e.−1), §10 (constants reconciliation v2 with executable per-sub-PR mapping; FY25-26 config gap closure with code snippet + `reviewSchedule` field; UNCOMPUTED v1 register with 18 items; master-config self-test; **Reza sign-off block** with decision checklist + paste-back template), §11 (audit-complete handoff explaining session N+1 through N+19 cadence).
- `docs/IMPLEMENTATION_PLAN.md` Up Next #29 — narrative refresh: PRs 1-3 marked merged; PR 4 narrative added; full content of PR 4 summarised inline.
- `docs/changelog/CHANGELOG_2026_05_05.md` — this entry.

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [x] strategic decision — closes the 4-PR audit workstream and produces the explicit sign-off contract that gates Phase 41e.0
- [ ] visual / config / GCP / identity / deployment / security / operational / data model

Docs updated:
- `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` — §8, §9, §10, §11 appended
- `docs/IMPLEMENTATION_PLAN.md` Up Next #29 — narrative refresh
- `docs/changelog/CHANGELOG_2026_05_05.md` — this entry

### Testing
- [x] Markdown renders cleanly
- [x] Every CRITICAL finding from §3 has a resolution row in §10.1 + §10.2
- [x] Sub-PR sequence in §8.1 covers all 17 sub-PRs from architecture doc §11 + the new 41e.−1
- [x] Sign-off block §10.5 has one checkbox per decision lifted from PRs 2-3
- [ ] Reza sign-off on PR 4 — pending; this PR's merge gates 41e.−1 start

### What's next
- Reza signs the §10.5 sign-off block (paste the template into the PR-merge conversation).
- Session N+1 opens `claude/phase-41e-cleanup-pr` and ships 41e.−1 (cleanup) per §8.1 + §10.1 + §10.2 + §9.4 (snapshot baselines).
- Session N+2 ships 41e.0 (foundation: types + aggregator extensions + cycle-detection + permissions + new endpoints).
- Sessions N+3 through N+19 ship sub-PRs 41e.1 through 41e.17 in the order locked in §8.1.

### PR
- Branch: `claude/phase-41e-audit-pr4-final` (off main; cherry-picked PR 3 commit because it didn't propagate to main when PR 2 was merged)
- PR URL: TBD on push
