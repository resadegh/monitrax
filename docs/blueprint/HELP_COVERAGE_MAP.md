# Help Coverage Map

> **Owner:** Reza (final say) + Claude (maintenance).
> **Phase 33h** (this doc) + Phase 33i (articles) + Phase 33j (tooltips).
> **Last updated:** 2026-05-09.

This document is the **single source of truth** for what help content exists for every Monitrax surface. When the user hits the `?` drawer on a page, `lib/help/routeContext.ts` derives its mapping from each article's `routeContext` frontmatter — this map is the index human contributors check against to know what's covered, what's pending, what's tooltip-only, and what doesn't need help.

## Classes

| Class | What | Where it lives |
|---|---|---|
| `article` | Full task-oriented help article (~250–400 words) | `docs/help/<audience>/<slug>.md` with `routeContext` set |
| `article-shared` | One article maps to several routes via glob (`/foo/*`) | Same — `routeContext` is an array or glob |
| `tooltip-only` | Field definition(s) only, no narrative article | `lib/help/tooltips.ts` dictionary entry + inline `<HelpTooltip term="..." />` next to the field |
| `coming-soon` | Acknowledged; not yet authored. Drawer falls back to audience landing list. | Listed below; no file yet |
| `redirect` | Route is alive but redirects to a canonical surface. Help drawer follows the redirect target's article. | Server `redirect()` page (e.g. `app/dashboard/accounts/page.tsx`) + matchRoutes alias in `lib/navigation/trailNav.tsx` |
| `none` | No help needed (covered by another surface, or the surface IS help itself) | — |

## Consumer surfaces

| Route | Class | Article slug / Tooltip | Notes |
|---|---|---|---|
| `/dashboard` | `article` | `consumer/your-monitrax-home` | Anchors the TRAIL framing. **Phase 43 — hosts `<MoneyStoryHero>`** (3-line scoreboard + Money Story Bar visualisation; reads `moneyStory` block from `/api/dashboard/insights`). |
| `/onboarding/*` | `article-shared` | `consumer/onboarding-walkthrough` | First-touch friction; stuck here = abandon |
| `/dashboard/balances` | `article` | `consumer/managing-accounts-and-loans` | Bank-link confusion is common. **Phase 43.1 — hosts `<HiddenWealthLens>`** (Liquid · Accessible · Locked Long-Term split; reads `/api/dashboard/hidden-wealth`). **Phase 36 Phase 2d/2e (2026-05-09) — canonical accounts surface**: list pages at `/dashboard/accounts` and `/dashboard/loans` redirect here. |
| `/dashboard/balances/*` | `article-shared` | `consumer/managing-accounts-and-loans` | Same article covers sub-routes |
| `/dashboard/expenses` | `article-shared` | `consumer/managing-accounts-and-loans` | **Phase 43.2 — hosts `<SpendingParetoLens>`** (vital-few categories driving 80% of monthly outgoings; reads `/api/dashboard/spending-pareto`). Article shared until a dedicated `consumer/spending-categories` lands. |
| `/dashboard/budget-analysis` | `article-shared` | `consumer/reading-your-cashflow` | **Phase 43.3 — hosts `<MarginTrendLens>`** (6-month savings-rate sparkline + delta + sliding-window trend; reads `/api/dashboard/margin-trend`). Article shared with `/cashflow` until a dedicated `consumer/margin-trend` lands. **No longer a redirect target.** |
| `/cashflow` | `article` | `consumer/reading-your-cashflow` | "Am I OK this month?" |
| `/dashboard/cfo` | `article` | `consumer/ai-guide-and-actions` | AI advice + scenarios |
| `/dashboard/tax` | `article` | `consumer/your-tax-position` | **complianceClass: afsl** — finance-sensitive |
| `/dashboard/safety-net` | `article` | `consumer/emergency-fund-target` | Emergency-fund target explainer |
| `/dashboard/debt-planner` | `article` | `consumer/debt-freedom-plan` | **complianceClass: afsl** — strategy comparison |
| `/dashboard/properties` | `article` | `consumer/adding-properties` | Heavy field-definition surface (LVR, equity, yield) |
| `/dashboard/properties/*` | `article-shared` | `consumer/adding-properties` | Drill-in dialog falls under same article |
| `/dashboard/investments/*` | `article-shared` | `consumer/investment-accounts-and-holdings` | Concentration + performance |
| `/dashboard/entities` | `article` | `consumer/my-structure` | Phase 41 entity layer; the moat moment |
| `/dashboard/entities/*` | `article-shared` | `consumer/my-structure` | Tab routes share the article |
| `/dashboard/documents` | `article` | `consumer/uploading-documents` | AI extraction |
| `/dashboard/vault` | `article-shared` | `consumer/uploading-documents` | Alias of /documents per Phase 38 PR1 |
| `/dashboard/household-profile` | `coming-soon` | — | Phase 41 dependency |
| `/dashboard/reports` | `coming-soon` | — | Reports surface still settling |
| `/dashboard/setup` | `none` | — | Self-explanatory; the surface IS the help |
| `/dashboard/settings` | `coming-soon` | — | Settings sub-tabs each get their own article in 33i+1 |
| `/health` | `coming-soon` | — | Will share with `/dashboard/cfo` once health-engine UX settles |
| `/transactions` | `coming-soon` | — | Activity sub-route; Phase 36 |
| `/recurring` | `coming-soon` | — | Recurring sub-route; Phase 36 |
| `/dashboard/plan` | `coming-soon` | — | My Budget hub; Phase 37 |
| `/dashboard/accounts` | `redirect` | — | **Phase 36 Phase 2d (2026-05-09):** redirects to `/dashboard/balances`. matchRoutes alias keeps sidebar highlight correct for old-URL traffic. |
| `/dashboard/loans` | `redirect` | — | **Phase 36 Phase 2e (2026-05-09):** bare list page redirects to `/dashboard/balances`. Sub-routes `/dashboard/loans/[id]` (loan full-page detail) and `/[id]/strategy` (debt-strategy planner) PRESERVED. |

