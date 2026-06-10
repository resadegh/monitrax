# Changelog - 2026-06-10

## Session: email-verification-gcp-3ivh5a — follow-up (prefetch-safe verify)

### Changes Made
- **Type**: Fix (hardening) — follow-up to the merged email-verification PR
- **Scope**: Authentication / email verification
- **Root Cause**: Firebase reset/verify links carry a single-use code.
  Mail-client privacy protection + email security scanners pre-fetch links to
  inspect them, consuming the one-time code before the human taps → spurious
  "link expired or already used" on the first click (reproduced via iOS Mail
  during password-reset testing). Our `/verify-email` page had the same
  latent exposure: it called `applyActionCode` in `useEffect` (on load), so a
  JS-executing prefetch would burn the verification code too.
- **Solution (Reza chose "harden verify only, mitigate reset")**:
  - `/verify-email` is now **prefetch-safe** — on load it only runs read-only
    `checkActionCode` (validates + reads the email, does NOT consume), then
    waits for an explicit "Verify my email" button tap before calling
    `applyActionCode`. A silent prefetch never taps the button.
  - **Password reset** left on Firebase's hosted handler; mitigation +
    operator guidance documented in `01_AUTHENTICATION.md` § Troubleshooting.
    Durable custom-handler fix logged as Open Question **Q-AUTH-1** (deferred).

### Files Modified
- `app/verify-email/page.tsx` — button-gated apply; `checkActionCode`
  validation on load; new `ready`/`verifying` states; warm error mapping
- `docs/operational/security/01_AUTHENTICATION.md` — prefetch-safe note +
  new § Troubleshooting ("link expired or already used")
- `docs/IMPLEMENTATION_PLAN.md` — Open Question Q-AUTH-1 (custom reset handler)

### Build Status
| Step | Status | Notes |
|------|--------|-------|
| tsc --noEmit | PASS | no errors in changed file |
| Lint | PASS | `next lint` 0 warnings/errors |
| Build | PASS | `next build` ✓ — `/verify-email` 2.89 kB |

### Operator config done this session (Firebase console, by Reza)
- Sender name → "Monitrax"; public-facing name → "Monitrax"; support email
  → admin@monitrax.com.au
- Custom sending domain (From → noreply@monitrax.com.au) — verification
  in progress (pending DNS); From stays firebaseapp.com until DNS validates;
  emails send fine meanwhile.

---

## Session: email-verification-gcp-3ivh5a

### Changes Made
- **Type**: Feature + Fix + Dead-code removal
- **Scope**: Authentication / email verification / CDR gating
- **Root Cause**: Users could register with any fake email and use the app
  fully. Two verification systems coexisted, neither enforced:
  1. Firebase/GCP Identity Platform's `email_verified` claim was already
     parsed (`lib/auth/gcpTokenVerifier.ts:159`) and synced on user creation
     (`lib/auth/gcpIdentity.ts:251`) — but **no guard anywhere read it**.
  2. The Phase 05 custom module (`lib/security/emailVerification.ts`,
     Resend-backed) stored tokens in an **in-memory `Map`** — broken by
     design on Vercel serverless (the function instance that issues a token
     is almost never the one asked to verify it) — and was never called
     during registration anyway.
- **Solution**: GCP-first (CLAUDE.md §12.7). Firebase is now the single
  verification SSOT; the broken custom system is deleted. Posture chosen by
  Reza: **soft gate + hard-block CDR**, Firebase-native email template first.

### Architecture decisions
- **Gate reads the live token claim, never the DB row.** Firebase's
  `email_verified` only flips on token refresh, so `confirmEmailVerified()`
  force-refreshes (`getIdToken(true)`) before re-checking; server guards get
  the claim via the new `AuthContext.emailVerified` field. The DB columns
  (`User.emailVerified` / `emailVerifiedAt`) are bookkeeping that converges
  lazily (one-way false→true, guarded by the Google-signed claim).
- **Hard-block surface = the elevated CDR guards.** `requireVerifiedEmail`
  runs inside `withMFARequired` + `withActiveConsent` → 403
  `EMAIL_VERIFICATION_REQUIRED`. Covers Basiq connect and CDR data routes.
  Compliance rationale: consent notices and breach notifications must reach
  an inbox the account holder owns.
