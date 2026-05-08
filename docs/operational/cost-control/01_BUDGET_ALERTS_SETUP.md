# Budget Alerts + Spend Caps — Setup Runbook

> **Owner:** Reza.
> **Companion doc:** [`00_VENDOR_INVENTORY.md`](./00_VENDOR_INVENTORY.md) — the SSOT.
> **Recommended:** complete §1 (GCP) + §2 (Vercel) **before** Phase 33g.2 lands the live AI feedback chat (Anthropic SDK addition). Then §4 (Anthropic) at code-land time.

This runbook tells you exactly which dashboard to open + what to click for each vendor to put a hard ceiling on monthly spend. **Spend caps are the safety net; the inventory doc is the audit log.**

Recommended overall posture for pilot phase:

- **GCP combined budget:** AU$700/mo with 50 / 90 / 100 % email alerts
- **Vercel hard ceiling:** US$50/mo
- **Anthropic monthly limit:** US$50/mo (when wired)
- **Stripe:** no cap — Stripe is net-positive (income, not cost)
- **Twilio / Resend / Maps:** monthly review only (low absolute spend)

---

## §1. GCP — set a project-wide budget + alerts

This covers Cloud SQL Enterprise Plus, Cloud Storage, Cloud Logging, Cloud Scheduler, Error Reporting, Identity Platform, Workload Identity Federation, Gemini API, Maps + Places API. Single budget across the whole `monitrax-prod` project.

