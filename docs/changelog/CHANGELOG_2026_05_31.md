# Changelog — 2026-05-31

## Session: stitch-dashboard-redesign-LIlK9 (Wealth Universe Explorer — Phase 44 Part 3)

### Changes Made
- **Type**: Feature (Workstream 0·WX — Wealth Universe Explorer · Phase 1 + 1.1)
- **Scope**: Ships the consumer-facing Wealth Universe canvas as the canonical
  surface for `My Accounts → My Structure`. Replaces the legacy React Flow
  `EntityCanvas` on desktop (mobile still on legacy until next iteration).
- **Decision**: Reza explicitly directed (2026-05-30 → 2026-05-31) — "I want
  the user to see the full story of their wealth and entities in one screen…
  Apple Dock meets Apple Maps for wealth structures." Five Stitch
  iterations + four React PRs converged on the final "Wealth Universe"
  spatial-canvas direction now in prod.

### Architectural decisions (locked this session)

| # | Question | Decision |
|---|---|---|
| A1 | Render every owned object or cluster by significance? | **Every relevant item** — no clustering threshold. Density managed by filter chips + search dim. |
| A2 | Joint ownership rendering — two ribbons or synthetic group node? | **Synthetic `ownership-group` node** between member entities; jointly-owned assets attach to the group. |
| A3 | Beneficial-ownership override rendering | **Show both** — legal chain dimmed (slate), beneficial chain full-strength (violet). Lens toggle to come in Phase 1.1. |
| A4 | Money Flow lens depth (current FY vs FY-slider) | **Current FY only for v1**; FY-slider documented as Phase 2 enhancement. |
| A5 | Phase 1 + Phase 2 in one PR or split? | **Two PRs** — Phase 1 shape-only (this PR); Phase 2 will include §12.14 Phase 41E reform-awareness PR-template block. |
| MOBILE | Mobile pattern approach | **Option A — Apple Maps hybrid** — compact canvas top + draggable bottom sheet. Map-primary on first open, sheet always shows full entity list with selected detail at top, joint/beneficial render same as desktop, one tap = detail. |

### Files modified

#### New service + API SSOT (Phase 1)
- `lib/services/wealthGraphService.ts` — **NEW** — pure aggregator. Reads
  `LegalEntity[]` + `Property[]` + `Loan[]` + `Account[]` +
  `InvestmentAccount[]` + `Asset[]` + `EntityRelationship[]` +
  `OwnershipGroup[]` (+ nested `OwnershipStake[]`) +
  `BeneficialOwnershipOverride[]` via `Promise.all([...])`. Returns
  canvas-ready `WealthGraphSnapshot` shape. Zero tax math, zero calc.
  Distinct from `getMasterFinancialSnapshot()` (financial breakdowns) and
  `/api/portfolio/snapshot` SnapshotV2 (aggregated counts + GRDCS health)
  — three SSOTs for three distinct concerns per CLAUDE.md §12.2.
- `app/api/wealth-graph/route.ts` — **NEW** — thin auth-gated route
  (`withPermission('entity.read')`). Canonical `{ success, data, error,
  meta }` envelope per CLAUDE.md §6.6.

#### Layout + data hook
- `lib/data/wealthExplorerLayout.ts` — pure layout function. Consumes
  `WealthGraphSnapshot`, returns positioned `WealthNode[]` + derived
  `WealthRelationship[]`. Zone-based spatial layout (corporate top-left,
  SMSF top-right, joint left-mid, sole-trader right-mid, individuals
  centre-bottom), assets placed in 9%-canvas-radius arc below their
  owning entity, EntityRelationship-typed ribbons,
  ownership-group synthetic nodes, BeneficialOwnershipOverride dual chains.
- `lib/data/wealthExplorerTypes.ts` — shared types + design tokens
  (`NODE_ACCENT`, `RIBBON_COLOR`). Added node types `asset-loan` +
  `ownership-group`; added optional `ownerEntityId` + `tier` fields on
  `WealthNode`.
- `lib/hooks/useWealthExplorerData.ts` — calls `/api/wealth-graph`,
  unwraps envelope, runs layout. Loading / error / refetch surface.

#### Canvas components (already shipped via PR #942, extended this session)
- `components/wealth-explorer/WealthUniverseCanvas.tsx` — orchestrator.
  Apple Dock fan-effect magnification on hover, ribbon highlight tracking
  hovered node, popover follows cursor with edge-aware left/right
  anchoring, click → `EntityDetailPanel` slide-in, search box +
  filter chips wired, loading / error / empty states.
- `components/wealth-explorer/EntityDetailPanel.tsx` — slide-in right
  panel (Framer Motion spring). On-demand fetch of `/api/entities/[id]`.
  Identity (ABN / ACN / trust type / established date), parent-entity
  link, asset counts grid (properties / investments / accounts /
  other), CTA to full entity file.

#### Wired into consumer route
- `app/dashboard/entities/page.tsx` — desktop (`md:block`) renders
  `WealthUniverseCanvas`; mobile (`md:hidden`) keeps legacy
  `EntityCanvas` with add/edit handlers until mobile Stitch ports.

