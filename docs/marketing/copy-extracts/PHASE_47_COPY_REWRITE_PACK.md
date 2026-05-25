# Phase 47 — Copy Rewrite Pack for ChatGPT

> **Operator workflow:** Open ChatGPT (GPT-5 or strongest reasoning model). Paste the **Master Positioning Brief** below as the FIRST message. Then for each section, paste the prompt + current strings. ChatGPT returns the rewritten strings in the same labelled structure. You send them back to me; I integrate into the codebase.
>
> **Scope rule:** ChatGPT touches CONTENT ONLY. Never code, never .tsx, never schema. All TypeScript / React work stays with the developer.
>
> **Created:** 2026-05-25 (Phase 47 row 66 — positioning rewrite to wealth-builder ICP).

---

## Master Positioning Brief — paste FIRST

```
You are helping me rewrite the marketing and positioning copy for
Monitrax — an Australian fintech software product operated by
ReNew Holding Company Pty Ltd (ACN 675 267 311).

Read this brief carefully. EVERY rewrite must obey it.

## The ICP (Ideal Customer Profile) — singular

Australian mass-affluent wealth-builders. Sometimes called HENRYs
(High Earners Not Rich Yet). Concretely:

- Age 35–55
- Household income roughly $120k–$400k
- One or two properties (PPOR maybe + investment property)
- Super, possibly self-managed
- A brokerage account or two
- Maybe a small business, trust, or company structure
- Tax-aware but not expert
- Time-poor

Their pain is INTEGRATION DEBT, not poverty. Each piece of their
financial life works in isolation (bank, super, accountant,
mortgage broker, share platform) — but the picture is broken.
They cannot answer "where is my money going, am I building wealth
fast enough, and what should I do next?" without consulting
multiple professionals or holding it all in their head.

## Who Monitrax is NOT for

The stressed-beginner / poverty / debt-avoidance persona that
mass-market personal-finance marketing typically targets. Those
users have free, polished, bank-feed-enabled apps like Up Bank,
Frollo, WeMoney. Monitrax doesn't compete there and shouldn't
pretend to.

If a sentence in the current copy sounds like it's written for
someone who "avoids opening bills" or "doesn't know if they can
raise $2,000 in an emergency" — REMOVE IT. Wrong persona.

## Voice

- Warm, plain English, calm
- Australian — not American (no "401k", no "$" without context)
- No hype, no FOMO, no manufactured urgency
- No SaaS hyperbole ("transform", "unlock", "revolutionise")
- No shaming the user ("you're behind", "you're failing")
- No "72% of Australians are stressed about money" stats —
  wrong persona's anxiety
- Respectful — the reader earns well, is competent, but can't
  see the whole picture
- Confidence without arrogance

## The reframed anxiety

NOT: "Stop stressing about money."
YES: "When you've got more than three moving parts, the picture
     lives in five tabs and your accountant's head."

NOT: "Stop avoiding your finances."
YES: "You don't have a money problem. You have a picture problem."

NOT: "Get out of debt."
YES: "See what you've actually built, where it's leaking, and
     what moves the needle."

## TRAIL framework — preserved, reframed

TRAIL stays as the 5-stage journey: Track → Reduce → Anchor →
Invest → Live. But the framing of each stage shifts from "fixing
financial dysfunction" to "running the picture cleanly":

- TRACK = "See it all in one place" (not "stop avoiding")
- REDUCE = "Stop the leaks you can't currently see"
            (not "fix spending dysfunction")
- ANCHOR = "Confirm the safety net is real"
            (not "build one because you don't have one")
- INVEST = "Make the next move with the full picture"
            (not "start investing because you don't")
- LIVE   = "Decide from abundance, not from a spreadsheet"

## Competitive context (use sparingly)

- PocketSmith — cashflow forecasting, no entity/tax depth
- Sharesight — investments + CGT, no cashflow or property
- Up Bank / Frollo / WeMoney — free PFM, bank feeds, but no
  property/tax/entity depth
- Xero — bookkeeping, business-focused
- Class / BGL — accountant tools, not consumer-facing
- Personal Capital (US, now Empower) — closest model

Monitrax is the only AU consumer surface that unifies:
personal + property + investment + super + tax + entity
structures. That's the wedge.

## AFSL boundary (CRITICAL — applies to ALL copy)

ReNew Holding Company Pty Ltd does NOT hold:
- an Australian Financial Services Licence (AFSL)
- an Australian Credit Licence (ACL)
- a TASA tax-agent registration

Monitrax provides FACTUAL INFORMATION and SOFTWARE MODELLING. It
does NOT recommend products, lenders, advisers, or specific actions.

Copy MUST reflect this:
- Never write "we recommend", "you should", "the best choice"
- Never name a specific financial product, fund, broker, lender,
  ETF, or platform
- Always write "we help you see", "we show you what changes if you",
  "you decide"

## Status and live-bank-feed honesty

Bank connections (via Consumer Data Right / Basiq) are NOT yet
enabled in production. Reza is going through accreditation. The
current product is manual entry + CSV import. Copy must not promise
live bank feeds as a current feature. Acceptable framing:
"live bank connections coming later this year" or "manual entry
for now, live bank feeds in development".

## Format rules for everything you return

- Use the exact labelled structure shown for each section
- Plain text, no extra commentary, no "Sure! Here's a rewrite..."
- Don't add or remove sections unless I explicitly ask
- Keep the same approximate length per element (heading stays
  short, body stays a paragraph)
- Preserve Australian spelling ("organise" not "organize",
  "centre" not "center")
- Preserve any &mdash; / &rsquo; / &amp; / &rdquo; HTML entities
  if they appear in source — they're rendered into proper
  punctuation by the website

Confirm you understand by replying with one sentence, then wait
for the first section.
```