1. **Open** `console.cloud.google.com` → Billing → Budgets & alerts.
2. **+ Create budget**.
3. **Scope**: Project = `monitrax-prod`. (Optional: split per-service if you want fine-grained alerts; pilot phase doesn't need this yet.)
4. **Amount**: Specified amount → **AU$700/mo** (adjust based on actual after first month).
5. **Actions**:
   - Email me at thresholds: 50%, 90%, 100% of budget.
   - Email recipient: Reza's email.
   - Tick "Connect a Pub/Sub topic" only if you want programmatic shutdown — leave off at pilot scale.
6. **Save**.
7. **Verify**: the budget appears in the list with status "Active". You should receive a confirmation email within a few minutes.

**Why $700:** sum of upper-end ranges from inventory (Cloud SQL ~$500 + Storage ~$10 + Logging ~$8 + Schedulers ~$1 + Gemini ~$30) ≈ $549. $700 leaves headroom for Maps + occasional spikes, but trips the 90% alert at $630 — early warning before invoice arrives.

**Optional fine-grained split** (do this if you ever see a single-service spike):
- Cloud SQL alone: AU$500 budget
- Gemini alone: AU$50 budget
- Everything else: AU$150 combined

---

## §2. Vercel Pro — hard ceiling on spend

1. **Open** `vercel.com/dashboard` → your team → **Settings** → **Billing**.
2. **Spend Management** section.
3. Toggle **Spend cap** ON.
4. Set ceiling to **US$50/mo** (Pro flat is $20; this caps overages at +$30 buffer for unexpected build minutes / bandwidth).
5. **Save**.
6. **Verify**: Spend Management shows the cap + email alerts at 50% / 80% / 100% (Vercel sets these defaults).

If you ever want to disable it (e.g. high-traffic event during demo period), toggle off in the same place.

---

## §3. Resend — email provider setup (chosen 2026-05-09)

Account doesn't exist yet. Set up before any email-out feature ships.

1. **Sign up** at `resend.com` with the Monitrax domain email.
2. Plan: **Free tier** — 3k emails/month, 100/day. Sufficient for pilot.
3. **Add domain**: Settings → Domains → **Add Domain** → enter `monitrax.com.au`.
4. Resend gives you DNS records (SPF, DKIM, DMARC). Add them to Cloudflare / your DNS provider for `monitrax.com.au`.
5. Wait ~5–30 min for DNS propagation; Resend marks the domain "Verified".
6. **Create API key**: API Keys → **Create API Key** → name it `monitrax-prod`.
7. Copy the key once (Resend won't show it again).
8. Add to Vercel env vars (Production scope): `RESEND_API_KEY=<the-key>`.
9. **Set the spend alert**: Settings → Billing → enable email alerts at the free-tier ceiling (3k/mo).

**Note:** the codebase currently has SendGrid integration scaffolded in:
- `lib/services/feedbackService.ts`
- `lib/services/conversationService.ts`
- `lib/email/conversationEmail.ts`

These need migrating to the Resend SDK before the first email-out feature lands. Tracked as Tech Debt #15 in `IMPLEMENTATION_PLAN.md`.

---

## §4. Anthropic Claude API — when Phase 33g.2 lands

**Set this BEFORE the code that calls it ships.**

1. **Sign up** at `console.anthropic.com` with the Monitrax domain email.
2. **Add a credit card** for billing (no free tier for production usage).
3. **Settings → Limits**:
   - **Monthly spend limit**: US$50 (ceiling).
   - **Email alerts**: 50% / 90% / 100% of limit.
4. **Settings → Workspaces → Create workspace** named `monitrax-prod`.
5. **API keys**: create `monitrax-prod` key in the workspace; copy once.
6. Add to Vercel env vars (Production scope): `ANTHROPIC_API_KEY=<the-key>`.
7. **Verify**: usage dashboard shows zero spend after key creation; first call increments it.

**Why $50:** at expected pilot volume (≤100 feedback threads/month, prompt-cached, mostly Haiku 4.5 with occasional Opus 4.7 synthesis), expect $5–25/month. $50 cap = 2× headroom.

When you exceed the limit, Anthropic stops accepting calls (graceful — the feedback drawer falls back to "Send to Reza directly without AI triage" rather than crashing). The fallback path needs to exist in code; tracked in the Phase 33g.2 design doc.

---

## §5. Stripe — no cap needed (income side)

Stripe is net-positive — it's how money comes IN, not out. Per-charge fees (1.75% + AU$0.30 in AU) are deducted from the gross. No spend cap to set. However:

1. **Open** `dashboard.stripe.com` → **Settings** → **Notifications** → **Email**.
2. Enable: failed-charge alerts, dispute alerts, payout-failure alerts. These matter for cashflow visibility, not spend cap.
3. **Webhook endpoint check**: Settings → Developers → Webhooks. Verify `https://monitrax.com.au/api/stripe/webhook` is registered + signing secret is in Vercel env vars (`STRIPE_WEBHOOK_SECRET`).

---

## §6. Twilio — monthly review only

Low absolute spend; not worth a hard cap. Just enable usage alerts.

1. **Open** `console.twilio.com` → **Monitor** → **Alerts**.
2. **+ Create alert** → trigger when monthly usage > US$20.
3. **Email recipient**: Reza.
4. Save.

Twilio's pay-as-you-go has no plan tier; the alert is the only mechanism.

---

## §7. Basiq — per your existing contract

Basiq pricing is negotiated per-tier; they invoice direct. No console-side cap.

1. **Login** at `dashboard.basiq.io`.
2. **Account → Billing**: confirm your tier + the per-active-connection rate.
3. Active-connection count grows with every consumer who connects a bank. Watch this number monthly; tier-up is itself a Basiq accreditation conversation.

---

## §8. Google Maps + Places API

1. **Open** `console.cloud.google.com` → APIs & Services → **Quotas**.
2. Find **Places API (New)** quota: set a per-day limit (e.g. 1000 requests).
3. Find **Maps JavaScript API**: same.

The first US$200/mo of usage is free credit; staying under quota means staying under the credit. Pilot scale comfortably stays free.

---

## §9. Monthly review checklist (1st of month)

For each vendor in `00_VENDOR_INVENTORY.md`:

- [ ] **Vercel**: vercel.com/dashboard → Settings → Billing → check current period total
- [ ] **GCP**: console.cloud.google.com → Billing → Reports → filter by service. Total goes into the inventory's Last billed column for each GCP service.
- [ ] **Gemini**: aistudio.google.com → Billing (or via the GCP billing report — Gemini bills under "Generative Language API")
- [ ] **Anthropic** (when wired): console.anthropic.com → Usage
- [ ] **Stripe**: dashboard.stripe.com → Reports → revenue this month
- [ ] **Twilio**: console.twilio.com → Usage
- [ ] **Resend** (when wired): resend.com → Usage
- [ ] **Basiq**: dashboard.basiq.io → Billing
- [ ] **Maps + Places**: console.cloud.google.com → APIs & Services → Quotas → request count

Anomaly threshold: any vendor where the actual is >2× the inventory's estimated upper bound. Flag in the Notes column + investigate.

---

## §10. What if a budget alert fires?

| Alert | Likely cause | First action |
|---|---|---|
| GCP at 50% | Normal mid-month usage | Note it; no action |
| GCP at 90% | Spike — one service is running hot | Open Billing → Reports → filter by service. If Cloud SQL: check Insights for slow queries / connection storms. If Gemini: check `lib/ai/gemini.ts` callers for retry loops |
| GCP at 100% | Real cost overrun | Diagnose + decide: temporary increase budget (this month only), or kill the offending feature pending fix |
| Vercel at 100% | Build minute / bandwidth overage | Check vercel.com → Insights for traffic spike or build-failure retry loop |
| Anthropic at 90% | Feedback chat running hot OR synthesis-loop misuse | Drawer falls back to direct-to-Reza routing. Diagnose retry / loop in `lib/services/feedbackService.ts` |
| Twilio alert | MFA volume spike | Check `audit_logs` for `MFA_CHALLENGE` actions in the period |

If you can't diagnose in 15 minutes, post the alert + first-pass investigation in the operational Slack / Linear so a follow-up session can dig in.

---

*Last reviewed: 2026-05-09. Next review: 2026-06-01 (after first month with budget alerts active).*
