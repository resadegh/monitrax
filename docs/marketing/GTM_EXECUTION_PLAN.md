# Monitrax GTM Execution Plan

> **A step-by-step playbook to take Monitrax from pre-launch to first paying customers via a B2B-led go-to-market.**
> Each step is small, self-contained, and has a clear "done" definition. Come back and say *"guide me through step 2.3"* and I (Claude) will walk you through it.

**Owner:** Reza
**Last updated:** 2026-05-11
**Tracked in:** `docs/IMPLEMENTATION_PLAN.md` → Active Workstream "GTM Automation"
**Aligns with:** CLAUDE.md §0 (Advisory Mindset), Part 14 (TRAIL), Part 13 (CDR), `.claude/skills/architect-mode`

---

## How to use this doc

- Phases run roughly sequential. Don't start Phase 2 before Phase 1 is `done`.
- Each step has: **Goal**, **Time**, **Prerequisites**, **Action**, **Done when**, **Gotchas**.
- When you want to execute a step, message: *"execute step X.Y from the GTM plan"* — Claude will produce the concrete artefacts (n8n JSON, copy, prompts, schemas) and walk you through.
- This doc is the *script*. The artefacts (workflows, templates, prompts) live in `docs/marketing/gtm/` (created as we build).

---

## The strategy in one paragraph

Sell to **mortgage brokers first** (B2B wedge — they bring 50–500 clients each, have budget, and have a real recurring pain in client engagement + refinance triggers). Use a **paid "Financial Health Review" service** (~$200–400 fixed-price) as cash-now. Treat **consumer subscriptions as the post-Basiq long game**, not the next quarter. The automation stack (n8n + Claude + Instantly + Airtable + Stripe) runs the volume layer; you spend your hours only on broker calls, the AFSL line, and product decisions.

## The 90-day shape (target outcomes)

| End of | Outcome | Cumulative revenue (rough) |
|---|---|---|
| **Week 2** | Outbound running at 30 leads/day, 5 Reviews sold to friendlies | ~$1–2k |
| **Week 6** | 2–3 broker pilots verbally agreed, 10–15 Reviews delivered, 2 case studies | ~$4–6k |
| **Week 12** | First paid broker contract(s), 20–50 broker-referred users, repeatable outbound, **Basiq go/no-go decision triggered** | ~$8–15k + first MRR |

## The Basiq gate (non-negotiable)

Basiq is $10k upfront + $2k/mo minimum + ~1 month onboarding. **Do not start Basiq onboarding until both these conditions are met:**
1. ≥ **AU$3–5k committed MRR** from signed broker contracts (covers the $2k/mo with buffer).
2. ≥ **AU$10k cash on hand** from Reviews / broker upfront fees (absorbs the initial fee without breaking the ops budget).

Until then, Monitrax operates on **manual data entry / CSV import**. Brokers + Reviews do not need Basiq to deliver value on day one.

---

## Phase 0 — Pre-flight (Day 0, ~2 hours)

### Step 0.1 — Lock the AFSL boundary
- **Goal:** Decide, in writing, exactly what the Financial Health Review will and will not say. Stay on the *factual / general-information* side of the ASIC line. No personal recommendations.
- **Time:** 30 min.
- **Action:** Draft a one-page "Review Scope & Boundaries" doc covering: what the Review states (facts, ratios, gaps, generic TRAIL-stage observations), what it does NOT state (specific product recommendations, "you should invest in X", personal tax advice), the disclaimer at the top + bottom of every Review.
- **Done when:** Document exists at `docs/marketing/gtm/REVIEW_SCOPE_AND_BOUNDARIES.md` and you've read it twice.
- **Gotcha:** If in doubt, leave it out. ASIC enforcement on unlicensed personal advice is active — one complaint is a business-ending event. Ask Claude to draft a first cut, then have an actual AU lawyer review before you sell Review #1 to a stranger (friendlies-only until reviewed).

### Step 0.2 — Set the success metrics
- **Goal:** Decide what "working" looks like so you stop optimising for vibes.
- **Time:** 20 min.
- **Action:** Lock these targets:
  - Outbound: ≥8% reply rate, ≥1 booked call per 50 sends
  - Reviews: ≥30% conversion from booked discovery → paid Review
  - Brokers: ≥1 in 3 pilots → paid contract
  - Daily founder time: ≤2 hours (calls + decisions + Review QA), everything else is machine/VA