---

# SECTION 1 — Root landing page hero (`TrailHero`)

## Current strings

```
EYEBROW:      Your personal financial guide — built for Australians

HEADLINE:     Stop stressing about money.
              Start following the TRAIL.

SUBHEADLINE:  Monitrax connects your bank accounts, tracks everything,
              and guides you step by step to financial freedom.

PRIMARY_CTA:  Start your TRAIL — it's free

SECONDARY_LINK: Or take the free TRAIL Check — 60 seconds →
```

## ChatGPT prompt

```
Section 1 — Root landing page HERO (the first thing every cold
visitor sees). The current copy targets a stressed beginner.
Rewrite for the wealth-builder ICP per the Master Brief.

Notes:
- "Stop stressing about money" — wrong persona. Replace.
- Don't promise "connects your bank accounts" as a current feature
  (see Master Brief — live feeds not yet enabled). Reframe as
  the picture, the data, the modelling — what works today.
- Primary CTA stays a single short line; "Start free" / "Get
  started" / "See your picture" style.
- Secondary link can reference the TRAIL Check (60-second free
  assessment at /trail-check) but tighten the copy.

Return in this exact labelled structure:

EYEBROW:
HEADLINE_LINE_1:
HEADLINE_LINE_2:
SUBHEADLINE:
PRIMARY_CTA:
SECONDARY_LINK:
```

---

# SECTION 2 — Root landing page problem statement (`TrailProblem`)

## Current strings

```
HEADLINE:        You're not bad with money.
                 You just don't have a path.

PAIN_POINT_1:    You have 4 bank accounts, 2 credit cards, and a
                 mortgage. None of them talk to each other.

PAIN_POINT_2:    You check your balance and wonder where $3,000
                 went last month.

PAIN_POINT_3:    You know you should be doing better. You just
                 don't know where to start.

STAT_BLOCK:      72% of Australians feel stressed about money.
                 You're not alone.
```

## ChatGPT prompt

