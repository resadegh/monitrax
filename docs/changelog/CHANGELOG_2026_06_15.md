# Changelog — 2026-06-15

## Session: taxYearConfig FY-review checkpoint — extend + fallback hardening

### Changes Made
- **Type**: Fix (tax-config review checkpoint) — follow-up to the D6 PR's flagged pre-existing failure.
- **Scope**: `lib/tax-engine/config/taxYearConfig.ts`
- **Context**: The per-FY review checkpoint (`reviewSchedule.nextReviewBy: '2026-06-15'`) fired
  on its date as designed — a deliberate "review the config before the next FY commences" reminder
  (its test, `taxYearConfig.test.ts` "nextReviewBy in the future", goes red when overdue). FY2026-27
  commences 1 Jul 2026 and has a legislated change (lowest resident bracket 16% → 15% from 1 Jul 2026)
  plus indexed items that need confirmed ATO data + a registered-tax-agent pass.
- **Decision (Reza 2026-06-15)**: "Extend the checkpoint, defer the FY26-27 config to Basiq prep" —
  do NOT draft unverified FY26-27 numbers.
- **Shipped**:
  - `nextReviewBy` bumped `2026-06-15` → `2026-09-30` on all three FY configs (documented rationale).
  - `getTaxYearConfig` fallback changed from hard-coded `TAX_YEAR_2024_25` → the **latest available
    config** (FY25-26) so a not-yet-configured FY (FY26-27 from 1 Jul) resolves to the most recent
    known year — honest-stale, not two-years-stale. This makes the chosen option's "keeps using
    FY25-26 brackets" actually true (the code previously fell back to FY24-25).
  - File-header rationale comment updated; FY26-27 review tracked as backlog item #34.
- **Known consequence (documented, not silent)**: until the FY26-27 config lands, the engine applies
  FY25-26 brackets (16% lowest, not the legislated 15%) to FY26-27 calcs. Tracked in backlog #34.

### Files Modified
- `lib/tax-engine/config/taxYearConfig.ts` — review-date bump (×3) + fallback hardening + doc comment.

### Documentation Updated
- `docs/implementation/03_OPEN_QUESTIONS_AND_BACKLOG.md` — new Dead-Code/Tech-Debt row #34.
- `docs/IMPLEMENTATION_PLAN.md` (hub date), `STATE.md` (cursor).

### Build Status
- [x] `tsc --noEmit` — clean
- [x] `tests/tax-engine/config/taxYearConfig.test.ts` — 22/22
- [x] `tests/tax-engine` full suite — 906/906 (the previously-failing checkpoint test now green for the right reason)

### Phase 41E reform compliance (CLAUDE.md §12.14)
- Trigger matched: §12.14 #1/#2 (tax-engine config touch). No regime math changed — this only adjusts a
  review-date constant + a config-lookup fallback. No new column, no AI tool, no post-reform branch touched.

---

## Session: Phase 47 Stage D · D6 — What-If lever per-entity CGT

### Changes Made
- **Type**: Feature (Phase 47 Stage D · D6 — the last Phase 47 build item)
- **Scope**: `lib/cfo/scenarios/` (What-If sellProperty lever) + `/api/cfo/scenarios/run`
- **Description**: The `sellProperty` What-If lever was single-taxpayer — it flagged
  "Capital Gains Tax may apply" without computing it, so a jointly-owned or
  entity-owned property gave the same (absent) CGT picture as a personally-owned
  one. D6 closes the open half of AD-2: the lever now computes CGT through the
  **canonical per-entity path**, splitting the gain across the property's legal
  owners (TR 93/32) and applying each owner's Div 115 entity discount.

### How it works
- New pure core `lib/cfo/scenarios/propertyDisposalCgt.ts` performs **no new tax
  arithmetic** (§12.2/§12.3). It composes two canonical engines:
  - `calculateCgtDiscountDecimal` (Div 115 per-entity discount: individual/trust
    50%, complying SMSF 33⅓%, company 0% — incl. the §12.14 FW-2 reform gate), and
  - `attributeAsset` (the AD-2 ownership attributor the entity-tax assembler
    already uses — JT equal split, TIC per recorded share, beneficial-override
    redirect), so the lever and the per-entity tax page never disagree on shares.
