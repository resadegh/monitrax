# Broker ICP — Outbound Target Definition

> **GTM Step 2.1 deliverable.** Defines exactly who Phase 2 outbound targets, so the Step 2.2 lead list isn't garbage. Quality > quantity: 500 well-fitted brokers beat 2,000 random ones.

**Owner:** Reza
**Created:** 2026-06-10
**Status:** 🟢 ACTIVE — governs Steps 2.2 (lead list), 2.3 (sequence copy), 2.4 (personalisation)
**Decision basis:** Q-GTM-3 DECIDED 2026-06-10 — Reza: **Finsure first, Connective second.**
**Aligns with:** `GTM_EXECUTION_PLAN.md` Phase 2 · Q-ICP-1 (wealth-builder product ICP, decided 2026-05-24) · CLAUDE.md §0 (advisory mindset)

---

## 1. The one-line ICP

**An established (3+ yr) Australian mortgage broker or small-brokerage principal aggregating under Finsure, with a book of wealth-builder clients (property + structure), in NSW / VIC / QLD metro, in a practice of 1–20 brokers.**

---

## 2. Why Finsure first (Q-GTM-3 rationale)

| Factor | Evidence | So what |
|---|---|---|
| Network scale | ~4,000+ brokers as of 1H25 (+17% YoY); ~18% of AU broker market share; targeting 5,000+ by Dec 2026 (The Adviser, Aug 2025; Australian Broker, Feb 2026) | One network is enough to source the full 1,000-lead list — no need to dilute messaging across aggregators |
| Independence profile | Wholesale aggregator under MA Financial (acquired 2022) — not bank-owned (vs Mortgage Choice/REA, Aussie/Lendi) | Brokers choose their own tools; no head-office procurement gate for a pilot |
| Diversification posture | Commercial + asset finance up 43% in 2025; CEO publicly positions Finsure as a "broker business support organisation" rolling out new CRM + AI tools | Network culture is receptive to adopting client-facing technology — our pitch lands on prepared ground |
| Tight word-of-mouth | Single aggregator community (PD days, state events, Infynity CRM ecosystem) | Early pilot wins compound inside one network instead of evaporating across five |

**Second wave:** Connective (after the Finsure messaging is tuned and we have ≥1 case study). **Avoid for outbound:** AFG, Mortgage Choice (ownership/procurement layers make cold pilots slow).

---

## 3. Inclusion criteria (ALL must hold)

| Dimension | Criterion | Why |
|---|---|---|
| **Role** | Mortgage broker, brokerage principal, or director. NOT loan processors, NOT BDMs, NOT credit analysts | Only owners of the client relationship can say yes to a pilot |
| **Aggregator** | Finsure (self-declared on LinkedIn/website, or Infynity CRM mentions) | Q-GTM-3 — one network at a time |
| **Geography** | AU only; NSW, VIC, QLD metro first (Sydney, Melbourne, Brisbane + surrounds) | Timezone-aligned calls; densest wealth-builder client concentration |
| **Practice size** | 1–20 brokers (solo + small teams) | Bigger groups have procurement; solo/small can decide in one call |
| **Tenure** | 3+ years broking | An established book of settled clients to nurture is the whole value prop. **Screens out Finsure's recent ex-banker intake wave** — new entrants have no cold book to re-engage |
| **Book character** | Evidence of wealth-builder clients: investment-property lending, refinance/restructure content, SMSF lending mentions, commercial diversification | Matches the Monitrax product ICP (Q-ICP-1, wealth-builder / mass-affluent). A first-home-buyer-factory broker gets less value from refinance triggers + entity-aware client pictures |

## 4. Exclusion signals (ANY disqualifies)

- Aggregates under a bank-owned group (Mortgage Choice, Aussie) or AFG
- <3 years in industry (LinkedIn tenure, MFAA/FBAA join date if visible)
- Pure new-purchase / FHB volume shop with no refinance or investor content
- Brokerage >20 brokers (park in CRM as `Future — Enterprise`, do not sequence)
- No discoverable digital footprint (no LinkedIn + no website = personalisation step has nothing to work with; Step 2.4 quality collapses)

## 5. Persona snapshot (for Step 2.3 copy + 2.4 personalisation)

- **Who:** principal of a 1–8 broker practice, 5–15 years in, book of 200–800 settled clients, majority owner-occupier + a meaningful investor segment.
- **The pain we speak to:** established wealth-builder clients go *cold between deals*. The broker hears from them again only when a competitor refinances them. Annual-review calls don't scale; trail income quietly erodes.
- **What they already pay for:** aggregator software (Infynity), a CRM, marketing tools — they have budget and a habit of buying broker-support tech.
- **What they fear:** anything that makes them look unlicensed-advice-adjacent, anything that spams their clients, anything that takes hours to onboard. (Copy must pre-empt all three — and our own AFSL boundary discipline per `REVIEW_SCOPE_AND_BOUNDARIES.md` is a selling point, not a footnote.)

## 6. Apollo filter recipe (Step 2.2 inputs)

- **Titles:** "Mortgage Broker", "Finance Broker", "Principal", "Director" (at brokerage-classified companies), "Broker / Owner"
- **Keywords:** "Finsure" OR "Infynity" in company/profile
- **Location:** Sydney / Melbourne / Brisbane metro areas, Australia
- **Company headcount:** 1–20
- **Seniority:** Owner, Founder, Director, Partner
- **Manual enrichment pass (n8n + Claude, per Step 2.2):** LinkedIn URL, brokerage site, most recent post topic, tenure check, wealth-builder-book signals → write to Airtable `Leads` with fit score
- **Target output:** ~1,000 rows; if Finsure-tagged inventory in Apollo runs short, fill remainder by Infynity-keyword + tenure match rather than relaxing tenure or size

## 7. What this doc does NOT decide

- Outreach copy (Step 2.3), send volume (Step 2.7), pilot terms (Step 4.3)
- The second-wave Connective ICP (write a delta section here when that wave starts — do not fork a second ICP doc; this file is the SSOT for outbound targeting)

---

## Sources

- The Adviser, "Loan book growth surges at Finsure and MA Money" (Aug 2025) — broker count, market share, 5,000-broker target
- Australian Broker News, "Finsure turns 15 with 43% surge in commercial and asset lending" (Feb 2026) — 2025 network growth, ex-banker intake, diversification
- Australian Broker News, "Finsure expands broker network with rising star Front Financial" (Jan 2026) — MA Financial ownership
- MA Financial, finsure company page (figures as at 31 Mar 2026)

*Internal figures (pricing, pilot terms) deliberately absent — they live in their canonical docs per SSOT rules.*
