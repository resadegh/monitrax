# Vendor + Cost Inventory (SSOT)

> **Owner:** Reza.
> **Last reviewed:** 2026-05-09.
> **Maintenance cadence:** Monthly (1st of month) — pull each vendor's invoice + paste actuals into the **Last billed (AUD)** column. Anomalies flagged in the Notes column.
>
> This is the **single source of truth** for every external paid (or pay-eligible) service Monitrax depends on. Reviewers reject PRs that add a new external vendor without registering it here + setting a budget alert per `01_BUDGET_ALERTS_SETUP.md`.

---

## Active vendors

### Tier 1 — Always-on infrastructure (highest cost)

| Vendor | What it does | Pricing model | Est. monthly @ pilot | Last billed (AUD) | Notes |
|---|---|---|---|---|---|
| **Vercel Pro** | App hosting (`monitrax.com.au`); preview deploys; build minutes | Flat US$20/mo + bandwidth + build-minute overages | ~AU$30–45 | _fill_ | Pro tier confirmed 2026-05-01 (Q3 closed); enables `regions: ["syd1"]` pinning + better build minutes |
| **GCP — Cloud SQL Enterprise Plus** | Production DB (`monitrax-db-prod`) + dev DB (`monitrax-db-dev`) | Per-vCPU + RAM + storage; backups extra | ~AU$300–500 | _fill_ | Enterprise Plus tier upgraded 2026-05-02 (Q1 closed). **Single biggest line item.** Quarterly review against actual load (Cloud SQL → Insights tab) |
| **GCP — Cloud Storage** | Document Vault uploads + Stripe receipts + share-package files | $0.020/GB-mo Standard + egress | ~AU$1–10 | _fill_ | Bucket: per-environment under project `monitrax-prod` |
| **GCP — Cloud Logging** | Audit-log dual-emit (365-day CDR retention) | First 50 GB/mo free, then $0.50/GB ingested | ~AU$0–8 | _fill_ | CDR posture requires ≥365-day retention — see CLAUDE.md §13.9 |
| **GCP — Cloud Scheduler** | CDR consent expiry cron + calc-audit cron + (queued) feedback SLA cron | $0.10/job/mo (first 3 free) | ~AU$0–1 | _fill_ | <10 jobs across both environments |
| **GCP — Error Reporting** | Crash + error aggregation | Free up to ingestion cap | AU$0 | _fill_ | Free tier sufficient |
| **GCP — Identity Platform (Firebase Auth)** | All user + admin sign-in (email/password + Google + Apple + Microsoft + Facebook OAuth) | Free up to 50k MAU | AU$0 | _fill_ | Pilot is well within free tier |
| **GCP — Workload Identity Federation** | Vercel function → Cloud SQL auth (no static credentials per CLAUDE.md §13.6) | Free | AU$0 | _fill_ | Compliance posture, not a cost |

### Tier 2 — Pay-per-use (usage-driven)

| Vendor | What it does | Pricing model | Est. monthly @ pilot | Last billed (AUD) | Notes |
|---|---|---|---|---|---|
| **Gemini API** (`@google/generative-ai`) | AI Guide (`/dashboard/cfo`), tax advisor, doc extraction (Vault), bank-transaction categorisation, cashflow summaries | Per-token. Flash ~US$0.075/1M input + $0.30/1M output. Pro ~$1.25/1M input + $5/1M output | ~AU$2–30 | _fill_ | Volume-dependent. Model pinned per call site — see `lib/ai/gemini.ts`. Prompt-cache where reasonable |
| **Anthropic Claude API** (`@anthropic-ai/sdk`) 🔴 **DISABLED 2026-07-01 (kill-switch — code default OFF)** | **Four call sites shared one key:** (1) onboarding chat extraction (Sonnet 4.6 — the ~US$26.54/mo line item); (2) onboarding companion reflections (Haiku); (3) consumer feedback chat triage (Haiku); (4) daily-pulse anomaly narrator (Haiku, fallback-wrapped). NONE is a financial-advice surface — tax advisor / CFO is Gemini-only (no Claude provider exists). | Per-token. **Now ~AU$0** — every path degrades gracefully with the switch off. | **~AU$0 (disabled)** | **June 2026 actual: US$26.54 (Sonnet) + US$0.02 (Haiku) — invoice #NRJTGWOJ-0005** | 🔴 **DISABLED (Reza directive 2026-07-01: "disable that and only stay on gemini for simplicity").** The single gate `isAnthropicConfigured()` (`lib/ai/anthropic.ts:62`) now requires `ANTHROPIC_ENABLED === 'true'` FIRST and defaults **OFF** — fails CLOSED, so no Claude call fires even while `ANTHROPIC_API_KEY` remains set in Vercel. Graceful degradation per call site: onboarding chat extract → form-only wizard (503 `AGENT_NOT_CONFIGURED`); onboarding companion → scripted intro; feedback drawer → form-only ("Reza will reply"); anomaly narrator → deterministic 1-liner. **Re-enable** = set `ANTHROPIC_ENABLED=true` in the runtime env (the key must also still be present). `@anthropic-ai/sdk` dep is RETAINED (no code deletion) so re-enabling is a one-flag change. |
| **Stripe** | Subscription billing for Portal Studio/Practice/Enterprise + lead-fee invoicing | 1.75% + AU$0.30 per AU charge; no fixed | Net positive once paying orgs onboard | _fill_ | Account: `dashboard.stripe.com`. Test-mode until first paying org |
| **Twilio** | SMS for MFA challenge | ~AU$0.04/SMS (AU sender) + AU$0.10 per phone-number toll | ~AU$2–10 | _fill_ | Volume-dependent on MFA enrolments |
| **Google Maps + Places API** | Property address autocomplete (`/dashboard/properties` Add flow) | First US$200/mo credit covers ~28k requests; per-request beyond | AU$0–5 | _fill_ | Free credit sufficient at pilot scale |
| **Basiq** | CDR / open-banking import | Per-active-connection — negotiated tier | Per Reza's Basiq contract | _fill_ | Account: `dashboard.basiq.io`. Tier-up is a Basiq-accreditation milestone |

