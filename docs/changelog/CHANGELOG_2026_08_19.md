# Changelog - 2026-08-19

## Session: simp-p2r-r0 (Code, Fable 5) — BRIEF_SIMP_P2R_R0 execution, PR 1 of 2 (the P2 gate)

### Changes Made
- **Type**: Feature (exposure control) + Fix (MON-160) + docs/process. `changesNumbers: NO` by contract.
- **Scope**: PROD Simplification P2 remainder + Preview pipeline (`docs/strategy/PROD_SIMPLIFICATION_PLAN.md` §5 P2, §7)
- **Description**:
  - **MON-160 fix** — module gates were baked at BUILD time: Next.js statically pre-rendered
    gated layouts, freezing the guard's 404/pass verdict into the deployment, so an admin flag
    flip could not unhide a module without a redeploy (found by the Matrix on Preview 2026-08-11,
    #1587 comment). Fix: `moduleRouteGuard()` awaits `connection()` BEFORE the flag read — the
    ONE chokepoint all ~20 gated layouts share (SSOT); locked by an order-asserting test.
    Registered as MON-160 (FIXING; VERIFIED = Reza confirms a live PROD flip propagates ≤30s).
  - **P2.3** — reports page narrowed via the registry: tiles carry `moduleKey`s
    (financial-overview→MODULE_HOME · income-expense→MODULE_HOUSEHOLD · loan-debt→MODULE_DEBT_PLANNER ·
    investment→MODULE_INVESTMENTS; property-portfolio + tax-time unkeyed = the kept v1 pack),
    filtered by the SAME `filterNavByModules` the nav uses; the help section renders from the
    same array — the hardcoded second list is deleted (§12.2.1). Side effect: producer census
    `deductions` 105→104 (a phantom prose match in the deleted list — reseeded with an honest note).
  - **P2.4 (D-6)** — `OwnershipPicker` renders nothing while MODULE_ENTITIES is off; all six
    call sites verified to initialise + reset `{mode:'sole'}`, so new capture resolves to the
    auto-personal entity at the canonical writer. `CorrectOwnershipDialog`'s write path is
    replaced by a notice while off (a hidden picker there could otherwise overwrite existing
    joint/shared attribution with `sole`). ZERO writes to existing attribution; no migration.
  - **P2.6** — 02_UP_NEXT.md row 66 refreshed: target story = the plan §1 v1 line (property
    scoreboard); trigger re-anchored to "before public v1 traffic". Registration only.
  - **Preview pipeline (B-1/B-3/B-4)** — NEW `scripts/dev/set-module-flags.mjs` (keys parsed
    from `moduleRegistry.ts` with a two-way cross-check — never a hardcoded list; REFUSES any
    PROD-looking DATABASE_URL/Cloud SQL identifier per D-9; `--dry-run`; missing rows reported,
    never created). CLAUDE.md §13.6 exception widened to the FULL-INSTANCE copy per Reza's
    2026-08-09 ruling (attested non-real/pre-launch dataset) with the hard trigger (first genuine
    customer account or CDR data ⇒ full-instance copying prohibited); plan §7 mirrored; §7.3
    runbook gains the mandatory post-refresh flag re-apply + the 2026-08-11 refresh-log row.
  - **P2 ticks** — P2.1 (core pass; crumbs noted), P2.2 CLEAN, P2.2b CLEAN, P2.5 executed —
    each citing its #1587 verdict comment; cursor + session log advanced.

### Files Modified
- `lib/featureFlags/moduleRouteGuard.ts` — MON-160 fix (`await connection()` first)
- `tests/featureFlags/moduleGuards.test.ts` — MON-160 order-asserting lock (12 tests green)
- `app/dashboard/reports/page.tsx` — P2.3 registry-keyed tiles + derived help section
- `components/ownership/OwnershipPicker.tsx`, `CorrectOwnershipDialog.tsx` — P2.4 gates
- `tests/featureFlags/p2Narrowing.test.ts` — NEW source-scan locks for P2.3/P2.4
- `scripts/dev/set-module-flags.mjs` — NEW (dry-run + PROD-guard + bad-key proofs in the PR body)
- `CLAUDE.md` §13.6 · `docs/strategy/PROD_SIMPLIFICATION_PLAN.md` (§5 P2, §7, cursor, §9) ·
  `docs/implementation/02_UP_NEXT.md` row 66 · `docs/issues/ISSUES.json`+`.md` (MON-160) ·
  `.audit/producer-census.json` (reseed, noted) · Layer-0 allowlist (+1 test file)

### Build Status
- [x] `npx tsc --noEmit` clean · featureFlags suite 44/44 green
- [x] `neomatrix:check` · `lint:financial-surfaces` · `lint:source-lock` · `census:producers:check`
      (reseeded, honest note) · `issues:check` (147 valid) · `mon131:check` (empty diff) — all green
- [x] Full vitest suite: run before push (result in the PR body)

### Coverage boundary
Verifies the wiring in source + the guard's dynamic opt-out ordering. Does NOT verify: the
rendered narrowing on a deployed build (P2.1 crumbs), the live flip-propagation on PROD
(MON-160's VERIFIED condition — Reza's check after deploy), or the server writer's
sole→personal resolution (pre-existing, unchanged).

---

## Session: simp-p2r-r0 (continued) — PR 2 of 2 (R0 override wiring)

### Changes Made
- **Type**: Feature (verification mechanism). `changesNumbers: NO`. **No schema change** — the
  `FeatureFlagOverride` table pre-dates R0; it finally gains its evaluation reader.
- **Scope**: R0 (plan §5 R-stages precondition; BRIEF_SIMP_P2R_R0 §C)
- **Description**: per-user overrides so a hidden module can go live IN PROD for one user (Reza)
  for Ring-3 verification. `isModuleEnabledForUser` (global ∥ active USER override, not expired;
  keyed cache; fail-closed) + `moduleHasActiveOverride`; `invalidateFlagCache(key)` now clears
  derived per-user entries. All 35 gated API handlers with an authenticated user pass
  `auth.userId` into `moduleApiGuard` (3 public/webhook handlers stay global-only, listed).
  `/api/feature-flags/modules` returns the session user's EFFECTIVE map when a Bearer token is
  sent (client context + nav now user-aware). Admin CRUD at
  `/api/admin/feature-flags/[key]/overrides[/id]` (audit-logged; upsert scoped to the flag+user
  pair — §12.11 answered in the PR body) + a minimal working Overrides affordance on the Modules
  panel. **Deviation surfaced:** server layouts have NO user identity (verified: zero `cookies()`
  repo-wide, Bearer-only auth), so the brief's "layout guards already run with an authenticated
  user" is false for layouts — layouts route through `ModuleGateBoundary`: hard server 404 when
  fully hidden (the standing state); during an override window the shell renders and the
  per-user verdict is enforced client-side (`ModuleOverrideGate` → not-found / Home fallback
  redirect) AND at every gated API server-side.

### Files Modified
- `lib/featureFlags/moduleGate.ts` — user-aware reader + any-override check + prefix invalidation
- `lib/featureFlags/moduleRouteGuard.ts` — `resolveModuleRouting` (3 modes; MON-160 opt-out kept
  first) + `moduleApiGuard(key, userId?)`; the P1 `moduleRouteGuard` is superseded (no dead code)
- `components/featureFlags/ModuleGateBoundary.tsx`, `ModuleOverrideGate.tsx` — NEW
- 21 gated layouts + `app/dashboard/page.tsx` — route through the boundary (Home keeps its
  never-404 redirect in all modes)
- 35 × gated API route files — `auth.userId` passed to the guard
- `app/api/feature-flags/modules/route.ts` — optional-auth effective map
- `lib/featureFlags/ModuleGateContext.tsx` — sends the token; refetches on auth change
- `app/api/admin/feature-flags/[key]/overrides/{route.ts,[overrideId]/route.ts}` — NEW CRUD
- `app/admin/feature-flags/page.tsx` — Overrides affordance on the Modules panel
- `tests/featureFlags/moduleGuards.test.ts` (rewritten for the three modes; MON-160 lock kept
  under the same test name) + `tests/featureFlags/r0Overrides.test.ts` — NEW (58 suite tests green)

### Build Status
- [x] `npx tsc --noEmit` clean · featureFlags suite 58/58
- [x] Full suite + all repo gates run before push (results in the PR body)

### Coverage boundary
Verifies precedence/expiry/cache/invalidation semantics and the wiring by source-scan. Does NOT
verify the live override window end-to-end — that is the R0 ACCEPTANCE (post-merge, on PROD:
MODULE_TAX globally OFF + override for Reza ⇒ he sees /dashboard/tax; a second account gets
not-found; both captured on the PR).