- **Done when:** Targets logged in `IMPLEMENTATION_PLAN.md` against the workstream.

---

## Phase 1 — Foundations (Week 1, ~12 hours)

### Step 1.1 — Stand up n8n
- **Goal:** Self-hosted n8n running on a cheap VPS, accessible at `n8n.<yourdomain>`, with HTTPS.
- **Time:** 1 hour.
- **Action:** Spin up a $6/mo Hetzner CX11 (or $5 DigitalOcean droplet), install n8n via Docker Compose, put Caddy in front for auto-HTTPS, set basic auth + a strong password.
- **Done when:** You can log into n8n and run a Hello World workflow.
- **Gotcha:** Self-host = you back it up. Set a nightly snapshot on the VPS.

### Step 1.2 — Set up Airtable CRM
- **Goal:** A single Airtable base ("Monitrax CRM") with the schema all later workflows will read/write.
- **Time:** 1 hour.
- **Action:** Create tables: `Leads` (Apollo source data), `Contacts` (deduped), `Companies` (brokerages), `Deals` (pipeline stages: New / Engaged / Call Booked / Pilot Verbal / Pilot Signed / Active / Lost), `Reviews` (paid review tracking: Booked / In Progress / Delivered / Refund), `Activities` (every touch logged). Get the Airtable API key.
- **Done when:** Schema exists, API key copied to n8n credentials.
- **Gotcha:** Don't over-engineer. Five columns per table > fifty. You can always add fields.

### Step 1.3 — Register + warm a separate sending domain
- **Goal:** A dedicated outbound domain (e.g. `try-monitrax.com` or `monitrax-pro.com`) — never use your primary `monitrax.com.au` for cold mail.
- **Time:** 30 min setup, then **2–3 weeks of warming** running in parallel with everything else.
- **Action:** Buy domain → set up DNS (MX, SPF, DKIM, DMARC) → connect to Instantly/Smartlead → enable auto-warmup at 5–10 sends/day ramping to 30–50/day over 2–3 weeks.
- **Done when:** Domain SPF/DKIM/DMARC validates green, warmup running, deliverability score climbing.
- **Gotcha:** Send ZERO cold mail from this domain during warmup. One cold blast pre-warmup torches the whole effort. Block out the 2–3 weeks on the calendar.

### Step 1.4 — Sign up for the core SaaS
- **Goal:** All accounts created, billing on a single card, credentials in n8n.
- **Time:** 1 hour.
- **Action:** Sign up for Apollo (Starter ~$49/mo), Instantly (Hypergrowth ~$97/mo) OR Smartlead (~$39/mo entry), Cal.com (free or $15/mo Pro), Loops (free tier), Stripe (already needed), Senja (free tier OK initially), Sentry (free tier), Plausible OR PostHog (PostHog has bigger free tier — recommend).
- **Done when:** All logged in, all credentials saved to n8n.
- **Gotcha:** ~$300–500/mo total. If a tool isn't being used by week 4, cancel it.

### Step 1.5 — Anthropic API + prompt library
- **Goal:** Claude API key in n8n + a starter library of cached system prompts.
- **Time:** 1 hour.
- **Action:** Anthropic Console → API key → save in n8n. Create `docs/marketing/gtm/PROMPTS/` with starter files: `outreach_personaliser.md`, `reply_classifier.md`, `review_report_writer.md`, `support_triage.md`, `daily_digest_summariser.md`. Each one ends with the standard cache-friendly structure (system prompt is the bulk, user input is the variable).
- **Done when:** You can call Claude from n8n and get a response.
- **Gotcha:** Use **Sonnet for volume** (personalisation, classification, support), **Opus only for the few high-stakes Reviews**. Use prompt caching aggressively — system prompts + report templates are static across thousands of calls; caching cuts costs ~10×.