- The lever surfaces, when the per-property context is present:
  - an **"Estimated CGT (your share)"** impact (reduces cash/net worth),
  - a relabelled **"Net worth (after est. CGT)"** impact (making the existing
    headline sub-copy "(after selling costs + CGT)" truthful), and
  - a **per-owner taxable-gain breakdown** in the assumptions panel.
- The run route builds the per-property ownership + cost-base + marginal-rate
  context **lazily — only for the sellProperty lever** (no extra queries on the
  other levers).

### Honesty boundary (financial-adviser + compliance lenses)
- Every owner's **taxable capital gain** after the correct entity discount is shown
  — certain from entity type + holding period.
- Only the **user's own share** is estimated to a tax dollar, at their current
  marginal rate, **labelled an estimate** (a large gain may push part into a higher
  bracket — points at the Tax tab).
- A co-owner's tax is **never fabricated** — they show their taxable gain and
  "taxed in their own return"; SMSF/company show the entity discount + a
  fund-/company-rate basis note, never a hard number.
- §12.14 FW-2 preserved — a post-cut-over acquisition surfaces
  `UC-CGT-POST-REFORM` instead of a silent discounted number.
- **Additive**: absent the context (AI-advisor tool path / users with no
  structure), the lever falls back to the prior single-line CGT flag byte-for-byte.

### Files Modified
- `lib/cfo/scenarios/propertyDisposalCgt.ts` — NEW pure core (per-entity CGT + AD-2
  owner resolution + `LegalEntityType` → CGT-domain mapping).
- `lib/cfo/scenarios/types.ts` — additive `ScenarioContext` fields
  (`propertyTaxContexts`, `taxConfig`, `currentFy`, `userMarginalRate`) +
  `PropertyTaxContext` type.
- `lib/cfo/scenarios/sellProperty.ts` — both Float + Decimal siblings consume the
  CGT helper (impacts + assumptions + warnings); back-compat path unchanged.
- `app/api/cfo/scenarios/run/route.ts` — `fetchPropertyTaxContexts()` builds the
  per-property ownership/cost-base context; wired into the run call for sellProperty.
- `tests/cfo/propertyDisposalCgt.test.ts` — NEW (16 tests).

### Documentation Updated
- `docs/blueprint/PHASE_47_ENTITY_OWNERSHIP_FABRIC.md` — §4B D6 flipped to ✅ SHIPPED;
  §4 Stage D D6-shipped note.
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — 0·EOF status + Last touched; Stage D
  `[~]`→`[x]` with D6 note; Stage F stale-checkbox hygiene `[~]`→`[x]`.
- `docs/implementation/04_RECENTLY_COMPLETED.md` — D6 completion entry.
- `docs/IMPLEMENTATION_PLAN.md` — hub Last-updated bump.

### Build Status
- [x] `tsc --noEmit` passes
- [x] eslint on changed files — 0 warnings
- [x] `lint-financial-surfaces` — 0 new violations (18 grandfathered unchanged)
- [x] `tests/cfo/propertyDisposalCgt.test.ts` — 16/16 pass
- [x] `tests/cfo` + `tests/ownership` + `tests/services` — 281/281 pass
- [x] Full sweep: 2572 passed, 69 skipped, **1 pre-existing failure**
      (`taxYearConfig.test.ts` "nextReviewBy in the future" — the config's review
      date 2026-06-14 is now past as of today 2026-06-15; date time-bomb,
      untouched by this PR — flagged for a separate tax-config review-date bump).

### Phase 41E reform compliance (CLAUDE.md §12.14)
- Trigger matched: §12.14 #2 (financial calc involving CGT).
- `propertyDisposalCgt.computePropertyDisposalCgt` — outcome **(a) reform-aware**:
  takes the entity regime via `calculateCgtDiscountDecimal`'s `config` +
  `acquisitionContractDate` + `disposalFy`; the FW-2 gate is preserved — a
  POST_REFORM disposal returns UNCOMPUTED (`UC-CGT-POST-REFORM`), never a silent
  post-reform number. No existing tax-engine test regressed. No new column on
  `Property`/`Investment`/`LegalEntity`. No new AI tool.

### Notes
- No schema change. No new API endpoint. No destructive Prisma write (read-only).