```
Section 2 — Problem statement on the root landing. This section
currently shows a stressed beginner three pain points + a
"72% of Australians" stat.

For the wealth-builder ICP:
- Remove the "72% stressed" stat entirely (wrong persona's anxiety).
  Replace with something that resonates for someone with properties,
  super, and complexity — e.g., a quiet observation about how the
  picture lives in N tabs.
- The headline should reframe the problem as integration / picture,
  not "bad with money".
- The 3 pain points should each describe a wealth-builder-specific
  fragmentation moment (e.g., "Your accountant sees one slice once a
  year"; "Your super statement and your broker statement never get
  compared"; "You can guess your net worth within 20% but couldn't
  prove it tonight").

Return in this exact labelled structure:

HEADLINE_LINE_1:
HEADLINE_LINE_2:
PAIN_POINT_1:
PAIN_POINT_2:
PAIN_POINT_3:
CLOSING_LINE:
```

---

# SECTION 3 — Root landing page bridge (`TrailBridge`)

## Current strings

```
HEADLINE:   What if your money
            had a guide?

BODY:       Not another app that shows you charts and leaves you to
            figure it out. A personal financial guide that walks
            beside you — from confusion to confidence, one step at
            a time.
```

## ChatGPT prompt

```
Section 3 — Bridge section between the problem and the journey on
the root landing. Currently positions Monitrax as "a guide" that
walks beside you.

For the wealth-builder ICP:
- "Guide" is still good language — the in-app product surface is
  called My Guide. Keep that vocabulary.
- But "from confusion to confidence" feels too beginner. The
  wealth-builder isn't confused; they're under-integrated.
- The headline can stay as a question, but should ask about
  picture / integration / next-move, not generic "guide".
- Body should describe what's different — Monitrax models the
  full picture, including the parts other apps don't (property
  + entities + tax).

Return in this exact labelled structure:

HEADLINE_LINE_1:
HEADLINE_LINE_2:
BODY:
```

---

# SECTION 4 — Root landing page TRAIL journey (`TrailJourney`)

## Current strings

```
EYEBROW:        The TRAIL Framework

HEADLINE:       Five steps. One trail.
                Your financial freedom.

STAGE_T_TAGLINE: See your full picture
STAGE_T_BODY:    Connect your bank in 60 seconds. See every account,
                 every loan, every dollar — all in one place. The
                 unknown is always scarier than the known.

STAGE_R_TAGLINE: Fix the leaks
STAGE_R_BODY:    Your Guide finds the waste: forgotten subscriptions,
                 impulse spending, debt that's costing you. Fix the
                 leaks before you fill the bucket.

STAGE_A_TAGLINE: Build your safety net
STAGE_A_BODY:    Build an emergency fund so one unexpected bill
                 doesn't send you backward. Three months of
                 expenses. That's your anchor.

STAGE_I_TAGLINE: Grow your wealth
STAGE_I_BODY:    Properties. Shares. Super. Assets. Track them
                 all. Watch your net worth climb. Compound growth
                 is how wealth is built.

STAGE_L_TAGLINE: On your terms
STAGE_L_BODY:    Your money works for you. Your Guide shifts from
                 triage to optimisation. You make choices from
                 abundance, not stress.
```

## ChatGPT prompt

```
Section 4 — The TRAIL framework on the root landing. 5 stage cards
(T-R-A-I-L), each with a tagline (4-6 words) and a body paragraph
(2-3 sentences).

For the wealth-builder ICP, reframe each stage per the Master
Brief's TRAIL framework section:

- TRACK = "See it all in one place" — not "60 seconds, scary
  unknowns". Remove the "connect your bank in 60 seconds" promise
  (live feeds not yet enabled).
- REDUCE = "Stop the leaks you can't currently see" — examples
  should fit a wealth-builder (forgotten subscription is fine but
  also things like duplicate insurance, an inefficient mortgage
  product, money sitting in a low-interest account).
- ANCHOR = "Confirm the safety net is real" — the wealth-builder
  often already has 3 months of expenses; the stage is about
  confirming it's actually liquid and accessible, not building from
  zero.
- INVEST = "Make the next move with the full picture" — property,
  shares, super, but framed as informed-decisions-not-cheerleading.
  Don't say "compound growth is how wealth is built" (preachy).
- LIVE = "Decide from abundance, not from a spreadsheet" — the
  destination is clarity + freedom of choice, not "money works
  for you" (corporate cliché).

Return in this exact labelled structure:

EYEBROW:
HEADLINE_LINE_1:
HEADLINE_LINE_2:
STAGE_T_TAGLINE:
STAGE_T_BODY:
STAGE_R_TAGLINE:
STAGE_R_BODY:
STAGE_A_TAGLINE:
STAGE_A_BODY:
STAGE_I_TAGLINE:
STAGE_I_BODY:
STAGE_L_TAGLINE:
STAGE_L_BODY:
```

