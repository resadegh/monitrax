# 📘 **02 — DESIGN PRINCIPLES**  
### *Monitrax System Design Philosophy & Product Doctrine*

---

## **1. Purpose**

This document defines the **design principles**, **product philosophy**, and **core rules** that govern every decision in the Monitrax ecosystem — UI, backend, intelligence, navigation, and data structures.

These principles ensure that the system stays:

- consistent  
- predictable  
- scalable  
- extensible  
- secure  
- future-proof  
- AI-compatible  

This is the **north star** for all design and engineering work.

---

## **2. Design at Monitrax — Foundational Themes**

Monitrax follows five foundational design themes:

### **2.1 Intelligence-First**
Every feature must elevate the user’s financial intelligence.

- Default screens show insights, not raw data.  
- Numbers are converted into meaning.  
- We treat *clarity* as a feature.

### **2.2 Relationship-Driven**
The system is built around **how financial entities relate to each other**, not isolated modules.

- All modules feed into GRDCS.  
- Cross-module navigation is first-class.  
- The relational graph is the brain of the system.

### **2.3 Canonical Everything**
There must always be exactly **one canonical representation** of truth for:

- entities
- relations
- paths
- IDs
- navigation
- financial metrics
- **documentation** (`docs/blueprint/` is the single source)

Duplicated logic is an architectural failure.
Duplicated documentation is a maintenance nightmare.

### **2.4 Predictable By Design**
No hidden mutations, no inconsistent behaviours, no “magic.”

- Same action → same outcome, everywhere.  
- Every component follows strict rules.  
- Every module uses shared engines.  
- Navigation is deterministic.

### **2.5 Extensibility as a Requirement**
Nothing should be built in a corner.

- Every feature must be extendable.  
- No design dead-ends.  
- Modules must operate independently and together.  

---

## **3. Product Experience Principles**

### **3.1 Zero Dead-Ends**
Every screen leads somewhere.  
Every insight has an action.  
Every warning has a resolution path.

### **3.2 Everything is a Drill-Down**
Users must be able to move:

property → loan → expense → transaction → account → holding → income → property

This is the core promise of Monitrax.

### **3.3 Minimise Cognitive Load**
We display:

- the **minimum data** needed for understanding  
- the **maximum clarity** possible  

This means:

- summarise aggressively  
- hide noise  
- emphasize what matters  
- automate rote tasks  

### **3.4 Consistent Interaction Patterns**
All dialogs share:

- the same layout
- tabs on top
- linked data tab
- insights tab
- consistent CTAs
- the same button placement
- universal close & back rules

The user should never have to "relearn" anything.

### **3.5 No Duplicate Numbers Across Pages**
> **Added Jan 2026 - Phase 17B**

Each number should appear in **exactly one primary location** in the app. Summary pages (like CFO Dashboard) should show:

- **Actionable insights**, not raw data duplicates
- **Links** to detailed pages instead of copying their content
- **Unique metrics** not shown elsewhere

**Bad Examples:**
- ❌ CFO page showing "Total Debt: $500k" when Debt page already shows this
- ❌ Tax Position tile duplicating numbers from Tax Dashboard
- ❌ Loan insights repeating portfolio totals from Loans page

**Good Examples:**
- ✅ CFO page showing "3 refinance opportunities - save $2,400/year" with link to Loans
- ✅ Tax tile showing "EOFY action needed" alert with link to Tax Dashboard
- ✅ Loan insights showing "Fixed rate expiring in 45 days" alert

**The Rule:**
If a number already has a "home" page, the summary tile should:
1. Show the **insight/action** derived from that number
2. Provide a **link** to the detail page
3. **NOT** repeat the raw number itself

---

## **4. UI & UX Design Principles**

### **4.1 Layout Hierarchy**
Monitrax UI uses a **4-tier hierarchy**:

1. Global: header, breadcrumbs, health indicator  
2. Module level: tables, summary blocks  
3. Entity level: dialogs  
4. Insight level: inline cards, warnings  

### **4.2 Visual Language**
Monitrax follows a visual language based on:

- clarity  
- minimalism  
- structured whitespace  
- subtle elevation  
- distinct severity colours  
- neutrals for data, colours for meaning  

### **4.3 Motion Rules**
Animation must:

- be intentional  
- support understanding  
- never distract  
- reinforce navigation context  

Examples:

- breadcrumb transitions  
- modal expansion  
- hover states  
- severity badges pulsing on critical insights  

### **4.4 Responsiveness — Three-Tier Standard**

