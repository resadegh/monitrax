---
page: index
---

# Monitrax landing page — Hero + Proof Strip + One Picture (sections 1–3 of the new IA)

Generate the top three sections of the Monitrax public landing page. This is the **first impression surface** — the most important visual real estate on the entire product.

---

## SECTION 1 — HERO (~70-80vh, NEVER 100dvh)

### Layout (desktop)

Two-column at `lg` and up: 55% text on the left, 45% product-glimpse imagery on the right. Single column on mobile (text first, imagery below).

### Top — sticky nav (preserved across all sections)

- Left: small geometric **Monitrax** wordmark. The "M" is a refined geometric mark (single shape, navy, no gradient pill). Wordmark uses Inter semibold, navy on ivory.
- Centre nav (desktop only): `The TRAIL`, `Capabilities`, `Pricing`, `Security`. Inter medium, slate-700, soft underline on hover.
- Right: `Sign in` (ghost button, slate-700 text) + `Start free` (primary emerald button, `rounded-xl`, soft emerald shadow).
- Background: warm ivory `#FAFAF7` with `backdrop-blur-xl` and a hairline bottom border at `stone-200`.

### Hero content

- **Eyebrow (above headline):** small uppercase pill — *"Australian Wealth Operating System"* — slate-500 text, hairline stone-200 border, ivory background, `rounded-full`, `px-3 py-1`, letter-spacing `0.18em`, font-medium 12px.

- **Display-XL headline (semibold 600, NOT bold 700, letter-spacing -0.03em, line-height 1.05):**
  > **One view of everything you've built.**

  Two lines max. First line in navy `#0B1220`. The phrase "you've built" gets a subtle emerald `#16A34A` highlight (not a full gradient — a clean colour swap on the last 2 words).

- **Body-LG sub-headline (Inter 400, 18px, line-height 1.65, slate-500, max-width ~52ch):**
  > Property, loans, super, investments, cashflow, tax, and entities — in one calm view. So the next move is obvious before you make it.

- **Two CTAs (side by side, gap-3):**
  - Primary: **`Start free`** — `bg-emerald-500`, white text, `rounded-xl` (12px), `px-6 py-3`, Inter medium 16px, soft emerald shadow at rest (`0 12px 32px rgba(22, 163, 74, 0.18)`), lifts 2px on hover. NO arrow icon (Mercury-clean, not Webflow-template).
  - Secondary: **`Take the 60-second TRAIL Check →`** — ghost link, slate-700, Inter medium 14px, ArrowRight icon at 14px stroke-1.5. No background, no border.

- **Microcopy below CTAs (slate-500, 14px):** *"No credit card. No commitment. Just clarity."*

### Hero right column — PRODUCT GLIMPSE (this is critical)

