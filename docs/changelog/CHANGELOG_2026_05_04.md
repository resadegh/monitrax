# Changelog — 2026-05-04

## Session: claude/review-monitrax-docs-8HM3K (Phase 32B PR1)

### Changes Made
- **Type**: Feature (foundation slice)
- **Scope**: B2B2C Practice surface — adviser / broker / accountant Portal
- **Description**: Schema + design primitives + demo dataset for the new Practice
  (B2B2C) workstream (Phase 32B). Following a four-lens monetisation +
  architecture review session with Reza, the existing `/portal/*` surface
  was audited and found to be a consent+invitation harness only (~30%
  real / 70% stub) — the value surface (cross-client Practice dashboard
  with alert stream, drill-in shared with the consumer dashboard,
  role-flavoured columns) was greenfield. Decision: redesign + extend
  the existing portal (keep RBAC + invitation + consent plumbing),
  don't fork.

### Files Created
- `prisma/migrations/20260504120000_add_organisation_profession/migration.sql`
  — Additive migration adding `Organization.profession` (forced at
  registration; reuses existing `OrganizationType` enum; backfills from
  `OrganizationPortalSettings.organizationType` where present;
  default `FINANCIAL_ADVISOR`).
- `lib/portal/practice/types.ts` — TRAIL stage type + label registry,
  shared with the consumer surface eventually (kept local for now).
- `lib/portal/practice/lighthouseDataset.ts` — 5 fictitious AU
  property-investor clients (Sarah K / David M / Emma L / Noah P /
  Olivia N) spanning all 5 TRAIL stages + 7 alerts spanning all v1
  trigger kinds (TRAIL_ADVANCED, HEALTH_DROP, CASHFLOW_NEGATIVE,
  EMERGENCY_FUND_LOW, LVR_REFINANCE_WINDOW, BAS_DUE,
  TAX_POSITION_CHANGED).
- `lib/portal/practice/professionConfig.ts` — Profession-aware Practice
  configuration. Adviser / broker / accountant variants for alert
  library + book columns + AFSL/credit/TPB compliance footnote. Tax
  agent + bookkeeper fall back to accountant config; OTHER falls back
  to adviser. Single registry, no fragmentation.
- `lib/portal/practice/index.ts` — barrel.
- `components/portal/practice/PracticeGlassCard.tsx` — Apple-glass tile
  primitive (22px radius, ring border, hover lift, optional severity
  accent strip).
- `components/portal/practice/TrailStageChip.tsx` — TRAIL stage chip
  using the same palette as the consumer TRAIL banner (TRACK slate,
  REDUCE amber, ANCHOR indigo, INVEST emerald, LIVE violet) so adviser
  and client see the same visual cue.
- `components/portal/practice/PracticeKpiStrip.tsx` — 4-up KPI hero
  (active clients / needs attention / TRAIL advanced / avg Health) with
  delta tone.
- `components/portal/practice/PracticeAlertStream.tsx` — Severity-sorted
  call-sheet (critical → opportunity → milestone). Profession filter
  applied via `professionConfig.alertTriggers`. AFSL guardrail in
  module JSDoc — alert text NEVER recommends a product / action.
- `components/portal/practice/PracticeClientBookTable.tsx` — Cross-client
  table with profession-flavoured columns (advisers see TRAIL/Health/
  net worth/cashflow/last seen; brokers see LVR/equity available/
  cashflow/Health/last seen; accountants see Tax YTD/missing receipts/
  BAS due/Health/last seen).
- `components/portal/practice/PracticeHeader.tsx` — Greeting + practice-
  mode pill + demo-only profession switcher (production hides the
  switcher; production reads `org.profession`).
- `components/portal/practice/index.ts` — barrel.
- `docs/changelog/CHANGELOG_2026_05_04.md` (this file).

### Files Modified
- `prisma/schema.prisma` — Added `profession` field to `Organization`
  (default `FINANCIAL_ADVISOR`).
- `lib/portal/index.ts` — Replaced the `auth.ts` comment block with a
  forward-looking note on why the file was deleted and how future
  portal sessions should handle server-side auth (extend
  `withPermission()` rather than re-introducing a parallel surface).
- `docs/IMPLEMENTATION_PLAN.md` — Added Workstream "Phase 32B — B2B2C
  Practice surface" at the top of 🟡 Active Workstreams; updated the
  "Last updated" header narrative; closed Tech Debt #8
  (`lib/portal/auth.ts` deletion); opened Tech Debt #13 (`OrganizationType`
  duplication on `Organization.profession` vs
  `OrganizationPortalSettings.organizationType`); added Open Question
  Q-PRA-1 (D2C vs org-attached AI voice context) — awaits Reza
  decision.
- `docs/architecture/03_DATA_MODEL.md` — Added §9 (B2B2C / Practice).
  Documents the new `Organization.profession` canonical field + the
  three-layer consent model (CDR consent / professional consent /
  per-view access event) that PR3 will wire through
  `getMasterFinancialSnapshot()`.