> **Canonical implementation:** `docs/architecture/06_UI_UX_FOUNDATION.md` §12.
> **Single source of truth for nav structure:** `lib/navigation/trailNav.tsx`.
> **Reusable mobile primitives:** `components/shell/MobileTabBar.tsx`,
> `components/shell/SectionTabsRow.tsx`, `components/shell/MoreSheet.tsx`.

Monitrax targets **three** viewport tiers, not two. The same brand tokens
(warm-ivory, brand primary, emerald accents, glass tile, `appleEase`
motion) and the same TRAIL nav SSOT power all three — only the
*presentation* of the nav changes per tier. The theme never forks.

| Tier | Range | Primary nav | Sub-tab nav | Example device |
|---|---|---|---|---|
| **Phone** | `<md` (<768px) | Bottom tab bar (`<MobileTabBar />`) — 5 tabs mapped to TRAIL stages (Home · Track · Reduce · Invest · Guide) | Horizontal pill row (`<SectionTabsRow />`) at top of section pages | iPhone, Pixel |
| **Tablet** | `md`–`lg` (768–1023px) | Persistent left sidebar — same component as desktop | Sidebar-accordion (parent expands when active) | iPad portrait |
| **Desktop** | `≥lg` (≥1024px) | Persistent left sidebar | Sidebar-accordion | Laptop, monitor |

#### Hard rules

1. **One nav SSOT.** `lib/navigation/trailNav.tsx` is the *only* place top-level nav items, sub-tabs, match-routes, TRAIL stages, and stage tone tokens are defined. The mobile bottom bar derives 5 tabs from this file; the sidebar reads the full list. Never duplicate the structure inside a component.
2. **Theme parity.** A phone user, an iPad user, and a desktop user are looking at the SAME brand tokens, the SAME glass tile vocabulary, and the SAME `appleEase` motion. Only the nav chrome rearranges. No mobile-only colour palette, no tablet-only typography stack.
3. **One-tap reach for sub-tabs on phones.** A phone user must NEVER need two taps to reach a sub-tab. Tap a bottom tab → land on the section's default sub-tab → see the sub-tab pill row → swap sub-tabs in one tap. The legacy hamburger-then-tap-then-tap-again pattern is permanently retired (CLAUDE.md `↩️ Reversed Decisions`).
4. **iPad gets the desktop sidebar, not the phone tab bar.** The breakpoint that gates the sidebar is `md:` (768px), not `lg:` (1024px). iPad portrait (810px) is large enough for the persistent rail; the phone tab bar is only for true phones.
5. **Tap targets ≥44pt (Apple HIG).** Bottom tab bar buttons are ≥56px tall. Sub-tab pills are ≥40px tall. Any new mobile interactive surface must meet the same floor.
6. **Dialogs become full-screen sheets on phones** — bottom-sheet pattern from `06_UI_UX_FOUNDATION.md` §15.3. Same body-scroll lock, same Esc-to-close, same `prefers-reduced-motion` respect.
7. **Tables degrade gracefully** — virtualised + filterable on desktop, card-stacked on mobile (existing rule, retained).
8. **Reviewers must reject** any new mobile surface that re-rolls the bottom-tab-bar or sub-tab-pill pattern instead of importing `<MobileTabBar />` / `<SectionTabsRow />` from `components/shell/`.

#### Why this is non-negotiable

The phone is where most users will check Monitrax (financial-stress UX research, Mani et al. 2013 — the moment of cognitive load is on the bus, not at the desk). Visible nav, one-tap reach, and persistent TRAIL framing are the difference between a user who comes back tomorrow and a user who doesn't. CLAUDE.md §0 (advisory mindset) elevates the behavioural-psychologist lens here: the IA *is* the intervention.

---

## **5. Technical Design Principles**

### **5.1 Never Duplicate Logic**
If logic appears twice, it must become:

- a utility
- an engine
- or a shared component

**Canonical Utility Locations:**

| Logic Type | Location | Functions |
|------------|----------|-----------|
| **ALL FINANCIAL DATA** | `lib/services/masterFinancialService.ts` | `getMasterFinancialSnapshot()` |
| **Budget vs Actual** | `lib/services/masterFinancialService.ts` | `calculateActualFromTransactions()`, `getMonthlyActualsMap()` |
| Currency formatting | `lib/utils/formatters.ts` | `formatCurrency()` |
| Frequency conversion | `lib/utils/frequencies.ts` | `toAnnual()`, `toMonthly()`, `periodsPerYear()` |
| Ownership validation | `lib/utils/ownership.ts` | `verifyOwnership()`, `verifyRelatedOwnership()` |
| Transaction reconciliation | `lib/utils/reconciliation.ts` | `detectFrequency()`, `analyzeTransactionPattern()`, `findBestMatch()`, `calculateBudgetVariance()` |
| Net worth calculation | `lib/calculations/netWorthCalculator.ts` | `calculateNetWorth()`, `calculateTotalAssets()` |
| Cashflow calculation | `lib/calculations/cashflowOrchestrator.ts` | `calculateCashflow()`, `calculateMonthlyCashflow()` |
| Expense aggregation | `lib/calculations/expenseAggregator.ts` | `aggregateExpenses()`, `aggregateExpensesByCategory()` |
| Income aggregation | `lib/calculations/incomeAggregator.ts` | `aggregateIncome()` |
| Loan aggregation | `lib/calculations/loanAggregator.ts` | `aggregateLoanRepayments()`, `calculateLVR()` |

