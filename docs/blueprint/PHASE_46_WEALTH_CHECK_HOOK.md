# Phase 46 — `/wealth-check` Pre-Signup Hook

> **Status:** 🟡 DESIGN + PR 1 SHIPPING — the scaffold, calculator, benchmarks SSOT, and result page. Traffic-on gated on §10 (friendlies retention signal + lawyer pass).
> **Owner:** Reza (direction + lawyer engagement + benchmark refresh trigger) + Claude (design, code, copy).
> **Created:** 2026-05-25.
> **Related:** `IMPLEMENTATION_PLAN.md` Up Next #68 (this phase) + #67 (Phase 45 What If? — sibling in-app surface; same canonical calc style); CLAUDE.md §0 (four-lens advisory mindset), §14 (warm-words rule), §12.2 (SSOT for benchmarks + calc engine), §13.3 (no CDR data in any public surface), §16 (doc-sync); `docs/marketing/THE_TRAIL_METHOD.md` (positioning DNA); `app/welcome/page.tsx` (visual reference for chrome).

---

## §1 — Purpose

`/wealth-check` is the **public, anonymous, pre-signup funnel surface** that converts cold traffic into Monitrax signups. Reza directive 2026-05-24: explicitly called out as the most critical growth surface in the product ("make or break").

The job, in one sentence:

> **Give a stranger a dollar-specific, age-anchored answer to "am I on track?" in under 30 seconds — with one named lever they can act on — and let them choose to save the result, share it, or sign up to keep going.**

The page is anonymous-first: no PII collected by default, no DB write on calculation, no API call for the calc itself (pure client-side). Optional email capture on the result page (per §6) is for the lead, not gated on the calc.

---

## §2 — Worked example (the result the user sees)

A 38-year-old earning $145k household, with $310k net worth, hits `/wealth-check`.

The result page surfaces (in this order):

1. **Hero gap** — `You're tracking toward ~$540k at retirement. The ASFA comfortable target for someone like you is ~$595k. That's a gap of ~$55k.`
2. **Percentile context** — `Your net worth puts you around the 64th percentile for your age band — ahead of most Australians your age.` (Heath SUCCESs *concrete* + behaviour-psychologist *normalising*.)
3. **ONE named lever** — `Salary-sacrificing an extra $250/month into super between now and 67 — about a coffee a day — would close roughly $42k of that gap.` (Specific. Numerical. Doable. NEVER says "you should.")
4. **Assumptions panel (collapsed by default, accessible)** — names the 5% real return assumption, the 12% SG, the ASFA target source + date, the limits of a 3-input estimate ("a proper plan looks at your structure — see Monitrax").
5. **The hook** — `Want the full picture? Monitrax shows you the real number, the real levers, the real plan — across all your accounts, properties, super, and tax. Try it free →`
6. **Optional email capture** — `Or email me the PDF + a Monitrax invite when it's ready.` (See §6.)
7. **Authority footer** — sources cited: ABS 6523.0 / ASFA Retirement Standard Q2 2026 / APRA Quarterly Super / ATO Taxation Statistics. (See §5.)

**The framing rule (load-bearing):** *pattern as antagonist, never user as antagonist.* Reconciles CLAUDE.md §14 warm-words with Prospect-Theory loss aversion. Examples:
- ✅ "Most 38-year-olds in Australia are tracking $55k short. Here's the lever that closes it." (Pattern is the enemy; user is doing better than most.)
- ❌ "You're behind. You're not saving enough." (User as antagonist → Klontz-2011 financial-avoidance trigger → abandons.)

---

## §3 — The three inputs (Fogg Ability ceiling)

The page asks for exactly three inputs. Adding a fourth slips the Ability bar and drops completion materially (per Fogg 2009 — Behavior = Motivation × Ability × Trigger).

| # | Input | UX | Range | Default |
|---|---|---|---|---|
| 1 | **Age** | Slider | 25–65 | 38 |
| 2 | **Household income (annual gross)** | Slider with quick-pick chips | $40k–$400k+ | $120k |
| 3 | **Net worth (everything minus debts)** | Quick-pick radio bands | `<$50k` / `$50k–$200k` / `$200k–$500k` / `$500k–$1m` / `$1m–$2m` / `$2m+` | none (forces a deliberate pick) |

