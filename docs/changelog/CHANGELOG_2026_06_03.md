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