**CRITICAL: Before adding ANY calculation logic to a file:**
1. Check if it exists in the Master Financial Service (`lib/services/masterFinancialService.ts`)
2. If not, check if it exists in the calculation utilities above
3. If adding new calculations, add them to the Master Financial Service, NOT to individual API routes  

### **5.2 API Responses Must Be Canonicalised**
Every API route must:

- use GRDCS  
- return canonical entity shapes  
- include linkedEntities  
- include relational metadata  

### **5.3 Engines Must Be Pure**
Domain engines must:

- accept data  
- compute outputs  
- NEVER mutate global state  
- NEVER fetch  

### **5.4 Navigation Must Be Stateless**
No persistent client memory except:

- navStack  
- tabState  
- scrollState  

Everything else must be ephemeral.

### **5.5 React Components Must Be Stateless or Minimally Stateful**
No derived state.  
No unnecessary re-renders.  
Hooks handle all data fetching.

### **5.6 Strict Module Boundaries**
Properties cannot fetch Loans.  
Loans cannot fetch Accounts.  
All modules request from:

- snapshot engine  
- insights engine  
- or their own API  

Nothing else.

---

## **6. Data & Intelligence Principles**

### **6.1 GRDCS is the Backbone**
All engines depend on:

- consistent IDs  
- consistent shapes  
- predictable relations  

### **6.2 Master Financial Service is the Single Source of Financial Truth**

> **CRITICAL DESIGN PRINCIPLE (Updated Jan 2026)**

Everything requiring financial numbers **MUST** come from:

- **API Endpoint:** `/api/master-snapshot`
- **Service Function:** `getMasterFinancialSnapshot()` from `lib/services/masterFinancialService.ts`

**DO NOT:**
- Calculate expenses/income/cashflow directly in API routes
- Query database and aggregate financial data manually
- Create new calculation logic outside the Master Financial Service

**DO:**
- Use `getMasterFinancialSnapshot(userId)` for ALL financial data needs
- Use convenience getters: `getNetWorth()`, `getMonthlyCashflow()`, `getQuickMetrics()`, etc.
- Extend the Master Financial Service if new calculations are needed

**What the Master Financial Service provides:**
| Category | Data |
|----------|------|
| Net Worth | Assets, liabilities, breakdown by type |
| Expenses | All, recurring, non-recurring, essential, discretionary, tax-deductible, by category |
| Income | All, primary, secondary, passive (monthly & annual) |
| Cashflow | Income, expenses, loan repayments, net cashflow, savings rate |
| Debt | Total principal, monthly repayments, debt-to-income, debt service ratio |
| Properties | Per-property metrics: LVR, equity, rental yield, cashflow |
| Investments | Total value, cost base, unrealised gains, allocation |
| Tax | Estimated taxable income, tax payable, deductions, PAYG |
| Emergency Fund | Liquid cash, months covered, gap, status |
| Health Score | 0-100 score, grade, component breakdown |

**Migration:**
Legacy `/api/portfolio/snapshot` still works for GRDCS linkage health but should delegate to the Master Financial Service for all financial calculations  

### **6.3 LinkageHealth is the Single Source of Relational Truth**
Missing or invalid relationships must always be detected there.

### **6.4 Insights Engine is the Single Source of Meaning**
Other modules must *not* compute their own heuristics.

### **6.5 Data Preservation is Mandatory**

**CRITICAL RULE: Never delete data or database tables without explicit user verification.**

> ⚠️ **INCIDENT (Feb 2026)**: Automated `prisma db push` in build scripts nearly deleted legacy tables with user data. Build scripts were modified to remove automatic schema sync.

This principle applies to:
- Schema migrations that drop tables or columns
- Database cleanup operations
- Deployment scripts that may affect existing data
- Any operation using `--accept-data-loss` or similar flags
- Adding placeholder models for tables you haven't verified