- **Soft gate everywhere else.** Dashboard stays open; `VerifyEmailBanner`
  names the one locked thing (bank connections) with resend/re-check
  actions. The interstitial offers "Skip for now" (behaviour-psychology
  lens: small-win moment, not a security scolding).
- **OAuth unaffected** — Google sign-ins arrive `email_verified: true`.

### Files Modified
- `lib/auth/context.ts` — `AuthContext.emailVerified` (live claim) + lazy DB
  true-up in `findOrSyncUser` fast path
- `lib/auth/guards.ts` — `requireVerifiedEmail` helper, wired into
  `withMFARequired` + `withActiveConsent`
- `lib/context/AuthContext.tsx` — `sendEmailVerification` on register
  (best-effort), `resendVerificationEmail()`, `confirmEmailVerified()`
- `app/register/page.tsx` — password signups route to `/verify-email-sent`;
  auth-redirect effect made verification-aware (race fix)
- `app/verify-email/page.tsx` — rewritten for Firebase `oobCode` /
  continue-URL shapes via `applyActionCode`
- `app/resend-verification/page.tsx` — rewritten signed-in-only (Firebase
  client SDK can only send to `currentUser`)
- `app/api/auth/verify-email/route.ts` — rewritten as claim-based DB true-up
  (verifies bearer token, requires `email_verified` claim, flips row, audits
  `EMAIL_VERIFIED`)
- `components/DashboardLayout.tsx` — renders `VerifyEmailBanner`
- `lib/security/index.ts` — removed re-exports of deleted module
- `package.json` / `package-lock.json` — `resend` dependency removed

### Files Created
- `app/verify-email-sent/page.tsx` — post-signup interstitial (Stitch screen
  `33717abc960b4fb6881a5de0d077abff`, project `1859462351962811110`)
- `components/auth/VerifyEmailBanner.tsx` — dashboard soft-gate banner
- `.stitch/designs/email-verification/verify-email-sent.{html,png}` — Stitch
  artefacts (§18.4)

### Files Deleted
- `lib/security/emailVerification.ts` (416 lines — in-memory token store,
  broken on serverless)
- `app/api/auth/resend-verification/route.ts` (consumer of the above)

### Stitch pass (§18)
Prompt seeded with the Deep Cosmos auth vocabulary (dark #0A0A14 + emerald
radial glow + centred 440px frosted card + hairline borders + single emerald
action colour) referencing the canonical `signin`/`register` screens.
One generation, on-target first pass. Implemented by composing existing
`AuthShell` primitives (per §18.1 step 5).

### Destructive write checklist (CLAUDE.md §12.11)
Operations touching existing rows:
- `lib/auth/context.ts` / `app/api/auth/verify-email/route.ts`:
  `prisma.user.update(...)`
1. **`where` matches:** the single User row linked (via
   `OAuthAccount.providerUserId`) to the verified Google-signed token's
   `uid` — i.e. the caller's own row only.
2. **Columns overwritten:** `emailVerified` (false→true only),
   `emailVerifiedAt` (null→now). System bookkeeping, never user-entered data.
3. **Guard:** write only fires when the cryptographically verified Firebase
   token carries `email_verified: true`; verified rows are never re-written.
User confirmation: NOT REQUIRED — one-way bookkeeping flip guarded by a
verified identity-provider claim; cannot clobber user-entered data.

### Documentation Updated
- `docs/operational/security/01_AUTHENTICATION.md` — new § Email Verification
  (flow, enforcement, resend, console diagnosis + optional action-URL config)
- `docs/operational/security/03_CDR_COMPLIANCE.md` — Pre-Consent Requirement:
  Verified Email
- `docs/operational/runbooks/11_EMAIL_NOTIFICATIONS_AUDIT.md` — path 1
  migrated Resend → Firebase; provider split updated (Resend: 0 paths)
- `docs/blueprint/PHASE_05_BACKEND_INTEGRATION.md` — §10 + status row +
  IMPLEMENTED-05-06 marked SUPERSEDED with pointers to current files
- `docs/IMPLEMENTATION_PLAN.md` — Recently Completed entry 2026-06-10
- `.stitch/SITE.md` §4 + `.stitch/metadata.json` — `verify-email-sent` screen
- `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md` — Recent Progress row
  (verified email = CDR pre-condition; strengthens §1, no scored row flips)
