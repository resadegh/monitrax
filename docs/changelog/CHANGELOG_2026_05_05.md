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

---

## Session: claude/phase-41g-adviser-overlay-entity (Phase 41g — Adviser drill-in entity layer)

### Changes Made

- **Type**: Feature — adviser drill-in surface extended with entity tree + Sankey
- **Scope**: `lib/portal/adviserClientAccess.ts` (NEW shared helper), `app/api/portal/clients/[id]/entities/route.ts` (NEW), `app/api/portal/clients/[id]/money-flow/route.ts` (NEW), `app/api/portal/clients/[id]/snapshot/route.ts` (refactored to use the shared helper), `app/portal/clients/[id]/view/page.tsx` (3-tab toggle + parallel fetches + tree/Sankey mounts), `docs/IMPLEMENTATION_PLAN.md`, `docs/architecture/03_DATA_MODEL.md` (new §10.11), `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` (Step 2/3 flipped to LIVE)
- **Description**: Mount the Phase 41c `EntityTree` and Phase 41d `MoneyFlowSankey` inside `/portal/clients/[id]/view` so when an adviser opens a client, the entity tree is the **primary diagnostic** they see first (default tab). 3-tab toggle: **Structure** (default) | **Money Flow** | **Dashboard** (the existing canonical view from 32B PR3). Tabs mean Step 2 → Step 3 → Step 4 of the lighthouse pitch is one continuous flow, no nav-switching.

### Why this matters

Per Reza brief 2026-05-04: *"the adviser cannot give wealth advice without seeing the structure first; this surfaces it prominently."* Phase 41a–d shipped the consumer-side entity layer; 41g is what makes it reachable in the adviser pitch. Without 41g, the lighthouse pitch's Step 3 (entity tree, the *moat moment*) requires the adviser to navigate to a different page — breaks the flow. With 41g, it's the default view of the drill-in.

### Files Created / Modified

- **`lib/portal/adviserClientAccess.ts`** (NEW, ~150 lines) — shared helper `verifyAdviserClientAccess(callerUserId, organizationClientId)` that does the layered consent + membership + role + assignment checks. Returns either `{ ok: true, orgClient, membership }` or a structured error with `{ ok: false, status, code, message }`. **Reviewers reject any new portal client-data endpoint that doesn't route through this helper** (CLAUDE.md §0 architect lens — single canonical access guard).
- **`app/api/portal/clients/[id]/snapshot/route.ts`** — refactored to delegate auth to `verifyAdviserClientAccess`. Removed inline duplication of consent/membership/role/assignment checks (~75 lines of code consolidated). Behaviour unchanged.
- **`app/api/portal/clients/[id]/entities/route.ts`** (NEW) — thin GET wrapper. Auth via `verifyAdviserClientAccess`; delegates to canonical `listEntitiesForUser` (same service the consumer `/api/entities` uses) but passes the **client's** userId. Returns `{ entities, members }` — household members fetched via `where: { householdProfile: { userId: client.userId } }`.
- **`app/api/portal/clients/[id]/money-flow/route.ts`** (NEW) — thin GET wrapper. Auth via the same helper; delegates to canonical `getMoneyFlow` with the client's userId. Service swap is internal — when Phase 41e replaces the proportional tax allocation with Div 6/6E, this endpoint surface stays unchanged.
- **`app/portal/clients/[id]/view/page.tsx`** — added `tab` state (defaulting to `'structure'`), `entities` + `members` + `flow` state, parallel-fetch logic (snapshot + entities + flow in one `Promise.all`), 3-tab toggle (Structure / Money Flow / Dashboard) with active styling, and tab-content branching. Snapshot is treated as the primary load (its failure blocks the page); entities + flow failures are best-effort (the tree's empty state and Sankey's `isEmpty` handling cover those).

### Audit

The page-level `/snapshot` request already writes a `PRO_DASHBOARD_VIEW` row to `ClientAccessLog` for the view session. The new entities + money-flow endpoints **piggyback** on that row — they don't write their own. Multiplying audit rows per component would pollute the compliance log without adding signal. If component-level access logs are ever required for compliance, we add new action codes (`PRO_ENTITY_VIEW`, `PRO_MONEY_FLOW_VIEW`) and emit them at the route layer.

### Read-only in adviser view

Advisers can NOT edit a client's entity layer:
- The `EntityTree`'s `onEntityClick` is a no-op (no edit dialog opens for advisers)
- The `EntityTree`'s `onAdd` is a no-op (no Add CTA fires)
- No `EntityFormDialog` mounted on the adviser page