**Why bands (not a number) for net worth.** Most people cannot recall a precise figure in 30 seconds. Bands are honest about the precision the calc actually needs + remove the friction of "ugh, I'd have to add it up". The midpoint of each band is used in the calc.

**Why no household-status toggle.** Was considered (single vs couple → different ASFA targets, ~$95k delta). Rejected to preserve the three-input rule. Instead, the household-income value drives a *heuristic*: incomes ≥ $150k assumed couple (factor 1.0 against ASFA couple target); incomes < $150k assumed single (factor 1.0 against ASFA single target). The assumptions panel surfaces this transparently. Heuristic is one place to revise later if data shows it's wrong.

---

## §4 — The calculator (`lib/wealthCheck/calculator.ts`)

Pure function, no I/O, deterministic. Same architectural standard as the canonical engines under `lib/calculations/*` (CLAUDE.md §12.2 / §12.3). Sequence:

```
INPUT: { age, householdIncome, netWorthBand }

1. yearsToRetirement = max(0, 67 - age)
2. ageBand = bucket(age)  // 25-34 / 35-44 / 45-54 / 55-64 / 65+
3. householdShape = householdIncome >= 150_000 ? 'couple' : 'single'

4. currentNetWorth = midpoint(netWorthBand)
5. currentSuperEstimate = ATO_MEDIAN_SUPER_BY_AGE[ageBand]
   // Cross-check: don't exceed total net worth - $20k buffer for non-super NW
6. nonSuperCurrentNW = currentNetWorth - currentSuperEstimate

7. projectedSuperAt67 =
     currentSuperEstimate × (1 + REAL_RETURN_RATE)^yearsToRetirement
     + sumCompounded(annualEmployerSG × yearsToRetirement, REAL_RETURN_RATE)
   where annualEmployerSG = householdIncome × SG_RATE × earnerSplit
   earnerSplit = householdShape === 'couple' ? 0.6 : 1.0   // assume 60/40 income split

8. projectedNonSuperAt67 =
     nonSuperCurrentNW × (1 + REAL_RETURN_RATE)^yearsToRetirement
     + sumCompounded(annualVoluntarySavings × yearsToRetirement, REAL_RETURN_RATE)
   where annualVoluntarySavings = householdIncome × estimatedSavingsRate(income, age)

9. projectedTotalAt67 = projectedSuperAt67 + projectedNonSuperAt67

10. asfaTarget = ASFA_COMFORTABLE_LUMP_SUM[householdShape]
11. gap = max(0, asfaTarget - projectedTotalAt67)
12. percentile = lookup(ABS_NET_WORTH_PERCENTILES[ageBand], currentNetWorth)
```

**Assumptions (the load-bearing ones, surfaced in the panel):**
- `REAL_RETURN_RATE = 0.05` (5% real, balanced fund — APRA long-term avg ~7-8% nominal − ~3% CPI)
- `SG_RATE = 0.12` (from 2026-07-01, per Super Guarantee schedule)
- `estimatedSavingsRate`: tiered by income (HILDA/ABS HES patterns) — $40-80k: 4%, $80-150k: 8%, $150-250k: 12%, $250k+: 15%
- `ATO_MEDIAN_SUPER_BY_AGE` cross-clamped against `currentNetWorth - $20k` so the calc never returns nonsense for under-saving young people

**What this calc deliberately does NOT do:**
- No tax-engine integration (Phase 41E modules are server-side + need legal-entity context — out of scope for an anonymous page)
- No property / loan / investment breakdown (`lib/calculations/netWorthCalculator.ts` etc. — those need persisted user data)
- No state / postcode / employer adjustments
- No partner-specific super balances
- No CGT / division-7A / trust complexity

The calc is **honest about being a crude estimate**. The hook says: *"want the real picture? Sign up — Monitrax does the real calc, with all your accounts."*

---

## §5 — Benchmark SSOT (`lib/marketing/benchmarks.ts`)

Per Reza's pick (architecture choice #2): **JSON-config-in-TS file** with a header comment naming source + publication date + next-refresh trigger. Same pattern as `lib/tax-engine/config/taxYearConfig.ts`.

**Yearly refresh trigger:** new ASFA Q2 release (March quarter typically published mid-April) + ABS Household Wealth release (typically published ~18 months after survey ends).

**The four canonical sources, all publicly available:**

