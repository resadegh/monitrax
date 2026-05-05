---
title: AI Guide and Actions
audience: consumer
slug: ai-guide-and-actions
category: My Guide
routeContext: /dashboard/cfo
complianceClass: afsl
lastReviewed: 2026-05-09
order: 5
summary: How to navigate the AI Guide page — the Actions list, drill-in cards, Ask a follow-up, and Ask a Professional.
tags: [ai, advisor, guide, actions, navigation]
---

# AI Guide and Actions

The AI Guide page at `/dashboard/cfo` is where Monitrax's AI surfaces the actions most worth taking. This article walks the page.

## How to get here

Sidebar → **My Guide** → **Actions** (default tab).

## What's on the page

| Section | Where it is | What it does |
|---|---|---|
| **Header** | Top of page | Page title + last-refreshed timestamp |
| **Top three actions** | Top of page, large cards | Ranked by impact × urgency. Each card is expandable. |
| **All actions** | Below the top three | The full list of suggestions, including dismissed (toggle to show) |
| **Refresh button** | Top-right header | Forces the AI Guide to re-read your snapshot and regenerate |
| **Tabs** | Below page header | Switch between **Actions** / **Health** / **Tax** |

## What each action card shows

| Field | Where it is | What it means |
|---|---|---|
| **Action title** | Top of the card | The one-line recommendation |
| **Why** | Below the title | The reasoning grounded in your data |
| **Estimated impact** | Right of the card | $ impact this year (where computable) |
| **Ask a follow-up** | Bottom-left of expanded card | Opens AI chat scoped to this action |
| **Ask a Professional** | Bottom-right of expanded card | Opens the human escalation picker |
| **Dismiss** | Bottom of expanded card | Removes the action; the Guide stops surfacing it |

## Common tasks

**To expand an action:**
1. Click the action card.
2. The card expands to show Why, Impact, and the action buttons.

**To ask a follow-up question on an action:**
1. Expand the action card.
2. Click **Ask a follow-up** at the bottom-left.
3. AI chat opens with the action context pre-loaded. Type your question.

**To escalate to a human:**
1. Expand the action card.
2. Click **Ask a Professional** at the bottom-right.
3. The picker opens. If you're org-attached, you see your firm's professionals; if you're a D2C user, you see the marketplace top picks for the action's context.
4. Click a professional → opens their compose dialog.

**To dismiss an action permanently:**
1. Expand the card → **Dismiss**.
2. Confirm. The Guide will not re-surface it.

**To regenerate the action list:**
1. Click **Refresh** in the page header.
2. Wait 5–10 seconds. The AI re-reads your snapshot.

## Common navigation questions

**Q: Where's the chat with the AI?**
Bottom-right floating chat button on any page (the bot icon). The compact chat is for general Q&A; the **Ask a follow-up** on an action card is scoped to that action.

**Q: How do I see actions I previously dismissed?**
Toggle **Show dismissed** at the bottom of the page.

**Q: Where does Tax go?**
Same My Guide section → **Tax** tab. See [Your tax position](/help/consumer/your-tax-position).

**Q: Where does Health go?**
Same My Guide section → **Health** tab.

**Q: Why is the AI not making personal product recommendations?**
By design — the AI gives **general information**; **Ask a Professional** routes you to a human for personal product advice. See compliance footer below.

## Compliance footer

The AI Guide provides **general information only**. It does not constitute personal financial product advice, credit advice, or tax agent services. Decisions about specific products, structures, or actions affecting your circumstances should be made with a licensed professional via the **Ask a Professional** affordance. See `docs/help/compliance/asic-rg244-rg36-boundary-statement.md`.
