# Changelog — 2026-06-15

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