---

# SECTION 5 — Root landing page how-it-works (`TrailHowItWorks`)

## Current strings

```
HEADLINE:      Your guide in three taps

STEP_1_TITLE:  Connect your bank
STEP_1_DESC:   Secure Open Banking. Automatic. 60 seconds.

STEP_2_TITLE:  Discover your TRAIL stage
STEP_2_DESC:   We analyse your finances and show you where you are.

STEP_3_TITLE:  Follow your Guide's advice
STEP_3_DESC:   Personalised recommendations. One step at a time.
```

## ChatGPT prompt

```
Section 5 — "How it works" section on the root landing. 3 steps,
each a title + a short description.

Critical changes:
- Step 1 currently says "Connect your bank — Secure Open Banking.
  Automatic. 60 seconds." — live bank feeds aren't enabled yet.
  Reframe: manual entry + CSV import today, bank feeds in
  development. Or pivot Step 1 to "Add your picture" / "Tell us
  what you've got" / similar.
- Step 3 currently says "Follow your Guide's advice — Personalised
  recommendations." — AFSL boundary issue. We don't give
  recommendations; we surface information. Reframe as "See the
  next move" / "Model the lever you're considering" or similar.
- The whole flow should feel like setup → see → decide, not
  setup → analyse → comply.

Return in this exact labelled structure:

HEADLINE:
STEP_1_TITLE:
STEP_1_DESC:
STEP_2_TITLE:
STEP_2_DESC:
STEP_3_TITLE:
STEP_3_DESC:
```

---

# SECTION 6 — Root landing page testimonials (`TrailTestimonials`)

## Current strings

```
HEADLINE:        Australians on the TRAIL

TESTIMONIAL_1:   "Before Monitrax, I had 6 apps and no idea where
                 our money went. Now our household saves $800/month
                 and I can actually see our path to paying off the
                 mortgage."
TESTIMONIAL_1_NAME:     Sarah M.
TESTIMONIAL_1_LOCATION: Melbourne
TESTIMONIAL_1_SINCE:    2025

TESTIMONIAL_2:   "I went from dreading my bank balance to checking
                 Monitrax every morning with my coffee. My net
                 worth is up $42K in 8 months."
TESTIMONIAL_2_NAME:     James T.
TESTIMONIAL_2_LOCATION: Brisbane
TESTIMONIAL_2_SINCE:    2025

TESTIMONIAL_3:   "My Guide told me I had $340/month in subscriptions
                 I'd forgotten about. That's $4,080 a year. I felt
                 sick — then I felt relieved."
TESTIMONIAL_3_NAME:     Emma L.
TESTIMONIAL_3_LOCATION: Sydney
TESTIMONIAL_3_SINCE:    2026

TRUST_BADGE_1:   Bank-grade encryption
TRUST_BADGE_2:   Australian owned
TRUST_BADGE_3:   CDR accredited
TRUST_BADGE_4:   No ads, no trackers
```

## ChatGPT prompt