| Constant | Source | Publication cadence | Last refresh | Used by |
|---|---|---|---|---|
| `ASFA_COMFORTABLE_LUMP_SUM` | ASFA Retirement Standard | Quarterly (March / June / Sept / Dec) | 2026 Q2 (this PR) | Calc step 10 |
| `ABS_NET_WORTH_PERCENTILES_BY_AGE` | ABS 6523.0 Household Income and Wealth | Bi-annually | 2026-04 release | Calc step 12 |
| `ATO_MEDIAN_SUPER_BY_AGE` | ATO Taxation Statistics | Annually (~12 months lagged) | 2026-04 release | Calc step 5 |
| `APRA_LONG_TERM_SUPER_RETURNS` | APRA Quarterly Super Performance | Quarterly | 2026 Q1 (this PR) | Real-return assumption sanity check |

Every constant carries a `// Source: <citation>. Last refreshed: <date>. Next refresh: <trigger>.` comment so a future operator (human or AI) knows when to update.

---

## §6 — Email capture (optional, post-result)

Per Reza's pick (architecture choice #3): **optional "email me the full PDF" field on the result page**. No precondition on showing the result.

UX: single optional input + Privacy Act APP 5 microcopy directly below the field:

> *We'll only use this to email you the PDF + a Monitrax signup link. We won't add you to any list. Privacy Policy →*

Submission path:
1. Client POSTs `{ email, age, incomeBand, netWorthBand, projectedTotal, gap, percentile, leverDescription }` to `POST /api/wealth-check/lead`.
2. API validates email format + rate-limits per IP (5/hour). No DB write yet — pushes to **Airtable Contacts** via the existing CRM PAT with `Tag: wealth-check-lead`. The result-snapshot fields live in a single `Notes` JSON blob (Airtable side) to keep the schema clean.
3. PDF is generated server-side via `pdfkit` (already a dep from Phase 42 PR 5.5 Tax Pack export). Re-uses the same Author / Branding / Footer-Disclaimer pattern. Email goes via Resend (the chosen email vendor from CLAUDE.md §13 / `00_VENDOR_INVENTORY.md`).
4. Audit row written via `createAuditLog` with `WEALTH_CHECK_LEAD_CAPTURED` action — same audit-table pattern as the rest of the app.

**PR 1 scope (this PR):** the form + the snapshot + the calc + the lever + the assumptions panel + the result-page chrome. **Email capture is PR 3** (per §11) — out of scope here. We ship the lever + the hook ("Try it free →") to the canonical Monitrax `/register` flow first.

---

## §7 — The lever (`lib/wealthCheck/lever.ts`)

Per Reza's pick (architecture choice #1): **branch by age band**. Three branches.

| Age band | Lever | Calculated $/mo | Honest framing |
|---|---|---|---|
| 25–39 | **Salary-sacrifice to super** | Income-band based, headroom-aware: `min($30k cap − employer SG, $X/mo translating to $Y/yr)` — typically $200–$500/mo for the income range | "Salary-sacrificing an extra $X/month — about [a coffee a day / dinner-out a week] — between now and 67 closes ~$Y of the gap." Compounding 30+ years does the heavy lifting. |
| 40–54 | **Mix: super top-up + offset/debt paydown** | Same super math + assume $1,000–$2,000/mo extra on debt if NW < income × 3 (signals high-debt-low-asset stage) | "Topping up super by $X/month AND adding $Y/month to debt repayments compounds two ways: the offset saves interest now, the super builds the lump sum. Closes ~$Z of the gap." |
| 55–65 | **Catch-up contributions (5y unused-cap rule, s292-85) + TTR consideration** | Headroom-aware: total available unused cap from prior 5 years if super balance < $500k threshold; capped at $30k/y × 5y. | "If you have unused concessional cap from the past 5 years (most people do under $500k super), you can catch up — adding $X this year alone closes ~$Y of the gap. Speak to your accountant about activating it." |

**The AFSL discipline (load-bearing — see §9):**
- Every lever names a **mechanism** (salary-sacrifice, offset, catch-up). It does NOT recommend a **product** (a specific super fund, a specific bank).
- Every lever's framing is *informational*: "$X/month would close $Y of the gap." NEVER "$X/month is what you should do."
- The catch-up branch explicitly hands off ("speak to your accountant").
- The result-page footer carries the same AFSL boundary disclaimer as `/dashboard/cfo`: *"Monitrax is a financial information service. We surface the maths and the mechanisms, not personal advice. For advice tailored to your circumstances, speak to a licensed financial adviser, mortgage broker, or accountant."*

