# Changelog — 2026-05-18

## Session: Post-41E quick wins — PR A (hard-deletes + Create-Flag modal)

Branch: `claude/post-41e-quick-wins-MG8mr`

### Scope

- **Type:** Chore / fix (tech-debt closure + small admin polish)
- **Scope:** Three tech-debt rows closed in one PR — Tech Debt #2 (auth routes), #10 (linear-wizard dir), #19 (admin Create-Flag modal).
- **CDR scope:** N/A — removing dead routes (auth routes were 410 Gone), dead UI primitives (zero importers), and adding an admin-only flag-creation modal.

### What was done

#### Hard-deletes (Tech Debt #2 + #10)

Both targets were soft-deleted 2026-05-01 with a "≥ 2026-05-15" hard-delete trigger conditional on zero `[deprecated-route]` warnings in prod logs. Trigger satisfied — 16-day soft-delete window observed clean.

- **`app/api/auth/login/route.ts`** — DELETED. Firebase Auth SDK is the canonical client-side path per CLAUDE.md §12.4.
- **`app/api/auth/register/route.ts`** — DELETED. Same.
- **`components/onboarding/linear/`** — DELETED (full directory: `LinearWizardContainer.tsx` + `primitives/` + `hooks/` + `design/` + `steps/`). Replaced by Phase 12 v2.0 `components/onboarding/wizard/` (grid-based `WizardContainer`) + 2026-05-17 Phase 12 Track E conversational variant. Dead-code audit re-verified ZERO importers immediately prior to deletion (only references were within the directory itself + historical doc mentions).

#### Admin Create-Flag modal (Tech Debt #19)

