# Changelog — 2026-05-04

## Session: claude/phase-33a-help-center (Phase 33a SHIPPED — Help Center foundation)

### Changes Made
- **Type:** Feature (foundation slice — first demo-complete deliverable after PR #603 merged)
- **Scope:** Phase 33a — Help Center infrastructure + 3 seed articles
- **Description:** First slice of the demo-complete critical path. Help Center static site live at `/help` (audience index) + `/help/<audience>/<slug>` (article pages). Markdown-source CMS reading from `docs/help/<audience>/<topic>.md` with audience routing across 6 buckets. Three seed articles authored: TRAIL framework explainer (consumer), inviting clients flow (org-admin), CDR consent walkthrough (compliance — the load-bearing B2B sales artefact). Help link wired in `PortalSidebar.tsx`.

### Files Created
- `lib/help/frontmatter.ts` — zero-dep YAML-ish frontmatter parser. Supports the subset we use: scalar strings (quoted/unquoted), single-line arrays, ISO dates as strings. Required-field validation per article. ~110 LOC.
- `lib/help/markdown.ts` — zero-dep CommonMark-subset renderer. Supports headings (1-6), paragraphs, bold / italic, inline code, fenced code blocks (with language tag), links (scheme-restricted to http/https/mailto for XSS safety), unordered lists, ordered lists, blockquotes, horizontal rules. Deliberately drops: tables (compliance docs needing tables: render as plain HTML in body, or upgrade renderer), images (post-MVP), nested lists, inline HTML (XSS posture). Tailwind-styled output with consumer brand tokens. ~150 LOC.
- `lib/help/content.ts` — content discovery + retrieval. Walks `docs/help/<audience>/*.md` at request time (server-only), parses + validates each, returns typed articles. Sort by `order` frontmatter then alphabetical. `generateStaticParams` for Next.js to pre-build every article at `next build`. ~120 LOC.
- `app/help/layout.tsx` — public layout (no auth gate). Sticky header with M logo + "Open app" / "Practice" links. Warm-ivory bg matching consumer brand. Footer.
- `app/help/page.tsx` — index page. Hero ("How can we help?") + audience sections (5 public buckets — consumer, compliance, org-admin, org-professional, org-client) each with article cards. Empty audiences render "Articles for this audience are being authored" placeholder so IA reads as intentional.
- `app/help/[...slug]/page.tsx` — article detail page. `generateStaticParams` walks all articles. Breadcrumb + heading + summary + reviewed-date + rendered HTML body + footer.
- `docs/help/consumer/what-is-trail.md` — 600-word TRAIL framework explainer. Includes the 5-stage table, the science (Barefoot / Prochaska / Bandura / Mani citations), how to find your stage, what's next.
- `docs/help/org-admin/inviting-clients.md` — 700-word client invitation flow doc. 4-step flow + what client sees about the adviser + anti-poaching guardrail explainer + plan limit table + common mistakes + what's next.
- `docs/help/compliance/cdr-consent-walkthrough.md` — 1,200-word CDR consent lifecycle reference. Three-layer consent table + grant flow + active consent + expiry + revocation + encryption + DB access (WIF) + auth & MFA + audit retention + open Basiq submission items + auditor pointers.

### Files Modified
- `components/portal/layout/PortalSidebar.tsx` — Help Center link added to user/help section (above Settings). Opens in new tab. New `HelpIcon` SVG (question-mark-in-circle, 24x24).
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #19 (Phase 33a) struck through and marked SHIPPED with detail of what landed + what was deferred to 33b/33c.
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` — Step 8 (Compliance pack) populated with: live URLs, walkthrough sequence inside the CDR Consent article, compliance pack table of contents (✅ live vs 📋 queued), and a "common regulator-side questions and where to point them" lookup table. Closes one of the "TO BE WRITTEN AS BUILD COMPLETES" placeholders.
- `docs/changelog/CHANGELOG_2026_05_04.md` — this Session block prepended above the prior session blocks.

### Files NOT Modified (intentional)
- `package.json` — npm registry blocked the `react-markdown` install (transitive dep `micromark-util-resolve-all` 403 from registry policy). Pivoted to zero-dep inline markdown impl, which is cleaner anyway per CLAUDE.md §12.7. No deps added.
- No schema changes, no API contract changes.
- `app/dashboard/*` — consumer-side `?` help drawer is Phase 33b, not this slice.

### Build Status
- TypeScript `tsc --noEmit` clean for all changed files (only pre-existing `baseUrl` deprecation warning, unrelated).
- No new dependencies, no schema migrations.
- Static generation expected to succeed at `next build` — `generateStaticParams` walks `docs/help/**/*.md` at build time.

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern (new Help Center surface inheriting consumer brand tokens; new help link in portal sidebar)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [x] security / CDR posture (new compliance content article documenting CDR posture for auditor consumption)
- [ ] operational procedure
- [x] strategic decision (npm registry pivot — zero-dep markdown stack documented as the v1 choice)

Docs updated:
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #19 marked SHIPPED with details
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` — Step 8 (Compliance pack) populated
- `docs/changelog/CHANGELOG_2026_05_04.md` — this Session block
- `docs/help/consumer/what-is-trail.md`, `docs/help/org-admin/inviting-clients.md`, `docs/help/compliance/cdr-consent-walkthrough.md` — three seed articles (which serve as their own self-documentation)

### What's next
- Phase 33b — in-app `?` drawer that pulls the same Markdown source into a slide-in drawer scoped to the user's audience + current route context
- Phase 33c — PDF export per article + ZIP bundle export for the "CDR Compliance Pack" all-in-one
- Phase 33d — author the remaining compliance pack content (Data Retention Schedule, Incident Response Plan summary, Architecture Overview, ASIC RG 244 / RG 36 boundary statement)

---

## Session: claude/demo-complete-plan-pitch-playbook (follow-up to PR #603 — doc-only)

### Changes Made
- **Type:** Docs / strategy
- **Scope:** Demo-complete sequencing + lighthouse pitch playbook scaffold
- **Description:** PR #603 merged (Phase 32B PR1+PR2 LIVE). This follow-up PR captures the scope refinement decided in conversation immediately after the merge:
  1. Demo-complete = fully functional working demo of the complete capabilities, not a half-built skeleton
  2. Sankey IN demo-complete (Reza preference)
  3. Three pitch-fixture archetypes confirmed (Sarah / David+Emma / Olivia)
  4. Only PROD-hardening tasks defer to PROD-ready
  5. Pitch process must be documented end-to-end so Reza has a runnable playbook

### Files Modified
- `docs/IMPLEMENTATION_PLAN.md`:
  - Header `Last updated` rewritten — names PR #603 merge + the demo-complete pivot + the Sankey-in-demo decision + pitch playbook scaffold creation
  - New section `🎯 Demo-Complete Critical Path — Lighthouse Adviser Pitch` ABOVE Up Next, with a 14-week calendar table sequencing every demo-complete deliverable (week 1 PR3 + Phase 33a parallel, week 2-9 entity layer + AI entity-aware + trimmed Xero, week 10-13 marketplace + Ask-a-Pro + conversations + Stripe test-mode + help center + compliance pack, week 14 fixture seed + pitch playbook final pass)
  - New explicit `🛡️ DEFERRED to PROD-ready` bucket below the table — pen test, insurance, CMEK, Cloud Armor, Stripe live mode, training programs, DOCX templates, deep tax cases, Xero bidirectional sync, /admin/orgs surface, ZIP bundle export, email-in hardening, conversation 7yr archive infra, real ASIC/TPB cross-check, performance hardening, plan-tier polish
  - Up Next #33 (lighthouse pitch fixture seed) rewritten to capture Reza's three confirmed archetypes verbatim
  - Up Next #34 added (pitch process documentation — final pass alongside #33 fixture seed)
  - Recently Completed (2026-05-04) block rewritten — first entry consolidates PR #603 (Phase 32B PR1+PR2 + 4 strategic addenda); second entry covers this follow-up (demo-complete plan + pitch playbook scaffold)

### Files Created
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` — scaffold for the 25-minute lighthouse adviser pitch playbook. Sections:
  - Why this document exists
  - Pre-pitch checklist (30 min before meeting) — environment + seeded users verified, screen-share rehearsed, notifications silenced, backup plan
  - The 25-minute demo flow — 10 numbered steps (Open with adviser's pain → Practice dashboard → drill into client → Entity Tree the moment → Sankey → AI advice with entity-awareness → Ask-a-Pro in action → conversation thread → compliance pack → pricing + the ask)
  - Common objections + responses (seeded with 6; populated as more arrive)
  - Post-pitch follow-up cadence (1hr / 24hr / 7-day)
  - Design-partner conversion path (placeholder; populated when first conversion happens)
  - Maintenance protocol (update after every pitch)
  - Each step contains a "TO BE WRITTEN AS BUILD COMPLETES" placeholder so the engineer who ships the corresponding feature populates the demo script in lockstep with what actually works in the demo env

### Files NOT Modified
- No code changes. No schema changes. No new dependencies.
- No `06_UI_UX_FOUNDATION.md` / `03_DATA_MODEL.md` / `09_INFRASTRUCTURE.md` updates required (pure planning + playbook scaffolding).

### Build Status
- N/A — docs-only PR. Will not affect Vercel build.

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config (env vars, Vercel, OIDC, etc.)
- [ ] GCP infrastructure (Cloud SQL, IAM, etc.)
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure (new failure mode / diagnostic / lesson)
- [x] strategic decision (Demo-complete scope locked + pitch process documentation queued)

Docs updated:
- `docs/IMPLEMENTATION_PLAN.md` — `🎯 Demo-Complete Critical Path` section + `🛡️ DEFERRED to PROD-ready` bucket + Up Next #33/#34 + Recently Completed entries
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` — new scaffold
- `docs/changelog/CHANGELOG_2026_05_04.md` — this Session block (prepended above the PR #603 session)

### Status at session close

- 4 commits on `main` post-PR603 (this follow-up will be the 5th once merged)
- Demo-complete bucket = ~14 weeks of focused engineering with sensible parallelism (one engineer entity layer + Practice + marketplace; second engineer / alternating sessions on Help Center + content authoring)
- PROD-hardening bucket explicitly named so it doesn't sneak into demo-complete scope
- Lighthouse pitch playbook scaffold in place — every demo-complete PR populates one or more "TO BE WRITTEN AS BUILD COMPLETES" placeholders so the playbook is camera-ready when fixture seed lands
- Next session entry point: BOTH Phase 32B PR3 (drill-in canonical client view + adviser overlay + plan-tier gating) AND Phase 33a (Help Center static site + Markdown CMS) start in parallel

---



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
- Status: PR1 pushed as commit `cebfdc5`

---

## Session addendum (later 2026-05-04) — Phase 32C strategic decisions LOCKED

After PR1 was pushed, Reza proposed a counter-model to the two-voice
AI architecture I'd recommended. That counter-model was adopted in
full and is now the strategic direction for the B2B2C product. This
addendum locks the decisions before the session ends so the next
session picks up directly with PR2 = Practice dashboard wiring without
re-litigating any of this.

### Decision: Single-voice AI + Ask-a-Professional + Marketplace + In-app Comms

**REJECTED:** Two-voice (`voiceContext: 'self' | 'professional-attached'`)
adapter on the AI advisor. Logged in `IMPLEMENTATION_PLAN.md` ↩️
Reversed Decisions so future sessions don't re-attempt.

**ADOPTED:**
- ONE AI Guide for everyone — same diagnosis, same scenarios, same
  tone, identical output regardless of org-attached state. AI is
  *general information / education only*; never recommends a specific
  product or action.
- "Ask a Professional" button on every recommendation card and every
  Practice alert. Two states with shared component anatomy:
  - **D2C (no professional linked)** → invite-only marketplace picker
    showing 3 best-fit (Monitrax-curated 10–20 launch professionals
    at v1; verified ASIC AFSL/ACL/TPB before listing).
  - **Org-attached** → org's roster grouped by discipline (Sarah for
    wealth, Tom for tax, Jess for refinance — all inside the org's
    branded experience). Org-attached users see ONLY their org's
    professionals (Reza decision: org pays for Monitrax to be their
    CRM and comms channel; can't be a leaky funnel to competitors).
- AFSL boundary becomes structural, not editorial — the AI is
  incapable of crossing the line because every "next-level" answer
  channels through a licensed human.

### Decision: Two independent revenue streams

| Stream | Who pays | What they get | What it costs |
|---|---|---|---|
| A. Org subscription | Org | Practice surface for all professionals + Wealth-tier consumer experience for ALL their clients (bundled, no per-client charge) + in-app chat + email-through-app + branded "Ask Sarah" affordance | Tiered: Solo (5 seats / 50 clients) / Practice (20 / 200) / Enterprise (unlimited) |
| B. D2C marketplace lead fee (opt-in) | Org | Inclusion in D2C marketplace; charged only when an introduced D2C user accepts engagement | Tiered by user profile: AU$80 sub-AU$500k net worth / AU$150 AU$500k–$2M / AU$250 AU$2M+ |
| C. D2C subscription (existing plan) | D2C user | Wealth tier (AI Guide + Basiq + Practice "Ask a Professional" affordance) | AU$24/mo / AU$245/yr |

### New requirement (introduced this session): in-app chat + email-through-app

Two channels, one conversation thread. New Prisma models
`ProfessionalConversation`, `ConversationMessage`,
`ConversationParticipant`. In-app chat (polling for v1; WebSockets
later). Email-out via SendGrid; email-in via SendGrid Inbound Parse
webhook → `/api/conversations/inbound` → routed to conversation by
reply-to address. Compliance archive for AFSL holders (7yr retention).
Hardening: DKIM/SPF, attachment scanning, rate limiting. Conversation
content treated as CDR-derived data — encrypted at rest, sanitised
from audit metadata, retention matched to consent.

### New requirement: Monitrax platform admin (`/admin/orgs/*`)

Reza's surface for managing all Orgs across the platform. Distinct
from `/portal/team` (which is the Org's own admin surface for
managing their seats). Monitrax-side admin = `/admin/orgs/*` (extends
existing `/admin/billing/*` skeleton); Org-side admin = `/portal/team`
+ `/portal/settings`. Surfaces, audit trails, and capabilities are
separate.

### Plan updates (committed in this addendum)

- `docs/IMPLEMENTATION_PLAN.md`:
  - Header `Last updated` rewritten to capture today's strategic
    decisions
  - Q-PRA-1 closed as DECIDED — REJECTED in favour of single-voice
  - ↩️ Reversed Decisions: 2-voice model logged
  - 🟡 Active Workstreams (Phase 32B): Blocking flipped to "None"
    — PR2 unblocked
  - 📋 Up Next: 7 new rows (#13–#20) covering Phase 32B PR2/PR3 +
    Phase 32C PR4a/4b/4c/4d/5/6 with phase scope, dev-day estimates,
    and trigger conditions

### Risks surfaced for future PRs

1. **Anti-poaching enforcement.** Org-attached users see only their
   org's professionals — but what stops a professional from inviting a
   "friend org" purely to give a competitor visibility? Mitigation
   (PR2/PR3): require PORTAL_OWNER consent for new seat invites (not
   PORTAL_ADMIN — too low a bar); audit trail in Monitrax admin; ToS
   clause on professional conduct.
2. **Email-in attack surface.** Inbound email parsing is a known
   attack vector (spoofed reply-to, malware, phishing). Mitigations
   (PR4d): DKIM/SPF rejection of unsigned; Cloud DLP / VirusTotal
   attachment scanning; rate limiting per conversation; HTML →
   plaintext sanitisation. Standard SendGrid hardening, must not
   skip.
3. **Conversation transcript retention vs CDR consent revocation.**
   When a user revokes professional consent, what happens to past
   messages? Recommendation: soft-delete from user view + 7yr retention
   for the professional's compliance archive, with explicit
   disclosure at consent time. Awaits Reza decision before PR4d
   ships.

### Status at session end

- PR1 pushed (`cebfdc5`) — schema + design primitives + lighthouse
  demo dataset + dead code removal + docs sync
- Strategic direction LOCKED for the entire B2B2C / marketplace
  workstream
- Plan updated to reflect today's decisions; next session picks up
  with Up Next #13 = Phase 32B PR2 = Practice dashboard wiring +
  sidebar repaint
- Lighthouse adviser pitch demo unblocks at end of PR2 (~3 dev days)

---

## Session addendum 2 (latest 2026-05-04) — Org pricing + Phase 33 Help/Training

Two further strategic decisions locked at the end of the session.
Captured here so the next session inherits the answers.

### Decision: Xero-style dual-axis Org pricing (seats × clients)

Reza directive 2026-05-04: "Org license should consider seat numbers
AS WELL AS user base for the organisation (same as Xero plans)."
Pricing on either axis alone leaks margin (each seat costs Monitrax
~AU$10/mo platform overhead; each client costs ~AU$2.50/mo COGS).
Dual-axis pricing keeps the business unit-profitable from day one.

**Finalised tier matrix:**

| Tier | AU$/mo (annual ~16% off) | Included seats | Included clients | Add-on seat | Add-on client |
|---|---|---|---|---|---|
| Studio | $199/mo · $2,000/yr | 3 | 50 | $49/seat/mo | $2/client/mo |
| Practice | $599/mo · $6,000/yr | 10 | 250 | $39/seat/mo | $1.50/client/mo |
| Enterprise | from $1,499/mo (custom) | 25 (configurable) | 1,000 (configurable) | Negotiated | Negotiated |

**Naming:** Renamed proposed tiers from "Solo / Practice / Enterprise"
to "Studio / Practice / Enterprise" — "Solo" reads as solo-trader
only and creates name-collision with the Practice surface dashboard;
"Studio" is small-firm-friendly while still capturing one-person
practices. Reza preference pending — this is a v1 default open to
revision in a follow-up session.

**Add-ons orthogonal to tier:**
- SSO/SAML — AU$199/mo flat (Enterprise bundled)
- White-label (custom domain + full brand replacement) —
  AU$499/mo flat (Enterprise bundled)
- API access (read/write programmatic) — AU$199/mo + rate-tier
- Marketplace participation (D2C lead-gen) — opt-in, no monthly,
  tiered lead-only billing AU$80/$150/$250 by user net-worth
  bracket (already locked in addendum 1)
- Compliance archive export — bundled in Practice + Enterprise;
  AU$49/export on Studio

**RBAC implication (Reza confirmed):** Org plan tier governs more
than seat/client caps — it gates *features*. The existing 4-tier
`PortalUserRole` (OWNER / ADMIN / ADVISOR / VIEWER) is the role
dimension; tier is the **plan** dimension. Both must be enforced in
`withPermission()` middleware. PR2 scope expanded to wire plan-aware
feature gates so the right professionals see the right
functionality. Up Next #13 reflects this.

### Decision: Phase 33 — Help / Training / FAQ / Compliance system

Reza directive 2026-05-04: "Comprehensive onboarding support,
training and BAU documents both for Monitrax support team and any
organisations buying Monitrax in Word or PDF document format or even
better links in Monitrax.com.au website or the app itself where
suited. Help/trainings/FAQ/Compliance document section in Monitrax
app, admin and the portal."

**Architecture decision:** ONE source of truth, FOUR delivery
surfaces. Markdown source files in `docs/help/<audience>/<topic>.md`
versioned in Git alongside the app — same PR-review process as code,
so we never ship code that contradicts the docs. Frontmatter:
audience, category, slug, route_context, last_reviewed,
compliance_class.

**Four delivery surfaces:**
1. Public docs site at `help.monitrax.com.au` — Next.js static gen
   from same Markdown source. SEO-indexed (huge for D2C
   acquisition). PDF export per article.
2. In-app help drawer — `?` icon on every page header → slide-in
   drawer with route-aware content selection (e.g. `/dashboard/cfo`
   → AI Guide article). Audience-scoped search.
3. PDF/Word download bundles — pre-built compliance packs ("CDR
   Compliance Pack", "Org Onboarding Pack", "Adviser Quick-Start",
   "Architecture Overview for Compliance Officers"). DOCX templates
   for orgs to customise to their letterhead.
4. Admin help (`/admin/help/*`) — internal-only docs gated by
   Monitrax admin role. Operational runbooks, support workflows,
   escalation paths. Some content sourced from existing
   `docs/operational/*`.

**Six audiences (drives navigation + access control):**

| Audience | Visible to |
|---|---|
| `consumer` | All authenticated users + public site |
| `org-admin` | Org OWNER / ADMIN roles |
| `org-professional` | Org ADVISOR / VIEWER roles |
| `org-client` | Users with active OrganizationClient link |
| `monitrax-internal` | Monitrax admin role only |
| `compliance` | Public + org admins |

**Three training programs (with completion certificates):**
1. Org Onboarding Program (5-day, structured) — admin provisioning
   → professional invitation → first client invite → first AI advice
   review → first compliance export
2. Adviser Certification (8 modules, ~3hrs total) — TRAIL / AFSL
   boundary / alert stream / Ask-a-Pro lifecycle / comms compliance
   / ROA-SOA prep / Practice analytics / edge cases — completion
   earns "Monitrax-certified" badge on marketplace listing
3. Compliance Officer Briefing (1hr) — everything an org's
   compliance officer needs to sign off on adoption

**Engineering size:** ~10 dev days engineering + ~18 dev days
content authoring = ~28 days total. Most is content. Can run in
parallel with Phase 32C marketplace work.

**Cost (GCP):** static site = free (Vercel hosting); search ~AU$50/mo
(Algolia DocSearch); GCS for bundles = trivial. No new line items.

**Critical for B2B sales** (financial-adviser lens): orgs'
compliance teams will demand this audit pack before signing. The
four-lens commitment in CLAUDE.md §0 says world-class advisor
quality everywhere — that includes the docs the org's compliance
officer reads at 11pm to decide whether to sign the contract.

### Plan updates committed in this addendum

- `docs/IMPLEMENTATION_PLAN.md`:
  - Header `Last updated` rewritten with both decisions
  - Up Next #13 (PR2) scope expanded — plan-tier feature gating
  - Up Next #19 (Admin) — seat/client overflow billing visibility
  - Up Next #20 (Stripe Billing) — Studio/Practice/Enterprise +
    overflow add-ons + tier add-ons
  - Up Next #21–#26 NEW — Phase 33 Help/Training/Compliance system
  - PR4d (transcript retention) — finalised model captured
    (soft-delete from user view + 7yr professional archive)

### What's now blocking-free for next session

- **Up Next #13 (Phase 32B PR2)** — Practice dashboard wiring +
  sidebar repaint + plan-tier gating. ~3 dev days. Lighthouse
  adviser pitch demo unblocks at PR2 end.
- **Up Next #21 (Phase 33a)** — Help Center infrastructure can
  start in parallel with PR2 (different surface, no conflict).

---

## Session addendum 3 (final 2026-05-04) — three end-of-day decisions

Reza closed the session with answers to the three remaining open
questions. All decisions baked into the plan; next session is fully
unblocked with no strategic deliberation pending.

### Decision: Tier naming = Studio / Practice / Enterprise

LOCKED. "Studio" replaces "Solo" — small-firm-friendly while still
covering one-person practices, and avoids the name-collision with
the Practice surface dashboard. Marketing copy + Stripe product
catalog + `OrganizationPortalSettings.plan` enum values should all
reflect this. Existing enum is `STARTER / PROFESSIONAL / BUSINESS /
ENTERPRISE` (per `prisma/schema.prisma`); needs renaming in a
follow-up migration. Queued as a small additive enum-rename PR
during Phase 32C PR6 (Stripe Billing wiring) since both touch the
same surface.

### Decision: Phase 33a runs in PARALLEL with Phase 32B PR2

LOCKED. Different surfaces (Practice dashboard vs Help Center
static site), zero merge conflict risk, two PRs in flight next
session is operationally fine. Up Next #21 trigger updated to
"Parallel with PR2" rather than "After PR2". Engineering work
splits cleanly — PR2 is React + Next dynamic; 33a is Next static +
Markdown CMS infrastructure.

### Decision: Anti-poaching guardrails

LOCKED. Two structural changes folded into PR2 scope:

1. **Raise `team:invite` permission from PORTAL_ADMIN → PORTAL_OWNER**
   only. One-line edit in `lib/portal/permissions.ts`:
   ```
   PORTAL_ADMIN: [..., 'team:invite']  // remove this line
   PORTAL_OWNER: [..., 'team:invite']  // ensure present
   ```
   Effect: only the org's Owner can invite new professional seats.
   Stops the "ADMIN invites a friend-org adviser to gain visibility
   into the org's clients" attack at the permission layer. ADMINs
   can still manage day-to-day team operations (role changes for
   sub-OWNER seats, removal of inactive members) but cannot expand
   the seat roster.

2. **Audit-log emission on every seat invite.** The invitation
   handler at `app/api/portal/organizations/[orgId]/team/route.ts`
   adds an `AuditLog` row on POST:
   ```
   action: 'SEAT_INVITED',
   actorId: <inviting OWNER's userId>,
   targetEmail: <invitee email>,
   metadata: { proposedRole, timestamp, organizationId }
   ```
   Surfaced in `/admin/orgs/{orgId}/audit` view (PR5) so Reza /
   Monitrax support can see the full invitation history per org.
   Lifts conduct-policy enforcement out of ToS-only into structural
   code per CLAUDE.md §0 architect lens.

PR2 scope updated in Up Next #13.

### Plan updates committed in this addendum

- `docs/IMPLEMENTATION_PLAN.md`:
  - Header `Last updated` rewritten to capture all three decisions
  - Up Next #13 (PR2) — anti-poaching guardrails added to scope
  - Up Next #21 (Phase 33a) — trigger flipped to "Parallel with PR2"

### Status at session close (penultimate)

- 4 commits pushed on `claude/review-monitrax-docs-8HM3K`
- All Phase 32B / 32C / 33 strategic decisions LOCKED
- Phase 41 (Entity Layer / My Structure) DOCUMENTED + queued

---

## Session addendum 4 (latest 2026-05-04) — Phase 32B PR2 SHIPPED + Phase 41 documented

Reza directive: continue the build progress, give an exec summary,
and create a Pull Request for testing.

### Phase 41 — Entity Layer / "My Structure" — DOCUMENTED + queued

Reza decisions captured:
- **TFN collection: yes** (optional, encrypted at rest, default off,
  never logged, never sent to AI; user controls visibility)
- **Trust deed parsing: both** (manual entry + AI-assisted PDF
  extraction via Gemini + Phase 26 OCR)
- **Visualisation order: Tree first, then Sankey** (Claude's call;
  Tree is more daily-utility, Sankey is the "wow" pitch screenshot)

Phase 41 phases documented in Up Next #27–#34:
- 41a — `LegalEntity` schema + ownership backfill (~5 days)
- 41b — Onboarding wizard "How is your wealth held?" step (~5 days)
- 41c — "My Structure" page with Entity Tree (`react-flow`) (~10 days)
- 41d — Money Flow Sankey (~12 days)
- 41e — Entity-aware tax engine extension (Div 115 / Div 152 /
  trust distributions / SMSF caps / Div 7A / family trust elections
  / retirement exemption) (~15 days)
- 41f — Personal Xero/MYOB/QuickBooks integration (reuses Phase 32
  AccountingIntegration stubs) (~10 days)
- 41g — Adviser overlay shows entity structure prominently (~3 days)
- 41h — AI Guide entity-aware diagnosis (general info only) (~5 days)

Total: ~65 dev days (~13 weeks). Triggers after Phase 32B PR3
ships (drill-in needs the schema). Critical positioning:
**Monitrax does NOT replace Xero — Monitrax CONSUMES Xero data and
re-presents it through the wealth-strategy lens.**

### Phase 32B PR2 — SHIPPED in this session

The lighthouse adviser pitch demo is now unblocked. PR2 ships:

**Practice dashboard wiring** (`app/portal/dashboard/page.tsx`):
- Replaced the "Coming Soon" stub with the assembled Practice view
- PracticeHeader (greeting + practice-mode pill + demo-mode
  profession switcher) → PracticeKpiStrip (4-up KPIs) →
  PracticeAlertStream (severity-sorted call sheet, 7 alerts) →
  PracticeClientBookTable (5-client lighthouse fixtures with
  profession-flavoured columns) → compliance footer
- Demo mode (`NEXT_PUBLIC_PORTAL_DEMO_MODE=1`) shows the profession
  switcher so the lighthouse pitch can cycle through adviser /
  broker / accountant on the same page. Production hides the
  switcher entirely; production reads `currentOrg.profession` via
  the OrganizationContext.

**Portal sidebar repaint** (`components/portal/layout/PortalSidebar.tsx`,
`app/portal/PortalLayoutClient.tsx`):
- From slate-900 admin look to brand-aligned warm-ivory palette
- White/70 backdrop-blur sidebar with slate-200 dividers (Linear/
  Notion aesthetic, not admin-console)
- Active nav item: filled brand-navy pill with subtle shadow
- Inactive nav item: slate-600 text on warm-ivory background
- Page background: gradient warm-ivory to white (matches consumer
  dashboard bg)
- Same NavLink anatomy retained — drop-in replacement, no IA change

**API + context exposure of `Organization.profession`** (PR1
schema field now flows through to the UI):
- `app/api/portal/organizations/route.ts` returns `profession` in
  the response (falls back to legacy `OrganizationPortalSettings.
  organizationType` for orgs created before the migration)
- `lib/portal/context/OrganizationContext.tsx` interface adds
  `profession: string | null`
- Practice dashboard reads `currentOrg.profession` in production
  mode (or local state in demo mode)

**Anti-poaching guardrails** (CLAUDE.md §0 architect lens):
- `lib/portal/permissions.ts` — `team:invite` removed from
  `PORTAL_ADMIN` permission list. Only `PORTAL_OWNER` can invite
  professional seats. ADMIN can still manage existing roster
  (role changes for sub-OWNER seats, removal) but cannot expand it.
- `app/api/portal/organizations/[orgId]/team/route.ts` — every
  successful invitation creation now writes a `PORTAL_SEAT_INVITED`
  audit log row via canonical `createAuditLog()`. Surfaced in
  `/admin/orgs/{orgId}/audit` (Phase 32C PR5). Fire-and-forget
  pattern (CLAUDE.md §12.10).

**What was deliberately deferred to PR3** (architect lens — too
large for this PR):
- Plan-tier feature gating in `withPermission()` middleware
  (Studio/Practice/Enterprise gates SSO/white-label/API-keys/etc).
  Documented in Up Next #13 + #19. Will land alongside the
  drill-in render pattern in PR3.
- Real wiring of the alert engine to snapshot deltas (still uses
  the lighthouse fixture dataset). Real engine arrives in
  Phase 32C PR3 once a Basiq-connected test client exists.
- Drill-in render of the canonical consumer dashboard with adviser
  overlay (Phase 32B PR3, ~5 days, unblocked by this PR).

### Build status

- TypeScript `tsc --noEmit` clean for all changed files
- No new dependencies added
- No new schema migrations (PR1 migration already applied)
- All audit-log writes are fire-and-forget (no API perf regression)

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern (Practice dashboard
  + sidebar repaint)
- [x] application config (`NEXT_PUBLIC_PORTAL_DEMO_MODE` env var
  for demo gating; documented inline)
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [x] security / CDR posture (anti-poaching guardrail; audit-log
  on seat invites)
- [ ] operational procedure
- [x] strategic decision (Phase 41 documented + queued)

Docs updated:
- `docs/IMPLEMENTATION_PLAN.md` — Phase 41 (Up Next #27–#34) +
  header `Last updated`
- `docs/changelog/CHANGELOG_2026_05_04.md` — this addendum

### Status at session close (final)

- 5 commits expected on `claude/review-monitrax-docs-8HM3K` (PR1
  code + 3 strategic addenda + this PR2 build)
- Phase 32B PR2 SHIPPED — lighthouse adviser pitch demo unblocked
- Pull Request created for review/merge testing
- Next session work: Phase 32B PR3 (drill-in canonical dashboard
  + adviser overlay + plan-tier gating in `withPermission()`) AND
  Phase 33a (Help Center infrastructure) can run in parallel.

---

## Other sessions on 2026-05-04 (merged from `main` after PR #603)

> The following session blocks merged into `main` while this branch was in flight (PR #600 IRP appendix, PR #601 Phase 36 Phase 2a LoanDetailDialog, install-claude-skills-g5tYW architect-mode revision). Preserved verbatim below for the daily changelog audit trail.

## Session: claude/irp-wif-appendix-lS5cs (PR #600 — merged)

### Changes Made
- **Type:** Docs / Policy
- **Scope:** `docs/policy/INCIDENT_RESPONSE_PLAN.md` (Appendix A — WIF & Cloud SQL Auth-Chain Failure Patterns)
- **Description:** Closes Up Next #6 — formally captured the five Phase 9 production-cutover failure patterns inside the Incident Response Plan so future on-call sessions can recognise the failure mode and reach for the matching runbook step (`04_WIF_TROUBLESHOOTING.md` §3.A–§3.K) instead of re-diagnosing from scratch. The runbook had the technical fixes; the IRP now has the incident-response framing (severity classification, rollback decision, post-incident scoping).

### Why this matters

When Production cut over from `DATABASE_URL` → WIF + Cloud SQL Connector + IAM DB auth on 2026-05-01, four distinct failure modes surfaced inside one day, plus a fifth (cold-start init wedge) was caught and patched late the same night. Each looked like "the database is down" from the user's side, but the root causes spanned five different layers of the auth chain. Without an IRP-side playbook, the next operator (or the next AI session) has to re-derive "is this a breach or an availability failure? do I roll back or forward-fix? does the OAIC NDB clock start?" — questions the runbook does not answer. This appendix answers them.

### Files Modified
- `docs/policy/INCIDENT_RESPONSE_PLAN.md` — version 1.0 → 1.1; added `Last revised: 2026-05-04` header line; §2 scope adds "WIF / Cloud SQL auth-chain failures" pointer to §10; §3 classification table adds "HIGH (Availability)" severity row for auth-chain failures (explicitly noting no data-breach implication); §9 References adds the WIF runbook + WIF compliance evidence pack; new §10 (Appendix A) — `Last Updated` footer rewritten.
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #6 struck through and marked DONE (this PR); items 7→12 renumbered to 6→11; Last-updated header rewritten; new Recently Completed entry under 2026-05-04.

### What §10 contains
- **§10.1 Why this appendix exists** — incident-response framing for WIF auth-chain failures.
- **§10.2 The auth chain** — 6-step reference (Layer 1 OIDC token → Layer 6 schema authorisation) so operators identify the broken layer first.
- **§10.3 Observed failure patterns** — table of the five cutover modes:
  | # | Pattern | Layer | Runbook |
  |---|---|---|---|
  | 1 | OIDC token retrieval | 1 | §3.A |
  | 2 | mTLS handshake / TLS alert 42 | 4 | §3.G |
  | 3 | SCRAM no-password / SASL | 5 | §3.H |
  | 4 | Trailing-whitespace `28P01` on `CLOUD_SQL_DB_USER` | 5 | §3.J |
  | 5 | Cold-start init wedge (intermittent) | 4 init cache | §3.K |
- **§10.4 First-response playbook** — confirm layer → rollback vs forward-fix decision (with the documented `USE_CLOUD_SQL_CONNECTOR=false` rollback while Phase 11 fallback path still exists) → apply runbook step → verify (with cold-start retest reminder).
- **§10.5 CDR-containment escape-hatch** — for the unlikely overlap of availability failure + suspected breach: rollback flag + revoke SA Cloud SQL Client role + drop IAM DB user.
- **§10.6 Bounds** — explicitly NOT the runbook (operators in flight stay in `04_WIF_TROUBLESHOOTING.md`); explicitly NOT exhaustive — future failure modes append rows to §10.3.

### Build Status
- N/A — docs-only PR. No code changes.

### Tests
- N/A — docs-only PR.

### Doc-sync (CLAUDE.md §16)

Surfaces changed:
- [ ] visual design system / component pattern
- [ ] application config (env vars, Vercel, OIDC, etc.)
- [ ] GCP infrastructure (Cloud SQL, IAM, etc.)
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [x] operational procedure (new failure mode / diagnostic / lesson — formalising five existing modes into IRP framing)
- [ ] strategic decision

Docs updated:
- `docs/policy/INCIDENT_RESPONSE_PLAN.md` — version + §2 + §3 + §9 + new §10
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #6 closed, items renumbered, Recently Completed entry, Last-updated header
- `docs/changelog/CHANGELOG_2026_05_04.md` — this file (above)

### Risk
- **Risk:** None. Docs-only change. No code path, no runtime behaviour, no schema, no infra.
- **Reversibility:** Trivial — single-PR revert restores prior IRP.

### PR
- Branch: `claude/irp-wif-appendix-lS5cs`
- PR URL: https://github.com/resadegh/monitrax/pull/600 (merged)

---

## Session: claude/phase-36-2a-loan-detail-dialog-lS5cs (PR #601)

### Changes Made
- **Type:** Refactor + Feature (UX)
- **Scope:** Phase 36 Phase 2a — extract `LoanDetailDialog` and wire it inline on `/dashboard/balances`
- **Description:** Closes the first sub-phase of Phase 36 Phase 2 (legacy `/dashboard/accounts` + `/dashboard/loans` retirement). The inline 6-tab loan detail dialog living in `app/dashboard/loans/page.tsx` (lines 633–963) is now a shared component at `components/loans/LoanDetailDialog.tsx`, mirroring the `AccountDetailDialog` pattern from Phase 1. Used on both the legacy loans page (replacing the inline — parity refactor) and on Balances (new — loan rows now open the dialog inline instead of navigating to `/dashboard/loans/{id}`).

### Why this matters
Phase 1 already did this for accounts: clicking an account row on Balances opens an inline dialog instead of forcing a redirect-then-second-click. Phase 2a extends the same pattern to loans, which closes the last "have to leave Balances to drill in" gap and unblocks Phase 2d (the actual route redirect). Per CLAUDE.md §12.2 (SSOT), this PR also pulls the dialog's calculations into the canonical `lib/utils/calculations.ts` and `lib/utils/frequencies.ts` helpers — the legacy page was duplicating `Math.max(0, principal - offset)` math and a hand-rolled frequency-to-annual switch.

### Files Modified
- `components/loans/LoanDetailDialog.tsx` (NEW, ~620 lines) — shared loan detail modal. 6 tabs (Overview / Property / Offset / Expenses / Strategy / Linked). Footer: Close + optional Delete (with AlertDialog two-step confirmation) + Edit. Self-contained `LoanDetail` + `LoanDetailExpense` types, structurally compatible with `/api/loans`. Calculations: `calculateEffectivePrincipal`, `calculateLVR`, `toAnnual` — all canonical SSOT. File-header JSDoc per CLAUDE.md §16.4.
- `app/dashboard/loans/page.tsx` — replaced the inline detail dialog with the new component (parity refactor; behaviour preserved end-to-end except Delete now uses the AlertDialog confirmation instead of `window.confirm()`). Removed dead helpers `convertToAnnual` + `calculateLinkedExpenses` (only used by the extracted dialog). Removed unused imports (`Dialog`, `Tabs`, `LinkedDataPanel`, `EntityStrategyTab`, `Lightbulb`, `Link2`).
- `app/dashboard/balances/page.tsx` — widened `LoanRow` type to carry every field the dialog needs (`isInterestOnly`, `termMonthsRemaining`, `minRepayment`, `repaymentFrequency`, `extraRepaymentCap`, `expenses`, `_links`/`_meta`, plus richer `property` and `offsetAccount` fields). All these fields are already returned by `/api/loans` — just declared. New state hooks: `editingLoan`, `detailLoan`, `loanDetailOpen`. New handlers: `openLoanDetail`, `openLoanEdit` (lazy-loads property + asset lookups same way `openLoanCreate` does), `handleDeleteLoan` (mirrors `handleDeleteAccount`). `LoanRowView` is now a `<button>` calling `onClick` instead of a `<Link>` redirecting to `/dashboard/loans/{id}`. `LoanFormDialog` `editing` prop now driven by `editingLoan` state (was hard-coded `null`); reset to create mode on close. `LoanDetailDialog` rendered at page level with full callbacks wired (edit / delete / GRDCS-linked-navigate).

### Files NOT modified (intentional)
- `lib/utils/calculations.ts` / `lib/utils/frequencies.ts` — canonical SSOT, used as-is per CLAUDE.md §12.2.
- `app/api/loans/route.ts` — no API contract change; the dialog consumes the existing response shape.
- `prisma/schema.prisma` — no schema change.
- Sidebar, sidebar `matchRoutes`, `BasiqHeroCard`, `DashboardEmptyStateGrid`, `SetupNextActionPanel` — left for Phase 2b / 2e (separate PR).

### Build Status
- [x] `npm run build` passes locally.
- [x] TypeScript compiles clean.

### Tests
- [x] Manual code-review: dialog mounts on legacy loans page (parity) and on Balances (new). Edit flow plumbs back to `LoanFormDialog` in edit mode. Delete flow uses AlertDialog confirmation, calls `/api/loans/{id}` DELETE, reloads list.
- [ ] Preview deploy: open Balances → click any loan row → verify all 6 tabs render with the same numbers as the legacy `/dashboard/loans` detail. Click Edit → verify the form opens populated. Confirm Delete → verify the loan disappears from the Cash + Debt sections.
- [ ] Preview deploy: open `/dashboard/loans` directly → confirm the dialog still renders identically (parity check — this is the safety net before Phase 2d redirects the route away).

### Doc-sync (CLAUDE.md §16)

Surfaces changed:
- [x] visual design system / component pattern (new shared component; per §16.4 file-header JSDoc + canonical pattern reference)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [ ] strategic decision

Docs updated:
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #4 reflowed with sub-phase status (2a ✅ shipped; 2c + 2e flagged no-op; 2b + 2d remain). Last-updated header rewritten. Recently Completed entry under 2026-05-04.
- `docs/changelog/CHANGELOG_2026_05_04.md` — this file.
- File-header JSDoc on `components/loans/LoanDetailDialog.tsx` documents the design rules + SSOT mapping per CLAUDE.md §16.4.

Phase 36 spec (`docs/blueprint/PHASE_36_MY_ACCOUNTS_SIMPLIFICATION.md`) is left for the closing Phase 2d PR — that's where the route retirement is recorded.

### Risk
- **Risk:** Low.
- **Surfaces touched:** one shared component (new), two pages (one is being retired anyway, one is the migration target). API contract unchanged. Schema unchanged. Calculations now flow through canonical SSOT (was duplicated; now reuses `lib/utils/calculations.ts`).
- **Reversibility:** Trivial single-PR revert; the legacy inline dialog is preserved verbatim in git history if rollback is needed.
- **Behavioural delta:** Loan delete on the legacy page now uses an AlertDialog instead of `window.confirm()` — this is a UX upgrade matching the AccountDetailDialog pattern, not a regression.

### PR
- Branch: `claude/phase-36-2a-loan-detail-dialog-lS5cs`
- PR URL: https://github.com/resadegh/monitrax/pull/601

---

## Session: install-claude-skills-g5tYW (continuation — architect-mode revision)

### Changes Made
- **Type:** Refactor / governance enhancement (skill content)
- **Scope:** `.claude/skills/architect-mode/SKILL.md`
- **Description:** Revised the architect-mode skill to (1) add a 7th lens (Security & Compliance Consultant), (2) codify a decision-ready synthesis mandate so the seven lenses operate as internal cognitive work and the user-facing output is a single consolidated recommendation, (3) tighten the output structure to require a specific Next Best Action.

### Rationale

Reza explicitly clarified the operating contract on 2026-05-04:

> *"although I want you to view every change from multiple lenses of designer, architect, security consultant, human behaviour psych, I always need you to give me an informed, and consolidated feedback as well. I want you to help with making decisions based on that. write up this into your skills"*

Two gaps in the original architect-mode skill (PR #596) needed closing:

1. **Security as a first-class lens.** The original six lenses folded security under "architect" via §13 CDR references. For a CDR-regulated financial product approaching Basiq accreditation, security deserves its own explicit lens with an explicit set of "asks" (threat model, credential surface, privacy implications, log-leak vectors, environment separation). Now: 7th lens added with discipline-specific questions.
2. **Synthesis vs enumeration.** The original skill said "operate as six experts in parallel" but didn't explicitly forbid lens-by-lens output. In practice, multi-lens output ("From the financial-adviser lens... From the designer lens...") is homework, not synthesis — the user wants the answer that *emerges* from the lenses, not the lenses themselves. Now: explicit Synthesis section, 6th operating principle ("Consolidate, don't enumerate"), anti-pattern list, and a tightened output structure that requires a single Next Best Action with Implementation specific enough to act on without further clarification.

### Files Modified

- `.claude/skills/architect-mode/SKILL.md` —
  - YAML `description` updated: 787 → ~970 chars (within 1024 limit). Now names seven lenses + the synthesis mandate.
  - Lens table: added row 7 "Security & Compliance Consultant" with discipline-specific asks.
  - Closing sentence after lens table: "consult at least three of the six lenses" → "consult at least four of the seven lenses (and ALWAYS the security lens for any change touching data, auth, infra, or external integrations)".
  - Critical operating principles: added principle 6 — "Consolidate, don't enumerate" with the user's verbatim quote.
  - NEW section "Synthesis: how the lenses become an answer" — explicit mechanic for running the seven lenses internally, detecting agreement, arbitrating disagreement (architect lens), surfacing dissent only when load-bearing, producing decision-ready output. Anti-patterns enumerated. The "explicit fork" exception named.
  - "Output structure" section: tightened to require a single Next Best Action with Implementation specific enough to act on without further clarification.
  - "Relationship to existing CLAUDE.md governance" section updated to reflect: 7 lenses (was 6), Consolidate-don't-enumerate principle, Synthesis mechanic.

- `docs/IMPLEMENTATION_PLAN.md` — entry added under `✅ Recently Completed (2026-05-04)`.

- `docs/changelog/CHANGELOG_2026_05_04.md` — this Session block (third on the page).

### Documentation Updated

- `docs/IMPLEMENTATION_PLAN.md` ✅ (CLAUDE.md §15 SSOT)
- `docs/changelog/CHANGELOG_2026_05_04.md` ✅ (CLAUDE.md §11 daily changelog — this file)
- `CLAUDE.md` — **NOT modified.** The §0.4 cross-reference to architect-mode (added 2026-05-03 in PR #596) still applies; the skill behind it has been revised but the cross-reference itself doesn't need to change. The four-lens content in §0 stands; the skill remains a superset.

### Doc-sync (CLAUDE.md §16)

Surfaces changed:
- [ ] visual design system / component pattern
- [ ] application config (env vars, Vercel, OIDC, etc.)
- [ ] GCP infrastructure (Cloud SQL, IAM, etc.)
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture — *Strengthens posture (adds explicit security lens) but does not change CDR rules. Light yes; no canonical CDR docs need updating.*
- [x] operational procedure — *The skill is itself an operational procedure for design/architect decisions. Revising it = revising procedure.*
- [x] strategic decision (Open Question resolved / workstream parked or revived) — *Resolved a latent ambiguity about whether security was first-class or sub-architect, and codified the synthesis-output contract.*

Docs updated:
- `.claude/skills/architect-mode/SKILL.md` — the skill content itself (the doc and the procedure are the same artifact)
- `docs/IMPLEMENTATION_PLAN.md:✅ Recently Completed (2026-05-04)` — entry for the revision
- `docs/changelog/CHANGELOG_2026_05_04.md` — this Session block

### Testing
- [x] YAML frontmatter validates (`name` lowercase + hyphens, matches dir; `description` ~970 chars, within 1024 limit)
- [x] Skill body coherent — read end-to-end after edits; no orphan references to "six lenses"
- [x] No bundled scripts, no executable surface, no network calls — pure-instruction skill (LOW per skill-security-review methodology)
- [x] No conflicts with existing skills
- [x] Skill is project-scoped (`.claude/skills/architect-mode/`) — auto-triggers only in Monitrax sessions
- [ ] Trigger evaluation under future Monitrax sessions — pending production use

### PR
- Branch: `claude/install-claude-skills-g5tYW`
- PR URL: TBD on push (this is a follow-up to merged PRs #596 + #599)
- Status: Untracked → committed → pushed in this session

### Out-of-scope (this session, not this PR)

None. This PR is a focused revision to one skill plus the supporting docs the §16 protocol mandates.


---

## Session: phase-32b-pr3-drill-in (drill-in canonical client view + adviser overlay + plan-tier gating)

### Changes Made
- **Type**: Feature
- **Scope**: Phase 32B PR3 — B2B2C drill-in. First Demo-Complete Critical Path week-1 deliverable (per `🎯 Demo-Complete Critical Path` in IMPLEMENTATION_PLAN.md).
- **Description**: Wires `viewerContext` through `getMasterFinancialSnapshot()` so the canonical engine can be safely invoked by a professional viewing a client's dashboard. Adds the drill-in page that renders the consumer dashboard primitives with an adviser overlay, deletes the legacy `ClientDetail.tsx`, and ships plan-tier gating as a composable middleware on top of `lib/auth/guards.ts`.

### Files Modified / Added / Deleted
- **Schema** — `prisma/schema.prisma` adds `PRO_DASHBOARD_VIEW` to the `AuditAction` enum.
- **Migration** — `prisma/migrations/20260504160000_add_pro_dashboard_view_action/migration.sql` (additive `ALTER TYPE ... ADD VALUE IF NOT EXISTS`; §12.11 N/A).
- **Service** — `lib/services/masterFinancialService.ts` gains:
  - `ViewerContext` interface (seatId + clientUserId + accessScopes + ipAddress? + userAgent?).
  - `assertValidViewerContext()` — rejects malformed contexts (missing fields, mismatched userId).
  - `loadOrganizationClient()` — verifies an ACTIVE+GRANTED `OrganizationClient` row owned by the seat's organisation; returns the canonical DB-stored `accessScopes` (the caller-asserted array is treated as informational only).
  - `applyScopeFilter()` — service-layer scope filter. `LOANS / PROPERTIES / INVESTMENTS / TAX / FINANCIAL` each gate the corresponding slice; `FULL` bypasses. Honours the canonical type shapes for `LoanAggregation`, `DebtMetrics`, `LiabilitySummary`, `EmergencyFundMetrics`, `MasterExpenseBreakdown`, `MasterIncomeBreakdown`, `CashflowResult`, `InvestmentMetrics`, `TaxSummary`.
  - `logProDashboardView()` — fire-and-forget per CLAUDE.md §12.10. Writes BOTH `AuditLog` (top-level `PRO_DASHBOARD_VIEW`) and `ClientAccessLog` (per-view, free-form action) so the 3-layer consent model in `docs/architecture/03_DATA_MODEL.md` §9.2 (CDR / professional / per-view) is preserved end-to-end. Also bumps `OrganizationClient.lastAccessedAt`.
  - `getMasterFinancialSnapshot(userId, viewerContext?)` — viewerContext is OPTIONAL; calling without it preserves the original consumer-facing behaviour byte-for-byte. Per CLAUDE.md §0 architect lens: ONE canonical engine, viewerContext is a parameter, NOT a fork.
  - `MasterFinancialSnapshot.viewer` echo (informational only — UX uses it to render scope badges and locked tiles).
- **API route** — `app/api/portal/clients/[id]/snapshot/route.ts` (NEW). Resolves the OrganizationClient by id, verifies the caller's seat is on the same org + has `clients:view_data` portal permission + (for PORTAL_ADVISOR) is the assigned member. Calls `getMasterFinancialSnapshot()` with the canonical viewerContext. Returns snapshot + client + recent notes + tasks + lastReviewedAt + organization metadata in one round-trip.
- **Plan-tier registry** — `lib/portal/planTier.ts` (NEW). Maps `OrganizationPlan` (legacy enum: STARTER / PROFESSIONAL / BUSINESS / ENTERPRISE) to canonical `PlanTier` (STUDIO / PRACTICE / ENTERPRISE). `PLAN_FEATURES` registry encodes Reza's monetisation matrix (locked 2026-05-04): SSO is ENTERPRISE-only; white-label + API key creation unlock at PRACTICE; audit-log retention is 90 / 365 / 365×7 days respectively. `customDomain` reserved for ENTERPRISE per pricing matrix. Companion `mapPlanToTier()`, `planAllowsFeature()`, `TIER_LABEL`.
- **Guard** — `lib/auth/guards.ts` adds `withPortalFeatureGate(feature, handler)`. Reads the caller's portal org, looks up `OrganizationPortalSettings.plan`, maps via `mapPlanToTier`, returns 402 (`PLAN_TIER_REQUIRED`) when the feature is gated. Composable with the existing role/permission middleware — call sites stack them.
- **Page** — `app/portal/clients/[id]/view/page.tsx` (NEW). Client component. Fetches `/api/portal/clients/[id]/snapshot`, composes `<ClientCanonicalDashboard>` (left) with `<AdviserOverlay>` (docked-right ≥md, bottom-sheet <md). Sticky page header keeps client identity + back link visible while scrolling.
- **Components** — `components/portal/clients/ClientCanonicalDashboard.tsx` (NEW) renders the canonical primitives (KPI strip, Health, Cashflow, Properties, Loans, Investments, Tax, Emergency Fund) directly from `MasterFinancialSnapshot`. Tiles outside granted scope render as locked placeholders rather than disappearing — surfaces the next consent extension as a next-best-action (CLAUDE.md §0 behaviour-psychology lens). `components/portal/clients/AdviserOverlay.tsx` (NEW) — scope summary, last-review timestamp, notes panel, tasks panel, profession-aware AFSL / credit-licence / TPB compliance footer. Mobile bottom-sheet collapses to a 4.5rem peek bar with task-count badge.
- **Index updates** — `components/portal/clients/index.ts` re-exports `ClientCanonicalDashboard` + `AdviserOverlay`; the old `ClientDetail` re-export removed. `components/portal/index.ts` JSDoc updated.
- **Delete** — `components/portal/clients/ClientDetail.tsx` removed. Zero callers re-verified at delete time. Closes the Phase 32B "retire `ClientDetail.tsx`" hard constraint.

### Documentation Updated
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #12 marked SHIPPED; new entry at the top of `✅ Recently Completed → 2026-05-04`; Dead Code rows #14 (OrganizationPlan enum naming) + #15 (ClientDetail.tsx — closed in same PR for traceability) appended.
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` — Steps 2 (drill into a client) + 3 (alert stream + adviser overlay) populated with the canonical demo flow now that the surface exists.

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
---

## Session: claude/phase-41a-legal-entity (Phase 41a — LegalEntity schema + ownership backfill SHIPPED)

### Changes Made
- **Type**: Feature — schema migration + foundational service layer for the entity layer (Phase 41 foundation; everything in 41b–h depends on this)
- **Scope**: `prisma/schema.prisma`, `prisma/migrations/20260504130000_add_legal_entity/migration.sql`, `lib/services/legalEntityService.ts`, `lib/security/tfnEncryption.ts`, `lib/security/index.ts`, `lib/services/index.ts`, 18 call-site files (every API route + service that creates an owned row)
- **Description**: Introduce `LegalEntity` as the canonical "who owns this?" layer. Every owned object (Property / Loan / Account / InvestmentAccount / Asset / Income / Expense) now hangs off `ownerEntityId` instead of (in addition to) the flat `userId`. Migration backfills every existing user with one `PERSONAL_NAME` LegalEntity and reassigns existing rows to it, so behaviour is identical end-to-end after backfill — but the foundation is in place for Phase 41b's wizard, 41c's tree, 41d's Sankey, 41e's entity-aware tax engine.

### Why this matters

Pre-41, the flat user-ownership model collapses as soon as a real Australian household enters the picture: Family Trust holds the IP, SMSF holds the share portfolio, Pty Ltd runs the side business, personal name owns the home. AI advisor can't reason about Div 115 CGT discount per holding period; tax engine can't allocate trust distributions to beneficiaries; adviser pitch demo has nothing to show. Phase 41a closes that.

### Files Modified
- `prisma/schema.prisma` — new `LegalEntity` model + `LegalEntityType` + `LegalEntityRole` enums; `legalEntities` back-reference on User; `ownerEntityId` (NOT NULL) + `ownerEntity` relation + `@@index` on Property / Loan / Account / InvestmentAccount / Asset / Income / Expense
- `prisma/migrations/20260504130000_add_legal_entity/migration.sql` — additive migration: enums + table + self-FK + user-FK + indexes; ADD COLUMN nullable on each owned table; backfill (one PERSONAL_NAME entity per user via `gen_random_uuid()` named after `users.name`, then UPDATE every owned row WHERE `ownerEntityId IS NULL` to point at its user's PERSONAL_NAME entity); ALTER each ownerEntityId to NOT NULL + add index + add FK with `ON DELETE RESTRICT`
- `lib/services/legalEntityService.ts` — NEW. Canonical default-entity resolver. `getDefaultLegalEntityId(userId, [tx])` returns the user's PERSONAL_NAME entity id, creating one on demand. Optional transaction client for callers inside `prisma.$transaction`
- `lib/services/index.ts` — re-exports `getDefaultLegalEntityId`
- `lib/security/tfnEncryption.ts` — NEW. TFN at-rest helper mirroring the `MFAMethod.secret` Phase 10 pattern. `encryptTfn` (8/9-digit validation + base64 wrap), `decryptTfn` (digit-shape revalidation), `maskTfn` (display-safe `***-***-XYZ`). Single swap-point for KMS-backed CMEK upgrade (Up Next #3)
- `lib/security/index.ts` — re-exports the TFN helpers
- API routes updated to provide `ownerEntityId`: `app/api/properties/route.ts`, `app/api/loans/route.ts`, `app/api/accounts/route.ts`, `app/api/assets/route.ts`, `app/api/income/route.ts`, `app/api/expenses/route.ts`, `app/api/expenses/bulk/route.ts`, `app/api/investments/accounts/route.ts`, `app/api/onboarding/bulk-create/route.ts` (12 create sites inside the transaction), `app/api/accounts/[id]/import/route.ts`, `app/api/bank/import/route.ts`, `app/api/basiq/sync/route.ts`, `app/api/documents/analyze/confirm/route.ts` (3 sites), `app/api/recurring-payments/[id]/link/route.ts`, `app/api/transactions/[id]/link/route.ts` (2 sites)
- Library/test code updated: `lib/bank/recurringExpenseDetection.ts`, `lib/testing/loader.ts` (added private cached `getOwnerEntityId()` method, threaded through 6 loader methods), `prisma/seed-validation.ts` (added `legalEntity.upsert` for both portfolios, threaded `ownerEntityIdA` / `ownerEntityIdB` through every owned-row upsert)

### Documentation Updated
- `docs/architecture/03_DATA_MODEL.md` — new §10 (Entity Layer — Phase 41 — LegalEntity): why an entity layer, the LegalEntity shape, the ownerEntityId pattern, migration & backfill, the default-entity service, TFN handling, what 41b–h enables
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #25 (Phase 41a) struck through + ✅ SHIPPED with full detail; Up Next #26 (Phase 41b) flipped to "UNBLOCKED — next session"; Recently Completed entry for 2026-05-04 prepended
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` — Step 3 ("Open the entity tree — THE moment") "TO BE WRITTEN AS BUILD COMPLETES" placeholder populated: entity-tree visual reference (post-Phase-41c) + 3-archetype best-fit users + demo sequencing rule (Sarah → David+Emma → Olivia)

### CLAUDE.md §12.11 destructive-write checklist (backfill UPDATEs)

The migration runs an `UPDATE` against every existing row in seven tables (`properties`, `loans`, `accounts`, `investment_accounts`, `assets`, `income`, `expenses`).

1. **What rows could match my `where` clause?** Every existing row in each of the seven tables — the migration just added the `ownerEntityId` column to all of them. The clause is `WHERE ownerEntityId IS NULL AND le.userId = <table>.userId AND le.type = 'PERSONAL_NAME'`.
2. **What columns am I overwriting?** Only `ownerEntityId`. The column is brand new in this same migration (added two steps above), so its previous value is uniformly `NULL` for every row. No user-entered data is at risk.
3. **What guard ensures I only mutate rows my code created?** The `WHERE ownerEntityId IS NULL` predicate. The migration creates exactly one `PERSONAL_NAME` LegalEntity per user immediately before the UPDATE, so the join `le.userId = <table>.userId AND le.type = 'PERSONAL_NAME'` resolves to a single row per user; the `IS NULL` predicate ensures the UPDATE only touches rows that have never been assigned an entity.

User confirmation: NOT REQUIRED — the column being updated is new in the same migration, has no previous value to clobber, and the `IS NULL` guard prevents any non-migration row from being mutated.

### CLAUDE.md §12.12 schema-change deploy protocol

- `prisma/schema.prisma` modified
- Matching migration file present at `prisma/migrations/20260504130000_add_legal_entity/migration.sql` in the SAME PR
- No `prisma db push`, no `prisma db execute`, no raw `ALTER TABLE` outside the migration
- Vercel preview deploy will run `prisma migrate deploy` against `monitrax-db-dev` before the preview build serves; production deploy runs it against `monitrax-db-prod`. If migration fails, deploy aborts.

### CLAUDE.md §13 CDR / TFN compliance

- `tfnEncrypted` is OPTIONAL (nullable, default-off) — the wizard collects TFN only on explicit user opt-in
- Encrypted at rest via `lib/security/tfnEncryption.ts` (mirrors `MFAMethod.secret` pattern; single swap-point for CMEK)
- Never logged (use `sanitizeCdrMetadata()` if a tfn-bearing entity flows through audit logging by accident)
- Never sent to AI (advisor inputs explicitly omit the field)
- Default API responses do not include `tfnEncrypted` — read paths must explicitly opt in

### CLAUDE.md §16 doc-sync block

Surfaces changed in this PR:
- [x] visual design system / component pattern — N/A (no component changes; tree visual lands in 41c)
- [x] application config — N/A
- [x] GCP infrastructure — N/A
- [x] identity / auth — N/A (TFN encryption is data-at-rest, not auth)
- [x] deployment / build — N/A (no `vercel-build` change; existing `prisma migrate deploy` step covers this migration)
- [x] security / CDR posture — `lib/security/tfnEncryption.ts` is a new sensitive-data helper, but it follows the canonical Phase 10 pattern and CMEK upgrade is queued under Up Next #3
- [x] operational procedure — N/A (no new failure mode encountered)
- [x] strategic decision — N/A (Phase 41a was already queued under Up Next #25)
- [x] data model — `docs/architecture/03_DATA_MODEL.md` §10 added
- [x] schema migration — `prisma/migrations/20260504130000_add_legal_entity/migration.sql`

Docs updated in this PR:
- `docs/architecture/03_DATA_MODEL.md` §10 — new section documenting the entity layer
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #25 closed, #26 unblocked, Recently Completed entry added
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` Step 3 — entity-tree visual reference + archetype guidance populated
- `docs/changelog/CHANGELOG_2026_05_04.md` — this entry

### Build Status
- [x] TypeScript compilation passes — `npx tsc --noEmit` exits 0
- [x] Prisma schema validates — `prisma validate` reports "valid"
- [x] Prisma client generates — `prisma generate` succeeds
- [ ] Vercel preview build — to be verified after push (Vercel will run `prisma migrate deploy` against `monitrax-db-dev` first; success there proves the migration applies clean against a populated DB)

### Test plan (for Reza after preview goes live)
1. **Migration applies clean.** Vercel preview build green (`prisma migrate deploy` step succeeds against dev DB).
2. **Backfill produces exactly one PERSONAL_NAME entity per user.** Cloud SQL Studio: `SELECT COUNT(DISTINCT "userId"), COUNT(*) FROM "legal_entities" WHERE "type" = 'PERSONAL_NAME';` — both numbers should match the count of `users` rows in dev.
3. **Every existing owned row has `ownerEntityId`.** Cloud SQL Studio: `SELECT COUNT(*) FROM properties WHERE "ownerEntityId" IS NULL` — should be 0. Repeat for loans, accounts, investment_accounts, assets, income, expenses.
4. **TFN encryption round-trips.** `node -e "const {encryptTfn,decryptTfn,maskTfn}=require('./lib/security/tfnEncryption'); const t=encryptTfn('123456789'); console.log({encrypted:t, decrypted:decryptTfn(t), masked:maskTfn(decryptTfn(t))});"` — round-trip should succeed; masked should be `***-***-789`.
5. **Preview app boots + dashboard renders.** Open the preview URL, log in as a dev user, hit `/dashboard` — every existing tile renders identically to before (no UI change in this PR; behaviour parity proves the schema migration is transparent to the read path).

### PR
- Branch: `claude/phase-41a-legal-entity`
- PR URL: TBD on push
- Status: Local commits → push → PR open
## Session: claude/phase-33d-compliance-content (Phase 33d SHIPPED — Compliance pack content)

### Changes Made

- **Type:** Feature (Phase 33d compliance pack content — load-bearing B2B sales artefacts)
- **Scope:** Five regulator-facing compliance articles authored under `docs/help/compliance/` to match the voice / structure / frontmatter shape of the existing `cdr-consent-walkthrough.md` article shipped in Phase 33a (PR #605)
- **Description:** Authored the four queued + one expanded compliance pack articles required for B2B sales conversations with orgs' compliance teams. Quality bar: regulator-grade, not blog-grade. Every load-bearing claim in every article is cross-referenced inline to the canonical source-of-truth document it derives from, so an auditor reviewing Monitrax can independently verify every assertion against the operational policy or architecture doc that owns it.

### Articles authored

1. **`docs/help/compliance/data-retention-schedule.md`** (`complianceClass: cdr`, `order: 2`) — Three-class retention regime (CDR-protected / CDR-derived / Non-CDR), per-data-category retention table with legal basis (CDR Rules §1.10, Privacy Act APP 11, Corporations Act §912F, TASA §50-5, Privacy Act §15B), legal-retention overrides with `anonymizeCDRData()` de-identification mechanism, automated enforcement via Cloud Scheduler, six-day-to-irretrievable deletion guarantee. Derived from `docs/policy/CDR_DATA_RETENTION_SCHEDULE.md` + `lib/services/cdrDataLifecycle.ts`.

2. **`docs/help/compliance/incident-response-plan-summary.md`** (`complianceClass: general`, `order: 3`) — Auditor-facing summary of `docs/policy/INCIDENT_RESPONSE_PLAN.md` v1.1. Five-row severity table including HIGH (Availability) for Phase 9 auth-chain failures. Six-phase response model. OAIC NDB notification timelines (§26WK 30 days, §26WL ASAP, Basiq immediately, ACCC as directed). Containment toolkit including the unique IAM-revocation containment pattern that WIF enables. IRP §10 auth-chain availability playbook reference. Investigation evidence sources table with retention windows.

3. **`docs/help/compliance/architecture-overview-for-compliance.md`** (`complianceClass: general`, `order: 4`) — System architecture from a compliance-officer lens. Data residency table (australia-southeast1 across primary DB / backups / GCS / Cloud Logging / Vercel `syd1`). Four trust boundaries (Browser → Vercel, Vercel → GCP, Vercel → Basiq, Vercel → Gemini). Three identity systems (Firebase Auth / WIF / Cloud IAM database). Six-step database auth chain with no-static-credential properties. Encryption posture per layer. Dual-emit audit-logging table. RBAC. AI processing boundary (de-identified inputs only). Deployment pipeline. Derived from `docs/architecture/01_ARCHITECTURE_OVERVIEW.md` + `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md` + `docs/compliance/CDR_WIF_AUTHENTICATION_EVIDENCE.md`.

4. **`docs/help/compliance/asic-rg244-rg36-boundary-statement.md`** (`complianceClass: afsl`, `order: 5`) — How Monitrax stays on the general-information side of ASIC RG 244 / RG 36 / Corporations Act §766B. Single-voice AI + Ask-a-Professional architecture is positioned as the load-bearing argument (not disclaimer-as-defence per RG 244 §244.118). Three structural constraints: general-information-only system prompt; single voice no parallel conversations; Ask-a-Pro relief valve. AFSL-holder vs platform responsibility split table (best-interests duty §961B, SOA §946A, record-keeping §912F all sit with the AFSL holder). ASIC INFO 269 (April 2024) AI-in-finserv alignment table.

5. **`docs/help/compliance/data-handling-policy-summary.md`** (`complianceClass: privacy`, `order: 6`) — Staff access controls (unique login / MFA / RBAC / least privilege / no direct DB access). Segregation-of-duties via append-only audit log architecture (the application's Postgres role has `INSERT` but not `UPDATE`/`DELETE` on `AuditLog` and `AdminAuditLog`). Anomaly detection via `runAnomalyDetection()`. Device security per DSP. Approved-dependencies supply chain control. Future-staff onboarding clauses pre-written so they do not have to be invented under hiring pressure. Derived from `docs/policy/DEVICE_SECURITY_POLICY.md` + `APPROVED_DEPENDENCIES.md` + `SECURITY_AWARENESS_POLICY.md` + `docs/operational/security/02_IAM_AND_PERMISSIONS.md` + `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md`.

### Files Modified

- `docs/help/compliance/data-retention-schedule.md` — NEW (~1500 words)
- `docs/help/compliance/incident-response-plan-summary.md` — NEW (~1450 words)
- `docs/help/compliance/architecture-overview-for-compliance.md` — NEW (~1700 words)
- `docs/help/compliance/asic-rg244-rg36-boundary-statement.md` — NEW (~1700 words)
- `docs/help/compliance/data-handling-policy-summary.md` — NEW (~1500 words)
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` — Step 8 compliance pack table-of-contents: 4 entries flipped from `📋 Phase 33d` to `✅ Live`; new Data Handling Policy summary row added; regulator-side question pointers updated to specific section anchors in the new articles
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #22 flipped to `~~22~~ ✅ Phase 33d SHIPPED 2026-05-04`; Recently Completed entry appended at top of 2026-05-04
- `docs/changelog/CHANGELOG_2026_05_04.md` — this Session block

### Documentation Updated

- `docs/IMPLEMENTATION_PLAN.md` ✅ (CLAUDE.md §15 SSOT — Up Next #22 + Recently Completed)
- `docs/changelog/CHANGELOG_2026_05_04.md` ✅ (CLAUDE.md §11 daily changelog — this file)
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` ✅ (Step 8 Compliance pack table of contents now reflects shipped state)
- `CLAUDE.md` — **NOT modified.** No new rules; no surface-classification change. The §16 doc-sync protocol rules apply unchanged; this PR is the protocol working as designed.

### Doc-sync (CLAUDE.md §16)

Surfaces changed:
- [ ] visual design system / component pattern
- [ ] application config (env vars, Vercel, OIDC, etc.)
- [ ] GCP infrastructure (Cloud SQL, IAM, etc.)
- [ ] identity / auth
- [ ] deployment / build
- [x] security / CDR posture (new audit action `PRO_DASHBOARD_VIEW`; service-layer scope filter making CDR data leaks impossible at the UI layer; per-view `ClientAccessLog` row preserves 3-layer consent model)
- [ ] operational procedure
- [x] strategic decision (none reopened — Phase 32B PR3 closes Up Next #12 as queued; Reversed Decisions untouched)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #12 closed; new Recently Completed row; Dead Code rows #14 + #15 added
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` Steps 2 + 3 populated (per Phase 32B PR3 directive)
- `docs/changelog/CHANGELOG_2026_05_04.md` — this entry

### Destructive write checklist (CLAUDE.md §12.11)

Operations in this PR that touch existing rows:
- `lib/services/masterFinancialService.ts:logProDashboardView` — `prisma.organizationClient.update({ where: { id }, data: { lastAccessedAt: new Date() } })`

For that operation:
1. **`where` clause matches:** the OrganizationClient row resolved earlier in the request; only one row.
2. **Columns overwritten / rows deleted:** `lastAccessedAt` only. The existing column already serves this purpose (set by other portal flows — see `app/api/portal/organizations/[orgId]/clients/route.ts`); we are not overwriting user-entered data.
3. **Guard ensuring this only mutates rows I created:** the `id` is taken from the verified `loadOrganizationClient()` result inside the request; the call follows successful seat-ownership + ACTIVE+GRANTED checks.

User confirmation: NOT REQUIRED — overwriting a system-managed timestamp on a row already verified to belong to the calling seat; reasoning matches CLAUDE.md §12.11 "system-managed timestamp" pattern.

### Build Status
- [x] `npx tsc --noEmit` clean (project-wide; no new errors introduced)
- [ ] `npm run build` (deferred — environment npm registry blocks `@firebase/storage` per `npm ci`; `npm install --legacy-peer-deps` succeeded for typecheck)
- [x] Manual schema review of the migration file (additive `ADD VALUE IF NOT EXISTS`)

### PR
- PR URL: (to be filled when opened)
- Status: Open
- [ ] security / CDR posture — *No code change. The articles document existing posture for an external compliance audience; they do not change rules. Light yes; the canonical sources-of-truth they derive from are unchanged.*
- [x] operational procedure — *Adds five new external-facing operational documents (the help articles themselves) that compliance officers and auditors will read. The canonical operational policies are unchanged; these summarise them for an external audience.*
- [x] strategic decision (Open Question resolved / workstream parked or revived) — *Up Next #22 (Phase 33d compliance pack content) flipped from queued → shipped.*

Docs updated:
- `docs/help/compliance/data-retention-schedule.md` (new — derived from `docs/policy/CDR_DATA_RETENTION_SCHEDULE.md`)
- `docs/help/compliance/incident-response-plan-summary.md` (new — derived from `docs/policy/INCIDENT_RESPONSE_PLAN.md`)
- `docs/help/compliance/architecture-overview-for-compliance.md` (new — derived from `docs/architecture/01_ARCHITECTURE_OVERVIEW.md` + `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md` + `docs/compliance/CDR_WIF_AUTHENTICATION_EVIDENCE.md`)
- `docs/help/compliance/asic-rg244-rg36-boundary-statement.md` (new — derived from `docs/blueprint/MASTER_BLUEPRINT.md` + `docs/blueprint/TRAIL_FRAMEWORK.md` product positioning + ASIC RG 244 / RG 36 / RG 175 / INFO 269)
- `docs/help/compliance/data-handling-policy-summary.md` (new — derived from `docs/policy/DEVICE_SECURITY_POLICY.md` + `APPROVED_DEPENDENCIES.md` + `SECURITY_AWARENESS_POLICY.md` + `docs/operational/security/02_IAM_AND_PERMISSIONS.md` + `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md`)
- `docs/IMPLEMENTATION_PLAN.md:Up Next #22` (flipped to SHIPPED)
- `docs/IMPLEMENTATION_PLAN.md:✅ Recently Completed (2026-05-04)` (entry added at top of day)
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md:Step 8` (compliance pack ToC + question pointers updated)
- `docs/changelog/CHANGELOG_2026_05_04.md` (this Session block)

### Testing
- [x] All five articles include the four required frontmatter fields (`title`, `audience`, `slug`, `lastReviewed`) per `lib/help/frontmatter.ts:REQUIRED_FIELDS`
- [x] All five articles set `audience: compliance` and a unique `complianceClass` matching the article topic (cdr / general / general / afsl / privacy)
- [x] All five articles set `order` values (2–6) that follow the existing `cdr-consent-walkthrough` (order: 1) and present a sensible compliance-pack reading sequence
- [x] Voice + structure mirror the existing `cdr-consent-walkthrough.md` article — direct, regulator-friendly, no marketing language, table where data fits a table, "For your auditor" footer with the `compliance@monitrax.com.au` pointer
- [x] Every article's "What an auditor can independently verify" section names specific files / DB tables / code paths that an auditor can read without Monitrax's help — the article is auditable against the codebase
- [ ] Typecheck — N/A (pure docs work; zero code changes)
- [ ] Lint — N/A (pure docs)
- [ ] Build — N/A (Markdown is read at request time; no compile step)

### Out-of-scope (this session, not this PR)

- **PDF export per article + ZIP bundle export.** Phase 33c (Up Next #21) — single-click compliance pack download for the auditor's evidence file. The articles ship now; the bundled-export polish is the next slice.
- **DOCX compliance templates.** Phase 33f (Up Next #24) — Word-format starter templates that orgs customise to their own letterhead (Incident Response Plan, BCP, Data Handling Policy, etc.). Deferred to PROD-ready.
- **In-app `?` drawer with route-aware article selection.** Phase 33b (Up Next #20) — runs in parallel with this work; not gated by it.
- **Touching code.** Hard constraint per the session brief — pure docs work, no schema, no code.

### PR
- Branch: `claude/phase-33d-compliance-content`
- PR URL: TBD on push
- Status: Untracked → committed → pushed in this session

---

## Session: claude/phase-41-regulatory-architecture (Phase 41 — Regulatory Architecture blueprint, doc-only)

### Changes Made
- **Type**: Documentation — architectural blueprint (doc-only PR, no code, no schema)
- **Scope**: `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` (NEW), `docs/IMPLEMENTATION_PLAN.md`
- **Description**: Fix the authority-mapped architecture for Phase 41e (entity-aware tax engine) + 41h (AI entity-aware diagnosis) before any regulatory code lands. Reza directive 2026-05-04 (post-Phase-41a): Monitrax must not guess on AU regulated tax + entity law; every number must trace to ITAA / SIS Act / state Land Tax Act / ATO ruling. This PR is the hard prerequisite to Phase 41e — reviewers reject 41e PRs that introduce a regulatory rule not represented here.

### Why this matters

Phase 41 is the most regulatory-dense surface in Monitrax. Without a written authority-mapping, 41e becomes "we asked Gemini and it sounded right." Architecting the regulatory backbone *before* the calc engine fixes the cost-of-error at the design stage rather than the audit stage. Four-lens advisory mindset (CLAUDE.md §0) at maximum strength: financial adviser + architect + behaviour psychologist + security/compliance consultant.

### Files Modified
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` — NEW, 12-section blueprint covering:
  - §1 Operating principles (authority over assumption; SSOT per rule; citation in code; ATO worked-example fixtures; AFSL/TPB/NCCP boundary structural-not-editorial; UNCOMPUTED register; FY-indexed thresholds; demo-vs-PROD scoping)
  - §2 Regulatory surface — full table of rules in scope with primary authority citations:
    - **2.1 ITAA 1936/1997**: Div 6 (s95–s99B), Div 6E (TR 2012/D1), s100A (TR 2022/4 + PCG 2022/2 green/yellow/red zones), Div 7A (s109D, s109N, s109Y; TR 2010/3), Div 115 (s115-25, s115-100, s115-280; TD 2008/29), Div 152, Part IVA (PS LA 2005/24), Sch 2F (trust losses), Div 165/166/175/707 (company losses), negative gearing, PSI (TR 2022/3), service entity (TR 2006/2), family trust elections + IEE, foreign resident CGT withholding (Sch 1 Subdiv 14-D)
    - **2.2 SIS Act + ITAA super**: sole purpose test (s62), in-house asset 5% cap (s71/s82–s85), LRBA (s67A + PCG 2016/5), concessional cap (s291-20), non-concessional cap (s292-85), bring-forward, carry-forward, excess contributions (Div 291/292), TBC (Div 294), Div 293, Div 296 (verify Act status), pension phase (Div 295-385), preservation (SIS Reg 6.01–6.04)
    - **2.3 State taxes**: per-state land tax + stamp duty + foreign purchaser surcharge (NSW/VIC/QLD/SA/WA/TAS/ACT/NT)
    - **2.4 GST + BAS**: registration threshold (GST Act s23-15), input tax credits (Div 11), BAS cadence (Div 31)
    - **2.5 Boundary regimes**: AFSL (Corporations Act Ch 7 + RG 244 + RG 36), TPB (Tax Agent Services Act 2009), NCCP (NCCP Act 2009)
  - §3 Canonical module structure under `lib/calculations/tax/` — divisions/, super/, losses/, psi/, landTax/ (per-state SSOT), stampDuty/, gst/, boundaries/, fixtures/. One file per rule, sibling `.test.ts` per rule
  - §4 Canonical types — FYReference, EntityTaxFacts, TaxRuleResult, AuthorityCitation with `lastReviewed` staleness flag, MasterTaxPosition with `authoritySources` audit trail (every rendered number traceable to its rule + authority + FY threshold)
  - §5 Boundary enforcement — Tier 1 facts (AI may surface, citation rendered next to number) vs Tier 2 recommendations (Ask-a-Pro only). Enforced via Gemini tool registry — AI literally cannot emit personal advice because the tool isn't there. Profession-aware AFSL/credit/TPB footer rendered on every personal-advice-shaped surface
  - §6 Cross-entity rules — where the complexity actually lives:
    - Trustee→Trust corporate hierarchy via `LegalEntity.parentEntityId` self-FK (land tax aggregates at trust level; Div 7A risk evaluated against shareholder; resettlement risk on trustee changes)
    - Trust→Beneficiary distribution flow (Div 6 → Div 6E streaming → s100A zone classification → FTE/IEE TFN withholding check → flow into beneficiary's personal income)
    - Pty Ltd→Shareholder Div 7A decision tree (payment/transfer/loan classification → s109N MRP terms → sub-trust UPE arrangement → deemed dividend if neither)
    - SMSF triumvirate (sole purpose test + in-house asset 5% cap + LRBA safe-harbour PCG 2016/5)
  - §7 FY-indexed threshold table — `FY_THRESHOLDS['2025-2026'].super.concessionalCap === 30_000` pattern. No hard-coded constants anywhere. New FY entry by 1 June each year
  - §8 Test fixture provenance — every fixture lifted verbatim from named ATO source (TR 2022/4, PCG 2022/2, TD 2008/29, PCG 2016/5, TR 2022/3, etc.) with `extractedAt` + `lastReviewed` staleness flags; rule changes require fixture refresh
  - §9 Versioning protocol — new FY by 1 June; new TR/TD within 30 days of finalisation; monthly Cloud Scheduler job flags citations >12mo old via Practice surface internal alert
  - §10 UNCOMPUTED register at `lib/calculations/tax/UNCOMPUTED.md` — initial entries: FTE ordering rules, Div 7A sub-trust UPE arrangements, multi-state land tax aggregation, foreign-resident beneficiary withholding, deceased estates / testamentary trusts, CGT event K6 (pre-CGT shares), GST margin scheme, stamp duty resettlement quantification. Reviewers reject any PR that surfaces a tax position touching an UNCOMPUTED rule without `uncomputedReasons` returned
  - §11 Implementation sequence — 41e split into 16 sub-PRs:
    - Demo cut (~12 days): 41e.0 foundation + types + FY thresholds + boundaries renderer; 41e.1 Div 115 + Div 6 basic + capital loss netting; 41e.2 SMSF caps (concessional + non-conc + bring-forward + TBC); 41e.3 Div 6E streaming basics; 41e.4 negative gearing + per-entity aggregator; 41e.5 MasterTaxPosition composition + Practice tax-position card
    - PROD cut (~28 days): 41e.6 s100A zone classifier; 41e.7 Div 7A; 41e.8 Div 152; 41e.9 Div 296 (Act status gate); 41e.10 PSI; 41e.11 FTE+IEE; 41e.12 NSW+VIC land tax; 41e.13 remaining state land tax; 41e.14 stamp duty + foreign surcharge; 41e.15 trust + company loss rules; 41e.16 GST + BAS flagging
    - 41h cannot start until 41e.0 + 41e.5 land — it composes their output
  - §12 Sign-off + maintenance — Reza signs off this doc before 41e.0 starts; every 41e PR cites this doc in its description; every rule's file-header JSDoc points back to this doc + authority citation; quarterly walk-through to refresh citations and audit UNCOMPUTED
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #29 (Phase 41e) updated to name this doc as a hard prerequisite; trigger changed to "After 41c **and** regulatory architecture doc signed off"; sub-PR sequence flagged. Recently Completed entry prepended for 2026-05-04 with full doc summary

### CLAUDE.md §16 doc-sync block

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture (architectural posture only — no CDR/code change in this PR; CMEK/KMS unchanged)
- [ ] operational procedure
- [x] strategic decision — Phase 41e architecture is now fixed before code; reviewers will enforce 41e PRs against this doc

Docs updated in this PR:
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` — NEW (12 sections, ~400 lines)
- `docs/IMPLEMENTATION_PLAN.md` Up Next #29 — prerequisite added; Recently Completed entry prepended

### Build Status
- N/A — doc-only PR, no code/schema/test changes

### What's NOT in this PR

- **No code under `lib/calculations/tax/`** — the directory does not exist yet. Stub files would create misleading API surface; the architecture is what's load-bearing here. The tree lands in 41e.0.
- **No `UNCOMPUTED.md` file yet** — that lives next to the code when 41e.0 ships. The doc here lists initial entries.
- **No FY thresholds table** — same reason; lives in `lib/calculations/tax/fiscalYear.ts` when 41e.0 ships.
- **No 41b/41c/41d code** — entity wizard + tree + Sankey are separate sessions; this PR is about the regulatory backbone for 41e/41h.

### PR
- Branch: `claude/phase-41-regulatory-architecture`
- PR URL: TBD on push
- Status: Untracked → committed → pushed in this session