**Requirements:**
1. **NEVER include `prisma db push` in automated build scripts** — Schema changes must be manual
2. Before any schema change that would drop tables or columns, explicitly verify with the user
3. Always back up data before destructive operations
4. Prefer soft deletes over hard deletes for user data
5. If data loss is unavoidable, document what will be lost and get explicit approval
6. Maintain audit trails for all data deletion operations
7. **Verify table structures before adding models** — Don't assume column definitions

**Build Script Configuration (MANDATORY):**
```json
// CORRECT - Database is NEVER touched during build
"build": "prisma generate && next build"

// WRONG - Can accidentally delete tables not in schema
"build": "prisma generate && prisma db push && next build"

// EXTREMELY DANGEROUS - Will delete any table/column not in schema
"build": "prisma generate && prisma db push --accept-data-loss && next build"
```

**Schema Sync Procedure (Manual Only):**
1. Create database backup via Render Dashboard
2. Review what `prisma db push` will do: `npx prisma db push --preview-feature`
3. If it shows DROP statements, STOP and verify with user
4. Only proceed if changes are additive (CREATE, ALTER ADD)
5. Run via Render Shell: `npx prisma db push`
6. Verify application works correctly

**Legacy Tables Policy:**
- Tables in database but not in schema are PRESERVED
- Do not add placeholder models without verifying actual column structure
- Schedule periodic audits to clean up truly unused tables
- Document all legacy tables in `09_INFRASTRUCTURE_AND_DEPLOYMENT.md`

---

## **7. Documentation Principles**

### **7.1 Single Source of Truth**
The `docs/blueprint/` folder is the **canonical source** for all system documentation.

- All architectural decisions, specifications, and design patterns MUST be documented in `docs/blueprint/`
- External references MUST point to the blueprint folder, never duplicate content
- Blueprint documents are versioned and authoritative

### **7.2 Documentation Hierarchy**

| Location | Purpose | Examples |
|----------|---------|----------|
| `docs/blueprint/` | **Canonical specifications** | Architecture, API standards, design principles |
| `docs/` (root) | **Operational documents** | Audit reports, setup guides, changelogs |
| `README.md` | **Entry point** | Links to blueprint, quick start |
| Code comments | **Implementation notes** | Why, not what |

### **7.3 Never Duplicate Blueprint Content**
If documentation exists in `docs/blueprint/`, it MUST NOT be duplicated elsewhere.

- ❌ Don't create `docs/MASTER_BLUEPRINT.md` (duplicate)
- ✅ Reference `docs/blueprint/MASTER_BLUEPRINT.md` instead
- ❌ Don't copy API specs into README
- ✅ Link to `docs/blueprint/07_API_STANDARDS.md`

### **7.4 Document Types**

| Type | Location | Update Frequency |
|------|----------|------------------|
| **Specifications** | `docs/blueprint/*.md` | On design changes |
| **Phase Docs** | `docs/blueprint/PHASE_*.md` | On feature completion |
| **Changelogs** | `docs/blueprint/CHANGELOG_*.md` | Per release |
| **Audit Reports** | `docs/AUDIT_*.md` | Per audit cycle |
| **Setup Guides** | `docs/*-SETUP.md` | On dependency changes |

### **7.5 AI/LLM Context Rule**
When providing context to AI assistants (Claude, Copilot, etc.):

- Always reference `docs/blueprint/` as the authoritative source
- Include the blueprint folder URL for full context
- Never summarize blueprint content into separate documents

---

## **8. Security Principles**

### **8.1 Defense in Depth**
Security enforced at every layer:

- Authentication (JWT tokens)
- Authorization (ownership validation)
- Input validation (Zod schemas)
- Output sanitization
- Rate limiting
- Audit logging

### **8.2 Principle of Least Privilege**
Every component has minimum required access:

- API routes validate ownership
- Database queries scoped to user
- Feature flags control access
- Admin roles are granular

---

# **§9 — B2B2C Design Doctrine (added 2026-05-09)**

The Phase 32B/32C B2B2C surface introduced design rules that hold
across the new modules. These extend the foundational principles
above without contradicting any of them.

## **§9.1 — Single canonical engine, scope as parameter**

The most important architectural rule of the B2B2C build: **never
fork the canonical engine to add a new caller scope.** When the
adviser drill-in needs scope-filtered financial data, we did NOT
create `getMasterFinancialSnapshotForAdviser()`. We added a
`viewerContext` parameter to the existing
`getMasterFinancialSnapshot()` function.

