# Monitrax GTM — Tool Stack & Cost Register

> **Single source of truth for every tool / app / service used in the go-to-market motion, and what each costs.**
> Update this file every time a tool is added, removed, upgraded, or repriced. Referenced from `docs/marketing/GTM_EXECUTION_PLAN.md`.

**Last updated:** 2026-05-15 — Reza + Claude
**Scope:** GTM / sales / marketing / outreach automation tooling only. Product infrastructure costs (Vercel, GCP Cloud SQL, Basiq, Firebase) are tracked separately — see the "Related non-GTM costs" section at the bottom for pointers.
**FX assumption:** USD→AUD ≈ **1.55** (approximate; actuals vary). AUD figures are estimates for budgeting, not exact.
**Status legend:** 🟢 Active (signed up / in use) · 🟡 Planned (in the plan, not yet signed up) · 🔵 Evaluating · ⚪ Dropped / not adopted

---

## 🟢 What's live RIGHT NOW (at-a-glance)

> Reza directive 2026-05-15: *"the number of apps is getting overwhelming"* — this section exists so you can answer "what am I paying for / using today?" in 10 seconds without scanning the long table below.

| Tool | What it does for us | Account / login | Approx. AUD/mo |
|---|---|---|---|
| `try-monitrax.com` (GoDaddy) | Cold-outbound sending domain | — | ~$2 |
| Google Workspace on `try-monitrax.com` | Mailbox `reza@try-monitrax.com` (cold-out sender, Smartlead-connected) | `reza@try-monitrax.com` | ~$8.40 |
| Google Workspace on `monitrax.com.au` | Ops mailbox `admin@monitrax.com.au` (daily digest recipient, n8n alerts) | `admin@monitrax.com.au` | already paid (existing) |
| Smartlead | Cold-email sequencing + 2–3wk inbox warmup (currently passive-warming, no sends until ~early June) | `reza@try-monitrax.com` (OAuth) | ~$60 |
| Hetzner Cloud VPS `n8n-1` | Hosts self-hosted n8n + Postgres + Caddy + future Documenso | `admin@monitrax.com.au` (Hetzner project `monitrax-ops`) | ~$15 all-in |
| n8n (self-hosted) | Automation spine. Live workflows: `Founder Daily Digest v1`, `Founder Daily Digest - Error Notifier` | `admin@monitrax.com.au` (owner) | $0 (Community + free license key) |
| Anthropic API (Claude) | Daily digest summariser (Sonnet 4.6, ~$0.15–0.60/mo). Future: outreach personalisation, Review drafting (Opus). | `reza.sadegh@ymail.com` (console) | $0–1 today; ~$50–150 once outbound + Reviews ramp |
| Google Cloud (project `monitrax-479700`) | OAuth client backing n8n's Gmail credentials. Future: any other n8n Google integration. | `admin@monitrax.com.au` | $0 |
| Airtable Free | CRM SSOT (`Monitrax CRM` base — Leads / Contacts / Companies / Brokerages / Deals / Reviews / Activities). The digest's CRM ACTIVITY section reads from here. | `admin@monitrax.com.au` | $0 |
| Stripe | Payment infra (existing app use — Review payment links + future broker subs) | (existing) | per-transaction only |

**Live monthly burn (as of 2026-05-15):** ~AU$85–90/mo + per-transaction Stripe + ~AU$0.50 Anthropic. Excluding the Hetzner VPS (~$15) and Smartlead (~$60), the entire GTM stack adds **less than $10/mo** until cold outbound launches.

**What's NOT live yet** (in the plan, not yet signed up): Apollo · Cal.com · Loops · PostHog · Sentry · Senja · Documenso · Loom · Typefully · part-time VA. Each is queued against a specific GTM step — see "Active + planned tools" table below for full status.

---

## Active + planned tools