```
Section 6 — Testimonials section on the root landing. 3 testimonials
+ 4 trust badges.

IMPORTANT NOTES BEFORE YOU REWRITE:
- These testimonials are fictional placeholders. The product has
  no live customers yet — only friendlies just invited.
- DO NOT invent real-sounding testimonials with specific dollar
  amounts. That would be misleading conduct under ACL s18.
- I have two options for this section, please draft both:

OPTION A — Replace with placeholder/illustrative testimonials
that READ AS ILLUSTRATIVE (clearly labelled as such, plain
language about what the product helps you see, no fabricated
metrics). Each one should still be 2-3 sentences and feel
authentic to a wealth-builder.

OPTION B — Replace the entire testimonials section with a
"trust + transparency" block: instead of testimonials, surface
3 things that build credibility without lying. Examples:
  - The framework Monitrax is built on (TRAIL — reference)
  - The compliance posture (Privacy / AFSL boundary / CDR
    Representative — pending)
  - The fact it's built by an Australian wealth-builder for
    wealth-builders (founder note)

For the 4 trust badges:
- "Bank-grade encryption" — keep (technically true, vague enough)
- "Australian owned" — keep
- "CDR accredited" — CHANGE: not yet accredited; in progress.
  Reframe as "CDR-pathway in progress" or "Built to CDR
  standards" or remove entirely.
- "No ads, no trackers" — keep

Return BOTH options in this structure:

=== OPTION A ===
HEADLINE:
TESTIMONIAL_1: (illustrative — 2-3 sentences for the wealth-builder)
TESTIMONIAL_1_LABEL: (e.g., "Illustrative — wealth-builder scenario")
TESTIMONIAL_2:
TESTIMONIAL_2_LABEL:
TESTIMONIAL_3:
TESTIMONIAL_3_LABEL:
TRUST_BADGE_1:
TRUST_BADGE_2:
TRUST_BADGE_3:
TRUST_BADGE_4:

=== OPTION B ===
HEADLINE:
TRUST_BLOCK_1_TITLE:
TRUST_BLOCK_1_BODY:
TRUST_BLOCK_2_TITLE:
TRUST_BLOCK_2_BODY:
TRUST_BLOCK_3_TITLE:
TRUST_BLOCK_3_BODY:
TRUST_BADGE_1:
TRUST_BADGE_2:
TRUST_BADGE_3:
TRUST_BADGE_4:

(I will pick Option A or B and ask the developer to wire that
one in.)
```

---

# SECTION 7 — Root landing page final CTA (`TrailCTA`)

## Current strings

```
HEADLINE:      Ready to start your TRAIL?

SUBHEAD:       Join thousands of Australians who stopped stressing
               about money and started living.

PRIMARY_CTA:   Start for free

SUB_CTA:       No credit card. No commitment. Just clarity.

SECONDARY_LINK: Not ready? Take the free TRAIL Check first →

ITALIC_OUTRO:  Your trail to financial freedom starts with one step:
               seeing where you stand.
```

## ChatGPT prompt

```
Section 7 — Final CTA at the bottom of the root landing.

Changes:
- "Join thousands of Australians" — there ARE no thousands.
  Misleading-conduct risk. Remove the social-proof claim.
- "stopped stressing about money" — wrong persona again.
- Italic outro is fine in shape but reframe the anxiety.

Return in this exact labelled structure:

HEADLINE:
SUBHEAD:
PRIMARY_CTA:
SUB_CTA:
SECONDARY_LINK:
ITALIC_OUTRO:
```

---

# SECTION 8 — Marketing footer tagline (`Footer`)

## Current string

```
TAGLINE: The Australian wealth operating system for property
         investors and wealth builders.
```

## ChatGPT prompt

```
Section 8 — One-line tagline that appears next to the logo in the
marketing footer.

Current version is decent. Suggest 3 alternatives in case any of
them resonate better. Keep it to ~12-18 words, the wealth-builder
ICP, no AFSL drift.

Return in this exact labelled structure:

TAGLINE_OPTION_A:
TAGLINE_OPTION_B:
TAGLINE_OPTION_C:
```

---

# SECTION 9 — Register page hero panel

## Current strings

```
HEADING:    Start building your wealth today.

SUBHEAD:    Track properties, loans, investments and cash in one
            place. Make smarter decisions with Australian-aware
            forecasts.
```

## ChatGPT prompt

```
Section 9 — The branded left-side panel on the registration page.
Last impression before signup. Currently fine, but verify against
the Master Brief.

Return in this exact labelled structure:

HEADING:
SUBHEAD:
```

