# Phase 33h / 33i / 33j — Per-page Help Coverage

> **Status:** PROPOSAL (2026-05-09) — awaiting Reza go/no-go.
> **Owner:** Claude (proposal author) → Reza (decision).
> **Branch:** `claude/phase-33hij-help-coverage-proposal-Q6tyx` (this PR is doc-only; no code lands until approval).
> **Trigger:** Reza brief 2026-05-09 — *"to improve the help center, I need to document help/additional information for each page and section of Monitrax as well. so when users are stuck they can click on help and navigate to the required section to see the information about that section and how to."*

---

## TL;DR

Three sub-phases sequenced as a single content strategy, not one big content-mill push:

| Phase | What | Effort | Why |
|---|---|---|---|
| **33h** | Help **coverage map** + frontmatter `routeContext` glob support | ~1d | Foundation. Decides what surfaces get articles vs tooltips vs nothing. Without it, 33i/j are unscoped. |
| **33i** | **12–15 critical-path help articles** (hybrid Claude-scaffolded + human-curated) | ~4–5d | The articles users actually need when they hit `?` on the surfaces with the most friction. |
| **33j** | **Inline `<HelpTooltip>` primitive + first 30 finance-term tooltips** | ~3d | Different job than the drawer — definitions next to the field, not a panel of prose. |

Total ~8–9 dev days. Articles are authored *with* AI scaffolding from each route's source code, *not* AI-generated-and-shipped. Finance-sensitive surfaces (tax, super, debt, AFSL boundary) get extra human review per CLAUDE.md §0 financial-adviser lens.

---

## 1. Problem

The Phase 33b `?` drawer ships with a route → article registry that's hardcoded in `lib/help/routeContext.ts` and currently has **5 mappings** for ~50+ surfaces. Hit `?` on `/dashboard/properties` and you get the consumer TRAIL article — generic, not "how do I add a property + what is LVR." When users are stuck, generic doesn't help. Per CLAUDE.md §0.1 (behaviour-psychology lens, citing Mani et al.), financial stress already costs ~13 IQ points; the help they see when stuck has to be **scannable, task-oriented, surface-specific**, not a TRAIL primer.

The naive answer is "write 50 articles." That's wrong:

1. **Velocity:** 50 articles = 2–3 weeks of pure content. Lighthouse pitch can't wait that long.
2. **Drift:** features ship; articles rot. Without scaffolding, every feature change requires manual help maintenance.
3. **Compliance:** finance-specific articles (tax, super, debt strategies, SMSF) are legally meaningful — wrong help text reads as personal advice and crosses the AFSL boundary. AI-generated-and-shipped is unsafe here.
4. **Format mismatch:** "what is LVR" doesn't need a 300-word article — it needs a tooltip next to the field. A drawer panel is the wrong surface for definitions.

---

## 2. Why this shape (four lenses, CLAUDE.md §0)

| Lens | What it says |
|---|---|
| **Architect** | Phase 33b's route-registry already supports many-to-one mapping. The engine doesn't change. This is content + tooling, not engineering. Promote `routeContext` from a single string in frontmatter to a glob list (`/dashboard/properties`, `/dashboard/properties/*`) so one article can cover a whole sub-tree. |
| **Designer** | Apple/Linear/Stripe don't write per-page articles for everything — they have **getting-started + a few power features documented + extensive APIs**. The right primitive split is: tooltips for definitions (next to the field), articles for tasks ("how do I"), reference docs for compliance/edge cases. Three different jobs, three different surfaces. |
| **Behaviour psychologist** | Stuck users skim. Articles are 200–300 words max, **task-oriented**, lead with the action. Tooltips are one sentence + (optional) "Learn more" link to the article. Stage-matched: a TRACK-stage user on `/cashflow` needs different framing than a INVEST-stage user on the same page — handle this via the article content, not via 5 different articles. |
| **Financial adviser** | Tax / super / debt / SMSF help text is regulated content. AI-scaffolded but **human-edited and signed off** before publish. Inline tooltips for terms like "concessional cap" or "Div 7A loan" must cite the ATO source in the tooltip body so the user can verify. |

---

## 3. Sub-phases

### 3.1 Phase 33h — Coverage map + `routeContext` glob (~1 day)

**The coverage map** — single doc at `docs/blueprint/HELP_COVERAGE_MAP.md` listing every Monitrax surface, classifying each as one of:

| Class | What | Example |
|---|---|---|
| `article` | Full task-oriented help article | `/dashboard/properties` → "Adding and managing properties" |
| `article-shared` | One article covers multiple sub-routes | `/dashboard/properties/*` → same article above |
| `tooltip-only` | Field definitions only, no article | LVR, BSB, sole purpose test |
| `coming-soon` | Acknowledged but not yet authored | `/dashboard/reports` |
| `none` | No help needed | `/dashboard/setup` (covered by onboarding wizard itself) |

Output: a markdown table mapping `route` → `class` → `articleSlug` → `notes`. ~50 rows. This is the **scope** for 33i/j.

**Engine extension** in `lib/help/frontmatter.ts` + `lib/help/routeContext.ts`:

- Promote frontmatter `routeContext` from optional string to optional `string | string[]`. Each entry is either an exact path or a glob pattern (`/dashboard/properties/*`).
- `lib/help/routeContext.ts` is rebuilt to derive the registry from articles' frontmatter at request time (longest-match still wins). The hardcoded `RULES` array is removed.
- Adding a new article + setting its `routeContext` in frontmatter is the only step to wire a new route. No code edits.

**Effort: 1 day.** Foundation for 33i. Doesn't ship articles itself — the existing 5-rule registry continues to work until 33i lands.

### 3.2 Phase 33i — Critical-path articles (~4–5 days)

The **12–15 articles** the coverage map ranks as `article`. Initial slate, in priority order:

| # | Surface | Article slug | Audience | Why it's high-value |
|---|---|---|---|---|
| 1 | `/onboarding/*` | `consumer/onboarding-walkthrough` | consumer | First-touch friction. Stuck here = abandon. |
| 2 | `/dashboard` | `consumer/your-monitrax-home` | consumer | Anchors the TRAIL framing for the dashboard. |
| 3 | `/dashboard/balances` | `consumer/managing-accounts-and-loans` | consumer | Most-touched page; bank-link confusion is common. |
| 4 | `/cashflow` | `consumer/reading-your-cashflow` | consumer | The "am I OK this month?" page. Surplus/deficit interpretation. |
| 5 | `/dashboard/cfo` | `consumer/ai-guide-and-actions` | consumer | AI advice + scenarios. Most boundary-sensitive. |
| 6 | `/dashboard/tax` | `consumer/your-tax-position` | consumer | Tax FYI; deductions; super contribution prompts. **Finance-sensitive — mandatory human edit.** |
| 7 | `/dashboard/safety-net` | `consumer/emergency-fund-target` | consumer | Anchor stage; common "why is my number red?" question. |
| 8 | `/dashboard/debt-planner` | `consumer/debt-freedom-plan` | consumer | **Finance-sensitive — mandatory human edit.** |
| 9 | `/dashboard/properties` | `consumer/adding-properties` | consumer | LVR, equity, rental yield — heavy field-definition surface. |
| 10 | `/dashboard/investments/*` | `consumer/investment-accounts-and-holdings` | consumer | Concentration, performance — moderate finance-sensitivity. |
| 11 | `/dashboard/entities` | `consumer/my-structure` | consumer | Phase 41 moat moment; explains entity layer. |
| 12 | `/dashboard/documents` | `consumer/uploading-documents` | consumer | AI extraction; what we do with the file. |
| 13 | `/portal/dashboard` | `org-professional/practice-overview` | org-professional | Adviser landing; alert stream interpretation. |
| 14 | `/portal/clients/[id]/view` | `org-professional/client-drill-in` | org-professional | Scope/consent + tab toggle (Structure/MoneyFlow/Dashboard). |
| 15 | `/portal/marketplace/listing` | `org-admin/marketplace-listing` | org-admin | Listing editor; submit→review flow; compliance fields. |

**Hybrid scaffolding tool** at `scripts/help/scaffold-article.ts`:

- Input: a route path + an audience.
- Reads the route's `app/.../page.tsx` source + any direct child components + their JSDoc.
- Calls Anthropic Claude API (or Gemini, whichever is in deps already) with a structured prompt: *"You are drafting a Monitrax help article for the surface at this route. Audience: X. Read the source. Output a 300-word article using the existing frontmatter shape, lead with the user's task, include a 'Common questions' section with 3–5 entries, finish with a 'Related' block listing tooltips this surface needs."*
- Writes the draft to `docs/help/<audience>/<slug>.md` flagged `status: DRAFT_AI_SCAFFOLD` in frontmatter.
- Human edits the draft, removes the flag, commits.

**Quality gate per article (per CLAUDE.md §0 fin-adviser lens):**

