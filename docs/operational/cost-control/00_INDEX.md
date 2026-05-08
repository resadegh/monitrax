# Cost Control — Operational Docs

How Monitrax controls vendor spend. Two docs:

| # | Document | Purpose |
|---|---|---|
| 00 | [Vendor Inventory (SSOT)](00_VENDOR_INVENTORY.md) | Every external paid (or pay-eligible) service. Pricing model + estimated range + actual billed amount per month. |
| 01 | [Budget Alerts + Spend Caps Setup](01_BUDGET_ALERTS_SETUP.md) | Step-by-step per-vendor setup for budget alerts + hard ceilings. Run §1–§3 BEFORE the next external integration ships. |

## Quick links

| Need | Document |
|---|---|
| What does Monitrax pay for? | [Vendor Inventory](00_VENDOR_INVENTORY.md) — Tier 1/2/3/4 tables |
| How do I set a GCP budget alert? | [Setup Runbook §1](01_BUDGET_ALERTS_SETUP.md#1-gcp--set-a-project-wide-budget--alerts) |
| How do I cap Vercel spend? | [Setup Runbook §2](01_BUDGET_ALERTS_SETUP.md#2-vercel-pro--hard-ceiling-on-spend) |
| How do I set up Resend (chosen email provider)? | [Setup Runbook §3](01_BUDGET_ALERTS_SETUP.md#3-resend--email-provider-setup-chosen-2026-05-09) |
| How do I cap Anthropic API spend? | [Setup Runbook §4](01_BUDGET_ALERTS_SETUP.md#4-anthropic-claude-api--when-phase-33g2-lands) |
| Monthly review checklist | [Setup Runbook §9](01_BUDGET_ALERTS_SETUP.md#9-monthly-review-checklist-1st-of-month) |

## Vendor decision log

Material vendor decisions (which provider to use, which to remove) live as rows in [`00_VENDOR_INVENTORY.md`](00_VENDOR_INVENTORY.md):

- **2026-05-09 — Resend chosen over SendGrid** for transactional email. Tracked in Tier 3.
- **2026-05-09 — OpenAI removed** (Phase 11 stub, never wired). Tracked in "Removed" section.
- **2026-05-09 — Anthropic queued** for Phase 33g.2 live AI feedback chat. Setup steps in `01_BUDGET_ALERTS_SETUP.md` §4.