---

# SECTION 10 — `THE_TRAIL_METHOD.md` long-form narrative

## Workflow

This is a full-file rewrite, not strings. Paste the current file content (~275 lines) into the same ChatGPT session after the strings sections.

## ChatGPT prompt

```
Section 10 — Long-form positioning narrative at docs/marketing/
THE_TRAIL_METHOD.md.

This is the marketing essay that explains TRAIL — Monitrax's
five-stage framework — to a serious reader (article-length).

The current version is written for the WRONG persona (the stressed
beginner who avoids bills). Rewrite the full narrative for the
wealth-builder ICP per the Master Brief.

Keep:
- The TRAIL acronym: Track → Reduce → Anchor → Invest → Live
- Markdown structure (headings, sub-sections, blockquotes)
- The frontmatter exactly as-is (if any)
- The 5 stages as the central organising idea
- Any academic / framework citations that aren't persona-specific
  (Bandura, Prochaska, Maslow) IF they reframe naturally for the
  new persona

Change:
- The entire framing — the reader is a wealth-builder with
  integration debt, not a stressed beginner
- Remove all stress statistics ("72%", "13 IQ points") — wrong
  persona's anxiety
- Remove any shaming language, financial-avoidance framing,
  "you're behind"
- Each stage's emotional arc — see Master Brief reframed-anxiety
  section
- Examples — use wealth-builder examples (mortgage, super, IP,
  trust, tax position) not beginner ones (Afterpay, consumer debt)
- The competitor comparison at the end — frame Monitrax as the
  only AU consumer surface that unifies personal + property +
  investment + super + tax + entity

Target length: roughly 1,500–2,200 words. Plain English. Calm and
respectful tone. Confident, not preachy.

Now I will paste the current file. Return the complete rewritten
file in a single Markdown code block.

[PASTE CURRENT docs/marketing/THE_TRAIL_METHOD.md CONTENT HERE]
```

---

# SECTION 11 — `TRAIL_WEBSITE_COPY.md` canonical copy bank

## Workflow

Full-file rewrite. Same ChatGPT session, paste after Section 10.

## ChatGPT prompt

```
Section 11 — Canonical website-copy bank at docs/marketing/
TRAIL_WEBSITE_COPY.md.

This is the SSOT for all the strings used across the public
website — hero variants, section headlines, value prop blurbs,
CTAs, FAQ items. Currently written for the stressed-beginner
persona. Rewrite for the wealth-builder per the Master Brief.

Keep:
- Markdown structure
- Sectional organisation (heroes, value props, FAQs, CTAs, footer,
  etc.)
- Frontmatter as-is
- The same number of variants where the file lists multiple
  options for A/B testing

Change:
- The persona behind every string
- The anxiety addressed (complexity, not poverty)
- The examples and proof points (wealth-builder, not beginner)

Now I will paste the current file. Return the complete rewritten
file in a single Markdown code block.

[PASTE CURRENT docs/marketing/TRAIL_WEBSITE_COPY.md CONTENT HERE]
```

---

# SECTION 12 — `FRIENDLIES_INVITE_PLAYBOOK.md` email templates

## Workflow

Full-file rewrite of the EMAIL TEMPLATES inside this playbook (subject lines + body text). Leave the operational notes / stage definitions / Airtable spec alone.

## ChatGPT prompt

```
Section 12 — Friendlies-cohort outreach playbook at docs/marketing/
gtm/FRIENDLIES_INVITE_PLAYBOOK.md.

This contains email templates Reza sends from his personal Gmail
to a hand-picked cohort of 5-10 wealth-builder friendlies. Some
have already been sent — this is a refresh for the next wave.

Rewrite ONLY the email body templates and subject-line variants:
- The invite email (first contact)
- The 2-week follow-up
- The re-engage message (if they signed up but went quiet)
- The testimonial ask (4-6 weeks in)
- The referral ask (8-12 weeks in)

Tone: warm, personal, from a friend who happens to be building
this product. Not marketing email. First-name basis, short, ONE
clear ask per email. No marketing-speak.

DO NOT change:
- Subject-line variant lists (keep the same NUMBER of variants
  per email, just rewrite each variant)
- Stage progression (Invited → Signed up → Active → etc.)
- Operational notes that aren't user-facing
- File structure and section headings
- Airtable specifications / lifecycle / failure modes sections

Now I will paste the current file. Return the complete rewritten
file in a single Markdown code block.

[PASTE CURRENT docs/marketing/gtm/FRIENDLIES_INVITE_PLAYBOOK.md
CONTENT HERE]
```

