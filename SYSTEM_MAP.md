# SYSTEM_MAP.md — Monitrax Pointer Map

> **What this is:** a one-screen orientation map of the whole system — what Monitrax is, every
> authoritative doc and the one thing it owns, the architecture shape, the single calc engine, and
> the tool stack. It is **pointers + one-line authority per source, never copied content** (CLAUDE.md
> §12.2 SSOT). When a pointer and its target disagree, the target wins — re-pull and fix the pointer.
>
> **Reading order:** `STATE.md` (you-are-here cursor) → this file (what-owns-what) → the canonical
> source you need. `docs/00_INDEX.md` is the exhaustive doc registry; this file is the curated map.
>
> **Pinned to HEAD:** `3eaeb90` · **verified:** 2026-06-14 (Cowork — Phase 1 deep ingestion).
> Every line below was read live at this HEAD. If live `git rev-parse HEAD` differs, re-verify before trusting.

---

## 1. What Monitrax is

Monitrax (monitrax.com.au) is an **Australian Wealth Operating System** — property, loans, super,
investments, cashflow, tax position and entity structures in one picture so a user can model the next
move. Built by Reza under ReNew Holding Company Pty Ltd (ACN 675 267 311).

**Regulatory boundary (HARD):** a financial *information* service, **NOT** a licensed adviser. It
surfaces maths and mechanisms; it never gives personal financial product advice, recommends products,
or implies licensing not held. Respects the AFSL / Credit / Tax boundary + CDR.
→ Authority: `STATE.md` §A · `docs/marketing/gtm/REVIEW_SCOPE_AND_BOUNDARIES.md` (Corporations Act
2001 Ch.7 general-vs-personal-advice line) · `docs/blueprint/MASTER_BLUEPRINT.md` (north-star detail).

**Core identity framework:** TRAIL — Track · Reduce · Anchor · Invest · Live.
→ Authority: `docs/blueprint/TRAIL_FRAMEWORK.md`; enforced as IA in CLAUDE.md §14.

---

## 2. Governance & continuity (authority order)

When anything conflicts, the higher line wins.

| Source | Owns (the one thing) |
|---|---|
| `CLAUDE.md` (root) | **Law.** Governance, four-lens mindset, SSOT + single-calc-engine rule, session protocol, PR/doc-sync gates (§15 plan protocol, §16.5 PR doc-sync block, §17.2 post-merge verify). |
| `STATE.md` (root) | **You-are-here.** Current cursor + the universal session ritual (START/DURING/END). Pointers + position only. |
| `SYSTEM_MAP.md` (root, this file) | **What-owns-what.** Curated orientation map across docs + code. |
| `docs/IMPLEMENTATION_PLAN.md` | **Status SSOT.** Active / Up-Next / Blocked / Open-Questions / Dead-Code / Reversed / Recently-Completed. (884 KB — range-read.) |
| `docs/00_INDEX.md` | **Doc registry.** The exhaustive map of every doc (note: see findings — currently stale vs. live tree). |

---

## 3. Architecture (the "what / why") — `docs/architecture/*`

One-line authority per doc (descriptions per `docs/00_INDEX.md`, verified present at HEAD):

| Doc | Owns |
|---|---|
| `00_OVERVIEW.md` | System overview, vision, guiding principles |
| `01_ARCHITECTURE_OVERVIEW.md` | Technical architecture — the 7-layer design |
| `02_DESIGN_PRINCIPLES.md` | Core design philosophy + SSOT rules |
| `03_DATA_MODEL.md` | Entity relationships, canonical contracts (Prisma: 130 models, `prisma/schema.prisma`) |
| `04_GRDCS_SPECIFICATION.md` | Global Relational Data Consistency System (entity contract: id/type/name/href/metadata/links) |
| `05_CROSS_MODULE_NAVIGATION.md` | CMNF cross-module navigation spec |
| `06_UI_UX_FOUNDATION.md` | UI patterns + component standards |
| `07_API_STANDARDS.md` | API design, auth, validation, universal response envelope |
| `08_BRAND_UI_DESIGN.md` | Visual design system + brand guidelines |
| `09_INFRASTRUCTURE_AND_DEPLOYMENT.md` | Infrastructure + deployment architecture |
| `99_APPENDIX_GLOSSARY.md` | Terminology reference |
| `AI_PROVIDER_STRATEGY.md` | AI provider strategy (Gemini decision; **not yet listed in 00_INDEX** — see findings) |

**Module-boundary rule (CLAUDE.md §6.3):** modules never fetch each other directly; they request from
the Snapshot engine, the Insights engine, or their own API. Financial engines are **pure** (raw in →
structured out; no global mutation, no external fetch — §6.4).

