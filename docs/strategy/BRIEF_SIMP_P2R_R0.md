# CODE BRIEF — PROD Simplification: P2 remainder + Preview pipeline + R0 (consolidated)

**For:** a fresh Code session · **Model: Fable 5** throughout (well-specified builds; no diagnosis work) · **Kind:** BUILD.
**Prepared by:** Matrix HQ (Cowork), 2026-08-09 · **Spec of record:** `docs/strategy/PROD_SIMPLIFICATION_PLAN.md` — the plan wins any disagreement with this brief.
**State at handoff:** #1584/#1585/#1586/#1587 all MERGED. Flag phase empirically CLOSED — P2.2 CLEAN (fresh PROD treeHash identical to `.audit/golden-baseline-12954ff.json`) and P2.2b CLEAN (flags-on pair diff: 0 changed / 0 added / 0 removed), plus a P2.1 user-side pass — all recorded as comments on PR #1587 (2026-08-09). PROD is live in v1 shape; all 13 keys HIDDEN.

**Boot ritual first**, then read the plan (cursor block → §0 → P2/R-stages) and the #1587 verdict comments.

## Scope — one PR (or two if R0 deserves its own review), off main

### A. P2 remainder
1. **P2.3 Reports narrowing** — `/dashboard/reports` shows the property-portfolio/tax-time pack only; other report tiles keyed to their parent module's flag via the registry (no hardcoded second list — SSOT).
2. **P2.4 D-6 safe default** — new-capture ownership defaults to the auto-personal entity; `OwnershipPicker` hidden when `MODULE_ENTITIES` is off (client-gate via `useModuleEnabled`, same pattern as the Strategy tabs). **ZERO writes to existing attribution** — this is a default, not a migration (§12.11).
3. **P2.6 Positioning row** — confirm/refresh the queued positioning-rewrite row (02_UP_NEXT.md row 66) points at the v1 story (plan §1 candidate line). Registration only; no marketing build.
4. **P2 gate close-out** — tick P2.1/P2.2/P2.2b in the plan citing the #1587 comments (2026-08-09); note the remaining P2.1 crumbs (full §2.2 route sweep transcript, gated-API 503 spot-checks, mobile tab bar glance) in the gate PR; update cursor + session log. Amend the plan's §7.3 runbook with the post-refresh step from B-3 below.

### B. The Preview pipeline (D-7 + D-9 compliant)
1. **`scripts/dev/set-module-flags.mjs`** — `node scripts/dev/set-module-flags.mjs --all on` / `MODULE_TAX off` against `DATABASE_URL`. Reads keys from `MODULE_REGISTRY` (never a hardcoded list). Refuses to run if the URL resolves to the PROD instance (guard on host/instance name) — PROD flags are the admin panel's job ONLY (D-9).
2. **Selective PROD→dev copy tooling (BUILD ONLY — do not execute against PROD):**
   - `scripts/dev/export-user-graph.mjs` — given `--user 91b6d7ce-d9f1-4ac0-96ce-fc958dca2a3c`, walks the Prisma FK graph and exports THAT USER'S rows (and their entity-owned records) to a single timestamped JSON artifact. **No other user's rows, ever** — the D-7 exception in CLAUDE.md §13.6 is scoped to Reza's own data and PROD contains other real people's accounts.
   - `scripts/dev/import-user-graph.mjs` — idempotent upsert of that artifact into the target DB; refuses to run if the target resolves to PROD (one-way by construction). Deletes-then-inserts within the user's graph only.
   - Both scripts: dry-run mode, row-count summary per table, and a manifest hash printed at the end so export/import can be reconciled.
3. **Post-refresh rule (add to plan §7.3):** every dev refresh overwrites dev's flag rows with PROD's (all false) if the flag table is in the user graph — either exclude `GlobalFeatureFlag` from the copy (preferred; it is not user data) or re-run `set-module-flags.mjs --all on` after every import. State which you implemented.
4. **Standing dev state:** after the first successful import, run `set-module-flags.mjs --all on` against dev — Preview permanently shows the full app; PROD stays hidden. Record the state in the plan.
   *(Execution of the actual copy is Matrix+Reza-side over Chrome/console/Code-terminal with Reza's credentials — this brief only delivers the tooling.)*

### C. R0 — FeatureFlagOverride wiring (the go-live verification mechanism)
Purpose: enable a hidden module **in PROD for one user only** (Reza) so Ring-3 verification runs on live data before any public re-enable. Required before ANY R-stage switch is flicked.
1. **Reader:** `isModuleEnabledForUser(key, userId)` in `moduleGate.ts` = global flag OR an active `FeatureFlagOverride` row for (key, userId). Same keyed cache + fail-closed semantics; global-only reader stays for call sites with no user context.
2. **Enforcement points become user-aware:** layout guards and API guards already run with an authenticated user — route the check through the user-aware reader. `/api/feature-flags/modules` returns the session user's effective map (global ∥ override).
3. **API:** admin CRUD for overrides under `/api/admin/feature-flags/[key]/overrides` — create (userId, enabled, optional expiry), list, delete; audit-logged like the flag PATCH; cache invalidation on every change.
4. **Admin UI (minimal):** on the Modules panel row — an "Overrides" affordance showing active overrides (email + since) and add/remove. This deliberately re-introduces a *working* override control where the dead one was removed in P1 (§4.5); it must be real this time and only as much UI as the R0 use-case needs.
5. **Tests:** override precedence (global off + override on ⇒ enabled for that user, hidden for everyone else) · fail-closed on DB error · cache invalidation · no schema change (the `FeatureFlagOverride` table already exists — if you believe a migration is needed, STOP and hand back).
6. **Acceptance:** with `MODULE_TAX` globally OFF, an override for Reza's account shows him `/dashboard/tax` on PROD while a second account (any test user) still 404s — capture both checks in the PR.

## Hard lines (unchanged)
No producer paths (`lib/calculations|services|tax-engine|reports`, `scripts/matrix`) · never fix a number in passing (§23.2.1) — wrong number found ⇒ registry issue · `changesNumbers: NO` for every PR in this brief · no `.github/workflows/` · no schema changes anywhere · hidden ≠ deleted · §20.6 + §16.5 blocks in every PR body · plan checkboxes + cursor updated in the SAME PR.

**Done =** P2-gate PR merged with P2 ✅ (bar the P2.5 execution, logged separately when run) · the three dev scripts exist with dry-run proof in the PR body · R0 acceptance captured · plan cursor points at "P2.5 execution + P3 kickoff".