---

# SECTION 13 — `GTM_EXECUTION_PLAN.md` outbound positioning lines

## Workflow

Selective rewrite within the existing file. Only the customer/broker-facing copy. Leave operator notes / phase tracking / tool stack alone.

## ChatGPT prompt

```
Section 13 — Operational GTM playbook at docs/marketing/
GTM_EXECUTION_PLAN.md.

This is a long operational document covering outbound, Reviews,
broker onboarding, etc. DON'T do a full rewrite. Rewrite ONLY the
customer/broker-facing copy:

- Any "what is Monitrax" descriptions (1-3 sentences each)
- Any outbound email body templates (subject + body) for brokers
  or potential Review-service customers
- Any "value prop" language describing benefits to the broker or
  consumer
- Any FAQ-style answers about "what does it do"

DO NOT touch:
- Phase numbering / structure
- Status tables / checklists / completion ticks
- Tool stack / cost references
- Internal operator notes (anything not addressed to a customer
  or broker)

Brokers are talking to wealth-builder clients, so the broker pitch
should land on "your wealth-builder clients can finally see the
integrated picture; you can have better refinance conversations
backed by real data".

Now I will paste the current file. Return the complete rewritten
file in a single Markdown code block. Where you've kept a section
verbatim, just keep it verbatim — don't compress or remove it.

[PASTE CURRENT docs/marketing/GTM_EXECUTION_PLAN.md CONTENT HERE]
```

---

## Recommended order of execution

| Order | Section | Reason |
|---|---|---|
| 1 | Master Brief (top of this doc) | Always first |
| 2 | Section 1 — TrailHero | Highest-leverage surface; every cold visitor sees it |
| 3 | Section 2 — TrailProblem | "72%" stat is the most jarring; fix early |
| 4 | Section 4 — TrailJourney | The TRAIL framework reframe is the core lift |
| 5 | Section 3 — TrailBridge | Small, but binds 2 and 4 |
| 6 | Section 5 — TrailHowItWorks | Live-feed honesty fix matters |
| 7 | Section 6 — TrailTestimonials | Get both options, decide later |
| 8 | Section 7 — TrailCTA | Tight, fast |
| 9 | Section 9 — Register hero | Tiny, last |
| 10 | Section 8 — Footer tagline | Pick from 3 alternatives |
| 11 | Section 10 — THE_TRAIL_METHOD | Long-form, save for a fresh ChatGPT session if 1-9 used a lot of context window |
| 12 | Section 11 — TRAIL_WEBSITE_COPY | Same |
| 13 | Section 12 — FRIENDLIES_INVITE_PLAYBOOK | Already partly sent — refresh for next wave |
| 14 | Section 13 — GTM_EXECUTION_PLAN | Lowest urgency — outbound isn't live yet |

## How to send rewrites back to the developer

For each section, copy ChatGPT's response (the structured labelled output) into a single chat message back to me. Format suggestion:

```
SECTION 1 — TrailHero (rewrite):
EYEBROW: <new text>
HEADLINE_LINE_1: <new text>
HEADLINE_LINE_2: <new text>
SUBHEADLINE: <new text>
PRIMARY_CTA: <new text>
SECONDARY_LINK: <new text>
```

I'll match the labels back to the source files and integrate. Send sections one at a time or batched — either works.

For the three `.md` full-file rewrites (Sections 10, 11, 13) and the partial rewrite (Section 12), paste the full markdown output back in a single message per file. I'll commit the new file verbatim.