---

## 4. The single calculation engine — `lib/` (CLAUDE.md §6.1–6.2, §12.2–12.3)

**The rule:** every financial number has exactly ONE canonical source; API routes are thin wrappers
(validate → call engine → return). Never inline a calc in a route or component, never hand-derive a
number.

**Orchestrator (entry point):** `lib/services/masterFinancialService.ts` → `getMasterFinancialSnapshot()`
(API: `/api/master-snapshot`). The canonical "what's my position right now?" — totals, expense/income
breakdowns, cashflow, emergency fund, health score, tax summary, property/investment metrics, quick
metrics. Targeted getters: `getNetWorth` / `getMonthlyCashflow` / `getQuickMetrics` / `getHealthScore`
/ `getTaxSummary` / `getPropertyMetrics` / `getInvestmentMetrics`.

**Second snapshot SSOT (NOT a duplicate):** `app/api/portfolio/snapshot` → `lib/intelligence/insightsEngine.ts`
returns `SnapshotV2` — the relational/graph view (per-entity GRDCS `_links`/`_meta`, `linkageHealth`,
`moduleCompleteness`, `relationalInsights`). Different scope from master; do not delete as a "dup"
(CLAUDE.md §12.2, confirmed PR #598).

**Pure calculators — `lib/calculations/`:**

| Module | Computes |
|---|---|
| `netWorthCalculator.ts` | Net worth (canonical) |
| `cashflowOrchestrator.ts` | Cashflow (canonical) |
| `expenseAggregator.ts` | Expense aggregation (canonical) |
| `incomeAggregator.ts` | Income aggregation (canonical) |
| `loanAggregator.ts` | Loan / debt aggregation (canonical) |
| `entityBreakdown.ts` | Phase 47 — partitions raw rows by LegalEntity (Entity Ownership Fabric) |
| `entityValueBreakdown.ts` | Net value contributed per LegalEntity |
| `netWorthHistory.ts` | Monthly net-worth trend from `NetWorthSnapshot` store |
| `moneyStoryTrend.ts` | 12-month earned-vs-spent buckets (FreedomRibbon chart) |
| `index.ts` | Centralised re-export surface |

**Engine families (each its own SSOT):**

| Path | Owns |
|---|---|
| `lib/tax-engine/` | AU Tax Intelligence Engine (Phase 20+): core (PAYG, Medicare, offsets, income tax), super/caps, CGT divisions, land tax / stamp duty / GST, trust & company loss rules, `orchestrator/masterTaxPosition.ts` |
| `lib/cfo/` | Personal CFO Engine (Phase 17): What-If scenarios, action engine, AI advisor, intelligence engine, risk radar, score calculator |
| `lib/health/` | Financial Health Engine: category scoring, metric aggregation, risk modelling → `generateHealthReport()` |
| `lib/cgt/` | Capital Gains Tax engine (cost base + CGT calc) |
| `lib/cashflow/` | Cashflow Optimisation Engine: forecasting, income normaliser, insights, optimisation, savings opportunities |
| `lib/intelligence/` | Intelligence Module: insights engine (SnapshotV2), portfolio engine, entity insights, linkage health |
| `lib/wealthCheck/` | Phase 46 `/wealth-check` calculator + levers (public hook surface) |
| `lib/decimal/` | Q-DEC precision foundation — `toDecimal`/`fromDecimal`/`decimalDiff`, policy rounding; `Decimal` = `Prisma.Decimal` (decimal.js, `ROUND_HALF_EVEN`) |
| `lib/calc-audit/` | Phase 41I Calculation Audit System — differential/parity harness, anomaly detection, findings, alerting |

**Precision model (Q-DEC, decided 2026-05-24; v1 complete 2026-06-09):** Prisma stores Float; engines
convert to Decimal at the boundary via `lib/decimal/` and compute in Decimal. Q-DEC PR4 dropped the
dormant `*_decimal` columns (inverse of the original Float-drop plan). → `STATE.md` §C · `docs/IMPLEMENTATION_PLAN.md` §0·WI.

---

## 5. Compliance & regulatory — `docs/compliance/*` + CLAUDE.md §13

| Source | Owns |
|---|---|
| `docs/marketing/gtm/REVIEW_SCOPE_AND_BOUNDARIES.md` | AFSL line — what the paid Review CAN / CANNOT say (general info + factual diagnostic, no personal advice) |
| `CLAUDE.md` §13 | CDR-in-code law: data classification, consent lifecycle, auth guards, retention, env separation |
| `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md` | Basiq accreditation requirement tracking (~87%) |
| `docs/compliance/CDR_SYSTEM_ARCHITECTURE.md` | CDR system architecture (**not in 00_INDEX** — see findings) |
| `docs/compliance/CDR_IMPLEMENTATION_PLAN.md` · `CDR_DATA_RETENTION_SCHEDULE.md` | CDR roadmap · retention policy |
| `docs/policy/*` | Org policies required for Basiq accreditation (deps, device, incident, awareness, retention) |

**Standing rule:** any change to user-facing money language gets an AFSL/CDR boundary check before it
ships (financial *information* service, not licensed adviser). **Basiq gate (locked):** no CDR data
flows until ≥ AU$3–5k broker MRR AND ≥ AU$15k cash; until then manual entry / CSV only.
→ `docs/marketing/GTM_EXECUTION_PLAN.md` (Phase 5) · `docs/IMPLEMENTATION_PLAN.md` §0d.

---

## 6. Go-to-market — `docs/marketing/` (+ `gtm/`)

| Source | Owns |
|---|---|
| `docs/marketing/GTM_EXECUTION_PLAN.md` | Step-by-step B2B-led playbook (phases 0–6, status tracker) — the canonical GTM SSOT |
| `docs/marketing/GTM_TOOL_STACK.md` | Living tool stack + cost register |
| `docs/marketing/gtm/BROKER_ICP.md` | Mortgage-broker ICP (first beachhead) |
| `docs/marketing/gtm/REVIEW_SCOPE_AND_BOUNDARIES.md` | AFSL scope of the paid Financial Health Review |
| `docs/marketing/gtm/FRIENDLIES_INVITE_PLAYBOOK.md` | Private-beta friendlies onboarding |
| `docs/marketing/gtm/PAID_ADS_AUTOMATION.md` | Paid-ads automation (parked — consumer-first GTM was rejected for now) |
| `docs/marketing/THE_TRAIL_METHOD.md` · `TRAIL_WEBSITE_COPY.md` | Public TRAIL messaging + website copy |

**Current state:** B2B-led (brokers first → 60-day pilots → paid). Phase 1 foundations substantively
underway (n8n + Airtable CRM + daily digest live); Phase 2 outbound is next. **Q-GTM-3 (first
aggregator) is OPEN** — recommendation Finsure first, Connective second; no Reza decision recorded.
→ `docs/IMPLEMENTATION_PLAN.md` §0d + Open-Questions row Q-GTM-3.

---

## 7. Tool stack (verified — `package.json`, `prisma/`, `docs/operational/architecture/03_TECHNOLOGY_STACK.md`)

- **App framework:** Next.js 15.5.19 (App Router), React 19, TypeScript 5.
- **Data:** Prisma 5.22 (`@prisma/client` + `@prisma/adapter-pg`) over PostgreSQL; 130 models; GCP Cloud SQL.
- **Precision:** `Prisma.Decimal` (decimal.js) via `lib/decimal/`.
- **AI:** `@anthropic-ai/sdk` + `@google/generative-ai` (Gemini is the chosen provider — Q-AI-PROVIDER 2026-05-16).
- **Cloud (GCP):** Cloud SQL connector, Storage, Logging, Monitoring, Error Reporting, Scheduler,
  Security Center, Vision; Identity Platform / Firebase for auth + MFA.
- **UI:** Radix UI primitives + Tailwind (see `tailwind.config.ts`); shadcn-style components.
- **Payments:** Stripe (`lib/services/stripeBillingService.ts`).
- **Banking/CDR:** Basiq (`lib/basiq.ts`) — gated (see §5).
- **Deploy:** Vercel (region pinned syd1), `vercel-build` runs prisma generate + feature-flag seed + next build.
- **Tests:** Vitest (`vitest.config.ts`) — scripts: `test`, `test:regression`, `test:sanity`,
  `test:calculations`, `test:validation`. Note: CI has no test-runner rail yet (see `STATE.md` blockers).
- **GTM automation (off-repo):** n8n (Hetzner VPS), Airtable CRM, Smartlead, Google Workspace.

---

## 8. How to keep this map true

- This file is **pointers only**. If you find yourself copying a figure or paragraph from a canonical
  source into here, stop — link instead (SSOT, CLAUDE.md §12.2).
- Update on a **real structural change** (new authoritative doc, new engine family, moved ownership),
  via PR, alongside `STATE.md` and `docs/IMPLEMENTATION_PLAN.md` (CLAUDE.md §15 / §16.5).
- Re-pin the HEAD line whenever the map is re-verified.