- `docs/architecture/06_UI_UX_FOUNDATION.md` — Added §14 (Practice
  (B2B2C) Surface). Documents the design language reconciliation —
  professional surface inherits the same brand tokens, glass tile
  pattern, TRAIL chip palette, severity accents, and tabular numerics
  as the consumer dashboard. Drill-in renders the canonical consumer
  dashboard with adviser overlay (PR3). AFSL guardrail in copy.

### Files Deleted
- `lib/portal/auth.ts` — Zero callers anywhere in the codebase
  (re-verified 2026-05-04 with strict grep). Flagged 2026-04-30 as
  dead code per CLAUDE.md §12.1. Closes Tech Debt #8.

### Build Status
- [x] TypeScript `tsc --noEmit` clean for new files (only pre-existing
  config warning on deprecated `baseUrl` option, unrelated).
- [ ] Full `npm run build` — not run this session because the new
  Practice components are isolated under `components/portal/practice/`
  and `lib/portal/practice/`, NOT yet imported by any production route
  (the existing `/portal/dashboard` "Coming Soon" stub still renders).
  Wiring + full build verification in PR2.

### Destructive Write Checklist (CLAUDE.md §12.11)

The migration contains one `UPDATE`:

```sql
UPDATE "organizations" o
SET "profession" = ops."organizationType"
FROM "organization_portal_settings" ops
WHERE ops."organizationId" = o.id;
```

1. **`where` clause matches:** every organisation that already has a
   matching row in `organization_portal_settings`. Intent: copy the
   existing profession-equivalent value across to the new canonical
   column.
2. **Columns overwritten / rows deleted:** `profession` only. Previous
   value is the freshly-set default (`FINANCIAL_ADVISOR`) from the
   `ADD COLUMN ... DEFAULT 'FINANCIAL_ADVISOR'` clause executed two
   statements earlier. No user-entered data is being clobbered.
3. **Guard ensuring this only mutates rows I created:** Not applicable
   — this is a one-time backfill migration, by design touching every
   existing row that has portal_settings. The "row I created" guard
   does not apply to one-time data migrations; the `WHERE` clause is
   the safety boundary instead.

User confirmation: NOT REQUIRED — backfill from authoritative sibling
column with no user-data clobber risk.

### Architecture Decisions

**One canonical engine, two voices (proposed):** D2C user vs
org-attached user use the SAME AI advisor and SAME snapshot — the
output post-processes through a `voiceContext` parameter that flips
tone, action affordances, and disclaimer framing. Architecturally
implemented as a deterministic `postProcessAdvice(rawAdvice,
voiceContext, professionalContext?)` function (~80 LOC, testable). NO
engine fork. Awaits Reza decision (Q-PRA-1 in IMPLEMENTATION_PLAN.md
Open Questions).

**Three layers of consent (committed):** CDR consent (User →
Monitrax via Basiq), professional consent (User → Org/Seat with
scope), per-view access event (logged on every render). Never
collapsed. Service-layer scope filter (not UI). Wiring lands PR3.

**Drill-in renders canonical consumer dashboard (committed):**
Professional drilling into a client renders `app/dashboard/*` verbatim
with a `viewerContext` prop tree and an adviser overlay. NOT a
separate `ClientDetail.tsx`. Existing portal `ClientDetail.tsx`
retired in PR3 — every consumer dashboard improvement automatically
benefits the professional view.

### Documentation Updated
- `docs/IMPLEMENTATION_PLAN.md` — workstream + tech debt + open question
- `docs/architecture/03_DATA_MODEL.md` — §9 B2B2C / Practice
- `docs/architecture/06_UI_UX_FOUNDATION.md` — §14 Practice surface
- `docs/changelog/CHANGELOG_2026_05_04.md` — this file

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern (new Practice primitives + design language note)
- [ ] application config (env vars, Vercel, OIDC, etc.)
- [ ] GCP infrastructure (Cloud SQL, IAM, etc.)
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure (new failure mode / diagnostic / lesson)
- [x] strategic decision (Open Question opened: Q-PRA-1 voice context; Tech Debt #8 closed; Tech Debt #13 opened)

Docs updated in this PR:
- `docs/architecture/06_UI_UX_FOUNDATION.md:§14` — Practice (B2B2C) surface design language reconciliation
- `docs/architecture/03_DATA_MODEL.md:§9` — Organization.profession canonical field + three-layer consent model
- `docs/IMPLEMENTATION_PLAN.md:🟡 Active Workstreams (Phase 32B)` — new workstream entry
- `docs/IMPLEMENTATION_PLAN.md:🗑️ Dead Code #8` — closed
- `docs/IMPLEMENTATION_PLAN.md:🗑️ Dead Code #13` — opened (OrganizationType duplication)
- `docs/IMPLEMENTATION_PLAN.md:❓ Open Questions Q-PRA-1` — opened (voice context decision)
- `docs/changelog/CHANGELOG_2026_05_04.md` — this file

### Testing
- [x] TypeScript clean for new files
- [x] No imports from new Practice files into existing production routes (verified)
- [ ] Manual UI testing — N/A this PR (components built but not yet rendered)
- [ ] Full build — deferred to PR2 when Practice dashboard wires

### PR
- Branch: `claude/review-monitrax-docs-8HM3K`
- Status: Pending push