This is deliberate: editing a client's structure is a personal-advice activity that needs to happen through the proper Ask-a-Pro / consent channels (Phase 32C), not via a side-door API the adviser can hit because they have a viewing seat. A future Phase 41 slice may surface a *"Suggest a structural change"* affordance that opens an Ask-a-Pro thread for the client to action.

### Failure modes

- **Snapshot fails** → page shows the existing "Cannot view this client" error; entities/flow don't load.
- **Entities fail** → Structure tab renders with empty arrays; the EntityTree's empty-state hero shows.
- **Money flow fails** → Money Flow tab renders the friendly "No money flow data available for this client yet" message.
- **Dashboard tab** is unaffected by entities/flow failures — only depends on snapshot.

### Build Status
- [x] TypeScript compilation passes — `npx tsc --noEmit` exits 0
- [x] No new dependencies added
- [x] Prisma schema unchanged

### CLAUDE.md §16 doc-sync block

Surfaces changed in this PR:
- [x] visual design system / component pattern (3-tab toggle on adviser drill-in; reuses Phase 41c/d components verbatim)
- [ ] application config
- [ ] GCP infrastructure
- [x] identity / auth (`verifyAdviserClientAccess` shared helper consolidates consent + membership + role + assignment checks across 3 portal endpoints)
- [ ] deployment / build
- [x] security / CDR posture (canonical scope source-of-truth = DB row, not caller-provided; 3-layer consent model preserved end-to-end; audit piggyback policy documented)
- [ ] operational procedure
- [ ] strategic decision
- [x] data model (no schema change but new portal endpoints + shared access helper)

Docs updated:
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #31 ✅ SHIPPED with full detail; Recently Completed entry prepended
- `docs/architecture/03_DATA_MODEL.md` — §10.7 marker flipped to ✅ for 41g; new §10.11 (auth guard, audit policy, read-only constraint, failure modes, 41h unlock)
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` — Step 2 expanded to mention the tab toggle (Structure default, Money Flow + Dashboard one click away); Step 3 pre-condition flipped from "Phase 41a-c required" to "✅ LIVE 2026-05-05"
- `docs/changelog/CHANGELOG_2026_05_05.md` — this entry

### Test plan

1. **Adviser opens Sarah Kim's drill-in.** Navigate to `/portal/clients/{id}/view` (Sarah's organizationClientId). Page loads with Structure tab selected by default. Entity tree shows Sarah → Sarah Kim Pty Ltd. Adviser overlay docked right.
2. **Money Flow tab.** Click "Money Flow" tab. Sankey renders Sarah's actual income → entities → outflows. Headline chip strip above shows annual totals.
3. **Dashboard tab.** Click "Dashboard". The existing canonical consumer dashboard renders (KPI strip, health card, etc.). This is the legacy 32B PR3 view, unchanged.
4. **Read-only entity tree.** Click any entity tile in Structure tab — nothing happens (no edit dialog). Click the "Add" CTA — nothing happens. Verify advisers cannot edit a client's entity layer.
5. **Olivia Novak full structure.** Switch to Olivia's drill-in. Structure tab shows all 5 entities (Olivia personal, Pty Ltd, Discretionary Trust, Unit Trust, SMSF) with the dashed corporate-trustee line.
6. **Consent revoked.** If a client's consent is revoked while the adviser has the page open, refresh — page shows the consent-not-granted error block (covered by `verifyAdviserClientAccess` layer 2).
7. **PORTAL_ADVISOR not assigned.** Log in as a PORTAL_ADVISOR seat that's NOT assigned to the client. Open the URL directly. Page returns 403 `CLIENT_NOT_ASSIGNED` (covered by `verifyAdviserClientAccess` layer 5).
8. **Audit log.** Check `client_access_logs` table — exactly ONE `PRO_DASHBOARD_VIEW` row written per page load (snapshot endpoint), not three.

### What's NOT in this PR

- **No write affordance for advisers** on the entity layer (read-only by design).
- **No "Suggest a structural change" Ask-a-Pro thread.** Future slice.
- **No per-component audit rows** (`PRO_ENTITY_VIEW` etc.). Page-level `PRO_DASHBOARD_VIEW` covers it; revisit if compliance demands finer granularity.
- **Phase 41f (Xero/MYOB integration)** — separate workstream.
- **Phase 41h (AI entity-aware diagnosis)** — separate workstream; depends on 41e.0 + 41e.17.

### PR
- Branch: `claude/phase-41g-adviser-overlay-entity`
- PR URL: TBD on push