#### Stitch artefacts (per CLAUDE.md §18 Stitch-first)
- `.stitch/designs/wealth-explorer-v5-universe-dark.{html,png}` (PR
  #939, merged earlier in session) — Stitch screen
  `a3b43b9164d74f1c8ec53bc20f319cbd`. Visual SoT for desktop.
- `.stitch/designs/wealth-explorer-mobile-v1-dark.{html,png}` (this
  session) — Stitch screen `72ea8d79fa7e4a0c865a2c2a9d73d198`.
  Visual SoT for mobile (Apple Maps hybrid). Awaiting React port
  in next PR.
- `.stitch/designs/entity-structure-canvas-desktop-v1.{html,png}`,
  `entity-structure-mobile-v2-dark.{html,png}`,
  `entity-structure-mobile-v2-light.{html,png}`,
  `entity-structure-mobile-v4-dark-magnifier.{html,png}`,
  `entity-structure-mobile-v4-light-magnifier.{html,png}` — earlier
  iteration references retained for evolution traceability (v1
  wrong-aesthetic / v2 right-aesthetic-wrong-IA / v4 canvas+magnifier
  → eventually rejected for the spatial v5 reset).

#### Documentation (§16 doc-sync — this PR)
- `docs/blueprint/PHASE_44_ENTITY_GRAPH.md` — added §16 "Part 3 —
  Wealth Universe canvas" (consumer surface architecture, the
  `/api/wealth-graph` SSOT, layout function semantics, relationship
  to Parts 1 + 2).
- `docs/architecture/06_UI_UX_FOUNDATION.md` — added "Wealth Universe
  Explorer pattern (Phase 44 Part 3, 2026-05-31)" section documenting
  the 9 reusable components, new design-language elements (silk-thread
  ribbons / dust-mote particles / gravitational anchor / Apple Dock
  fan), entity-type colour tokens, mobile Apple Maps hybrid pattern.
- `docs/IMPLEMENTATION_PLAN.md` (already updated in PR #943) — workstream
  `0·WX. Wealth Universe Explorer` with all 6 phases including the
  Phase 2 enh. FY-slider documented per A4.

### PRs merged this session

| # | Title | Outcome |
|---|---|---|
| 939 | `design(wealth-explorer): Stitch v5 — Wealth Universe (spatial reset)` | merged |
| 940 | `feat(wealth-explorer): ship v5 surface design as light-touch prod preview` | merged |
| 941 | `feat(my-structure): move Wealth Universe canvas to /dashboard/entities (desktop)` | merged |
| 942 | `feat(wealth-explorer): real data + interactive hover/click/search/filter` | merged |
| 943 | `feat(wealth-explorer): real asset graph + EntityRelationship ribbons + joint groups` | merged |
| 944 | `fix(wealth-graph): log root-cause error for prod 500 diagnosis` | merged |
| 945 | `fix(wealth-graph): TEMP surface error inline for debug` (+ Promise.all root-cause fix) | merged |

### Build Status
- [x] TypeScript compilation passes (`next build` — full type-check, not
  `--experimental-build-mode=compile`)
- [x] Build passes on Vercel preview + production for every merged PR
- [x] Manual verification on prod after every merge per CLAUDE.md §17.2

### Bugs found + fixed in-session
1. **Route export signature** (PR #944 build failure) —
   `withPermission(request, permission, handler)` inline doesn't satisfy
   Next.js 15's route export validator. Fix: curried
   `withPermission('entity.read', async (req, ctx) => {...})` returning
   the handler.
2. **AuthContext access** (PR #944 build failure #2) — handler's second
   argument is `AuthContext` (`{ userId, email, role }`), not a request
   with `.user` attached. Fix: `context.userId` instead of
   `authReq.user!.userId`.
3. **NODE_GLYPH exhaustiveness** (PR #944 build failure #3) — added
   `asset-loan` + `ownership-group` to `WealthNodeType` without updating
   the `Record<WealthNodeType, LucideIcon>` map. Local
   `--experimental-build-mode=compile` skips the type-check stage; full
   `next build` would have caught it. **Process change adopted this
   session:** use full `next build` (not the compile-only flag) for
   pre-push validation.
4. **`prisma.$transaction([array])` rejected by wrapped client** (prod
   500) — the project's WIF-backed Prisma adapter wraps each query, and
   the array form rejects every element with "All elements of the array
   need to be Prisma Client promises." Fix: `Promise.all([...])` for
   the read-only aggregator. No transaction isolation needed for
   concurrent reads.

### Vercel runtime-logs API regression (separate issue, surfaced this session)
The `/v1/projects/{id}/deployments/{depId}/runtime-logs` streaming
endpoint hung indefinitely (no response after 90s) on every attempt this
session — both via `./scripts/vercel-logs.sh latest-runtime` and via
direct `curl --max-time 90`. Worked normally earlier this session
(`[auth] / status=200` lines came through fine). The PR #944
`console.error` diagnostic was invisible because of this; required the
PR #945 inline-error-details workaround to extract the root cause. **TBD
for the next operator:** investigate whether the regression is
Vercel-side (intermittent runtime-logs streaming bug) or
sandbox-side (cloud-sandbox HTTP client behavior with NDJSON streaming).
Runbook `docs/operational/runbooks/12_CLAUDE_CODE_MCP_SETUP.md`
may need a section on the inline-error-details fallback pattern.

### Outstanding tech-debt (carries into next PR)
- The PR #945 inline `details` field on the wealth-graph error response
  is TEMPORARY and bypasses CLAUDE.md §13 ("Never include CDR data in
  error messages"). **Must be reverted to NODE_ENV-gated** in the next
  PR. Tracked here so it isn't forgotten.
- Console.error from PR #944 stays — it's server-side only, no client
  leak.

### PRs
- See "PRs merged this session" table above.
- Status: All merged into `main` and deployed to prod.
