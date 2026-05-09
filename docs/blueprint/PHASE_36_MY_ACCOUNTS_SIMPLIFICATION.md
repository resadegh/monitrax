# Phase 36: My Accounts — UX Simplification

> **TRAIL Stage:** Track
> **Status:** 🔄 **Phase 36 nearly complete** — only Phase 2c (Import Transactions UI migration) remains.
>
> **Shipped:**
> - Phase 36b (PR #552) — extracted shared `AccountDetailDialog` + `AccountFormDialog` + `LoanFormDialog`
> - Phase 2a (PR #601, 2026-05-02) — inline `LoanDetailDialog` on Balances
> - **Phase 2b/2d/2e (THIS PR, 2026-05-09)** — `?action=` deep-link handler on Balances; `/dashboard/accounts` and `/dashboard/loans` bare list pages retired with `redirect()`; sub-routes `/dashboard/loans/[id]` + `/[id]/strategy` preserved; `routeMap.ts` flipped (`account` + `loan` basePaths now `/dashboard/balances`); `?id=` cross-module-nav handler added on Balances; 7 source-side hrefs flipped.
>
> **Remaining:** Phase 2c (Import Transactions UI migration) — gated on the Import-Transactions panel refactor; Phase 2f (sidebar legacy entries — none found, no work).
> **Started:** 2026-04-18
> **Last updated:** 2026-05-09 (doc-sync catch-up)
> **Owner:** UX / Frontend

---

## 1. Problem

The current "My Accounts" section is fragmented across **six sub-pages** — Accounts, Loans, Income, Spending, Transactions, Recurring. This structure conflates two fundamentally different things:

1. **Financial reality** — what actually is (Accounts, Loans, Transactions, Recurring)
2. **Budget intentions** — what the user plans (Income, Spending)

The fragmentation causes:

- **Cognitive overload** — six equally-weighted tabs violate Hick's Law; every visit triggers a "which tab?" decision
- **Data distrust** — users see their Netflix charge in Spending *and* Recurring *and* Transactions and don't know which is authoritative
- **TRAIL dilution** — the TRACK stage contract is *"face your reality, no judgment"*. Budget intentions (Income/Spending manual entries) belong in REDUCE, not TRACK
- **Avoidance behaviour** — six tabs feel like six chores; the Barefoot "Date Night" framing only works when the app feels calm, not interrogative
- **Redundant forms** — once Basiq connects, direction-IN transactions *are* income and direction-OUT transactions *are* spending; separate manual-entry pages become duplicative

## 2. Solution

**Reduce six tabs to two.** Move budget intentions to the REDUCE stage where they belong.

### New structure

```
My Accounts (TRACK — "Here's your full picture")
├── Balances     — Accounts + Loans, unified (Assets / Credit / Debt sections)
└── Activity     — Transactions + Recurring, unified with filter chips

My Budget (REDUCE — "Fix the leaks")
├── Budget       — (existing)
├── Cashflow     — (existing)
├── Income       — (migrated from My Accounts)
├── Spending     — (migrated from My Accounts)
├── Debt Freedom — (existing)
└── Tax          — (existing)
```

### Design language

Apple-like, modern, minimal:

- Hero numbers with tabular-nums and generous whitespace
- Rounded cards (16px radius), subtle shadows, no heavy borders
- Gentle colour accents per category (green=assets, amber=credit, soft-red=debt)
- Subtle enter animations (200ms fade+slide, no bouncing)
- Live tiles where Basiq freshness matters (last-synced, next-expected)
- No form-heavy tiles as the default view — drill-into-dialog pattern
- Tabular nums on every balance so the decimals line up

## 3. Non-Negotiable Constraint: PRESERVE ALL RELATIONSHIPS

This is a **UI-only refactor**. The data graph in `prisma/schema.prisma` is **not touched**.

### Relationships that MUST remain intact

| Relationship | Field | Preserved behaviour |
|---|---|---|
| Loan ↔ Property | `Loan.propertyId` | LVR, equity, rental yield, negative gearing calcs still flow through `masterFinancialService` |
| Account ↔ Loan (offset) | `Loan.offsetAccountId` (unique) | Offset interest reduction still calculated; offset link surfaced in both Loan and Account rows |
| Loan ↔ Asset (car) | `Loan.linkedAssetId` | Vehicle depreciation + payoff tracking unchanged |
| Loan ↔ Account (LOC) | `Loan.linkedAccountId` | Line-of-credit revolving balance unchanged |
| UnifiedTransaction ↔ Property/Loan/Income/Expense/Investment | tag fields on `UnifiedTransaction` | All tags survive; Activity tab exposes them as filters |
| Income ↔ Property (rental) / Investment (dividends) | `Income.propertyId`, `Income.investmentAccountId` | Rental yield, franking calcs unchanged |
| Expense ↔ Property/Loan/Investment/Asset | `Expense.propertyId`, etc. | Deductibility, ownership-cost attribution unchanged |
| RecurringPayment ↔ Expense | `RecurringPayment.linkedExpenseId` | Phase 29 budget reconciliation unchanged |

### What does NOT change

- Every Prisma model, field, and `@relation`
- Every API route (`/api/accounts`, `/api/loans`, `/api/unified-transactions`, `/api/recurring-payments`, `/api/income`, `/api/expenses`)
- Every canonical service (`masterFinancialService`, `netWorthCalculator`, `cashflowOrchestrator`)
- Every entity dialog (Overview / Linked Data / Insights / Actions)
- Every GRDCS link and cross-module navigation path
- All existing edit/create forms — they are reachable as dialogs from the new unified pages

### What DOES change

- Sidebar: "My Accounts" children go from 6 entries to 2 (Balances, Activity)
- Sidebar: "My Budget" children add Income and Spending
- Two new pages: `app/dashboard/balances/page.tsx`, `app/dashboard/activity/page.tsx`
- The old pages remain accessible via direct URL — they are not deleted, so any bookmarks, in-app links, or tests keep working during the transition
- Minor copy changes in the TRAIL framework doc

## 4. Rollout Plan

1. Add the two new pages and sidebar update in this PR (no old-page deletions)
2. Monitor usage — if the new pages absorb all traffic, in a follow-up PR the old pages can redirect to the new locations
3. Eventually deprecate the old pages when no internal link points to them

## 5. Psychology & Visual Principles

- **Loss aversion** — show Net Position as the hero number, so debt is contextual, not a separate tab screaming at the user
- **Hick's Law** — 2 tabs = instant decisions, 6 tabs = 2-second hesitation every visit
- **Single source of truth** — one view of transactions means users stop second-guessing which number is real
- **Progressive disclosure** — filters inside one page feel like exploring; separate pages feel like the app is fragmenting your life
- **Calm visual hierarchy** — one big number, medium subtotals, small row items; user eye flow is top→down, not scatter

## 6. Checklist

- [x] Phase 36 spec doc (this file)
- [ ] `TRAIL_FRAMEWORK.md` updated to reflect 2-tab My Accounts + Income/Spending under My Budget
- [x] `/dashboard/balances` page created
- [x] `/dashboard/activity` page created — first cut (view-only) merged earlier, **rebuilt with full legacy `/transactions` functionality + Apple visuals** in this branch (categorisation, link dialog, import wizard, server-side pagination, all filters); see §8
- [x] `DashboardLayout.tsx` sidebar updated
- [ ] Subtle animation utilities added to `globals.css`
- [x] Legacy `/transactions` URL turned into a permanent redirect to `/dashboard/activity` (preserves bookmarks); see §8
- [x] Build passes
- [x] Changelog entry at `docs/changelog/CHANGELOG_2026_04_18.md`

## 7. Phase 36b — Inline dialogs on Balances (2026-04-29)

> **Goal:** retire `/dashboard/accounts` and `/dashboard/loans` as
> primary navigation targets. They keep working via direct URL but
> the canonical entry point is `/dashboard/balances`.
>
> **Approach:** extract the detail / create / edit dialogs into
> shared components in `components/accounts/` and `components/loans/`
> so any page can render them. Then wire `/dashboard/balances` to
> open them inline instead of navigating away.

### Phase 1 — Account detail (PR #552, merged)

- New `components/accounts/AccountDetailDialog.tsx` (Overview /
  Transactions / Offset Details / Linked tabs).
- `/dashboard/balances` row click → opens dialog inline (was:
  navigated to `/dashboard/accounts#<id>` which didn't auto-open
  the dialog, forcing a second click).
- `/dashboard/accounts` migrated to use the same shared component
  (~307 lines of inline JSX deduplicated).
- SSOT (CLAUDE.md §12.2): replaced one local helper
  (`calculateEffectiveLoanBalance`) with the existing canonical
  `calculateEffectivePrincipal` from `lib/utils/calculations.ts`.
  Interest-savings formula preserved EXACTLY per user direction
  (existing calculations are correct, no new engines).

### Phase 1b — Account / Loan create + edit (this session)

- New `components/accounts/AccountFormDialog.tsx` — shared
  create/edit form. Owns its own form state, validation, and
  submit handler. Body shape matches the legacy POST/PUT contract
  to `/api/accounts` exactly (incl. `interestRate / 100` decimal
  conversion).
- New `components/loans/LoanFormDialog.tsx` — shared create/edit
  form for loans. Includes the Phase 19 `FormDocumentUpload`
  auto-fill integration and the post-save document-link call to
  `/api/documents/{id}/link`. Body shape matches `/api/loans`
  POST/PUT exactly.
- `/dashboard/balances` toolbar wired:
  - **+ Account** → opens `AccountFormDialog` in create mode
    (was: `router.push('/dashboard/accounts')`).
  - **+ Loan** → opens `LoanFormDialog` in create mode (was:
    `router.push('/dashboard/loans')`). Properties + Assets
    lookups are lazy-fetched on first open.
  - **Edit Account** (from detail dialog) → opens
    `AccountFormDialog` in edit mode inline (was: navigated to
    `/dashboard/accounts#<id>`).
- `/dashboard/accounts` migrated to use the shared
  `AccountFormDialog` — replaces ~85 lines of inline form JSX
  + the `formData`/`handleSubmit`/`resetForm`/`handleEdit`
  state/handlers.
- `/dashboard/loans` migrated to use the shared `LoanFormDialog`
  — replaces ~320 lines of inline form JSX + the form state +
  `handleFieldsExtracted` + `handleSubmit` + `resetForm`.

**Calculation/contract changes: zero.** Per user direction the
existing logic on legacy and current pages is correct — Phase 1b
is purely visual / flow, no behavioural change to forms,
validation, API contracts, or document-linking.

### Phase 1c — Source picker + Connect Bank on Balances (this session, 2026-04-29)

User direction:
> "when the BASIQ is enabled the bank connection will bring accounts
> and loans, also loans also have transactions so the import should
> be enabled for the loans as well. also I want the import file to
> be higher value than the manual create."

**Toolbar layout on `/dashboard/balances`:**

```
[🏦 Connect Bank]  [+ Account]  [+ Loan]
   (Basiq, accounts + loans — recommended)
```

- **Connect Bank** is now a top-level toolbar button. Wired to a
  new shared `useBasiqConnect()` hook (`hooks/useBasiqConnect.ts`)
  so the legacy `/dashboard/accounts` page and the new Balances
  page invoke the same code path. Behaviour, body shape, error
  handling, and copy preserved EXACTLY from the legacy
  `handleConnectBank()` implementation.
- **`+ Account`** opens a 2-tile picker (`AddSourcePicker`):
  - **Import bank statement** (recommended, emerald) → opens
    `TransactionImportDialog` (existing component, no changes).
    Auto-creates the account from the file's closing balance when
    no account is selected.
  - **Enter manually** (secondary, blue) → opens
    `AccountFormDialog` (Phase 1b component).
- **`+ Loan`** opens a 2-tile picker:
  - **Upload loan document** (recommended, emerald) → opens
    `LoanFormDialog`. The form already hosts `FormDocumentUpload`
    (Phase 19) at the top — drop a PDF statement / contract and
    Gemini AI auto-fills lender / principal / rate / term /
    repayment.
  - **Enter manually** (secondary, blue) → opens the same
    `LoanFormDialog` without the document-upload affordance
    emphasised. Same component, no duplication.

**Loans don't get a "Import transaction file" tile** because the
existing `TransactionImportDialog` only writes into `Account`
rows (`UnifiedTransaction.accountId` is a non-nullable FK). Loan
repayments still flow through Basiq syncing the linked payment
account, or through bank-statement imports that match repayment
debits to the loan via existing categorisation rules. Neither
needs a new entry point on Balances.

**Components reused (no recreation, per CLAUDE.md §12.1-§12.3):**

- `TransactionImportDialog` — used as-is.
- `AccountFormDialog`, `LoanFormDialog` — Phase 1b components,
  no changes.
- `useBasiqConnect()` — new hook lifting the legacy connect
  function. Sync and disconnect remain on the legacy page (Phase
  2 will migrate them alongside the management UI).
- `AddSourcePicker` — new generic 2-tile picker primitive in
  `components/ui/`. Pure presentation; the parent owns the tile
  callbacks.

**Calculation/contract changes: zero.** Same Basiq endpoints, same
import body shape, same form submit handlers as Phase 1b.

### Phase 2 — Retire `/dashboard/accounts` and `/dashboard/loans` (planned)

#### Phase 2.0 — Non-Basiq cross-references repointed (this session, 2026-05-01)

Cleanup pass triggered by a UX bug on the Home page: the TRAIL banner's
"Go to Track" button was sending users to the legacy `/dashboard/accounts`
page even though the sidebar's "My Accounts" item already pointed at
`/dashboard/balances`. We swept the codebase and repointed every
non-Basiq href that still targeted the legacy page:

- `components/dashboard/TrailStageIndicator.tsx` — Track stage `href`
  (also redesigned the banner — see §9 below).
- `components/LinkedDataPanel.tsx` — `ADD_LINK_ROUTES.account` (the
  GRDCS cross-module add-link target for missing account links).
- `components/health/ModuleHealthBlock.tsx` — `accounts` and
  `offsetAccounts` drill-down hrefs.
- `app/dashboard/cfo/page.tsx` — Month-End Balance metric card
  `router.push` target.
- `app/api/cashflow/intelligence/route.ts` — Build Emergency Buffer
  recommendation's `learnMoreUrl`.

Deliberately NOT repointed (still depend on the legacy page until
Phase 2b ports the Connect Bank UI to Balances):

- `components/dashboard/BasiqHeroCard.tsx` — `?action=connect-basiq`
  and `?action=add` hrefs.
- `components/dashboard/DashboardEmptyStateGrid.tsx` — same.
- `components/setup/SetupNextActionPanel.tsx` — same.

Tracked as tech-debt row #9 in `docs/IMPLEMENTATION_PLAN.md`. Will
flip in the same PR that ships Phase 2b.

#### Phase 2a–2e — Remaining work

- ✅ 2a — Inline the `LoanDetailDialog` on `/dashboard/balances` (replaces
  PR #550's `?focus=` redirect to `/dashboard/loans`). **Shipped: PR #601.**
- ✅ 2b — Migrate `Connect Bank` (Basiq) toolbar action and disconnect/
  sync UI to `/dashboard/balances`. Flip Basiq `?action=` hrefs.
  **Shipped: this PR (2026-05-09).** `useEffect` handler on Balances
  reads `?action=connect-basiq | add-account | add-loan` and triggers
  the right toolbar action; URL is cleaned after firing. 7 source-side
  hrefs flipped (`SetupNextActionPanel`, `BasiqHeroCard`,
  `DashboardEmptyStateGrid`, `LinkedDataPanel`, `ModuleHealthBlock`,
  `EntityCashflowSummary`).
- 📋 2c — Migrate `Import Transactions` toolbar action (with
  `TransactionReviewPanel`) to `/dashboard/balances`. **Remaining work.**
- ✅ 2d — Redirect `/dashboard/accounts` → `/dashboard/balances`.
  **Shipped: this PR (2026-05-09).** 23-line redirect component using
  `redirect('/dashboard/balances')` from `next/navigation`. No
  sub-routes existed; account detail uses the inline dialog already.
- ✅ 2e — Redirect `/dashboard/loans` → `/dashboard/balances`.
  **Shipped: this PR (2026-05-09).** Sub-routes `/dashboard/loans/[id]`
  (loan full-page detail) and `/dashboard/loans/[id]/strategy`
  (debt-strategy planner) PRESERVED — only the bare list page redirects.
- ✅ 2f — Sidebar: remove any legacy entries still pointing at the old
  pages. **Shipped: this PR (2026-05-09).** Audit found no legacy
  sidebar entries pointing at the dead routes — `lib/navigation/trailNav.tsx`
  uses `/dashboard/balances` as the canonical nav target with
  `/dashboard/accounts` + `/dashboard/loans` retained as `matchRoutes`
  aliases (so old-URL traffic keeps the sidebar highlight correct on
  the redirect target).

#### Phase 2 — `routeMap.ts` flip (this PR, 2026-05-09)

Closes the cross-module-nav regression that the bare-redirect alone
would have introduced. GRDCS `getEntityHref('account', id)` and
`getEntityHref('loan', id)` previously produced
`/dashboard/accounts?id=...` and `/dashboard/loans?id=...`. With the
list pages gone, those URLs would have lost the dialog params on
redirect to `/dashboard/balances`.

Fix: `lib/navigation/routeMap.ts` `account.basePath` and
`loan.basePath` both flipped to `/dashboard/balances`. A `?id=`
handler on Balances looks up the entity in the loaded list and
auto-opens the appropriate inline detail dialog
(`<AccountDetailDialog>` / `<LoanDetailDialog>`). Guarded against
re-fire on data refresh by `idHandledRef`. URL is cleaned after
firing.

## 9. Home TRAIL banner redesign (2026-05-01)

> **v3 PREMIUM REDESIGN — same day, second pass.**
> Reza reviewed v2 (the interactive-tabs redesign below) and approved the
> functionality but rejected the visual treatment as "too text-based, no
> artistic transitions, no graphics that engage users visually." He
> commissioned a v3 with the brief: *"Apple-like, animated transitions,
> relevant background, world-class. The design of Monitrax should be the
> selling point."*
>
> **v3 ships in the same PR as v2's removal.** v2 only lived in production for
> a few hours; v3 supersedes it entirely.

### v3 design vocabulary

Built on top of the existing marketing motion vocabulary (`appleEase`,
`useReducedMotion`, framer-motion v12 — see `components/marketing/TrailHero.tsx`).
Zero new dependencies introduced.

1. **Glassmorphic card** with rounded `28px` corners, semi-transparent
   `bg-card/70`, soft layered shadow (`0 1px 2px rgba(15,23,42,0.04),
   0 8px 30px rgba(15,23,42,0.06)`), and `backdrop-blur-xl`. Sits on top
   of an animated atmosphere instead of a flat fill.

2. **Stage-coloured atmospheric mesh gradient** — three overlapping
   radial gradient stops at 12%/-10%, 92%/110%, and 50%/50% of the card.
   Colours are stage-specific (Track = warm amber/orange/burnt-amber;
   Reduce = orange/rose/burnt; Anchor = emerald/teal/forest;
   Invest = sky/indigo/slate; Live = yellow/amber/sunset). When the
   user changes stages the entire mesh morphs over 1.4s with `appleEase`.
   Above the active letter, a slow-breathing soft glow (8s loop)
   provides ambient warmth without distraction.

3. **Hero-scale interactive letters** — `h-16 / sm:h-20` rounded-square
   tiles with glassy backdrop. Each letter is rendered as
   `bg-gradient-to-br bg-clip-text text-transparent` so it reads as
   refined display typography rather than plain text. Springy hover
   (scale 1 → 1.08, springiness `stiffness: 320, damping: 28`) and
   tactile press (scale 0.96). On the spotlit letter, a coloured glow
   halo (blurred `blur-xl`) fades in behind via `AnimatePresence` —
   the letter literally *glows* in its stage colour.

4. **Animated connecting thread** — the line between letters is
   actually two layers: a static `bg-foreground/[0.07]` track + an
   animated gradient overlay that fills from 0 → user's actual stage
   on first render (1.1s with 0.2s delay). The fill gradient
   transitions from Track's amber to the user's current stage colour,
   visualising the journey traversed.

5. **"You" label** — instead of the long "You are here" pill on the
   spotlight, a tiny pill above the user's actual stage letter says
   simply "You". Animates in 0.6s after the page loads. Functional
   reminder that survives even when hovering other letters.

6. **Bespoke per-stage SVG glyphs** — five inline SVGs (no asset
   files), each with stage-specific micro-motion that respects
   `prefers-reduced-motion`:
   - **T (Track)** — concentric awareness rings ("aperture") with a
     6-second breathing pulse.
   - **R (Reduce)** — diminishing arcs with a snipping line, slowly
     rocking left-right (8s loop) like a pair of scissors at rest.
   - **A (Anchor)** — anchor silhouette with a soft underwater sway
     (5s loop) over a wave baseline.
   - **I (Invest)** — sparkline that re-draws itself on a 3.6s loop
     using `pathLength` animation, with a punctuation dot at the
     peak.
   - **L (Live)** — sunrise: a horizon line, a half-sun, and five
     radiating rays, with the same 6s breathing pulse as Track to
     bookend the journey.
   Each glyph uses a per-stage linear gradient so the colours
   reinforce the atmosphere without being noisy.

7. **Cross-fade content swap** — when the spotlight changes, both the
   glyph and the text content swap via `AnimatePresence mode="wait"`
   with a blur-out / blur-in transition (`filter: blur(6px) → 0`,
   y: 12 → 0, 0.45s). No snap, no flash — content "exhales out" and
   "inhales in." Glyph rotates 8° on entry/exit for added physicality.

8. **Spotlight content layout** — two-column grid (`auto, 1fr`):
   - Glyph in a glassy `22px` rounded-square frame.
   - Stage label (gradient-filled), headline (1.55rem semibold,
     tight tracking `-0.01em`), description, italic key question +
     emotion shift line ("From avoidance → awareness").
   The italic question is the verbatim TRAIL_FRAMEWORK §2 question
   in serif-italic style — sets it apart as the "voice of the
   framework" rather than UI copy.

9. **Primary CTA button** — pill-shaped, gradient-filled in the
   spotlight stage's signature colour, with a sweep-shimmer effect on
   hover (a translucent white gradient slides across the button in
   0.9s). Lifts 1px on hover with spring physics.

10. **Reduced-motion mode** — when the user's OS reports
    `prefers-reduced-motion: reduce`, every animation collapses to
    instant or static. The mesh gradient stops morphing, the breathing
    glow stops, the sparkline stays drawn, the glyph swap is a hard
    crossfade only. The content remains fully usable.

### Functional model (unchanged from v2)

- Default render = user's actual TRAIL stage in the spotlight.
- Hover/focus = preview that stage in the spotlight (transient).
- First click = select that stage (sticky; survives mouse leave; small
  dot below the letter).
- Second click on the same letter OR clicking the inline "Open Stage"
  CTA = navigate to that stage's page.
- All stage hrefs verified against the canonical sidebar nav (Track →
  `/dashboard/balances`, Reduce → `/dashboard/budget-analysis`,
  Anchor → `/dashboard/safety-net`, Invest → `/dashboard/properties`,
  Live → `/dashboard/cfo`).

### Stage copy provenance

Every string visible in the banner is sourced verbatim from
`docs/blueprint/TRAIL_FRAMEWORK.md` §2 (Headline, narrative description,
key question, emotional-shift line). If TRAIL_FRAMEWORK changes, the
strings in `TrailStageIndicator.tsx` must be re-synced — call this out
in the PR template for any TRAIL_FRAMEWORK edit.

### Performance

- Zero new dependencies (framer-motion was already in use by marketing).
- All SVG glyphs inline — no extra HTTP requests, no asset bloat.
- `AnimatePresence mode="wait"` ensures only one child renders at a
  time; no layout thrash.
- The mesh gradient is a single CSS background string animated as one
  property — GPU-friendly, no layout reflow.
- All animations honour `prefers-reduced-motion`.

### v2 (superseded — kept here for context)

> **Goal:** make the `T R A I L` banner on the Home dashboard
> communicate the framework rather than just illustrating it.

**Before.** The banner showed five circles with the letters
`T R A I L` and a one-line tagline for the user's current stage. The
circles looked tappable but weren't — the only interactive element
was a small "Go to <Stage>" link in the top-right corner. Users
reported that the banner *looked* like a live tile but did nothing
when clicked.

**After.** The five circles are now real interactive tabs:

1. **Bigger letters** (h-12 / sm:h-14) so they read as primary
   controls, not decoration.
2. **Hover** (or keyboard focus) previews that stage's full
   description in the spotlight panel below — the headline, the
   narrative, and the key question, sourced verbatim from
   `TRAIL_FRAMEWORK.md` §2 ("The Five Stages").
3. **First click** selects the letter (sticky — survives mouse
   leave). A small dot under the selected letter and a halo ring
   around it indicate the selection.
4. **Second click on the same letter** navigates to that stage's
   page.
5. The spotlight panel always carries an explicit `Open <Stage>`
   button so users who don't discover the second-click behaviour
   still have an obvious nav affordance.
6. A "**You are here**" pill marks the user's actual TRAIL stage
   in the spotlight (so the explore-vs-current distinction is
   never lost when they hover other letters).

Default render still shows the user's actual TRAIL stage — users
who never interact with the banner see today's behaviour.

Stage descriptions live in the component file (sourced from
TRAIL_FRAMEWORK §2). If TRAIL_FRAMEWORK.md is updated, the strings
in `TrailStageIndicator.tsx` must be re-synced.

### Out of scope for Phase 36b

- AI Strategy sub-page at `/dashboard/loans/[id]/strategy` — keeps
  its own dedicated route. Linked to from the LoanDetailDialog.
- `TransactionImportDialog` flow on the legacy `/dashboard/accounts`
  page — moved as a whole in Phase 2, not piecemeal.
- Any change to financial calculations — explicitly forbidden in
  Phase 36b per user direction.

## 8. Activity rebuild — full /transactions port + Apple visuals (this PR)

> **Goal:** make `/dashboard/activity` the canonical Transaction Explorer.
> The first cut of `/dashboard/activity` (merged earlier) was view-only —
> missing the categorisation workflow (TransactionLinkDialog), the import
> wizard, server-side pagination, and the full server-side filter set.
> That is the entire reason `/transactions` exists, and the categorisation
> loop is the engine behind Phase 29 (recurring matching) and Phase 30
> (budget vs actual reconciliation). Shipping a nav rename without that
> workflow would have broken the cleanup loop for every user.

### Approach

Port the **full** legacy `app/(dashboard)/transactions/page.tsx`
functionality 1:1 into `app/dashboard/activity/page.tsx`, and re-skin the
result with the same Apple-leaning visual language used by Balances.
Reduce the legacy `/transactions` URL to a permanent redirect.

### Functionality preserved verbatim

- State, refs, callbacks, dialogs, filters, pagination copied 1:1 from
  `app/(dashboard)/transactions/page.tsx`
- Same API surface (`/api/unified-transactions`, `/analytics`, `/api/accounts`)
- Same `TransactionLinkDialog` and `ImportWizard` imports
- "Uncategorised first" default preserved — the most important UX nudge
  in the app; without it, no one categorises and the Phase 29 + 30
  reconciliation engines starve
- Navigate-to-next-uncategorised flow inside the dialog still uses
  `transactionsRef` to avoid stale-closure on the just-refreshed list
- Server-side pagination (25 / page)
- Server-side filters: search, account, category, date range, recurring,
  anomalies, uncategorised, direction, excludeTransfers
- Linked / Transfer / Recurring / Anomaly indicators
- AI confidence badges

### Visual layer (Apple-leaning, no behavioural change)

- Hero "What's moving" + warm subtitle
- 4 click-to-filter summary tiles (Spend / Income / Net / Count) — the
  click-to-toggle interaction is preserved exactly; only the styling
  changes (rounded 2xl, soft accent colours, tabular-nums)
- Filter chip strip with `Recurring` / `Anomalies` / `Advanced` toggles,
  active-count badge on Advanced
- Slide-down advanced filter panel for Account / Category / Date range
- Day-grouped transaction list with day-net subtotals, inside one
  rounded card per group
- "Uncategorised first" amber alert downgraded to a calm pill
- Confidence badge shown ONLY when score < 0.9 — clean rows for the 90%
  the engine got right, eye drawn to the 10% that need review
- Pill-style pagination (chevron-left / chevron-right)
- Subtle `anim-rise-stagger` / `anim-rise` / `anim-fade-in`

### Legacy URL

`app/(dashboard)/transactions/page.tsx` reduced to:

```ts
import { redirect } from 'next/navigation';
export default function TransactionsRedirect() {
  redirect('/dashboard/activity');
}
```

This keeps bookmarks, deep links, and any internal `<Link>` to
`/transactions` working without us tracking down every reference.

### Out of scope for §8

- `/recurring` page — its matching workflow (Phase 29) is non-trivial
  and deserves its own redesign pass.
- Sidebar — no change. Activity is already the second My Accounts child
  from the original Phase 36 PR.