### Step 1.6 — Build the Founder Daily Digest (the killer workflow)
- **Goal:** One email in your inbox each morning at 7am with: replies needing you, today's calls + briefs, pipeline changes, revenue yesterday, errors, support escalations, content awaiting approval.
- **Time:** 3 hours.
- **Action:** n8n cron @ 6:45am → parallel branches pull from (Airtable Activities, Stripe charges, Sentry errors, Cal.com today's bookings, Loops events, Instantly reply log) → Claude summarises into one prioritised brief → Gmail send to you.
- **Done when:** You receive a useful digest three mornings in a row without touching it.
- **Gotcha:** **Build this first** — it's what actually buys back your time. Everything else above is just data sources for this.

---

## Phase 2 — Outbound pipeline (Week 2, ~10 hours)

### Step 2.1 — Define the broker ICP
- **Goal:** A precise definition of who you're targeting so the lead list isn't garbage.
- **Time:** 30 min.
- **Action:** Lock the ICP:
  - **Role:** Mortgage broker / Brokerage principal / Director (NOT loan processors, NOT BDMs)
  - **Geography:** AU only, start with NSW + VIC + QLD metro
  - **Brokerage size:** 1–20 brokers (solo and small teams — bigger groups have procurement)
  - **Aggregator:** Connective, AFG, Loan Market, Mortgage Choice, Finsure (these are reachable; CBA-owned ones are harder)
  - **Tenure:** 3+ years (established book to nurture)
- **Done when:** ICP doc at `docs/marketing/gtm/BROKER_ICP.md`.

### Step 2.2 — Build the lead list
- **Goal:** ~1,000 enriched broker contacts in Airtable, ready for outreach.
- **Time:** 2 hours.
- **Action:** Apollo search → match ICP → export CSV → n8n imports → enrichment pass (LinkedIn URL, brokerage website, recent post topic) → dedupe → write to Airtable `Leads`.
- **Done when:** 1,000 rows in `Leads` with status `New`, all fields populated.
- **Gotcha:** Quality > quantity. 500 well-fitted brokers > 2,000 random ones. Garbage in = garbage out for the personalisation step.

### Step 2.3 — Write the outreach sequence
- **Goal:** A 4-email sequence that gets replies, not eye-rolls.
- **Time:** 2 hours.
- **Action:** Draft (Claude assists):
  - **Email 1 (Day 0):** Pattern-interrupt opener referencing their brokerage by name + the specific pain (client database going cold between deals). One question. No pitch.
  - **Email 2 (Day 3):** The wedge — *"What if your borrowers had an app that actually opened — branded to you — that told you the moment they were ready to refinance?"* One paragraph. Loom link.
  - **Email 3 (Day 7):** Social proof + concrete pilot offer (free 60-day pilot with N of their clients, no contract, you do the onboarding heavy-lifting).
  - **Email 4 (Day 12):** Breakup email — *"Should I close the file?"* Highest reply-rate email in B2B by far.
  - All emails ≤120 words, plaintext, one CTA, real unsubscribe in footer.
- **Done when:** Four emails reviewed, in Instantly as a sequence template.
- **Gotcha:** Don't write 5 emails. Don't add a P.S. with a second CTA. Don't use the word "synergy". Don't mention AI. Don't attach a deck.

### Step 2.4 — Build the personalisation workflow in n8n
- **Goal:** Every email-1 has a one-line personalised opener referencing something specific about the prospect — at scale.
- **Time:** 2 hours.
- **Action:** n8n flow: trigger from Airtable `Leads` (status=Ready) → Claude call (cached system prompt = "you are a B2B copywriter writing a 1-line opener for a mortgage broker..."; variables = their brokerage + recent post + aggregator) → write opener back to Airtable → push to Instantly campaign with mail-merge.
- **Done when:** Run 20 test leads, all 20 openers read as human-written and specific.
- **Gotcha:** If Claude outputs generic ("I noticed your brokerage helps clients with their financial journey") — your prompt is too vague. Force specificity: feed the prospect's actual recent LinkedIn post text into the prompt, demand the opener reference it concretely.

### Step 2.5 — Wire Instantly + reply routing
- **Goal:** Replies don't get lost — every positive intent reply lands in your daily digest with a draft response.
- **Time:** 1.5 hours.
- **Action:** Instantly webhook on reply → n8n → Claude classifier ("interested / not now / not relevant / objection / unsubscribe") → if interested → Claude drafts a reply (book a call) → write to Airtable + flag for digest. If unsubscribe → remove from sequence + suppress.
- **Done when:** Send yourself a fake reply from a burner email — it lands in tomorrow's digest with a draft response.
- **Gotcha:** Auto-send replies = bad idea (one mis-classification embarrasses you publicly). Always human-in-loop on outbound replies.

### Step 2.6 — Cal.com + call-prep flow
- **Goal:** Booked calls arrive with a one-page prep brief 1 hour before.
- **Time:** 1 hour.
- **Action:** Cal.com event hook → n8n → enrich attendee (brokerage size, LinkedIn, recent posts) → Claude generates one-page brief (who, brokerage, likely objections, suggested opening) → email to you 1h before + a confirmation + Loom demo link to them.
- **Done when:** Test booking produces a useful brief.
- **Gotcha:** Keep the brief ≤300 words. You're skimming it 5 minutes before the call, not studying it.

### Step 2.7 — Launch at 30/day
- **Goal:** Outbound is live and producing replies.
- **Time:** 30 min to flip the switch, then 5 min/day to review.
- **Action:** Confirm domain warmup is complete + deliverability is green → enable Instantly sequence → cap at 30 sends/day for the first week, ramp to 50/day in week 2 → review the digest each morning, approve/edit replies.
- **Done when:** First reply rate measured after 100 sends. Iterate subject + email-1 weekly until ≥8% reply rate.
- **Gotcha:** Don't add a second campaign while the first is being tuned. One variable at a time.

---

## Phase 3 — Financial Health Review service (Week 3, ~10 hours)

### Step 3.1 — Build the Review landing page
- **Goal:** A single page that sells the Review, takes payment, captures intake.
- **Time:** 2 hours.
- **Action:** New route on the Next.js app at `/review` — hero, what it is, what it isn't (factual + general info only — AFSL disclaimer prominent), what you get (the structured TRAIL-stage PDF + a 30-min walkthrough), price, Stripe payment link, FAQ.
- **Done when:** Page is live, mobile-clean, payment link works in test mode.
- **Gotcha:** Don't over-design. Stripe / Mercury / Linear-style restraint. The page is for a buyer making a $200–400 decision, not a $50k one.

### Step 3.2 — Stripe payment link
- **Goal:** A single Stripe payment link the landing page CTA points to.
- **Time:** 20 min.
- **Action:** Stripe → Payment Links → create "Financial Health Review — AU$X" → enable receipts + invoice → success URL = intake form. Webhook to n8n on `checkout.session.completed`.
- **Done when:** Test purchase fires the webhook + creates an Airtable `Reviews` row + sends the intake email.
- **Gotcha:** Start at $197 for the first 5 friendly Reviews to lower friction; raise to $297 / $397 as testimonials stack. Don't anchor too low.

### Step 3.3 — Intake flow + Monitrax provisioning
- **Goal:** Customer pays → automatically gets a Monitrax account + a checklist email.
- **Time:** 2 hours.
- **Action:** Stripe webhook → n8n → provision Monitrax account (admin API or invite link) → email with: login, the data-entry checklist (income, expenses by category, accounts, loans, properties, super, recent statements as CSV if available), an SLA ("your Review delivered within 7 business days of complete data").
- **Done when:** End-to-end test: pay → account created → email arrives within 5 min.
- **Gotcha:** Manual data entry is the bottleneck. The checklist must be ruthlessly clear or the VA spends hours chasing missing data.

### Step 3.4 — Review report template + Claude prompt
- **Goal:** A structured report template Claude reliably populates from the Monitrax snapshot.
- **Time:** 3 hours.
- **Action:** Create `docs/marketing/gtm/REVIEW_TEMPLATE.md` with the section structure:
  1. **Snapshot summary** — net worth, monthly cashflow, top 3 expense categories, debt total + weighted rate, emergency fund coverage in months
  2. **TRAIL stage** — current stage with the data-driven reason
  3. **Leaks** — top 3 cashflow drains, dollar amounts, *factual* observations
  4. **Safety net gap** — months of expenses currently covered vs target
  5. **Debt order** — payoff order by interest rate (avalanche) with the *generic* trade-off note on snowball
  6. **Next 3 actions** — concrete, general (e.g. "consolidate high-interest debt", not "refinance with Bank X")
  7. **Disclaimer** — bottom of every page
- Build the Claude prompt that takes a Monitrax snapshot JSON as input and produces the populated report as Markdown.
- **Done when:** Run the prompt against your own Monitrax account → output reads like a real adviser wrote it.
- **Gotcha:** This is the one place to use **Opus, not Sonnet** — the report is the product. Don't cheap out.

### Step 3.5 — PDF rendering
- **Goal:** The Markdown report becomes a branded PDF the customer receives.
- **Time:** 1.5 hours.
- **Action:** n8n → Markdown → HTML (with brand CSS) → Puppeteer/PDFShift to PDF → upload to GCS → signed URL → attach to delivery email.
- **Done when:** A test report renders to a PDF that looks premium (Apple/Stripe restraint), not Word-template.
- **Gotcha:** Spend the time on typography + spacing. The PDF *is* the brand impression. Soft serif headings, generous whitespace, one accent colour.

### Step 3.6 — QA + delivery + testimonial trigger
- **Goal:** Every Review goes through your 15-min QA before delivery; testimonial requested 7 days after.
- **Time:** 1 hour to build.
- **Action:** n8n flow: report generated → Slack/Telegram ping you with PDF link + "approve/edit" → on approve → email customer with PDF + book walkthrough link → 7 days later → Senja auto-request testimonial → also tag customer as `subscription_warm_lead` in Loops.
- **Done when:** End-to-end Review test passes from intake → QA → delivery in <24h.
- **Gotcha:** Don't skip QA. The 15 min you spend stops a single embarrassing factual error that costs you 10× more in trust damage.

### Step 3.7 — Hire the VA
- **Goal:** A part-time VA handles data-entry sanity checks, CRM hygiene, inbox triage of non-escalations, scheduling.
- **Time:** 1 week elapsed (post job + interviews) but ~2 hours of your time.
- **Action:** Post on OnlineJobs.ph or similar → AU-business-hours availability preferred → screen for English written quality + attention to detail → trial week at ~$5–8/hr, 10–15 hrs/week to start.
- **Done when:** VA is doing the Review data sanity-check pass and the CRM hygiene weekly job.
- **Gotcha:** Write the SOPs (one-pager per task) BEFORE the VA starts. "Use your judgement" doesn't work; "tick these 7 boxes" does.

---

## Phase 4 — Broker onboarding (Weeks 4–5, ~15 hours)

### Step 4.1 — Broker landing page
- **Goal:** A dedicated page at `/for-brokers` selling the wedge.
- **Time:** 2 hours.
- **Action:** Hero ("Keep your client database warm. Know when they're ready to refinance. Branded to you."), 3-point value prop (engagement, refinance triggers, retention), the pilot offer (60 days, no contract, you handle onboarding), a "book a 20-min call" CTA → Cal.com.
- **Done when:** Live. Tested on mobile. Loom demo embedded.
- **Gotcha:** Don't put pricing on the page yet — the pilot is the offer. Pricing conversation happens after the pilot proves value.

### Step 4.2 — Co-branded referral link (minimal viable)
- **Goal:** Each broker pilot gets a unique signup URL that tags their clients to them — without standing up full multi-tenancy.
- **Time:** 4 hours.
- **Action:** Add a `?broker=<slug>` query param to the signup flow. On signup, persist `referringBrokerId` on the User. Add a simple `BrokerProfile` table (name, slug, logo URL, primary colour). On the public signup page, if `?broker=<slug>` is present, swap the logo + primary colour + show a "Brought to you by [Broker Name]" line. That's the v1 white-label.
- **Done when:** Test signup via `?broker=test` shows the test branding + persists the relationship.
- **Gotcha:** Resist the urge to build a full broker portal in v1. The pilot brokers just need: their link works, their clients see their brand, they get notified when triggers fire.

### Step 4.3 — Pilot agreement template
- **Goal:** A 1-page agreement brokers can sign in 60 seconds.
- **Time:** 1 hour + lawyer review.
- **Action:** Draft a simple Pilot Agreement: 60 days free, broker provides clients, Monitrax provides product + onboarding support, both parties can exit any time, IP / data ownership clarified, no charges during pilot. Put it in Documenso (OSS e-sign) → e-signature link generates per broker.
- **Done when:** Template exists, lawyer-reviewed, in Documenso.
- **Gotcha:** Free pilots without an agreement = scope creep + unclear data ownership. Even a 1-pager is enough; don't ship a 20-page MSA.

### Step 4.4 — Refinance-trigger engine (spec; build later)
- **Goal:** Define the trigger logic that detects when a broker's client is refinance-ready, then notifies the broker.
- **Time:** 2 hours to spec; ~5 days to build (product work, queued).
- **Action:** Create `docs/blueprint/PHASE_GTM_REFINANCE_TRIGGER.md` spec:
  - **Triggers (any one fires):** LVR crossed 80% / 70% / 60% bands; fixed-rate roll-off within 90 days; usable equity > $50k; rate vs current-market gap > X bps; repayment-stress flag.
  - **Daily cron** evaluates every broker-linked user → on trigger → upsert `RefinanceTrigger` row → emit notification email to broker (with context + suggested next-step copy) → optional in-app notification to user in broker's branding.
  - **Idempotent** — same trigger doesn't fire twice in the same band-cross.
- **Done when:** Spec doc exists, scoped, queued in `IMPLEMENTATION_PLAN.md`.
- **Gotcha:** Don't build this before you have 1+ signed broker pilot. Build to a real broker's data, not a hypothetical one.

### Step 4.5 — Monthly broker value report
- **Goal:** Each broker gets an automatic monthly email summarising what value they got — the renewal conversation, pre-written.
- **Time:** 2 hours.
- **Action:** n8n monthly cron → for each active broker → pull (clients onboarded that month, total active clients, triggers fired, actions taken) → Claude writes a 200-word "here's your month" email → send.
- **Done when:** Test email reads like "money well spent" not "system noise".
- **Gotcha:** Make the numbers concrete. *"3 of your clients are now in the refinance window"* > *"Engagement is up 12%."*

---

## Phase 5 — Basiq decision gate (trigger-based, ~Month 3–4)

### Step 5.1 — The go/no-go check
- **Goal:** Decide whether to pull the Basiq trigger.
- **Time:** 1 hour decision.
- **Action:** Check the two gates:
  - **Gate A:** Committed broker MRR ≥ AU$3–5k.
  - **Gate B:** Cash on hand ≥ AU$15k (covers the $10k initial + 2 months of $2k buffer + ops).
- **Done when:** Decision recorded in `IMPLEMENTATION_PLAN.md` Open Questions with date + rationale.
- **Gotcha:** If both gates are met but you're not ready operationally (no consumer landing flow, no support capacity), defer the trigger. The accreditation lead time is fine to start; the post-accreditation product work is the real bottleneck.

### Step 5.2 — Basiq onboarding kickoff
- **Goal:** Kick off the 1-month Basiq accreditation process.
- **Time:** 1 hour to kick off, ~30 days elapsed.
- **Action:** Contract execution → security questionnaire → integration sandbox → production approval. Run in parallel with consumer-flow product work.
- **Done when:** Basiq production credentials live in Secret Manager + the `withPermission('cdr_data.read')` routes go from sandbox to live.
- **Gotcha:** Every CDR rule from CLAUDE.md Part 13 applies the moment you go live. Re-read §13 the day before the switch.

---

## Phase 6 — Consumer scale (post-Basiq, ~Month 6+)

Brief notes — full plan to be written when Phase 5 triggers.

- **Activation:** Free tier with auto bank feeds + the "see your full picture in 60 seconds" first win.
- **Acquisition:** SEO content engine (Claude-drafted, monthly batch approval), one creator partnership (Equity Mates / Aussie FIRE / Glen James orbit), founding-member annual pricing for the waitlist (~$79/yr first cohort, then $9/mo).
- **Retention:** Lifecycle loops F1–F4 from the automation stack (already built by then).
- **Affiliate:** AU finance affiliate stack (Up Bank, brokers via your own pilots, ETF providers) — every active user has affiliate revenue potential.

When Phase 5 closes, ask Claude to flesh this section into a Phase 6 plan with the same step-by-step structure.

---

## Open questions to resolve before Phase 2 launch

| # | Question | Owner | Decision needed by |
|---|---|---|---|
| Q-GTM-1 | Review price for first 5 friendlies — $197 / $247 / $297? | Reza | Before Step 3.2 |
| Q-GTM-2 | Outbound sending domain name? | Reza | Before Step 1.3 |
| Q-GTM-3 | First aggregator to focus on (Connective / AFG / Loan Market)? | Reza | Before Step 2.2 |
| Q-GTM-4 | VA: hire now (parallel with Phase 2) or wait until first Review sells? | Reza | Before Step 3.7 |
| Q-GTM-5 | AFSL boundary — DIY scope doc + lawyer review, or engage an AFSL holder for the Review service from day one? | Reza | Before Step 3.1 |

---

## Tools + monthly cost summary

| Tool | Purpose | Monthly cost (approx, AUD) |
|---|---|---|
| Hetzner/DO VPS | n8n hosting | ~$10 |
| n8n | Orchestration | $0 (self-hosted) |
| Anthropic API | Claude (Sonnet bulk + Opus Reviews) | ~$50–150 usage-based |
| Apollo.io | Lead data | ~$75 |
| Instantly or Smartlead | Cold outbound + warmup | ~$60–150 |
| Airtable | CRM | $0 (free tier sufficient initially) |
| Cal.com | Booking | $0–25 |
| Loops | Lifecycle email | $0–50 |
| Stripe | Payments | Per-transaction only |
| PostHog | Product + web analytics | $0 (free tier huge) |
| Sentry | Error tracking | $0 (free tier) |
| Senja | Testimonials | $0 (free tier) |
| Documenso | E-signature | $0 (self-host) or ~$15 |
| Loom | Async demos | $0–15 |
| Typefully | Social scheduling | $0–15 |
| Domain (outbound) | Separate sending domain | ~$2 |
| VA | ~10–15 hrs/week @ $5–8/hr | ~$300–500 |
| **Total pre-Basiq** | | **~$800–1,200/mo** |
| Basiq (when triggered) | $10k initial + $2k/mo | +$2,000/mo |
| **Total post-Basiq** | | **~$2,800–3,200/mo** |

---

## How to ask me to execute a step

When you want to run a step, just say one of:

- *"Execute step X.Y from the GTM plan"* — I'll produce the artefacts (n8n workflow JSON, copy, prompts, schema, code) and walk you through.
- *"What do I do today for GTM?"* — I'll check the workstream status and tell you the next 1–3 actions.
- *"Mark step X.Y done"* — I'll update `IMPLEMENTATION_PLAN.md` and the checkboxes here, and surface the next step.
- *"Block step X.Y on [reason]"* — I'll move it to Blocked and unblock the parallel work.
- *"Re-plan from week N"* — if reality diverged from the plan, I'll re-shape it without losing what's done.

I'll never silently change the plan. Every change comes back to you as a one-line summary before it's written.

---

## Status tracker (update as steps complete)

### Phase 0
- [ ] 0.1 AFSL boundary doc
- [ ] 0.2 Success metrics locked

### Phase 1
- [ ] 1.1 n8n live
- [ ] 1.2 Airtable CRM
- [ ] 1.3 Sending domain warming
- [ ] 1.4 SaaS accounts
- [ ] 1.5 Claude prompts library
- [ ] 1.6 Founder Daily Digest

### Phase 2
- [ ] 2.1 Broker ICP
- [ ] 2.2 Lead list (1,000)
- [ ] 2.3 Outreach sequence
- [ ] 2.4 Personalisation workflow
- [ ] 2.5 Reply routing
- [ ] 2.6 Call-prep flow
- [ ] 2.7 Launched at 30/day

### Phase 3
- [ ] 3.1 Review landing page
- [ ] 3.2 Stripe payment link
- [ ] 3.3 Intake + provisioning
- [ ] 3.4 Report template + prompt
- [ ] 3.5 PDF rendering
- [ ] 3.6 QA + delivery + testimonial
- [ ] 3.7 VA hired

### Phase 4
- [ ] 4.1 Broker landing page
- [ ] 4.2 Co-branded referral link
- [ ] 4.3 Pilot agreement
- [ ] 4.4 Refinance-trigger spec
- [ ] 4.5 Monthly broker report

### Phase 5
- [ ] 5.1 Basiq go/no-go decision
- [ ] 5.2 Basiq onboarding kicked off

### Phase 6
- [ ] To be written when Phase 5 closes

---

*This document is a living plan. Update it as reality changes. Don't optimise the plan — optimise the outcome.*
