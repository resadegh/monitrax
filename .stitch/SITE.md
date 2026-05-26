# Monitrax — Public Website (Stitch Project)

> **Stitch project ID:** _(to be populated after first `mcp__stitch__create_project` call — see `.stitch/metadata.json`)_
> **Phase:** Phase 47 — Public Website Redesign
> **Started:** 2026-05-26
> **Owner:** Reza (direction) + Claude (build)
> **Status:** 🟡 Active — bootstrapping

---

## 1. Vision

**Monitrax is the operating system for Australian wealth-builders.**

A premium financial-clarity platform that sits between a spreadsheet and a private wealth adviser — precise, transparent, and calm, never flashy or trading-app hyped. The public website's job is to communicate competence within 5 seconds, earn trust within 30 seconds, and convert without manipulation within 5 minutes.

**Emotional contract:** users should leave the site feeling **calmer, smarter, and strategically empowered** — never overwhelmed, never sold to.

**Visual contract:** *"Apple designed a private wealth operating system."* Mercury / Stripe / Linear / Arc references. Never crypto, never trading-app neon, never template-shaped SaaS.

**Ideal Customer Profile (locked 2026-05-24):** Australian wealth-builders with integration debt — property investors, professionals with multiple accounts/loans, mass-affluent users outgrowing spreadsheets, users tracking entities/trusts/SMSFs. **NOT** mass-market beginners.

---

## 2. North-star principles (binding constraints for every page)

1. **Competence-led, not reassurance-led.** Premium tools earn trust by demonstrating they hold complexity well, not by promising you won't feel overwhelmed.
2. **Restraint over density.** Apple's "when in doubt, remove" applies everywhere.
3. **One Next Best Action per surface.** Every page answers "what does the user need to do next?" without ambiguity.
4. **Warm-words rule** (CLAUDE.md §14). *"My Accounts" not "Portfolio". "Spending" not "Expenses".* Never shame, never manufactured urgency.
5. **Stage hue SSOT** (`lib/navigation/trailNav.tsx` → `TRAIL_STAGE_TONES`). Marketing pages MUST match the app: T sky · R amber · A indigo · I emerald · L violet.
6. **AI framing is careful.** "Financial clarity assistant" / "insight engine" / "scenario modelling." NEVER "AI advisor", "AI wealth manager", "AI financial planner." Per AFSL/TPB/NCCP boundary (CLAUDE.md Part 13).
7. **No red anywhere** on the public site except true validation errors. Loss-aversion-safe.
8. **`prefers-reduced-motion` honoured everywhere.**

---

## 3. Design system

See `.stitch/DESIGN.md` for the canonical spec. Every Stitch prompt MUST include Section 6 verbatim.

**Key tokens:**
- Background: warm ivory `#FAFAF7`
- Primary: deep navy `#0B1220`
- CTA: emerald `#16A34A`
- Typography: Inter, semibold (600) for displays
- Motion: `appleEase` `cubic-bezier(0.25, 0.46, 0.45, 0.94)`
- Glass radii: 28px (hero) / 22px (tile) / 16px (card) / 12px (button)

---

## 4. Sitemap

### Pages in this Stitch project

- [ ] **`index`** — Landing page (hero · proof strip · one picture · five capabilities · how it works · security · AI · pricing · FAQ · final CTA · footer)
- [ ] **`signin`** — Sign-in (single-column centred form, soft warm-ivory background, geometric Monitrax mark, Google OAuth + email/password)
- [ ] **`register`** — Sign-up (single-column centred form, same chrome as signin, with email verification messaging)
- [ ] **`pricing`** — Pricing (transparent 3-tier or 2-tier table, no manipulative SaaS tricks, AFSL boundary footer)
- [ ] **`security`** — Security & privacy (CDR pathway, encryption, no ad trackers, no data sales, full section not a footer)
- [ ] **`forgot-password`** — Forgot password (same auth chrome family)

### Pages NOT in this redesign (keep current treatment)

- `/dashboard/*` — internal app, has its own design system (per `08_BRAND_UI_DESIGN.md`)
- `/portal/*` — Org Portal (Phase 32B design language)
- `/admin/*` — Admin Portal (Linear/GCP-Console style)
- `/onboarding/*` — internal onboarding wizard
- `/trail-check`, `/trail-method`, `/wealth-check` — secondary public pages (inherit new chrome in Phase 47.7, after the main redesign)
- `/legal/*` — legal docs (Phase 47.8, low priority)

---

## 5. Roadmap (the 6-PR plan)