A **treated product screenshot** of the Monitrax dashboard — specifically the "Money Story" hero card with three KPI lines (Earned · Kept · Free today). Render this as a stylised mock (since we don't have the actual asset embedded), like this:

A **`rounded-2xl` (16px) white card** with these contents (this is the mock of the in-product hero):
- Eyebrow row: small text *"YOUR MONEY STORY · LAST 30 DAYS"* in slate-400 uppercase, letter-spacing 0.18em, 11px. Right side: small ↗ icon.
- Big headline: *"$8,420"* in Inter semibold 48px, navy. Below in smaller text: *"Kept · last month"* slate-500 14px.
- Atmospheric mesh gradient behind the headline area — very subtle indigo-50 → sky-50 wash, no harsh edges.
- A 3-segment proportional bar (~12px tall, `rounded-full`):
  - First segment (24% width) in slate-400 — labelled *"Tax 24%"* below in 11px.
  - Middle segment (62% width) in slate-300 — labelled *"Spent 62%"*.
  - Last segment (14% width) in **emerald-500** — labelled *"Saved 14%"*.
- Below the bar, a 2-column KPI grid:
  - Left cell: *"Earned"* slate-400 11px uppercase, *"$28,500"* Inter semibold 24px navy, *"Monthly · before tax"* slate-500 12px.
  - Right cell: *"Free today"* slate-400 11px uppercase, *"$14,200"* Inter semibold 24px navy, *"47 days of life"* slate-500 12px.

Wrap the card in a **warm-ivory frame** (subtle outer shadow `0 24px 64px rgba(11, 18, 32, 0.10)`, slight upward tilt of ~1.5deg, soft inner highlight). The card should feel like it's *floating* on the ivory page.

### Section background

Solid warm-ivory `#FAFAF7`. **No gradient mesh on the section background itself** — the mesh is reserved for the product card. Page background should be calm and uninterrupted.

---

## SECTION 2 — PROOF STRIP

A thin band immediately below the hero, full-width, `py-12` vertical padding, ivory background with a subtle top divider (1px stone-100).

### Content

- Tiny eyebrow line at the top, centred: *"BUILT FOR AUSTRALIAN STRUCTURES"* — slate-500, uppercase, letter-spacing 0.18em, 11px.
- Below: a single row of **6 pill chips**, centred horizontally, gap-3 on desktop, wrap to 3-per-row on mobile.

Each pill:
- `rounded-full`, `px-4 py-2`, `border border-stone-200`, ivory background.
- 14px Inter medium, slate-700.
- Slight icon on left at 14px stroke-1.5 (line icon only, NO filled glyphs on the public site).

The 6 pills, in order:
1. 🏠 (Home icon) **Property**
2. 🏦 (Landmark icon) **SMSF**
3. 📊 (TrendingUp icon) **Investments**
4. 🤝 (Users icon) **Trust**
5. 🏢 (Building icon) **Company**
6. 💰 (PiggyBank icon) **Super**

The strip reads as a one-line answer to "do you know what I actually have?" — competence proof in 1 second.

---

## SECTION 3 — ONE PICTURE (the bridge section)

`py-24` desktop / `py-16` mobile. Solid warm-ivory `#FAFAF7` background (same as hero — no light/dark alternation).

### Layout

Centred two-column on desktop (`max-w-6xl`, gap-16): narrative on left (40%), illustrated explainer on right (60%). On mobile, narrative first, illustration below.

### Left column — narrative

- **Eyebrow:** *"ONE VIEW · NO SWIVEL-CHAIRING"* — slate-500, uppercase, letter-spacing 0.18em, 11px.

- **Display-LG headline (semibold 600, letter-spacing -0.025em, line-height 1.1, navy):**
  > Your financial life lives across **five tabs, two portals, and your accountant's head.**

  The phrase "**five tabs, two portals, and your accountant's head**" in slate-500 (a softer treatment) — so the contrast emphasises *the structural problem*, not adversarial.

- **Body paragraph (slate-500, 16px, line-height 1.65, max-width ~52ch):**
  > Monitrax brings them together. Property, loans, super, investments, cashflow, and tax — read by one engine, in one calm view, with the relationships between them already mapped. The picture you've been holding in your head, finally written down.

- **Quiet inline link:** *"See how it works →"* — slate-700, Inter medium 14px, hover underline.

### Right column — illustrated explainer

A **horizontal flow diagram** showing the consolidation visually. Three rows stacked vertically:

**Row 1 — "Before"** (slate-500 14px label on left):
- A messy row of 6 small disconnected card icons: a bank, a property, a super logo, a brokerage, a tax form, a calculator. Each in its own small rounded-lg `bg-stone-100` chip, scattered horizontally with slight rotation, all in muted slate-400. The visual reads as **fragmented**.

**Connector** (downward arrow, small, slate-300, 24px, centred).

**Row 2 — "Monitrax"** (slate-700 14px label):
- A single elegant `rounded-2xl` card (ivory, `border border-stone-200`, `shadow-sm`, `p-6`). Inside: a 3-line horizontal layout — top line *"Net worth $1.42M"* (navy, Inter semibold 20px), middle line a single thin horizontal bar broken into 4 proportional segments (sky / amber / indigo / emerald — TRAIL stages), bottom line *"Track · Reduce · Anchor · Invest"* slate-400 uppercase 11px letter-spacing 0.18em.

**Connector** (downward arrow).

**Row 3 — "Now you can decide"** (emerald-600 14px label):
- One large bold statement card: *"Sell the brokerage holdings, pay down the offset, or salary-sacrifice $200/mo to super?"* in navy Inter medium 16px, with a subtle emerald-50 background, `rounded-2xl`, `p-6`, `border border-emerald-100`.

The whole illustration should feel **calm and editorial** — not infographic-busy. Generous whitespace between the three rows.

---

## OVERALL CHROME REQUIREMENTS

- **Sticky header** with `backdrop-blur-xl` and `bg-ivory/85` — visible across all sections.
- **Section transitions** are *subtle band changes*, not alternating light/dark. All three sections in this generation are warm ivory.
- **Typography** strictly follows the type scale below.
- **No animations specified** in the static render — motion will be applied at React-component conversion time.

---

**DESIGN SYSTEM (REQUIRED — read every line, apply rigorously):**

**Brand:** Monitrax — Australian wealth-operating-system for mass-affluent wealth-builders. Visual reference: Mercury, Stripe, Linear, Arc, Apple. Never crypto, never trading app, never template SaaS.

**Background:** Warm ivory `#FAFAF7` (NEVER pure white, NEVER pure black). Dark sections use deep navy `#0B1220`. Section transitions are *subtle band changes*, not light/dark/light alternation.

**Primary text:** Slate-900 `#0F172A` on ivory. Ivory `#FAFAF7` on navy.
**Secondary text:** Slate-500 `#64748B` on ivory. Slate-300 `#CBD5E1` on navy.

**Primary CTA:** Emerald `#16A34A`, white text, `rounded-xl` (12px), `px-6 py-3` (or `px-8 py-4` for hero CTA), `font-medium` (500), soft emerald shadow at rest (`0 12px 32px rgba(22, 163, 74, 0.18)`), lifts 2px on hover (`translate-y-[-2px]`). NEVER amber, NEVER navy fill as primary CTA. NEVER gradients on CTAs except a subtle emerald-500 → emerald-600 vertical gradient.

**Secondary CTA:** Ghost button. Text in navy/ivory matching surface, no fill, small underline animation on hover.

**Typography:** Inter only. Weights 400 / 500 / 600 / 700. Display headlines use **semibold 600 (never bold 700)**, letter-spacing `-0.03em`, line-height 1.05–1.1. Body text uses regular 400, line-height 1.65. Eyebrows use medium 500, UPPERCASE, letter-spacing `0.18em`.

**Section vertical rhythm:** `py-24` (96px) desktop, `py-16` (64px) mobile. NEVER less than `py-16`.

**Card surfaces:**
- Standard card: `bg-white`, `rounded-2xl` (16px), `border border-stone-200`, `p-8`, `shadow-sm`, hover `shadow-md` + `translate-y-[-2px]`.
- Apple-glass hero tile: `rounded-[28px]`, white at 85% with `backdrop-blur-xl`, `ring-1 ring-black/5`, subtle inner top highlight, single-hue atmospheric mesh gradient *only* (sky-50 → indigo-50, OR ivory → emerald-50, never rainbow).
- Atmospheric tile: `rounded-[22px]`, same family but smaller.

**Hero pattern:** Eyebrow (uppercase, tracked, slate-500) → display-xl headline (max two lines, semibold) → body-lg subhead (one paragraph, slate-500, max 60ch) → two CTAs (primary emerald + secondary ghost) → product-glimpse imagery (treated screenshot in a warm-ivory frame with soft shadow). NEVER 100dvh — hero is ~70-80vh, scroll-encouraged.

**Imagery treatment:** Product screenshots are treated assets — soft `shadow-lg` (warm-navy-tinted, never pure black), `rounded-2xl` frame, slight upward tilt (≤2deg) for hero only, no tilt for in-section. NEVER fullbleed-bleeding-off-the-edge product imagery. ALWAYS framed.

**Iconography:** Lucide icons at 16-24px, stroke 1.5px (the lighter-than-default weight). Filled silhouette glyphs are reserved for in-app surfaces. On the public site use line icons only.

**Motion:** Smooth, subtle, Apple-grade. Easing curve is `cubic-bezier(0.25, 0.46, 0.45, 0.94)` ("appleEase"). Hover lifts are 2px max. Section entries are fade-up 24px over 700ms with 120ms stagger. NEVER bouncy springs, parallax, or scroll-driven scale effects. ALL motion respects `prefers-reduced-motion: reduce`.

**TRAIL stages** (when representing the five-stage framework): T=Sky `#0EA5E9`, R=Amber `#F59E0B`, A=Indigo `#6366F1`, I=Emerald `#16A34A`, L=Violet `#8B5CF6`. Each stage gets its hue ONLY when explicitly representing that stage. NEVER mix stage hues at random.

**Forbidden:** Pure black, pure white, red (except true errors), neon, rainbow gradients, glassmorphic-on-everything, drop-shadows in pure black, font-weight 700 on display sizes, bouncy spring motion, parallax, 100dvh heroes, cartoon illustrations, mascots, abstract 3D blobs, generic stock photography.

**Required:** Inter typography, warm-ivory base, emerald CTAs, generous whitespace (py-24 sections), light-touch shadows, semibold (600) display weights, restraint-as-premium discipline.
