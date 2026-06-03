# Changelog — 2026-06-03

## Session: brave-shannon-mr1ye (cont.) — xlsx/SheetJS security migration

### Changes Made
- **Type**: Dependency / security fix
- **Scope**: `xlsx` (report/tax-pack Excel exporters).
- **Origin**: Reza — "ok go ahead" (the recommended next security item: the last production high-severity advisory).

### Research finding (decisive)
- `xlsx` is **write-only** in Monitrax — 2 files (`lib/reports/exporters/xlsx.ts`, `lib/bookkeeping/taxPack/xlsxExporter.ts`), both exporters (`book_new` / `aoa_to_sheet` / `write`-to-buffer). **Zero `XLSX.read`/parsing anywhere.** Both advisories (Prototype Pollution GHSA-4r6h-8v6p-xvw6, ReDoS GHSA-5pgg-2g8v-p4x9) are parse-triggered → **not reachable** in our usage.
- The GHSAs have patched versions (0.19.3, 0.20.2) that aren't on the npm registry (SheetJS publishes to its own CDN) — which is why npm showed "no fix available."

### Fix
- Repointed `xlsx` to the **SheetJS CDN build 0.20.3** (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`) — the vendor's official patched distribution. **Zero code change** (identical API). 0.20.3 is above both GHSA ranges, so npm audit no longer flags it.

### Verification
- Installed: `xlsx@0.20.3` (lockfile records the CDN URL + integrity hash).
- `npm audit` → `xlsx` no longer listed. Prod (`--omit=dev`): **0 high, 0 critical** (was 1 high = xlsx), 14 moderate.
- `tsc --noEmit` → 0 errors (exporters compile unchanged). `npm run build` → ✓ Compiled.

### Files Modified
- `package.json` — `xlsx` → SheetJS CDN 0.20.3.
- `package-lock.json` — regenerated (CDN tarball + integrity).

### Documentation Updated
- `docs/policy/APPROVED_DEPENDENCIES.md` — xlsx row (version/source/rationale) + §7.1 follow-up marked done.
- `docs/IMPLEMENTATION_PLAN.md` Dead Code #28 — xlsx ✅ done; only vitest 1→4 remains.

### Doc-sync (CLAUDE.md §16)
Surfaces changed: [x] security posture (dependency), [x] deployment / build (dep source = CDN tarball).
Docs updated: `APPROVED_DEPENDENCIES.md`, `IMPLEMENTATION_PLAN.md` #28, this changelog.

### Note for ops
The `xlsx` tarball now resolves from `cdn.sheetjs.com` at install time (recorded in the lockfile with an integrity hash). `npm ci` on Vercel + CI fetches it from there. If a build ever fails to reach the CDN, the lockfile integrity hash still pins the exact artifact — re-run resolves transient network blips.

### PR
- Branch: `claude/brave-shannon-mr1ye`
- Status: Draft (pending review)

---

## Session: brave-shannon-mr1ye (cont.) — Phase 44.2 slice 2: SMSF franking refunds

### Changes Made
- **Type**: Feature + tax-engine extension + schema migration
- **Scope**: SMSF fund-income tax — refundable franking (imputation) credits.
- **Origin**: Reza — "go with slice 2". Franking refunds = the single most material SMSF tax feature (pension-phase funds live off them).

### What shipped
- **Engine** (`lib/tax-engine/super/smsfIncomeTax.ts`): `calculateSmsfIncomeTax` gains optional `frankingCredits` input + returns `frankingCredits`, `netTaxPayable` (gross `tax` − credits; negative ⇒ refund), `frankingRefund` (`max(0, credits − tax)`). Complying → refundable (s67-25); non-complying → non-refundable (floored at 0). Citations: Div 207 + s67-25. Helper `applyFranking()`.
- **Tests** (`tests/tax-engine/smsfIncomeTax.test.ts`): +6 cases — back-compat (no credits → net == gross), offset < tax, excess refund, pension-phase full refund, non-complying non-refundable, UNCOMPUTED-ECPI → null net/refund. **15/15 green.**
- **Schema:** `SmsfAnnualReturn.frankingCredits Float @default(0)` — additive migration `20260603090000_phase_44_2_smsf_franking_credits` (ADD COLUMN only).
- **types.ts / assembler / API:** `frankingCredits` threaded through `EntityTaxFacts.smsfIncomeTax`, `assembleEntityTaxFacts`, and the `smsf-return` PUT body.
- **UI** (`/dashboard/entities/[id]/tax`): headline is now the **net position** — a refund shows in emerald with "+", celebrated, with a "franking credits exceed the fund's tax" note; gross tax + franking credits added to the breakdown grid; a franking-credits input added to the form.

### Build Status
- [x] `tsc --noEmit` — 0 errors
- [x] `vitest` SMSF suite — 15/15 pass
- [x] `lint:financial-surfaces` — exit 0
- [x] `next build` — ✓ Compiled (`/dashboard/entities/[id]/tax` 4.9 kB)

### Schema-change deploy protocol (CLAUDE.md §12.12)
- `prisma/schema.prisma` modified with matching migration `20260603090000_phase_44_2_smsf_franking_credits/migration.sql`. Additive `ADD COLUMN ... NOT NULL DEFAULT 0`. No DROP, no `db push`.

### Destructive write checklist (CLAUDE.md §12.11)
- No new destructive write. The existing `smsf-return` PUT upsert (ownership-guarded, entity+FY key) gains one field in its `data`. Migration additive (ADD COLUMN, existing rows default to 0 = prior behaviour). User confirmation: NOT REQUIRED.

### Phase 41E reform-awareness (CLAUDE.md §12.14)
- Modified `calculateSmsfIncomeTax` (in `lib/tax-engine/super/`). **Reform outcome: reform-neutral.** Franking refundability is NOT one of the 8 reform measures, so the new branch produces the same number under every regime — no regime parameter or `commencementVerified` gate is required (documented in the function). Back-compatible: callers omitting `frankingCredits` get byte-for-byte the prior result. New column is on `SmsfAnnualReturn`, not `Property`/`Investment`/`LegalEntity` → FW-3 N/A.

### PR
- Branch: `claude/brave-shannon-mr1ye`
- Status: Draft (pending review)