- `CLAUDE.md` §13.4 — verified-email pre-condition note on the elevated
  CDR guards (per §16.3 "Security / CDR-relevant change" row)

### Commit History
| Hash | Message |
|------|---------|
| 0a82f36 | feat(auth): email verification via GCP Identity Platform — soft gate + hard-block CDR |
| (next) | docs(cdr): compliance-matrix + CLAUDE.md §13.4 doc-sync for the verified-email gate |

### Build Status
| Step | Status | Notes |
|------|--------|-------|
| Initial state | n/a | fresh clone, no node_modules |
| Final build | PASS | `next build` ✓ — `/verify-email-sent` 2.81 kB in route map |
| Lint (changed files) | PASS | `next lint` 0 warnings/errors |

### Follow-ups / deferred
- Portal (`/portal/*`) registration sets `emailVerified: false` with a
  "Require email verification" comment but still has no gate — B2B flow,
  separate design system; queue separately.
- Branded verification email (Admin SDK `generateEmailVerificationLink` +
  provider) if Firebase-template deliverability disappoints.
- Operator step (Reza): optionally customise the GCP Identity Platform
  "Email address verification" template (sender name + action URL →
  `https://www.monitrax.com.au/verify-email`); default hosted handler works
  without it.

### PR
- PR URL: (added after push)
- Status: Open (draft)

---


## Session: gallant-gates-kb264m

### Changes Made
- **Type**: Enhancement (UX / layout architecture)
- **Scope**: Wealth Universe (desktop canvas, mobile hybrid, dashboard widget) — Phase 7 of workstream 0·WX, code tag `Phase WX.4`
- **Root Cause**: Reza report (desktop + mobile screenshots, 2026-06-10): *"the entities are so small specially when there are a number of them connected to the user it will become unreadable."* The layout placed every node in percentage coordinates inside fixed zones with fixed-pixel tile sizes and a fixed 9%-radius satellite arc — space constant, node count growing, overlap inevitable. The dashboard widget compounded it by rendering the ENTIRE graph at 0.42× scale inside a 340px card (an asset tile ≈ 22px with ~20px satellite spacing → tiles physically overlapped). The canvas zoom buttons were decorative — no handlers, hardcoded "100% · Universe" label.
- **Solution**: **Semantic zoom** (Apple Maps principle — what is shown changes with zoom level, not just how big it is):
  - **Level 1 · Universe (default)**: no asset satellites. `layoutWealthExplorer(snapshot, options?)` gains `assetDetail: 'collapsed' | 'all'` + `expandedEntityIds`. Entity/group tiles carry `assetSummary { count, totalValue }` rendered as a docked count-badge pill + accent "$X held" line. ~6 large legible tiles instead of 20+ tiny ones.
  - **Level 2 · Constellation**: selecting an entity unfolds its assets as satellites — one arc ≤ 6, two concentric rings beyond — with a staggered `wealth-satellite-pop` entrance (scoped `prefers-reduced-motion` fallback). Selecting the entity again / back-chevron / panel-close folds back to Level 1. Selecting a satellite keeps its constellation open.
  - **Mobile**: canvas renders collapsed Level 1 + tapped constellation; the bottom-sheet list keeps the full graph (`assetDetail: 'all'`) so granular asset browsing is untouched (filter-chip counts + "Holds N" pills read from the full graph).
  - **Dashboard widget**: Level 1 always (hook default). Tile scale 0.42 → 0.58. Footer total now sums raw `assetSummary` aggregates instead of re-parsing formatted display strings.
  - **Collision relaxation**: deterministic pairwise pass as the layout's final step (YOU anchor immovable; positions mutated in place, clamped to the canvas safe area). Safety net for crowded zones — aggregation is the primary mechanism.
  - **Dead chrome removed**: the non-functional zoom +/−/fit buttons deleted (§12.1). True viewport pan/zoom is a queued follow-up; buttons return only when they work.
  - **Financial-adviser-lens correction**: loan principal no longer counts toward "$X held" (in the per-entity line NOR the widget footer total) — debt is not held wealth. Loans still count in the badge (real holdings to explore).
