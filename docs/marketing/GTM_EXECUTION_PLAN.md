# Monitrax GTM Execution Plan

> **A step-by-step playbook to take Monitrax from pre-launch to first paying customers via a B2B-led go-to-market.**
> Each step is small, self-contained, and has a clear "done" definition. Come back and say *"guide me through step 2.3"* and I (Claude) will walk you through it.

**Owner:** Reza
**Last updated:** 2026-06-10
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

### Step 0.1 — Lock the AFSL boundary — 🟡 DRAFT SHIPPED 2026-05-15 (awaiting AU fintech-lawyer review)
- **Goal:** Decide, in writing, exactly what the Financial Health Review will and will not say. Stay on the *factual / general-information* side of the ASIC line. No personal recommendations.
- **Time:** 30 min target — Claude draft produced ~45 min including ASIC RG / Corporations Act §766B research.
- **What was done (2026-05-15):**
  - Document drafted at **`docs/marketing/gtm/REVIEW_SCOPE_AND_BOUNDARIES.md`** — 11 sections, ~400 lines of opinionated operational guidance
  - Covers: (1) the legal premise in one paragraph (general advice vs personal advice, the "reasonable person" test); (2) what the Review CAN say (facts, benchmarks, gap identification, TRAIL stage observation, generic class-level info, "speak to a licensed adviser" pointers); (3) what the Review CANNOT say (specific product recommendations, personal investment / tax / insurance / property / debt / estate advice, predictive product-performance claims); (4) DO say / DON'T say cheat-sheet across 9 financial topics; (5) the exact verbatim disclaimer blocks for top + bottom of every Review + the customer acknowledgment for the intake form; (6) operator pre-delivery checklist (Reza or VA); (7) escalation guidance ("if in doubt, leave it out"); (8) what changes once the AFSL-partner upsell goes live (nothing in this doc; the partnership is a separate downstream service); (9) primary-source references (Corporations Act §766B, ASIC RG 244 / RG 175 / RG 36, MoneySmart, TPB, Barefoot Investor as a tone model); (10) status / ownership / review cadence; (11) explicit "this document is NOT legal advice" disclaimer about itself.
  - The doc is referenced by Step 3.3 (intake form acknowledgment), Step 3.4 (Claude-drafted report system prompt guard-rails), and Step 3.6 (QA + deliver checklist) — those steps inherit this boundary discipline rather than re-defining it.
- **Validity matrix:**
  - ✅ **Reviews #1–5 to friendlies who sign the §5.3 acknowledgment** — OK to ship against this draft. Friendlies understand the friend-rate / draft-policy context.
  - 🚫 **Reviews to non-friendly strangers** — NOT VALID until AU fintech-lawyer review completes. Q-GTM-5 must close (DIY draft + paid lawyer review) before Review #6 to a stranger.
- **Lawyer review action item (Reza-side, ~AU$2–5k one-off):**
  - Candidates to research: Sophie Grace (fintech specialist), Holding Redlich, Gilbert + Tobin's fintech team
  - Brief them on: (a) review this document; (b) review one sample Review (draft against this template, with fake-but-realistic data); (c) sign off on the disclaimer wording; (d) recommend any structural changes
  - Budget the ~AU$500–1k/yr re-review cadence into `GTM_TOOL_STACK.md`'s "external advisors" line when scheduled
- **Done when:** ✅ Document exists at `docs/marketing/gtm/REVIEW_SCOPE_AND_BOUNDARIES.md` (DONE); Reza has read it twice (Reza-side — recommended before delivering any friendly Review); lawyer review completed (NOT YET DONE — blocks Reviews to strangers).
- **Gotcha:** If in doubt, leave it out. ASIC enforcement on unlicensed personal advice is active — one complaint is a business-ending event. The draft has been written conservative-side-of-the-line; the lawyer's job is to confirm or tighten, not to loosen. **Do NOT loosen language based on what other personal-finance brands appear to be getting away with — many of them are operating in technical breach and haven't been caught yet.**

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

