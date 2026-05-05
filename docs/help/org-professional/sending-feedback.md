---
title: Sending feedback to Monitrax
audience: org-professional
slug: sending-feedback
category: Getting started
lastReviewed: 2026-05-05
order: 5
summary: How to use the in-app feedback inbox at /portal/feedback — what it's for, what it isn't, how the SLA works, and how to write feedback we can actually act on.
---

# Sending feedback

Monitrax is built in close collaboration with the advisers, brokers, and accountants who use it. The fastest way to influence what we build next — and the fastest way to get a bug fixed — is to drop a thread in the **Feedback inbox**.

## When to use Feedback

| Situation | Use this |
|---|---|
| Bug — something is broken or wrong | **Feedback** with tag `Bug` |
| Idea — wishlist, "I wish Monitrax could..." | **Feedback** with tag `Feature` |
| Friction — confusing label, slow flow, unclear UX | **Feedback** with tag `UX` |
| Question about how something works | Help Center first; if not answered, **Feedback** with tag `Question` |
| Praise — what's working, what your clients react to | **Feedback** with tag `Praise` |
| CDR / AFSL / TPB / privacy concern | **Feedback** with tag `Compliance` (auto-flagged for our compliance archive) |
| You need a question answered for a specific client right now | Use **Ask a Professional** inside that client's record — that's a different channel that goes to your firm's roster, not to Monitrax |
| Formal complaint about Monitrax conduct or service | **Settings → Support** — feedback is editorial, complaints are legal |

## How to send feedback

There are three ways to reach `/portal/feedback`:

1. **Sidebar:** click **Feedback** in the secondary nav at any time.
2. **From the help drawer:** click the `?` button at the top-right of any page → click **Send feedback →** in the drawer footer. The feedback form auto-fills which page you were on so we know exactly where the friction was.
3. **From the Practice header:** the **Send feedback** pill in the dashboard action slot does the same.

Open a new thread by clicking **+ New** in the inbox. Pick a tag, set severity (we default to *Medium*), give it a one-line subject, and write the details.

## Writing feedback we can act on

The single highest-leverage thing you can do is name **what you expected** vs **what happened**.

> ❌ "The cashflow page is wrong."
>
> ✅ "On `/cashflow` for client Sarah, the Surplus card shows $4,200 but my back-of-envelope math says $3,650. I expected the card to match income minus all expenses including loan repayments."

If your feedback references a specific client, **please use a non-identifying tag** like "Client A" or "the trust client". Conversation contents are subject to retention rules — keeping client identifiers out of free-text protects everyone. We have a soft nudge above the input but we can't auto-detect names, so the discipline is yours.

Markdown works in the body — use backticks for code, `[text](url)` for links, **bold** for emphasis.

## What happens after you send

1. The thread shows in your left-rail list immediately with status `Open`.
2. Monitrax aims to reply within **48 hours**, every time. If we miss that bar on a thread, the system flags it internally.
3. When we reply, the status flips to `In review` and you'll see the reply on your next visit (or on email once we wire that — currently in-app only).
4. From there, status moves through `Planned` → `Shipped`, or `Won't fix` / `Duplicate` if we close the thread.
5. You can reply at any time on any of your own threads to add detail, share a follow-up screenshot, or push back on a status.

## Status meanings

| Status | What it means |
|---|---|
| **Open** | Just submitted; awaiting our first response |
| **In review** | We've replied or triaged; thread is being worked |
| **Planned** | On the roadmap — we're shipping a fix or feature for this |
| **Shipped** | Resolved — the change is live |
| **Won't fix** | Out of scope; we'll explain why |
| **Duplicate** | Closed; we'll point you at the canonical thread |

## Privacy + retention

- Feedback threads are **scoped to you** — only you and Monitrax can see your threads. Other advisers in your org cannot read them.
- Threads tagged `Compliance` are retained for **7 years** to match the compliance archive policy. Other threads are retained for 24 months.
- Monitrax keeps **internal notes** on each thread that are never shown to you. These are triage notes only and never include your raw feedback verbatim — they're audit-logged so even our team can't edit them silently.
- The text of your feedback is never sent to a third-party AI without your thread being explicitly tagged for AI synthesis. When tagged, the export goes to a Monitrax-internal Claude Code session for theme analysis only — never to a public model and never to your clients.

## What we use feedback for

Every week (or thereabouts), Reza exports the threads tagged for AI synthesis and pastes them into a private Claude Code session to look for **themes by frequency × severity**. Your one bug report on a niche flow won't always get prioritised solo — but if three advisers report friction in the same area within two weeks, that's the signal that gets us to ship a fix in the next release.

So: **send the small stuff too.** It compounds.