The `+Create Flag` button in `app/admin/feature-flags/page.tsx` toggled `showModal` state but no modal was rendered. Discovered 2026-05-17 when Reza tried to manually create the `CONVERSATIONAL_ONBOARDING` flag. Auto-seed via `vercel-build` (PR #780) covers the canonical case; this PR closes the ad-hoc escape hatch.

- **New `components/admin/feature-flags/CreateFlagModal.tsx`** — focused inline modal with key + name + description inputs. Validates `^[A-Z][A-Z0-9_]*$` key format client-side. Auto-uppercases key on input. ESC-to-close + click-outside-to-close + state reset on re-open. New flag defaults to `enabled: false`.
- **`app/admin/feature-flags/page.tsx`** — imports + mounts the modal. `onCreated` refetches the flag list.
- **No new API endpoint needed** — `POST /api/admin/feature-flags` already shipped (Phase 33).

### Files modified

| File | Change |
|---|---|
| `app/api/auth/login/route.ts` | DELETED |
| `app/api/auth/register/route.ts` | DELETED |
| `components/onboarding/linear/**` (full dir) | DELETED (~18 files) |
| `components/admin/feature-flags/CreateFlagModal.tsx` | NEW |
| `app/admin/feature-flags/page.tsx` | +2 imports + ~10 lines (modal mount) |
| `docs/IMPLEMENTATION_PLAN.md` | Tech Debt #2 + #10 + #19 closed |
| `docs/changelog/CHANGELOG_2026_05_18.md` | NEW — this file |

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [ ] strategic decision

This is a chore-class PR (dead-code removal + admin-only modal). No §16.2 surface materially changed.

Docs updated:
- `docs/IMPLEMENTATION_PLAN.md` — three tech-debt rows closed.
- `docs/changelog/CHANGELOG_2026_05_18.md` — this file.

### Destructive write checklist (CLAUDE.md §12.11)

**N/A.** No Prisma writes added by this PR. The new modal calls existing `POST /api/admin/feature-flags` which uses `prisma.globalFeatureFlag.create` (already shipped Phase 33). No schema change, no migration.

### Schema migration checklist (CLAUDE.md §12.12)

**N/A.** No schema change.

### Phase 41E reform compliance (CLAUDE.md §12.14)

**N/A.** No tax-engine, schema, or AI tool changes.

### Testing

- [ ] `npm test` / `npm run build` / `npm run lint` — N/A in this sandbox.
- [ ] Manual verification queued for Vercel preview: (1) `/admin/feature-flags` "+Create Flag" opens modal; (2) creating a flag persists + appears in list; (3) ESC + click-outside dismiss; (4) /api/auth/login + /api/auth/register routes return 404 (no longer 410).

### PR

- Branch: `claude/post-41e-quick-wins-MG8mr`
- Status: **Merged 2026-05-18 (PR #783)**.

---

## Session 2: PR B1 — Phase 42 PR 6.5d Gemini anomaly narrative

Branch: `claude/phase-42-ui-plumbing-MG8mr`

### Scope

- **Type:** Feature (Phase 42 PR 6.5d — deferred from PR6.5).
- **Scope:** Replaces the hardcoded flag→English mapper in `dailyPulse.ts` with a Claude Haiku 4.5 narration via the existing Phase 33g.2 client. CDR-safe input shape. Falls back to the deterministic mapper when AI isn't configured or fails.
- **CDR scope:** Reform-safe per CLAUDE.md §13.3 — only merchant name + flag code + amount + relative date label leave the engine. NO transaction descriptions, NO account ids, NO payee details.
- **Decision re-scope:** Originally PR B was meant to cover 4 Phase 42 items (6.5d + 5.6 + 4.5 + 2.5) in one PR. Re-scoped mid-session to one focused PR per item — B1 ships 6.5d only, then B2/B3/B4 follow. Cleaner review, smaller blast radius per merge.

### What was done

#### New file

- **`lib/bookkeeping/engagement/anomalyNarrator.ts`** — `buildAnomalyNarrative(userId)` is the new public entry. Fetches the top 5 most-recent flagged anomalies, builds a CDR-safe `AnomalyForNarration[]` (merchant + flag + amount + `formatRelativeDate(date)` — never ISO timestamp), passes to `generateAnthropicCompletion()` with a strict system prompt: ONE sentence, max 90 chars, no advice verbs, no manufactured urgency. Falls back to `renderDeterministicNarrative()` (exported for tests) when `isAnthropicConfigured()` returns false OR the LLM call throws. Surface is never empty.

#### Extended file

- **`lib/bookkeeping/engagement/dailyPulse.ts`** — calls `buildAnomalyNarrative` instead of the inline `buildSimpleAnomalyNarrative`. Legacy function deleted. JSDoc updated to reflect the LLM upgrade.

#### New tests

- **`tests/bookkeeping/anomalyNarrator.test.ts`** — 13 tests covering each of the 6 flag types in the deterministic fallback + a D-2 wall test (`it.each(flags)`) asserting no advice verbs / no manufactured urgency in any deterministic narrative. The LLM-narrated path is integration-tested via Vercel preview (cost-controlled).

### Files modified

| File | Change |
|---|---|
| `lib/bookkeeping/engagement/anomalyNarrator.ts` | NEW — 154 lines |
| `lib/bookkeeping/engagement/dailyPulse.ts` | −40 lines (legacy fn removed) + 1 import + 3-line comment block |
| `tests/bookkeeping/anomalyNarrator.test.ts` | NEW — 13 tests |
| `docs/IMPLEMENTATION_PLAN.md` | Up Next row 51 (PR 6.5d) closed |
| `docs/changelog/CHANGELOG_2026_05_18.md` | Session 2 entry (this) |

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [ ] strategic decision

Engine-side narrator upgrade — no §16.2 surface changed. Anthropic dep already shipped in Phase 33g.2 (`lib/ai/anthropic.ts`); this PR adds a new consumer with the existing US$50/mo cap protecting cost.

Docs updated:
- `docs/IMPLEMENTATION_PLAN.md` — Up Next row 51 closed.
- `docs/changelog/CHANGELOG_2026_05_18.md` — Session 2 entry.

### Destructive write checklist (CLAUDE.md §12.11)

**N/A.** No Prisma writes; module reads from `unifiedTransaction.findMany` only.

### Schema migration checklist (CLAUDE.md §12.12)

**N/A.** No schema change.

### Phase 41E reform compliance (CLAUDE.md §12.14)

**N/A.** Bookkeeping anomaly narrative — not a tax-engine surface.

### Testing

- [x] Tests written — 13 new in `tests/bookkeeping/anomalyNarrator.test.ts`.
- [ ] `npm test` / `npm run build` / `npm run lint` — N/A in this sandbox.

### PR

- Branch: `claude/phase-42-ui-plumbing-MG8mr`
- Status: **Merged 2026-05-18 (PR #784)** — anomaly narrative shipped.

---

## Session 3: PR B2 — Phase 42 PR 5.6 Vendor card drawer + Tax Pack export

Branch: `claude/phase-42-pr-5-6-vendor-drawer-MG8mr`

### Scope

- **Type:** Feature (Phase 42 PR 5.6 — vendor card drawer + Tax Pack export button).
- **Scope:** Two new components + lookup-by-merchant query extension on existing vendor list endpoint + entry-point wiring in TransactionLinkDialog. Reuses Phase 42 PR6 `<CancelSubscriptionLink>` primitive — no new cancel logic.
- **CDR scope:** N/A — UI on top of existing CDR-safe `getVendorAnnualTotals` aggregator + existing Tax Pack export endpoint.

### What was done

#### New files

- **`components/bookkeeping/VendorCardDrawer.tsx`** (~270 lines) — right-edge slide-in / bottom-sheet on mobile. Accepts `vendorId` OR `merchantStandardised`. Resolves merchant → vendor via `GET /api/bookkeeping/vendors?merchantStandardised=` (new query support) → then fetches full card via `GET /api/bookkeeping/vendors/[id]`. Empty state when no vendor row exists yet ("Vendor profiles are created automatically when a transaction is categorised"). Renders 12-month totals (spent / received / transactions / accounts) + last-seen date + cancel link (reusing existing `<CancelSubscriptionLink>`) + linked properties + contract document + MCC if known. ESC closes.
- **`components/bookkeeping/TaxPackExportButton.tsx`** (~140 lines) — card on `/dashboard/reports` with FY picker (current FY + 3 prior, computed from current AU FY boundary) + format picker (csv / xlsx / json) + download via fetch-blob-anchor pattern (surfaces server errors instead of silent navigation).

#### Extended files

- **`app/api/bookkeeping/vendors/route.ts`** — `GET /api/bookkeeping/vendors` now accepts `?merchantStandardised=X` query. When present, returns the single matched vendor (lookup via `normaliseVendorName` — case-insensitive + alphanumeric-collapsed, same shape as the resolve flow uses). Existing unqualified list call behaviour unchanged.
- **`components/transactions/TransactionLinkDialog.tsx`** — adds "View vendor card →" link inside the transaction-info block (only renders when `transaction.merchantStandardised` is non-null) + `<VendorCardDrawer>` mount + showVendorDrawer state.
- **`app/dashboard/reports/page.tsx`** — mounts `<TaxPackExportButton>` at the top of the page content (above the existing Report Type selection).

### Files modified

| File | Change |
|---|---|
| `components/bookkeeping/VendorCardDrawer.tsx` | NEW — 270 lines |
| `components/bookkeeping/TaxPackExportButton.tsx` | NEW — 140 lines |
| `app/api/bookkeeping/vendors/route.ts` | +24 lines (lookup-by-merchant) |
| `components/transactions/TransactionLinkDialog.tsx` | +18 lines (link + state + import + mount) |
| `app/dashboard/reports/page.tsx` | +3 lines (mount) |
| `docs/IMPLEMENTATION_PLAN.md` | Up Next row 48 closed |
| `docs/changelog/CHANGELOG_2026_05_18.md` | Session 3 entry (this) |

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] **visual design system / component pattern** — two new bookkeeping components (`<VendorCardDrawer>` + `<TaxPackExportButton>`) following existing component patterns; reuse of existing `<CancelSubscriptionLink>` primitive — no new visual primitive.
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [ ] strategic decision

Docs updated:
- `docs/IMPLEMENTATION_PLAN.md` — Up Next row 48 marked ✅ SHIPPED.
- `docs/changelog/CHANGELOG_2026_05_18.md` — Session 3 entry.

### Destructive write checklist (CLAUDE.md §12.11)

**N/A.** No new Prisma writes. The drawer + Tax Pack button read from existing endpoints (`/api/bookkeeping/vendors`, `/api/bookkeeping/vendors/[id]`, `/api/bookkeeping/tax-pack/export`).

### Schema migration checklist (CLAUDE.md §12.12)

**N/A.** No schema change.

### Phase 41E reform compliance (CLAUDE.md §12.14)

**N/A.** Vendor card + Tax Pack export — not a tax-engine surface.

### Testing

- [ ] `npm test` / `npm run build` / `npm run lint` — N/A in this sandbox.
- [ ] Manual verification queued for Vercel preview:
  - Open transaction dialog → "View vendor card →" link only shows when `merchantStandardised` is present → opens drawer → resolves vendor → shows totals / linked properties / cancel link / contract.
  - Open `/dashboard/reports` → Tax Pack card shows at top → FY + format pickers work → download triggers + filename matches `monitrax-tax-pack-FY2025-26.csv` pattern.
  - When merchant has no vendor row → drawer shows the empty-state message ("Vendor profiles are created automatically when a transaction is categorised").

### PR

- Branch: `claude/phase-42-pr-5-6-vendor-drawer-MG8mr`
- Status: **Merged 2026-05-18 (PR #785)**.

---

## Session 4: PR B3 — Phase 42 PR 4.5 Import Wizard dry-run preview

Branch: `claude/phase-42-pr-4-5-import-dryrun-MG8mr`

### Scope

- **Type:** Feature (Phase 42 PR 4.5 — Import Wizard dry-run preview).
- **Scope:** Add a `dryRun` form-data field to `/api/bank/import` that early-returns after duplicate detection with statistics + sample. New `dryrun` step in `ImportWizard.tsx` renders the preview + policy picker between `settings` → `importing`.
- **CDR scope:** N/A — dedup happens server-side against rows the user already owns; sample dropped to UI shows only descriptions + amounts + dates (no account ids).

### What was done

#### Extended file: `app/api/bank/import/route.ts`

- Accepts `dryRun=true` form-data field.
- When set, early-returns right after `detectDuplicates()` (before `applyDuplicatePolicy`, categorisation, or any DB write).
- Response shape:
  ```ts
  { success: true, data: {
    dryRun: true,
    total: number,
    statistics: { total, new, exactDuplicates, fuzzyDuplicates, potentialMerges },
    sampleDuplicates: [ { status, similarityScore, candidate, existing } ]  // up to 10 trimmed
  }}
  ```
- No new endpoint — minimum-touch extension of the existing route.

#### Extended file: `components/bank/ImportWizard.tsx`

- `WizardStep` union extended: `'upload' | 'preview' | 'settings' | 'dryrun' | 'importing' | 'complete'`.
- New state: `dryRunResult` + `dryRunLoading`.
- New handler: `handleDryRun()` — calls `/api/bank/import` with `dryRun=true`, populates state, advances step.
- Settings-step "Import" button → "Preview N Transactions" → calls `handleDryRun`.
- New `dryrun` step UI: 4 stat tiles (emerald/slate/amber/sky) + sample list (max 48px-tall scrollable, max 10 entries) + duplicate-policy radio picker (REJECT / OVERWRITE / IMPORT) + commit button shows per-policy count.
- Existing `handleImport` unchanged; just gated behind the dry-run step.

### Files modified

| File | Change |
|---|---|
| `app/api/bank/import/route.ts` | +47 lines (dry-run formData + early-return block) |
| `components/bank/ImportWizard.tsx` | +160 lines (DryRunResult type + state + handler + dryrun step UI + repointed Settings button) |
| `docs/IMPLEMENTATION_PLAN.md` | Up Next row 46 closed |
| `docs/changelog/CHANGELOG_2026_05_18.md` | Session 4 entry (this) |

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [ ] strategic decision

Wizard step + backend flag — no §16.2 surface materially changed. The wizard's UX is unchanged for the happy path (file → preview → settings → import); the dry-run step is one extra screen showing the dedup picture before commit.

Docs updated:
- `docs/IMPLEMENTATION_PLAN.md` — Up Next row 46 closed.
- `docs/changelog/CHANGELOG_2026_05_18.md` — Session 4 entry.

### Destructive write checklist (CLAUDE.md §12.11)

**N/A.** The dry-run path explicitly *avoids* all writes (it's the whole point). The existing import write path is unchanged.

### Schema migration checklist (CLAUDE.md §12.12)

**N/A.** No schema change.

### Phase 41E reform compliance (CLAUDE.md §12.14)

**N/A.** Import Wizard — not a tax-engine surface.

### Testing

- [ ] `npm test` / `npm run build` / `npm run lint` — N/A in this sandbox.
- [ ] Manual verification queued for Vercel preview:
  - Upload a CSV → preview → settings → click "Preview N Transactions" → see dedup tiles + sample + policy picker → choose policy → click "Import" → write proceeds.
  - Re-upload the same CSV → exact-duplicates count > 0 in dry-run.
  - Choose OVERWRITE policy → button label updates to total count (not just new).

### PR

- Branch: `claude/phase-42-pr-4-5-import-dryrun-MG8mr`
- Status: **Merged 2026-05-18 (PR #786)** — dry-run preview shipped.

---

## Session 5: PR B4 — Phase 42 PR 2.5 Inline split editor

Branch: `claude/phase-42-pr-2-5-split-editor-MG8mr`

### Scope

- **Type:** Feature (Phase 42 PR 2.5 — split editor UI).
- **Scope:** One new component + 4th tab in `TransactionLinkDialog`. Backend (`PUT /api/unified-transactions/[id]/splits`) shipped in PR #698; this PR wires the UI.
- **CDR scope:** N/A — UI over an existing CDR-safe service that already enforces `withPermission('transaction.write')` + period-editability + ownership.

### What was done

#### New file: `components/transactions/TransactionSplitEditor.tsx` (~370 lines)

- Hydrates existing splits via `GET /api/unified-transactions/[id]/splits` on mount.
- Defaults to one row pre-filled with the parent transaction amount.
- 2-N rows (cap 10); per row: amount (number input), CategorySelect (lazy-seeded via level1/2/sub triple — no client-side registry lookup), optional Property picker, optional Loan picker, tax-deductible checkbox, free-text note.
- **Live sum readout** with target + delta tile (amber when unallocated > 0.01 or over).
- Save disabled until `|sum − parent| < 0.01 AND every row has a category`.
- PUTs full row set to existing `/api/unified-transactions/[id]/splits` (PR2 backend handles sum validation server-side as defence-in-depth).
- Behaviour-psychologist lens: never blocks the user mid-edit; rows freely addable/removable; only blocks Save. Calm tone — no red errors unless the sum is wrong AND the user has tried.

#### Extended file: `components/transactions/TransactionLinkDialog.tsx`

- `TabsList` grid: `grid-cols-3` → `grid-cols-4`. New "Split" trigger.
- New `<TabsContent value="split">` mounting the editor with: `transaction.id`, sign-corrected `parentAmount`, `direction`, `properties[]`, `availableLoans[]` (mapped to `{id, name}`). On save, sets success message + calls existing `onLinked` callback.
- Import added.

### Files modified

| File | Change |
|---|---|
| `components/transactions/TransactionSplitEditor.tsx` | NEW — 370 lines |
| `components/transactions/TransactionLinkDialog.tsx` | +20 lines (4th tab + content + import) |
| `docs/IMPLEMENTATION_PLAN.md` | Up Next row 44 closed |
| `docs/changelog/CHANGELOG_2026_05_18.md` | Session 5 entry (this) |

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] **visual design system / component pattern** — new transaction component following existing pattern; reuses CategorySelect + Checkbox + Select primitives (no new visual primitive).
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [ ] strategic decision

Docs updated:
- `docs/IMPLEMENTATION_PLAN.md` — Up Next row 44 closed.
- `docs/changelog/CHANGELOG_2026_05_18.md` — Session 5 entry.

### Destructive write checklist (CLAUDE.md §12.11)

**N/A.** No new Prisma writes added by this PR. The editor PUTs to existing `/api/unified-transactions/[id]/splits` which uses `replaceSplits` (PR #698 service) — sum-validated, ownership-guarded, period-editability gated.

### Schema migration checklist (CLAUDE.md §12.12)

**N/A.** No schema change.

### Phase 41E reform compliance (CLAUDE.md §12.14)

**N/A.** Transaction split editor — not a tax-engine surface.

### Testing

- [ ] `npm test` / `npm run build` / `npm run lint` — N/A in this sandbox.
- [ ] Manual verification queued for Vercel preview:
  - Open transaction → Split tab → existing splits hydrate (or empty editor with one pre-filled row)
  - Add row → second row pre-fills with remaining unallocated amount
  - Edit amounts → sum readout updates live → delta tile shows when unbalanced
  - Save with unbalanced sum → button disabled
  - Save with balanced sum + all categories → success → dialog refreshes via onLinked

### Lessons from PR #786

In PR #786 I shipped a TS bug because I assumed `detectDuplicates` returned `BatchDuplicateResult` when it actually returned `DuplicateDetectionResult` (two functions same name in `lib/bank/`). For this PR I traced the import chain explicitly: `replaceSplits` from `lib/bookkeeping/splits.ts` (single definition, no namespace clash), `SplitInput` shape verified against the route's `PutSplitInput` shape (which accepts both `categoryId` and `categoryLevel1/2/sub` triple — I used the latter to avoid client-side registry lookups).

### PR

- Branch: `claude/phase-42-pr-2-5-split-editor-MG8mr`
- Status: **Merged 2026-05-18 (PR #787)** — split editor shipped; closes PR B sequence.

---

## Session 6: PR C — architectural hygiene (barrel audit) + plan update

Branch: `claude/post-41e-pr-c-hygiene-MG8mr`

### Scope

- **Type:** Chore (Tech Debt #7) + docs.
- **Scope:** Scripted audit across all 56 `lib/*/index.ts` barrels for the pattern that broke during WIF Phase 8 — `export * from './<file>'` where `<file>` imports `@/lib/db` (Prisma) or other server-only deps, silently pulling them into any client bundle that touches the barrel. Plus consolidated 2026-05-18 session entry in the plan top header covering all 6 PRs from today (the 5 already-merged + this one).

### What was done

#### Audit method (scripted; reusable)

```bash
for f in $(find lib -maxdepth 3 -name "index.ts"); do
  dir=$(dirname "$f")
  while IFS= read -r line; do
    target=$(echo "$line" | grep -oE "'[^']+'" | tr -d "'")
    # ... resolve target file (.ts | .tsx | dir/index.ts) ...
    risky=$(grep -E "from '@/lib/db'|from '@/lib/prisma'|^import 'server-only'|from '@google-cloud" "$targetFile")
    [ -n "$risky" ] && echo "RISKY: $f re-exports $target → $risky"
  done < <(grep -E "^export \* from" "$f")
done
```

Run on the entire `lib/` tree (56 barrels). Found **6 risky re-exports across 3 barrels**:

| Barrel | Re-export | Server-only because |
|---|---|---|
| `lib/admin/index.ts` | `./auth` | imports `@/lib/db` (Prisma) |
| `lib/auth/index.ts` | `./context` | imports `@/lib/db` |
| `lib/auth/index.ts` | `./guards` | imports `@/lib/db` |
| `lib/cfo/decisionSupport/index.ts` | `./taxIntegration` | imports `@/lib/db` |
| `lib/cfo/decisionSupport/index.ts` | `./loanDecisionSupport` | imports `@/lib/db` |
| `lib/cfo/decisionSupport/index.ts` | `./investmentDecisionSupport` | imports `@/lib/db` |

#### Pre-removal consumer check

`grep -rln "from '@/lib/admin'$|from '@/lib/auth'$|from '@/lib/cfo/decisionSupport'"` — confirmed **zero bare-barrel consumers** for the symbols I was removing. Some files import `from '@/lib/auth'` but only for explicitly-named re-exports (`hashPassword`, `generateToken`, etc.) which are NOT in the removed `export *` lines. No caller migration needed.

#### Fix

Removed the 6 `export * from` lines from the 3 barrels. Each barrel now carries a comment header documenting:
- Why the line was removed (server-only modules; Prisma + Cloud SQL Connector leak into client bundles)
- The direct-import paths consumers must use instead
- Reference back to the WIF Phase 8 regression as the canonical example

The `lib/portal/index.ts` barrel already had this fix applied during WIF Phase 8 (PR not in my session history) — that was the discovery PR for this debt.

### Extended files

| File | Change |
|---|---|
| `lib/admin/index.ts` | Removed `export * from './auth'` + `export * from './services'`; added header explaining why; kept pure re-exports (`types` / `constants` / `permissions` / `featureFlags`) |
| `lib/auth/index.ts` | Removed `export * from './context'` + `export * from './guards'`; kept pure re-exports (`permissions` / `refreshToken` / `oauth`) + the explicit named re-exports from `@/lib/auth` |
| `lib/cfo/decisionSupport/index.ts` | Removed 3 server-only re-exports; kept `./propertyDecisionSupport` (pure); added header |

### Plan + changelog

- `docs/IMPLEMENTATION_PLAN.md` — Tech Debt #7 marked ✅ CLOSED with full method note. Top header refreshed with a consolidated 2026-05-18 session entry covering all 6 PRs (#783–#787 + this one).
- `docs/changelog/CHANGELOG_2026_05_18.md` — Session 6 entry (this).

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [x] **operational procedure** — barrel-audit method is a reusable hygiene script that a future PR can re-run; header comments on the 3 barrels document the post-WIF rule (`export * from './<server-only>'` is banned). Future PRs adding the pattern will be caught.
- [ ] strategic decision

Docs updated:
- `docs/IMPLEMENTATION_PLAN.md` — Tech Debt #7 closed + top header refreshed.
- `docs/changelog/CHANGELOG_2026_05_18.md` — Session 6 entry.

### Destructive write checklist (CLAUDE.md §12.11)

**N/A.** Pure TypeScript refactor; no Prisma writes; no schema change.

### Schema migration checklist (CLAUDE.md §12.12)

**N/A.** No schema change.

### Phase 41E reform compliance (CLAUDE.md §12.14)

**N/A.** Barrel-export hygiene — not a tax-engine surface.

### Testing

- [ ] `npm test` / `npm run build` / `npm run lint` — N/A in this sandbox.
- [ ] Manual verification queued for Vercel preview:
  - Vercel build still passes (no consumer migrated to broken paths)
  - Any future PR that adds `export * from './<server-only>'` to a barrel can be caught by re-running the audit script

### Today's tally

6 PRs merged + this PR open:

| PR | Title | Tech Debt / Up Next closed |
|---|---|---|
| #783 | PR A — quick wins | Tech Debt #2 + #10 + #19 |
| #784 | PR B1 — Phase 42 PR 6.5d | Up Next 51 |
| #785 | PR B2 — Phase 42 PR 5.6 | Up Next 48 |
| #786 | PR B3 — Phase 42 PR 4.5 | Up Next 46 |
| #787 | PR B4 — Phase 42 PR 2.5 | Up Next 44 |
| **PR C (this)** | barrel-audit sweep | **Tech Debt #7** |

8 backlog rows closed. ~3,500 LOC shipped. 2 transient build failures caught + fixed via subscription (~5 min each). Phase 42 follow-up backlog now empty.

### PR

- Branch: `claude/post-41e-pr-c-hygiene-MG8mr`
- Status: **Merged 2026-05-18 (PR #788)** — barrel hygiene shipped.

---

## Session 7: PR D — Phase 32B PR3 polish item ③ (richer client-book table)

Branch: `claude/phase-32b-pr3-client-book-table-MG8mr`

### Scope

- **Type:** Feature (UI polish, no schema, no new endpoint).
- **Scope:** Last queued item from `PHASE_32B_PR3_ALERT_ENGINE.md` §6b post-#9b polish backlog. Item ① (admin "run sweep now" button) shipped 2026-05-10 in PR #749. Item ② (hero KPI strip + dashboard real-data switch) shipped 2026-05-10 in PR #751. Item ③ (richer real-data **client-book table** on the `/portal/clients` list) was queued — the per-client aggregate array on `GET /api/portal/clients?organizationId=…` was already there to feed it. This PR consumes it.
- **The product question** from #9b — *"how much per-client aggregate to surface on the practice landing vs. behind the per-client drill-in, given each drill-in writes a `ClientAccessLog` row but the landing aggregates don't"* — resolved by the architect lens: put the aggregate on `/portal/clients` (the proper client-book surface) rather than `/portal/dashboard` (which keeps the slim summary card from #9b). The dashboard stays a glance-surface; the `/portal/clients` page is where the human-dimension fields live, alongside the system fields.

### What was done

#### `components/portal/clients/ClientList.tsx`

- New exported `ClientAggregateRow` interface — `{ trailStage: 'TRACK' | 'REDUCE' | 'ANCHOR' | 'INVEST' | 'LIVE' | null, healthScore: number | null, healthDelta: number | null, activeAlertCount: number }`. Mirrors the per-client array shape returned by `GET /api/portal/clients` (modulo the `STAGE_BY_LETTER` mapping the route applies — the route stores `lastTrailStage` as a one-letter code and translates back to the long enum on read).
- New optional `aggregateMap?: Map<string, ClientAggregateRow>` prop on `ClientListProps`. Keyed by `PortalClient.id` (= `organizationClientId`).
- `columns` refactored from a top-level `const` to a `useMemo(() => [...], [aggregateMap, onClientClick])` so the column set rebuilds when the aggregate map becomes available (post-fetch).
- **Conditional column insertion** between Consent and Assigned To (only when `aggregateMap` is supplied):
  - **TRAIL** — `<TrailStagePill stage={agg?.trailStage ?? null} />`. Warm-toned pill per stage: Track=sky / Reduce=amber / Anchor=emerald / Invest=indigo / Live=fuchsia. `—` (slate-400) when stage null.
  - **Health** — `<HealthCell score={agg?.healthScore} delta={agg?.healthDelta} />`. Score colour-toned by band: emerald-700 ≥70, amber-700 40–69, rose-700 <40. Delta indicator alongside the score: `↑ +N` (emerald-600) / `↓ -N` (rose-600) / `stable` (slate-500, neutral) / nothing when delta is null (no prior sweep yet). `—` when score null.
  - **Alerts** — count pill, rose-toned when >0 else slate. Same visual pattern as the existing `pendingTasks` column.
- Helpers `TrailStagePill` + `HealthCell` + `TRAIL_STAGE_TONE` constant added at the bottom of the file (after the existing icon helpers). File header JSDoc extended with a paragraph documenting the new prop + the graceful-degradation behaviour.

#### `app/portal/clients/page.tsx`

- New `aggregateMap` state — `useState<Map<string, ClientAggregateRow> | undefined>(undefined)`.
- New `useEffect` (dependency: `currentOrg`) — fetches `GET /api/portal/clients?organizationId=…` (same endpoint the dashboard hero strip reads). Builds the map from `data.data.clients[]` array. **Failures non-blocking** — `setAggregateMap(undefined)` on error → `ClientList` omits the new columns gracefully. Cleanup flag prevents stale state writes if the org changes mid-flight.
- `<ClientList aggregateMap={aggregateMap} />` — passes the new prop through. Other props unchanged.

### Behavioural-psychologist + designer lens read

Without the aggregate columns, the `/portal/clients` page only showed *system* fields (status / consent / pending tasks / who's assigned). An adviser had to click each client to see if anything had changed since the last sweep. With the three new columns, the *human dimension* (where in the TRAIL journey they are, are they getting healthier, do they have alerts) reads alongside the system fields — the adviser can scan the book in one pass and know who needs them today. Warm-toned pills (sky / amber / emerald / indigo / fuchsia) frame each stage as a *position*, not a *deficit* — matching the §0 advisory mindset rule.

### Privacy posture (CLAUDE.md §13.3)

Aggregate-only. No balances, no transaction-level data, no CDR data passes through `aggregateMap` — just TRAIL stage label, integer health score, integer delta, integer alert count. Byte-for-byte the same data the dashboard hero strip already shows (#9b polish ②). The `payload` column of `ClientAlert` is **never** read in this code path; only the count of ACTIVE alerts per client.

### Files changed

| File | Change |
|---|---|
| `components/portal/clients/ClientList.tsx` | New `ClientAggregateRow` interface + `aggregateMap?` prop + `useMemo` columns with 3 conditional aggregate columns + `TrailStagePill` + `HealthCell` helpers + `TRAIL_STAGE_TONE` constant. Header JSDoc extended. |
| `app/portal/clients/page.tsx` | New `aggregateMap` state + parallel fetch effect for `GET /api/portal/clients` + prop passed to `<ClientList>`. |

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] **visual design system / component pattern** — `<TrailStagePill>` is the first canonical 5-stage TRAIL pill component anywhere in the portal codebase; the warm-tone mapping (sky / amber / emerald / indigo / fuchsia) matches the TRAIL framework's stage hues (CLAUDE.md §14). `<HealthCell>` is the first canonical health-score + delta-indicator presentation. Both live in `ClientList.tsx` for now (private to the portal); promote to a shared component if a second consumer appears.
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [ ] strategic decision

Docs updated:
- `docs/IMPLEMENTATION_PLAN.md` — workstream §0b "Closes / opens" row updated (③ flipped from "still queued" → "✅ SHIPPED"); workstream §0 narrative bullet on the real-alert-engine summary line updated (③ flipped 📋 → ✅); Recently Completed 2026-05-18 entry added; top header refreshed to record session 19 (PR D).
- `docs/changelog/CHANGELOG_2026_05_18.md` — Session 7 entry (this).

### Destructive write checklist (CLAUDE.md §12.11)

**N/A.** Pure read path — UI consumes an existing read-only API. No Prisma writes anywhere in this PR.

### Schema migration checklist (CLAUDE.md §12.12)

**N/A.** No schema change.

### Phase 41E reform compliance (CLAUDE.md §12.14)

**N/A.** Portal client-book UI — not a tax-engine surface; no `Property` / `Investment` / `LegalEntity` columns touched; no new AI tool.

### Testing

- [ ] `npm test` / `npm run build` / `npm run lint` — N/A in this sandbox (no `node_modules`; per CLAUDE.md §11.2 the Vercel preview is the canonical TS gate).
- [ ] Manual verification queued for Vercel preview:
  - With an org that has no swept clients → aggregate fetch returns `hasRealClients: false` + empty `clients[]` → map is built empty → `<ClientList>` receives a Map with no entries → the 3 columns render but show `—` for every row. Acceptable (the existing 5 columns still render normally).
  - With an org that has swept clients → 3 columns populate with real data.
  - With a network error mid-fetch → `setAggregateMap(undefined)` → 3 columns collapse out → granular table still renders.

### Today's tally (updated)

7 PRs across the day:

| PR | Title | Tech Debt / Up Next closed |
|---|---|---|
| #783 | PR A — quick wins | Tech Debt #2 + #10 + #19 |
| #784 | PR B1 — Phase 42 PR 6.5d | Up Next 51 |
| #785 | PR B2 — Phase 42 PR 5.6 | Up Next 48 |
| #786 | PR B3 — Phase 42 PR 4.5 | Up Next 46 |
| #787 | PR B4 — Phase 42 PR 2.5 | Up Next 44 |
| #788 | PR C — barrel-audit sweep | Tech Debt #7 |
| **PR D (this)** | Phase 32B PR3 polish ③ | **Phase 32B PR3 §6b backlog empty** |

9 backlog rows closed. ~3,700 LOC shipped across the day.

### PR

- Branch: `claude/phase-32b-pr3-client-book-table-MG8mr`
- Status: **Merged 2026-05-18 (PR #789)** — §6b polish backlog now empty.

---

## Session 8: PR E — Phase 42 PR5.5 (PDF summary + receipt ZIP bundle)

Branch: `claude/phase-42-pr-5-5-pdf-zip-MG8mr`

### Scope

- **Type:** Feature (new file formats; one new prod dep; no schema; no CDR posture change).
- **Continuation:** Closes the last open Phase 42 follow-up row from this morning's PR B sequence. Today's PR B2 (PR #785) shipped the Tax Pack export button with CSV / XLSX / JSON formats — the accountant-facing trio. PR5.5 was the queued polish item to add the two human-facing formats: **PDF** (printable summary the user emails their accountant) and **ZIP** (every receipt / invoice / tax doc in the FY, foldered).
- **Up Next row closed:** #47.

### What was done

#### `lib/bookkeeping/taxPack/pdfExporter.ts` (new — ~340 LOC)

`buildTaxPackPdf(summary): Promise<Buffer>` — renders the canonical `TaxPackSummary` (built by the already-existing `buildTaxPackSummary()`) as a printable PDF. Designed for the consumer-to-accountant handoff: one artefact the user can email, attach to a portal, or print and hand over physically.

Six sections, in reading order:
1. **Cover** — title + AU FY label + generated date (en-AU long date)
2. **Totals** — income (gross) / expenses / net cashflow / transaction count, currency-formatted as AUD
3. **ATO labels** — table with label / schedule / line item / amount / tx count (sorted by label)
4. **Per-property P&L** — one block per property: summary (income / expenses / net) + expense breakdown table sorted by total descending; page break inserted before each property if there's <180px of room left
5. **Data sources** — per-source counts (sorted by count desc) + per-month coverage lines (BASIQ / Imported / Manual-only)
6. **Footer disclaimer on every page** — applied via `doc.bufferedPageRange()` at end-of-stream so multi-page PDFs all carry the same legal footer

Layout primitives (table headers, table rows, two-column rows, section headings, page breaks, rules) factored into helpers — no per-section copy-paste of layout code. Design tokens (font family, sizes, colours — slate-900 ink, slate-600 muted, emerald-700 accent, slate-300 rules) declared as `const`s at file top so a future visual refresh edits one place.

Currency formatting uses `Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })`; dates use `Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })` — matches the rest of the AU-facing app.

#### `lib/bookkeeping/taxPack/zipBundleBuilder.ts` (new — ~155 LOC)

`buildReceiptZipBundle(userId, window): Promise<ReceiptBundleResult>` — bundles every `Document` row where `category IN (RECEIPT, INVOICE, TAX)` AND `uploadedAt` falls within the AU FY window AND `deletedAt IS NULL`, into a single ZIP.

Folder structure (single canonical layout — keeps the accountant from learning 3 structures, unlike `/api/documents/export` which exposes 3):

```
monitrax-receipts-fy<label>/
  Receipts/<yyyy-MM-dd>_<originalFilename>
  Invoices/<yyyy-MM-dd>_<originalFilename>
  Tax_Documents/<yyyy-MM-dd>_<originalFilename>
  MANIFEST.txt  ← FY + window dates + per-folder counts + missing count + disclaimer
```

Storage abstraction reused (`getStorageProvider(userId)` from `lib/documents/storage`) — both DB-stored bytes (`fileContent`) and cloud-stored bytes (`storagePath` → `storage.download()`) are handled. Documents whose content can't be fetched are silently skipped + counted into `missingCount` (the bundle still ships with the rest; the manifest reports the discrepancy). Filename collisions get a `_<counter>` suffix before the extension.

Returns `{ bytes, documentCount, countByFolder, missingCount }` so the route handler can surface counts via response headers.

#### `app/api/bookkeeping/tax-pack/export/route.ts` (extended)

`SUPPORTED` widened from `['csv', 'xlsx', 'json']` to `['csv', 'xlsx', 'json', 'pdf', 'zip']`. Two new branches added:

- `format === 'zip'` short-circuits the financial-summary aggregation (ZIP only needs the Document table) and returns `application/zip` with `X-Monitrax-Doc-Count` + `X-Monitrax-Doc-Missing` headers.
- `format === 'pdf'` reuses the existing `buildTaxPackSummary()` call (shared with XLSX + JSON), feeds it into `buildTaxPackPdf()`, returns `application/pdf` with `X-Monitrax-Property-Count` header.

Buffer→ArrayBuffer→Blob copy pattern matches the existing XLSX branch byte-for-byte.

#### `components/bookkeeping/TaxPackExportButton.tsx` (extended)

- `TaxPackFormat` type widened to `'csv' | 'xlsx' | 'json' | 'pdf' | 'zip'`
- `FORMAT_OPTIONS` reordered: PDF first (set as default; the most natural user-to-accountant artefact), XLSX second, CSV third, ZIP fourth, JSON last
- Default format changed from `'csv'` (accountant-format) to `'pdf'` (user-format) — matches the new primary use case
- New `EXTENSION_BY_FORMAT` + `DOWNLOAD_BASENAME_BY_FORMAT` SSOT maps replace the inline ternary in `handleExport()` — adding a new format now means adding 2 map entries instead of editing logic
- Filename basename switches between `monitrax-tax-pack-*` and `monitrax-receipts-*` per format (the ZIP isn't a "tax pack", it's the receipt bundle that goes alongside it)

#### `docs/policy/APPROVED_DEPENDENCIES.md` (updated — §6.4 compliance)

- `pdfkit ^0.15.0` added to Utilities table (MIT, reviewed 2026-05-18). Justification recorded inline: "Phase 42 Tax Pack handoff for accountants — server-side."
- `@types/pdfkit ^0.13.4` added to Type Definitions (dev deps).

### §12.7 dep-trade-off (recorded for posterity)

The Up Next #47 row called for two new deps — `pdfkit` (PDF) + `archiver` (ZIP). The actual decision:

- **PDF:** `pdfkit` added. GCP has no managed JSON-to-PDF service. Alternatives considered: `jsPDF` (works in node but designed for browser; bigger), `puppeteer` (overkill — needs headless Chrome at deploy time); HTML-render + browser-print (user has to manually save-as-PDF; fails the "downloadable artefact" requirement). `pdfkit` is the canonical Node PDF library, MIT, ~700KB function size impact, well-maintained.
- **ZIP:** `archiver` **dropped**. The codebase already uses `jszip` for `/api/documents/export/route.ts` + `/api/share/[token]/download/route.ts` — adding `archiver` would create two ZIP libraries in one codebase, violating §12.3 SSOT. Reused `jszip` instead. The PR ships **one** new prod dep instead of two.

### Files added / changed

| File | Change |
|---|---|
| `lib/bookkeeping/taxPack/pdfExporter.ts` | NEW — pdfkit-based summary PDF |
| `lib/bookkeeping/taxPack/zipBundleBuilder.ts` | NEW — jszip-based receipt bundle |
| `app/api/bookkeeping/tax-pack/export/route.ts` | Extended — 2 new format branches |
| `components/bookkeeping/TaxPackExportButton.tsx` | Extended — 2 new format options + PDF default + filename map |
| `package.json` | Added `pdfkit ^0.15.0` + `@types/pdfkit ^0.13.4` |
| `docs/blueprint/PHASE_42_CONSUMER_BOOKKEEPING_COMPLETION.md` | PR5.5 row flipped to ✅ SHIPPED with dep-decision rationale |
| `docs/policy/APPROVED_DEPENDENCIES.md` | pdfkit + @types/pdfkit added |
| `docs/IMPLEMENTATION_PLAN.md` | Up Next #47 closed; Recently Completed 2026-05-18 entry; top header refreshed |
| `docs/changelog/CHANGELOG_2026_05_18.md` | This Session 8 entry |

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [x] **deployment / build** — new prod dep (`pdfkit`) + new dev dep (`@types/pdfkit`). Vercel-build picks them up via `npm install` automatically — no script changes needed. Approved-deps doc updated in the same PR (§6.4 compliance).
- [ ] security / CDR posture — receipt bytes are user-uploaded artefacts (§13.3 doesn't apply to non-CDR bytes); the manifest exposes only FY label + counts.
- [ ] operational procedure
- [ ] strategic decision

Docs updated:
- `docs/blueprint/PHASE_42_CONSUMER_BOOKKEEPING_COMPLETION.md` — PR5.5 row flipped to ✅ SHIPPED with the §12.7 dep-decision rationale captured inline.
- `docs/policy/APPROVED_DEPENDENCIES.md` — `pdfkit` (Utilities) + `@types/pdfkit` (Type Definitions) rows added, dated 2026-05-18.
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #47 closed; Recently Completed 2026-05-18 entry added; top header refreshed (session 20 / 8 PRs / ~4,200 LOC).
- `docs/changelog/CHANGELOG_2026_05_18.md` — Session 8 entry (this).

### Destructive write checklist (CLAUDE.md §12.11)

**N/A.** Pure read path — exporters consume the existing read-only API. No Prisma writes anywhere in this PR.

### Schema migration checklist (CLAUDE.md §12.12)

**N/A.** No schema change.

### Phase 41E reform compliance (CLAUDE.md §12.14)

**N/A.** Tax Pack PDF/ZIP exporters — they render whatever the underlying `TaxPackSummary` shape contains; no tax-engine surface touched; no `Property` / `Investment` / `LegalEntity` schema column added; no new AI tool.

### Testing

- [ ] `npm test` / `npm run build` / `npm run lint` — N/A in this sandbox (no `node_modules`; per CLAUDE.md §11.2 the Vercel preview is the canonical TS gate).
- [ ] Manual verification queued for Vercel preview:
  - `npm install` succeeds with `pdfkit` + `@types/pdfkit` added
  - `GET /api/bookkeeping/tax-pack/export?fy=FY2025-26&format=pdf` returns a valid PDF (file opens in standard PDF readers; 6 sections render; multi-page documents carry the disclaimer on every page)
  - `GET /api/bookkeeping/tax-pack/export?fy=FY2025-26&format=zip` returns a valid ZIP with the documented folder structure + a populated `MANIFEST.txt` (even when zero documents match — empty bundle ships with just the manifest)
  - `<TaxPackExportButton />` on `/dashboard/reports` exposes the 5 format options + defaults to PDF
  - Filename basename switches correctly per format (`monitrax-tax-pack-fy2025-26.pdf` vs `monitrax-receipts-fy2025-26.zip`)

### Today's tally (updated)

8 PRs across the day:

| PR | Title | Tech Debt / Up Next closed |
|---|---|---|
| #783 | PR A — quick wins | Tech Debt #2 + #10 + #19 |
| #784 | PR B1 — Phase 42 PR 6.5d | Up Next 51 |
| #785 | PR B2 — Phase 42 PR 5.6 | Up Next 48 |
| #786 | PR B3 — Phase 42 PR 4.5 | Up Next 46 |
| #787 | PR B4 — Phase 42 PR 2.5 | Up Next 44 |
| #788 | PR C — barrel-audit sweep | Tech Debt #7 |
| #789 | PR D — client-book table | Phase 32B PR3 §6b backlog |
| **PR E (this)** | Phase 42 PR5.5 — PDF + ZIP | **Up Next #47 — Phase 42 follow-up backlog empty** |

10 backlog rows closed. ~4,200 LOC shipped across the day.

### PR

- Branch: `claude/phase-42-pr-5-5-pdf-zip-MG8mr`
- Status: **Merged 2026-05-18 (PR #790)** — Phase 42 follow-up backlog now empty.

---

## Session 9: PR F — Phase 12 PR 3c.1 (data-source hygiene visibility slice)

Branch: `claude/onboarding-pr-3c-data-source-hygiene-MG8mr`

### Scope

- **Type:** Feature (UI polish; no schema; no API change; no CDR posture change).
- **Closes:** `PHASE_12_WIZARD_REDESIGN_PLAN.md` §6A.1 items #1 (staleness indicators) + #2 (dashboard staleness nudge). The remaining §6A.1 items (#3 confidence indicators on derived metrics / #4 "Upgrade this account" button / #5 first-visit migration modal / #6 app-wide `balanceLastUpdatedAt` write-site audit / #7 balance-age heat-map sub-route) reshelve as **PR 3c.2** — they're independent and can ship sequentially.
- **Up Next row closed:** #7 (rewritten as the §6A.1 follow-up split: PR 3c.1 ✅ this PR / PR 3c.2 📋 remaining items).

### Why this slice first

The visibility slice is the highest-leverage chunk — it's the **foundation** every other §6A.1 item builds on (confidence indicators read from the same staleness rule the chip uses; the upgrade button + migration modal both need the user to *see* there's a problem before they'll act). Shipping it standalone also lets the rest of §6A be independent PRs rather than one large one.

### What was done

#### `components/accounts/DataSourceChip.tsx` (new — ~140 LOC)

The **one** UI primitive that turns `(balanceSource, balanceLastUpdatedAt)` into a user label. Renders a small inline chip with five visual states keyed by the `(source, age)` pair:

| Source | Tone | Icon | Label |
|---|---|---|---|
| `BASIQ` | emerald (`bg-emerald-50`/`text-emerald-700`) | Zap | "Synced 2m ago" |
| `IMPORT` | sky | Upload | "Imported 3d ago" |
| `USER_VERIFIED` | indigo | ShieldCheck | "Verified 1d ago" |
| `MANUAL` (age < 14d) | slate | Hand | "Manual · 4d ago" |
| `MANUAL` (age ≥ 14d) | amber | AlertTriangle | "Manual · 32d ago" |
| (no source) | — | — | renders nothing |

Tone choices follow CLAUDE.md §0 behaviour-psychologist lens — **slate (not red)** for stale-manual (this is a hygiene nudge, not an alarm); emerald reserved for live Open-Banking sync (the strongest trust state).

Two exports:
- `<DataSourceChip>` — the chip component itself
- `isBalanceStale(balanceSource, balanceLastUpdatedAt) → boolean` — pure helper; treats `MANUAL` + no-timestamp as stale (user has never refreshed it); used by the chip's amber threshold AND by `<StaleBalanceNudge>` to compute the count

Private helper `formatBalanceAge` (minute → hour → day → month → year granularity) — kept inline pending a second consumer; file header notes the §16.4 promotion path to `lib/utils/formatters.ts`. Mirrors the `TrailStagePill` precedent from yesterday's PR D.

#### `components/dashboard/StaleBalanceNudge.tsx` (new — ~95 LOC)

Top-of-page banner. Renders nothing when:
- `accounts.filter(isBalanceStale).length === 0` (no stale MANUAL accounts), OR
- user dismissed for this session via the `×` button (`sessionStorage.monitrax:staleBalanceNudge:dismissed === '1'`)

Calm framing (CLAUDE.md §0 behaviour-psychologist lens):
- Heading: `"N accounts haven't been refreshed in over 2 weeks"` (observational, not accusatory)
- Body: `"Your dashboard reads from these balances — keeping them fresh keeps every number it shows you accurate."` (links the maintenance task to the value the user already gets)
- CTAs: deep-link to the canonical `/dashboard/balances?action=connect-basiq` and `?action=import` — **no parallel routes**; the existing toolbar actions on that page already handle these `action=` query params

Session-only dismiss (vs. permanent) is intentional: a hygiene nudge should reappear next visit if the condition still holds — not a one-and-done modal. SSR-safe: starts with `dismissed === null`, hydrates from `sessionStorage` in `useEffect`, and only renders post-hydration to avoid the SSR/CSR mismatch.

#### `app/dashboard/balances/page.tsx` (edited)

- Imported `<DataSourceChip>` + `<StaleBalanceNudge>` from the new modules.
- Replaced the inline `isBasiq && <Badge variant="outline">...Zap...Basiq</Badge>` (which only handled BASIQ) with `<DataSourceChip balanceSource={...} balanceLastUpdatedAt={...} />` — now covers all 4 sources, surfacing IMPORT / USER_VERIFIED / MANUAL states that were previously invisible to the user (§12.2 SSOT — one chip, not 4 inline cases).
- Mounted `<StaleBalanceNudge accounts={accounts} />` between the page hero (`</header>`) and the Hidden Wealth lens — first thing the user sees scrolling down if a refresh is overdue.
- **Dead imports cleaned** (CLAUDE.md §12.1): removed `Zap` (the inline icon) and `Badge` (the inline pill primitive) — no remaining consumers after the chip replacement.

### Files added / changed

| File | Change |
|---|---|
| `components/accounts/DataSourceChip.tsx` | NEW — shared chip + `isBalanceStale` helper |
| `components/dashboard/StaleBalanceNudge.tsx` | NEW — dashboard banner |
| `app/dashboard/balances/page.tsx` | Wired chip + nudge; removed dead `Zap` + `Badge` imports |
| `docs/IMPLEMENTATION_PLAN.md` | Up Next #7 split (3c.1 ✅ closed / 3c.2 reshelved); Recently Completed 2026-05-18 entry; top header refreshed |
| `docs/changelog/CHANGELOG_2026_05_18.md` | This Session 9 entry |

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] **visual design system / component pattern** — `<DataSourceChip>` is the first canonical UI primitive that turns `(balanceSource, balanceLastUpdatedAt)` into a user label; previously the only consumer (the inline `isBasiq` badge on `/dashboard/balances`) hard-coded a single-source case. Future surfaces that render an Account balance should import this — file header documents the rule + the §16.4 promotion path for the inline time-ago helper.
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture — no balance amounts in the nudge copy (only the count of accounts); §13.3 N/A (this surface doesn't render CDR data, only metadata).
- [ ] operational procedure
- [ ] strategic decision

Docs updated:
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #7 split into #7 (PR 3c.2 — remaining §6A.1 items) + ~~#7~~ (✅ PR 3c.1 — this PR). Recently Completed 2026-05-18 entry. Top header refreshed (session 21 / 9 PRs / ~4,700 LOC).
- `docs/changelog/CHANGELOG_2026_05_18.md` — Session 9 entry (this).

The `PHASE_12_WIZARD_REDESIGN_PLAN.md` §6A doc was **not** updated in this PR — that section is the active spec (lives at `Status: 🟡 PR 3c pending`); a partial-completion edit risks miscommunicating the remaining work. PR 3c.2 will flip the doc's status line and mark items #3–#7 individually as they ship.

### Destructive write checklist (CLAUDE.md §12.11)

**N/A.** No Prisma writes anywhere in this PR (pure read path — chip + nudge consume data already in component state).

### Schema migration checklist (CLAUDE.md §12.12)

**N/A.** No schema change. The `Account.balanceSource` + `Account.balanceLastUpdatedAt` columns this PR consumes already exist (Phase 13 §417 hierarchy + existing write-site coverage in `app/api/bank/import`, `app/api/accounts/[id]/balance`, `app/api/onboarding/bulk-create`, `app/api/unified-transactions/cash`, `lib/bank/basiqSync`).

### Phase 41E reform compliance (CLAUDE.md §12.14)

**N/A.** UI polish on account-balance rendering — not a tax-engine surface; no `Property` / `Investment` / `LegalEntity` schema column added; no new AI tool.

### Testing

- [ ] `npm test` / `npm run build` / `npm run lint` — N/A in this sandbox (no `node_modules`; per CLAUDE.md §11.2 the Vercel preview is the canonical TS gate).
- [ ] Manual verification queued for Vercel preview:
  - On `/dashboard/balances`, every account row renders a chip matching its `(balanceSource, balanceLastUpdatedAt)` pair
  - A BASIQ-sourced account renders the green "Synced X ago" chip — visual parity with the old `<Badge>` it replaced
  - A MANUAL account with `balanceLastUpdatedAt` >14d shows the amber "Manual · Xd ago" variant
  - When ≥1 stale MANUAL account exists, the banner renders above the Hidden Wealth lens; dismissing it removes it for the session
  - Connect-via-Basiq + Upload-statement CTAs in the banner deep-link to the existing `/dashboard/balances?action=…` handlers

### Today's tally (updated)

9 PRs across the day:

| PR | Title | Tech Debt / Up Next closed |
|---|---|---|
| #783 | PR A — quick wins | Tech Debt #2 + #10 + #19 |
| #784 | PR B1 — Phase 42 PR 6.5d | Up Next 51 |
| #785 | PR B2 — Phase 42 PR 5.6 | Up Next 48 |
| #786 | PR B3 — Phase 42 PR 4.5 | Up Next 46 |
| #787 | PR B4 — Phase 42 PR 2.5 | Up Next 44 |
| #788 | PR C — barrel-audit sweep | Tech Debt #7 |
| #789 | PR D — client-book table | Phase 32B PR3 §6b backlog |
| #790 | PR E — Tax Pack PDF + ZIP | Up Next #47 |
| **PR F (this)** | Phase 12 PR 3c.1 visibility slice | **Up Next #7 (split) — 3c.1 ✅ shipped; 3c.2 reshelved** |

11 backlog rows closed. ~4,700 LOC shipped.

### PR

- Branch: `claude/onboarding-pr-3c-data-source-hygiene-MG8mr`
- Status: Open