### Tier 3 — Communication providers (decision pending)

| Vendor | What it does | Pricing model | Est. monthly @ pilot | Last billed (AUD) | Notes |
|---|---|---|---|---|---|
| **Resend** ✅ **CHOSEN** | Transactional email (feedback replies, conversation digests, lead-fee invoices, system notifications) | Free up to 3k emails/mo + 100/day; paid from US$20/mo for 50k | AU$0 at pilot | _fill_ | **Decision 2026-05-09**: chosen over SendGrid (simpler SDK, generous free tier, modern API). Setup: `01_BUDGET_ALERTS_SETUP.md` §3 |
| **SendGrid** ❌ DEPRECATED (code-side) | — | — | — | — | Decision 2026-05-09: SendGrid integration code in `lib/services/feedbackService.ts` + `lib/services/conversationService.ts` + `lib/email/conversationEmail.ts` will be migrated to Resend in a follow-up. Tech Debt #15 added. Until migration, neither account active. |

### Tier 4 — Queued (not yet wired)

| Vendor | What it does | Trigger to enable | Notes |
|---|---|---|---|
| **Xero API** | Personal Xero integration (Phase 41f) | When the user has a Pty Ltd / Sole Trader entity + opts to connect | Free for OAuth; Xero's own API quota applies. No direct billing to Monitrax |
| **GCP Cloud Armor** | WAF for CDR-data endpoints | First paying org / pre-Basiq accreditation | Per CLAUDE.md §13.9 P0; ~US$5 + $0.75/M requests once enabled |
| **GCP Cloud KMS (CMEK)** | Customer-managed encryption keys for CDR data at rest | Pre-Basiq accreditation | Per CLAUDE.md §13.9 P1; ~US$0.06/key/mo + per-operation fee |
| **GCP Cloud DLP** | PII detection in CDR data | Phase 33g feedback inbox at >5 COMPLIANCE-tagged threads/month | CLAUDE.md §13.9 P2; per-call billing |
| **GCP Security Command Center** | Vulnerability scanning + compliance monitoring | Pre-Basiq accreditation | CLAUDE.md §13.9 P0; per-asset/mo |

---

## Removed 2026-05-09

| Vendor | Reason | Closure |
|---|---|---|
| **OpenAI** (`openai` SDK + `OPENAI_API_KEY`) | Phase 11 scaffolded an integration that was never wired up — `categoriseByAI()` was a stub that always returned null; `lib/ai/openai.ts` + `lib/ai/contextBuilder.ts` had zero callers. Future AI work uses Gemini (already in deps). | Files deleted; `package.json` dep removed; stub in `lib/tie/categorisation.ts` replaced with a comment pointer. PR: cost-control-foundation. |

---

## Total estimated monthly @ pilot scale

| Bucket | Range (AUD) |
|---|---|
| Tier 1 — Always-on | ~AU$330–565 |
| Tier 2 — Pay-per-use | ~AU$10–70 |
| Tier 3 — Communication | AU$0 |
| **Total estimate** | **~AU$340–635/mo** |

The single biggest variable is Cloud SQL — Enterprise Plus is right-sized for Basiq accreditation posture but worth a quarterly utilisation review.

---

## Monthly review ritual (15 min, 1st of month)

1. Pull each vendor's invoice / usage report (URLs in `01_BUDGET_ALERTS_SETUP.md`).
2. Paste actuals into the **Last billed** column above.
3. Note anomalies in the Notes column. Flag anything >2× the estimated range.
4. Cross-check against IMPLEMENTATION_PLAN.md — if a vendor jumped because a workstream shipped, link that workstream.
5. Commit the updated doc.

---

## Adding a new vendor

Reviewers MUST reject PRs that introduce a new external vendor without:

1. **Adding a row** to the appropriate Tier table above (Tier 1/2/3/4).
2. **Setting up a budget alert** per `01_BUDGET_ALERTS_SETUP.md` BEFORE the code lands.
3. **§16.2 strategic-decision row** in IMPLEMENTATION_PLAN.md if the vendor is a tier-1 cost.
4. **CDR review** if any user data flows to the new vendor (CLAUDE.md §13.3).

---

## References

- **Setup steps per vendor:** [`01_BUDGET_ALERTS_SETUP.md`](./01_BUDGET_ALERTS_SETUP.md)
- **CDR vendor posture:** `docs/policy/CDR_DATA_RETENTION_SCHEDULE.md`
- **Technology stack overview:** `docs/operational/architecture/03_TECHNOLOGY_STACK.md`
- **CLAUDE.md §12.7** — GCP-First principle (prefer managed services over custom code)
- **CLAUDE.md §13.9** — Required GCP services for CDR compliance (P0/P1/P2)
