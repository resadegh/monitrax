# Changelog — 2026-05-05

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