- Finance-sensitive (#6, #8, optionally #10): every numeric example must be marked as illustrative; every threshold (caps, rates, brackets) must cite the ATO source via a footnote-style link; AFSL boundary disclaimer in the footer; a second review by Reza before merge.
- Non-finance: standard editorial pass.

**Effort: 4–5 days.** Roughly 0.3 day per article (15 min scaffold + 15 min edit + review). Finance-sensitive articles take 2× longer.

### 3.3 Phase 33j — `<HelpTooltip>` + 30 finance-term tooltips (~3 days)

**Component:** `components/help/HelpTooltip.tsx` — small `?` info icon (12px, slate-500, hover-darken) that opens a popover with definition + (optional) "Learn more →" link to the article. Glass aesthetic matching `PracticeGlassCard`. `prefers-reduced-motion`-aware. Keyboard-accessible (focus ring + Esc to close).

**Tooltip dictionary:** `lib/help/tooltips.ts` — central `Record<string, TooltipDefinition>` mapping term key to `{ title, body, source?, learnMoreSlug? }`. Single source of truth. Keys are kebab-case slugs (`lvr`, `concessional-cap`, `div-7a-loan`).

**Usage:**

```tsx
<HelpTooltip term="lvr" />          // inline icon next to the LVR field
<HelpTooltip term="lvr" inline>     // wraps the LVR label so the whole label is hover-able
  Loan-to-value ratio
</HelpTooltip>
```

**First batch — 30 tooltips:**

Finance terms (~22): `lvr`, `equity`, `rental-yield`, `effective-principal`, `offset-account`, `concessional-cap`, `non-concessional-cap`, `superannuation-guarantee`, `division-293`, `division-296`, `cgt-discount`, `franking-credit`, `division-7a-loan`, `sole-purpose-test`, `in-house-asset-cap`, `lrba`, `tbar`, `transfer-balance-cap`, `ppr`, `negative-gearing`, `medicare-levy`, `lito-sapto`.

Monitrax-specific (~8): `entity-role`, `entity-type`, `trail-stage`, `health-score`, `ownership-scope`, `audience` (in help articles), `surface-tag` (in feedback), `consent-status`.

Each tooltip:

- ≤ 50-word definition body
- For finance terms, a `source` link to the ATO / ASIC / SIS Act page (so users can verify)
- Optional `learnMoreSlug` linking to a longer help article when one exists

**Effort: 3 days.** ~30 min per tooltip with source-cite verification. Plus 0.5 day for the component + dictionary scaffold.

---

## 4. Implementation order

Strictly sequenced — 33h is a hard prerequisite for 33i/j (the coverage map decides scope).

```
33h (coverage map + glob) → 33i (12–15 articles) ┬→ ship before lighthouse pitch
                                                  │
33h → 33j (HelpTooltip + 30 tooltips) ────────────┘
```

33i and 33j can run in parallel once 33h lands.

---

## 5. Risks + mitigations

| Risk | Mitigation |
|---|---|
| AI-generated articles ship with subtle inaccuracies | Hybrid model — every article goes through human edit; `status: DRAFT_AI_SCAFFOLD` flag in frontmatter blocks Help Center publication until removed. Finance-sensitive articles get a second review by Reza. |
| Articles drift as features ship (the worst-case for any docs investment) | (a) Coverage map lists every article + which features it depends on; updating the feature is a checkbox to re-run the scaffold script. (b) `lastReviewed` field already in frontmatter — Cloud Scheduler monthly job can flag articles >120 days old. |
| Tooltip dictionary becomes a dumping ground | Single SSOT (`lib/help/tooltips.ts`); reviewer rejects PRs that don't add tooltips to this file (no inline definitions). Same gate as canonical `lib/utils/calculations.ts`. |
| Anthropic / Gemini API spend on scaffolding | Bounded — ~15 calls × ~5K tokens each = ~$2 total for the initial scaffold. One-off cost; no per-user inference. |
| AFSL boundary creep on tax/debt articles | Mandatory human review for the 3 finance-sensitive articles + tooltip source-cite for every regulated term + AFSL/credit/TPB footer auto-rendered on the help article surface (Phase 33a infrastructure already supports this via `complianceClass` frontmatter). |
| Coverage map doesn't match real user friction | Calibrate against the Phase 33g feedback inbox after 4 weeks of real adviser use — if `surfaceRoute` analytics show 80% of help-drawer opens on routes 16-20 (not in the initial slate), reprioritise. |

---

## 6. CDR / compliance posture (CLAUDE.md §13)

| Concern | Posture |
|---|---|
| Help articles surface user data | They don't — articles are static content; never query CDR data. |
| AI scaffolding sees user data | The scaffold script reads source code, not user data. Anthropic/Gemini calls are server-side at author time, never at user request time. |
| Finance-specific content boundary | Mandatory human review + ATO source-cite + AFSL footer per article. Same posture as Phase 33d compliance pack. |
| Help drawer audit | No new audit shape — drawer reads are not CDR-data reads. Existing API-request audit on `/api/help/drawer` is sufficient. |

---

## 7. Out of scope (this phase batch)

| Out of scope | When to revisit |
|---|---|
| Translated help (es/zh/etc) | After AU-only validation passes ~50 paying users |
| Video walkthroughs | After articles are stable + we've measured friction reduction |
| User-contributed content / community Q&A | Way out — would need moderation infra, separate phase |
| Personalised help based on user's TRAIL stage / data | Article body can mention TRAIL stages but the surface stays content-static; AI-personalised help is a future phase that depends on Phase 32C PR4d infrastructure |
| AI-suggested articles based on usage telemetry | Requires telemetry plumbing we haven't built. Phase 33k+ candidate. |

---

## 8. Acceptance criteria

**Phase 33h:**
1. `docs/blueprint/HELP_COVERAGE_MAP.md` lists ~50 routes classified into article / tooltip-only / coming-soon / none.
2. Frontmatter type accepts `routeContext: string | string[]` with glob support.
3. Hardcoded `RULES` array in `lib/help/routeContext.ts` is replaced by article-frontmatter discovery.
4. Existing help drawer functionality unchanged (regression test: hit `?` on `/dashboard/cfo` → still opens TRAIL article).

**Phase 33i:**
1. 12–15 new articles authored under `docs/help/<audience>/<slug>.md`.
2. Each article has populated frontmatter incl. `routeContext`, `lastReviewed`, `summary`.
3. `scripts/help/scaffold-article.ts` exists, documented, reproducible.
4. Hit `?` on each priority surface → drawer opens the surface-specific article.
5. Finance-sensitive articles (tax, debt, super) carry source-cited examples + AFSL footer.

**Phase 33j:**
1. `<HelpTooltip term="..." />` component shipped with `prefers-reduced-motion`-aware popover.
2. `lib/help/tooltips.ts` carries the 30-term dictionary with source-cites.
3. Tooltips wired into ~10 critical fields (LVR on `/dashboard/properties`, concessional-cap on `/dashboard/tax`, etc.) — full inline-tooltip rollout is incremental thereafter.
4. Tooltip popover dismisses via Esc + click-outside + tap-outside on mobile.

---

## 9. Open questions for Reza

1. **Sequencing vs lighthouse pitch:** the pitch playbook is now demo-complete (per `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md`). Should we slot 33h+33i in before the first 3 pitches (so advisers see the help quality), or in parallel with the first pitch run (so we can use real adviser stuck-points to prioritise)?
2. **AI scaffold provider:** Anthropic Claude API (already used for AI Guide via Gemini... actually Gemini is the in-app advisor; Anthropic isn't yet in deps). Add Anthropic SDK (~$2 one-off cost), or use Gemini (already in deps) for scaffold prompts? Gemini probably fine for source-code-reading scaffold work; Anthropic better for prose quality. Lean Anthropic for scaffold (one-off, prose-heavy) — but flag the dep addition.
3. **Coverage map sign-off:** do you want to review the 33h coverage map before 33i kicks off (gate), or trust judgement and review at 33i article level? Gate adds ~1 day to the timeline.
4. **Tooltip rollout strategy:** ship the 33j component + dictionary in one PR (no inline usage yet), then a follow-up PR per surface to wire tooltips? Or batch 33j with the first 10 inline integrations? Latter is more impactful but a bigger PR.
5. **Stage-matched help:** within an article, do we surface stage-specific framing ("If you're in TRACK stage…") inline, or via a stage-aware article picker? Recommend inline — simpler, no new picker UI.

---

## 10. Recommendation

**Approve sequenced.** Ship 33h first (1 day, foundation), then run 33i + 33j in parallel (~5 days combined). Total ~6 days of focused work; gates only on Reza's review of the 33h coverage map (≤1 day) before 33i scope locks.

**One clear next action:** confirm the 5 §9 questions (or "use your judgement" again, in which case I'll lean Anthropic for scaffold + 33j-component-only-first) and I'll start with the 33h build PR.

---

*Last updated: 2026-05-09*
*Status: PROPOSAL — pending Reza sign-off on §9 open questions.*