| # | PR | Scope | Status |
|---|---|---|---|
| **P1** | Foundation | Public-side design tokens in `globals.css`, motion primitives re-export, kill `/login` duplicate route, fix `app/page.tsx` loading-gate LCP problem. | ⏳ Not started |
| **P2** | Header + Footer | Rebuild `Header.tsx` + `Footer.tsx` to new identity (navy primary, geometric M mark, refined nav, kill dead footer links). | ⏳ Not started |
| **P3** | Hero + IA re-sequence | New `TrailHero` with product-glimpse + `ProofStrip` section, re-sequence `app/page.tsx`, migrate `animations.tsx` to canonical motion. | 🟡 **Stitch generation in progress** |
| **P4** | Five capabilities + screenshots | Rebuild `TrailJourney` as 5 capability cards with treated app screenshots. Fix TRAIL stage colours to SSOT. | ⏳ Not started |
| **P5** | Security · AI · FAQ · Pricing | Promote security to full section, add quiet AI section, build FAQ, build /pricing page (or inline). | ⏳ Not started |
| **P6** | Sign-in + sign-up redesign | Single-column auth treatment across `/signin`, `/register`, `/forgot-password`, `/verify-email`, `/resend-verification`, `/welcome`. | ⏳ Not started |
| **P7 (optional)** | Secondary page polish | `/trail-check`, `/trail-method`, `/wealth-check`, `/help`, `/legal` inherit P1-P6 tokens. | ⏳ Not started |

---

## 6. Creative Freedom (ideas backlog — picked from when roadmap is empty)

- **Editorial serif accent.** A single phrase per hero in serif italic (à la Stripe) — Tiempos or GT Sectra candidates. Currently parked; revisit once Inter-only direction has bedded in.
- **Dark mode variant.** Public site is light-mode-first. A dark mode variant for visitors with system preference set to dark could ship as Phase 47.2.
- **Wealth-builder testimonial section.** Currently using trust blocks (Phase 47 ICP rewrite). When real consenting customer stories exist, swap back to a testimonial format with proper ACL s18 compliance.
- **TRAIL Check teaser.** The 60-second TRAIL Check is a strong conversion gem — explore an inline mini-version on the landing page (one question + result preview) instead of a separate-page CTA.
- **Comparison table** vs. spreadsheets / vs. other tools. Only after enough product depth to make the comparison honest — premature comparison reads as defensive.

---

## 7. Direction history + parked decisions (do NOT re-attempt)

### v3 — Copilot-Money-inspired dark hero (current, 2026-05-26 ~01:00 UTC)

After 5 generations on the warm-ivory direction (hero v1+v2, below-hero v1+v2, five-and-how), Reza shared Copilot Money's landing page as the theme reference he prefers. Pivoting to:
- **Dark near-black hero background** (~#0A0A14 — NOT pure black)
- **Massive centred display typography** (Inter 700 or heavier, white, letter-spacing -0.04em)
- **Floating UI tile decoration** around the headline — but with WEALTH-BUILDER content (mini Net Worth card, mini Property card, mini SMSF card, mini Money Story card, etc.) — NOT Copilot's lifestyle-category emoji pills (Date Night/Groceries/Wedding/Baby — those are budget-app vocabulary, antithetical to Monitrax's wealth-builder ICP)
- **Singular emerald pill CTA** centred
- **Wealth-builder content preserved verbatim** — the floating tiles are wealth instruments, not lifestyle categories. THIS IS THE KEY DISTINCTION.

### v2 — warm-ivory + product-glimpse (deprecated 2026-05-26 ~01:00 UTC, preserved in `.stitch/designs/` as `-v1`/`-v2` files)

Strong structural direction: warm-ivory background, navy primary, emerald CTAs, Mercury/Stripe-shape. Reza wanted more visual presence and impact — pivoted to Copilot dark direction. The warm-ivory work is preserved (DON'T delete) and may be the right baseline for the AUTH pages even if the landing hero goes dark.

### v1 — amber-led dark hero (deprecated 2026-05-26 ~00:00 UTC)

Pre-existing site used stone-950 + amber-500 as primary brand. Decided to demote amber to TRAIL-R-accent only (it's the Reduce-stage hue in the SSOT). Do NOT re-attempt amber as primary brand colour.

### Permanently parked

- **Pure black backgrounds (`#000000`)** — even in dark mode, use `#0A0A14` or `#020617` to avoid OLED-burn / harshness.
- **Lifestyle-spending category objects (Date Night, Groceries, Wedding, Baby)** — those are budget-app DNA. Monitrax floats wealth structures (Property, SMSF, Trust, Investments, Super, Company, Cashflow, Tax).
- **Cartoon mascots / faces / character-led AI imagery** — Monitrax AI is presence (PresenceOrb), not persona.
- **100dvh heroes** — hero is 75-85vh, scroll-encouraged.

---

## 8. References

- Brand SSOT: `docs/architecture/08_BRAND_UI_DESIGN.md`
- UI/UX foundation: `docs/architecture/06_UI_UX_FOUNDATION.md`
- TRAIL framework: `docs/blueprint/TRAIL_FRAMEWORK.md`
- TRAIL stage hues SSOT: `lib/navigation/trailNav.tsx` → `TRAIL_STAGE_TONES`
- Canonical motion: `components/shell/motion.ts`
- AFSL boundary copy: `lib/tax-engine/boundaries/index.ts`
- Phase 47 ICP positioning: `IMPLEMENTATION_PLAN.md` Open Question Q-ICP-1 (decided 2026-05-24)