| Tool | Category | Purpose | Plan | List price | ≈ AUD/mo | Status | Notes |
|---|---|---|---|---|---|---|---|
| **`try-monitrax.com`** (GoDaddy) | Domain | Dedicated cold-outbound sending domain (keeps `monitrax.com.au` deliverability clean) | Registration | ~US$12–20/yr | ~$2/mo | 🟢 Active | Purchased 2026-05-12. "Keep Separate" from main domain in GoDaddy. DNS configured 2026-05-12: MX→Google, SPF (GoDaddy managed-SPF chaining to `_spf.google.com`), DKIM (`google._domainkey`), DMARC (`p=quarantine`), Google site-verification. Q-GTM-2. |
| **Google Workspace** (on `try-monitrax.com`) | Mailbox | Hosts the sending mailbox `reza@try-monitrax.com` (real-name sender, on the brand-linked domain we own); connected to Smartlead for sequencing + warmup | Business Starter | ~AU$8.40/user/mo (14-day trial) | ~$8.40/mo | 🟢 Active | Set up 2026-05-12. Chosen over Smartlead's "Fresh Mailboxes" DFY bulk-purchase (which would have registered a *new* Smartlead-owned domain + cost ~$30–40/mo for a 10-mailbox pack — wrong tool: we already own `try-monitrax.com` and want to control the domain). One mailbox sufficient at 30–50/day; add a 2nd only if sustained volume rises. |
| **Smartlead** | Cold outbound | Cold-email sequencing, inbox warmup, reply tracking, deliverability layer. **Connects** the Google Workspace mailbox above via OAuth — does NOT provide the mailbox | Basic / LITE | US$39/mo | ~$60/mo | 🟢 Active | Account created 2026-05-12; `reza@try-monitrax.com` connected via Google OAuth; **warmup ENABLED** (target 30/day, +1/day rampup, 35% reply). 2–3 week passive warm running (≈ early June 2026) — no real cold mail until then. Alternative: Instantly (US$37–97/mo, friendlier UI). Q-GTM-2. |
| **n8n** | Orchestration | The automation spine — all GTM workflows (lead enrichment, personalisation, reply routing, daily digest, lifecycle, reporting) | Self-hosted (Community) — free-license-key registered to `admin@monitrax.com.au` (unlocks Folders / Execution search & tagging / Advanced debugging) | $0 (software) | $0 | 🟢 Active 2026-05-13 | Running at **`https://n8n.monitrax.com.au`** (moved from `n8n.try-monitrax.com` mid-session — Chrome Safe Browsing flag on new domain). n8n + Postgres + Caddy via Docker Compose on the Hetzner VPS below. Owner account created; password in password manager. |
| **VPS — Hetzner Cloud `n8n-1`** | Infra | Hosts self-hosted n8n + Postgres (n8n data) + Caddy (HTTPS) + future small GTM services (Documenso e-sign, etc.) | CPX22 (3 vCPU / 4 GB / 80 GB / 20 TB traffic) | ~€7.05/mo + ~€0.50/mo IPv4 + ~20% backups | ~$14–15/mo all-in | 🟢 Active (provisioned 2026-05-13) | Location: Nuremberg (eu-central). Reached via `n8n.monitrax.com.au` (subdomain of brand domain — clean Safe Browsing posture). Hetzner-managed daily backups on. SSH key-only access; root password login disabled; UFW (22/80/443 only); fail2ban running; `unattended-upgrades` enabled. Raw IP intentionally NOT in repo — DNS hostname is the canonical reference. |
| **Anthropic API (Claude)** | AI | Outreach personalisation (Sonnet), reply classification (Sonnet), Review report drafting (Opus), support triage (Sonnet), daily-digest summarisation (Sonnet) | Pay-as-you-go | Usage-based | ~$50–150/mo (est) | 🟢 Active 2026-05-14 | Step 1.5. Workspace: `Default` on `console.anthropic.com`; key `reza-onboarding-api-key` (`sk-ant-api03-...UwAA`, created 2025-11-10); ~AU$7.50 credit on hand 2026-05-14. **First production consumer: Founder Daily Digest (Step 1.6)** — `claude-sonnet-4-6`, ~$0.005–0.02 per run = ~$0.15–0.60/mo for this workflow alone. Use prompt caching aggressively (static system prompts + templates) — cuts cost ~10×. Cost scales with outbound volume + Reviews delivered. |
| **Google Cloud (OAuth client)** | Identity | OAuth 2.0 client for n8n's Gmail credentials (read on `reza@try-monitrax.com`, send on `admin@monitrax.com.au`). Future-use: any other n8n integration that needs Google APIs (Drive, Sheets, Calendar). | Free (consent + OAuth are free; no API quota cost at this volume) | $0 | $0 | 🟢 Active 2026-05-14 | Project `monitrax-479700`. OAuth client `n8n - Monitrax Gmail OAuth` (Web application, redirect `https://n8n.monitrax.com.au/rest/oauth2-credential/callback`, JavaScript origins empty). Consent screen: External, app name `Monitrax`, publishing **Testing**, test users `admin@monitrax.com.au` + `reza@try-monitrax.com`. Single client serves both Gmail credentials. **Self-hosted n8n requires a BYO OAuth client** (n8n Cloud has a shared one) — ~15 min extra first-time setup. |
| **Apollo.io** | Lead data | Build + enrich the broker prospect list | Basic | US$49/mo | ~$75/mo | 🟡 Planned | Step 2.2. Use for DATA ONLY — do not send cold mail through Apollo sequences (shared sending infra hurts deliverability). |
| **Airtable** | CRM | Contacts / Companies / Deals / Reviews / Activities pipeline; n8n reads/writes natively. **First production consumer: Founder Daily Digest CRM ACTIVITY section.** | Free | $0 | $0 | 🟢 Active 2026-05-15 | Step 1.2 DONE 2026-05-15. Workspace `Monitrax`, base `Monitrax CRM` (`appEDHNU0mtbWznHp`), owner `admin@monitrax.com.au`. 7 tables built (Leads / Contacts / Companies / Brokerages & Employer Orgs / Deals / Reviews / Activities — one extra beyond v1 spec, see GTM_EXECUTION_PLAN Step 1.2). PAT `n8n-monitrax-crm` (least-privilege: 3 scopes, base-restricted) wired into n8n as credential `Airtable - Monitrax CRM`. Free tier limit 1,200 records/base — sufficient until first 1k leads imported. Upgrade (~US$20/seat) only if hit. Alternative: HubSpot free. |
| **Cal.com** | Booking | Discovery-call + Review-walkthrough scheduling; booking events → n8n | Free / Pro | $0–US$15/mo | $0–$23/mo | 🟡 Planned | Step 2.6. Free tier likely enough initially. Open-source; Calendly is the hosted alternative. |
| **Loops.so** | Lifecycle email | Product/lifecycle + nurture sequences (NOT cold — that's Smartlead); triggered by app events | Free | $0 | $0 | 🟡 Planned | Step 1.4 / 3.6. Free tier covers low volume. Paid (~US$49/mo) when contact count grows. Alternative: MailerLite. |
| **Stripe** | Payments | Review payment links now; broker subscriptions + invoicing later | Standard | Per-transaction | ~1.75% + A$0.30 domestic / 2.9% + A$0.30 intl | 🟢 Active | Already in use for the app (live-mode flip pending — see IMPLEMENTATION_PLAN Phase 0). No fixed monthly fee. |
| **PostHog** | Analytics | Funnel (landing → signup → activation → Review/pilot), session replay, feature flags, web analytics | Free | $0 (1M events/mo free) | $0 | 🟡 Planned | Step 1.4. Generous free tier. Replaces needing both Plausible + a product-analytics tool. |
| **Sentry** | Error tracking | Product errors routed into the Founder Daily Digest | Developer (free) | $0 | $0 | 🟡 Planned | Step 1.4. Free tier sufficient. (GCP Error Reporting is the existing fallback per CLAUDE.md §12.7 — Sentry is optional polish.) |
| **Senja.io** | Social proof | Auto-request + collect + embed testimonials (post-Review, post-pilot-30d) | Free / Starter | $0–US$19/mo | $0–$30/mo | 🟡 Planned | Step 3.6 / C3. Free tier to start. |
| **Documenso** | E-signature | Broker pilot agreements | Self-host / Cloud | $0 (self-host) / ~US$30/mo | $0–$47/mo | 🟡 Planned | Step 4.3. Self-host to start (it can run on the same VPS). Alternative: Dropbox Sign. |
| **Loom** | Async demos | 4-min product demos sent to brokers (kills ~80% of "can you show me?" calls) | Free / Business | $0–US$15/mo | $0–$23/mo | 🟡 Planned | Step 2.6 / 4.1. Free tier (25 videos) likely enough initially. |
| **Typefully** | Social scheduling | Queue LinkedIn / X content (content repurposing engine) | Free / Plus | $0–US$12.50/mo | $0–$19/mo | 🟡 Planned | Step C1/C2. Free tier to start. Alternative: Buffer. |
| **Part-time VA** (OnlineJobs.ph or similar) | Human ops | CRM hygiene, lead-list QA, Review data sanity checks, FAQ inbox triage, scheduling | ~10–15 hrs/wk | ~US$5–8/hr | ~$300–500/mo | 🟡 Planned | Step 3.7 (Q-GTM-4 — timing TBD; Claude rec: hire mid-Phase 2, small scope). Highest-ROI "minimise founder involvement" lever. SOPs written before they start. |

---

## Cost summary

| Phase | Recurring monthly (≈ AUD) | One-off (≈ AUD) | Notes |
|---|---|---|---|
| **Pre-Basiq, lean (free tiers + VA)** | **~$560–910/mo** | ~$2k (AFSL lawyer review, Step 0.1/Q-GTM-5 — optional, recommended) | Smartlead ~$60 + Google Workspace ~$8.40 + VPS ~$15 + Claude ~$50–150 + Apollo ~$75 + VA ~$300–500; everything else on free tiers; Stripe is per-transaction only |
| **Pre-Basiq, fuller (paid tiers as volume grows)** | **~$910–1,310/mo** | as above | Add Loops paid, Senja paid, Cal.com Pro, Documenso cloud, Airtable paid as needed |
| **Post-Basiq (when triggered — Phase 5 gate)** | **+$2,000/mo** (Basiq minimum) | +~$10,000 (Basiq initial fee) | Only triggered when ≥AU$3–5k committed broker MRR + ≥AU$15k cash on hand. See IMPLEMENTATION_PLAN workstream 0d. |
| **Post-Basiq, total** | **~$2,910–3,310/mo** | — | |

**Annual domain costs (small, listed for completeness):** `try-monitrax.com` ~US$12–20/yr · `monitrax.com.au` (existing) ~A$20–30/yr.

---

## Decision log (tool choices + why)

| Date | Decision | Why | Alternative considered |
|---|---|---|---|
| 2026-05-11 | Cold outbound = **Smartlead** | Best price (US$39/mo) + API quality + DFY managed-inbox option for the solo-scale use case (30–50 sends/day, one mailbox, n8n integration) | Instantly (friendlier UI, ~US$37–97/mo) — viable swap if UX matters more than price. Lemlist (pricier, no advantage here). Apollo sequences — rejected, shared sending infra hurts deliverability. |
| 2026-05-11 | Orchestration = **n8n, self-hosted** | Power (branching, code nodes, AI nodes) + near-zero cost (free software, ~US$6–12/mo VPS). Reza already runs a Next.js/GCP stack so a VPS is no friction. | n8n Cloud (~US$20/mo, no-VPS option). Make (middle ground, hosted-only). Zapier (easiest but expensive at scale + weak logic — relegated to "glue for the long tail" only). |
| 2026-05-13 | VPS host = **Hetzner Cloud, CPX22 in Nuremberg, Ubuntu 24.04** | CPX22 (3 vCPU / 4 GB / 80 GB / 20 TB, ~€7/mo) is the right balance — enough RAM headroom for n8n + Postgres + Caddy + Documenso later; AMD shared-CPU pricing beats Intel CX22 only marginally and gets 80 GB SSD vs 40 GB. Nuremberg over Singapore for availability + cost (latency irrelevant for automation). Dedicated CCX line considered and rejected — 4× the price for negligible benefit on bursty automation workloads. | DigitalOcean Sydney 2 GB droplet (~US$12/mo) — slightly cleaner AU-data story but no CDR data touches this server anyway (n8n is GTM-only, never pulls CDR data per CLAUDE.md §13). Either choice is CDR-compliant. |
| 2026-05-11 | Separate sending domain `try-monitrax.com`, NOT `admin@monitrax.com.au` | Cold-outreach spam signals tracked per sending domain; a burn routes the primary domain's product email + CDR-consent confirmations to spam with weeks-to-months recovery, right at launch. ~US$15/yr insurance against that. Universal B2B practice. | Subdomain `outreach.monitrax.com.au` — only partial isolation (Gmail still weighs the org root domain); fallback only if a second registrable domain were off the table. |
| 2026-05-11 | Analytics = **PostHog** (over Plausible + a separate product-analytics tool) | One tool covers funnel + session replay + feature flags + web analytics, 1M events/mo free | Plausible (web-only, privacy-friendly) + a separate product tool — two bills for what PostHog does in one |
| 2026-05-12 | Sending mailbox = **Google Workspace on `try-monitrax.com`** (BYO mailbox, connected to Smartlead via OAuth), NOT Smartlead's "Fresh Mailboxes" DFY bulk-purchase | Smartlead's DFY flow registers a *new Smartlead-owned domain* and sells mailboxes in 10/20/50/100 packs (~US$3–4/mailbox/mo) — wrong tool for a solo founder who already owns `try-monitrax.com` and wants to control the domain. Google Workspace Business Starter is ~AU$8.40/mo, the mailbox + domain are yours unconditionally, and Smartlead still does all the sequencing/warmup via OAuth connection. Slightly more setup (~20 min: Workspace signup + domain verification + DKIM auth) but the right architecture. | Smartlead "Fresh Mailboxes" DFY (new domain, 10-mailbox minimum effectively, ~$30–40/mo, domain lives in Smartlead's account). Smartlead "Pre-Warmed Mailboxes" (generic non-brand domain + made-up sender identity — rejected, undercuts trust for a financial-product pitch). |
| 2026-05-14 | Daily Digest summariser model = **`claude-sonnet-4-6`**, not `claude-opus-4-7` | Daily structured summarisation (5 sections, plain text, ~1.5k input + ~1k output tokens) is well within Sonnet's quality envelope. Opus would be ~5× the cost for negligible quality gain on this prompt class. The principle ("match the model to the task") matters more than the $$ — Opus is reserved for the high-stakes Review reports (Step 3), not the daily ops brief. | `claude-opus-4-7` (overkill); `claude-haiku-4-5` (likely fine for inbox-zero days, but Sonnet handles the "thin signal → fallback" reasoning more reliably). |
| 2026-05-14 | Daily Digest recipient = **`admin@monitrax.com.au`** (self-send), not `reza@monitrax.com.au` | `reza@monitrax.com.au` does not exist as a Workspace mailbox — `admin@` is the only `@monitrax.com.au` mailbox. Creating a separate `reza@` would cost another Workspace seat (~AU$8.40/mo) for purely cosmetic value. Self-send to `admin@` is the cheapest correct fix. | Create `reza@monitrax.com.au` (cost + no operational benefit). Send to `reza.sadegh@ymail.com` (crosses out of the Monitrax domain — fine on its own but less clean for the operations trail). Send from + to `reza@try-monitrax.com` (mixes ops mail with cold-outbound mailbox — noisier inbox). |

---

## Related non-GTM costs (tracked elsewhere — pointers only)

These are NOT in the GTM budget above; listed so there's one place to find them:

| Item | Where it's tracked | Rough cost |
|---|---|---|
| Vercel Pro (region pinning, build minutes) | `docs/architecture/09_INFRASTRUCTURE_AND_DEPLOYMENT.md`; IMPLEMENTATION_PLAN Open Questions Q3 (decided) | ~US$20/mo + usage |
| GCP Cloud SQL (Enterprise Plus) | `docs/operational/database/01_CLOUD_SQL_OPERATIONS.md`; IMPLEMENTATION_PLAN Q1 (decided) | varies by tier — see the ops doc |
| GCP other (Cloud Storage, Secret Manager, Cloud Logging, Error Reporting, Cloud Scheduler) | `docs/architecture/09_INFRASTRUCTURE_AND_DEPLOYMENT.md` | low at current scale |
| Basiq CDR accreditation | IMPLEMENTATION_PLAN workstream 0d (Basiq gate) | US$10k initial + US$2k/mo minimum — gated, not yet incurred |
| Pen test (Basiq requirement) | IMPLEMENTATION_PLAN Phase 0 external dependencies | ~A$15–25k one-off |
| Cyber insurance (Basiq requirement) | IMPLEMENTATION_PLAN Phase 0 external dependencies | ~A$? /yr (TBD) |
| `monitrax.com.au` domain (existing) | GoDaddy | ~A$20–30/yr |

---

## How to keep this current

- **Add a tool** → add a row to "Active + planned tools", a line to "Cost summary" if it materially moves the total, and an entry in the "Decision log" with the why + the alternative you rejected.
- **Drop a tool** → flip status to ⚪ Dropped, keep the row (with the why), update "Cost summary".
- **Reprice / upgrade** → update the row, note it in the Decision log if it changes a prior decision.
- **Every change here** also gets a one-line mention in the day's `docs/changelog/CHANGELOG_YYYY_MM_DD.md` and, if it changes the GTM budget materially, a note in `IMPLEMENTATION_PLAN.md` workstream 0d.