- **Stitch-first (§18)**: 4 new screens generated in project `1859462351962811110`, seeded with the established Wealth Universe dark vocabulary — L1 desktop `770687a1c73c42f0b4fd5686782bf5f3`, L2 desktop `068403f1296440508b601c2fc32d5e20`, L1 mobile `e5ecb8d170cc4fbdbc336413cd9948d2`, widget `80c21d51c38242d883bec3d6875fabe6`. Artefacts committed at `.stitch/designs/wealth-universe-zoom/*.{html,png}`. PNGs shared with Reza in-session. Surface is dark-only by design (documented "premium-moment break") — deliberate, documented deviation from the §18.7.2 light+dark matrix.

### Files Modified
- `lib/data/wealthExplorerTypes.ts` — `WealthNode` gains `assetSummary`, `parentNodeId`, `isExpanded`; Stitch SoT header updated
- `lib/data/wealthExplorerLayout.ts` — `LayoutOptions` (collapsed default + `expandedEntityIds`), up-front asset grouping + `summarize()`, two-ring `placeSatellites`, `relaxCollisions()` pass, holds-ribbon scoping
- `components/wealth-explorer/WealthUniverseCanvas.tsx` — local layout memo w/ expansion state, `handleNodeClick`/`clearSelection`, count badge, satellite pop-in + stagger, zoom buttons removed, contextual hint copy
- `components/wealth-explorer/WealthUniverseMobile.tsx` — dual layout (collapsed canvas / full list), expansion on tap, count badge, satellite pop-in, scoped reduced-motion
- `components/wealth-explorer/WealthUniverseWidget.tsx` — scale 0.58, count badges, footer total from raw aggregates
- `tests/wealth-explorer/semanticZoomLayout.test.ts` — NEW, 11 tests pinning the layout contract
- `.stitch/designs/wealth-universe-zoom/*.{html,png}` — NEW, 8 committed Stitch artefacts

### Documentation Updated
- `docs/architecture/06_UI_UX_FOUNDATION.md` — new "Semantic zoom (Phase WX.4)" section in the Wealth Universe Explorer pattern; data-flow chain updated; ZoomControls component row struck through with rationale
- `docs/IMPLEMENTATION_PLAN.md` — workstream 0·WX: Phase 7 entry added, status/last-touched updated
- `docs/changelog/CHANGELOG_2026_06_10.md` — this entry

### Build Status
- [x] TypeScript compilation passes (`next build` clean)
- [x] Build passes (`npm run build`)
- [x] Lint passes on changed files (0 errors, 0 warnings after `useMemo` wrapping)
- [x] Tests pass — 11 new (`tests/wealth-explorer/`) + 66 neighbouring (`tests/wealth-graph/`, `tests/entity-graph/`) all green

### Commit History
| Hash | Message |
|------|---------|
| 54afa81 | feat(wealth-universe): semantic zoom — Level 1 entity aggregation + Level 2 constellation unfold |
| (this) | docs(changelog): commit-history table |

### Notes / Known follow-ups
- True viewport pan/zoom (pinch / scroll / fit-to-view) intentionally deferred — only if semantic zoom proves insufficient at real user node counts.
- Mobile filter chips for asset types (Properties / Cash / …) still drive the bottom-sheet list; on the Level 1 canvas they dim all entity tiles (no asset tiles to match). Acceptable v1 — list shows the matches. Revisit if confusing in practice.

---

## Session: gallant-gates-kb264m (continuation — Phase WX.4.1 cluster level)

### Changes Made
- **Type**: Fix (UX over-aggregation regression, caught by Reza minutes after the Phase 7 prod deploy)
- **Scope**: Wealth Universe layout — cluster level for ≤2-entity universes
- **Root Cause**: Phase 7 entity-level collapse assumed entities to collapse INTO. Reza's structure (and most users pre-trust) has ONE personal entity holding everything directly — so the whole universe rendered as a single YOU tile with a "19" count badge (mobile screenshot evidence). Technically correct aggregation, useless surface.
- **Solution**: With ≤2 entities, Level 1 clusters each entity's holdings BY TYPE into aggregate tiles ("3 Properties · $2.1M", loans read "$600K owing" never "held"), fanned in the upper arc above the anchor. Singleton kinds render the real asset directly (a cluster of one is noise). Tapping a cluster unfolds that type's assets via the same expansion mechanic; clusters never open the entity detail panel. The entity keeps its "$X held" total line, drops the redundant badge. Canvas rule codified: **always target the 3–9 tile sweet spot — the layout picks the aggregation level that achieves it** (entity collapse ≥3 entities, type clusters ≤2). No Stitch pass — the cluster tile reuses the established L1 aggregate-tile vocabulary verbatim (count badge + value line); zero new visual primitives.

