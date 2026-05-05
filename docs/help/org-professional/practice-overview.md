---
title: Practice dashboard overview
audience: org-professional
slug: practice-overview
category: Getting started
routeContext: /portal/dashboard
lastReviewed: 2026-05-09
order: 2
summary: How to navigate the Practice dashboard — the KPI strip, alert stream, client book table, and TRAIL stage chips.
tags: [practice, dashboard, navigation]
---

# Practice dashboard overview

The Practice dashboard at `/portal/dashboard` is your 8am-Monday-morning view of your client book. This article walks the page.

## How to get here

Sidebar → **Dashboard** (top-most item). Default landing after sign-in.

## What's on the page

| Section | Where it is | What it shows |
|---|---|---|
| **Practice header** | Top | Greeting + practice mode badge (driven by your org's profession) + **Send feedback** pill |
| **KPI strip** | Below header | Total clients · Needs attention · TRAIL stage advanced this week · MRR (where surfaced) |
| **Alert stream** | Centre column | Severity-sorted alerts — red (critical) → amber (high) → blue (medium). Each alert is clickable. |
| **Client book table** | Right column / below alerts on mobile | All clients with TRAIL stage chip, last-reviewed timestamp, scope summary |
| **Filter chips** | Above client book | All / Active / Needs review / Recently advanced |

## Common tasks

**To drill into a client from an alert:**
1. Click the alert in the alert stream.
2. You land on `/portal/clients/[id]/view` for that client.
3. The client view opens to whichever tab is most relevant to the alert (Structure / Money Flow / Dashboard).

**To drill into a client from the table:**
1. Click the client row in the **Client book** table.
2. Same `/portal/clients/[id]/view` page opens.

**To see all alerts for one client:**
1. Open the client view.
2. **Alerts** appear in the AdviserOverlay (right rail on desktop, bottom-sheet on mobile).

**To filter the client book:**
1. Click a filter chip above the table (All / Active / Needs review / Recently advanced).
2. The table filters in place.

**To send feedback to Monitrax:**
1. Click the **Send feedback** pill in the practice header.
2. The feedback form opens with the current page pre-filled.
3. See [Sending feedback](/help/org-professional/sending-feedback).

## Common navigation questions

**Q: What does "Needs attention" count?**
Clients with one or more open alerts of severity HIGH or CRITICAL. The chip on the KPI strip is also clickable to filter the client book to those clients.

**Q: Why does my dashboard look different from another adviser's?**
Practice mode is driven by your org's `profession` setting (financial-advisor / mortgage-broker / accountant / etc.). The KPI definitions, alert library, and column layout adapt.

**Q: Where do I add a client?**
Sidebar → **Clients** → **+ Add client**. Or use the marketplace inbox if a client requested access (Sidebar → **Clients** → **Pending requests**).

**Q: Where do I see my marketplace listing?**
Sidebar → there's no direct link in v1; navigate to `/portal/marketplace/listing`. Coverage map row queued for help-link addition.

**Q: How do I send a message to a client?**
Open the client view → **Conversations** tab in the AdviserOverlay → **+ New thread**. (Phase 32C PR4d ships in-app + email-through-app.)

## What's next

- See [Client drill-in](/help/org-professional/client-drill-in) for the client view page.
- See [Marketplace listing](/help/org-admin/marketplace-listing) (org-admin) for managing how D2C users find you.
- See [Sending feedback](/help/org-professional/sending-feedback) for how to tell Monitrax what to fix or build next.