**The Klontz-2011 avoidance protection (also load-bearing):**
- If `gap > projectedTotal × 5`, the lever framing softens: "*The gap is bigger than most levers can close on their own — but here's where to start.*" Always leaves room for partial agency.
- If `gap <= 0`, the lever switches to a *consolidation* frame: "*You're ahead of the ASFA target. Here's what most people in your position do next — accelerate the journey from 'comfortable' to 'free'.*"

---

## §8 — Page architecture

```
app/
  wealth-check/
    page.tsx          // Client component. 3-input form + result page. Two states managed in same component.

lib/
  wealthCheck/
    calculator.ts     // calculateWealthCheckResult({ age, householdIncome, netWorthBand }) → WealthCheckResult
    lever.ts          // selectLever(result) → LeverRecommendation
    types.ts          // WealthCheckResult, LeverRecommendation, NetWorthBand, AgeBand
  marketing/
    benchmarks.ts     // ASFA / ABS / ATO / APRA canonical numbers
```

**Page composition:**
- `<Header />` + `<Footer />` reused from `components/marketing/` (same chrome as `/welcome`, `/trail-method`).
- `<Reveal>` animation primitive from `components/marketing/animations` for hero entry.
- Same colour palette as the marketing site: `bg-stone-950` + amber accents. Designer lens — restraint over richness; one hero number, one lever, one CTA.
- No analytics in PR 1 (PR 2 wires the 5 metrics from §11).

**Result page motion choreography (designer lens):**
1. Page transition (form → result) — full-page fade + slight scale, 400ms (matches Apple Wallet card flip vibe).
2. Hero number ticker-up to the final value over 1.2s (Reveal pattern from `app/welcome/page.tsx`).
3. Percentile + lever cards reveal staggered, 300ms apart.
4. CTA appears last with a soft glow pulse.
5. Honour `prefers-reduced-motion` everywhere.

---

## §9 — AFSL / regulatory boundary (the legal-exposure surface)

This is a **public surface** that talks about super, debt, retirement gaps, and money. It MUST stay structurally on the right side of the AFSL line.

**The rules (codified):**
1. **No product names.** Never "BetaShares fund X" / "ANZ offset" / "AustralianSuper". Always category-only ("salary-sacrifice to super", "offset account").
2. **No personal advice framing.** Never "you should" / "we recommend you" / "the right strategy for you is". Always *informational* ("$X/month would close $Y of the gap").
3. **AFSL boundary footer** on the result page, citing `docs/legal/afsl-credit-tax-boundary-disclosure.md` (Phase 47 PR 3 — already shipped).
4. **No tax-specific advice** beyond category-level mention. The catch-up-contributions branch must say "speak to your accountant" verbatim.
5. **Source-traceability for every number.** ASFA target shown? Cite ASFA. Percentile shown? Cite ABS. Median super shown? Cite ATO. Same discipline as the in-app `/dashboard/cfo` source-citation footer.

**The lawyer pass (gate before traffic-on — see §10):**
- Engage AU fintech lawyer ~2 wk lead (~AU$1–3k).
- Brief: review the result-page copy + the lever framings + the AFSL footer + the email-capture microcopy.
- Goal: get an explicit sign-off (in writing) that the page is information-only and does not require an AFSL.
- Documented in `IMPLEMENTATION_PLAN.md` Open Question Q-HOOK-AFSL.

---

## §10 — Sequencing (the "build now, gate the traffic-on" rule)

> **CRITICAL — DO NOT SKIP.** This rule comes from the Reza directive 2026-05-24 + the architect-mode synthesis. The page is built (this PR). Traffic is OFF.

| Gate | What | Estimated lead time |
|---|---|---|
| **A** | This PR ships (page + calc + lever + benchmarks) | ~2 days |
| **B** | Friendlies cohort (workstream 0f) shows positive in-app retention signal — at least 3 of the 5–10 friendlies are still active at week 2 | ~2–4 weeks |
| **C** | Lawyer pass on result-page copy (§9) — signed off in writing | ~2 weeks (runs in parallel with B) |
| **D** | Q-DEC (Float→Decimal) resolved if Phase 45 What If? is composing the same engines — Reza's call | dependent on row #69 sequencing |
| **E** | Traffic-on: SEO meta tags + sitemap inclusion + ?ref= shareable URLs + 5-metric analytics wired (PR 2 / PR 3) | 1–2 days post-gate |