### Step 1.1 — Stand up n8n ✅ DONE (2026-05-13)
- **Goal:** Self-hosted n8n running on a Hetzner VPS, accessible at `https://n8n.monitrax.com.au`, with HTTPS auto-provisioned by Caddy. Docker Compose stack: n8n + Postgres (n8n's own data) + Caddy. `unattended-upgrades` enabled for security patches. Hetzner-managed daily backups on. **ACHIEVED.**
- **What was done (2026-05-13):**
  - [x] **Part A — VPS provisioned:** Hetzner Cloud server `n8n-1` in `monitrax-ops` project. **CPX22** (3 vCPU / 4 GB / 80 GB SSD / 20 TB / AMD x86), Nuremberg eu-central, Ubuntu 24.04. SSH key `reza-macbook` (ed25519, default for project). Backups on. Public IPv4 + IPv6.
  - [x] **Part B — DNS:** A record at GoDaddy → `n8n.monitrax.com.au` → server IPv4 (1h TTL). On the main brand domain, not on `try-monitrax.com` — see migration note below.
  - [x] **Part C — Install + harden:** SSH'd in, ran the install block: Docker + Compose plugin installed, `/opt/n8n` directory created, `docker-compose.yml` written (n8n + Postgres + Caddy services), `Caddyfile` written, `.env` written with 32-byte n8n encryption key + 24-byte Postgres password, stack brought up, UFW firewall (allow 22/80/443 only), `unattended-upgrades` enabled, fail2ban running, SSH hardened (PasswordAuthentication no, PermitRootLogin prohibit-password). Postgres healthy, n8n + Caddy running.
  - [x] **Owner account:** created at the n8n UI; password stored in Reza's password manager. Free-license-key email registered to `admin@monitrax.com.au` (unlocks Folders, Execution search/tagging, Advanced debugging — paste the key in Settings → Usage when it arrives).
  - [x] **URL migration: `n8n.try-monitrax.com` → `n8n.monitrax.com.au`** (mid-session correction). Reason: Chrome Safe Browsing flagged the `try-monitrax.com` subdomain ("Dangerous site" — new-domain heuristic). Architectural correction: `try-monitrax.com` is the **email-only** domain (cold-outbound sending via Smartlead), `monitrax.com.au` is the brand + tools domain. n8n is an internal tool, belongs on the brand domain. `sed` swap of Caddyfile + docker-compose hostname references + container restart; Caddy auto-fetched fresh Let's Encrypt cert. Cold-email setup on `try-monitrax.com` untouched.
- **Done when:** ✅ `https://n8n.monitrax.com.au` loads cleanly (TLS green, no Chrome warning), owner account works, all 3 containers Up.
- **Gotcha:** raw VPS IP intentionally NOT in repo — DNS hostname is the canonical reference. SSH key-only access (no password login). CDR posture confirmed: n8n is GTM-ops only — never pulls CDR data, so the German server location is compliant (CLAUDE.md §13.6 boundary preserved). The VPS will also host Documenso (Step 4.3) and any other small GTM services later — 4 GB RAM + 80 GB SSD has headroom for that.

### Step 1.2 — Set up Airtable CRM ✅ DONE (2026-05-15)
- **Goal:** A single Airtable base ("Monitrax CRM") with the schema all later workflows will read/write.
- **Time:** 1 hour target — actual ~1 hour including PAT setup + n8n credential + Chat-Claude wiring of the digest's Activities branch.
- **What was done (2026-05-15):**
  - **Airtable account** created on Free plan, workspace `Monitrax`, owner `admin@monitrax.com.au`
  - **Base** `Monitrax CRM` at `airtable.com/appEDHNU0mtbWznHp`
  - **7 tables** built per spec (one extra beyond spec — see note below):
    - `Leads` — raw imports (Apollo / manual), unverified humans
    - `Contacts` — verified humans, promoted from Leads
    - `Companies` — generic company table
    - `Brokerages & Employer Orgs` — extra table added beyond v1 spec (intent: separate B2B targets from D2C employer orgs; non-blocking — both tables coexist, Leads' Company field links to `Companies`)
    - `Deals` — pipeline (Kanban-ready, 8 stages: New → Engaged → Call Booked → Pilot Verbal → Pilot Signed → Active → Won → Lost)
    - `Reviews` — paid Financial Health Reviews (default price AU$197 per Q-GTM-1)
    - `Activities` — every touch logged (the table the digest queries)
  - **Linked records:** Leads → Companies, Contacts → Companies, Deals → Companies + Contacts, Reviews → Contacts, Activities → Contacts + Companies + Deals. All single-link except Activities (multi-link allowed for meeting-style entries with several attendees).
  - **Default views:** custom view `🆕 New — needs enrichment` on Leads (filter: Status = New); Grid views on other tables. Activities "Last 24h" view is what the digest queries via filter formula.
  - **Personal Access Token** `n8n-monitrax-crm` created at `airtable.com/create/tokens`, scoped to `data.records:read` + `data.records:write` + `schema.bases:read`, restricted to the `Monitrax CRM` base only (least-privilege).
  - **n8n credential** `Airtable - Monitrax CRM` (type: Airtable Personal Access Token API) wired into n8n.
  - **Digest workflow updated (via Chat-Claude / n8n MCP):**
    - `[STUB] Airtable Activities` HTTP node replaced with real Airtable node `Airtable - Activities last 24h`
    - Operation: Search records; filter formula `IS_AFTER({Created}, DATEADD(NOW(), -1, 'days'))`; returns all matching records
    - Connected: Schedule Trigger → Airtable node → Sync Active Sources (Merge); Merge `numberInputs` bumped 2 → 3
    - `Compose Digest Context` extended with `airtable_activities_json` field (stringified, projected to `{name, type, direction, source, body_preview, created}`)
    - Claude system prompt extended with a new 6th section **CRM ACTIVITY** placed between WORKFLOW HEALTH and AWAITING DATA — groups by Direction (Inbound first), orders by Created desc, caps at 8 items with "+N more in CRM" overflow, skips pure Status Change entries unless they advance a deal stage. "Airtable Activities (Step 1.2 - CRM)" removed from the AWAITING DATA pending-sources list.
  - **End-to-end test execution successful** — Sonnet 4.6, 1,232 input / 411 output tokens (~AU$0.005), email landed in `admin@monitrax.com.au`. CRM ACTIVITY section correctly rendered "No CRM activity in the last 24h" — the one real Activity record present was a pure Status Change, correctly filtered by the prompt rule. Empty-state path works.
- **Done when:** ✅ Schema exists, PAT in n8n credentials, digest reads real Activities and renders the CRM ACTIVITY section. ALL MET.
- **Out of scope (for later):**
  - Populate Activities with real records — currently only contains 1 test entry. Will fill organically once Smartlead replies wire (Step 1.6 stub) + Stripe webhook wire + manual operator entries
  - Reconcile `Companies` vs `Brokerages & Employer Orgs` — one is empty as of now; decision deferred until first real broker contact is logged (then the right choice becomes obvious)
  - Field-level filtering on the digest Airtable query (currently pulls all fields then projects in Compose Context — wasteful at scale but invisible at single-digit records/day; revisit at 100+ records/day)
- **Gotcha (the ones we hit):**
  - **Airtable renamed "bases" to "apps"** in the UI — same concept, new word. Use **"Build an app on your own"** to create a new blank base.
  - **Default Linked Record allows multiple records.** For most join fields (Leads.Company, Contacts.Company, Deals.Company, Reviews.Contact) you want SINGLE link — flip the "Allow linking to multiple records" toggle OFF. Multi-link only makes sense for `Activities.Contact` (a meeting touches multiple attendees).
  - **Personal Access Tokens replaced API keys** in Airtable. Old API-key URLs throw 404. Use `airtable.com/create/tokens`. Scope to ONE base, never "all current and future bases".
  - **Airtable-side AI augmentation fields** (`Summary (AI)`, `Next Suggested Action (AI)`, `Sentiment (AI)`) shouldn't be added to Activities until there's real Body content flowing in — they throw `emptyDependency` errors when their dependency field is empty. Removed in this session.
- **Don't over-engineer.** Five columns per table > fifty. You can always add fields. (The 7th table — `Brokerages & Employer Orgs` — already strains the spec; if it doesn't fill with real records in the next 30 days, merge it back into `Companies` using the Industry field to distinguish.)

### Step 1.3 — Set up the separate sending domain + mailbox ✅ DONE (2026-05-12) — warmup running, 2–3 wk timer ticking
- **Decision (Q-GTM-2, Reza 2026-05-11/12):** dedicated outbound domain **`try-monitrax.com`** (purchased on GoDaddy 2026-05-12, "Keep Separate" from main domain). Mailbox = **Google Workspace Business Starter** on that domain → `reza@try-monitrax.com` (real-name sender). **Smartlead** ($39/mo) does the sequencing + warmup, connecting the Workspace mailbox via OAuth — it does NOT provide the mailbox. (Smartlead's own "Fresh/Pre-Warmed Mailboxes" DFY flow was rejected — it registers a *new Smartlead-owned domain* and sells mailboxes in 10/20/50/100 packs; wrong tool when we already own `try-monitrax.com`. See `GTM_TOOL_STACK.md` Decision Log 2026-05-12.) Never use `monitrax.com.au` for the automated sequences.
- **Goal:** Domain registered, Google Workspace mailbox live with MX/SPF/DKIM/DMARC all green, mailbox connected to Smartlead, warmup running. ✅ ALL DONE.
- **What was done (2026-05-12):**
  1. ✅ GoDaddy: `try-monitrax.com` purchased; "Keep Separate" chosen (clean DNS zone).
  2. ✅ Google Workspace: Business Starter (14-day trial), domain `try-monitrax.com`, user `reza@try-monitrax.com` ("Reza Sadegh").
  3. ✅ Domain verified via GoDaddy auto-connect (`google-site-verification` TXT).
  4. ✅ Gmail activated — MX → Google added automatically via GoDaddy. (Gmail routing may take up to 24h to fully flip.)
  5. ✅ "Authenticate outgoing emails" (DKIM) — `google._domainkey` TXT added. GoDaddy also auto-added SPF (`v=spf1 include:dc-aa8e722993._spfm.try-monitrax.com ~all` on `@`, chaining to `_spf.google.com`) + DMARC (`v=DMARC1; p=quarantine; …` on `_dmarc`). DNS audited 2026-05-12 — correct. (Optional, not done: change DMARC `rua` to `reza@monitrax.com.au` to receive the reports.)
  6. ✅ Smartlead → Email Accounts → "Connect Your Email Account" → Connect Mailbox → Google → OAuth `reza@try-monitrax.com` → "connected successfully".
  7. ✅ Smartlead Warm Up tab: Total warm-up emails/day = **30**, Daily Rampup ON (+1/day → climbs from ~2 to 30 over ~4 wks), Randomise 3–30, Reply Rate 35%, Daily Target for Replies to Inbound = 30. **Warmup ENABLED.** (Optional, not yet done: set Custom Warmup Identifier Tag + a Gmail filter to keep the inbox clean.)
  8. ⏳ **In progress now: the 2–3 week passive warm.** Send ZERO real cold mail from this mailbox until warm completes. Check the Warm Up tab weekly — deliverability score should climb toward 90%+.
- **Done when:** warmup running ✅ — fully "done" once the 2–3 weeks elapse and the score is healthy (≈ first week of June 2026).
- **Gotcha:** Send ZERO cold mail during warmup — one cold blast pre-warmup torches it. Don't create campaigns yet. Don't touch `monitrax.com.au` DNS.

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

### Step 1.6 — Build the Founder Daily Digest (the killer workflow) — 🟢 LIVE (2026-05-14), cron active, first execution successful
- **Goal:** One email in `admin@monitrax.com.au` inbox each morning at 7am Sydney with: replies needing Reza, workflow health, awaiting-data placeholders, top-3 actions for today, one pattern observed. Grows into the fuller brief (pipeline, revenue, errors, bookings, support) as data sources come online.
- **Time:** ~3 hours target — actual ~4 hours including OAuth setup friction.
- **What was built (2026-05-14):**
  - **Workflow:** `Founder Daily Digest v1` at `https://n8n.monitrax.com.au/workflow/jQWmSbqEvY3vkAy2` — 18 nodes. Built via the Anthropic n8n connector (Claude Desktop Chat mode, MCP).
  - **Architecture:**
    - **Cron trigger:** Daily @ 06:45 Sydney TZ (workflow timezone explicitly set to `Australia/Sydney` — critical, otherwise fires at 06:45 UTC = 16:45 Sydney).
    - **Two active data branches** running in parallel: (a) Gmail Unread on `reza@try-monitrax.com` (the Smartlead warmup mailbox) with a Gmail-side noise filter `is:unread newer_than:1d -category:promotions -category:social -category:updates -from:noreply -from:no-reply -from:notifications` and `simple: true` (metadata only — from/subject/date/labels, no body); (b) HTTP GET against n8n's own `/api/v1/executions?status=error&limit=50` for self-monitoring.
    - **Merge:** `append` mode, 2 inputs — synchronisation barrier before Compose Context.
    - **Compose Digest Context:** Set node, `executeOnce: true`, stringifies upstream node outputs into one prompt-friendly context object (`today`, `inbox_replies_json`, `n8n_errors_json`, `pending_sources`).
    - **Claude summariser:** Anthropic node, **`claude-sonnet-4-6`** (downgraded from Opus 4.7 — Sonnet is the right tool for daily structured summarisation; Opus is overkill and ~5× cost), `temperature: 0.4`, `maxTokens: 1500`, plain-text output. System prompt enforces a 5-section structure (INBOX REPLIES NEEDING REZA / WORKFLOW HEALTH / AWAITING DATA / TOP 3 ACTIONS TODAY / ONE PATTERN), warm-words rule, "no AI tics, no motivational-poster mode", explicit "(fallback - low inbox signal)" tag when inbox is thin. Editable in-place on the Claude node — no code round-trip.
    - **Extract Digest Body:** Set node with defensive fallback chain (`$json.response || $json.content?.[0]?.text || $json.text || $json.message || JSON.stringify($json)`) — handles Anthropic node version variance.
    - **Gmail Send:** to `admin@monitrax.com.au`, from `admin@monitrax.com.au` (self-send), subject `Monitrax Daily - {{ Sydney-formatted date }}`, plain text. **Recipient change 2026-05-14:** initial plan was `reza@monitrax.com.au` but that mailbox doesn't exist in the Workspace (`admin@` is the only one); send-to-self is the simplest fix.
    - **Five disabled stub branches** for future data sources, each tagged `[STUB]` with sticky-note wiring instructions: Airtable Activities, Stripe Charges, Sentry Issues, Cal.com Today Bookings, Smartlead Replies (NOT Instantly — Smartlead won Q-GTM-2).
  - **Credentials wired in n8n (4 total):**
    - `Gmail - try-monitrax mailbox (read)` — Gmail OAuth2, authorised as `reza@try-monitrax.com`
    - `Gmail - monitrax.com.au (send)` — Gmail OAuth2, authorised as `admin@monitrax.com.au` (name retained from original SDK code even though account is `admin@`, to avoid SDK-rebuild)
    - `Anthropic API - Monitrax` — Anthropic API, key from `console.anthropic.com` (existing `reza-onboarding-api-key`, ~AU$7.50 credit on hand)
    - `n8n API - X-N8N-API-KEY header` — Header Auth, header `X-N8N-API-KEY`, value = n8n internal API key (`digest-self-monitor`, rotated 2026-05-14 after the key was exposed in a chat paste during the "Code session takeover" attempt — see Gotcha below)
  - **Google Cloud OAuth client** for the Gmail credentials: project `monitrax-479700`, OAuth client `n8n - Monitrax Gmail OAuth`, type Web application, redirect URI `https://n8n.monitrax.com.au/rest/oauth2-credential/callback`, JavaScript origins empty. OAuth consent screen: External, app name `Monitrax`, publishing status **Testing**, test users `admin@monitrax.com.au` + `reza@try-monitrax.com`. Single OAuth client serves both Gmail credentials.
  - **Prompt sign-off:** preview output reviewed via Opus 4.7 simulation (Chat-Claude couldn't call the real Sonnet endpoint mid-session — no API key in its environment); the prompt design — 5-section structure, fallback tag, "ONE PATTERN under 20 words" constraint — judged shipping-ready as-is. Iterate from real production output, not synthetic.
- **Operational runbook:** `docs/operational/runbooks/09_GTM_FOUNDER_DAILY_DIGEST.md` — covers daily checks, credential rotation, adding a new data source, common failure modes, the Reza-side knobs (activate/pause cron, edit prompt, change recipient).
- **Activation milestones (2026-05-14, evening):**
  - ✅ First real `execute_workflow` run landed in `admin@monitrax.com.au` Sent folder (Gmail's default self-send behaviour — hidden from Inbox by default). Body checked through the four lenses; quality judged shipping-ready. Two minor prompt-improvement candidates noted for later: (a) self-referential workflow ID — Claude told Reza to "fix the failing workflow" not knowing that workflow IS the digest itself; (b) UTC→Sydney timezone interpretation in ONE PATTERN. Both deferred — iterate from real production output, not pre-tuning.
  - ✅ **Cron PUBLISHED 2026-05-14** via the n8n "Publish" button (n8n 2.20.x calls activation "Publish"; same thing as the older "Activate" toggle). First scheduled run: 06:45 Sydney 2026-05-15.
  - ⏳ **Three useful digests received without touching it** (the original "Done when" criterion) — measure from morning of 2026-05-15 onward.
  - **Reza-side knob:** Gmail filter set up at `admin@monitrax.com.au` to surface self-sent `Monitrax Daily` emails into Primary inbox + star them (Gmail otherwise hides self-sends from Inbox).
  - **Operational hygiene from the n8n Production Checklist popup:**
    - ✅ MCP access enabled
    - ✅ Error notifications configured — workflow-failure emails go to `admin@monitrax.com.au` (so a 6:45am cron failure surfaces within minutes instead of being noticed days later)
    - Skipped: "Track time saved" (vanity metric, no operational value)
- **Out of scope (deferred, tracked in stickies on the n8n canvas):**
  - Wire Airtable Activities (blocked on Step 1.2 — CRM build)
  - Wire Stripe Charges (blocked on first payment infra going live)
  - Wire Sentry Issues (blocked on adopting Sentry; GCP Error Reporting is the existing fallback per CLAUDE.md §12.7)
  - Wire Cal.com Bookings (blocked on Step 2.6)
  - Wire Smartlead Replies (blocked on Smartlead webhook setup; original SDK code references "Instantly" — adjust accordingly)
  - Switch Gmail node `simple: false` + include email snippets in the prompt (only do this if subject-only signal proves insufficient after a week of production runs)
- **Gotchas (the painful ones we hit):**
  - **n8n auto-assigns credentials by type, not name.** When two Gmail OAuth2 credentials exist, n8n grabs the first one created for both nodes — meaning the Send node initially pointed at the *read* mailbox. Fix: manually pick the right credential on each node's dropdown, then save. Easy to miss; check both Gmail nodes for absence of the red "!" warning before activating.
  - **Self-hosted n8n Gmail OAuth needs your own Google Cloud OAuth client** (Client ID + Secret). n8n Cloud has a shared one; self-hosted doesn't. ~15 min extra setup the first time — `console.cloud.google.com` → enable Gmail API → Credentials → OAuth client ID → Web application → paste n8n's redirect URI → copy ID + Secret into n8n.
  - **OAuth consent screen test users.** With the app in Testing mode, **only emails in the Test users list can authorise**. Most common silent OAuth failure: forgot to add the second mailbox as a test user. Add both before authorising either credential.
  - **Workflow timezone is not the instance timezone.** Set it explicitly via Workflow Settings → Timezone → `Australia/Sydney`. Cron uses workflow TZ. Forgetting this = digest fires at 4:45pm Sydney every day instead of 6:45am.
  - **Don't activate the cron straight after `validate + create`.** Activate ONLY after the first real `execute_workflow` produces an email you'd be happy receiving tomorrow at 7am. The temptation to flip the toggle "while you're in there" is real and costly.
  - **n8n API keys are sensitive.** A key with full-instance scope was exposed in a chat paste during 2026-05-14 (an attempt to give Claude Code direct API access — failed anyway because the Code sandbox blocks `n8n.monitrax.com.au`, 403 Host not in allowlist). The key was rotated within minutes. **Lesson: never paste an n8n API key into a chat surface; if it leaks, rotate immediately.** Future direct-API access has to go via a dedicated service-account key with read-only scope.
- **Build this first** — it's what actually buys back your time. Everything else above is just data sources for this.

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
  - **Email 1 (Day 0):** Pattern-interrupt opener referencing their brokerage by name + the specific pain (established wealth-builder clients going cold between deals — the people most likely to refinance, get a second IP, or restructure). One question. No pitch.
  - **Email 2 (Day 3):** The wedge — *"What if your wealth-builder clients had a financial app they actually used — branded to you — and you knew the moment they were ready to refinance, restructure, or move?"* One paragraph. Loom link.
  - **Email 3 (Day 7):** Social proof + concrete pilot offer (free 60-day pilot with N of their established clients, no contract, you do the onboarding heavy-lifting).
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
- **Decision (Q-GTM-1, Reza 2026-05-11):** **$197 for the first 5 friendly Reviews.** Public price to be re-decided after Reviews #3–5 are delivered and conversion is observed — Claude's recommended ladder: $197 founding → $297 standard → $397 with-adviser-session.
- **Gotcha:** $197 is a low anchor — a $197 → $397 public jump is hard to justify, so plan the $297 intermediate step. Don't go below $197 for anyone — sub-$200 in personal finance reads as a lead magnet, not a product.

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
- **Action:** Hero ("Your wealth-builder clients, finally with one clear picture. Branded to you. You see when they're ready to refinance, restructure, or move."), 3-point value prop (better-informed clients = better conversations, refinance triggers fired automatically, retention via continuous value not annual calls), the pilot offer (60 days, no contract, you handle onboarding), a "book a 20-min call" CTA → Cal.com. The pitch lands on the broker's wealth-builder clients specifically — established borrowers with property, super, structure — not first-home-buyer leads.
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

- **Monetisation model (DECIDED 2026-05-12):** revenue priority = (1) adviser/broker B2B subs (the engine, live now), (2) D2C premium subs (this phase), (3) marketplace lead fees, (4) tasteful disclosed affiliate. **No display advertising** (trust-killer + advice-conflict — see `IMPLEMENTATION_PLAN.md` workstream 0e + Q-GTM-6). Affiliate only for products that pass the financial-adviser test, always disclosed, never inside the Guide's recommendation flow.
- **Freemium infrastructure:** the entitlements engine + admin controls + feature-tier tagging + cost-centre metering (AI / storage / Basiq feeds) get built **dormant** *before* this phase (workstream 0e — `lib/auth/entitlements.ts`, `checkEntitlement()`, a global "enforcement OFF" switch, default-to-PREMIUM) so Reza can review it; the **customer-facing** pricing page + Stripe consumer checkout + paywall/quota UI + "Upgrade" CTAs are built **in this phase**, at/near Basiq go-live, when prices + the free/paid split are final. Marketing site: Org/adviser pricing page now; consumer pricing page in this phase.
- **Free/Premium split (shape — finalise in this phase):** FREE = manual entry, basic net worth + budget, TRAIL journey, Guide top-3 (rule-based), small AI quota (~10 msgs/mo lite model), small storage cap (~100MB/~25 docs), 1–2 bank accounts. PREMIUM (~AU$9–14/mo or ~$79–129/yr TBD) = unlimited feeds + AI (Opus, fair-use) + storage, advanced scenarios, full Tax, full Properties/Investments, deeper Guide, Ask-a-Professional, priority support.
- **Activation:** Free tier with auto bank feeds + the "see your full picture in 60 seconds" first win (TRAIL Track stage). Don't paywall the first win — gate depth + the cost centres only.
- **Acquisition:** SEO content engine (Claude-drafted, monthly batch approval), one creator partnership (Equity Mates / Aussie FIRE / Glen James orbit), founding-member annual pricing for the waitlist.
- **Retention:** Lifecycle loops F1–F4 from the automation stack (already built by then).
- **Affiliate:** tasteful, disclosed only — never a pillar.

When Phase 5 closes, ask Claude to flesh this section into a Phase 6 plan with the same step-by-step structure (and a `docs/blueprint/PHASE_*_CONSUMER_FREEMIUM.md` for the freemium-infra build).

> **Note — Friendlies private beta (near-term, NOT part of Phase 6):** onboarding 5–10 friendlies on the demo-ready app for feedback is a separate near-term workstream (`IMPLEMENTATION_PLAN.md` 0f) that runs in parallel with the early GTM build + Reza's Basiq onboarding. It does *not* depend on the freemium infra (no gating exists today, so comping = "they sign up and get the app as-is"). Sequence: after GTM Step 1.1 (n8n) + 1.6 (Founder Daily Digest).

---

## Phase 6A — Consumer Paid Acquisition Engine (build now · spend at Phase 6 trigger)

> **DECIDED 2026-06-10 (Reza):** build and verify the full paid-ads machine (Google Ads + Meta) **now**; ad spend turns on **only when the Phase 5→6 trigger fires** (Basiq live). This keeps the Reversed-Decisions gate intact — the burn-rate engine exists but stays dormant. Designed for ~10 min/week founder involvement once live.
>
> **Full spec (SSOT):** `docs/marketing/gtm/PAID_ADS_AUTOMATION.md` — architecture, compliance gates, guardrails, step-by-step build. Do not duplicate its content here.

Summary of the build steps (details + "done when" in the spec doc):

- **6A.1 — Platform verification (Reza, ~3h one-time, start immediately):** Google Ads + Meta Business Manager accounts; Google AU financial-services verification via G2 on the **exemption path** (Monitrax holds no AFSL by design); Meta beneficiary/payer verification with self-declared exemption + "Paid for By" disclaimer. Longest lead-time item; free; cannot be delegated. Exemption basis bundled into the Q-GTM-5 lawyer brief.
- **6A.2 — Creative engine (n8n + Claude + Canva):** weekly Claude-drafted copy variants from approved website-copy SSOT with AFSL guardrails in the system prompt; Canva tiles from brand templates; one approve/reject email to Reza; approved creatives pushed via Google Ads API / Meta Marketing API.
- **6A.3 — Guardrail ops:** platform-side hard daily caps + n8n auto-pause rules (CPA breach 3 days → pause + digest flag; bottom-quartile creative rotation). Automation may only ever **decrease** spend; increases and new campaigns always require explicit Reza approval.
- **6A.4 — Reporting:** nightly spend/CPL/conversion pull → Airtable `AdPerformance` → new ADS section in the Founder Daily Digest. No new dashboards.
- **6A.5 — Ignition checklist (gated):** Phase 5 trigger fired · 6A.1 verifications green · Decimal migration (Q-DEC) shipped before any paid traffic to `/wealth-check` · landing claims lawyer-cleared · Reza signs the opening budget.

Targeting follows Q-ICP-1 (wealth-builders): Google high-intent search (net-worth / investment-property / SMSF tracking terms); Meta property-investor + SMSF interests and lookalikes seeded from broker-referred users. Consistent with Q-GTM-6: this is paid **acquisition**; the no-display-ads-as-revenue decision is untouched.

---

## Open questions to resolve before Phase 2 launch

| # | Question | Owner | Status |
|---|---|---|---|
| Q-GTM-1 | Review price for first 5 friendlies | Reza | ✅ **DECIDED 2026-05-11 — $197** (public price TBD after Reviews #3–5; recommended ladder $197→$297→$397) |
| Q-GTM-2 | Outbound sending domain name | Reza | ✅ **DECIDED 2026-05-11 — `try-monitrax.com` via Smartlead** (fallbacks `monitrax-pro.com` / `getmonitrax.com` / `hellomonitrax.com`) |
| Q-GTM-3 | First aggregator to focus on (Connective / AFG / Loan Market / Mortgage Choice / Finsure)? | Reza | ✅ **DECIDED 2026-06-10 — Finsure first, Connective second wave.** Avoid AFG / Mortgage Choice for outbound. Full rationale + targeting criteria: `docs/marketing/gtm/BROKER_ICP.md` (SSOT for outbound targeting). |
| Q-GTM-4 | VA: hire now (parallel with Phase 2) or wait until first Review sells? | Reza | Open — needed before Step 3.7. Claude recommendation: hire mid-Phase 2 (~week 2–3), small scope (CRM hygiene + lead QA + inbox triage), expand into Review intake from Review #2–3. |
| Q-GTM-5 | AFSL boundary — DIY scope doc + lawyer review, or engage an AFSL holder? | Reza | Open — needed before Step 3.1. Claude recommendation: **DIY + AU fintech-lawyer review** for v1 (factual-only Review), queue "partner with an AFSL holder for a Review + advice-session upsell" as the trigger if customer feedback demands personal recommendations. |
| Q-GTM-6 | Advertising as a consumer revenue lever? | Reza | ✅ **DECIDED 2026-05-12 — NO display ads.** Tasteful disclosed affiliate only (products that pass the financial-adviser test, never in the Guide flow, always disclosed); a minor stream, not a pillar. Revenue priority: B2B subs → D2C premium subs → marketplace lead fees → affiliate. See `IMPLEMENTATION_PLAN.md` workstream 0e. |
| Q-GTM-7 | Friendlies private-beta cohort — who, exactly? | Reza | Open — pick 5–10 across TRAIL stages; 6-month comp time-box. Not blocking the build; blocking the invite email (workstream 0f). |

---

## Tools + cost

> **The full, living tool stack + cost register is `docs/marketing/GTM_TOOL_STACK.md`** — that's the single source of truth. Update it (not this section) when a tool is added, dropped, or repriced.

Headline numbers (see the register for the per-tool breakdown):

| | Recurring (≈ AUD/mo) | One-off (≈ AUD) |
|---|---|---|
| **Pre-Basiq, lean** (free tiers + VA) | **~$560–910/mo** | ~$2k AFSL lawyer review (optional, recommended) |
| **Pre-Basiq, fuller** (paid tiers as volume grows) | **~$900–1,300/mo** | as above |
| **Post-Basiq** (when the Phase 5 gate is met) | **~$2,900–3,300/mo** | +~$10k Basiq initial fee |

Stack at a glance: `try-monitrax.com` domain (GoDaddy) · Google Workspace mailbox `reza@try-monitrax.com` · Smartlead (cold-outbound sequencing + warmup; connects the Workspace mailbox) · n8n self-hosted on a VPS (orchestration) · Anthropic API / Claude · Apollo (lead data) · Airtable (CRM) · Cal.com (booking) · Loops (lifecycle email) · Stripe (payments) · PostHog (analytics) · Sentry (errors) · Senja (testimonials) · Documenso (e-sign) · Loom (demos) · Typefully (social) · part-time VA. Decision rationale for the key picks (Smartlead vs Instantly, n8n vs Make/Zapier, separate domain vs primary, Google Workspace vs Smartlead DFY mailbox) is in the register's Decision Log.

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
- [~] 0.1 AFSL boundary doc — 🟡 DRAFT SHIPPED 2026-05-15 (`REVIEW_SCOPE_AND_BOUNDARIES.md`); lawyer review pending (Q-GTM-5) — blocks Reviews to strangers only
- [x] 0.2 Success metrics locked (targets in `IMPLEMENTATION_PLAN.md` workstream 0d)

### Phase 1
- [x] 1.1 n8n live at `https://n8n.monitrax.com.au` (Hetzner CPX22, Nuremberg, 2026-05-13)
- [x] 1.2 Airtable CRM (DONE 2026-05-15 — base `Monitrax CRM`, 7 tables, PAT wired in n8n, digest CRM ACTIVITY section live)
- [x] 1.3 Sending domain + mailbox set up; warmup ran 2026-05-12 → early June (window complete). **Gate for 2.7: Reza confirms Smartlead deliverability score ≥90% before first cold send.**
- [ ] 1.4 SaaS accounts
- [x] 1.5 Anthropic API in n8n (credential `Anthropic API - Monitrax` live since the 1.6 build, 2026-05-14); prompt library grows per-step
- [x] 1.6 Founder Daily Digest (LIVE 2026-05-14, cron published — 06:45 Sydney daily to `admin@monitrax.com.au`)

### Phase 2
- [x] 2.1 Broker ICP (2026-06-10 — `docs/marketing/gtm/BROKER_ICP.md`, Finsure-first per Q-GTM-3)
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

### Phase 6A — Paid Acquisition Engine (dormant build)
- [ ] 6A.1 Ad accounts + AU financial-services verifications (Google G2 exemption / Meta exemption) — **start now**
- [ ] 6A.2 Creative engine (n8n + Claude + Canva, weekly approval loop)
- [ ] 6A.3 Guardrail ops (caps, auto-pause, kill switch)
- [ ] 6A.4 Reporting → Airtable + Daily Digest ADS section
- [ ] 6A.5 Ignition (GATED: Phase 5 trigger + verifications + Q-DEC + lawyer-cleared claims + Reza budget sign-off)

---

*This document is a living plan. Update it as reality changes. Don't optimise the plan — optimise the outcome.*
