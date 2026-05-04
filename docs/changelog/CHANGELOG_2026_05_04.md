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

### Status at session close (final)

- 3 commits pushed on `claude/review-monitrax-docs-8HM3K`:
  - `cebfdc5` — PR1 code (schema + Practice components +
    lighthouse demo dataset + dead code removal)
  - `0e9a31f` — Strategic addendum 1 (single-voice + marketplace
    + Ask-a-Professional + in-app comms; two-voice rejected)
  - `440a17c` — Strategic addendum 2 (Xero-style Org pricing +
    Phase 33 Help/Training/Compliance queued)
  - (plus this final addendum 3 commit covering tier naming +
    parallel work + anti-poaching)
- All Phase 32B / 32C / 33 strategic decisions LOCKED.
- No open questions remaining for next session start.
- Next session work: BOTH Up Next #13 (Phase 32B PR2) AND Up Next
  #21 (Phase 33a) can start immediately, in parallel.
- Lighthouse adviser pitch demo unblocked at end of PR2 (~3 dev
  days from next session start).