The same rule applies to:
- `marketplaceService.ts` — three caller scopes (Org / admin / public) on one canonical service
- `professionalRequestService.ts` — submit / accept / decline / withdraw on one canonical service
- `conversationService.ts` — consumer + professional viewers share `assertParticipant` access gate

**Why this matters:** forking the engine introduces drift risk. Two
copies of "what does net worth mean?" mean two places where the
calculation can diverge. The parameter pattern means a bug fix in
the canonical engine fixes both consumer and adviser views
simultaneously.

## **§9.2 — Server-side guardrails, not UI-side**

The leaky-funnel guardrail (org-attached users never see the public
marketplace) and the AFSL/credit/TPB licence boundary (Monitrax's
AI never gives personal advice) are enforced at the **service
boundary**, not in the UI.

A leaky-funnel implemented in the UI is a UI bug waiting to happen.
A leaky-funnel implemented in the service rejects with `403
ORG_USER_PUBLIC_BLOCKED` regardless of which UI calls it.

This pattern is universal in the B2B2C surface:
- Webhook signature verification at the route boundary
- `assertParticipant` access gate at the service boundary
- Plan-tier feature gating via `withPortalFeatureGate`
- PORTAL_OWNER-only commercial actions enforced in the route handler

## **§9.3 — Frozen-at-write-time for audit accuracy**

Some fields must not change after they're written, even if the
upstream source changes:

- `ConversationMessage.senderRole` — frozen at send time so audit
  shows "sent as PROFESSIONAL" even if the person leaves the org.
- `ProfessionalRequest.leadFeeAmount` + `.leadFeeTier` — frozen at
  submit-time so listing-side rate edits don't retroactively change
  in-flight requests.
- `ConversationMessage.retentionUntil` — frozen at write-time at
  `createdAt + 7 years` so retention policy changes don't shorten
  the existing compliance archive.

**Pattern:** when storing a value that's derived from another
mutable source, always store the resolved snapshot, not the
reference. The reference can drift; the snapshot is canonical.

## **§9.4 — Best-effort post-transaction follow-ups**

When a primary action (e.g. `acceptRequest`) succeeds, several
secondary actions follow:
- Conversation auto-create
- Lead-fee Stripe Invoice creation
- Audit log row write

These secondary actions run AFTER the primary transaction commits.
Failure of any secondary action does NOT roll back the primary;
operations team can re-run the secondary idempotently.

**Why:** keeps the data model honest. The accept lifecycle transition
+ ClientLink upsert run in a single `$transaction` so a half-applied
state is impossible. Adding the Stripe API call inside that
transaction would mean a Stripe outage rolls back the accept —
which is wrong: the engagement is recorded, the lead-fee billing
intent is recorded, and ops can retry the invoice creation.

## **§9.5 — Idempotency at the database boundary**

Every webhook handler dedupes via DB unique constraints:
- `StripeWebhookEvent.stripeEventId` UNIQUE
- `ConversationMessage` unique-key inferred from `inboundFromEmail` + `createdAt`

Every "create or update" path uses upsert with deterministic IDs:
- Pitch fixture seed uses `lh-<archetype>-<entity-type>-<index>` IDs
- Migration backfills use `IS NULL` guards
- Service-layer creates use `findFirst` + early-return patterns

**Pattern:** any operation that might run twice (due to retry,
re-delivery, or re-deploy) is idempotent at the lowest practical
layer. The DB unique constraint is the cheapest enforcement; the
service-layer check is the friendliest UX.

## **§9.6 — Dev/demo graceful degradation**

Every external-service integration falls through gracefully when its
env var is unset:
- `isStripeConfigured()` returns false → billing UI renders friendly notice
- `SENDGRID_API_KEY` unset → outbound mirror logs to console + writes audit row
- `GEMINI_API_KEY` unset → AI advice surfaces show fallback content

The architectural pattern is visible (auditors / future engineers
can see how the integration would work) without requiring real
credentials in dev/demo environments. This makes the demo runnable
on any developer's machine without secret distribution.

## **§9.7 — TRAIL stage classification is consumer-truth-driven**

The adviser-facing surface NEVER overrides the consumer's TRAIL
stage classification. If Sarah is in TRACK from her own dashboard,
Reza @ Smithfield Wealth sees her as TRACK too. The framework is
behavioural; advisers see the same behavioural truth the consumer
sees.

Architecturally enforced: the adviser drill-in passes `viewerContext`
to `getMasterFinancialSnapshot()`, which scopes the data shown, but
the **stage classification logic is the same code path** that runs
for the consumer. There is no `getAdviserStageForClient()` parallel
function.

See `docs/blueprint/TRAIL_FRAMEWORK.md` Appendix C for the full
exposition.
