# Monitrax GTM — Tool Stack & Cost Register

> **Single source of truth for every tool / app / service used in the go-to-market motion, and what each costs.**
> Update this file every time a tool is added, removed, upgraded, or repriced. Referenced from `docs/marketing/GTM_EXECUTION_PLAN.md`.

**Last updated:** 2026-05-12 — Reza + Claude
**Scope:** GTM / sales / marketing / outreach automation tooling only. Product infrastructure costs (Vercel, GCP Cloud SQL, Basiq, Firebase) are tracked separately — see the "Related non-GTM costs" section at the bottom for pointers.
**FX assumption:** USD→AUD ≈ **1.55** (approximate; actuals vary). AUD figures are estimates for budgeting, not exact.
**Status legend:** 🟢 Active (signed up / in use) · 🟡 Planned (in the plan, not yet signed up) · 🔵 Evaluating · ⚪ Dropped / not adopted

---

## Active + planned tools

| Tool | Category | Purpose | Plan | List price | ≈ AUD/mo | Status | Notes |
|---|---|---|---|---|---|---|---|
| **`try-monitrax.com`** (GoDaddy) | Domain | Dedicated cold-outbound sending domain (keeps `monitrax.com.au` deliverability clean) | Registration | ~US$12–20/yr | ~$2/mo | 🟢 Active | Purchased 2026-05-12. "Keep Separate" from main domain in GoDaddy. DNS configured 2026-05-12: MX→Google, SPF (GoDaddy managed-SPF chaining to `_spf.google.com`), DKIM (`google._domainkey`), DMARC (`p=quarantine`), Google site-verification. Q-GTM-2. |
| **Google Workspace** (on `try-monitrax.com`) | Mailbox | Hosts the sending mailbox `reza@try-monitrax.com` (real-name sender, on the brand-linked domain we own); connected to Smartlead for sequencing + warmup | Business Starter | ~AU$8.40/user/mo (14-day trial) | ~$8.40/mo | 🟢 Active | Set up 2026-05-12. Chosen over Smartlead's "Fresh Mailboxes" DFY bulk-purchase (which would have registered a *new* Smartlead-owned domain + cost ~$30–40/mo for a 10-mailbox pack — wrong tool: we already own `try-monitrax.com` and want to control the domain). One mailbox sufficient at 30–50/day; add a 2nd only if sustained volume rises. |
| **Smartlead** | Cold outbound | Cold-email sequencing, inbox warmup, reply tracking, deliverability layer. **Connects** the Google Workspace mailbox above via OAuth — does NOT provide the mailbox | Basic / LITE | US$39/mo | ~$60/mo | 🟢 Active | Account created 2026-05-12; `reza@try-monitrax.com` connected via Google OAuth; **warmup ENABLED** (target 30/day, +1/day rampup, 35% reply). 2–3 week passive warm running (≈ early June 2026) — no real cold mail until then. Alternative: Instantly (US$37–97/mo, friendlier UI). Q-GTM-2. |
| **n8n** | Orchestration | The automation spine — all GTM workflows (lead enrichment, personalisation, reply routing, daily digest, lifecycle, reporting) | Self-hosted (Community) | $0 (software) | $0 | 🟡 Planned | Step 1.1. Runs on the VPS below. No-VPS alternative: n8n Cloud ~US$20/mo. |
| **VPS** (Hetzner CX11 or DigitalOcean) | Infra | Hosts self-hosted n8n + Caddy (HTTPS) | Smallest tier | ~US$6–12/mo | ~$10–18/mo | 🟡 Planned | Step 1.1. Nightly snapshot backup. Skip if using n8n Cloud instead. |
| **Anthropic API (Claude)** | AI | Outreach personalisation (Sonnet), reply classification (Sonnet), Review report drafting (Opus), support triage (Sonnet), daily-digest summarisation (Sonnet) | Pay-as-you-go | Usage-based | ~$50–150/mo (est) | 🟡 Planned | Step 1.5. Use prompt caching aggressively (static system prompts + templates) — cuts cost ~10×. Cost scales with outbound volume + Reviews delivered. |
| **Apollo.io** | Lead data | Build + enrich the broker prospect list | Basic | US$49/mo | ~$75/mo | 🟡 Planned | Step 2.2. Use for DATA ONLY — do not send cold mail through Apollo sequences (shared sending infra hurts deliverability). |
| **Airtable** | CRM | Contacts / Companies / Deals / Reviews / Activities pipeline; n8n reads/writes natively | Free | $0 | $0 | 🟡 Planned | Step 1.2. Free tier sufficient at this stage. Upgrade (~US$20/seat) only if record limits hit. Alternative: HubSpot free. |
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
| 2026-05-11 | Separate sending domain `try-monitrax.com`, NOT `admin@monitrax.com.au` | Cold-outreach spam signals tracked per sending domain; a burn routes the primary domain's product email + CDR-consent confirmations to spam with weeks-to-months recovery, right at launch. ~US$15/yr insurance against that. Universal B2B practice. | Subdomain `outreach.monitrax.com.au` — only partial isolation (Gmail still weighs the org root domain); fallback only if a second registrable domain were off the table. |
| 2026-05-11 | Analytics = **PostHog** (over Plausible + a separate product-analytics tool) | One tool covers funnel + session replay + feature flags + web analytics, 1M events/mo free | Plausible (web-only, privacy-friendly) + a separate product tool — two bills for what PostHog does in one |
| 2026-05-12 | Sending mailbox = **Google Workspace on `try-monitrax.com`** (BYO mailbox, connected to Smartlead via OAuth), NOT Smartlead's "Fresh Mailboxes" DFY bulk-purchase | Smartlead's DFY flow registers a *new Smartlead-owned domain* and sells mailboxes in 10/20/50/100 packs (~US$3–4/mailbox/mo) — wrong tool for a solo founder who already owns `try-monitrax.com` and wants to control the domain. Google Workspace Business Starter is ~AU$8.40/mo, the mailbox + domain are yours unconditionally, and Smartlead still does all the sequencing/warmup via OAuth connection. Slightly more setup (~20 min: Workspace signup + domain verification + DKIM auth) but the right architecture. | Smartlead "Fresh Mailboxes" DFY (new domain, 10-mailbox minimum effectively, ~$30–40/mo, domain lives in Smartlead's account). Smartlead "Pre-Warmed Mailboxes" (generic non-brand domain + made-up sender identity — rejected, undercuts trust for a financial-product pitch). |

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
