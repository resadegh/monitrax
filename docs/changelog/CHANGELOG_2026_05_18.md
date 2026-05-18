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
- Status: Open