**Why this matters:** without gates B + C, we'd be pouring cold traffic into a leaky funnel — learning nothing, risking AFSL exposure, burning the SEO domain authority before the in-app loop is proven. Reza's directive: *"build the page, but do NOT turn on traffic until friendlies validate in-app retention. Otherwise cold traffic pours into a leaky funnel and you learn nothing."*

---

## §11 — Five metrics to instrument from day one (PR 2 scope)

When PR 2 wires analytics, these are the load-bearing numbers — the only ones that matter for the funnel's health:

| # | Metric | Why it matters |
|---|---|---|
| 1 | **Input drop-off** (% of users who load the page but don't complete all 3 inputs) | Ability bar test — if >40%, the form is too heavy / inputs are confusing. Fogg signal. |
| 2 | **Result-page time-on-page** | Did the answer land? <15s = bounced; 30s–60s = read it; >60s = considered it. |
| 3 | **Email-capture rate** (% of result-page views that submit the email field) | Lead generation efficiency. Industry benchmark for finance: 12–18%. |
| 4 | **Signup conversion** (% of result-page views that click the "Try it free →" CTA and complete /register) | The hook's actual conversion. The only metric that pays Basiq. |
| 5 | **Unprompted-share rate** (% of result page views that copy/share the URL via the shareable `?ref=` link) | **The Mom Test signal** (Fitzpatrick 2013). Sharing without prompting = the result genuinely landed. If <2%, the lever / framing isn't resonating. |

**Tooling:** PostHog or Plausible for v1 (privacy-first, AU-DSC-friendly). Wired in PR 2.

---

## §12 — Open questions (tracked in `IMPLEMENTATION_PLAN.md`)

- **Q-HOOK-AFSL** — Lawyer engagement timing + scope + cost cap. Required before traffic-on.
- **Q-HOOK-EMAIL** — Resend live? PR 3 (email capture) needs `RESEND_API_KEY` provisioned. Currently scaffolded but no live billing.
- **Q-HOOK-ANALYTICS** — PostHog vs Plausible vs GA4. Privacy-first (AU residents) preferred. Decision before PR 2.
- **Q-HOOK-BENCHMARK-REFRESH** — Who owns the yearly refresh? Reza-side calendar reminder; or auto-fetch via a Cloud Scheduler job (overkill for v1).

---

## §13 — Doc-sync impact (per CLAUDE.md §16)

| Surface changed in this PR | Doc updated |
|---|---|
| New public route `/wealth-check` | `docs/blueprint/MASTER_BLUEPRINT.md` — new Phase 46 row |
| New `lib/marketing/benchmarks.ts` SSOT | This doc (§5) — the canonical pointer |
| New `lib/wealthCheck/*` engines | This doc (§4 + §7) — the canonical pointers |
| AFSL boundary footer surfaced on a new public page | `docs/legal/afsl-credit-tax-boundary-disclosure.md` not changed — page reuses existing boundary; no new claims |
| 4 new constants from 4 public sources | This doc (§5) — last-refresh dates + next-refresh triggers |

---

## §14 — Build sequence (the PRs)

| PR | Scope | Estimated effort | Gate |
|---|---|---|---|
| **PR 1 (this PR)** | Phase doc + page scaffold (3-input form + result page with lever + assumptions panel) + benchmarks SSOT + calc engine + lever selector | ~2 days | (none) |
| **PR 2** | 5-metric analytics instrumentation + shareable `?ref=<name>` URL + SEO meta tags + sitemap entry | ~1 day | After PR 1 lands + Reza picks the analytics tool |
| **PR 3** | Email capture form + `POST /api/wealth-check/lead` route + Resend integration + PDF generation reuse from `pdfkit` | ~1–2 days | After PR 2 lands + Resend key provisioned |
| **PR 4** | Traffic-on: meta tags `index,follow`, sitemap promotion, AFSL footer final, lawyer-signed copy | ~1 day | After gate C (lawyer pass) AND gate B (friendlies retention signal) |

**Total estimated effort:** ~5–7 days build + 2 weeks lawyer-pass lead time before traffic-on.

---

*Drafted 2026-05-25. PR 1 ships this session.*