## Portal surfaces (org-professional)

| Route | Class | Article slug | Notes |
|---|---|---|---|
| `/portal/dashboard` | `article` | `org-professional/practice-overview` | Adviser landing; alert stream interpretation |
| `/portal/clients` | `coming-soon` | — | Will share with `/portal/clients/[id]/view` once the list view stabilises |
| `/portal/clients/[id]/view` | `article` | `org-professional/client-drill-in` | Scope/consent + Structure/MoneyFlow/Dashboard tabs |
| `/portal/clients/[id]/*` | `article-shared` | `org-professional/client-drill-in` | All client sub-routes share |
| `/portal/team` | `coming-soon` | — | Phase 32B PR1 anti-poaching guardrails |
| `/portal/tasks` | `coming-soon` | — | Practice surface task management |
| `/portal/integrations` | `coming-soon` | — | Accounting / banking provider connections |
| `/portal/feedback` | `coming-soon` | — | Adviser-facing help already exists at `org-professional/sending-feedback` (Phase 33g) — wire `routeContext` in next pass |
| `/portal/api-keys` | `coming-soon` | — | Practice / Enterprise tier feature |
| `/portal/reports` | `coming-soon` | — | Practice reporting |

## Portal surfaces (org-admin)

| Route | Class | Article slug | Notes |
|---|---|---|---|
| `/portal/marketplace/listing` | `article` | `org-admin/marketplace-listing` | Listing editor + submit→review flow + compliance fields |
| `/portal/marketplace/*` | `article-shared` | `org-admin/marketplace-listing` | Public listing pages share |
| `/portal/team` (admin view) | `coming-soon` | — | Same route as adviser view; needs role-aware help (Phase 33k candidate) |

## Org-client surfaces

| Route | Class | Article slug | Notes |
|---|---|---|---|
| `/portal/consent` | `article-shared` | `compliance/cdr-consent-walkthrough` | Already exists from Phase 33a |
| `/portal/request-access` | `coming-soon` | — | Org-attached access flow |

## Compliance surfaces (regulator-facing)

| Class | Notes |
|---|---|
| All articles under `docs/help/compliance/` | Already shipped in Phase 33d; not directly route-mapped (they live in the Help Center index for auditor browsing) |

## Tooltip-only inventory

These are field-level definitions, not articles. Source of truth: `lib/help/tooltips.ts`.

### Finance terms (22)

`lvr`, `equity`, `rental-yield`, `effective-principal`, `offset-account`, `concessional-cap`, `non-concessional-cap`, `superannuation-guarantee`, `division-293`, `division-296`, `cgt-discount`, `franking-credit`, `division-7a-loan`, `sole-purpose-test`, `in-house-asset-cap`, `lrba`, `tbar`, `transfer-balance-cap`, `ppr`, `negative-gearing`, `medicare-levy`, `lito-sapto`

### Monitrax-specific (8)

`entity-role`, `entity-type`, `trail-stage`, `health-score`, `ownership-scope`, `audience`, `surface-tag`, `consent-status`

## Maintenance protocol

1. **Adding a new article (33i+):** create the markdown file under `docs/help/<audience>/<slug>.md`, set `routeContext` in frontmatter, flip the row in this map from `coming-soon` to `article`, mark its `lastReviewed`. Drawer auto-discovers.
2. **Adding a new tooltip term (33j+):** add the entry to `lib/help/tooltips.ts`, append to the inventory above, wire `<HelpTooltip term="..." />` next to the field.
3. **Renaming a route:** search `routeContext` across `docs/help/**/*.md` first; update affected articles. The map row updates with it.
4. **Annual review:** every 12 months, walk this map; routes added since last review go from `coming-soon` to a real class; stale articles get re-reviewed (the `lastReviewed` field flags them).
5. **AI-scaffolding new articles:** see Phase 33i scaffold protocol — ship as `status: DRAFT_AI_SCAFFOLD`, edit, remove the flag. Drawer + index ignore drafts.

## Engine

`lib/help/routeContext.ts` derives the route → article registry from this article frontmatter at request time. There is no separate code-side mapping table to keep in sync. Resolver behaviour:

- Exact-path match wins over glob match at the same prefix length.
- Within glob matches, longest prefix wins.
- Articles with `status: DRAFT_AI_SCAFFOLD` are excluded.
- Falls back to audience landing list when no rule matches.