### Files Modified
- `lib/data/wealthExplorerTypes.ts` — `tier` union gains `'cluster'`
- `lib/data/wealthExplorerLayout.ts` — `CLUSTER_MODE_MAX_ENTITIES = 2` dispatch, `fanAbove()` upper-arc placement, cluster node emission + cluster-scoped holds ribbons, `clusterLabel`/`clusterShortLabel` warm-words helpers, entity badge suppression in cluster mode
- `components/wealth-explorer/WealthUniverseCanvas.tsx` — detail panel guarded against cluster selection
- `components/wealth-explorer/WealthUniverseMobile.tsx` — tap lookup resolves canvas nodes first (clusters don't exist in the list layout)
- `components/wealth-explorer/WealthUniverseWidget.tsx` — chip reads "19 holdings" / "N entities · M holdings" (was "N nodes"); footer total sums entity-tier aggregates only (clusters are sub-totals — double-count guard); dead `parseValueToNumber` deleted (§12.1)
- `tests/wealth-explorer/semanticZoomLayout.test.ts` — 6 new cluster-level tests (17 total); two-ring fixture moved to 3 entities to stay on the entity-collapse path

### Build Status
- [x] Build passes (`npm run build`)
- [x] Lint passes (changed files, 0 problems)
- [x] Tests pass — 17/17 in `tests/wealth-explorer/`

### Commit History
| Hash | Message |
|------|---------|
| ee92786 | fix(wealth-universe): cluster level — type aggregation for single-entity universes |

---

## Session: gallant-gates-kb264m (continuation 2 — Phase 47 design)

### Changes Made
- **Type**: Research + phase design (docs only — no code)
- **Scope**: Entity Ownership Fabric — Reza directive for the "golden feature": full portfolio capture under the entity universe, with tax/dashboard/reports consuming the relationships
- **Work done**: Full-codebase ownership audit (schema, write paths, wealth graph, masterFinancialService, reports, tax engine — file:line evidence) + new phase doc `PHASE_47_ENTITY_OWNERSHIP_FABRIC.md` (v1, 🟡 DESIGN). Audit headline: model layer ~complete (Phase 44 Part 1) but ownership is **un-capturable from the UI** (auto-assigns PERSONAL_NAME, immutable, no picker anywhere), **incomplete** for retail/industry super (nullable, unselected in wealth graph) and **ignored** by every aggregation surface except the Wealth Universe canvas (master snapshot + reports flat-sum per user; tax engine per-entity-ready but starved of assembled facts — the gap Phase 44 Part 2 designed for and never built).
- **Plan shape**: five gated, non-breaking stages — A Capture → B Complete → C Consume → D Compute (= execute review-gated Phase 44 Part 2) → E Report. Golden tests pin flat household totals each stage; progressive disclosure below 2 entities; "correct the record ≠ transfer the asset" framing on all re-attribution (a real transfer is a CGT event — a casual move-to-trust button would be a tax trap).
- **Decisions raised**: Open Questions Q-EOF-1…5 with recommendations (correction-only v1; retail super → personal member entity; derived ownership for holdings/txns; household-flat default with opt-in entity lens; Stage D after Stage C).

### Files Modified
- `docs/blueprint/PHASE_47_ENTITY_OWNERSHIP_FABRIC.md` — NEW phase doc
- `docs/IMPLEMENTATION_PLAN.md` — new workstream 0·EOF + Open Questions Q-EOF-1…5
- `docs/changelog/CHANGELOG_2026_06_10.md` — this entry

### Stage A first build (same day — "v2 is good, ship it")
- **Design loop**: picker v1 rejected by Reza (design-principles drift — Stitch editorial defaults). v2 re-driven from the canonical Phase 45.2.5 glass dialog via `generate_variants` REFINE (the documented Phase 45.2.1 anti-drift lesson); Reza approved. Artefacts `.stitch/designs/phase47/ownership-picker-property-joint-v{1,2}.{html,png}`, v2 screen `8e6fc018886e4d54b18abff0f7c80c13`.
- **Build (PR after #1041)**:
  - `lib/services/ownershipSelectionService.ts` — NEW canonical translation layer (picker selection → `ownerEntityId` / `OwnershipGroup`+stakes): `parseOwnershipSelection` (loud validation; absent = sole), `buildStakes` (joint = equal + survivorship on every stake per TR 93/32; shared = explicit TIC fractions), `resolveOwnerEntityIdForSelection` (entity mode validated against userId), `applyOwnershipSelection` (INDIVIDUAL quick-create for named co-owners → group via `ownershipService`; failure leaves the object soly-owned + warning, never a partial group).
  - `components/ownership/OwnershipPicker.tsx` — NEW shared component (§4A picker, v2 design port): 2×2 glass choice cards, joint household-member chips + add-someone, shared % rows with emerald-on-100% total check, entity dropdown with warm type labels, progressive disclosure (entity card hidden when no trust/company/SMSF exists).
  - `app/api/properties/route.ts` — POST accepts optional `ownership` payload; `_meta.ownershipWarnings` surfaced; audit metadata gains `ownershipMode`; unused default-entity import removed.
  - `app/dashboard/properties/page.tsx` — picker rendered in Add-property dialog (create only, non-RENTAL); gradient CTA per v2; ownership state reset with form.
  - `tests/ownership/ownershipSelection.test.ts` — NEW, 13 tests pinning the §4A parsing/stake contract.
- Build PASS, lint clean (1 pre-existing warning), 13/13 new tests + neighbouring suites green.
- **Visibility follow-up (Reza: "all of these should be visually presented under Wealth Universe in dashboard and my structure page")** — `wealthExplorerLayout.ts`: INDIVIDUAL co-owner entities now classify+place as PEOPLE in the personal band beside YOU (they fell into the corporate bucket and rendered as companies); PERSONAL_NAME explicitly sorted first so a co-owner can never steal the anchor ring; ownership-group nodes carry the Level 1 "$X held" aggregate + warm naming ("Joint"/"Shared", never "Tenants in common"). 4 new tests pin the §4A visibility contract. Widget inherits automatically (same layout function).

### Stage A1 rollout — picker on all group-capable create surfaces (same day)
- **Routes** (uniform pattern via new `resolveOwnershipForCreate` helper): `app/api/accounts`, `app/api/investments/accounts`, `app/api/assets`, `app/api/loans` POST now accept the `ownership` payload (absent = sole, unchanged); joint/shared apply the OwnershipGroup after create; audit metadata gains `ownershipMode`; warnings in `_meta`.
- **Forms**: `components/accounts/AccountFormDialog.tsx`, `components/loans/LoanFormDialog.tsx`, `app/dashboard/investments/accounts/page.tsx`, `app/dashboard/assets/page.tsx` — picker rendered create-only, ownership state reset with each dialog open/reset.
- All five group-capable object types (property/loan/account/investmentAccount/asset — the `VALID_OWNED_OBJECT_TYPES` set) now capture ownership at creation. Income/Expense entity-only attribution deferred (streams follow their asset's title; §4A P5).
- Build PASS, lint 0 errors (2 pre-existing warnings), 34/34 tests.

### Build sweep + dedup fix (same day — Reza: "I don't want anything to be missed out")
- Gap review codified as **§4B (D1–D9)** in the phase doc — every build-discovered item is FIXED, QUEUED into a stage, or PARKED with a trigger.
- **D1 fixed**: `applyOwnershipSelection` now reuses an existing INDIVIDUAL entity (case-insensitive name match) before quick-creating — a second joint asset with "Sarah" no longer fragments her into duplicate universe tiles. Picker surfaces existing INDIVIDUAL entities as joint chips (deduped against household members).
- **D9 process note**: financial-surfaces lint baseline must be rebased in the same PR as any form insertion (hit on PR #1043's preview; fixed by shifting 4 grandfathered entries +8 lines).

### D2/D3 decided + onboarding note (same day)
- **D2 (Reza)**: ownership capture stays OUT of onboarding — wizard stays light. `ReviewStep` gains a quiet forward-looking note ("Everything you've added is recorded in your name for now… set who owns each item anytime") — invitation framing, never a missing-step warning. Stage A5 closed as decided-out.
- **D3 (Reza: "go with your recommendation")**: no Income/Expense picker v1; attribution derives from the owning asset's stakes in Stage C/D.
- All other tactical decisions delegated to Claude.

### Stage A FINAL — A2 correction flow + A3 bulk re-attribution + A4 entity hook (single PR per Reza cadence decision)
- **A2**: NEW `correctOwnershipRecord` in `ownershipSelectionService` (Q-EOF-1 correction-never-transfer; §12.11: `where {id,userId}` composite, only `ownerEntityId` touched; existing groups hard-deleted via the canonical "mistaken entry" path; `OWNERSHIP_RECORD_CORRECTED` audit with reason). NEW generic `PATCH /api/ownership/[objectType]/[objectId]` (one endpoint, one concern). NEW `CorrectOwnershipDialog` (design SoT screen `ce11109f…`: picker + reason + amber correction-≠-transfer notice) wired into ALL five edit surfaces via a quiet "Recorded under the wrong owner?" link.
- **A3+A4**: NEW `BulkAssignDialog` ("Does {entity} own any of these?" — grouped checkbox list across all five object types, PATCH per item with audit trail); auto-offered on the entities page right after a structure entity is created (A4 hook), single surface instead of five list-page multi-selects.
- **D9 recurrence**: investments-page baseline rebased +3 lines (same process note).
- Build PASS, financial gate ✓, lint 0 errors (3 pre-existing warnings), 34/34 tests.

### Decisions (same day)
- **Q-EOF-1…5 ✅ DECIDED 2026-06-10** — Reza: *"go with your recommended"* (all five per recommendation).
- **Scope addition (Reza)**: personal & joint ownership capture must be first-class for users with no company/trust — "very complete" against Australian tax/property law. Codified as the binding **§4A personal-tier completeness matrix** in the phase doc v2: P1 sole, P2 joint tenants (TR 93/32 50/50 split regardless of contribution + survivorship), P3 tenants in common (fractional shares), P4 co-ownership-≠-partnership guard (rental co-owners are a tax-law partnership only — UI must never push a PARTNERSHIP entity), P5 spousal attribution, P6 minor/Div 6AA flag, P7 deceased estate, P8 nominee/bare trust, P9 exotic forms flagged `unsupportedStructure` (honest UNCOMPUTED). Stage A's picker is an OWNERSHIP picker ("Just me / Joint with Sarah / Shared 70/30 / Another entity") with inline joint quick-create — warm words, no model jargon.
- Workstream 0·EOF flipped 🟡 DESIGN → 🟢 ACTIVE; Stage A unblocked (next: Stitch pass for the ownership picker).

---

## Session: qif-import-gemini-429-resilience (claude/serene-goodall-6smazx)

### Changes Made
- **Type**: Fix (prod — QIF import "completes" but imports zero transactions)
- **Scope**: `lib/ai/google/geminiClient.ts`, `lib/bank/aiCategorisation.ts`, `app/api/accounts/[id]/import/route.ts`, `components/bank/TransactionImportDialog.tsx`
- **Root Cause** (diagnosed from prod Vercel runtime logs per §17.3): User imported a QIF
  file twice (`POST /api/accounts/0b89bef6…/import` 07:51:19 UTC, `POST /api/accounts/new/import`
  07:56:00 UTC, both HTTP 200). Full-text log queries for `"Gemini"`, `"failed"`, `"429"` and
  `"Too Many Requests"` all match exactly those two requests (and nothing else in the window) —
  the Gemini categorisation calls were **rate-limited (HTTP 429 Too Many Requests)**. Chain:
  1. The Gemini key (GCP project `Monitrax`) serves on **free-tier quota** (~15 req/min for
     flash models). A QIF import fires one Gemini call per 20 transactions back-to-back.
  2. `geminiClient.ts` had **zero 429 handling** — 404/JSON errors fell through to fallback
     models, but 429 hit the "throw immediately" branch. No retry, no backoff.
  3. `categoriseInBatches` had no per-batch error isolation — one failed batch discarded ALL
     results, including from batches that succeeded.
  4. PR #959's graceful fallback (2026-06-01 incident) then assigned confidence 0 to every
     transaction → all classified `requiresManual` → diverted to `TransactionReviewQueue`
     (which has NO live UI — `TransactionReviewPanel` is imported by zero files) →
     `importedCount: 0` → the dialog showed a green "Import Complete!" with the
     `requiresManual` count hidden. Silent zero-import.
  - Related earlier incident: PR #959 (2026-06-01) fixed the same upstream class (Gemini
    throwing 500s on import) — that fix made the failure *non-fatal* but also *silent*.
- **Solution** (defence in depth — AI categorisation is enrichment, never a gate):
  1. **`geminiClient.ts`** — new `withModelFallbackAndRetry()` shared by JSON + text paths:
     retriable errors (429/503/quota/network) get exponential backoff (1s/2s/4s + jitter,
     3 attempts per model) before falling through to the next fallback model; failures now
     log at `console.error` (were `console.log`).
  2. **`aiCategorisation.ts`** — `categoriseInBatches` isolates per-batch failures (a failed
     batch falls back to uncategorised for THAT batch only; successful batches keep their
     results) and reports `degraded`/`failedBatches`. `categoriseWithLearning` propagates
     `degraded`/`degradedReason`; the previously-SILENT "Gemini unconfigured" branch now
     logs `console.error`. Shared `buildUncategorisedResults()` helper hoisted to module scope.
  3. **Import route** — logs a loud `[import] AI categorisation DEGRADED…` error line with
     classification counts; response gains `aiDegraded` + `aiDegradedReason`.
  4. **`TransactionImportDialog`** — completion screen now shows the previously-hidden
     `requiresManual` count ("Needs Categorising" tile), shows an amber "Import received —
     action needed" header instead of green "Import Complete!" when AI degraded with 0
     imported, and an alert explaining the held transactions + that re-importing the same
     file is safe (duplicates are skipped).
- **Operator action (Reza, GCP)**: upgrade the `Monitrax` GCP project to paid-tier Gemini
  quota — see runbook `docs/operational/admin/02_ADMIN_TROUBLESHOOTING_RUNBOOK.md`
  § "QIF import completes but no transactions appear". The 2026-05-19 key restrictions
  (Production Readiness item 13) are NOT the culprit (error is 429 quota, not 403 referrer)
  and stay as-is.
- **User-side recovery**: the affected user's transactions are NOT lost — they sit in
  `TransactionReviewQueue` (one copy per attempt). After the quota upgrade, re-importing the
  same QIF file works: the file-hash 409 guard only blocks `COMPLETED` batches (these are
  `AWAITING_REVIEW`) and duplicate detection only checks created `UnifiedTransaction` rows.

### Files Modified
- `lib/ai/google/geminiClient.ts` — retry/backoff policy + shared fallback loop (dedupes the two copy-pasted loops)
- `lib/bank/aiCategorisation.ts` — per-batch failure isolation, degraded propagation, loud unconfigured logging
- `app/api/accounts/[id]/import/route.ts` — degraded logging + `aiDegraded` in response
- `components/bank/TransactionImportDialog.tsx` — honest completion screen (requiresManual tile, degraded alert, amber header)

### Build Status
- [x] TypeScript compilation passes (`tsc --noEmit`, 0 errors)
- [x] Build passes (`npm run build` — ✓ Compiled successfully)
- [x] Tests pass (`vitest run tests/bookkeeping` — 253/253 green)
- [x] Lint: no NEW violations in touched files (`TransactionImportDialog.tsx:793` unescaped-quote errors are pre-existing text that shifted line numbers; 99 pre-existing errors codebase-wide, untouched)

### Diagnosis evidence (§17.3)
- `mcp__Vercel__get_runtime_logs` window 07:50–07:58 UTC: queries `"Gemini"` / `"failed"` /
  `"429"` / `"Too Many Requests"` each match exactly the two import POSTs; `"RESOURCE_EXHAUSTED"`,
  `"referrer"`, `"quota"` match nothing → SDK-formatted `429 Too Many Requests`, not a
  referrer 403 and not a missing key (`isGeminiConfigured()` true — `[Gemini]` lines present).
- Dead-end ruled out: `parseQIF` returning 0 transactions returns HTTP 400 — user saw success,
  so parsing was fine.

### Tech debt logged (IMPLEMENTATION_PLAN §🗑️ rows 31–32)
- `TransactionReviewQueue` black hole: `TransactionReviewPanel.tsx` orphaned (zero importers,
  contradicting Phase 36 doc claim), review API route has no page, `reviewUrl` points at a
  non-existent route. Structural fix proposal logged as Open Question Q-IMPORT-1.
- Duplicate Gemini clients: `lib/ai/gemini.ts` vs `lib/ai/google/geminiClient.ts` (SSOT
  violation; only the latter got the retry hardening).
